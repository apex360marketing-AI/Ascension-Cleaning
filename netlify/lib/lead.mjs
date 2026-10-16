// Lead intake rules — pure, unit-tested in tests/lead.test.mjs.
// The website posts every form here; netlify/functions/lead.mjs forwards the
// result to Kayla's GoHighLevel inbound webhook.

export const KINDS = new Set([
  'quote',
  'booking',
  'commercial',
  'referral_signup',
  'referral_invite',
  'partner',
  'gift_card_request',
  'newsletter',
])

const MAX_FIELDS = 60
const MAX_LEN = 2000
const MIN_HUMAN_MS = 1500 // faster than this from page load to submit = a bot
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Keep string-able scalars only, trimmed and capped. Returns null if too many.
function clean(obj) {
  if (!isObj(obj)) return {}
  const keys = Object.keys(obj)
  if (keys.length > MAX_FIELDS) return null
  const out = {}
  for (const k of keys) {
    const v = obj[k]
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue
    const s = String(v).trim().slice(0, MAX_LEN)
    if (s) out[String(k).slice(0, 80)] = s
  }
  return out
}

const pick = (fields, re) => Object.entries(fields).find(([k]) => re.test(k))?.[1] || ''

// North American numbers to E.164 (+1XXXXXXXXXX) so GHL dedupes contacts.
function toE164(raw) {
  const d = String(raw).replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return ''
}

// Returns { ok:false, status, error } | { ok:true, spam:true } | { ok:true, spam:false, lead }
export function buildLead(body, now = Date.now()) {
  if (!isObj(body)) return { ok: false, status: 400, error: 'expected a JSON object' }
  if (!KINDS.has(body.kind)) return { ok: false, status: 400, error: 'unknown form' }

  // bots: honeypot filled, or submitted faster than a person can type
  if (typeof body.website === 'string' && body.website.trim()) return { ok: true, spam: true }
  if (typeof body.elapsed_ms === 'number' && body.elapsed_ms < MIN_HUMAN_MS) return { ok: true, spam: true }

  const fields = clean(body.fields)
  const extra = clean(body.extra)
  if (fields === null || extra === null) return { ok: false, status: 413, error: 'too many fields' }

  const emailRaw = pick(fields, /email/i)
  const email = EMAIL.test(emailRaw) ? emailRaw.toLowerCase() : ''
  const phone = toE164(pick(fields, /phone/i))
  if (!email && !phone) return { ok: false, status: 422, error: 'an email or phone number is needed' }

  // a person's name beats a business name (the commercial form lists the business first)
  const name = pick(fields, /(^|-)f?name$/i) || pick(fields, /(^|-)biz$/i)
  return {
    ok: true,
    spam: false,
    lead: {
      source: 'ascension-website',
      kind: body.kind,
      name,
      first_name: name.split(/\s+/)[0] || '',
      email,
      phone,
      fields,
      extra,
      page: typeof body.page === 'string' ? body.page.slice(0, 200) : '',
      submitted_at: new Date(now).toISOString(),
    },
  }
}
