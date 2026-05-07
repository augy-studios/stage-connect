// api/auth/register.js
const {
    getSupabase
} = require('../../lib/supabase');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({
        error: 'Method not allowed'
    });

    const {
        email,
        password,
        username,
        displayName
    } = req.body || {};
    if (!email || !password || !username) {
        return res.status(400).json({
            error: 'Email, username, and password are required.'
        });
    }
    if (password.length < 8) return res.status(400).json({
        error: 'Password must be at least 8 characters.'
    });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({
        error: 'Username may only contain letters, numbers, and underscores.'
    });

    const sb = getSupabase();
    const password_hash = await bcrypt.hash(password, 10);

    const {
        error
    } = await sb.from('uwu_users').insert({
        email: email.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        password_hash,
        display_name: (displayName || username).trim()
    });

    if (error) {
        if (error.code === '23505') return res.status(409).json({
            error: 'Email or username already in use.'
        });
        return res.status(500).json({
            error: 'Registration failed.'
        });
    }

    res.status(201).json({
        success: true
    });
};