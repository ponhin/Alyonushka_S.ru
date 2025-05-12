document.addEventListener('DOMContentLoaded', function() {
    // Конфигурация
    const CONFIG = {
        apiToken: 'dsq1RjN2MooZ21cGRwuHQhWhqpVkY8WagI4vuaUp87I',
        serverUrl: 'https://vitally-fascinated-yak.cloudpub.ru/',
        uploadMethod: 'PUT', // или 'POST' в зависимости от сервера
        maxFileSize: 10 * 1024 * 1024, // 10MB лимит
        allowedTypes: ['image/*', 'text/*', 'application/pdf']
    };


    const DOM = {
        refreshBtn: document.getElementById('refresh-btn'),
        retryBtn: document.getElementById('retry-btn'),
        homeBtn: document.getElementById('home-btn'),
        backBtn: document.getElementById('back-btn'),
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        serverContent: document.getElementById('server-content'),
        fileList: document.getElementById('file-list'),
        filePreview: document.getElementById('file-preview'),
        currentPath: document.getElementById('current-path'),
        fileName: document.getElementById('file-name'),
        fileContent: document.getElementById('file-content'),
        uploadForm: document.getElementById('upload-form'),
        fileInput: document.getElementById('file-input'),
        uploadStatus: document.getElementById('upload-status')
    };

    const STATE = {
        currentPath: '/',
        isLoading: false,
        uploadProgress: 0
    };


    init();

    function init() {
        setupEventListeners();
        loadDirectory(STATE.currentPath);
    }

    function setupEventListeners() {
        DOM.refreshBtn.addEventListener('click', () => loadDirectory(STATE.currentPath));
        DOM.retryBtn.addEventListener('click', () => loadDirectory(STATE.currentPath));
        DOM.homeBtn.addEventListener('click', () => navigateTo('/'));
        DOM.backBtn.addEventListener('click', showFileList);
        DOM.uploadForm.addEventListener('submit', handleFileUpload);
    }


    function navigateTo(path) {
        STATE.currentPath = path;
        loadDirectory(path);
    }

    async function loadDirectory(path) {
        if (STATE.isLoading) return;
        
        STATE.isLoading = true;
        showLoading();
        
        try {
            const response = await fetch(`${CONFIG.serverUrl}${path}`, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.apiToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            
            if (contentType.includes('text/html')) {
                const html = await response.text();
                const { folders, files } = parseDirectoryListing(html);
                renderDirectoryListing(folders, files, path);
            } else {
                const content = await response.text();
                renderFileContent(path.split('/').pop(), content);
            }
        } catch (error) {
            console.error('Directory load error:', error);
            showError(error.message);
        } finally {
            STATE.isLoading = false;
        }
    }

    function parseDirectoryListing(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a[href]:not([href^="?"])'));
        
        const folders = [];
        const files = [];
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            const name = text || href;
            
            if (href.endsWith('/')) {
                folders.push({ name });
            } else {
                files.push({ name, size: 'N/A' });
            }
        });
        
        return { folders, files };
    }

    function renderDirectoryListing(folders, files, path) {
        STATE.currentPath = path;
        DOM.currentPath.textContent = path;
        DOM.fileList.innerHTML = '';
        
        // Родительская директория (если не корень)
        if (path !== '/') {
            const parentPath = path.split('/').slice(0, -1).join('/') || '/';
            DOM.fileList.appendChild(createFileItem({
                name: '..',
                type: 'folder',
                size: '',
                onClick: () => navigateTo(parentPath)
            }));
        }
        
        // Папки
        folders.forEach(folder => {
            const newPath = path === '/' ? `/${folder.name}` : `${path}/${folder.name}`;
            DOM.fileList.appendChild(createFileItem({
                name: folder.name,
                type: 'folder',
                size: '',
                onClick: () => navigateTo(newPath + '/')
            }));
        });
        
        // Файлы
        files.forEach(file => {
            const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
            DOM.fileList.appendChild(createFileItem({
                name: file.name,
                type: 'file',
                size: file.size,
                onClick: () => navigateTo(filePath)
            }));
        });
        
        showServerContent();
    }

    function createFileItem({ name, type, size, onClick }) {
        const item = document.createElement('div');
        item.className = `file-item ${type}`;
        item.innerHTML = `
            <div class="file-icon">${type === 'folder' ? '📁' : '📄'}</div>
            <div class="file-name">${name}</div>
            <div class="file-size">${type === 'folder' ? 'Папка' : formatFileSize(size)}</div>
        `;
        item.addEventListener('click', onClick);
        return item;
    }

    function renderFileContent(fileName, content) {
        DOM.fileName.textContent = fileName;
        DOM.fileContent.textContent = content;
        DOM.filePreview.style.display = 'block';
        DOM.fileList.style.display = 'none';
        hideLoading();
    }

    // Загрузка файлов
    async function handleFileUpload(e) {
        e.preventDefault();
        
        if (!DOM.fileInput.files.length) {
            showUploadStatus('Выберите файлы для загрузки', 'error');
            return;
        }
        
        const files = Array.from(DOM.fileInput.files);
        
        // Валидация файлов
        for (const file of files) {
            if (file.size > CONFIG.maxFileSize) {
                showUploadStatus(`Файл ${file.name} слишком большой (макс. ${formatFileSize(CONFIG.maxFileSize)})`, 'error');
                return;
            }
            
            if (!isFileTypeAllowed(file.type)) {
                showUploadStatus(`Тип файла ${file.name} не поддерживается`, 'error');
                return;
            }
        }
        
        try {
            showUploadStatus(`Загрузка ${files.length} файлов...`, '');
            
            // Загружаем файлы последовательно
            for (const file of files) {
                await uploadSingleFile(file);
            }
            
            showUploadStatus(`Успешно загружено ${files.length} файлов`, 'success');
            setTimeout(() => loadDirectory(STATE.currentPath), 1500);
        } catch (error) {
            console.error('Upload error:', error);
            showUploadStatus(`Ошибка: ${error.message}`, 'error');
        } finally {
            DOM.fileInput.value = '';
        }
    }

    async function uploadSingleFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadPath = STATE.currentPath === '/' ? 
            file.name : 
            `${STATE.currentPath}/${file.name}`;
        
        const response = await fetch(`${CONFIG.serverUrl}${uploadPath}`, {
            method: CONFIG.uploadMethod,
            headers: {
                'Authorization': `Bearer ${CONFIG.apiToken}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Не удалось загрузить ${file.name}`);
        }
        
        return response;
    }

    function isFileTypeAllowed(fileType) {
        if (!fileType) return true; // Если тип неизвестен, разрешаем
        return CONFIG.allowedTypes.some(allowed => {
            if (allowed.endsWith('/*')) {
                return fileType.startsWith(allowed.split('/*')[0]);
            }
            return fileType === allowed;
        });
    }

    // Вспомогательные функции
    function formatFileSize(bytes) {
        if (!bytes || bytes === 'N/A') return 'N/A';
        const units = ['Bytes', 'KB', 'MB', 'GB'];
        const exp = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, exp)).toFixed(2)} ${units[exp]}`;
    }

    function showUploadStatus(message, type) {
        DOM.uploadStatus.textContent = message;
        DOM.uploadStatus.className = `upload-status ${type}`;
    }

    // Управление UI
    function showLoading() {
        DOM.loading.style.display = 'block';
        DOM.error.style.display = 'none';
        DOM.serverContent.style.display = 'none';
    }

    function hideLoading() {
        DOM.loading.style.display = 'none';
    }

    function showError(message) {
        DOM.error.querySelector('p').textContent = message || 'Ошибка при загрузке данных';
        DOM.error.style.display = 'block';
        DOM.loading.style.display = 'none';
        DOM.serverContent.style.display = 'none';
    }

    function showServerContent() {
        DOM.loading.style.display = 'none';
        DOM.error.style.display = 'none';
        DOM.serverContent.style.display = 'block';
        DOM.filePreview.style.display = 'none';
        DOM.fileList.style.display = 'grid';
    }

    function showFileList() {
        DOM.filePreview.style.display = 'none';
        DOM.fileList.style.display = 'grid';
    }
});