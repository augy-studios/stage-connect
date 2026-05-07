const MAIN_API = 'https://stage.uwuapps.org';
const SUPABASE_URL = ''; // Set at build time or via env injection

const state = {
    stage: null,
    slug: null,
    playerName: '',
    playerToken: null,
    votedPolls: {},
    votedQA: {},
    votedComments: {},
    answeredQuiz: {},
    realtimeChannel: null,
    activeTab: null
};

const FEATURE_META = {
    poll: {
        label: 'Polls',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
    },
    wordcloud: {
        label: 'Cloud',
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
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>'
    },
    reaction: {
        label: 'React',
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

// ───── INIT ─────
document.addEventListener('DOMContentLoaded', () => {
    state.playerToken = getOrCreateToken();
    state.slug = getSlug();

    if (!state.slug) {
        window.location.href = '/';
        return;
    }

    loadStage(state.slug);
});

function getSlug() {
    const path = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    return path || null;
}

function getOrCreateToken() {
    let t = localStorage.getItem('sc-live-token');
    if (!t) {
        t = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('sc-live-token', t);
    }
    return t;
}

// ───── LOAD STAGE ─────
async function loadStage(slug) {
    try {
        const res = await fetch(`/api/stage/${slug}`);
        const data = await res.json();
        if (!data.stage) {
            showNotFound();
            return;
        }
        state.stage = data.stage;
        document.getElementById('stage-title-display').textContent = data.stage.title;

        // Show name prompt
        document.getElementById('name-prompt-title').textContent = data.stage.title;
        document.getElementById('name-prompt').hidden = false;
        document.getElementById('name-join-btn').onclick = joinStage;
        document.getElementById('name-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') joinStage();
        });
    } catch {
        showNotFound();
    }
}

function showNotFound() {
    document.getElementById('not-found').hidden = false;
}

function joinStage() {
    state.playerName = document.getElementById('name-input').value.trim() || 'Anonymous';
    localStorage.setItem('sc-live-name', state.playerName);
    document.getElementById('name-prompt').hidden = true;
    initLiveUI(state.stage);
}

// ───── LIVE UI ─────
function initLiveUI(stage) {
    document.getElementById('live-main').hidden = false;
    const features = stage.features || [];
    buildTabs(features);
    buildLivePanels(features, stage);
    if (features.length) activateTab(features[0]);
    startLivePolling(stage);
}

const liveRefreshers = {
    poll(panel, stage) {
        liveGet(`/api/interactions/poll?stageId=${stage.id}`).then(data => {
            (data.polls || []).filter(p => p.is_active).forEach(poll => {
                const hasVoted = state.votedPolls[poll.id];
                if (!hasVoted) return;
                const container = document.getElementById(`poll-opts-${poll.id}`);
                if (!container) return;
                const total = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
                container.innerHTML = poll.options.map(o => {
                    const pct = total ? Math.round((o.votes || 0) / total * 100) : 0;
                    return `<div class="poll-option ${hasVoted === o.id ? 'voted' : ''}">
                        <span class="poll-option-text">${escHtml(o.text)}</span>
                        <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
                        <span class="poll-pct">${pct}%</span>
                    </div>`;
                }).join('');
            });
        });
    },
    wordcloud(panel, stage) { loadLiveWordCloud(stage.id); },
    qa(panel, stage) { loadLiveQA(stage.id, panel); },
    reaction(panel, stage) {
        liveGet(`/api/interactions/reaction?stageId=${stage.id}`).then(data => {
            (data.reactions || []).forEach(r => {
                const el = document.getElementById(`rxn-live-${r.reaction_type}`);
                if (el) el.textContent = r.count;
            });
        });
    },
    chat(panel, stage) { loadLiveChat(stage.id); },
    comment(panel, stage) { loadLiveComments(stage.id, panel); },
    quiz(panel, stage) {
        if (document.getElementById('quiz-timer')) return;
        loadLiveQuiz(panel, stage.id);
    },
};

function startLivePolling(stage) {
    setInterval(() => {
        const f = state.activeTab;
        if (!f || !liveRefreshers[f]) return;
        const panel = document.querySelector(`.live-panel[data-panel="${f}"]`);
        if (panel) liveRefreshers[f](panel, stage);
    }, 5000);
}

function buildTabs(features) {
    const nav = document.getElementById('live-tabs');
    nav.innerHTML = '';
    features.forEach(f => {
        const m = FEATURE_META[f];
        if (!m) return;
        const btn = document.createElement('button');
        btn.className = 'live-tab';
        btn.dataset.tab = f;
        btn.innerHTML = m.icon + `<span class="tab-label">${m.label}</span>`;
        btn.onclick = () => activateTab(f);
        nav.appendChild(btn);
    });
}

function activateTab(f) {
    state.activeTab = f;
    document.querySelectorAll('.live-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === f));
    document.querySelectorAll('.live-panel').forEach(p => p.hidden = p.dataset.panel !== f);
}

function buildLivePanels(features, stage) {
    document.querySelectorAll('.live-panel').forEach(p => p.innerHTML = '');
    features.forEach(f => {
        const panel = document.querySelector(`.live-panel[data-panel="${f}"]`);
        if (panel && livePanelBuilders[f]) livePanelBuilders[f](panel, stage);
    });
}

// ───── LIVE PANEL BUILDERS ─────
const livePanelBuilders = {

async poll(panel, stage) {
        panel.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;text-align:center;padding:20px">Loading polls...</p>';
        const data = await liveGet(`/api/interactions/poll?stageId=${stage.id}`);
        const polls = (data.polls || []).filter(p => p.is_active);
        panel.innerHTML = '';
        if (!polls.length) {
            panel.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No active polls yet. Check back soon!</div>';
            return;
        }
        polls.forEach(poll => {
            const totalVotes = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
            const hasVoted = state.votedPolls[poll.id];
            const card = document.createElement('div');
            card.className = 'panel-card';
            card.innerHTML = `<div class="poll-question">${escHtml(poll.question)}</div>
        <div id="poll-opts-${poll.id}">
          ${poll.options.map(o => {
            const pct = totalVotes ? Math.round((o.votes||0)/totalVotes*100) : 0;
            if (hasVoted) {
              return `<div class="poll-option ${hasVoted === o.id ? 'voted' : ''}">
                <span class="poll-option-text">${escHtml(o.text)}</span>
                <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
                <span class="poll-pct">${pct}%</span>
              </div>`;
            }
            return `<div class="poll-option" data-poll="${poll.id}" data-opt="${o.id}" style="cursor:pointer" onclick="castVote('${poll.id}','${o.id}',this.closest('.panel-card'))">
                <span class="poll-option-text">${escHtml(o.text)}</span>
              </div>`;
        }).join('')}
        </div>`;
panel.appendChild(card);
});
},

async wordcloud(panel, stage) {
        panel.innerHTML = `
      <div class="panel-card">
        <div class="form-group"><label class="form-label">Submit a word</label>
          <div class="wc-input-row">
            <input class="form-input" id="wc-word" placeholder="One word..." maxlength="30" onkeydown="if(event.key==='Enter')submitWord('${stage.id}')" />
            <button class="btn btn-primary" onclick="submitWord('${stage.id}')">Submit</button>
          </div>
        </div>
        <div class="wc-cloud" id="wc-cloud"><span style="color:var(--text-faint);font-size:0.85rem">Words will appear here</span></div>
      </div>`;
        loadLiveWordCloud(stage.id);
    },

    async qa(panel, stage) {
            panel.innerHTML = `
      <div class="panel-card qa-submit">
        <div class="form-group"><label class="form-label">Ask a question</label>
          <textarea class="form-input form-textarea" id="qa-q" placeholder="Your question..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="submitQuestion('${stage.id}')">Submit Question</button>
      </div>
      <div id="qa-live-list"></div>`;
            loadLiveQA(stage.id, panel);
        },

        async quiz(panel, stage) {
                panel.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Waiting for quiz to start...</div>';
                loadLiveQuiz(panel, stage.id);
            },

            survey(panel, stage) {
                panel.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Survey coming soon in this session.</div>';
            },

            async reaction(panel, stage) {
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
                            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v1m0 0v1m0-1h1m-1 0H7M5 8l1-1m1 1-1-1M5 8l1 1M5 8H4"/></svg>'
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
                    const data = await liveGet(`/api/interactions/reaction?stageId=${stage.id}`);
                    const counts = {};
                    (data.reactions || []).forEach(r => {
                        counts[r.reaction_type] = r.count;
                    });
                    panel.innerHTML = `
      <div class="panel-card">
        <p style="text-align:center;color:var(--text-muted);font-size:0.88rem;margin-bottom:16px">Tap to react!</p>
        <div class="reactions-live">
          ${reactions.map(r => `
            <button class="reaction-live-btn" onclick="sendReaction('${stage.id}','${r.type}',this)">
              ${r.svg}
              <span>${r.label}</span>
              <span class="reaction-live-count" id="rxn-live-${r.type}">${counts[r.type] || 0}</span>
            </button>`).join('')}
        </div>
      </div>`;
                },

                async chat(panel, stage) {
                        panel.innerHTML = `
      <div class="panel-card">
        <div class="chat-messages" id="live-chat-msgs"></div>
        <div class="chat-send-row">
          <input class="form-input" id="live-chat-input" placeholder="Type a message..." maxlength="300" style="flex:1" />
          <button class="btn btn-primary" onclick="sendChat('${stage.id}')">Send</button>
        </div>
      </div>`;
                        document.getElementById('live-chat-input').addEventListener('keydown', e => {
                            if (e.key === 'Enter') sendChat(stage.id);
                        });
                        loadLiveChat(stage.id);
                    },

                    async comment(panel, stage) {
                        panel.innerHTML = `
      <div class="panel-card">
        <div class="form-group"><label class="form-label">Leave a comment</label>
          <textarea class="form-input form-textarea" id="live-comment-text" placeholder="Your comment..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="submitComment('${stage.id}')">Post Comment</button>
      </div>
      <div id="live-comments-list"></div>`;
                        loadLiveComments(stage.id, panel);
                    }
};

// ───── ACTIONS ─────
async function castVote(pollId, optionId, card) {
    if (state.votedPolls[pollId]) return;
    state.votedPolls[pollId] = optionId;
    const result = await livePost('/api/interactions/poll', {
        action: 'vote',
        pollId,
        optionId,
        voterToken: state.playerToken
    });
    if (result.error) {
        delete state.votedPolls[pollId];
        return toast('Vote failed. Please try again.', 'error');
    }
    toast('Vote cast!', 'success');
    // Refresh this poll
    const data = await liveGet(`/api/interactions/poll?stageId=${state.stage.id}`);
    const poll = (data.polls || []).find(p => p.id === pollId);
    if (!poll) return;
    const total = poll.options.reduce((s, o) => s + (o.votes || 0), 0);
    const container = card.querySelector(`#poll-opts-${pollId}`);
    if (!container) return;
    container.innerHTML = poll.options.map(o => {
        const pct = total ? Math.round((o.votes || 0) / total * 100) : 0;
        return `<div class="poll-option ${o.id === optionId ? 'voted' : ''}">
      <span class="poll-option-text">${escHtml(o.text)}</span>
      <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
      <span class="poll-pct">${pct}%</span>
    </div>`;
    }).join('');
}

async function submitWord(stageId) {
    const input = document.getElementById('wc-word');
    const word = input.value.trim();
    if (!word) return;
    await livePost('/api/interactions/wordcloud', {
        action: 'submit',
        stageId,
        word,
        submitterToken: state.playerToken
    });
    input.value = '';
    toast('Word submitted!', 'success');
    loadLiveWordCloud(stageId);
}

async function loadLiveWordCloud(stageId) {
    const data = await liveGet(`/api/interactions/wordcloud?stageId=${stageId}`);
    const cloud = document.getElementById('wc-cloud');
    if (!cloud) return;
    const freq = {};
    (data.words || []).forEach(w => {
        freq[w.word] = (freq[w.word] || 0) + 1;
    });
    const max = Math.max(...Object.values(freq), 1);
    cloud.innerHTML = '';
    Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([word, count]) => {
        const size = 0.8 + (count / max) * 1.6;
        const span = document.createElement('span');
        span.className = 'cloud-word';
        span.textContent = word;
        span.style.fontSize = size + 'rem';
        span.style.opacity = 0.5 + (count / max) * 0.5;
        cloud.appendChild(span);
    });
    if (!Object.keys(freq).length) cloud.innerHTML = '<span style="color:var(--text-faint);font-size:0.85rem">No words yet</span>';
}

async function submitQuestion(stageId) {
    const q = document.getElementById('qa-q')?.value.trim();
    if (!q) return toast('Please enter a question.', 'error');
    await livePost('/api/interactions/qa', {
        action: 'submit',
        stageId,
        question: q,
        authorName: state.playerName
    });
    document.getElementById('qa-q').value = '';
    toast('Question submitted!', 'success');
    loadLiveQA(stageId, document.querySelector('.live-panel[data-panel="qa"]'));
}

async function loadLiveQA(stageId, panel) {
    const data = await liveGet(`/api/interactions/qa?stageId=${stageId}`);
    const list = panel?.querySelector('#qa-live-list') || document.getElementById('qa-live-list');
    if (!list) return;
    const qs = data.questions || [];
    if (!qs.length) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">No questions yet. Be the first!</div>';
        return;
    }
    list.innerHTML = '';
    qs.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).forEach(q => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="qa-card">
        <div class="qa-vote-col">
          <button class="vote-btn" onclick="voteQA('${q.id}','up')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="18,15 12,9 6,15"/></svg>
          </button>
          <span class="vote-count">${q.upvotes - q.downvotes}</span>
          <button class="vote-btn" onclick="voteQA('${q.id}','down')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="6,9 12,15 18,9"/></svg>
          </button>
        </div>
        <div class="qa-body">
          <div class="qa-text">${escHtml(q.question)}</div>
          <div class="qa-meta">${escHtml(q.author_name || 'Anonymous')}${q.is_pinned ? ' · Pinned' : ''}${q.is_answered ? ' · Answered' : ''}</div>
        </div>
      </div>`;
        list.appendChild(card);
    });
}

async function voteQA(qaId, voteType) {
    if (state.votedQA[qaId]) return;
    state.votedQA[qaId] = voteType;
    await livePost('/api/interactions/qa', {
        action: 'vote',
        qaId,
        voterToken: state.playerToken,
        voteType
    });
    toast('Vote registered!', 'success');
    loadLiveQA(state.stage.id, document.querySelector('.live-panel[data-panel="qa"]'));
}

async function sendReaction(stageId, reactionType, btn) {
    await livePost('/api/interactions/reaction', {
        stageId,
        reactionType,
        reactorToken: state.playerToken
    });
    const count = document.getElementById(`rxn-live-${reactionType}`);
    if (count) count.textContent = parseInt(count.textContent || '0') + 1;
    btn.style.transform = 'scale(1.2)';
    setTimeout(() => {
        btn.style.transform = '';
    }, 200);
}

async function loadLiveChat(stageId) {
    const data = await liveGet(`/api/interactions/chat?stageId=${stageId}`);
    const msgs = document.getElementById('live-chat-msgs');
    if (!msgs) return;
    msgs.innerHTML = '';
    (data.messages || []).forEach(m => appendLiveChatMsg(m));
}

function appendLiveChatMsg(m) {
    const msgs = document.getElementById('live-chat-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<div class="chat-msg-author">${escHtml(m.author_name || 'Anonymous')}</div><div style="font-size:0.88rem;color:var(--text)">${escHtml(m.message)}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

async function sendChat(stageId) {
    const input = document.getElementById('live-chat-input');
    const msg = input?.value.trim();
    if (!msg) return;
    await livePost('/api/interactions/chat', {
        action: 'send',
        stageId,
        message: msg,
        authorName: state.playerName
    });
    input.value = '';
    loadLiveChat(stageId);
}

async function loadLiveQuiz(panel, stageId) {
    const data = await liveGet(`/api/interactions/quiz?stageId=${stageId}`);
    const active = (data.questions || []).filter(q => q.is_active && !state.answeredQuiz[q.id]);
    if (!active.length) {
        panel.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No active quiz question. Stay tuned!</div>';
        return;
    }
    const q = active[0];
    panel.innerHTML = `
    <div class="panel-card">
      <div class="quiz-timer" id="quiz-timer">${q.time_limit_seconds}s</div>
      <div class="quiz-question">${escHtml(q.question)}</div>
      <div id="quiz-options">
        ${(q.options||[]).map(o => `<div class="poll-option" style="cursor:pointer;margin-bottom:8px" onclick="answerQuiz('${q.id}','${o.id}',this.closest('.panel-card'))">
          <span class="poll-option-text">${escHtml(o.text)}</span>
        </div>`).join('')}
      </div>
    </div>`;
    startQuizTimer(q.time_limit_seconds, q.id, panel, stageId);
}

function startQuizTimer(seconds, quizId, panel, stageId) {
    let s = seconds;
    const el = document.getElementById('quiz-timer');
    const interval = setInterval(() => {
        s--;
        if (el) el.textContent = s + 's';
        if (s <= 0) {
            clearInterval(interval);
            if (!state.answeredQuiz[quizId]) {
                state.answeredQuiz[quizId] = 'timeout';
                panel.innerHTML = '<div class="panel-card"><div class="quiz-result wrong"><div class="quiz-score">Time\'s up!</div><p>You didn\'t answer in time.</p></div></div>';
            }
        }
    }, 1000);
}

async function answerQuiz(quizId, chosenOptionId, card) {
    if (state.answeredQuiz[quizId]) return;
    state.answeredQuiz[quizId] = chosenOptionId;
    const data = await livePost('/api/interactions/quiz', {
        action: 'answer',
        quizId,
        chosenOptionId,
        playerToken: state.playerToken,
        playerName: state.playerName
    });
    card.innerHTML = `<div class="quiz-result ${data.correct ? 'correct' : 'wrong'}">
    <div class="quiz-score">${data.correct ? 'Correct!' : 'Wrong!'}</div>
    <p>${data.correct ? '+' + data.points + ' points' : 'Better luck next time!'}</p>
  </div>`;
}

async function submitComment(stageId) {
    const content = document.getElementById('live-comment-text')?.value.trim();
    if (!content) return toast('Please write a comment.', 'error');
    await livePost('/api/interactions/comment', {
        action: 'submit',
        stageId,
        content,
        authorName: state.playerName
    });
    document.getElementById('live-comment-text').value = '';
    toast('Comment posted!', 'success');
    loadLiveComments(stageId, document.querySelector('.live-panel[data-panel="comment"]'));
}

async function loadLiveComments(stageId, panel) {
    const data = await liveGet(`/api/interactions/comment?stageId=${stageId}`);
    const list = panel?.querySelector('#live-comments-list') || document.getElementById('live-comments-list');
    if (!list) return;
    const comments = data.comments || [];
    if (!comments.length) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">No comments yet.</div>';
        return;
    }
    list.innerHTML = '';
    comments.forEach(c => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="comment-card">
        <div style="flex:1">
          <div style="font-size:0.9rem;color:var(--text);margin-bottom:4px">${escHtml(c.content)}</div>
          <div style="font-size:0.75rem;color:var(--text-faint)">${escHtml(c.author_name||'Anonymous')}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
          <button class="vote-btn" onclick="voteComment('${c.id}','up')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="18,15 12,9 6,15"/></svg>
            ${c.upvotes}
          </button>
          <button class="vote-btn" onclick="voteComment('${c.id}','down')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="6,9 12,15 18,9"/></svg>
            ${c.downvotes}
          </button>
        </div>
      </div>`;
        list.appendChild(card);
    });
}

async function voteComment(commentId, voteType) {
    if (state.votedComments[commentId]) return;
    state.votedComments[commentId] = voteType;
    await livePost('/api/interactions/comment', {
        action: 'vote',
        commentId,
        voterToken: state.playerToken,
        voteType
    });
    loadLiveComments(state.stage.id, document.querySelector('.live-panel[data-panel="comment"]'));
}

// ───── HTTP HELPERS ─────
async function liveGet(path) {
    try {
        const res = await fetch(MAIN_API + path);
        return res.json();
    } catch {
        return {};
    }
}

async function livePost(path, body) {
    try {
        const res = await fetch(MAIN_API + path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return res.json();
    } catch {
        return {};
    }
}

// ───── TOAST ─────
function toast(msg, type = 'info', duration = 3000) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 300);
    }, duration);
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Make actions global (called from inline onclick)
window.castVote = castVote;
window.submitWord = submitWord;
window.submitQuestion = submitQuestion;
window.voteQA = voteQA;
window.sendReaction = sendReaction;
window.sendChat = sendChat;
window.answerQuiz = answerQuiz;
window.submitComment = submitComment;
window.voteComment = voteComment;