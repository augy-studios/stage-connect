// ───── CONFIG ─────
const API = ''; // same origin

// ───── STATE ─────
const state = {
    user: null,
    token: null,
    stages: [],
    currentStage: null,
    activePanel: null,
    realtimeChannels: []
};

// ───── INIT ─────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    bindThemeModal();
    bindAuthUI();
    checkSession();
});

// ───── THEME ─────
const THEMES = ['classic', 'ng1', 'ng2', 'ng3', 'ng4', 'ng5', 'light'];

function initTheme() {
    const saved = localStorage.getItem('sc-theme') || 'classic';
    applyTheme(saved);
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('sc-theme', t);
    document.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === t);
    });
}

function bindThemeModal() {
    const modal = document.getElementById('theme-modal');
    document.getElementById('theme-btn').addEventListener('click', () => {
        modal.hidden = false;
        initTheme(); // sync active swatches
    });
    document.getElementById('theme-modal-close').addEventListener('click', () => {
        modal.hidden = true;
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.hidden = true;
    });
    document.querySelectorAll('.theme-swatch').forEach(s => {
        s.addEventListener('click', () => {
            applyTheme(s.dataset.theme);
        });
    });
}

// ───── TOAST ─────
function toast(msg, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 320);
    }, duration);
}

// ───── AUTH BINDINGS ─────
function bindAuthUI() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById('login-form').hidden = target !== 'login';
            document.getElementById('register-form').hidden = target !== 'register';
        });
    });

    // Login
    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        await doLogin(username, password);
    });

    // Register
    document.getElementById('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        const displayName = document.getElementById('reg-display').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        await doRegister({
            displayName,
            username,
            email,
            password
        });
    });
}

// ───── AUTH API ─────
async function apiPost(path, body, auth = false) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(API + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    return res.json();
}
async function apiGet(path, auth = false) {
    const headers = {};
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(API + path, {
        headers
    });
    return res.json();
}
async function apiDelete(path, auth = false) {
    const headers = {};
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(API + path, {
        method: 'DELETE',
        headers
    });
    return res.json();
}

async function doLogin(username, password) {
    try {
        const data = await apiPost('/api/auth/login', {
            username,
            password
        });
        if (data.error) return toast(data.error, 'error');
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('sc-token', data.token);
        renderAuthChip();
        showView('dashboard');
        loadStages();
        toast('Welcome back, ' + (data.user.display_name || data.user.username) + '!', 'success');
    } catch {
        toast('Login failed. Please try again.', 'error');
    }
}

async function doRegister({
    displayName,
    username,
    email,
    password
}) {
    try {
        const data = await apiPost('/api/auth/register', {
            displayName,
            username,
            email,
            password
        });
        if (data.error) return toast(data.error, 'error');
        toast('Account created! Please sign in.', 'success');
        document.querySelector('.auth-tab[data-tab="login"]').click();
    } catch {
        toast('Registration failed. Please try again.', 'error');
    }
}

async function checkSession() {
    const token = localStorage.getItem('sc-token');
    if (!token) {
        showView('auth');
        return;
    }
    state.token = token;
    try {
        const data = await apiGet('/api/auth/me', true);
        if (data.error) {
            localStorage.removeItem('sc-token');
            showView('auth');
            return;
        }
        state.user = data.user;
        renderAuthChip();
        showView('dashboard');
        loadStages();
    } catch {
        showView('auth');
    }
}

function doLogout() {
    apiPost('/api/auth/logout', {}, true).catch(() => {});
    localStorage.removeItem('sc-token');
    state.token = null;
    state.user = null;
    state.stages = [];
    state.currentStage = null;
    renderAuthChip();
    showView('auth');
    toast('Signed out.', 'info');
}

// ───── AUTH CHIP ─────
function renderAuthChip() {
    const area = document.getElementById('auth-area');
    if (!state.user) {
        area.innerHTML = '';
        return;
    }
    const initials = ((state.user.display_name || state.user.username || '?')[0]).toUpperCase();
    const chip = document.createElement('div');
    chip.className = 'user-chip';
    chip.innerHTML = `
    <div class="user-avatar">${state.user.avatar_url ? `<img src="${state.user.avatar_url}" alt="avatar" />` : initials}</div>
    <span class="user-name">${state.user.display_name || state.user.username}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--text-faint)">
      <polyline points="6,9 12,15 18,9"/>
    </svg>`;
    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;top:56px;right:24px;background:var(--surface);backdrop-filter:blur(16px);border:1.5px solid var(--surface-border);border-radius:12px;padding:8px;z-index:150;box-shadow:0 4px 20px var(--shadow-strong);display:none;min-width:160px;';
    menu.innerHTML = `<button onclick="doLogout()" style="background:none;border:none;cursor:pointer;font-family:\'Jua\',sans-serif;font-size:0.88rem;color:var(--danger);padding:10px 14px;border-radius:8px;width:100%;text-align:left;display:flex;align-items:center;gap:8px;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>Sign Out</button>`;
    area.innerHTML = '';
    area.appendChild(chip);
    area.style.position = 'relative';
    area.appendChild(menu);
    chip.addEventListener('click', e => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => {
        menu.style.display = 'none';
    }, {
        once: false
    });
}

// ───── VIEWS ─────
function showView(name) {
    ['auth', 'dashboard', 'editor'].forEach(v => {
        document.getElementById('view-' + v).hidden = (v !== name);
    });
}

// ───── DASHBOARD ─────
async function loadStages() {
    document.getElementById('welcome-msg').textContent = 'Hello, ' + (state.user?.display_name || state.user?.username || '') + '!';
    document.getElementById('new-stage-btn').onclick = openCreateModal;
    document.getElementById('empty-new-btn').onclick = openCreateModal;

    try {
        const data = await apiGet('/api/stages/list', true);
        state.stages = data.stages || [];
        renderStages();
    } catch {
        toast('Failed to load stages.', 'error');
    }
}

function renderStages() {
    const grid = document.getElementById('stages-grid');
    const empty = document.getElementById('stages-empty');
    grid.querySelectorAll('.stage-card').forEach(c => c.remove());
    if (!state.stages.length) {
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    state.stages.forEach(stage => {
        const card = document.createElement('div');
        card.className = 'stage-card';
        const features = (stage.features || []).map(f => `<span class="feature-pill">${f}</span>`).join('');
        const date = new Date(stage.created_at).toLocaleDateString('en-SG', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        card.innerHTML = `
      <div class="stage-card-header">
        <div class="stage-card-title">${escHtml(stage.title)}</div>
        ${stage.is_live ? `<span class="stage-live-badge"><span class="live-dot"></span> LIVE</span>` : ''}
      </div>
      <div class="stage-card-desc">${escHtml(stage.description || 'No description.')}</div>
      <div class="stage-card-meta">
        <div class="stage-features">${features}</div>
        <span class="stage-date">${date}</span>
      </div>`;
        card.addEventListener('click', () => openEditor(stage));
        grid.appendChild(card);
    });
}

// ───── CREATE STAGE MODAL ─────
function openCreateModal() {
    document.getElementById('create-modal').hidden = false;
    document.getElementById('stage-title').value = '';
    document.getElementById('stage-desc').value = '';
}
document.getElementById('create-modal-close').addEventListener('click', () => {
    document.getElementById('create-modal').hidden = true;
});
document.getElementById('create-cancel').addEventListener('click', () => {
    document.getElementById('create-modal').hidden = true;
});
document.getElementById('create-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('create-modal')) document.getElementById('create-modal').hidden = true;
});

document.getElementById('confirm-create-btn')?.remove(); // safety
document.getElementById('create-confirm').addEventListener('click', async () => {
    const title = document.getElementById('stage-title').value.trim();
    if (!title) return toast('Please enter a stage title.', 'error');
    const features = Array.from(document.querySelectorAll('.feature-check input:checked')).map(i => i.value);
    const desc = document.getElementById('stage-desc').value.trim();
    try {
        const data = await apiPost('/api/stages/create', {
            title,
            description: desc,
            features
        }, true);
        if (data.error) return toast(data.error, 'error');
        toast('Stage created!', 'success');
        document.getElementById('create-modal').hidden = true;
        state.stages.unshift(data.stage);
        renderStages();
        openEditor(data.stage);
    } catch {
        toast('Failed to create stage.', 'error');
    }
});

// ───── EDITOR ─────
const FEATURE_META = {
    poll: {
        label: 'Polls',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
    },
    wordcloud: {
        label: 'Word Cloud',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
    },
    qa: {
        label: 'Q&A',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    },
    quiz: {
        label: 'Quiz',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
    },
    survey: {
        label: 'Survey',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    reaction: {
        label: 'Reactions',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
    },
    chat: {
        label: 'Chat',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    },
    comment: {
        label: 'Comments',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
    }
};

function openEditor(stage) {
    state.currentStage = stage;
    showView('editor');
    document.getElementById('editor-stage-title').textContent = stage.title;
    updateStatusBadge();
    buildSidebar(stage.features || []);
    buildPanels(stage.features || []);
    updateLiveButtons();
}

function updateStatusBadge() {
    const s = state.currentStage;
    const badge = document.getElementById('editor-stage-status');
    badge.textContent = s.is_live ? 'LIVE' : 'Draft';
    badge.className = 'stage-status ' + (s.is_live ? 'live' : 'draft');
}

function buildSidebar(features) {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    features.forEach(f => {
        const m = FEATURE_META[f];
        if (!m) return;
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.dataset.panel = f;
        btn.innerHTML = m.icon + m.label;
        btn.addEventListener('click', () => activatePanel(f));
        nav.appendChild(btn);
    });
    if (features.length) activatePanel(features[0]);

    document.getElementById('back-to-dash').onclick = () => {
        showView('dashboard');
        loadStages();
    };
}

function activatePanel(f) {
    state.activePanel = f;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.panel === f));
    document.querySelectorAll('.editor-panel').forEach(p => p.hidden = (p.dataset.panel !== f));
}

function buildPanels(features) {
    // Reset all panels
    document.querySelectorAll('.editor-panel').forEach(p => {
        p.innerHTML = '';
        p.hidden = true;
    });
    features.forEach(f => {
        const panel = document.querySelector(`.editor-panel[data-panel="${f}"]`);
        if (!panel) return;
        const builder = panelBuilders[f];
        if (builder) builder(panel, state.currentStage);
    });
}

// ───── PANEL BUILDERS ─────
const panelBuilders = {

    poll(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Polls</h2>
        <button class="btn btn-primary" id="new-poll-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Poll
        </button>
      </div>
      <div id="polls-list"></div>`;
        panel.querySelector('#new-poll-btn').onclick = () => openNewPollForm(panel, stage);
        loadPolls(panel, stage);
    },

    wordcloud(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Word Cloud</h2></div>
      <div class="panel-card">
        <div class="wordcloud-canvas" id="wc-canvas"><span style="color:var(--text-faint);font-size:0.88rem">Words submitted by audience will appear here</span></div>
        <div style="display:flex;gap:10px;align-items:center">
          <input class="form-input" id="wc-preview-input" placeholder="Preview a word..." style="flex:1" />
          <button class="btn btn-secondary" id="wc-clear">Clear Display</button>
        </div>
      </div>`;
        loadWordCloud(panel, stage);
        panel.querySelector('#wc-clear').onclick = () => {
            document.getElementById('wc-canvas').innerHTML = '<span style="color:var(--text-faint);font-size:0.88rem">Cleared.</span>';
        };
    },

    qa(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Q&amp;A</h2></div>
      <div id="qa-list"></div>`;
        loadQA(panel, stage);
    },

    quiz(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header">
        <h2 class="panel-title">Quiz</h2>
        <button class="btn btn-primary" id="new-quiz-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Question
        </button>
      </div>
      <div id="quiz-list"></div>`;
        loadQuiz(panel, stage);
    },

    survey(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Survey</h2>
        <button class="btn btn-primary" id="new-survey-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Survey
        </button>
      </div>
      <div id="survey-list"></div>`;
    },

    reaction(panel, stage) {
        const reactions = [{
                type: 'heart',
                label: 'Heart',
                svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
            },
            {
                type: 'fire',
                label: 'Fire',
                svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>'
            },
            {
                type: 'clap',
                label: 'Clap',
                svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v1m0 0v1m0-1h1m-1 0H7M5 8l1-1m1 1-1-1M5 8l1 1M5 8H4m9-5v2m0 0v2m0-2h2m-2 0h-2m3 8-4-4-4 4"/><path d="M12 19a7 7 0 0 0 7-7"/></svg>'
            },
            {
                type: 'wow',
                label: 'Wow',
                svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>'
            },
            {
                type: 'laugh',
                label: 'Laugh',
                svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
            },
        ];
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Reactions</h2></div>
      <div class="panel-card">
        <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px">Live reaction counts from your audience</p>
        <div class="reactions-grid" id="reactions-grid">
          ${reactions.map(r => `
            <div class="reaction-btn-big" id="rxn-${r.type}">
              <div class="reaction-icon">${r.svg}</div>
              <span>${r.label}</span>
              <span class="reaction-count" id="rxn-count-${r.type}">0</span>
            </div>`).join('')}
        </div>
      </div>`;
        loadReactions(stage);
    },

    chat(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Chat</h2>
        <button class="btn btn-secondary btn-sm" id="clear-chat-btn">Clear All</button>
      </div>
      <div class="panel-card">
        <div class="chat-messages" id="chat-msgs"></div>
      </div>`;
        loadChat(panel, stage);
        panel.querySelector('#clear-chat-btn').onclick = async () => {
            if (!confirm('Clear all chat messages?')) return;
            await apiPost('/api/interactions/chat', {
                action: 'clear',
                stageId: stage.id
            }, true);
            document.getElementById('chat-msgs').innerHTML = '';
            toast('Chat cleared.', 'success');
        };
    },

    comment(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Comments</h2></div>
      <div id="comments-list"></div>`;
        loadComments(panel, stage);
    }
};

// ───── DATA LOADERS (stub → real API) ─────
async function loadPolls(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/poll?stageId=${stage.id}`, true);
        renderPolls(panel, data.polls || [], stage);
    } catch {
        toast('Failed to load polls.', 'error');
    }
}

function renderPolls(panel, polls, stage) {
    const list = panel.querySelector('#polls-list');
    if (!polls.length) {
        list.innerHTML = `<div class="empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><p>No polls yet. Create one above.</p></div>`;
        return;
    }
    list.innerHTML = '';
    polls.forEach(poll => {
        const totalVotes = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="poll-question">${escHtml(poll.question)}</div>
      <div class="poll-options">
        ${poll.options.map(o => {
          const pct = totalVotes ? Math.round((o.votes || 0) / totalVotes * 100) : 0;
          return `<div class="poll-option-row">
            <span class="poll-option-text">${escHtml(o.text)}</span>
            <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
            <span class="poll-count">${o.votes || 0}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="poll-actions">
        <button class="toggle-pill ${poll.is_active ? 'on' : ''}" data-poll-id="${poll.id}" data-action="toggle">${poll.is_active ? 'Active' : 'Inactive'}</button>
        <button class="toggle-pill" data-poll-id="${poll.id}" data-action="delete" style="color:var(--danger)">Delete</button>
      </div>`;
        card.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = () => pollAction(btn.dataset.pollId, btn.dataset.action, panel, stage);
        });
        list.appendChild(card);
    });
}

async function pollAction(pollId, action, panel, stage) {
    if (action === 'delete' && !confirm('Delete this poll?')) return;
    try {
        await apiPost('/api/interactions/poll', {
            action,
            pollId,
            stageId: stage.id
        }, true);
        loadPolls(panel, stage);
    } catch {
        toast('Action failed.', 'error');
    }
}

function openNewPollForm(panel, stage) {
    const form = document.createElement('div');
    form.className = 'panel-card';
    form.innerHTML = `
    <div class="form-group"><label class="form-label">Question</label><input class="form-input" id="nq-question" placeholder="Your poll question..." /></div>
    <div class="form-group"><label class="form-label">Options (one per line)</label><textarea class="form-input form-textarea" id="nq-options" placeholder="Option A\nOption B\nOption C"></textarea></div>
    <div class="publish-actions"><button class="btn btn-secondary" id="nq-cancel">Cancel</button><button class="btn btn-primary" id="nq-submit">Create Poll</button></div>`;
    panel.querySelector('#polls-list').prepend(form);
    form.querySelector('#nq-cancel').onclick = () => form.remove();
    form.querySelector('#nq-submit').onclick = async () => {
        const question = form.querySelector('#nq-question').value.trim();
        const optionLines = form.querySelector('#nq-options').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
        if (!question || optionLines.length < 2) return toast('Question and at least 2 options required.', 'error');
        try {
            await apiPost('/api/interactions/poll', {
                action: 'create',
                stageId: stage.id,
                question,
                options: optionLines
            }, true);
            form.remove();
            loadPolls(panel, stage);
            toast('Poll created!', 'success');
        } catch {
            toast('Failed to create poll.', 'error');
        }
    };
}

async function loadQA(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/qa?stageId=${stage.id}`, true);
        renderQA(panel, data.questions || [], stage);
    } catch {
        toast('Failed to load Q&A.', 'error');
    }
}

function renderQA(panel, questions, stage) {
    const list = panel.querySelector('#qa-list');
    if (!questions.length) {
        list.innerHTML = `<div class="empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg><p>No questions yet. Audience can submit them live.</p></div>`;
        return;
    }
    list.innerHTML = '';
    questions.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).forEach(q => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="qa-item">
        <div class="qa-votes">
          <span class="vote-count">${q.upvotes - q.downvotes}</span>
        </div>
        <div class="qa-content">
          <div class="qa-question-text">${escHtml(q.question)}</div>
          <div class="qa-meta">
            <span>${escHtml(q.author_name || 'Anonymous')}</span>
            <span>${new Date(q.created_at).toLocaleTimeString('en-SG', {hour:'2-digit', minute:'2-digit'})}</span>
            ${q.is_answered ? `<span class="qa-answered">Answered</span>` : ''}
            ${q.is_pinned ? `<span style="color:var(--brand-text)">Pinned</span>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
          <button class="toggle-pill ${q.is_answered ? 'on' : ''}" data-qa-id="${q.id}" data-action="answer">${q.is_answered ? 'Answered' : 'Mark Done'}</button>
          <button class="toggle-pill ${q.is_pinned ? 'on' : ''}" data-qa-id="${q.id}" data-action="pin">${q.is_pinned ? 'Unpin' : 'Pin'}</button>
          <button class="toggle-pill" data-qa-id="${q.id}" data-action="hide" style="color:var(--danger)">Hide</button>
        </div>
      </div>`;
        card.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = async () => {
                await apiPost('/api/interactions/qa', {
                    action: btn.dataset.action,
                    qaId: btn.dataset.qaId,
                    stageId: stage.id
                }, true);
                loadQA(panel, stage);
            };
        });
        list.appendChild(card);
    });
}

async function loadWordCloud(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/wordcloud?stageId=${stage.id}`, true);
        renderWordCloud(data.words || []);
    } catch {}
}

function renderWordCloud(words) {
    const canvas = document.getElementById('wc-canvas');
    if (!canvas) return;
    const freq = {};
    words.forEach(w => {
        freq[w.word] = (freq[w.word] || 0) + 1;
    });
    const max = Math.max(...Object.values(freq), 1);
    canvas.innerHTML = '';
    Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50).forEach(([word, count]) => {
        const size = 0.75 + (count / max) * 1.8;
        const span = document.createElement('span');
        span.className = 'cloud-word';
        span.textContent = word;
        span.style.fontSize = size + 'rem';
        span.style.opacity = 0.5 + (count / max) * 0.5;
        canvas.appendChild(span);
    });
}

async function loadReactions(stage) {
    try {
        const data = await apiGet(`/api/interactions/reaction?stageId=${stage.id}`, true);
        (data.reactions || []).forEach(r => {
            const el = document.getElementById(`rxn-count-${r.reaction_type}`);
            if (el) el.textContent = r.count;
        });
    } catch {}
}

async function loadChat(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/chat?stageId=${stage.id}`, true);
        const msgs = document.getElementById('chat-msgs');
        msgs.innerHTML = '';
        (data.messages || []).forEach(m => appendChatMsg(m));
    } catch {}
}

function appendChatMsg(m) {
    const msgs = document.getElementById('chat-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const time = new Date(m.created_at).toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit'
    });
    div.innerHTML = `<div class="chat-msg-author">${escHtml(m.author_name || 'Anonymous')}<span class="chat-msg-time">${time}</span></div><div class="chat-msg-text">${escHtml(m.message)}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

async function loadComments(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/comment?stageId=${stage.id}`, true);
        renderComments(panel, data.comments || [], stage);
    } catch {}
}

function renderComments(panel, comments, stage) {
    const list = panel.querySelector('#comments-list');
    if (!comments.length) {
        list.innerHTML = `<div class="empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>No comments yet.</p></div>`;
        return;
    }
    list.innerHTML = '';
    comments.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).forEach(c => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="qa-item">
        <div class="qa-votes"><span class="vote-count">${c.upvotes - c.downvotes}</span></div>
        <div class="qa-content">
          <div class="qa-question-text">${escHtml(c.content)}</div>
          <div class="qa-meta"><span>${escHtml(c.author_name || 'Anonymous')}</span><span>${new Date(c.created_at).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})}</span></div>
        </div>
        <button class="toggle-pill" data-comment-id="${c.id}" style="flex-shrink:0;color:var(--danger)">Hide</button>
      </div>`;
        card.querySelector('[data-comment-id]').onclick = async () => {
            await apiPost('/api/interactions/comment', {
                action: 'hide',
                commentId: c.id,
                stageId: stage.id
            }, true);
            loadComments(panel, stage);
        };
        list.appendChild(card);
    });
}

async function loadQuiz(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/quiz?stageId=${stage.id}`, true);
        renderQuiz(panel, data.questions || [], stage);
    } catch {}
}

function renderQuiz(panel, questions, stage) {
    const list = panel.querySelector('#quiz-list');
    if (!questions.length) {
        list.innerHTML = `<div class="empty-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>No quiz questions yet.</p></div>`;
        return;
    }
    list.innerHTML = '';
    questions.forEach(q => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="poll-question">${escHtml(q.question)}</div>
      <div class="poll-options">${(q.options || []).map(o => `<div class="poll-option-row" style="${o.id === q.correct_option_id ? 'border-color:var(--success)' : ''}"><span class="poll-option-text">${escHtml(o.text)}</span>${o.id === q.correct_option_id ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--success)"><polyline points="20,6 9,17 4,12"/></svg>' : ''}</div>`).join('')}</div>
      <div class="poll-actions"><span style="font-size:0.8rem;color:var(--text-faint)">${q.points} pts · ${q.time_limit_seconds}s</span>
        <button class="toggle-pill ${q.is_active ? 'on' : ''}" data-quiz-id="${q.id}" data-action="toggle">${q.is_active ? 'Active' : 'Activate'}</button>
      </div>`;
        card.querySelector('[data-action]').onclick = async () => {
            await apiPost('/api/interactions/quiz', {
                action: 'toggle',
                quizId: q.id,
                stageId: stage.id
            }, true);
            loadQuiz(panel, stage);
        };
        list.appendChild(card);
    });
    panel.querySelector('#new-quiz-btn').onclick = () => openNewQuizForm(panel, stage);
}

function openNewQuizForm(panel, stage) {
    const form = document.createElement('div');
    form.className = 'panel-card';
    form.innerHTML = `
    <div class="form-group"><label class="form-label">Question</label><input class="form-input" id="nqz-q" placeholder="Quiz question..." /></div>
    <div class="form-group"><label class="form-label">Options (one per line)</label><textarea class="form-input form-textarea" id="nqz-opts" placeholder="Option A\nOption B\nOption C\nOption D"></textarea></div>
    <div class="form-group"><label class="form-label">Correct Answer (exact text)</label><input class="form-input" id="nqz-correct" placeholder="Option A" /></div>
    <div style="display:flex;gap:12px">
      <div class="form-group" style="flex:1"><label class="form-label">Points</label><input class="form-input" id="nqz-pts" type="number" value="10" min="1" /></div>
      <div class="form-group" style="flex:1"><label class="form-label">Time (seconds)</label><input class="form-input" id="nqz-time" type="number" value="30" min="5" /></div>
    </div>
    <div class="publish-actions"><button class="btn btn-secondary" id="nqz-cancel">Cancel</button><button class="btn btn-primary" id="nqz-submit">Add Question</button></div>`;
    panel.querySelector('#quiz-list').prepend(form);
    form.querySelector('#nqz-cancel').onclick = () => form.remove();
    form.querySelector('#nqz-submit').onclick = async () => {
        const question = form.querySelector('#nqz-q').value.trim();
        const opts = form.querySelector('#nqz-opts').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
        const correct = form.querySelector('#nqz-correct').value.trim();
        const points = parseInt(form.querySelector('#nqz-pts').value) || 10;
        const time = parseInt(form.querySelector('#nqz-time').value) || 30;
        if (!question || opts.length < 2 || !correct) return toast('Fill in all required fields.', 'error');
        if (!opts.includes(correct)) return toast('Correct answer must match one of the options exactly.', 'error');
        try {
            await apiPost('/api/interactions/quiz', {
                action: 'create',
                stageId: stage.id,
                question,
                options: opts,
                correctOption: correct,
                points,
                timeLimitSeconds: time
            }, true);
            form.remove();
            loadQuiz(panel, stage);
            toast('Quiz question added!', 'success');
        } catch {
            toast('Failed.', 'error');
        }
    };
}

// ───── LIVE MANAGEMENT ─────
function updateLiveButtons() {
    const s = state.currentStage;
    document.getElementById('go-live-btn').hidden = s.is_live;
    document.getElementById('end-live-btn').hidden = !s.is_live;
    const linkBox = document.getElementById('live-link-box');
    if (s.is_live && s.slug) {
        linkBox.hidden = false;
        const url = `https://live.stage.uwuapps.org/${s.slug}`;
        const link = document.getElementById('live-link-url');
        link.href = url;
        link.textContent = url;
        document.getElementById('copy-link-btn').onclick = () => {
            navigator.clipboard.writeText(url);
            toast('Link copied!', 'success');
        };
    } else {
        linkBox.hidden = true;
    }
    bindLiveButtons();
}

function bindLiveButtons() {
    document.getElementById('go-live-btn').onclick = () => {
        document.getElementById('slug-input').value = '';
        document.getElementById('publish-modal').hidden = false;
        document.getElementById('publish-confirm').onclick = confirmGoLive;
        document.getElementById('slug-input').onkeydown = e => { if (e.key === 'Enter') confirmGoLive(); };
        document.getElementById('publish-cancel').onclick = () => {
            document.getElementById('publish-modal').hidden = true;
        };
        document.getElementById('publish-modal-close').onclick = () => {
            document.getElementById('publish-modal').hidden = true;
        };
        document.getElementById('publish-modal').onclick = e => {
            if (e.target === document.getElementById('publish-modal')) document.getElementById('publish-modal').hidden = true;
        };
    };
    document.getElementById('end-live-btn').onclick = () => {
        const modal = document.getElementById('end-session-modal');
        modal.hidden = false;
        const close = () => { modal.hidden = true; };
        document.getElementById('end-session-modal-close').onclick = close;
        document.getElementById('end-session-cancel').onclick = close;
        modal.onclick = e => { if (e.target === modal) close(); };
        document.getElementById('end-session-confirm').onclick = () => {
            close();
            const btn = document.getElementById('end-live-btn');
            btn.disabled = true;
            setTimeout(async () => {
                try {
                    const data = await apiPost('/api/stages/unpublish', {
                        stageId: state.currentStage.id
                    }, true);
                    if (data.error) {
                        toast(data.error, 'error');
                        btn.disabled = false;
                        return;
                    }
                    state.currentStage.is_live = false;
                    state.currentStage.slug = null;
                    updateStatusBadge();
                    updateLiveButtons();
                    toast('Session ended.', 'success');
                } catch {
                    toast('Failed to end session.', 'error');
                    btn.disabled = false;
                }
            }, 0);
        };
    };
}

async function confirmGoLive() {
    const raw = document.getElementById('slug-input').value.trim();
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return toast('Please enter a valid slug.', 'error');
    try {
        const data = await apiPost('/api/stages/publish', {
            stageId: state.currentStage.id,
            slug
        }, true);
        if (data.error) return toast(data.error, 'error');
        state.currentStage.is_live = true;
        state.currentStage.slug = slug;
        document.getElementById('publish-modal').hidden = true;
        updateStatusBadge();
        updateLiveButtons();
        toast('Now live at live.stage.uwuapps.org/' + slug, 'success');
    } catch {
        toast('Failed to go live.', 'error');
    }
}

// ───── UTILS ─────
function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ───── REALTIME (Supabase) ─────
// Realtime subscriptions are initialised once the Supabase client is
// available. Import the Supabase JS client in your HTML or via CDN
// and call initRealtime(stageId) after openEditor().
// Keeping this modular so you can hook it in separately.
function initRealtime(stageId) {
    if (!window.supabase) return;
    const ch = window.supabase.channel(`stage:${stageId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'uwustage_chat',
            filter: `stage_id=eq.${stageId}`
        }, payload => {
            if (payload.eventType === 'INSERT') appendChatMsg(payload.new);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'uwustage_reactions',
            filter: `stage_id=eq.${stageId}`
        }, () => {
            loadReactions(state.currentStage);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'uwustage_qa',
            filter: `stage_id=eq.${stageId}`
        }, () => {
            if (state.activePanel === 'qa') {
                const panel = document.querySelector('.editor-panel[data-panel="qa"]');
                if (panel) loadQA(panel, state.currentStage);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'uwustage_wordcloud',
            filter: `stage_id=eq.${stageId}`
        }, () => {
            if (state.activePanel === 'wordcloud') {
                const panel = document.querySelector('.editor-panel[data-panel="wordcloud"]');
                if (panel) loadWordCloud(panel, state.currentStage);
            }
        })
        .subscribe();
    state.realtimeChannels.push(ch);
}