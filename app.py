"""
Inbox-to-MD: ローカルMarkdownメモ整理アプリ
Flask バックエンド
"""

import os
import json
import glob
import re
import datetime
import shutil
import google.generativeai as genai
import threading
import webbrowser
from flask import Flask, render_template, request, jsonify
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

def secure_filename_jp(filename):
    """
    日本語を含むファイル名を安全にする。
    werkzeug.utils.secure_filename は非ASCIIを排除するため自作。
    """
    # 1. Windows/Linuxの両方で禁止されている文字を置換
    # \ / : * ? " < > | および制御文字
    filename = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', filename)
    # 2. ディレクトリトラバーサル防止 (.. を無効化)
    # os.path.basename を通すのが最も確実
    filename = os.path.basename(filename)
    # 3. 先頭のドットを削除 (隠しファイル化防止)
    filename = filename.lstrip('.')
    
    if not filename:
        filename = "unnamed"
        
    # 念のため長すぎる名前をカット (Windowsの制限考慮)
    return filename[:200]

# ===== パス定義 =====
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
INBOX_DIR = os.path.join(DATA_DIR, "inbox")
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
    "system_prompt_suffix": """---
【システム絶対ルール】
あなたは上記の指示に従ってテキストを処理しますが、出力形式は絶対に以下のJSON配列のみとしてください。
Markdownのコードブロック(```json)や前置き・説明は一切含めず、純粋なJSON文字列のみを返してください。
[
  {
    "filename": "保存先のファイル名（例: 簿記.md, 2026-04-24.md）",
    "content": "ファイルに書き込む内容"
  }
]""",
    "workflows": [
        {
            "id": "w1",
            "name": "カテゴリ整理",
            "folder": "category",
            "prompt": "上記メモを文脈・トピックごとに分割し、各ブロックに最も適切なタグを1つ付けてください。どのタグにも該当しない場合は「その他」を使用してください。"
        }
    ]
}


def ensure_directories():
    """必要なディレクトリを自動生成する"""
    for dir_path in [DATA_DIR, INBOX_DIR, ARCHIVE_DIR]:
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
            
        # デフォルト値のフォールバック
        if "system_prompt_suffix" not in config:
            config["system_prompt_suffix"] = DEFAULT_CONFIG["system_prompt_suffix"]
        
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
            
        old_workflows = {wf.get("id"): wf.get("folder") for wf in current_config.get("workflows", []) if wf.get("id") and wf.get("folder")}
            
        if "api_keys" not in current_config:
            current_config["api_keys"] = {}
        
        # マスクされたAPIキーを元のキーに戻す
        if "api_keys" in new_config:
            for model, new_key in new_config["api_keys"].items():
                if "*" in new_key:
                    new_config["api_keys"][model] = current_config["api_keys"].get(model, "")
                    
        current_config.update(new_config)
        
        # フォルダ名の変更を検知してリネームする
        if "workflows" in new_config:
            for wf in new_config["workflows"]:
                wf_id = wf.get("id")
                new_folder = wf.get("folder")
                if wf_id and new_folder:
                    old_folder = old_workflows.get(wf_id)
                    if old_folder and old_folder != new_folder:
                        old_path = os.path.join(DATA_DIR, old_folder)
                        new_path = os.path.join(DATA_DIR, new_folder)
                        if os.path.exists(old_path) and not os.path.exists(new_path):
                            try:
                                os.rename(old_path, new_path)
                            except Exception as e:
                                print(f"Folder rename failed: {e}")
        
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
        safe_filename = secure_filename_jp(filename)
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
        safe_filename = secure_filename_jp(filename)
        filepath = os.path.join(INBOX_DIR, safe_filename)
        content = request.json.get("content", "")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inbox/<filename>/rename", methods=["POST"])
def rename_inbox_file(filename):
    """指定したinboxファイルの名前を変更"""
    try:
        safe_filename = secure_filename_jp(filename)
        filepath = os.path.join(INBOX_DIR, safe_filename)
        
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        new_filename = request.json.get("new_filename", "")
        if not new_filename:
            return jsonify({"error": "New filename is required"}), 400
            
        safe_new_filename = secure_filename_jp(new_filename)
        new_filepath = os.path.join(INBOX_DIR, safe_new_filename)
        
        if os.path.exists(new_filepath):
            return jsonify({"error": "A file with the new name already exists"}), 400
            
        os.rename(filepath, new_filepath)
            
        return jsonify({"status": "success", "new_filename": safe_new_filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inbox/<filename>", methods=["DELETE"])
def delete_inbox_file(filename):
    """指定したinboxファイルを削除"""
    try:
        safe_filename = secure_filename_jp(filename)
        filepath = os.path.join(INBOX_DIR, safe_filename)
        
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        os.remove(filepath)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/api/inbox/new", methods=["POST"])
def create_inbox_file():
    """新しいinboxファイルを作成"""
    try:
        filename = request.json.get("filename")
        ext = request.json.get("extension", ".md")
        
        if filename:
            # ユーザー指定の名前を使用
            safe_filename = secure_filename_jp(filename)
            # 拡張子がない場合は補完
            if not os.path.splitext(safe_filename)[1]:
                safe_filename += ext
        else:
            # 自動生成 (従来の動作も維持)
            if ext not in [".md", ".txt"]:
                ext = ".md"
            existing_drafts = glob.glob(os.path.join(INBOX_DIR, f"draft_*{ext}"))
            new_index = len(existing_drafts) + 1
            while True:
                safe_filename = f"draft_{new_index}{ext}"
                new_filepath = os.path.join(INBOX_DIR, safe_filename)
                if not os.path.exists(new_filepath):
                    break
                new_index += 1
        
        new_filepath = os.path.join(INBOX_DIR, safe_filename)
        if os.path.exists(new_filepath):
            return jsonify({"error": "その名前のファイルは既に存在します"}), 400
            
        with open(new_filepath, "w", encoding="utf-8") as f:
            f.write("# 新しいメモ\n")
            
        return jsonify({"status": "success", "filename": safe_filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== Workflow Files API =====
@app.route("/api/files", methods=["GET"])
def get_workflow_files():
    """全ワークフローのフォルダ内ファイル一覧を取得"""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
            
        workflows = config.get("workflows", [])
        result = {}
        for wf in workflows:
            folder_name = wf.get("folder")
            if not folder_name: continue
            
            folder_path = os.path.join(DATA_DIR, folder_name)
            os.makedirs(folder_path, exist_ok=True)
            
            # secure_filename_jpはファイル名を受け取る想定だが、フォルダ名も安全にする
            safe_folder = secure_filename_jp(folder_name)
            folder_path = os.path.join(DATA_DIR, safe_folder)
            
            files = []
            for file_name in os.listdir(folder_path):
                if file_name.endswith(".md"):
                    files.append(file_name)
            files.sort()
            result[safe_folder] = files
            
        return jsonify({"folders": result, "workflows": workflows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/<folder>/<filename>", methods=["GET"])
def get_workflow_file(folder, filename):
    """指定したワークフローフォルダ内のファイルの内容を取得"""
    try:
        safe_folder = secure_filename_jp(folder)
        safe_filename = secure_filename_jp(filename)
        filepath = os.path.join(DATA_DIR, safe_folder, safe_filename)
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/<folder>/<filename>/rename", methods=["POST"])
def rename_workflow_file(folder, filename):
    """指定したワークフローフォルダ内のファイルの名前を変更"""
    try:
        safe_folder = secure_filename_jp(folder)
        safe_filename = secure_filename_jp(filename)
        filepath = os.path.join(DATA_DIR, safe_folder, safe_filename)
        
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        new_filename = request.json.get("new_filename", "")
        if not new_filename:
            return jsonify({"error": "New filename is required"}), 400
            
        safe_new_filename = secure_filename_jp(new_filename)
        new_filepath = os.path.join(DATA_DIR, safe_folder, safe_new_filename)
        
        if os.path.exists(new_filepath):
            return jsonify({"error": "A file with the new name already exists"}), 400
            
        os.rename(filepath, new_filepath)
            
        return jsonify({"status": "success", "new_filename": safe_new_filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/<folder>/<filename>", methods=["DELETE"])
def delete_workflow_file(folder, filename):
    """指定したワークフローフォルダ内のファイルを削除"""
    try:
        safe_folder = secure_filename_jp(folder)
        safe_filename = secure_filename_jp(filename)
        filepath = os.path.join(DATA_DIR, safe_folder, safe_filename)
        
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
            
        os.remove(filepath)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/folders/<folder>", methods=["DELETE"])
def delete_workflow_folder(folder):
    """指定したワークフローフォルダを削除（物理フォルダの削除）"""
    try:
        safe_folder = secure_filename_jp(folder)
        folder_path = os.path.join(DATA_DIR, safe_folder)
        
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== System API =====
@app.route("/api/system/info")
def get_system_info():
    """システムのローカルパス情報を取得"""
    return jsonify({
        "base_dir": os.path.abspath(BASE_DIR),
        "data_dir": os.path.abspath(DATA_DIR),
        "inbox_dir": os.path.abspath(INBOX_DIR),
    })

@app.route("/api/system/open", methods=["POST"])
def open_local_folder():
    """指定したローカルフォルダをエクスプローラーで開く"""
    try:
        path = request.json.get("path")
        if not path:
            path = DATA_DIR
        
        # セキュリティ: 指定パスがBASE_DIR以下であることを確認
        abs_path = os.path.abspath(path)
        base_path = os.path.abspath(BASE_DIR)
        
        if not os.path.normcase(abs_path).startswith(os.path.normcase(base_path)):
            return jsonify({"error": "アクセス権限がありません"}), 403
            
        if os.path.exists(abs_path):
            if os.name == 'nt':  # Windows
                os.startfile(abs_path)
            else:
                import subprocess
                cmd = 'open' if os.name == 'posix' else 'xdg-open'
                subprocess.run([cmd, abs_path])
            return jsonify({"status": "success"})
        else:
            return jsonify({"error": "パスが見つかりません"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== Organize API (Step 8) =====
SYSTEM_PROMPT_SUFFIX = """
---
【システム絶対ルール】
あなたは上記の指示に従ってテキストを処理しますが、出力形式は絶対に以下のJSON配列のみとしてください。
Markdownのコードブロック(```json)や前置き・説明は一切含めず、純粋なJSON文字列のみを返してください。
[
  {
    "filename": "保存先のファイル名（例: 簿記.md, 2026-04-24.md）",
    "content": "ファイルに書き込む内容"
  }
]
"""

def extract_json_from_text(text):
    """レスポンスからJSON部分を抽出する（Markdownコードブロック対策）"""
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


@app.route("/api/organize", methods=["POST"])
def organize_memo():
    """選択された複数のメモ内容をすべてのワークフローで処理し、ファイルに追記してアーカイブする"""
    try:
        data = request.json
        filenames = data.get("filenames", [])
        no_archive = data.get("no_archive", False)
        
        if not filenames:
            return jsonify({"status": "error", "message": "対象ファイルが選択されていません"}), 400

        combined_content = ""
        for fn in filenames:
            safe_fn = secure_filename_jp(fn)
            filepath = os.path.join(INBOX_DIR, safe_fn)
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    combined_content += f"\n\n--- 【ファイル名: {safe_fn}】 ---\n" + f.read()

        if not combined_content.strip():
            return jsonify({"status": "error", "message": "テキストが空です"}), 400

        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
            
        system_prompt_suffix = config.get("system_prompt_suffix", SYSTEM_PROMPT_SUFFIX)
            
        current_model = config.get("current_model", "gemini-1.5-flash")
        api_keys = config.get("api_keys", {})
        api_key = api_keys.get(current_model, "")
        
        if not api_key:
            return jsonify({"status": "error", "message": "APIキーが設定されていません。"}), 400
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(current_model)
        
        workflows = config.get("workflows", [])
        workflow_ids = data.get("workflow_ids", [])
        if workflow_ids:
            # IDまたはフォルダ名でフィルタリング（互換性のため）
            workflows = [wf for wf in workflows if (wf.get("id") in workflow_ids or wf.get("folder") in workflow_ids)]

        if not workflows:
            return jsonify({"status": "error", "message": "処理対象のワークフローが選択されていないか、設定されていません。"}), 400
            
        # 1. API通信フェーズ
        results = []
        for wf in workflows:
            prompt = wf.get("prompt", "")
            if not prompt: continue
            
            additional_prompt = data.get("additional_prompt", "").strip()
            if additional_prompt:
                full_prompt = f"{prompt}\n\n【追加の指示】\n{additional_prompt}\n\n# 対象テキスト\n{combined_content}\n\n{system_prompt_suffix}"
            else:
                full_prompt = f"{prompt}\n\n# 対象テキスト\n{combined_content}\n\n{system_prompt_suffix}"
            
            parsed_data = None
            last_error = ""
            # エラー対策で最大2回リトライする
            for attempt in range(2):
                try:
                    response = model.generate_content(full_prompt)
                    parsed_data = extract_json_from_text(response.text)
                    break
                except Exception as e:
                    print(f"[Workflow {wf.get('name')}] Attempt {attempt+1} failed: {e}")
                    last_error = str(e)
            
            if parsed_data is not None:
                results.append({
                    "workflow_id": wf.get("id"),
                    "name": wf.get("name"),
                    "folder": wf.get("folder"),
                    "data": parsed_data
                })
            else:
                return jsonify({"status": "error", "message": f"ルール「{wf.get('name')}」の処理に失敗しました。詳細: {last_error}"}), 500
                
        # 2. ファイル書き込みフェーズ (トランザクション的)
        for r in results:
            folder_path = os.path.join(DATA_DIR, r["folder"])
            os.makedirs(folder_path, exist_ok=True)
            for item in r["data"]:
                target_filename = secure_filename_jp(item.get("filename", "untitled.md"))
                target_content = item.get("content", "")
                
                target_filepath = os.path.join(folder_path, target_filename)
                with open(target_filepath, "a", encoding="utf-8") as f:
                    # 追記時は区切りや改行を入れる
                    if os.path.exists(target_filepath) and os.path.getsize(target_filepath) > 0:
                        f.write("\n\n")
                    f.write(target_content)

        # 3. アーカイブ処理（no_archiveオプションが指定された場合はスキップ）
        if not no_archive:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            for fn in filenames:
                safe_fn = secure_filename_jp(fn)
                inbox_filepath = os.path.join(INBOX_DIR, safe_fn)
                if os.path.exists(inbox_filepath):
                    archive_filename = f"{timestamp}_{safe_fn}"
                    archive_filepath = os.path.join(ARCHIVE_DIR, archive_filename)
                    shutil.move(inbox_filepath, archive_filepath)

        return jsonify({"status": "success", "results": results, "archived": not no_archive})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def open_browser():
    """サーバー起動後にブラウザを開く"""
    webbrowser.open("http://127.0.0.1:5000")


# ===== 起動 =====
if __name__ == "__main__":
    ensure_directories()
    ensure_files()

    # リローダーによる二重実行を防止してブラウザを開く
    if not os.environ.get("WERKZEUG_RUN_MAIN"):
        threading.Timer(1.25, open_browser).start()

    app.run(debug=True, port=5000)
