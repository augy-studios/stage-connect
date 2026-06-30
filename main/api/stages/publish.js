// api/stages/publish.js
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
        stageId,
        slug
    } = req.body || {};
    if (!stageId || !slug) return res.status(400).json({
        error: 'stageId and slug are required.'
    });

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!cleanSlug || cleanSlug.length < 2) return res.status(400).json({
        error: 'Slug too short or invalid.'
    });
    if (cleanSlug.length > 60) return res.status(400).json({
        error: 'Slug too long (max 60 chars).'
    });

    const sb = getSupabase();

    // Verify ownership
    const {
        data: stage
    } = await sb.from('uwustage_stages').select('id, user_id, is_live').eq('id', stageId).single();
    if (!stage || stage.user_id !== user.id) return res.status(403).json({
        error: 'Forbidden'
    });
    if (stage.is_live) return res.status(409).json({
        error: 'Stage is already live.'
    });

    // Check slug availability
    const {
        data: existing
    } = await sb.from('uwustage_stages').select('id').eq('slug', cleanSlug).not('id', 'eq', stageId).single();
    if (existing) return res.status(409).json({
        error: 'This slug is already taken. Try another.'
    });

    const {
        error
    } = await sb.from('uwustage_stages')
        .update({
            slug: cleanSlug,
            is_live: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

    if (error) return res.status(500).json({
        error: 'Failed to publish.'
    });
    res.status(200).json({
        success: true,
        slug: cleanSlug
    });
};