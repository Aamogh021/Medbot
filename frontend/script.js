// ============================================
//  MedBot AI – Chat Logic (GPT-style responses)
// ============================================

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const welcomeContainer = document.getElementById('welcomeContainer');

// -- Suggestion chips --
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        messageInput.value = query;
        sendMessage();
    });
});

// -- Send on Enter --
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// -- Send button click --
sendBtn.addEventListener('click', sendMessage);

// -- Clear chat --
clearBtn.addEventListener('click', () => {
    chatMessages.innerHTML = '';
    chatMessages.appendChild(createWelcome());
    messageInput.focus();
});

// ---- Core send function ----
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // Hide welcome screen
    const welcome = document.getElementById('welcomeContainer');
    if (welcome) welcome.remove();

    // Add user message
    appendMessage('user', text);
    messageInput.value = '';
    setLoading(true);

    // Show typing indicator
    const typingEl = showTypingIndicator();

    try {
        const res = await fetch('https://medbot-5qkw.onrender.com/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        typingEl.remove();
        appendMessage('bot', data.response);
    } catch (err) {
        typingEl.remove();
        appendMessage('bot', 'Sorry, something went wrong. Please check the server.');
    } finally {
        setLoading(false);
    }
}

// ============================================
//  Robust Markdown → HTML parser
//  Handles LLM output that may or may not
//  have proper newlines between list items.
// ============================================
function parseMarkdown(raw) {
    if (!raw) return '<p class="md-paragraph">No response.</p>';

    // Normalize: trim, unify line endings
    let text = raw.replace(/\r\n/g, '\n').trim();

    // ── Step 1: Ensure list markers start on their own line ──
    // Fix cases like "...sentence. - Next item" or "...sentence. 1. Step"
    text = text.replace(/([.!?:;])\s+(-\s)/g, '$1\n$2');
    text = text.replace(/([.!?:;])\s+(\d+\.\s)/g, '$1\n$2');

    // ── Step 2: Process line by line ──
    const lines = text.split('\n');
    const htmlBlocks = [];
    let currentList = null;  // { type: 'ul' | 'ol', items: [] }

    function flushList() {
        if (!currentList) return;
        const tag = currentList.type;
        const itemsHTML = currentList.items
            .map(item => `<li>${inlineFormat(item)}</li>`)
            .join('');
        htmlBlocks.push(`<${tag} class="md-list">${itemsHTML}</${tag}>`);
        currentList = null;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            flushList();
            continue;
        }

        // Headings
        if (/^###\s+(.+)/.test(line)) {
            flushList();
            htmlBlocks.push(`<h4 class="md-heading">${inlineFormat(line.replace(/^###\s+/, ''))}</h4>`);
            continue;
        }
        if (/^##\s+(.+)/.test(line)) {
            flushList();
            htmlBlocks.push(`<h3 class="md-heading">${inlineFormat(line.replace(/^##\s+/, ''))}</h3>`);
            continue;
        }
        if (/^#\s+(.+)/.test(line)) {
            flushList();
            htmlBlocks.push(`<h3 class="md-heading">${inlineFormat(line.replace(/^#\s+/, ''))}</h3>`);
            continue;
        }

        // Horizontal rule
        if (/^-{3,}$/.test(line)) {
            flushList();
            htmlBlocks.push('<hr class="md-hr">');
            continue;
        }

        // Unordered list item: - text  or  • text  or  * text (not **)
        const ulMatch = line.match(/^[-•]\s+(.+)/);
        const starUlMatch = !line.startsWith('**') && line.match(/^\*\s+(.+)/);
        if (ulMatch || starUlMatch) {
            const content = ulMatch ? ulMatch[1] : starUlMatch[1];
            if (!currentList || currentList.type !== 'ul') {
                flushList();
                currentList = { type: 'ul', items: [] };
            }
            currentList.items.push(content);
            continue;
        }

        // Ordered list item: 1. text
        const olMatch = line.match(/^\d+[.)]\s+(.+)/);
        if (olMatch) {
            if (!currentList || currentList.type !== 'ol') {
                flushList();
                currentList = { type: 'ol', items: [] };
            }
            currentList.items.push(olMatch[1]);
            continue;
        }

        // Regular paragraph line
        flushList();
        htmlBlocks.push(`<p class="md-paragraph">${inlineFormat(line)}</p>`);
    }

    flushList();

    return htmlBlocks.join('') || '<p class="md-paragraph">No response.</p>';
}

// Inline formatting: bold, italic, inline code
function inlineFormat(text) {
    // Escape HTML
    let s = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks (inline) `code`
    s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Bold **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic *text* (but not inside bold)
    s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    return s;
}

// ---- Helpers ----

function appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';

    if (role === 'user') {
        avatar.textContent = 'You';
    } else {
        avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'bot') {
        // Parse & render markdown for bot messages
        const formattedHTML = parseMarkdown(text);
        bubble.classList.add('bot-formatted');
        // Start hidden for fade-in animation
        bubble.style.opacity = '0';
        bubble.innerHTML = formattedHTML;
    } else {
        bubble.textContent = text;
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    content.appendChild(bubble);
    content.appendChild(time);
    msg.appendChild(avatar);
    msg.appendChild(content);
    chatMessages.appendChild(msg);

    // Smooth fade-in for bot messages
    if (role === 'bot') {
        requestAnimationFrame(() => {
            bubble.style.transition = 'opacity 0.5s ease';
            bubble.style.opacity = '1';
        });
    }

    scrollToBottom();
}

function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'typing-indicator';
    wrapper.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.style.background = 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(6,214,160,0.2))';
    avatar.style.border = '1px solid rgba(56,189,248,0.15)';
    avatar.style.color = 'var(--accent)';
    avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;

    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    wrapper.appendChild(avatar);
    wrapper.appendChild(dots);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function setLoading(loading) {
    sendBtn.disabled = loading;
    messageInput.disabled = loading;
    if (!loading) messageInput.focus();
}

function createWelcome() {
    const container = document.createElement('div');
    container.className = 'welcome-container';
    container.id = 'welcomeContainer';
    container.innerHTML = `
        <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
        </div>
        <h2>Hello! I'm MedBot AI</h2>
        <p>Your AI medical assistant. Ask me any health-related question and I'll do my best to help.</p>
        <div class="suggestion-chips">
            <button class="chip" data-query="What are common symptoms of the flu?">🤒 Flu symptoms</button>
            <button class="chip" data-query="How does aspirin work?">💊 How aspirin works</button>
            <button class="chip" data-query="What is a healthy blood pressure range?">❤️ Blood pressure</button>
        </div>
    `;
    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            messageInput.value = chip.getAttribute('data-query');
            sendMessage();
        });
    });
    return container;
}
