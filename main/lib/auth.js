// lib/auth.js
const {
    getSupabase
} = require('./supabase');

async function verifySession(req) {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token) return null;

    const sb = getSupabase();
    const {
        data: session
    } = await sb
        .from('uwu_sessions')
        .select('user_id, expires_at')
        .eq('token', token)
        .single();

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
        await sb.from('uwu_sessions').delete().eq('token', token);
        return null;
    }

    const {
        data: user
    } = await sb
        .from('uwu_users')
        .select('id, username, email, display_name, avatar_url, created_at')
        .eq('id', session.user_id)
        .single();

    return user || null;
}

module.exports = {
    verifySession
};