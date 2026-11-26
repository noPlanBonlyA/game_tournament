// Vercel serverless function: stores the tournament state in Upstash Redis.
// GET  /api/state            -> { state }               (public, for viewers)
// POST /api/state {state}    -> { ok: true }            (needs header x-admin-key = ADMIN_KEY)
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'tank-tournament-state';

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'storage not configured' });
  try {
    if (req.method === 'GET') {
      const v = await redis(['GET', KEY]);
      return res.status(200).json({ state: v ? JSON.parse(v) : null });
    }
    if (req.method === 'POST') {
      if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'wrong admin key' });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const str = JSON.stringify(body.state ?? null);
      if (str.length > 500000) return res.status(413).json({ error: 'too large' });
      await redis(['SET', KEY, str]);
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
