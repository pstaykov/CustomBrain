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
    showLoading('initStatus');

    try {
        const response = await fetch(`${API_BASE}/index/init`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus('initStatus', '✓ Vector index initialized successfully', 'success');
            btn.textContent = 'Re-initialize Index';
        } else {
            throw new Error(data.message || 'Initialization failed');
        }
    } catch (error) {
        showStatus('initStatus', `Error: ${error.message}`, 'error');
        btn.textContent = 'Initialize Vector Index';
    } finally {
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
    showLoading('uploadStatus');

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    try {
        const response = await fetch(`${API_BASE}/upload/`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showStatus('uploadStatus', `✓ Successfully uploaded ${data.file_ids.length} file(s)`, 'success');
            selectedFiles = [];
            renderFileList();
            uploadBtn.style.display = 'none';
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        showStatus('uploadStatus', `Error: ${error.message}`, 'error');
    } finally {
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

    try {
        const response = await fetch(`${API_BASE}/index/reset`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            alert('Index reset successfully');
            chatMessages.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">💭</div>
                    <p>Start a conversation with your AI</p>
                </div>
            `;
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// Expose removeFile to global scope for onclick handler
window.removeFile = removeFile;
window.scrollToSection = scrollToSection;