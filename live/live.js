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
    answeredSurveys: {},
    realtimeChannel: null,
    activeTab: null
};

const FEATURE_META = {
    poll: { label: 'Polls', icon: 'poll' },
    wordcloud: { label: 'Cloud', icon: 'wordcloud' },
    qa: { label: 'Q&A', icon: 'qa' },
    quiz: { label: 'Quiz', icon: 'quiz' },
    survey: { label: 'Survey', icon: 'survey' },
    reaction: { label: 'React', icon: 'reaction' },
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
    survey(panel, stage) { loadLiveSurveys(panel, stage.id); },
    quiz(panel, stage) {
        if (document.getElementById('quiz-timer')) return;
        loadLiveQuiz(panel, stage.id);
    },
};

function startLivePolling(stage) {
    setInterval(() => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
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
        btn.type = 'button';
        btn.innerHTML = `<span data-icon="${m.icon}"></span><span class="tab-label">${m.label}</span>`;
        btn.onclick = () => activateTab(f);
        nav.appendChild(btn);
    });
    hydrateIcons(nav);
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
        panel.innerHTML = '<div class="panel-empty tight">Loading polls...</div>';
        const data = await liveGet(`/api/interactions/poll?stageId=${stage.id}`);
        const polls = (data.polls || []).filter(p => p.is_active);
        panel.innerHTML = '';
        if (!polls.length) {
            panel.innerHTML = '<div class="panel-empty">No active polls yet. Check back soon!</div>';
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
            return `<div class="poll-option" data-poll="${poll.id}" data-opt="${o.id}" onclick="castVote('${poll.id}','${o.id}',this.closest('.panel-card'))">
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
            <button class="btn btn-primary" type="button" onclick="submitWord('${stage.id}')">Submit</button>
          </div>
        </div>
        <div class="wc-cloud" id="wc-cloud"><span class="wc-hint">Words will appear here</span></div>
      </div>`;
        loadLiveWordCloud(stage.id);
    },

    async qa(panel, stage) {
            panel.innerHTML = `
      <div class="panel-card qa-submit">
        <div class="form-group"><label class="form-label">Ask a question</label>
          <textarea class="form-input form-textarea" id="qa-q" placeholder="Your question..."></textarea>
        </div>
        <button class="btn btn-primary" type="button" onclick="submitQuestion('${stage.id}')">Submit Question</button>
      </div>
      <div id="qa-live-list"></div>`;
            loadLiveQA(stage.id, panel);
        },

        async quiz(panel, stage) {
                panel.innerHTML = '<div class="panel-empty">Waiting for quiz to start...</div>';
                loadLiveQuiz(panel, stage.id);
            },

            async survey(panel, stage) {
                panel.innerHTML = '<div class="panel-empty">Loading surveys...</div>';
                loadLiveSurveys(panel, stage.id);
            },

            async reaction(panel, stage) {
                    const data = await liveGet(`/api/interactions/reaction?stageId=${stage.id}`);
                    const counts = {};
                    (data.reactions || []).forEach(r => {
                        counts[r.reaction_type] = r.count;
                    });
                    panel.innerHTML = `
      <div class="panel-card">
        <p class="panel-note">Tap or hold to react!</p>
        <div class="reactions-live">
          ${REACTIONS.map(r => `
            <button class="reaction-live-btn" type="button"
              onpointerdown="startReaction('${stage.id}','${r.type}',this)"
              onpointerup="stopReaction()"
              onpointerleave="stopReaction()"
              onpointercancel="stopReaction()">
              <span data-icon="${r.type}"></span>
              <span>${r.label}</span>
              <span class="reaction-live-count" id="rxn-live-${r.type}">${counts[r.type] || 0}</span>
            </button>`).join('')}
        </div>
      </div>`;
                    hydrateIcons(panel);
                },

                async chat(panel, stage) {
                        panel.innerHTML = `
      <div class="panel-card">
        <div class="chat-messages" id="live-chat-msgs"></div>
        <div class="chat-send-row">
          <input class="form-input" id="live-chat-input" placeholder="Type a message..." maxlength="300" />
          <button class="btn btn-primary" type="button" onclick="sendChat('${stage.id}')">Send</button>
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
        <button class="btn btn-primary" type="button" onclick="submitComment('${stage.id}')">Post Comment</button>
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
    if (!Object.keys(freq).length) cloud.innerHTML = '<span class="wc-hint">No words yet</span>';
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
        list.innerHTML = '<div class="panel-empty tight">No questions yet. Be the first!</div>';
        return;
    }
    list.innerHTML = '';
    qs.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).forEach(q => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="qa-card">
        <div class="qa-vote-col">
          <button class="vote-btn" type="button" onclick="voteQA('${q.id}','up')">
            <span data-icon="chevron-up"></span>
          </button>
          <span class="vote-count">${q.upvotes - q.downvotes}</span>
          <button class="vote-btn" type="button" onclick="voteQA('${q.id}','down')">
            <span data-icon="chevron-down"></span>
          </button>
        </div>
        <div class="qa-body">
          <div class="qa-text">${escHtml(q.question)}</div>
          <div class="qa-meta">${escHtml(q.author_name || 'Anonymous')}${q.is_pinned ? ' · Pinned' : ''}${q.is_answered ? ' · Answered' : ''}</div>
        </div>
      </div>`;
        list.appendChild(card);
    });
    hydrateIcons(list);
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

let _rxnHoldTimeout = null;
let _rxnHoldInterval = null;

function startReaction(stageId, reactionType, btn) {
    sendReaction(stageId, reactionType, btn);
    _rxnHoldTimeout = setTimeout(() => {
        _rxnHoldInterval = setInterval(() => sendReaction(stageId, reactionType, btn), 200);
    }, 500);
}

function stopReaction() {
    clearTimeout(_rxnHoldTimeout);
    clearInterval(_rxnHoldInterval);
    _rxnHoldTimeout = null;
    _rxnHoldInterval = null;
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
    div.innerHTML = `<div class="chat-msg-author">${escHtml(m.author_name || 'Anonymous')}</div><div class="chat-msg-text">${escHtml(m.message)}</div>`;
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

async function loadLiveSurveys(panel, stageId) {
    const data = await liveGet(`/api/interactions/survey?action=list&stage_id=${stageId}`);
    const active = (data.surveys || []).filter(s => s.is_active);
    if (!active.length) {
        panel.innerHTML = '<div class="panel-empty">No active surveys right now. Check back soon!</div>';
        return;
    }
    panel.innerHTML = '';
    active.forEach(survey => {
        const alreadyDone = state.answeredSurveys?.[survey.id];
        const card = document.createElement('div');
        card.className = 'panel-card';
        if (alreadyDone) {
            card.innerHTML = `<div class="survey-done"><strong>${escHtml(survey.title)}</strong><p>Response submitted. Thank you!</p></div>`;
        } else {
            const questions = survey.questions || [];
            card.innerHTML = `
        <div class="poll-question">${escHtml(survey.title)}</div>
        <div id="survey-form-${survey.id}">
          ${questions.map((q, i) => `
            <div class="form-group survey-question">
              <label class="form-label">${escHtml(q.question)}</label>
              <input class="form-input" id="sq-${survey.id}-${i}" placeholder="Your answer..." />
            </div>`).join('')}
        </div>
        <button class="btn btn-primary survey-submit" type="button" onclick="submitSurvey('${survey.id}',${questions.length})">Submit</button>`;
        }
        panel.appendChild(card);
    });
}

async function submitSurvey(surveyId, questionCount) {
    const answers = [];
    for (let i = 0; i < questionCount; i++) {
        const el = document.getElementById(`sq-${surveyId}-${i}`);
        answers.push(el ? el.value.trim() : '');
    }
    if (answers.every(a => !a)) return toast('Please answer at least one question.', 'error');
    const result = await livePost('/api/interactions/survey', {
        action: 'respond',
        survey_id: surveyId,
        responder_token: state.playerToken,
        answers
    });
    if (result.error) return toast(result.error === 'Already responded' ? 'You already submitted this survey.' : 'Failed to submit. Please try again.', 'error');
    if (!state.answeredSurveys) state.answeredSurveys = {};
    state.answeredSurveys[surveyId] = true;
    toast('Survey submitted! Thank you.', 'success');
    const panel = document.querySelector('.live-panel[data-panel="survey"]');
    if (panel) loadLiveSurveys(panel, state.stage.id);
}

async function loadLiveQuiz(panel, stageId) {
    const data = await liveGet(`/api/interactions/quiz?stageId=${stageId}`);
    const active = (data.questions || []).filter(q => q.is_active && !state.answeredQuiz[q.id]);
    if (!active.length) {
        panel.innerHTML = '<div class="panel-empty">No active quiz question. Stay tuned!</div>';
        return;
    }
    const q = active[0];
    panel.innerHTML = `
    <div class="panel-card">
      <div class="quiz-timer" id="quiz-timer">${q.time_limit_seconds}s</div>
      <div class="quiz-question">${escHtml(q.question)}</div>
      <div id="quiz-options">
        ${(q.options||[]).map(o => `<div class="poll-option quiz-option" onclick="answerQuiz('${q.id}','${o.id}',this.closest('.panel-card'))">
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
        list.innerHTML = '<div class="panel-empty tight">No comments yet.</div>';
        return;
    }
    list.innerHTML = '';
    comments.forEach(c => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.innerHTML = `
      <div class="comment-card">
        <div class="comment-body">
          <div class="comment-text">${escHtml(c.content)}</div>
          <div class="comment-author">${escHtml(c.author_name||'Anonymous')}</div>
        </div>
        <div class="comment-votes">
          <button class="vote-btn" type="button" onclick="voteComment('${c.id}','up')">
            <span data-icon="chevron-up"></span>
            ${c.upvotes}
          </button>
          <button class="vote-btn" type="button" onclick="voteComment('${c.id}','down')">
            <span data-icon="chevron-down"></span>
            ${c.downvotes}
          </button>
        </div>
      </div>`;
        list.appendChild(card);
    });
    hydrateIcons(list);
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
window.submitSurvey = submitSurvey;
window.submitComment = submitComment;
window.voteComment = voteComment;