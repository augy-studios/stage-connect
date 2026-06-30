// api/interactions/survey.js
const { getSupabase } = require('../../lib/supabase');
const { verifySession } = require('../../lib/auth');
const { handleCors } = require('../../lib/cors');
const { verifySignedRequest } = require('../../lib/uwu-request-signing-server');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    const sb = getSupabase();
    const sig = await verifySignedRequest(req, sb);
    if (!sig.valid) return res.status(403).json({ error: sig.reason });

    const { action, stage_id, survey_id, responder_token } = req.method === 'GET'
        ? req.query
        : req.body || {};

    // --- GET: list surveys for a stage ---
    if (req.method === 'GET' && action === 'list') {
        if (!stage_id) return res.status(400).json({ error: 'stage_id required' });
        const { data, error } = await sb
            .from('uwustage_surveys')
            .select('*')
            .eq('stage_id', stage_id)
            .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ surveys: data });
    }

    // --- GET: get survey responses (presenter only) ---
    if (req.method === 'GET' && action === 'responses') {
        const user = await verifySession(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!survey_id) return res.status(400).json({ error: 'survey_id required' });
        const { data, error } = await sb
            .from('uwustage_survey_responses')
            .select('*')
            .eq('survey_id', survey_id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ responses: data });
    }

    if (req.method === 'POST') {
        // --- POST: create survey (presenter) ---
        if (action === 'create') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });
            const { title, questions } = req.body;
            if (!stage_id || !title || !questions) return res.status(400).json({ error: 'stage_id, title, questions required' });
            const { data, error } = await sb
                .from('uwustage_surveys')
                .insert({ stage_id, title, questions, is_active: true })
                .select()
                .single();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ survey: data });
        }

        // --- POST: submit response (audience) ---
        if (action === 'respond') {
            const { answers } = req.body;
            if (!survey_id || !responder_token || !answers) return res.status(400).json({ error: 'survey_id, responder_token, answers required' });
            const { data: existing } = await sb
                .from('uwustage_survey_responses')
                .select('id')
                .eq('survey_id', survey_id)
                .eq('responder_token', responder_token)
                .single();
            if (existing) return res.status(409).json({ error: 'Already responded' });
            const { data, error } = await sb
                .from('uwustage_survey_responses')
                .insert({ survey_id, responder_token, answers })
                .select()
                .single();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ response: data });
        }

        // --- POST: toggle active ---
        if (action === 'toggle') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });
            const { is_active } = req.body;
            const { data, error } = await sb
                .from('uwustage_surveys')
                .update({ is_active })
                .eq('id', survey_id)
                .select()
                .single();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ survey: data });
        }

        // --- POST: delete survey ---
        if (action === 'delete') {
            const user = await verifySession(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });
            const { error } = await sb.from('uwustage_surveys').delete().eq('id', survey_id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ success: true });
        }
    }

    res.status(405).json({ error: 'Method not allowed' });
};
