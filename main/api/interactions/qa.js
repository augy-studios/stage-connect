// api/interactions/qa.js
const {
    getSupabase
} = require('../../lib/supabase');
const {
    verifySession
} = require('../../lib/auth');
const {
    handleCors
} = require('../../lib/cors');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    const sb = getSupabase();

    if (req.method === 'GET') {
        const {
            stageId
        } = req.query;
        const {
            data
        } = await sb.from('uwustage_qa').select('*').eq('stage_id', stageId).eq('is_answered', false).order('created_at', {
            ascending: false
        }).limit(100);
        return res.status(200).json({
            questions: data || []
        });
    }

    if (req.method === 'POST') {
        const {
            action,
            stageId,
            qaId,
            question,
            authorName,
            voterToken,
            voteType
        } = req.body || {};

        // Public: submit question
        if (action === 'submit') {
            if (!question?.trim()) return res.status(400).json({
                error: 'Question is required.'
            });
            const {
                data,
                error
            } = await sb.from('uwustage_qa').insert({
                stage_id: stageId,
                question: question.trim(),
                author_name: authorName || 'Anonymous'
            }).select().single();
            if (error) return res.status(500).json({
                error: 'Failed to submit question.'
            });
            return res.status(201).json({
                question: data
            });
        }

        // Public: vote
        if (action === 'vote') {
            if (!qaId || !voterToken || !['up', 'down'].includes(voteType)) return res.status(400).json({
                error: 'Invalid vote.'
            });
            const {
                error
            } = await sb.from('uwustage_qa_votes').upsert({
                qa_id: qaId,
                voter_token: voterToken,
                vote_type: voteType
            }, {
                onConflict: 'qa_id,voter_token'
            });
            if (error) return res.status(500).json({
                error: 'Vote failed.'
            });
            // Recount
            const {
                data: votes
            } = await sb.from('uwustage_qa_votes').select('vote_type').eq('qa_id', qaId);
            const upvotes = votes?.filter(v => v.vote_type === 'up').length || 0;
            const downvotes = votes?.filter(v => v.vote_type === 'down').length || 0;
            await sb.from('uwustage_qa').update({
                upvotes,
                downvotes
            }).eq('id', qaId);
            return res.status(200).json({
                success: true
            });
        }

        // Auth required
        const user = await verifySession(req);
        if (!user) return res.status(401).json({
            error: 'Unauthorized'
        });

        if (action === 'answer') {
            const {
                data: q
            } = await sb.from('uwustage_qa').select('is_answered').eq('id', qaId).single();
            await sb.from('uwustage_qa').update({
                is_answered: !q?.is_answered
            }).eq('id', qaId);
            return res.status(200).json({
                success: true
            });
        }
        if (action === 'pin') {
            const {
                data: q
            } = await sb.from('uwustage_qa').select('is_pinned').eq('id', qaId).single();
            await sb.from('uwustage_qa').update({
                is_pinned: !q?.is_pinned
            }).eq('id', qaId);
            return res.status(200).json({
                success: true
            });
        }
        if (action === 'hide') {
            await sb.from('uwustage_qa').delete().eq('id', qaId);
            return res.status(200).json({
                success: true
            });
        }
    }

    res.status(405).json({
        error: 'Method not allowed'
    });
};