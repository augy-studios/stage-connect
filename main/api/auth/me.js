// api/auth/me.js
const {
    verifySession
} = require('../../lib/auth');
const {
    getSupabase
} = require('../../lib/supabase');
const {
    verifySignedRequest
} = require('../../lib/uwu-request-signing-server');

module.exports = async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({
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
    res.status(200).json({
        user
    });
};