// api/interactions/poll.js
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
const crypto = require('crypto');

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
        if (!stageId) return res.status(400).json({
            error: 'stageId required'
        });
        const {
            data: polls
        } = await sb.from('uwustage_polls').select('*').eq('stage_id', stageId).order('created_at', {
            ascending: false
        });
        return res.status(200).json({
            polls: polls || []
        });
    }

    if (req.method === 'POST') {
        const {
            action,
            stageId,
            pollId,
            question,
            options
        } = req.body || {};

        // Public vote (no auth)
        if (action === 'vote') {
            const {
                optionId,
                voterToken
            } = req.body;
            if (!pollId || !optionId || !voterToken) return res.status(400).json({
                error: 'Missing fields'
            });
            const {
                error
            } = await sb.from('uwustage_poll_votes').upsert({
                poll_id: pollId,
                option_id: optionId,
                voter_token: voterToken
            }, {
                onConflict: 'poll_id,voter_token'
            });
            if (error) return res.status(500).json({
                error: 'Vote failed'
            });
            // Recount votes from the votes table and update the poll options
            const { data: pollRow } = await sb.from('uwustage_polls').select('options').eq('id', pollId).single();
            const { data: allVotes } = await sb.from('uwustage_poll_votes').select('option_id').eq('poll_id', pollId);
            const voteCounts = {};
            (allVotes || []).forEach(v => { voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1; });
            const updatedOptions = (pollRow?.options || []).map(o => ({ ...o, votes: voteCounts[o.id] || 0 }));
            await sb.from('uwustage_polls').update({ options: updatedOptions }).eq('id', pollId);
            return res.status(200).json({
                success: true
            });
        }

        // Auth required for manage actions
        const user = await verifySession(req);
        if (!user) return res.status(401).json({
            error: 'Unauthorized'
        });

        if (action === 'create') {
            if (!question || !options?.length || options.length < 2) return res.status(400).json({
                error: 'Question and at least 2 options required.'
            });
            const opts = options.map(text => ({
                id: crypto.randomBytes(8).toString('hex'),
                text,
                votes: 0
            }));
            const {
                data,
                error
            } = await sb.from('uwustage_polls').insert({
                stage_id: stageId,
                question,
                options: opts
            }).select().single();
            if (error) return res.status(500).json({
                error: 'Failed to create poll.'
            });
            return res.status(201).json({
                poll: data
            });
        }

        if (action === 'toggle') {
            const {
                data: poll
            } = await sb.from('uwustage_polls').select('is_active').eq('id', pollId).single();
            await sb.from('uwustage_polls').update({
                is_active: !poll?.is_active
            }).eq('id', pollId);
            return res.status(200).json({
                success: true
            });
        }

        if (action === 'delete') {
            await sb.from('uwustage_polls').delete().eq('id', pollId);
            return res.status(200).json({
                success: true
            });
        }
    }

    res.status(405).json({
        error: 'Method not allowed'
    });
};