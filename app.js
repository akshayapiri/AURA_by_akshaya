const API_URL = 'https://api.euron.one/api/v1/euri/chat/completions';
const API_KEY = 'euri-6d1d67fd5eab8bf67e14af9b93aaca99624ba64c6ce7fdd9d615c4f1fb172800';
const MODEL = 'gpt-4.1-nano';
const MAX_HISTORY = 50;
const MAX_CHATS = 20; // Maximum number of saved chats

const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const newChatBtn = document.getElementById('new-chat-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const themeToggle = document.getElementById('theme-toggle');
const historySidebar = document.getElementById('history-sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const newChatSidebarBtn = document.getElementById('new-chat-sidebar');
const chatList = document.getElementById('chat-list');

// Current chat session
let currentChatId = null;
let chatMessages = [];

// ------- Theme Management -------
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('.theme-icon');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

// ------- Chat Sessions Management -------
function getAllChats() {
    try {
        const chats = JSON.parse(localStorage.getItem('all_chats') || '[]');
        return Array.isArray(chats) ? chats : [];
    } catch { return []; }
}

function saveAllChats(chats) {
    localStorage.setItem('all_chats', JSON.stringify(chats.slice(-MAX_CHATS)));
}

function saveCurrentChat() {
    if (!currentChatId || chatMessages.length <= 1) return; // Don't save empty chats or just welcome message
    
    const chats = getAllChats();
    const firstUserMessage = chatMessages.find(m => m.role === 'user');
    const title = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'New Chat';
    
    const chatIndex = chats.findIndex(c => c.id === currentChatId);
    const chatData = {
        id: currentChatId,
        title: title,
        messages: chatMessages,
        timestamp: new Date().toISOString()
    };
    
    if (chatIndex >= 0) {
        chats[chatIndex] = chatData;
    } else {
        chats.unshift(chatData); // Add to beginning
    }
    
    saveAllChats(chats);
    renderChatHistory();
}

function loadChat(chatId) {
    const chats = getAllChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        currentChatId = chatId;
        chatMessages = [...chat.messages];
        renderMessages(chatMessages);
        hidePromptSuggestions();
        closeSidebar();
    }
}

function startNewChat() {
    saveCurrentChat(); // Save current chat before starting new one
    currentChatId = 'chat_' + Date.now();
    chatMessages = [];
    addMessage(chatMessages, 'ai', "Hi! I'm AURA!! Nice to meet you <3 How can I help you today?");
    renderMessages(chatMessages);
    updatePromptSuggestions(); // Update prompts for new chat
    showPromptSuggestions();
}

function deleteChat(chatId) {
    if (confirm('Delete this chat?')) {
        const chats = getAllChats();
        const filtered = chats.filter(c => c.id !== chatId);
        saveAllChats(filtered);
        renderChatHistory();
        if (currentChatId === chatId) {
            startNewChat();
        }
    }
}

function renderChatHistory() {
    const chats = getAllChats();
    chatList.innerHTML = '';
    
    if (chats.length === 0) {
        chatList.innerHTML = '<p class="no-chats">No chat history</p>';
        return;
    }
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
        chatItem.innerHTML = `
            <div class="chat-item-content" data-chat-id="${chat.id}">
                <div class="chat-item-title">${escapeHTML(chat.title)}</div>
                <div class="chat-item-time">${formatChatTime(chat.timestamp)}</div>
            </div>
            <button class="chat-item-delete" data-chat-id="${chat.id}" title="Delete">×</button>
        `;
        
        chatItem.querySelector('.chat-item-content').addEventListener('click', () => {
            loadChat(chat.id);
        });
        
        chatItem.querySelector('.chat-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        chatList.appendChild(chatItem);
    });
}

function formatChatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// ------- Sidebar Management -------
function openSidebar() {
    historySidebar.classList.add('open');
    openSidebarBtn.style.display = 'none';
}

function closeSidebar() {
    historySidebar.classList.remove('open');
    openSidebarBtn.style.display = 'block';
}

openSidebarBtn.addEventListener('click', openSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
newChatSidebarBtn.addEventListener('click', startNewChat);
newChatBtn.addEventListener('click', startNewChat);

// ------- Chat State Management -------
function saveChatHistory(messages) {
    // This function is kept for backward compatibility but now we use saveCurrentChat
    if (currentChatId) {
        saveCurrentChat();
    }
}

function clearChatHistory() {
    if (confirm('Clear current chat? This will start a new conversation.')) {
        saveCurrentChat();
        startNewChat();
    }
}

clearChatBtn.addEventListener('click', clearChatHistory);

// ------- Message Rendering -------
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderMarkdown(text) {
    // Simple markdown renderer for bold and italic, with math support
    let html = escapeHTML(text);
    
    // First, protect math expressions before processing other markdown
    const mathBlocks = [];
    let mathIndex = 0;
    
    // Replace block math \[...\] with placeholders
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
        const placeholder = `__MATH_BLOCK_${mathIndex}__`;
        mathBlocks[mathIndex] = { type: 'block', content: content.trim() };
        mathIndex++;
        return placeholder;
    });
    
    // Replace inline math \(...\) with placeholders
    html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match, content) => {
        const placeholder = `__MATH_INLINE_${mathIndex}__`;
        mathBlocks[mathIndex] = { type: 'inline', content: content.trim() };
        mathIndex++;
        return placeholder;
    });
    
    // Convert **bold** to <strong>bold</strong> first
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Convert *italic* to <em>italic</em> (single asterisks not part of **)
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    // Convert _italic_ to <em>italic</em>
    html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
    
    // Restore math expressions as KaTeX renderable elements
    mathBlocks.forEach((math, idx) => {
        const placeholder = math.type === 'block' 
            ? `__MATH_BLOCK_${idx}__` 
            : `__MATH_INLINE_${idx}__`;
        const mathElement = math.type === 'block'
            ? `<span class="math-block">$$${math.content}$$</span>`
            : `<span class="math-inline">$$${math.content}$$</span>`;
        html = html.replace(placeholder, mathElement);
    });
    
    return html;
}

function formatTimestamp(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function renderMessages(messages) {
    chatContainer.innerHTML = '';
    messages.forEach((msg, index) => {
        const bubble = document.createElement('div');
        bubble.className = `bubble ${msg.role === 'user' ? 'user' : 'ai'}`;
        bubble.style.animationDelay = `${index * 0.1}s`;
        
        const msgText = document.createElement('span');
        msgText.className = 'msg-text';
        // Escape HTML for user messages, render markdown for AI messages
        let content = msg.role === 'user' ? escapeHTML(msg.content) : renderMarkdown(msg.content);
        
        // Render math expressions with KaTeX if available
        if (msg.role === 'ai' && window.katex) {
            // Replace math blocks with rendered KaTeX
            content = content.replace(/<span class="math-block">\$\$([\s\S]*?)\$\$<\/span>/g, (match, math) => {
                try {
                    return '<div class="math-block">' + window.katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }) + '</div>';
                } catch (e) {
                    return match; // Return original if rendering fails
                }
            });
            
            // Replace inline math with rendered KaTeX
            content = content.replace(/<span class="math-inline">\$\$([\s\S]*?)\$\$<\/span>/g, (match, math) => {
                try {
                    return '<span class="math-inline">' + window.katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }) + '</span>';
                } catch (e) {
                    return match; // Return original if rendering fails
                }
            });
        }
        
        msgText.innerHTML = content;
        bubble.appendChild(msgText);
        
        if (msg.timestamp) {
            const timestamp = document.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = msg.timestamp;
            bubble.appendChild(timestamp);
        }
        
        chatContainer.appendChild(bubble);
    });
    scrollToBottom();
}

function scrollToBottom() {
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

function addMessage(messages, role, content, opts = {}) {
    const now = new Date();
    const timestamp = formatTimestamp(now);
    messages.push({ role, content, timestamp, ...opts });
}

// ------- Typing Indicator -------
function showTypingBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble ai';
    bubble.id = 'typing-bubble';
    
    const typingContainer = document.createElement('div');
    typingContainer.className = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'typing-dot';
        typingContainer.appendChild(dot);
    }
    
    bubble.innerHTML = '<span class="msg-text">AURA is typing</span>';
    bubble.appendChild(typingContainer);
    
    chatContainer.appendChild(bubble);
    scrollToBottom();
}

function removeTypingBubble() {
    const typing = document.getElementById('typing-bubble');
    if (typing) {
        typing.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => typing.remove(), 300);
    }
}

// ------- Euron API Call -------
async function fetchAIReply(messages, userMsg) {
    const convMessages = messages.concat([{ role: 'user', content: userMsg }]);
    const apiMessages = convMessages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: m.content
    }));
    
    // Add system message to guide AI responses
    const systemMessage = {
        role: 'system',
        content: 'You are Akshaya, a helpful and friendly AI assistant. Be concise, natural, and avoid using made-up names, fictional concepts, or placeholder examples like "Luminara Veil" in your responses. Use **bold** and *italic* markdown formatting when appropriate.'
    };
    
    const payload = {
        messages: [systemMessage, ...apiMessages],
        model: MODEL,
        max_tokens: 1000,
        temperature: 0.7,
    };
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
    };
    
    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        
        console.log('API Response Status:', resp.status, resp.statusText);
        
        if (!resp.ok) {
            const errorText = await resp.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API error: ${resp.status} - ${errorText}`);
        }
        
        const data = await resp.json();
        console.log('API Response Data:', data);
        
        if (data && data.choices && data.choices[0]) {
            if (data.choices[0].message && data.choices[0].message.content) {
                return data.choices[0].message.content;
            }
            if (data.choices[0].content) {
                return data.choices[0].content;
            }
        }
        
        console.error('Unexpected response format:', data);
        throw new Error('Malformed API response: ' + JSON.stringify(data));
        
    } catch (err) {
        console.error('Fetch Error:', err);
        throw err;
    }
}

// ------- Prompt Suggestions -------
const promptSuggestions = document.getElementById('prompt-suggestions');
const promptGrid = document.querySelector('.prompt-grid');

// Multiple sets of prompt suggestions for variety
const promptSets = [
    [
        "How do I make a perfect cup of tea?",
        "What are some easy recipes for dinner?",
        "Can you explain quantum physics in simple terms?",
        "Tell me a fun fact about space.",
        "Give me tips for learning a new language.",
        "Write a short poem about nature."
    ],
    [
        "What's the best way to stay productive?",
        "Explain climate change in simple terms.",
        "What are some creative writing prompts?",
        "How can I improve my focus?",
        "Tell me about ancient civilizations.",
        "What's a good workout routine for beginners?"
    ],
    [
        "Help me plan a weekend trip.",
        "What are some mindfulness techniques?",
        "Explain how the internet works.",
        "Give me tips for better sleep.",
        "What's the history of coffee?",
        "How do I start a garden?"
    ],
    [
        "What are some good study techniques?",
        "Explain the water cycle.",
        "What are healthy breakfast ideas?",
        "Tell me about renewable energy.",
        "How can I be more creative?",
        "What's the meaning of life?"
    ],
    [
        "What are some productivity apps?",
        "Explain photosynthesis simply.",
        "How do I manage stress?",
        "What's interesting about the ocean?",
        "Give me cooking tips for beginners.",
        "What are some fun science experiments?"
    ]
];

let currentPromptSetIndex = 0;

function updatePromptSuggestions(resetIndex = false) {
    // Rotate through different prompt sets for each new chat
    if (!resetIndex) {
        currentPromptSetIndex = (currentPromptSetIndex + 1) % promptSets.length;
    }
    const prompts = promptSets[currentPromptSetIndex];
    
    promptGrid.innerHTML = '';
    prompts.forEach(prompt => {
        const btn = document.createElement('button');
        btn.className = 'prompt-btn';
        btn.setAttribute('data-prompt', prompt);
        btn.textContent = prompt;
        btn.addEventListener('click', () => {
            userInput.value = prompt;
            userInput.focus();
            hidePromptSuggestions();
            chatForm.dispatchEvent(new Event('submit'));
        });
        promptGrid.appendChild(btn);
    });
}

function hidePromptSuggestions() {
    promptSuggestions.classList.add('hidden');
}

function showPromptSuggestions() {
    if (chatMessages.length <= 1) {
        if (!promptGrid.hasChildNodes()) {
            updatePromptSuggestions();
        }
        promptSuggestions.classList.remove('hidden');
    }
}

// ------- Remove unwanted annotation buttons from browser extensions -------
function removeAnnotationButtons() {
    // Remove any annotation/annotate buttons near the chat form
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        // Remove buttons before the input field that aren't our send button
        const buttons = chatForm.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.id !== 'send-btn' && (btn.textContent.includes('Annotate') || btn.querySelector('[class*="pencil"], [class*="annotate"]'))) {
                btn.remove();
            }
        });
        
        // Remove any elements with annotation-related classes/ids
        const annotations = chatForm.querySelectorAll('[class*="annotate"], [id*="annotate"], [class*="pencil"]');
        annotations.forEach(el => {
            if (el.id !== 'send-btn' && !el.closest('#send-btn')) {
                el.remove();
            }
        });
    }
    
    // Also check for elements injected before/after the form
    const input = document.getElementById('user-input');
    if (input) {
        const siblings = Array.from(input.parentElement.children);
        siblings.forEach(sibling => {
            if (sibling !== input && sibling.id !== 'send-btn' && 
                (sibling.textContent.includes('Annotate') || 
                 sibling.querySelector('[class*="pencil"], [class*="annotate"]'))) {
                sibling.remove();
            }
        });
    }
}

// Run on page load and periodically to catch dynamically injected elements
removeAnnotationButtons();
setInterval(removeAnnotationButtons, 500);

// ------- UI Event Handling -------
// Initialize prompts on page load
updatePromptSuggestions(true);
// Start with a new chat on page load
startNewChat();
renderChatHistory();

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;
    
    // Initialize chat ID if this is the first message
    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now();
    }
    
    addMessage(chatMessages, 'user', message);
    renderMessages(chatMessages);
    userInput.value = '';
    userInput.focus();
    
    showTypingBubble();
    
    try {
        const recentMessages = chatMessages
            .filter(m => m.role === 'user' || m.role === 'ai')
            .slice(-10);
        const aiReply = await fetchAIReply(recentMessages, message);
        removeTypingBubble();
        addMessage(chatMessages, 'ai', aiReply);
        renderMessages(chatMessages);
        saveCurrentChat(); // Save after each message
        hidePromptSuggestions();
        renderChatHistory(); // Update sidebar
    } catch (err) {
        removeTypingBubble();
        console.error('Chat Error:', err);
        const errorMsg = err.message && err.message.includes('API error')
            ? `Sorry, there was a problem: ${err.message.split(' - ')[0]}. Please try again.`
            : 'Sorry, there was a problem contacting Akshaya AI. Please try again. Check the browser console (F12) for more details.';
        addMessage(chatMessages, 'ai', errorMsg);
        renderMessages(chatMessages);
        saveCurrentChat();
    }
});

// Save chat when page is about to unload
window.addEventListener('beforeunload', () => {
    saveCurrentChat();
});

// Keyboard Shortcuts
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Smooth Scroll on Load
window.addEventListener('load', () => {
    scrollToBottom();
});
