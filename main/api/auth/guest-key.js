// api/auth/guest-key.js — issues short-lived signing keys for anonymous callers
const crypto = require('crypto');
const { getSupabase } = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Same-origin requests sometimes arrive with no Origin header at all — that's normal.
    const origin = req.headers['origin'];
    if (origin) {
        const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
        if (!allowed.includes(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    const appId = String(req.query.app || 'unknown').slice(0, 100);
    const sessionToken = crypto.randomUUID();
    const signingKey = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const sb = getSupabase();
    const { error } = await sb.from('uwu_signing_keys').insert({
        session_token: sessionToken,
        signing_key: signingKey,
        is_guest: true,
        app_id: appId,
        expires_at
    });
    if (error) return res.status(500).json({ error: 'Failed to issue guest key.' });

    res.status(200).json({ key_id: sessionToken, signing_key: signingKey });
};
