import { createClient } from '@supabase/supabase-js';
import { getSession } from '../../lib/auth.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, stage_id, survey_id, responder_token } = req.method === 'GET'
    ? req.query
    : req.body || {};

  // --- GET: list surveys for a stage ---
  if (req.method === 'GET' && action === 'list') {
    if (!stage_id) return res.status(400).json({ error: 'stage_id required' });
    const { data, error } = await supabase
      .from('uwustage_surveys')
      .select('*')
      .eq('stage_id', stage_id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ surveys: data });
  }

  // --- GET: get survey responses (presenter only) ---
  if (req.method === 'GET' && action === 'responses') {
    const session = await getSession(req, supabase);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    if (!survey_id) return res.status(400).json({ error: 'survey_id required' });
    const { data, error } = await supabase
      .from('uwustage_survey_responses')
      .select('*')
      .eq('survey_id', survey_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ responses: data });
  }

  // --- POST: create survey (presenter) ---
  if (req.method === 'POST' && action === 'create') {
    const session = await getSession(req, supabase);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { title, questions } = req.body;
    if (!stage_id || !title || !questions) return res.status(400).json({ error: 'stage_id, title, questions required' });
    const { data, error } = await supabase
      .from('uwustage_surveys')
      .insert({ stage_id, title, questions, is_active: true })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ survey: data });
  }

  // --- POST: submit response (audience) ---
  if (req.method === 'POST' && action === 'respond') {
    const { answers } = req.body;
    if (!survey_id || !responder_token || !answers) return res.status(400).json({ error: 'survey_id, responder_token, answers required' });
    // Check for duplicate
    const { data: existing } = await supabase
      .from('uwustage_survey_responses')
      .select('id')
      .eq('survey_id', survey_id)
      .eq('responder_token', responder_token)
      .single();
    if (existing) return res.status(409).json({ error: 'Already responded' });
    const { data, error } = await supabase
      .from('uwustage_survey_responses')
      .insert({ survey_id, responder_token, answers })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ response: data });
  }

  // --- PUT: toggle active ---
  if (req.method === 'PUT' && action === 'toggle') {
    const session = await getSession(req, supabase);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { is_active } = req.body;
    const { data, error } = await supabase
      .from('uwustage_surveys')
      .update({ is_active })
      .eq('id', survey_id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ survey: data });
  }

  // --- DELETE: delete survey ---
  if (req.method === 'DELETE') {
    const session = await getSession(req, supabase);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { error } = await supabase.from('uwustage_surveys').delete().eq('id', survey_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}