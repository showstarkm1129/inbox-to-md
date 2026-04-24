"""
Inbox-to-MD: ローカルMarkdownメモ整理アプリ
Flask バックエンド
"""

import os
import json
import glob
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# ===== パス定義 =====
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
INBOX_DIR = os.path.join(DATA_DIR, "inbox")
CATEGORY_DIR = os.path.join(DATA_DIR, "category")
ARCHIVE_DIR = os.path.join(DATA_DIR, "archive")
TAGS_PATH = os.path.join(DATA_DIR, "tags.json")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

# ===== 初期ファイルのデフォルト値 =====
DEFAULT_TAGS = ["簿記", "基本情報", "雑記", "その他"]

DEFAULT_CONFIG = {
    "api_keys": {
        "gemini-1.5-flash": ""
    },
    "current_model": "gemini-1.5-flash",
    "autosave_interval_ms": 3000,
}


def ensure_directories():
    """必要なディレクトリを自動生成する"""
    for dir_path in [DATA_DIR, INBOX_DIR, CATEGORY_DIR, ARCHIVE_DIR]:
        os.makedirs(dir_path, exist_ok=True)


def ensure_files():
    """必要な初期ファイルを自動生成する（存在しない場合のみ）"""
    # 初期の下書きファイルを作成
    default_inbox = os.path.join(INBOX_DIR, "draft_1.md")
    if not os.path.exists(default_inbox):
        with open(default_inbox, "w", encoding="utf-8") as f:
            f.write("# 新しいメモ\nここに書きなぐってください。")

    # tags.json
    if not os.path.exists(TAGS_PATH):
        with open(TAGS_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_TAGS, f, ensure_ascii=False, indent=2)

    # config.json
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=2)


# ===== ルート =====
@app.route("/")
def index():
    """メインページを表示"""
    return render_template("index.html")


@app.route("/api/config", methods=["GET"])
def get_config():
    """設定を取得（APIキーはマスクする）"""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        # 移行処理
        if "api_keys" not in config:
            config["api_keys"] = {}
            if "gemini_api_key" in config and "model_name" in config:
                config["api_keys"][config["model_name"]] = config.pop("gemini_api_key")
                config["current_model"] = config.pop("model_name")
            else:
                config["api_keys"]["gemini-1.5-flash"] = ""
                config["current_model"] = "gemini-1.5-flash"
        
        # UI表示用にAPIキーを部分的に隠す
        for model, key in config["api_keys"].items():
            if key and len(key) > 8:
                config["api_keys"][model] = key[:4] + "*" * (len(key) - 8) + key[-4:]
        
        return jsonify(config)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/config", methods=["POST"])
def save_config():
    """設定を保存"""
    try:
        new_config = request.json
        
        # 既存の設定を読み込む
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            current_config = json.load(f)
            
        if "api_keys" not in current_config:
            current_config["api_keys"] = {}
        
        # マスクされたAPIキーを元のキーに戻す
        if "api_keys" in new_config:
            for model, new_key in new_config["api_keys"].items():
                if "*" in new_key:
                    new_config["api_keys"][model] = current_config["api_keys"].get(model, "")
                    
        current_config.update(new_config)
        
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(current_config, f, ensure_ascii=False, indent=2)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== Inbox API =====
@app.route("/api/inbox", methods=["GET"])
def get_inbox_files():
    """inboxディレクトリ内のファイル一覧を取得"""
    try:
        files = []
        for f in os.listdir(INBOX_DIR):
            if f.endswith((".md", ".txt")):
                files.append(f)
        # 更新日時順などでソートするならここで処理（今回は名前順）
        files.sort()
        return jsonify({"files": files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inbox/<filename>", methods=["GET"])
def get_inbox_file(filename):
    """指定したinboxファイルの内容を取得"""
    try:
        safe_filename = secure_filename(filename)
        filepath = os.path.join(INBOX_DIR, safe_filename)
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inbox/<filename>", methods=["POST"])
def save_inbox_file(filename):
    """指定したinboxファイルに内容を保存"""
    try:
        safe_filename = secure_filename(filename)
        filepath = os.path.join(INBOX_DIR, safe_filename)
        content = request.json.get("content", "")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inbox/new", methods=["POST"])
def create_inbox_file():
    """新しいinboxファイルを作成"""
    try:
        ext = request.json.get("extension", ".md")
        if ext not in [".md", ".txt"]:
            ext = ".md"
            
        # draft_X.ext を探す
        existing_drafts = glob.glob(os.path.join(INBOX_DIR, f"draft_*{ext}"))
        new_index = len(existing_drafts) + 1
        
        # 既存の名前と被らないようにチェック
        while True:
            new_filename = f"draft_{new_index}{ext}"
            new_filepath = os.path.join(INBOX_DIR, new_filename)
            if not os.path.exists(new_filepath):
                break
            new_index += 1
            
        with open(new_filepath, "w", encoding="utf-8") as f:
            f.write(f"# 新しいメモ ({new_filename})\n")
            
        return jsonify({"status": "success", "filename": new_filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== Category API =====
@app.route("/api/files", methods=["GET"])
def get_category_files():
    """categoryディレクトリ内のファイル一覧を取得"""
    try:
        files = []
        for f in os.listdir(CATEGORY_DIR):
            if f.endswith(".md"):
                files.append(f)
        files.sort()
        return jsonify({"files": files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/<filename>", methods=["GET"])
def get_category_file(filename):
    """指定したcategoryファイルの内容を取得"""
    try:
        safe_filename = secure_filename(filename)
        filepath = os.path.join(CATEGORY_DIR, safe_filename)
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== 起動 =====
if __name__ == "__main__":
    ensure_directories()
    ensure_files()
    app.run(debug=True, port=5000)
