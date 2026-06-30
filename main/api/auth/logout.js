// api/auth/logout.js
const {
    getSupabase
} = require('../../lib/supabase');
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
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (token) await getSupabase().from('uwu_sessions').delete().eq('token', token);
    res.status(200).json({
        success: true
    });
};