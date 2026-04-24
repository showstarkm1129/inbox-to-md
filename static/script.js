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
            document.getElementById('system-prompt-suffix').value = config.system_prompt_suffix || '';
            
            loadedWorkflows = config.workflows || [];
            renderWorkflows();
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
            alert('モデル名を入力してください');
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
                alert('設定を保存しました');
                settingsModal.classList.add('hidden');
                loadWorkflowFiles(); // フォルダツリーを再読み込み
            } else {
                alert('保存に失敗しました');
            }
        } catch (error) {
            console.error('保存エラー:', error);
            alert('通信エラーが発生しました');
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
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'file-item';
                a.textContent = filename;
                
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    openFile(filename);
                });
                
                li.appendChild(a);
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
        try {
            const res = await fetch('/api/inbox/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extension })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await loadInboxFiles(data.filename);
            }
        } catch (e) {
            console.error('新規作成エラー:', e);
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
    async function loadWorkflowFiles() {
        if (!dynamicFoldersContainer) return;
        try {
            const res = await fetch('/api/files');
            const data = await res.json();
            
            dynamicFoldersContainer.innerHTML = '';
            
            if (data.workflows && data.workflows.length > 0) {
                data.workflows.forEach(wf => {
                    const folder = wf.folder;
                    if (!folder) return;
                    const files = data.folders[folder] || [];
                    
                    const section = document.createElement('div');
                    section.className = 'tree-section';
                    
                    const listId = `folder-list-${folder}`;
                    section.innerHTML = `
                        <div class="tree-header collapsed" data-target="${listId}">
                            <span class="tree-icon">▶</span> ${folder}/
                        </div>
                        <ul class="tree-list hidden" id="${listId}"></ul>
                    `;
                    
                    const ul = section.querySelector('ul');
                    files.forEach(filename => {
                        const li = document.createElement('li');
                        const a = document.createElement('a');
                        a.href = '#';
                        a.className = 'file-item';
                        a.textContent = filename;
                        
                        a.addEventListener('click', (e) => {
                            e.preventDefault();
                            openWorkflowFile(folder, filename);
                        });
                        
                        li.appendChild(a);
                        ul.appendChild(li);
                    });
                    
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
    
    // === 8. 整頓機能 ===
    const organizeBtn = document.getElementById('organize-btn');
    const organizeModal = document.getElementById('organize-modal');
    const closeOrganizeModalBtn = document.getElementById('close-organize-modal');
    const executeOrganizeBtn = document.getElementById('execute-organize-btn');
    const additionalPromptInput = document.getElementById('additional-prompt');

    if (organizeBtn && organizeModal) {
        // モーダルを開く
        organizeBtn.addEventListener('click', () => {
            const targetFilesContainer = document.getElementById('organize-target-files');
            targetFilesContainer.innerHTML = '';
            
            const inboxItems = Array.from(document.getElementById('inbox-list').querySelectorAll('.file-item'));
            
            if (inboxItems.length === 0) {
                alert('Inboxにファイルがありません');
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
                alert('対象ファイルを選択してください');
                return;
            }
            
            // 現在のファイルが含まれていて変更があれば先に保存する
            if (selectedFiles.includes(currentFilename) && isDirty) {
                await saveCurrentFile();
            }

            const additionalPrompt = additionalPromptInput.value.trim();
            
            organizeModal.classList.add('hidden');
            
            // UIをローディング状態に
            const originalText = organizeBtn.innerHTML;
            organizeBtn.innerHTML = '⏳ 処理中...';
            organizeBtn.disabled = true;
            
            try {
                const res = await fetch('/api/organize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filenames: selectedFiles, additional_prompt: additionalPrompt })
                });
                
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    console.log('Gemini API 分類＆保存完了:', data.results);
                    alert('整頓が完了しました！\n対象のメモはアーカイブされ、指定のフォルダに振り分けられました。');
                    
                    // UIクリア
                    editorTextarea.value = '';
                    isDirty = false;
                    currentFilename = null;
                    fileBadge.textContent = 'No file';
                    setSaveStatus('');
                    updatePreview();
                    additionalPromptInput.value = '';
                    
                    // ツリー再描画
                    await loadWorkflowFiles();
                    await loadInboxFiles();
                } else {
                    alert('エラー: ' + (data.message || '不明なエラー'));
                }
            } catch (e) {
                console.error('通信エラー:', e);
                alert('通信エラーが発生しました。サーバーが起動しているか確認してください。');
            } finally {
                organizeBtn.innerHTML = originalText;
                organizeBtn.disabled = false;
            }
        });
    }

    // 初期設定とオートセーブの開始
    async function initEditor() {
        // 設定を取得してオートセーブ間隔を設定
        try {
            const res = await fetch('/api/config');
            const conf = await res.json();
            if (conf.autosave_interval_ms) {
                autosaveInterval = conf.autosave_interval_ms;
            }
        } catch (e) { }
        
        loadInboxFiles();
        loadWorkflowFiles();
        
        setInterval(() => {
            saveCurrentFile();
        }, autosaveInterval);
    }
    
    initEditor();
});
