// POST /.netlify/functions/lead — validates a website form, saves it for
// Kayla's dashboard (/dashboard/) and forwards it to her GoHighLevel inbound
// webhook. The webhook URL lives only in the Netlify env var GHL_WEBHOOK_URL,
// never in the page.
import { eq } from 'drizzle-orm'
import { buildLead } from '../lib/lead.mjs'
import { db } from '../../db/index.ts'
import { leads } from '../../db/schema.ts'

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

  // Saved first, so a GHL outage never loses a lead. A database hiccup must not
  // lose it either, so GHL still gets it if the save fails.
  const l = r.lead
  let id = null
  try {
    const [row] = await db
      .insert(leads)
      .values({ kind: l.kind, name: l.name, email: l.email, phone: l.phone, fields: l.fields, extra: l.extra, page: l.page })
      .returning({ id: leads.id })
    id = row.id
  } catch (e) {
    console.error('lead: not saved to the database', e instanceof Error ? e.message : e, l.kind)
  }

  const delivered = await forward(l)
  if (id !== null && delivered !== null) {
    await db.update(leads).set({ ghlDelivered: delivered }).where(eq(leads.id, id)).catch(() => {})
  }
  // The visitor hears "sent" if Kayla can see the lead anywhere.
  if (id !== null || delivered) return json(200, { ok: true })
  return json(delivered === null ? 503 : 502, { error: delivered === null ? 'not configured' : 'delivery failed' })
}

// true = GHL accepted it, false = GHL refused or was unreachable, null = no webhook set
async function forward(lead) {
  const hook = process.env.GHL_WEBHOOK_URL
  if (!hook) {
    console.error('lead: GHL_WEBHOOK_URL is not set — lead not sent to GHL', lead.kind)
    return null
  }
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('lead: GHL answered', res.status, lead.kind)
      return false
    }
    return true
  } catch (e) {
    console.error('lead: GHL unreachable', e instanceof Error ? e.message : e, lead.kind)
    return false
  }
}
