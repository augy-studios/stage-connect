// api/stages/list.js
const {
    getSupabase
} = require('../../lib/supabase');
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

    const {
        data: stages,
        error
    } = await getSupabase()
        .from('uwustage_stages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', {
            ascending: false
        });

    if (error) return res.status(500).json({
        error: 'Failed to load stages.'
    });
    res.status(200).json({
        stages: stages || []
    });
};