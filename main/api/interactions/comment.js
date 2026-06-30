// api/interactions/comment.js
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
        } = await sb.from('uwustage_comments').select('*').eq('stage_id', stageId).eq('is_hidden', false).order('created_at', {
            ascending: false
        }).limit(100);
        return res.status(200).json({
            comments: data || []
        });
    }
    if (req.method === 'POST') {
        const {
            action,
            stageId,
            commentId,
            content,
            authorName,
            voterToken,
            voteType
        } = req.body || {};
        if (action === 'submit') {
            if (!content?.trim()) return res.status(400).json({
                error: 'Content is required.'
            });
            const {
                data
            } = await sb.from('uwustage_comments').insert({
                stage_id: stageId,
                content: content.trim(),
                author_name: authorName || 'Anonymous'
            }).select().single();
            return res.status(201).json({
                comment: data
            });
        }
        if (action === 'vote') {
            if (!['up', 'down'].includes(voteType)) return res.status(400).json({
                error: 'Invalid vote.'
            });
            await sb.from('uwustage_comment_votes').upsert({
                comment_id: commentId,
                voter_token: voterToken,
                vote_type: voteType
            }, {
                onConflict: 'comment_id,voter_token'
            });
            const {
                data: votes
            } = await sb.from('uwustage_comment_votes').select('vote_type').eq('comment_id', commentId);
            const upvotes = votes?.filter(v => v.vote_type === 'up').length || 0;
            const downvotes = votes?.filter(v => v.vote_type === 'down').length || 0;
            await sb.from('uwustage_comments').update({
                upvotes,
                downvotes
            }).eq('id', commentId);
            return res.status(200).json({
                success: true
            });
        }
        if (action === 'hide') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({
                error: 'Unauthorized'
            });
            await sb.from('uwustage_comments').update({
                is_hidden: true
            }).eq('id', commentId);
            return res.status(200).json({
                success: true
            });
        }
    }
    res.status(405).json({
        error: 'Method not allowed'
    });
};