// api/interactions/wordcloud.js
const {
    getSupabase
} = require('../../lib/supabase');
const {
    verifySession
} = require('../../lib/auth');
const {
    handleCors
} = require('../../lib/cors');
const {
    verifySignedRequest
} = require('../../lib/uwu-request-signing-server');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    const sb = getSupabase();
    const sig = await verifySignedRequest(req, sb);
    if (!sig.valid) return res.status(403).json({
        error: sig.reason
    });
    if (req.method === 'GET') {
        const {
            stageId
        } = req.query;
        const {
            data
        } = await sb.from('uwustage_wordcloud').select('word').eq('stage_id', stageId).order('created_at', {
            ascending: false
        }).limit(500);
        return res.status(200).json({
            words: data || []
        });
    }
    if (req.method === 'POST') {
        const {
            action,
            stageId,
            word,
            submitterToken
        } = req.body || {};
        if (action === 'submit') {
            const clean = (word || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!clean || clean.length < 2 || clean.length > 30) return res.status(400).json({
                error: 'Word must be 2–30 letters.'
            });
            await sb.from('uwustage_wordcloud').insert({
                stage_id: stageId,
                word: clean,
                submitter_token: submitterToken
            });
            return res.status(201).json({
                success: true
            });
        }
        if (action === 'clear') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({
                error: 'Unauthorized'
            });
            await sb.from('uwustage_wordcloud').delete().eq('stage_id', stageId);
            return res.status(200).json({
                success: true
            });
        }
    }
    res.status(405).json({
        error: 'Method not allowed'
    });
};