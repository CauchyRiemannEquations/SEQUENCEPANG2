import { validateState, baseline, requestFor, parseDecision } from '../lib/jev-policy.js';

// Preview-only experiment. In-memory limits are a secondary, per-instance guard;
// keep Vercel Authentication enabled on Preview deployments for access control.
export function createHandler({env = process.env, fetcher = (...args) => fetch(...args), now = Date.now} = {}) {
  let calls = 0, windowStart = now(), lastCall = -Infinity, busy = false;
  return async function handler(req, res) {
    res.setHeader('Cache-Control','no-store');
    const send = (code, body) => { res.statusCode=code; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    if (!['preview','development'].includes(env.VERCEL_ENV)) return send(404,{error:'preview_only'});
    if (!env.TYPESAFE_API_KEY) return send(503,{error:'missing_key'});
    if (req.method === 'GET') return send(200,{enabled:true, mode:'shadow', actions:['NONE','GLOW','GESTURE']});
    if (req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return send(405,{error:'method_not_allowed'}); }
    const origin = req.headers.origin, host = req.headers.host;
    if (!origin || !host || !['https://'+host, ...(env.VERCEL_ENV==='development'?['http://'+host]:[])].includes(origin)) return send(403,{error:'origin'});
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(415,{error:'content_type'});
    let body;
    try {
      if (Number(req.headers['content-length']) > 4096) return send(413,{error:'too_large'});
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        if (Buffer.byteLength(req.body) > 4096) return send(413,{error:'too_large'});
        body = JSON.parse(String(req.body));
      } else if (req.body !== undefined) body = req.body;
      else {
        let raw='';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw)>4096) return send(413,{error:'too_large'}); }
        body=JSON.parse(raw);
      }
    } catch { return send(400,{error:'invalid_state'}); }
    const state = validateState(body);
    if (!state) return send(400,{error:'invalid_state'});
    if (now()-windowStart >= 3600000) {calls=0;windowStart=now();}
    if (busy || now()-lastCall<5000 || calls>=60) {res.setHeader('Retry-After','5');return send(429,{error:'rate_limit'});}
    calls++; lastCall=now(); busy=true;
    try {
      const response=await fetcher('https://api.typesafe.ai/v1/systemone',{
        method:'POST',headers:{'Authorization':`Bearer ${env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify(requestFor(state)),signal:AbortSignal.timeout(8000),
      });
      if (!response.ok) return send(502,{error:response.status===401||response.status===403?'upstream_auth':response.status===429?'upstream_limit':'upstream_error'});
      const decision=parseDecision(await response.json());
      return send(200,{mode:'shadow',baseline:baseline(state),...decision});
    } catch (e) {return send(502,{error:e?.name==='TimeoutError'||e?.name==='AbortError'?'timeout':'invalid_response'});}
    finally {busy=false;}
  };
}
export default createHandler();
