// API Configuration
const API_BASE = 'http://localhost:8000';

// State
let selectedFiles = [];
let chatMode = 'rag'; // 'rag' or 'chat'

// Dark Mode Toggle
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    
    if (document.body.classList.contains('dark-mode')) {
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('theme', 'light');
    }
});

// Utility Functions
function showStatus(elementId, message, type = 'info') {
    const statusEl = document.getElementById(elementId);
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
}

// Temporary toast for success messages (auto-dismiss)
function showTemporaryToast(message, type = 'success', timeout = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow then animate (if CSS provides transition)
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 400);
    }, timeout);
}

// Processing toast (persistent until dismissed)
let processingToastEl = null;
function showProcessingToast(message) {
    // remove existing processing toast if present
    if (processingToastEl) {
        processingToastEl.remove();
        processingToastEl = null;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-info toast-processing`;
    toast.innerHTML = `<span class="loading toast-loading" style="margin-right:10px"></span>${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    processingToastEl = toast;
    return toast;
}

function dismissProcessingToast() {
    if (!processingToastEl) return;
    processingToastEl.classList.remove('toast-show');
    setTimeout(() => {
        if (processingToastEl) processingToastEl.remove();
        processingToastEl = null;
    }, 300);
}

function showLoading(elementId) {
    const statusEl = document.getElementById(elementId);
    statusEl.innerHTML = '<span class="loading"></span> Processing...';
    statusEl.className = 'status-message status-info';
}

function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
}

// Initialize Index
document.getElementById('initIndexBtn').addEventListener('click', async () => {
    const btn = document.getElementById('initIndexBtn');
    btn.disabled = true;
    btn.textContent = 'Initializing...';
    showProcessingToast('Initializing vector index...');

    try {
        const response = await fetch(`${API_BASE}/index/init`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showTemporaryToast('Vector index initialized successfully', 'success');
            btn.textContent = 'Re-initialize Index';
            fetchIndicesAndFiles();
        } else {
            throw new Error(data.message || 'Initialization failed');
        }
    } catch (error) {
        dismissProcessingToast();
        showStatus('initStatus', `Error: ${error.message}`, 'error');
        btn.textContent = 'Initialize Vector Index';
    } finally {
        dismissProcessingToast();
        btn.disabled = false;
    }
});

// File Upload Handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const uploadBtn = document.getElementById('uploadBtn');

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    selectedFiles = Array.from(files);
    renderFileList();
    uploadBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
}

function renderFileList() {
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span class="file-name">${file.name}</span>
            <button class="file-remove" onclick="removeFile(${index})">×</button>
        </div>
    `).join('');
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    uploadBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
}

uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    showProcessingToast('Uploading files...');

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    try {
        const response = await fetch(`${API_BASE}/upload/`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showTemporaryToast(`Successfully uploaded ${data.file_ids.length} file(s)`, 'success');
            selectedFiles = [];
            renderFileList();
            uploadBtn.style.display = 'none';
            fetchIndicesAndFiles();
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        dismissProcessingToast();
        showStatus('uploadStatus', `Error: ${error.message}`, 'error');
    } finally {
        dismissProcessingToast();
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Files';
    }
});

// Chat Functionality
const queryInput = document.getElementById('queryInput');
const sendQueryBtn = document.getElementById('sendQueryBtn');
const chatMessages = document.getElementById('chatMessages');
const ragModeBtn = document.getElementById('ragModeBtn');
const chatModeBtn = document.getElementById('chatModeBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

// Mode Toggle
ragModeBtn.addEventListener('click', () => {
    chatMode = 'rag';
    ragModeBtn.classList.add('mode-btn-active');
    chatModeBtn.classList.remove('mode-btn-active');
    queryInput.placeholder = 'Ask a question about your documents...';
    updateEmptyState();
});

chatModeBtn.addEventListener('click', () => {
    chatMode = 'chat';
    chatModeBtn.classList.add('mode-btn-active');
    ragModeBtn.classList.remove('mode-btn-active');
    queryInput.placeholder = 'Chat with your AI...';
    updateEmptyState();
});

// Clear Chat History
clearChatBtn.addEventListener('click', async () => {
    if (!confirm('Clear chat history? This will reset the conversation memory.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/chat/reset`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            chatMessages.innerHTML = '';
            updateEmptyState();
        }
    } catch (error) {
        alert(`Error clearing chat: ${error.message}`);
    }
});

function updateEmptyState() {
    if (chatMessages.children.length === 0 || chatMessages.querySelector('.chat-empty')) {
        const modeText = chatMode === 'rag' 
            ? 'RAG Mode: Context from your documents' 
            : 'Chat Mode: Conversational AI with memory';
        
        chatMessages.innerHTML = `
            <div class="chat-empty">
                <div class="chat-empty-icon"><i class="fas fa-robot"></i></div>
                <p>Start a conversation with your AI</p>
                <span class="mode-hint">${modeText}</span>
            </div>
        `;
    }
}

// Auto-resize textarea
queryInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Send on Enter (Shift+Enter for new line)
queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuery();
    }
});

sendQueryBtn.addEventListener('click', sendQuery);

async function sendQuery() {
    const question = queryInput.value.trim();
    if (!question) return;

    // Clear empty state on first message
    if (chatMessages.querySelector('.chat-empty')) {
        chatMessages.innerHTML = '';
    }

    // Add user message
    addMessage(question, 'user');
    
    // Clear input and reset height
    queryInput.value = '';
    queryInput.style.height = 'auto';

    // Add loading message for AI
    const loadingId = addLoadingMessage();
    sendQueryBtn.disabled = true;

    try {
        let response;
        
        if (chatMode === 'rag') {
            // RAG Mode: Query with document context
            response = await fetch(`${API_BASE}/query/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question })
            });
        } else {
            // Chat Mode: Conversational with memory
            response = await fetch(`${API_BASE}/chat/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: question })
            });
        }

        const data = await response.json();

        // Remove loading message
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // Add AI response
        const answer = chatMode === 'rag' ? data.answer : data.response;
        
        if (answer) {
            addMessage(answer, 'ai');
        } else {
            throw new Error('No answer received');
        }
    } catch (error) {
        // Remove loading message
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        addMessage(`Error: ${error.message}`, 'ai');
    } finally {
        sendQueryBtn.disabled = false;
    }
}

function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender}`;
    
    const label = sender === 'user' ? 'You' : 'AI';
    
    // Convert markdown formatting to HTML
    let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`([^`]+)`/g, '<code>$1</code>') // Inline code
        .replace(/\n/g, '<br>'); // Line breaks
    
    messageDiv.innerHTML = `
        <div class="message-label">${label}</div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLoadingMessage() {
    const loadingId = `loading-${Date.now()}`;
    const messageDiv = document.createElement('div');
    messageDiv.id = loadingId;
    messageDiv.className = 'message message-ai';
    
    messageDiv.innerHTML = `
        <div class="message-label">AI</div>
        <div class="message-content"><span class="loading"></span> Thinking...</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return loadingId;
}

// Reset Index
document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the index? All documents will be removed.')) {
        return;
    }

    showProcessingToast('Resetting index...');
    try {
        const response = await fetch(`${API_BASE}/index/reset`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            dismissProcessingToast();
            showTemporaryToast('Index reset successfully', 'success');
            chatMessages.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">💭</div>
                    <p>Start a conversation with your AI</p>
                </div>
            `;
            fetchIndicesAndFiles();
        }
    } catch (error) {
        dismissProcessingToast();
        alert(`Error: ${error.message}`);
    }
});

// Lists: indices & uploaded files

document.getElementById('refreshListsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshListsBtn');
    btn.classList.add('refreshing');
    await fetchIndicesAndFiles();
    btn.classList.remove('refreshing');
});

async function fetchIndicesAndFiles() {
    // Indices
    try {
        const res = await fetch(`${API_BASE}/index/list`);
        if (res.ok) {
            const data = await res.json();
            renderIndicesList(data.indexes || [], data);
        } else {
            renderIndicesList([]);
        }
    } catch (e) {
        renderIndicesList([]);
    }

    // Uploaded files
    try {
        const res2 = await fetch(`${API_BASE}/uploads/list`);
        if (res2.ok) {
            const data2 = await res2.json();
            renderUploadedFilesList(data2.files || []);
        } else {
            renderUploadedFilesList([]);
        }
    } catch (e) {
        renderUploadedFilesList([]);
    }
}

async function fetchIndicesAndFiles() {
    // Indices
    try {
        const res = await fetch(`${API_BASE}/index/list`);
        if (res.ok) {
            const data = await res.json();
            renderIndicesList(data);
        } else {
            renderIndicesList({});
        }
    } catch (e) {
        renderIndicesList({});
    }

    // Uploaded files
    try {
        const res2 = await fetch(`${API_BASE}/uploads/list`);
        if (res2.ok) {
            const data2 = await res2.json();
            renderUploadedFilesList(data2.files || []);
        } else {
            renderUploadedFilesList([]);
        }
    } catch (e) {
        renderUploadedFilesList([]);
    }
}

function formatJsonValue(value, depth = 0) {
    if (value === null || value === undefined) {
        return '<span class="json-null">null</span>';
    }

    if (typeof value === 'boolean') {
        return `<span class="json-boolean">${value}</span>`;
    }

    if (typeof value === 'number') {
        return `<span class="json-number">${value}</span>`;
    }

    if (typeof value === 'string') {
        return `<span class="json-string">"${value}"</span>`;
    }

    if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
            if (value.length === 0) return '<span class="json-bracket">[]</span>';
            return `<span class="json-bracket">[</span> ${value.map(v => formatJsonValue(v, depth + 1)).join(', ')} <span class="json-bracket">]</span>`;
        } else {
            return formatJsonObject(value, depth + 1);
        }
    }

    return String(value);
}

function formatJsonObject(obj, depth = 0) {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '<span class="json-bracket">{}</span>';

    const lines = keys.map(key => {
        const value = obj[key];
        const valueHtml = formatJsonValue(value, depth + 1);
        return `<div class="json-line" style="padding-left: ${depth * 20}px">
            <span class="json-key">"${key}"</span><span class="json-colon">:</span> ${valueHtml}
        </div>`;
    }).join('');

    return `<div class="json-object">${lines}</div>`;
}

function renderIndicesList(data) {
    const el = document.getElementById('indicesList');
    if (!el) return;

    if (!data || !data.indexes || data.indexes.length === 0) {
        el.innerHTML = '<p class="small-muted">No indexes found.</p>';
        return;
    }

    const indexes = data.indexes;
    const html = indexes.map(idx => `
        <div class="index-card">
            <div class="index-card-header">
                <h3 class="index-name">${idx.name || 'Unknown'}</h3>
                <span class="index-status ${idx.status?.ready ? 'ready' : 'not-ready'}">
                    ${idx.status?.ready ? '● Ready' : '● Not Ready'}
                </span>
            </div>
            <div class="index-card-content">
                <div class="index-row">
                    <span class="index-label">Dimension:</span>
                    <span class="index-value">${idx.dimension || 'N/A'}</span>
                </div>
                <div class="index-row">
                    <span class="index-label">Metric:</span>
                    <span class="index-value">${idx.metric || 'N/A'}</span>
                </div>
                <div class="index-row">
                    <span class="index-label">Vector Type:</span>
                    <span class="index-value">${idx.vector_type || 'N/A'}</span>
                </div>
                <div class="index-row">
                    <span class="index-label">Deletion Protection:</span>
                    <span class="index-value">${idx.deletion_protection || 'N/A'}</span>
                </div>
                <div class="index-row">
                    <span class="index-label">Host:</span>
                    <span class="index-value index-host">${idx.host || 'N/A'}</span>
                </div>
                ${idx.spec ? `
                <div class="index-row">
                    <span class="index-label">Cloud:</span>
                    <span class="index-value">${idx.spec.serverless?.cloud || 'N/A'}</span>
                </div>
                <div class="index-row">
                    <span class="index-label">Region:</span>
                    <span class="index-value">${idx.spec.serverless?.region || 'N/A'}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    el.innerHTML = html;
}

function renderUploadedFilesList(files) {
    const el = document.getElementById('uploadedFilesList');
    if (!el) return;
    if (!files || files.length === 0) {
        el.innerHTML = '<p class="small-muted">No uploaded files found.</p>';
        return;
    }

    // show last 10
    const recent = files.slice(-10).reverse();
    el.innerHTML = recent.map(f => {
        const fname = typeof f === 'string' ? f : (f.name || 'unknown');
        const size = f.size ? `${(f.size / 1024).toFixed(1)} KB` : '';
        return `
            <div class="list-item">
                <div class="list-item-header">
                    <span class="list-item-title">${fname}</span>
                </div>
                ${size ? `<div class="list-item-detail">${size}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Refresh lists on load
window.addEventListener('load', () => {
    fetchIndicesAndFiles();
});

// Expose removeFile to global scope for onclick handler
window.removeFile = removeFile;
window.scrollToSection = scrollToSection;