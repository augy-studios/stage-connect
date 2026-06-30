// lib/uwu-request-signing.js — client-side request signing (browser, classic script)
(function () {
    const LS_KEY = 'uwu_signing_key';
    const SS_KEY = 'uwu_signing_key';

    function storeSigningKey(signingKey, keyId, persistent = false) {
        const payload = JSON.stringify({ signingKey, keyId });
        if (persistent) {
            localStorage.setItem(LS_KEY, payload);
            sessionStorage.removeItem(SS_KEY);
        } else {
            sessionStorage.setItem(SS_KEY, payload);
            localStorage.removeItem(LS_KEY);
        }
    }

    function getSigningKey() {
        const fromLocal = localStorage.getItem(LS_KEY);
        if (fromLocal) {
            try {
                return JSON.parse(fromLocal);
            } catch {
                localStorage.removeItem(LS_KEY);
            }
        }
        const fromSession = sessionStorage.getItem(SS_KEY);
        if (fromSession) {
            try {
                return JSON.parse(fromSession);
            } catch {
                sessionStorage.removeItem(SS_KEY);
            }
        }
        return null;
    }

    function clearSigningKey() {
        localStorage.removeItem(LS_KEY);
        sessionStorage.removeItem(SS_KEY);
    }

    async function initGuestKey(appId) {
        if (getSigningKey()) return; // already have a key (remembered or existing guest key)
        const res = await fetch(`/api/auth/guest-key?app=${encodeURIComponent(appId)}`);
        if (!res.ok) throw new Error('Failed to obtain guest signing key.');
        const data = await res.json();
        if (!data.signing_key || !data.key_id) throw new Error('Invalid guest key response.');
        storeSigningKey(data.signing_key, data.key_id, false); // guest keys always sessionStorage
    }

    async function hmacHex(keyStr, message) {
        const enc = new TextEncoder();
        const cryptoKey = await crypto.subtle.importKey(
            'raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
        return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function signedFetch(url, options = {}) {
        const keyInfo = getSigningKey();
        if (!keyInfo) throw new Error('signedFetch: no signing key available — call initGuestKey() or log in first.');
        const { signingKey, keyId } = keyInfo;

        const method = (options.method || 'GET').toUpperCase();
        const path = new URL(url, window.location.origin).pathname;

        let bodyStr = null;
        if (options.body) {
            bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }
        const bodyHash = bodyStr && bodyStr !== '{}' ? await hmacHex(signingKey, bodyStr) : 'empty';

        const ts = Date.now().toString();
        const message = `${ts}:${method}:${path}:${bodyHash}`;
        const token = await hmacHex(signingKey, message);

        const headers = new Headers(options.headers || {});
        headers.set('X-Request-Token', token);
        headers.set('X-Request-TS', ts);
        headers.set('X-Key-ID', keyId);

        return fetch(url, {
            ...options,
            headers,
            body: bodyStr !== null ? bodyStr : options.body
        });
    }

    window.storeSigningKey = storeSigningKey;
    window.getSigningKey = getSigningKey;
    window.clearSigningKey = clearSigningKey;
    window.initGuestKey = initGuestKey;
    window.signedFetch = signedFetch;
})();
