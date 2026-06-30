// lib/uwu-request-signing-server.js — server-side request signature verification
const crypto = require('crypto');

const TS_TOLERANCE_MS = 30 * 1000;

function hmacHex(keyStr, message) {
    return crypto.createHmac('sha256', keyStr).update(message).digest('hex');
}

function timingSafeEqualHex(a, b) {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// Vercel's body parser sets req.body = {} for GET/DELETE even with no body sent —
// treat that the same as "no body" so client and server agree on the hash input.
function getBodyHash(signingKey, req) {
    const body = req.body;
    const isEmpty = !body || (typeof body === 'object' && Object.keys(body).length === 0);
    if (isEmpty) return 'empty';
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return hmacHex(signingKey, bodyStr);
}

async function verifySignedRequest(req, supabase) {
    const requestToken = req.headers['x-request-token'];
    const ts = req.headers['x-request-ts'];
    const keyIdHeader = req.headers['x-key-id'];
    const auth = req.headers['authorization'] || '';
    const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

    if (!requestToken || !ts) return { valid: false, reason: 'Missing signature headers.' };

    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > TS_TOLERANCE_MS) {
        return { valid: false, reason: 'Stale or invalid timestamp.' };
    }

    // Login sessions are identified by their bearer token; guests by X-Key-ID.
    const sessionToken = bearerToken || keyIdHeader;
    if (!sessionToken) return { valid: false, reason: 'Missing key identity.' };

    const { data: keyRow } = await supabase
        .from('uwu_signing_keys')
        .select('signing_key, expires_at')
        .eq('session_token', sessionToken)
        .single();

    if (!keyRow) return { valid: false, reason: 'Unknown signing key.' };
    if (new Date(keyRow.expires_at) < new Date()) return { valid: false, reason: 'Signing key expired.' };

    const method = (req.method || 'GET').toUpperCase();
    const path = (req.url || '').split('?')[0];
    const bodyHash = getBodyHash(keyRow.signing_key, req);
    const message = `${ts}:${method}:${path}:${bodyHash}`;
    const expectedToken = hmacHex(keyRow.signing_key, message);

    if (!timingSafeEqualHex(expectedToken, requestToken)) {
        return { valid: false, reason: 'Invalid signature.' };
    }

    const { data: used } = await supabase
        .from('uwu_used_request_tokens')
        .select('token')
        .eq('token', requestToken)
        .single();
    if (used) return { valid: false, reason: 'Replay detected.' };

    await supabase.from('uwu_used_request_tokens').insert({
        token: requestToken,
        session_token: sessionToken,
        used_at: new Date().toISOString()
    });

    return { valid: true, reason: 'ok' };
}

module.exports = { verifySignedRequest };
