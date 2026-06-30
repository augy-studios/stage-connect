// api/stages/create.js
const {
    getSupabase
} = require('../../lib/supabase');
const {
    verifySession
} = require('../../lib/auth');
const {
    verifySignedRequest
} = require('../../lib/uwu-request-signing-server');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({
        error: 'Method not allowed'
    });
    const sig = await verifySignedRequest(req, getSupabase());
    if (!sig.valid) return res.status(403).json({
        error: sig.reason
    });
    const user = await verifySession(req);
    if (!user) return res.status(401).json({
        error: 'Unauthorized'
    });

    const {
        title,
        description,
        features
    } = req.body || {};
    if (!title?.trim()) return res.status(400).json({
        error: 'Title is required.'
    });

    const allowed = ['poll', 'wordcloud', 'qa', 'quiz', 'survey', 'reaction', 'chat', 'comment'];
    const safeFeatures = (features || []).filter(f => allowed.includes(f));

    const sb = getSupabase();
    const {
        data: stage,
        error
    } = await sb
        .from('uwustage_stages')
        .insert({
            user_id: user.id,
            title: title.trim(),
            description: (description || '').trim(),
            features: safeFeatures
        })
        .select()
        .single();

    if (error) return res.status(500).json({
        error: 'Failed to create stage.'
    });
    res.status(201).json({
        stage
    });
};