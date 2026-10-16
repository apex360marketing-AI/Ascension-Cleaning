// Smoke test a deployed copy of the site (draft or live). Sends only fixed
// test payloads; a real lead is sent only with --send-test-lead.
//   node scripts/smoke.mjs https://<deploy>--ascensioncleaningco.netlify.app [--expect-webhook] [--send-test-lead]
const base = (process.argv[2] || '').replace(/\/$/, '')
if (!/^https:\/\/[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$|^https:\/\/[a-z0-9.-]+$/.test(base)) {
  console.error('usage: node scripts/smoke.mjs https://<site>')
  process.exit(2)
}
const expectWebhook = process.argv.includes('--expect-webhook')
const sendReal = process.argv.includes('--send-test-lead')
const fn = base + '/.netlify/functions/lead'
let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) fails++
}
const post = (body, headers = {}) =>
  fetch(fn, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })

const page = await fetch(base + '/')
const html = await page.text()
check('home page loads', page.ok && html.includes('<title>Ascension'), `HTTP ${page.status}`)
for (const p of ['/privacy.html', '/lead.js', '/config.js', '/img/kitchen-after.jpg']) {
  const r = await fetch(base + p)
  check(`${p} served`, r.ok, `HTTP ${r.status}`)
}
for (const h of ['content-security-policy', 'x-frame-options', 'strict-transport-security', 'x-content-type-options', 'referrer-policy']) {
  check(`header ${h}`, page.headers.has(h))
}

const lead = { kind: 'booking', fields: { 'b-name': 'Smoke Test', 'b-email': 'smoke-test@example.com' }, website: '', elapsed_ms: 30000 }
check('foreign Origin refused', (await post(lead, { Origin: 'https://evil.example.com' })).status === 403)
check('non-JSON refused', (await fetch(fn, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(lead) })).status === 415)
check('GET refused', (await fetch(fn)).status === 405)
check('unknown form refused', (await post({ ...lead, kind: 'admin' })).status === 400)
check('lead without contact refused', (await post({ ...lead, fields: { 'b-name': 'x' } })).status === 422)
check('honeypot bot gets a quiet 200', (await post({ ...lead, website: 'http://spam' })).status === 200)

if (sendReal) {
  const r = await post(lead, { Origin: base })
  check('test lead delivered to GHL', r.status === 200, `HTTP ${r.status} ${await r.text()}`)
} else {
  // a too-fast submit is dropped as a bot before delivery, so this probes the
  // function without creating a contact in GHL
  const r = await post({ ...lead, elapsed_ms: 100 }, { Origin: base })
  check('function reachable from own origin', r.status === 200, `HTTP ${r.status}`)
  const cfg = await post({ ...lead, fields: { 'b-email': 'not-an-email' } }, { Origin: base })
  check('validation runs before delivery', cfg.status === 422)
  if (!expectWebhook) console.log('  · GHL_WEBHOOK_URL not checked (pass --send-test-lead to send one real test lead)')
}
console.log(fails ? `── ${fails} check(s) failed ──` : '── all checks passed ──')
process.exit(fails ? 1 : 0)
