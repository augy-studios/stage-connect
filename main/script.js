// ───── CONFIG ─────
const API = ''; // same origin

// ───── STATE ─────
const state = {
    user: null,
    token: null,
    stages: [],
    currentStage: null,
    activePanel: null,
    realtimeChannels: [],
    editorInterval: null
};

// ───── INIT ─────
document.addEventListener('DOMContentLoaded', async () => {
    bindAuthUI();
    await checkSession();
    // Anonymous visitor (or expired/never-logged-in session): the auth view's
    // login/register calls still go through signedFetch, so they need a key.
    if (!state.user) {
        try {
            await initGuestKey('stage-connect');
        } catch (e) {
            console.error('Failed to obtain guest signing key:', e);
        }
    }
    document.querySelector('.topbar-brand').addEventListener('click', () => {
        if (!state.user) showView('landing');
        else showView('dashboard');
    });
});

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
    const res = await signedFetch(API + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    return res.json();
}
async function apiGet(path, auth = false) {
    const headers = {};
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await signedFetch(API + path, {
        headers
    });
    return res.json();
}
async function apiDelete(path, auth = false) {
    const headers = {};
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await signedFetch(API + path, {
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
        // Session token is always persisted in localStorage (no remember-me toggle
        // on this site), so the signing key follows the same persistence.
        storeSigningKey(data.signing_key, data.key_id, true);
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
        renderAuthChip();
        showView('landing');
        return;
    }
    state.token = token;
    try {
        const data = await apiGet('/api/auth/me', true);
        if (data.error) {
            localStorage.removeItem('sc-token');
            renderAuthChip();
            showView('landing');
            return;
        }
        state.user = data.user;
        renderAuthChip();
        showView('dashboard');
        loadStages();
    } catch {
        renderAuthChip();
        showView('landing');
    }
}

async function doLogout() {
    await apiPost('/api/auth/logout', {}, true).catch(() => {});
    localStorage.removeItem('sc-token');
    clearSigningKey();
    state.token = null;
    state.user = null;
    state.stages = [];
    state.currentStage = null;
    renderAuthChip();
    showView('landing');
    toast('Signed out.', 'info');
    // Back to an anonymous page state, arm a guest key before any further signedFetch calls.
    initGuestKey('stage-connect').catch(e => console.error('Failed to obtain guest signing key:', e));
}

// ───── AUTH CHIP ─────
function renderAuthChip() {
    const area = document.getElementById('auth-area');
    if (!state.user) {
        area.innerHTML = '<button class="btn btn-primary btn-sm" type="button" onclick="openSignIn()">Sign In</button>';
        return;
    }
    const initials = ((state.user.display_name || state.user.username || '?')[0]).toUpperCase();
    const chip = document.createElement('div');
    chip.className = 'user-chip';
    chip.innerHTML = `
    <div class="user-avatar">${state.user.avatar_url ? `<img src="${state.user.avatar_url}" alt="avatar" />` : initials}</div>
    <span class="user-name">${state.user.display_name || state.user.username}</span>
    <span data-icon="chevron-down"></span>`;
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    // The open/closed state is read off the inline style below, so seed it.
    menu.style.display = 'none';
    menu.innerHTML = `<button class="user-menu-item" type="button" onclick="doLogout()">
    <span data-icon="log-out"></span>Sign Out</button>`;
    area.innerHTML = '';
    area.appendChild(chip);
    area.style.position = 'relative';
    area.appendChild(menu);
    hydrateIcons(area);
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
    ['landing', 'auth', 'dashboard', 'editor'].forEach(v => {
        document.getElementById('view-' + v).hidden = (v !== name);
    });
}

function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.auth-tab[data-tab="${tabName}"]`);
    if (tab) tab.classList.add('active');
    document.getElementById('login-form').hidden = tabName !== 'login';
    document.getElementById('register-form').hidden = tabName !== 'register';
}

function openSignIn() {
    switchAuthTab('login');
    showView('auth');
}

function openGetStarted() {
    switchAuthTab('register');
    showView('auth');
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
    poll: { label: 'Polls', icon: 'poll' },
    wordcloud: { label: 'Word Cloud', icon: 'wordcloud' },
    qa: { label: 'Q&A', icon: 'qa' },
    quiz: { label: 'Quiz', icon: 'quiz' },
    survey: { label: 'Survey', icon: 'survey' },
    reaction: { label: 'Reactions', icon: 'reaction' },
    chat: { label: 'Chat', icon: 'chat' },
    comment: { label: 'Comments', icon: 'comment' }
};

const REACTIONS = [
    { type: 'heart', label: 'Heart' },
    { type: 'fire', label: 'Fire' },
    { type: 'clap', label: 'Clap' },
    { type: 'wow', label: 'Wow' },
    { type: 'laugh', label: 'Laugh' }
];

function openEditor(stage) {
    state.currentStage = stage;
    showView('editor');
    document.getElementById('editor-stage-title').textContent = stage.title;
    updateStatusBadge();
    buildSidebar(stage.features || []);
    buildPanels(stage.features || []);
    if (stage.features?.length) activatePanel(stage.features[0]);
    updateLiveButtons();
    startEditorPolling(stage);
}

function startEditorPolling(stage) {
    if (state.editorInterval) clearInterval(state.editorInterval);
    state.editorInterval = setInterval(() => {
        if (!state.currentStage?.is_live) return;
        const f = state.activePanel;
        const panel = document.querySelector(`.editor-panel[data-panel="${f}"]`);
        if (!panel) return;
        if (panel.querySelector('[data-creation-form]')) return;
        const refreshers = {
            poll: () => loadPolls(panel, stage),
            wordcloud: () => loadWordCloud(panel, stage),
            qa: () => loadQA(panel, stage),
            reaction: () => loadReactions(stage),
            chat: () => loadChat(panel, stage),
            comment: () => loadComments(panel, stage),
            quiz: () => loadQuiz(panel, stage),
            survey: () => loadSurvey(panel, stage),
        };
        if (refreshers[f]) refreshers[f]();
    }, 5000);
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
        btn.type = 'button';
        btn.innerHTML = `<span data-icon="${m.icon}"></span>${m.label}`;
        btn.addEventListener('click', () => activatePanel(f));
        nav.appendChild(btn);
    });
    hydrateIcons(nav);
    document.getElementById('back-to-dash').onclick = () => {
        if (state.editorInterval) { clearInterval(state.editorInterval); state.editorInterval = null; }
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
        <button class="btn btn-primary" type="button" id="new-poll-btn">
          <span data-icon="plus"></span>
          New Poll
        </button>
      </div>
      <div id="polls-list"></div>`;
        hydrateIcons(panel);
        panel.querySelector('#new-poll-btn').onclick = () => openNewPollForm(panel, stage);
        loadPolls(panel, stage);
    },

    wordcloud(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Word Cloud</h2></div>
      <div class="panel-card">
        <div class="wordcloud-canvas" id="wc-canvas"><span class="wc-hint">Words submitted by audience will appear here</span></div>
        <div class="wc-preview-row">
          <input class="form-input" id="wc-preview-input" placeholder="Preview a word..." />
          <button class="btn btn-secondary" type="button" id="wc-clear">Clear Display</button>
        </div>
      </div>`;
        loadWordCloud(panel, stage);
        panel.querySelector('#wc-clear').onclick = () => {
            document.getElementById('wc-canvas').innerHTML = '<span class="wc-hint">Cleared.</span>';
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
        <button class="btn btn-primary" type="button" id="new-quiz-btn">
          <span data-icon="plus"></span>
          New Question
        </button>
      </div>
      <div id="quiz-list"></div>`;
        hydrateIcons(panel);
        panel.querySelector('#new-quiz-btn').onclick = () => openNewQuizForm(panel, stage);
        loadQuiz(panel, stage);
    },

    survey(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Survey</h2>
        <button class="btn btn-primary" type="button" id="new-survey-btn">
          <span data-icon="plus"></span>
          New Survey
        </button>
      </div>
      <div id="survey-list"></div>`;
        hydrateIcons(panel);
        panel.querySelector('#new-survey-btn').onclick = () => openNewSurveyForm(panel, stage);
        loadSurvey(panel, stage);
    },

    reaction(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Reactions</h2></div>
      <div class="panel-card">
        <p class="panel-note">Live reaction counts from your audience</p>
        <div class="reactions-grid" id="reactions-grid">
          ${REACTIONS.map(r => `
            <div class="reaction-btn-big" id="rxn-${r.type}">
              <div class="reaction-icon" data-icon="${r.type}"></div>
              <span>${r.label}</span>
              <span class="reaction-count" id="rxn-count-${r.type}">0</span>
            </div>`).join('')}
        </div>
      </div>`;
        hydrateIcons(panel);
        loadReactions(stage);
    },

    chat(panel, stage) {
        panel.innerHTML = `
      <div class="panel-header"><h2 class="panel-title">Chat</h2>
        <button class="btn btn-secondary btn-sm" type="button" id="clear-chat-btn">Clear All</button>
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

// ───── DATA LOADERS ─────
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
        list.innerHTML = `<div class="empty-panel"><span data-icon="poll"></span><p>No polls yet. Create one above.</p></div>`;
        hydrateIcons(list);
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
        <button class="toggle-pill ${poll.is_active ? 'on' : ''}" type="button" data-poll-id="${poll.id}" data-action="toggle">${poll.is_active ? 'Active' : 'Inactive'}</button>
        <button class="toggle-pill danger" type="button" data-poll-id="${poll.id}" data-action="delete">Delete</button>
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
    form.dataset.creationForm = '1';
    form.innerHTML = `
    <div class="form-group"><label class="form-label">Question</label><input class="form-input" id="nq-question" placeholder="Your poll question..." /></div>
    <div class="form-group"><label class="form-label">Options (one per line)</label><textarea class="form-input form-textarea" id="nq-options" placeholder="Option A\nOption B\nOption C"></textarea></div>
    <div class="publish-actions"><button class="btn btn-secondary" type="button" id="nq-cancel">Cancel</button><button class="btn btn-primary" type="button" id="nq-submit">Create Poll</button></div>`;
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
        list.innerHTML = `<div class="empty-panel"><span data-icon="qa"></span><p>No questions yet. Audience can submit them live.</p></div>`;
        hydrateIcons(list);
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
            ${q.is_pinned ? `<span class="qa-pinned">Pinned</span>` : ''}
          </div>
        </div>
        <div class="qa-actions">
          <button class="toggle-pill ${q.is_answered ? 'on' : ''}" type="button" data-qa-id="${q.id}" data-action="answer">${q.is_answered ? 'Answered' : 'Mark Done'}</button>
          <button class="toggle-pill ${q.is_pinned ? 'on' : ''}" type="button" data-qa-id="${q.id}" data-action="pin">${q.is_pinned ? 'Unpin' : 'Pin'}</button>
          <button class="toggle-pill danger" type="button" data-qa-id="${q.id}" data-action="hide">Hide</button>
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
        list.innerHTML = `<div class="empty-panel"><span data-icon="comment"></span><p>No comments yet.</p></div>`;
        hydrateIcons(list);
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
        <button class="toggle-pill danger" type="button" data-comment-id="${c.id}">Hide</button>
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
        list.innerHTML = `<div class="empty-panel"><span data-icon="quiz"></span><p>No quiz questions yet.</p></div>`;
        hydrateIcons(list);
        return;
    }
    list.innerHTML = '';
    questions.forEach(q => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        const counts = q.answer_counts || {};
        const totalAnswers = Object.values(counts).reduce((s, n) => s + n, 0);
        card.innerHTML = `
      <div class="poll-question">${escHtml(q.question)}</div>
      <div class="poll-options">${(q.options || []).map(o => {
            const n = counts[o.id] || 0;
            const pct = totalAnswers ? Math.round(n / totalAnswers * 100) : 0;
            const isCorrect = o.id === q.correct_option_id;
            return `<div class="poll-option-row ${isCorrect ? 'correct' : ''}">
              <span class="poll-option-text">${escHtml(o.text)}</span>
              ${isCorrect ? '<span class="correct-mark" data-icon="check"></span>' : ''}
              <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
              <span class="poll-count">${n}</span>
            </div>`;
        }).join('')}</div>
      <div class="poll-actions"><span class="poll-meta">${q.points} pts · ${q.time_limit_seconds}s · ${totalAnswers} answer${totalAnswers !== 1 ? 's' : ''}</span>
        <button class="toggle-pill ${q.is_active ? 'on' : ''}" type="button" data-quiz-id="${q.id}" data-action="toggle">${q.is_active ? 'Active' : 'Activate'}</button>
      </div>`;
        hydrateIcons(card);
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
}

function openNewQuizForm(panel, stage) {
    const form = document.createElement('div');
    form.className = 'panel-card';
    form.dataset.creationForm = '1';
    form.innerHTML = `
    <div class="form-group"><label class="form-label">Question</label><input class="form-input" id="nqz-q" placeholder="Quiz question..." /></div>
    <div class="form-group"><label class="form-label">Options (one per line)</label><textarea class="form-input form-textarea" id="nqz-opts" placeholder="Option A\nOption B\nOption C\nOption D"></textarea></div>
    <div class="form-group"><label class="form-label">Correct Answer (exact text)</label><input class="form-input" id="nqz-correct" placeholder="Option A" /></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Points</label><input class="form-input" id="nqz-pts" type="number" value="10" min="1" /></div>
      <div class="form-group"><label class="form-label">Time (seconds)</label><input class="form-input" id="nqz-time" type="number" value="30" min="5" /></div>
    </div>
    <div class="publish-actions"><button class="btn btn-secondary" type="button" id="nqz-cancel">Cancel</button><button class="btn btn-primary" type="button" id="nqz-submit">Add Question</button></div>`;
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

async function loadSurvey(panel, stage) {
    try {
        const data = await apiGet(`/api/interactions/survey?action=list&stage_id=${stage.id}`, true);
        const surveys = data.surveys || [];
        const responseSets = await Promise.all(
            surveys.map(s => apiGet(`/api/interactions/survey?action=responses&survey_id=${s.id}`, true).then(r => r.responses || []).catch(() => []))
        );
        renderSurvey(panel, surveys, responseSets, stage);
    } catch {
        toast('Failed to load surveys.', 'error');
    }
}

function renderSurvey(panel, surveys, responseSets, stage) {
    const list = panel.querySelector('#survey-list');
    if (!surveys.length) {
        list.innerHTML = `<div class="empty-panel"><span data-icon="survey"></span><p>No survey questions yet. Create one above.</p></div>`;
        hydrateIcons(list);
        return;
    }
    list.innerHTML = '';
    surveys.forEach((survey, si) => {
        const responses = responseSets[si] || [];
        const qs = survey.questions || [];
        const card = document.createElement('div');
        card.className = 'panel-card';

        const responsesHtml = qs.length && responses.length ? qs.map((q, qi) => {
            const answers = responses.map(r => (r.answers || [])[qi]).filter(a => a);
            if (!answers.length) return '';
            return `<div class="survey-question-block">
              <div class="survey-question-label">${escHtml(q.question)}</div>
              ${answers.map(a => `<div class="survey-answer">${escHtml(a)}</div>`).join('')}
            </div>`;
        }).join('') : '';

        card.innerHTML = `
      <div class="poll-question">${escHtml(survey.title)}</div>
      <div class="survey-question-label">${qs.length} question${qs.length !== 1 ? 's' : ''} · ${responses.length} response${responses.length !== 1 ? 's' : ''}</div>
      ${responsesHtml ? `<div class="survey-responses">${responsesHtml}</div>` : ''}
      <div class="poll-actions">
        <button class="toggle-pill ${survey.is_active ? 'on' : ''}" type="button" data-survey-id="${survey.id}" data-action="toggle">${survey.is_active ? 'Active' : 'Inactive'}</button>
        <button class="toggle-pill danger" type="button" data-survey-id="${survey.id}" data-action="delete">Delete</button>
      </div>`;
        card.querySelector('[data-action="toggle"]').onclick = async () => {
            try {
                await apiPost('/api/interactions/survey', { action: 'toggle', survey_id: survey.id, is_active: !survey.is_active, stage_id: stage.id }, true);
                loadSurvey(panel, stage);
            } catch { toast('Action failed.', 'error'); }
        };
        card.querySelector('[data-action="delete"]').onclick = async () => {
            if (!confirm('Delete this survey?')) return;
            try {
                await apiPost('/api/interactions/survey', { action: 'delete', survey_id: survey.id, stage_id: stage.id }, true);
                loadSurvey(panel, stage);
            } catch { toast('Action failed.', 'error'); }
        };
        list.appendChild(card);
    });
}

function openNewSurveyForm(panel, stage) {
    const form = document.createElement('div');
    form.className = 'panel-card';
    form.dataset.creationForm = '1';
    form.innerHTML = `
    <div class="form-group"><label class="form-label">Survey Title</label><input class="form-input" id="nsv-title" placeholder="e.g. Session feedback" /></div>
    <div class="form-group"><label class="form-label">Questions (one per line)</label><textarea class="form-input form-textarea" id="nsv-questions" placeholder="How useful was this session?\nWhat could be improved?"></textarea></div>
    <div class="publish-actions"><button class="btn btn-secondary" type="button" id="nsv-cancel">Cancel</button><button class="btn btn-primary" type="button" id="nsv-submit">Create Survey</button></div>`;
    panel.querySelector('#survey-list').prepend(form);
    form.querySelector('#nsv-cancel').onclick = () => form.remove();
    form.querySelector('#nsv-submit').onclick = async () => {
        const title = form.querySelector('#nsv-title').value.trim();
        const questionLines = form.querySelector('#nsv-questions').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
        if (!title || !questionLines.length) return toast('Title and at least one question required.', 'error');
        const questions = questionLines.map(q => ({ question: q, type: 'text' }));
        try {
            await apiPost('/api/interactions/survey', { action: 'create', stage_id: stage.id, title, questions }, true);
            form.remove();
            loadSurvey(panel, stage);
            toast('Survey created!', 'success');
        } catch {
            toast('Failed to create survey.', 'error');
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
        document.getElementById('qr-code-btn').onclick = () => {
            const modal = document.getElementById('qr-modal');
            document.getElementById('qr-modal-url').textContent = url;
            const container = document.getElementById('qr-container');
            container.innerHTML = '';
            const qrCode = new QRCodeStyling({
                width: 220,
                height: 220,
                data: url,
                image: '/SCL-main.png',
                qrOptions: { errorCorrectionLevel: 'H' },
                dotsOptions: { color: '#000000', type: 'square' },
                backgroundOptions: { color: '#ffffff' },
                imageOptions: { crossOrigin: 'anonymous', margin: 6, imageSize: 0.3 },
            });
            qrCode.append(container);
            modal.hidden = false;
            document.getElementById('qr-modal-close').onclick = () => { modal.hidden = true; };
            modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
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

    document.getElementById('delete-stage-btn').onclick = () => {
        const modal = document.getElementById('delete-stage-modal');
        modal.hidden = false;
        const close = () => { modal.hidden = true; };
        document.getElementById('delete-stage-modal-close').onclick = close;
        document.getElementById('delete-stage-cancel').onclick = close;
        modal.onclick = e => { if (e.target === modal) close(); };
        document.getElementById('delete-stage-confirm').onclick = () => {
            close();
            const btn = document.getElementById('delete-stage-btn');
            btn.disabled = true;
            setTimeout(async () => {
                try {
                    const data = await apiPost('/api/stages/delete', {
                        stageId: state.currentStage.id
                    }, true);
                    if (data.error) {
                        toast(data.error, 'error');
                        btn.disabled = false;
                        return;
                    }
                    toast('Stage deleted.', 'success');
                    setTimeout(() => window.location.reload(), 800);
                } catch {
                    toast('Failed to delete stage.', 'error');
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