// api/interactions/reaction.js
const {
    getSupabase
} = require('../../lib/supabase');

const ALLOWED = ['heart', 'fire', 'clap', 'wow', 'laugh'];

module.exports = async (req, res) => {
    const sb = getSupabase();
    if (req.method === 'GET') {
        const {
            stageId
        } = req.query;
        const {
            data
        } = await sb.from('uwustage_reactions').select('reaction_type').eq('stage_id', stageId);
        const counts = {};
        ALLOWED.forEach(r => {
            counts[r] = 0;
        });
        (data || []).forEach(r => {
            if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++;
        });
        const reactions = Object.entries(counts).map(([reaction_type, count]) => ({
            reaction_type,
            count
        }));
        return res.status(200).json({
            reactions
        });
    }
    if (req.method === 'POST') {
        const {
            stageId,
            reactionType,
            reactorToken
        } = req.body || {};
        if (!ALLOWED.includes(reactionType)) return res.status(400).json({
            error: 'Invalid reaction type.'
        });
        await sb.from('uwustage_reactions').insert({
            stage_id: stageId,
            reaction_type: reactionType,
            reactor_token: reactorToken
        });
        return res.status(201).json({
            success: true
        });
    }
    res.status(405).json({
        error: 'Method not allowed'
    });
};