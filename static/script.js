/* Inbox to MD - Step 2: 3ペインUIロジック */

document.addEventListener('DOMContentLoaded', () => {
    // === トースト通知 ===
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'warning') icon = '⚠️';
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // === カスタムダイアログ（Promiseベース） ===
    function showCustomConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-confirm-modal');
            document.getElementById('custom-confirm-title').textContent = title;
            document.getElementById('custom-confirm-message').textContent = message;
            
            const btnOk = document.getElementById('custom-confirm-ok');
            const btnCancel = document.getElementById('custom-confirm-cancel');
            const btnClose = document.getElementById('custom-confirm-close');

            const cleanupAndResolve = (result) => {
                modal.classList.add('hidden');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                btnClose.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeydown);
                resolve(result);
            };

            const onOk = () => cleanupAndResolve(true);
            const onCancel = () => cleanupAndResolve(false);
            const onKeydown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
                if (e.key === 'Enter') {
                    e.preventDefault(); // デフォルトのclick発火を防ぐ
                    // もし現在アクティブな要素がキャンセルボタンならキャンセル
                    if (document.activeElement === btnCancel) {
                        onCancel();
                    } else {
                        onOk();
                    }
                }
            };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            btnClose.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeydown);

            modal.classList.remove('hidden');
            
            // 少し遅延させてからOKボタンにフォーカス（Enterですぐ削除できるように）
            setTimeout(() => {
                btnOk.focus();
            }, 50);
        });
    }

    function showCustomPrompt(title, message, defaultValue = '', selectionStart = null, selectionEnd = null) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-prompt-modal');
            document.getElementById('custom-prompt-title').textContent = title;
            document.getElementById('custom-prompt-message').textContent = message;
            
            const input = document.getElementById('custom-prompt-input');
            input.value = defaultValue;
            
            const btnOk = document.getElementById('custom-prompt-ok');
            const btnCancel = document.getElementById('custom-prompt-cancel');
            const btnClose = document.getElementById('custom-prompt-close');

            const cleanupAndResolve = (result) => {
                modal.classList.add('hidden');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                btnClose.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeydown);
                resolve(result);
            };

            const onOk = () => cleanupAndResolve(input.value);
            const onCancel = () => cleanupAndResolve(null);
            const onKeydown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onOk();
                }
            };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            btnClose.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeydown);

            modal.classList.remove('hidden');
            
            // 少し遅延させてから選択状態にする
            setTimeout(() => {
                input.focus();
                if (selectionStart !== null && selectionEnd !== null) {
                    input.setSelectionRange(selectionStart, selectionEnd);
                } else {
                    input.select();
                }
            }, 50);
        });
    }

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
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.tree-header');
        if (!header) return;
        
        const targetId = header.getAttribute('data-target');
        const targetList = document.getElementById(targetId);
        if (!targetList) return;
        
        const icon = header.querySelector('.tree-icon');

        if (targetList.classList.contains('hidden')) {
            // 開く
            targetList.classList.remove('hidden');
            header.classList.remove('collapsed');
            if (icon) icon.textContent = '▼';
        } else {
            // 閉じる
            targetList.classList.add('hidden');
            header.classList.add('collapsed');
            if (icon) icon.textContent = '▶';
        }
    });

    // === グローバルクリックイベント：ドロップダウンメニューの開閉と外側クリックによるクローズ ===
    document.addEventListener('click', (e) => {
        const dropBtn = e.target.closest('.dropbtn');
        
        // 開いているすべてのドロップダウンを閉じる（クリックしたものが自分自身のトグルボタンでなければ）
        document.querySelectorAll('.dropdown.active, .file-actions.active').forEach(el => {
            if (!dropBtn || el !== dropBtn.closest('.dropdown')) {
                el.classList.remove('active');
            }
        });
        
        // ファイルメニュー開閉用のスタイルをクリア
        document.querySelectorAll('.file-item-wrapper.menu-open, .tree-header-wrapper.menu-open').forEach(el => {
            // クリックしたボタン自身が属するメニューラッパーでなければクリア
            if (!dropBtn || el !== dropBtn.closest('.file-item-wrapper, .tree-header-wrapper')) {
                el.classList.remove('menu-open');
            }
        });
        
        // ヘッダーなどにある汎用的なドロップダウンのトグル処理
        if (dropBtn) {
            const dropdown = dropBtn.closest('.dropdown');
            // 個別のファイルメニュー(file-actions)はstopPropagationされるためここには到達しないが念のため除外
            if (dropdown && !dropdown.classList.contains('file-actions')) {
                dropdown.classList.toggle('active');
            }
        }
    });

    // === 4. 設定モーダルの開閉と保存 ===
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsForm = document.getElementById('settings-form');
    const modelNameInput = document.getElementById('model-name');
    const apiKeyInput = document.getElementById('api-key');
    
    let loadedApiKeys = {};
    let loadedWorkflows = [];

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
            document.getElementById('system-prompt-suffix').value = config.system_prompt_suffix || '';
            
            loadedWorkflows = config.workflows || [];
            renderWorkflows();
            
            // システムパス情報を取得して表示
            loadSystemInfo();
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    }

    function renderWorkflows() {
        const container = document.getElementById('workflows-container');
        if (!container) return;
        container.innerHTML = '';
        loadedWorkflows.forEach((wf, index) => {
            const item = document.createElement('div');
            item.className = 'workflow-item';
            item.innerHTML = `
                <div class="workflow-item-header">
                    <h4>ルール ${index + 1}</h4>
                    <button type="button" class="delete-workflow-btn" data-index="${index}">削除</button>
                </div>
                <div class="form-group">
                    <label>表示名 (例: カテゴリ整理)</label>
                    <input type="text" class="wf-name" value="${wf.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>保存先フォルダ名 (英数字推奨)</label>
                    <input type="text" class="wf-folder" value="${wf.folder || ''}" required>
                </div>
                <div class="form-group">
                    <label>プロンプト指示</label>
                    <textarea class="wf-prompt" required placeholder="上記メモを文脈・トピックごとに分割し...">${wf.prompt || ''}</textarea>
                </div>
            `;
            container.appendChild(item);
        });
        
        container.querySelectorAll('.delete-workflow-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                loadedWorkflows.splice(idx, 1);
                renderWorkflows();
            });
        });
    }

    let systemPaths = { base_dir: '', data_dir: '', inbox_dir: '' };
    async function loadSystemInfo() {
        try {
            const res = await fetch('/api/system/info');
            systemPaths = await res.json();
            const baseDirEl = document.getElementById('path-base-dir');
            const dataDirEl = document.getElementById('path-data-dir');
            if (baseDirEl) baseDirEl.textContent = systemPaths.base_dir;
            if (dataDirEl) dataDirEl.textContent = systemPaths.data_dir;
        } catch (e) { console.error(e); }
    }

    const openDataFolderBtn = document.getElementById('open-data-folder-btn');
    if (openDataFolderBtn) {
        openDataFolderBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/system/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: systemPaths.data_dir })
                });
                if (res.ok) {
                    showToast('エクスプローラーで開きました', 'success');
                } else {
                    const data = await res.json();
                    showToast('エラー: ' + (data.error || '開けませんでした'), 'error');
                }
            } catch (e) { 
                console.error(e); 
                showToast('通信エラーが発生しました', 'error');
            }
        });
    }

    const addWorkflowBtn = document.getElementById('add-workflow-btn');
    if (addWorkflowBtn) {
        addWorkflowBtn.addEventListener('click', () => {
            loadedWorkflows.push({ id: 'w' + Date.now(), name: '', folder: '', prompt: '' });
            renderWorkflows();
        });
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
            showToast('モデル名を入力してください', 'warning');
            return;
        }

        // 新しいキーリストを作成
        const newApiKeys = { ...loadedApiKeys };
        newApiKeys[currentModel] = apiKey;

        // Collect workflows
        const newWorkflows = [];
        const items = document.querySelectorAll('.workflow-item');
        items.forEach((item, index) => {
            newWorkflows.push({
                id: loadedWorkflows[index]?.id || 'w' + Date.now(),
                name: item.querySelector('.wf-name').value.trim(),
                folder: item.querySelector('.wf-folder').value.trim(),
                prompt: item.querySelector('.wf-prompt').value.trim()
            });
        });

        const newConfig = {
            api_keys: newApiKeys,
            current_model: currentModel,
            autosave_interval_ms: parseInt(document.getElementById('autosave-interval').value),
            system_prompt_suffix: document.getElementById('system-prompt-suffix').value.trim(),
            workflows: newWorkflows
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            if (response.ok) {
                showToast('設定を保存しました', 'success');
                settingsModal.classList.add('hidden');
                loadWorkflowFiles(); // フォルダツリーを再読み込み
            } else {
                showToast('保存に失敗しました', 'error');
            }
        } catch (error) {
            console.error('保存エラー:', error);
            showToast('通信エラーが発生しました', 'error');
        }
    });

    // === 5. エディタ機能（ファイルのロード・作成・オートセーブ） ===
    const inboxList = document.getElementById('inbox-list');
    const editorTextarea = document.getElementById('editor');
    const fileBadge = document.querySelector('.file-badge');
    const newMdBtn = document.getElementById('new-md-btn');
    const newTxtBtn = document.getElementById('new-txt-btn');
    const saveStatus = document.getElementById('save-status');
    
    let currentFilename = null;
    let isDirty = false;
    let isSaving = false;
    let autosaveInterval = 3000;
    
    function setSaveStatus(status, isError = false) {
        if (!saveStatus) return;
        saveStatus.textContent = status;
        saveStatus.className = 'save-status';
        if (status === '📝 変更あり') saveStatus.classList.add('dirty');
        if (isError) saveStatus.classList.add('error');
    }

    // inboxファイル一覧を取得
    async function loadInboxFiles(selectFilename = null) {
        try {
            const res = await fetch('/api/inbox');
            const data = await res.json();
            
            inboxList.innerHTML = '';
            
            data.files.forEach(filename => {
                const li = document.createElement('li');
                li.className = 'file-item-wrapper';
                
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'file-item';
                a.textContent = filename;
                
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    openFile(filename);
                });
                
                // --- ファイルアクション (名前変更・削除) ---
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'dropdown file-actions';
                
                const dropBtn = document.createElement('button');
                dropBtn.className = 'icon-btn dropbtn';
                dropBtn.title = 'メニュー';
                dropBtn.innerHTML = '⋮';
                
                // メニューのトグル処理
                dropBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // 他の開いているメニューを閉じる
                    document.querySelectorAll('.file-actions.active').forEach(el => {
                        if (el !== actionsDiv) el.classList.remove('active');
                    });
                    document.querySelectorAll('.file-item-wrapper.menu-open').forEach(el => {
                        if (el !== li) el.classList.remove('menu-open');
                    });

                    // このメニューをトグル
                    actionsDiv.classList.toggle('active');
                    li.classList.toggle('menu-open');
                });

                const contentDiv = document.createElement('div');
                contentDiv.className = 'dropdown-content';
                
                const renameA = document.createElement('a');
                renameA.href = '#';
                renameA.textContent = '✏️ 名前を変更';
                renameA.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    renameInboxFile(filename);
                });
                
                const deleteA = document.createElement('a');
                deleteA.href = '#';
                deleteA.textContent = '🗑️ 削除';
                deleteA.style.color = '#ef4444';
                deleteA.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteInboxFile(filename);
                });
                
                const copyPathA = document.createElement('a');
                copyPathA.href = '#';
                copyPathA.textContent = '📋 パスをコピー';
                copyPathA.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const fullPath = `${systemPaths.inbox_dir}${systemPaths.base_dir.includes('/') ? '/' : '\\'}${filename}`;
                    navigator.clipboard.writeText(fullPath);
                    showToast('パスをコピーしました', 'success');
                    // メニューを閉じる
                    actionsDiv.classList.remove('active');
                    li.classList.remove('menu-open');
                });
                
                contentDiv.appendChild(renameA);
                contentDiv.appendChild(copyPathA);
                contentDiv.appendChild(deleteA);
                actionsDiv.appendChild(dropBtn);
                actionsDiv.appendChild(contentDiv);
                
                li.appendChild(a);
                li.appendChild(actionsDiv);
                
                // 右クリックでメニューを開く
                li.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    dropBtn.click();
                });
                
                inboxList.appendChild(li);
            });
            
            // ファイルを選択
            if (selectFilename && data.files.includes(selectFilename)) {
                openFile(selectFilename);
            } else if (data.files.length > 0 && !currentFilename) {
                openFile(data.files[0]);
            } else if (currentFilename && data.files.includes(currentFilename)) {
                updateActiveFileHighlight();
            }
        } catch (e) {
            console.error('ファイル一覧取得エラー:', e);
        }
    }
    
    // 指定したファイルを開く
    async function openFile(filename) {
        // もし変更があれば保存
        if (isDirty) {
            await saveCurrentFile();
        }
        
        try {
            const res = await fetch(`/api/inbox/${filename}`);
            if (!res.ok) throw new Error('File not found');
            const data = await res.json();
            
            currentFilename = filename;
            editorTextarea.value = data.content;
            isDirty = false;
            fileBadge.textContent = filename;
            setSaveStatus('✅ 保存済み');
            
            updateActiveFileHighlight();
            updatePreview();
            
            // ワークフロー閲覧用のUI（プレビューバッジ・戻るボタン）を隠す
            const previewBadge = document.getElementById('preview-badge');
            const backToInboxBtn = document.getElementById('back-to-inbox-btn');
            if (previewBadge) previewBadge.classList.add('hidden');
            if (backToInboxBtn) backToInboxBtn.classList.add('hidden');
            
            // ワークフロー側のハイライトを解除する
            const dynamicFoldersContainer = document.getElementById('dynamic-folders');
            if (dynamicFoldersContainer) {
                dynamicFoldersContainer.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
            }
        } catch (e) {
            console.error('ファイル読み込みエラー:', e);
        }
    }
    
    // 現在のファイルを保存する
    async function saveCurrentFile() {
        if (!currentFilename || !isDirty || isSaving) return;
        
        isSaving = true;
        setSaveStatus('⏳ 保存中...');
        const content = editorTextarea.value;
        try {
            const res = await fetch(`/api/inbox/${currentFilename}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                isDirty = false;
                setSaveStatus('✅ 保存済み');
            } else {
                setSaveStatus('❌ 保存失敗', true);
            }
        } catch (e) {
            console.error('保存エラー:', e);
            setSaveStatus('❌ エラー (再試行予定)', true);
        } finally {
            isSaving = false;
        }
    }
    
    // 新規ファイル作成
    async function createNewFile(extension) {
        const filename = await showCustomPrompt('新規作成', 'ファイル名を入力してください:', extension, 0, 0);
        if (filename === null) return;
        
        let targetName = filename.trim();
        if (!targetName || targetName === extension) {
            showToast('ファイル名を入力してください', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/inbox/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: targetName, extension: extension })
            });
            const data = await res.json();
            if (res.ok) {
                await loadInboxFiles(data.filename);
            } else {
                showToast('作成に失敗: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            console.error('新規作成エラー:', e);
        }
    }
    
    // ファイル名の変更
    async function renameInboxFile(filename) {
        const newName = await showCustomPrompt('名前の変更', `「${filename}」の新しい名前を入力してください:`, filename);
        if (newName === null || newName === filename) return;
        if (!newName.trim()) {
            showToast('ファイル名が空です', 'warning');
            return;
        }
        
        let newExt = newName;
        if (!newExt.endsWith('.md') && !newExt.endsWith('.txt')) {
            newExt += filename.endsWith('.txt') ? '.txt' : '.md';
        }

        try {
            const res = await fetch(`/api/inbox/${filename}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_filename: newExt })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('ファイル名を変更しました', 'success');
                if (currentFilename === filename) {
                    currentFilename = data.new_filename;
                    fileBadge.textContent = currentFilename;
                }
                await loadInboxFiles(currentFilename);
            } else {
                showToast('名前変更に失敗: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('通信エラーが発生しました', 'error');
        }
    }

    // ファイルの削除
    async function deleteInboxFile(filename) {
        const isConfirmed = await showCustomConfirm('削除の確認', `「${filename}」を削除してもよろしいですか？\nこの操作は取り消せません。`);
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/inbox/${filename}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('ファイルを削除しました', 'success');
                if (currentFilename === filename) {
                    currentFilename = null;
                    editorTextarea.value = '';
                    fileBadge.textContent = 'No file';
                    updatePreview();
                }
                await loadInboxFiles(currentFilename);
            } else {
                const data = await res.json();
                showToast('削除に失敗: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('通信エラーが発生しました', 'error');
        }
    }
    
    function updateActiveFileHighlight() {
        const items = inboxList.querySelectorAll('.file-item');
        items.forEach(item => {
            if (item.textContent === currentFilename) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // イベントリスナー設定
    newMdBtn.addEventListener('click', (e) => { e.preventDefault(); createNewFile('.md'); });
    newTxtBtn.addEventListener('click', (e) => { e.preventDefault(); createNewFile('.txt'); });
    
    // 新規フォルダ（整理ルール）追加ボタン
    const newFolderBtn = document.getElementById('new-folder-btn');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadConfig().then(() => {
                settingsModal.classList.remove('hidden');
                if (addWorkflowBtn) addWorkflowBtn.click();
                const workflowsSection = document.querySelector('.workflows-section');
                if (workflowsSection) workflowsSection.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }
    
    // === キーボードショートカット ===
    document.addEventListener('keydown', async (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (currentFilename && isDirty) {
                await saveCurrentFile();
                showToast('手動保存しました', 'success');
            }
        }
    });
    
    // === 6. Markdownプレビュー ===
    const previewArea = document.querySelector('.preview-area');
    
    function updatePreview() {
        if (!previewArea || typeof marked === 'undefined') return;
        const text = editorTextarea.value;
        // marked.parse で Markdown を HTML に変換
        previewArea.innerHTML = marked.parse(text);
    }

    editorTextarea.addEventListener('input', () => {
        isDirty = true;
        setSaveStatus('📝 変更あり');
        updatePreview();
    });
    
    // === 7. ファイルツリー (動的フォルダ) と閲覧 ===
    const dynamicFoldersContainer = document.getElementById('dynamic-folders');
    const previewBadge = document.getElementById('preview-badge');
    const backToInboxBtn = document.getElementById('back-to-inbox-btn');
    
    // ワークフローフォルダ一覧を取得
    async function loadWorkflowFiles(forceExpandFolder = null) {
        if (!dynamicFoldersContainer) return;
        
        // --- 展開状態の保存 ---
        const expandedFolders = new Set();
        if (forceExpandFolder) expandedFolders.add(forceExpandFolder);
        
        dynamicFoldersContainer.querySelectorAll('.tree-header:not(.collapsed)').forEach(header => {
            const targetId = header.dataset.target;
            if (targetId && targetId.startsWith('folder-list-')) {
                expandedFolders.add(targetId.replace('folder-list-', ''));
            }
        });

        try {
            const res = await fetch('/api/files');
            const data = await res.json();
            
            dynamicFoldersContainer.innerHTML = '';
            
            if (data.workflows && data.workflows.length > 0) {
                data.workflows.forEach(wf => {
                    const folder = wf.folder;
                    if (!folder) return;
                    const files = data.folders[folder] || [];
                    
                    const isExpanded = expandedFolders.has(folder);
                    
                    const section = document.createElement('div');
                    section.className = 'tree-section';
                    
                    const listId = `folder-list-${folder}`;
                    
                    const wrapper = document.createElement('div');
                    wrapper.className = 'tree-header-wrapper file-item-wrapper';
                    
                    const header = document.createElement('div');
                    header.className = isExpanded ? 'tree-header' : 'tree-header collapsed';
                    header.dataset.target = listId;
                    header.style.flex = '1';
                    header.innerHTML = `<span class="tree-icon">${isExpanded ? '▼' : '▶'}</span> ${folder}/`;
                    
                    const fActions = document.createElement('div');
                    fActions.className = 'dropdown file-actions';
                    
                    const fDropBtn = document.createElement('button');
                    fDropBtn.className = 'icon-btn dropbtn';
                    fDropBtn.title = 'メニュー';
                    fDropBtn.innerHTML = '⋮';
                    
                    fDropBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.querySelectorAll('.file-actions.active').forEach(el => {
                            if (el !== fActions) el.classList.remove('active');
                        });
                        document.querySelectorAll('.file-item-wrapper.menu-open, .tree-header-wrapper.menu-open').forEach(el => {
                            if (el !== wrapper) el.classList.remove('menu-open');
                        });
                        fActions.classList.toggle('active');
                        wrapper.classList.toggle('menu-open');
                    });
                    
                    const fContent = document.createElement('div');
                    fContent.className = 'dropdown-content';
                    
                    const fRename = document.createElement('a');
                    fRename.href = '#';
                    fRename.textContent = '✏️ 名前を変更';
                    fRename.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fDropBtn.click();
                        await renameWorkflowFolder(folder);
                    });
                    
                    const fDelete = document.createElement('a');
                    fDelete.href = '#';
                    fDelete.textContent = '🗑️ 削除';
                    fDelete.style.color = '#ef4444';
                    fDelete.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fDropBtn.click();
                        await deleteWorkflowFolder(folder);
                    });
                    
                    const fCopyPath = document.createElement('a');
                    fCopyPath.href = '#';
                    fCopyPath.textContent = '📋 パスをコピー';
                    fCopyPath.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const fullPath = `${systemPaths.data_dir}${systemPaths.base_dir.includes('/') ? '/' : '\\'}${folder}`;
                        navigator.clipboard.writeText(fullPath);
                        showToast('フォルダパスをコピーしました', 'success');
                        fDropBtn.click();
                    });
                    
                    fContent.appendChild(fRename);
                    fContent.appendChild(fCopyPath);
                    fContent.appendChild(fDelete);
                    fActions.appendChild(fDropBtn);
                    fActions.appendChild(fContent);
                    
                    wrapper.appendChild(header);
                    wrapper.appendChild(fActions);
                    
                    // 右クリックメニュー
                    wrapper.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        fDropBtn.click();
                    });
                    
                    section.appendChild(wrapper);
                    
                    const ul = document.createElement('ul');
                    ul.className = isExpanded ? 'tree-list' : 'tree-list hidden';
                    ul.id = listId;
                    files.forEach(filename => {
                        const li = document.createElement('li');
                        li.className = 'file-item-wrapper';
                        
                        const a = document.createElement('a');
                        a.href = '#';
                        a.className = 'file-item';
                        a.textContent = filename;
                        
                        a.addEventListener('click', (e) => {
                            e.preventDefault();
                            openWorkflowFile(folder, filename);
                        });
                        
                        // --- ファイルアクション (名前変更・削除) ---
                        const actionsDiv = document.createElement('div');
                        actionsDiv.className = 'dropdown file-actions';
                        
                        const dropBtn = document.createElement('button');
                        dropBtn.className = 'icon-btn dropbtn';
                        dropBtn.title = 'メニュー';
                        dropBtn.innerHTML = '⋮';
                        
                        // メニューのトグル処理
                        dropBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            
                            // 他の開いているメニューを閉じる
                            document.querySelectorAll('.file-actions.active').forEach(el => {
                                if (el !== actionsDiv) el.classList.remove('active');
                            });
                            document.querySelectorAll('.file-item-wrapper.menu-open').forEach(el => {
                                if (el !== li) el.classList.remove('menu-open');
                            });

                            // このメニューをトグル
                            actionsDiv.classList.toggle('active');
                            li.classList.toggle('menu-open');
                        });

                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'dropdown-content';
                        
                        const renameA = document.createElement('a');
                        renameA.href = '#';
                        renameA.textContent = '✏️ 名前を変更';
                        renameA.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            renameWorkflowFile(folder, filename);
                        });
                        
                        const deleteA = document.createElement('a');
                        deleteA.href = '#';
                        deleteA.textContent = '🗑️ 削除';
                        deleteA.style.color = '#ef4444';
                        deleteA.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteWorkflowFile(folder, filename);
                        });
                        
                        const copyPathA = document.createElement('a');
                        copyPathA.href = '#';
                        copyPathA.textContent = '📋 パスをコピー';
                        copyPathA.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const fullPath = `${systemPaths.data_dir}${systemPaths.base_dir.includes('/') ? '/' : '\\'}${folder}${systemPaths.base_dir.includes('/') ? '/' : '\\'}${filename}`;
                            navigator.clipboard.writeText(fullPath);
                            showToast('パスをコピーしました', 'success');
                            dropBtn.click();
                        });
                        
                        contentDiv.appendChild(renameA);
                        contentDiv.appendChild(copyPathA);
                        contentDiv.appendChild(deleteA);
                        actionsDiv.appendChild(dropBtn);
                        actionsDiv.appendChild(contentDiv);
                        
                        li.appendChild(a);
                        li.appendChild(actionsDiv);
                        
                        // 右クリックでメニューを開く
                        li.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            dropBtn.click();
                        });
                        
                        ul.appendChild(li);
                    });
                    
                    section.appendChild(ul);
                    
                    dynamicFoldersContainer.appendChild(section);
                });
            }
        } catch (e) {
            console.error('ワークフロー一覧取得エラー:', e);
        }
    }
    
    // ワークフローフォルダのファイルを開く（プレビューのみ）
    async function openWorkflowFile(folder, filename) {
        try {
            const res = await fetch(`/api/files/${folder}/${filename}`);
            if (!res.ok) throw new Error('File not found');
            const data = await res.json();
            
            // プレビュー表示
            previewArea.innerHTML = marked.parse(data.content);
            
            // モード切り替え（プレビュー専用にする）
            document.getElementById('view-preview').click();
            
            // ヘッダーUI更新
            previewBadge.textContent = `${folder}/${filename}`;
            previewBadge.classList.remove('hidden');
            backToInboxBtn.classList.remove('hidden');
            
            // ハイライト更新
            dynamicFoldersContainer.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
            const ul = document.getElementById(`folder-list-${folder}`);
            if (ul) {
                ul.querySelectorAll('.file-item').forEach(item => {
                    if (item.textContent === filename) item.classList.add('active');
                });
            }
            
            // Inboxのハイライトを消す
            inboxList.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
            
        } catch (e) {
            console.error('ファイル読み込みエラー:', e);
        }
    }
    
    // Inboxに戻る処理
    backToInboxBtn.addEventListener('click', () => {
        // 分割モードに戻す
        document.getElementById('view-split').click();
        
        // UI戻す
        previewBadge.classList.add('hidden');
        backToInboxBtn.classList.add('hidden');
        
        // プレビューの内容をエディタの内容に戻す
        updatePreview();
        
        // ハイライト戻す
        updateActiveFileHighlight();
        if (dynamicFoldersContainer) {
            dynamicFoldersContainer.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
        }
    });

    // ワークフローファイル名の変更
    async function renameWorkflowFile(folder, filename) {
        const newName = await showCustomPrompt('名前の変更', `「${filename}」の新しい名前を入力してください:`, filename);
        if (newName === null || newName === filename) return;
        if (!newName.trim()) {
            showToast('ファイル名が空です', 'warning');
            return;
        }
        
        let newExt = newName;
        if (!newExt.endsWith('.md') && !newExt.endsWith('.txt')) {
            newExt += filename.endsWith('.txt') ? '.txt' : '.md';
        }

        try {
            const res = await fetch(`/api/files/${folder}/${filename}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_filename: newExt })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('ファイル名を変更しました', 'success');
                // もし現在開いているファイルならプレビューバッジを更新
                if (previewBadge && !previewBadge.classList.contains('hidden') && previewBadge.textContent === `${folder}/${filename}`) {
                    previewBadge.textContent = `${folder}/${data.new_filename}`;
                }
                await loadWorkflowFiles(folder);
            } else {
                showToast('名前変更に失敗: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('通信エラーが発生しました', 'error');
        }
    }

    // ワークフローファイルの削除
    async function deleteWorkflowFile(folder, filename) {
        const isConfirmed = await showCustomConfirm('削除の確認', `「${folder}/${filename}」を削除してもよろしいですか？\nこの操作は取り消せません。`);
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/files/${folder}/${filename}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('ファイルを削除しました', 'success');
                // もし現在開いているファイルならInboxに戻す
                if (previewBadge && !previewBadge.classList.contains('hidden') && previewBadge.textContent === `${folder}/${filename}`) {
                    backToInboxBtn.click();
                }
                await loadWorkflowFiles(folder);
            } else {
                const data = await res.json();
                showToast('削除に失敗: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('通信エラーが発生しました', 'error');
        }
    }
    
    // ワークフローフォルダ名の変更
    async function renameWorkflowFolder(oldFolder) {
        const newFolder = await showCustomPrompt('フォルダ名の変更', `「${oldFolder}」の新しい名前を入力してください:\n※英数字推奨`, oldFolder);
        if (newFolder === null || newFolder === oldFolder) return;
        if (!newFolder.trim()) {
            showToast('フォルダ名が空です', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            
            let updated = false;
            if (config.workflows) {
                for (const wf of config.workflows) {
                    if (wf.folder === oldFolder) {
                        wf.folder = newFolder.trim();
                        updated = true;
                    }
                }
            }
            
            if (updated) {
                const saveRes = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                
                if (saveRes.ok) {
                    showToast('フォルダ名を変更しました', 'success');
                    await loadWorkflowFiles(newFolder.trim());
                } else {
                    showToast('変更に失敗しました', 'error');
                }
            }
        } catch (e) {
            console.error(e);
            showToast('通信エラーが発生しました', 'error');
        }
    }

    // ワークフローフォルダの削除
    async function deleteWorkflowFolder(folder) {
        const isConfirmed = await showCustomConfirm('フォルダの削除', `「${folder}」を削除してもよろしいですか？\nこの操作は元に戻せません。中のファイルもすべて削除されます。`);
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/folders/${folder}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                const configRes = await fetch('/api/config');
                const config = await configRes.json();
                
                if (config.workflows) {
                    config.workflows = config.workflows.filter(wf => wf.folder !== folder);
                    await fetch('/api/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(config)
                    });
                }

                showToast('フォルダを削除しました', 'success');
                if (previewBadge && !previewBadge.classList.contains('hidden') && previewBadge.textContent.startsWith(`${folder}/`)) {
                    backToInboxBtn.click();
                }
                await loadWorkflowFiles();
            } else {
                const data = await res.json();
                showToast('削除に失敗: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('通信エラーが発生しました', 'error');
        }
    }
    
    // === 8. 整頓機能 ===
    const organizeBtn = document.getElementById('organize-btn');
    const organizeModal = document.getElementById('organize-modal');
    const closeOrganizeModalBtn = document.getElementById('close-organize-modal');
    const executeOrganizeBtn = document.getElementById('execute-organize-btn');
    const additionalPromptInput = document.getElementById('additional-prompt');

    if (organizeBtn && organizeModal) {
        console.log('Organize button initialized');
        // モーダルを開く
        organizeBtn.addEventListener('click', () => {
            console.log('Organize button clicked');
            const targetFilesContainer = document.getElementById('organize-target-files');
            if (!targetFilesContainer) {
                console.error('organize-target-files not found');
                return;
            }
            targetFilesContainer.innerHTML = '';
            
            const inboxItems = Array.from(document.getElementById('inbox-list').querySelectorAll('.file-item'));
            
            if (inboxItems.length === 0) {
                showToast('Inboxにファイルがありません', 'warning');
                return;
            }
            
            inboxItems.forEach(item => {
                const filename = item.textContent;
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '8px';
                label.style.cursor = 'pointer';
                label.style.padding = '4px 8px';
                label.style.borderRadius = '4px';
                label.style.transition = 'background 0.2s';
                
                label.addEventListener('mouseenter', () => label.style.background = 'rgba(255,255,255,0.05)');
                label.addEventListener('mouseleave', () => label.style.background = 'transparent');
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = filename;
                checkbox.className = 'organize-checkbox';
                
                if (filename === currentFilename) {
                    checkbox.checked = true;
                }
                
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(filename));
                targetFilesContainer.appendChild(label);
            });
            
            const targetWorkflowsContainer = document.getElementById('organize-target-workflows');
            if (targetWorkflowsContainer) {
                targetWorkflowsContainer.innerHTML = '';
                
                loadedWorkflows.forEach((wf, idx) => {
                    const label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.gap = '8px';
                    label.style.cursor = 'pointer';
                    label.style.padding = '4px 8px';
                    label.style.borderRadius = '4px';
                    label.style.transition = 'background 0.2s';
                    
                    label.addEventListener('mouseenter', () => label.style.background = 'rgba(255,255,255,0.05)');
                    label.addEventListener('mouseleave', () => label.style.background = 'transparent');
                    
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'organize-workflow-radio';
                    radio.value = wf.id || wf.folder;
                    radio.className = 'organize-workflow-radio';
                    radio.style.accentColor = 'var(--accent)';
                    if (idx === 0) radio.checked = true; // 最初のルールをデフォルト選択
                    
                    const nameSpan = document.createElement('span');
                    const folderName = wf.folder ? `📂 ${wf.folder}` : '無名のルール';
                    const ruleName = wf.name ? ` - ${wf.name}` : '';
                    nameSpan.textContent = folderName + ruleName;
                    
                    label.appendChild(radio);
                    label.appendChild(nameSpan);
                    targetWorkflowsContainer.appendChild(label);
                });
                
                if (loadedWorkflows.length === 0) {
                    targetWorkflowsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 4px;">整理ルールが設定されていません。設定画面から追加してください。</p>';
                }
            }
            
            organizeModal.classList.remove('hidden');
            additionalPromptInput.focus();
        });

        // モーダルを閉じる
        closeOrganizeModalBtn.addEventListener('click', () => {
            organizeModal.classList.add('hidden');
        });

        window.addEventListener('click', (event) => {
            if (event.target === organizeModal) {
                organizeModal.classList.add('hidden');
            }
        });

        // 実行する
        executeOrganizeBtn.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.organize-checkbox:checked');
            const selectedFiles = Array.from(checkboxes).map(cb => cb.value);
            
            if (selectedFiles.length === 0) {
                showToast('対象ファイルを選択してください', 'warning');
                return;
            }
            
            const wfRadio = document.querySelector('.organize-workflow-radio:checked');
            const selectedWorkflowId = wfRadio ? wfRadio.value : null;
            
            if (!selectedWorkflowId) {
                showToast('整理先のフォルダを選択してください', 'warning');
                return;
            }
            
            const noArchive = document.getElementById('no-archive-toggle')?.checked ?? false;
            
            // 現在のファイルが含まれていて変更があれば先に保存する
            if (selectedFiles.includes(currentFilename) && isDirty) {
                await saveCurrentFile();
            }

            const additionalPrompt = additionalPromptInput.value.trim();
            
            organizeModal.classList.add('hidden');
            
            // UIをローディング状態に
            const originalText = organizeBtn.innerHTML;
            organizeBtn.innerHTML = '<span class="spinner"></span>処理中...';
            organizeBtn.disabled = true;
            
            try {
                const res = await fetch('/api/organize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        filenames: selectedFiles, 
                        workflow_ids: [selectedWorkflowId],
                        no_archive: noArchive,
                        additional_prompt: additionalPrompt 
                    })
                });
                
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    console.log('Gemini API 分類＆保存完了:', data.results);
                    const msg = data.archived
                        ? '整頓完了！元のメモはアーカイブされました。'
                        : '整頓完了！inboxのファイルはそのまま残っています。';
                    showToast(msg, 'success');
                    
                    // アーカイブした場合のみエディタをクリア
                    if (data.archived) {
                        editorTextarea.value = '';
                        isDirty = false;
                        currentFilename = null;
                        fileBadge.textContent = 'No file';
                        setSaveStatus('');
                        updatePreview();
                    }
                    additionalPromptInput.value = '';
                    
                    // ツリー再描画
                    await loadWorkflowFiles();
                    await loadInboxFiles();
                } else {
                    showToast('エラー: ' + (data.message || '不明なエラー'), 'error');
                }
            } catch (e) {
                console.error('通信エラー:', e);
                showToast('通信エラーが発生しました。サーバーが起動しているか確認してください。', 'error');
            } finally {
                organizeBtn.innerHTML = originalText;
                organizeBtn.disabled = false;
            }
        });
    }

    // 初期設定とオートセーブの開始
    async function initEditor() {
        // 設定を取得（ワークフロー情報含む）
        await loadConfig();
        
        loadInboxFiles();
        loadWorkflowFiles();
        
        setInterval(() => {
            saveCurrentFile();
        }, autosaveInterval);
    }
    
    initEditor();
});
