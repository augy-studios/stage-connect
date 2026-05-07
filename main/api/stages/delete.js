// api/stages/delete.js
const {
    getSupabase
} = require('../../lib/supabase');
const {
    verifySession
} = require('../../lib/auth');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({
        error: 'Method not allowed'
    });
    const user = await verifySession(req);
    if (!user) return res.status(401).json({
        error: 'Unauthorized'
    });

    const { stageId } = req.body || {};
    if (!stageId) return res.status(400).json({
        error: 'stageId is required.'
    });

    const sb = getSupabase();

    const { data: stage } = await sb.from('uwustage_stages').select('id, user_id').eq('id', stageId).single();
    if (!stage || stage.user_id !== user.id) return res.status(403).json({
        error: 'Forbidden'
    });

    const { error } = await sb.from('uwustage_stages').delete().eq('id', stageId);
    if (error) return res.status(500).json({
        error: 'Failed to delete stage.'
    });

    res.status(200).json({ success: true });
};
