/* Inbox to MD - Step 2: 3ペインUIロジック */

document.addEventListener('DOMContentLoaded', () => {
    // === 1. 表示モード切り替え ===
    const mainContent = document.getElementById('main-content');
    const viewEditorBtn = document.getElementById('view-editor');
    const viewSplitBtn = document.getElementById('view-split');
    const viewPreviewBtn = document.getElementById('view-preview');

    const modeButtons = [viewEditorBtn, viewSplitBtn, viewPreviewBtn];

    function setViewMode(mode, activeBtn) {
        // 全クラスをクリアして指定されたモードをセット
        mainContent.classList.remove('editor-mode', 'split-mode', 'preview-mode');
        mainContent.classList.add(mode);

        // ボタンの見た目を更新
        modeButtons.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    viewEditorBtn.addEventListener('click', () => setViewMode('editor-mode', viewEditorBtn));
    viewSplitBtn.addEventListener('click', () => setViewMode('split-mode', viewSplitBtn));
    viewPreviewBtn.addEventListener('click', () => setViewMode('preview-mode', viewPreviewBtn));


    // === 2. 左ペインの折りたたみ（サイドバー切り替え） ===
    const paneLeft = document.getElementById('pane-left');
    const collapsedSidebar = document.getElementById('collapsed-sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const expandSidebarBtn = document.getElementById('expand-sidebar');

    toggleSidebarBtn.addEventListener('click', () => {
        paneLeft.classList.add('hidden');
        collapsedSidebar.classList.remove('hidden');
    });

    expandSidebarBtn.addEventListener('click', () => {
        collapsedSidebar.classList.add('hidden');
        paneLeft.classList.remove('hidden');
    });


    // === 3. ファイルツリーの開閉（アコーディオン） ===
    const treeHeaders = document.querySelectorAll('.tree-header');

    treeHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const targetList = document.getElementById(targetId);
            const icon = header.querySelector('.tree-icon');

            if (targetList.classList.contains('hidden')) {
                // 開く
                targetList.classList.remove('hidden');
                header.classList.remove('collapsed');
                icon.textContent = '▼';
            } else {
                // 閉じる
                targetList.classList.add('hidden');
                header.classList.add('collapsed');
                icon.textContent = '▶';
            }
        });
    });
    // === 4. 設定モーダルの開閉と保存 ===
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsForm = document.getElementById('settings-form');
    const modelNameInput = document.getElementById('model-name');
    const apiKeyInput = document.getElementById('api-key');
    
    let loadedApiKeys = {};

    // 設定を読み込んでフォームに反映
    async function loadConfig() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            loadedApiKeys = config.api_keys || {};
            const currentModel = config.current_model || 'gemini-1.5-flash';
            
            // datalistの更新
            const dataList = document.getElementById('model-list');
            dataList.innerHTML = '';
            
            // 保存されているモデルのみを選択肢に表示
            const allModels = Object.keys(loadedApiKeys);
            
            allModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                dataList.appendChild(option);
            });

            modelNameInput.value = currentModel;
            apiKeyInput.value = loadedApiKeys[currentModel] || '';
            document.getElementById('autosave-interval').value = config.autosave_interval_ms || 3000;
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    }

    // モデル名が変更されたら、対応するAPIキーをセットする
    modelNameInput.addEventListener('input', () => {
        const selectedModel = modelNameInput.value;
        if (loadedApiKeys[selectedModel]) {
            apiKeyInput.value = loadedApiKeys[selectedModel];
        } else {
            apiKeyInput.value = ''; // 知らないモデルなら空にする
        }
    });

    settingsBtn.addEventListener('click', () => {
        loadConfig();
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // モーダル外クリックで閉じる
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    // 設定の保存
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentModel = modelNameInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        
        if (!currentModel) {
            alert('モデル名を入力してください');
            return;
        }

        // 新しいキーリストを作成
        const newApiKeys = { ...loadedApiKeys };
        newApiKeys[currentModel] = apiKey;

        const newConfig = {
            api_keys: newApiKeys,
            current_model: currentModel,
            autosave_interval_ms: parseInt(document.getElementById('autosave-interval').value)
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            if (response.ok) {
                alert('設定を保存しました');
                settingsModal.classList.add('hidden');
            } else {
                alert('保存に失敗しました');
            }
        } catch (error) {
            console.error('保存エラー:', error);
            alert('通信エラーが発生しました');
        }
    });
});
