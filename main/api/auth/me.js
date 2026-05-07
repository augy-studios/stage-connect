// api/auth/me.js
const {
    verifySession
} = require('../../lib/auth');

module.exports = async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({
        error: 'Method not allowed'
    });
    const user = await verifySession(req);
    if (!user) return res.status(401).json({
        error: 'Unauthorized'
    });
    res.status(200).json({
        user
    });
};