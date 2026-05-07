// api/auth/login.js
const {
    getSupabase
} = require('../../lib/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({
        error: 'Method not allowed'
    });

    const {
        email,
        password
    } = req.body || {};
    if (!email || !password) return res.status(400).json({
        error: 'Email and password are required.'
    });

    const sb = getSupabase();
    const {
        data: user
    } = await sb
        .from('uwu_users')
        .select('id, username, email, display_name, avatar_url, password_hash, created_at')
        .eq('email', email.toLowerCase().trim())
        .single();

    if (!user) return res.status(401).json({
        error: 'Invalid email or password.'
    });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({
        error: 'Invalid email or password.'
    });

    const token = crypto.randomBytes(48).toString('hex');
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await sb.from('uwu_sessions').insert({
        token,
        user_id: user.id,
        expires_at
    });

    const {
        password_hash: _,
        ...safeUser
    } = user;
    res.status(200).json({
        token,
        user: safeUser
    });
};