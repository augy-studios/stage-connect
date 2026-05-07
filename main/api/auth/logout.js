// api/auth/logout.js
const {
    getSupabase
} = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({
        error: 'Method not allowed'
    });
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (token) await getSupabase().from('uwu_sessions').delete().eq('token', token);
    res.status(200).json({
        success: true
    });
};