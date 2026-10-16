// POST /.netlify/functions/lead — validates a website form and forwards it to
// Kayla's GoHighLevel inbound webhook. The webhook URL lives only in the
// Netlify env var GHL_WEBHOOK_URL, never in the page.
import { buildLead } from '../lib/lead.mjs'

const MAX_BODY = 20_000

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  // JSON-only forces a CORS preflight on any cross-site browser post (which we
  // never answer), and a foreign Origin is refused outright.
  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') return json(415, { error: 'JSON only' })
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return json(403, { error: 'forbidden origin' })

  const raw = await req.text()
  if (raw.length > MAX_BODY) return json(413, { error: 'too large' })
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'malformed JSON' })
  }

  const r = buildLead(body)
  if (!r.ok) return json(r.status, { error: r.error })
  if (r.spam) return json(200, { ok: true }) // tell bots nothing

  const hook = process.env.GHL_WEBHOOK_URL
  if (!hook) {
    console.error('lead: GHL_WEBHOOK_URL is not set — lead not delivered', r.lead.kind)
    return json(503, { error: 'not configured' })
  }
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(r.lead),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('lead: GHL answered', res.status, r.lead.kind)
      return json(502, { error: 'delivery failed' })
    }
  } catch (e) {
    console.error('lead: GHL unreachable', e instanceof Error ? e.message : e, r.lead.kind)
    return json(502, { error: 'delivery failed' })
  }
  return json(200, { ok: true })
}
