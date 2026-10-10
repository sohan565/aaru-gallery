// Cloudflare Pages Function: POST /api/save-selections
// Supports Cloudflare KV (AARU_KV) and R2 (AARU_BUCKET)
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const jsonString = JSON.stringify(data, null, 2);

    // 1. Save to Cloudflare KV Namespace (Instant, Sub-10ms, Atomic)
    if (env && env.AARU_KV) {
      await env.AARU_KV.put('her-selections', jsonString);
      // Keep a timestamped entry in KV as well for backup history
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await env.AARU_KV.put(`history:${timestamp}`, jsonString);
    }

    // 2. Also save to R2 Bucket if bound
    if (env && env.AARU_BUCKET) {
      await env.AARU_BUCKET.put('her-selections.json', jsonString, {
        httpMetadata: { contentType: 'application/json; charset=UTF-8' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: (data.picks || []).length,
      syncedToKV: Boolean(env && env.AARU_KV),
      syncedToR2: Boolean(env && env.AARU_BUCKET)
    }), {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
}
