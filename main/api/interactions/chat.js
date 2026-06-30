// api/interactions/chat.js
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
        } = await sb.from('uwustage_chat').select('*').eq('stage_id', stageId).eq('is_hidden', false).order('created_at', {
            ascending: true
        }).limit(200);
        return res.status(200).json({
            messages: data || []
        });
    }
    if (req.method === 'POST') {
        const {
            action,
            stageId,
            message,
            authorName,
            messageId
        } = req.body || {};
        if (action === 'send') {
            if (!message?.trim()) return res.status(400).json({
                error: 'Message is required.'
            });
            if (message.trim().length > 300) return res.status(400).json({
                error: 'Message too long.'
            });
            const {
                data,
                error
            } = await sb.from('uwustage_chat').insert({
                stage_id: stageId,
                message: message.trim(),
                author_name: authorName || 'Anonymous'
            }).select().single();
            if (error) return res.status(500).json({
                error: 'Failed to send.'
            });
            return res.status(201).json({
                message: data
            });
        }
        if (action === 'clear') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({
                error: 'Unauthorized'
            });
            await sb.from('uwustage_chat').update({
                is_hidden: true
            }).eq('stage_id', stageId);
            return res.status(200).json({
                success: true
            });
        }
        if (action === 'hide') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({
                error: 'Unauthorized'
            });
            await sb.from('uwustage_chat').update({
                is_hidden: true
            }).eq('id', messageId);
            return res.status(200).json({
                success: true
            });
        }
    }
    res.status(405).json({
        error: 'Method not allowed'
    });
};