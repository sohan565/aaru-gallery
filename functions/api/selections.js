// Cloudflare Pages Function: GET /api/selections
// Supports Cloudflare KV (AARU_KV) and R2 (AARU_BUCKET)
export async function onRequestGet(context) {
  const { env } = context;

  // 1. Fetch from Cloudflare KV Namespace if bound
  if (env && env.AARU_KV) {
    try {
      const value = await env.AARU_KV.get('her-selections');
      if (value) {
        return new Response(value, {
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    } catch (e) {}
  }

  // 2. Fetch from bound R2 Bucket if bound
  if (env && env.AARU_BUCKET) {
    try {
      const obj = await env.AARU_BUCKET.get('her-selections.json');
      if (obj) {
        const text = await obj.text();
        return new Response(text, {
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    } catch (e) {}
  }

  // 3. Fallback to public R2 CDN url
  try {
    const res = await fetch('https://pub-629511d12b5e4646bc34b630fcbb2369.r2.dev/her-selections.json');
    if (res.ok) {
      const data = await res.text();
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
  } catch (e) {}

  return new Response(JSON.stringify({ picks: [] }), {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
