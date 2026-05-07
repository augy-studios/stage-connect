// Edge function: resolves a live slug → stage data
// Deployed on live.stage.uwuapps.org/api/stage/:slug

export const config = {
    runtime: 'edge'
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: cors
        });
    }

    const url = new URL(req.url);
    // slug is last path segment: /api/stage/:slug
    const slug = url.pathname.split('/').filter(Boolean).pop();

    if (!slug) {
        return new Response(JSON.stringify({
            error: 'Slug required'
        }), {
            status: 400,
            headers: {
                ...cors,
                'Content-Type': 'application/json'
            },
        });
    }

    // Query Supabase REST API directly (edge-compatible, no Node SDK needed)
    const sbUrl = `${SUPABASE_URL}/rest/v1/uwustage_stages?slug=eq.${encodeURIComponent(slug)}&is_live=eq.true&select=id,title,description,features,settings,slug,is_live,created_at`;

    const sbRes = await fetch(sbUrl, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!sbRes.ok) {
        const err = await sbRes.text();
        return new Response(JSON.stringify({
            error: 'Database error',
            detail: err
        }), {
            status: 500,
            headers: {
                ...cors,
                'Content-Type': 'application/json'
            },
        });
    }

    const rows = await sbRes.json();

    if (!rows || rows.length === 0) {
        return new Response(JSON.stringify({
            error: 'Stage not found or not live'
        }), {
            status: 404,
            headers: {
                ...cors,
                'Content-Type': 'application/json'
            },
        });
    }

    const stage = rows[0];

    return new Response(JSON.stringify({
        stage
    }), {
        status: 200,
        headers: {
            ...cors,
            'Content-Type': 'application/json',
            // Cache briefly — slug data changes infrequently
            'Cache-Control': 'no-store',
        },
    });
}