// Mutation check: remove each guard in turn and require `npm test` to fail.
// A guard whose removal keeps the suite green has no test behind it.
//   node scripts/mutate.mjs
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const LEAD = 'netlify/lib/lead.mjs'
const JS = 'public/lead.js'
const M = {
  'honeypot drops bots': [LEAD, "if (typeof body.website === 'string' && body.website.trim()) return { ok: true, spam: true }", ''],
  'too-fast submits are bots': [LEAD, "if (typeof body.elapsed_ms === 'number' && body.elapsed_ms < MIN_HUMAN_MS) return { ok: true, spam: true }", ''],
  'unknown forms refused': [LEAD, "if (!KINDS.has(body.kind)) return", 'if (false) return'],
  'contact required': [LEAD, "if (!email && !phone) return", 'if (false) return'],
  'email validated': [LEAD, 'const email = EMAIL.test(emailRaw) ?', 'const email = true ?'],
  'field cap': [LEAD, 'if (keys.length > MAX_FIELDS) return null', ''],
  'value length cap': [LEAD, '.trim().slice(0, MAX_LEN)', '.trim()'],
  'person beats business name': [LEAD, "pick(fields, /(^|-)f?name$/i) || pick(fields, /(^|-)biz$/i)", "pick(fields, /(^|-)(f?name|biz)$/i)"],
  'photos never sent': [JS, " || el.type === 'file'", ''],
  'passwords never sent': [JS, " || el.type === 'password'", ''],
  'honeypot kept out of fields': [JS, "el.name === HONEYPOT || ", ''],
  'unticked boxes skipped': [JS, 'if (!el.checked) continue', ''],
  'failed send gives the form back': [JS, '          root.hidden = false\n', ''],
  'failed send is reported': [JS, '        sorry()\n        return false', '        return false'],
}

let bad = 0
for (const [name, [file, from, to]] of Object.entries(M)) {
  const orig = fs.readFileSync(file, 'utf8')
  if (!orig.includes(from)) {
    console.log(`  !! STALE  ${name} — anchor not found in ${file}`)
    bad++
    continue
  }
  fs.writeFileSync(file, orig.replace(from, to))
  let green = true
  try {
    execSync('npm test', { stdio: 'ignore' })
  } catch {
    green = false
  }
  fs.writeFileSync(file, orig)
  console.log(green ? `  ✗ NOT GUARDED  ${name}` : `  ✓ load-bearing  ${name}`)
  if (green) bad++
}
console.log(bad ? `── ${bad} guard(s) without a test ──` : `── all ${Object.keys(M).length} guards load-bearing ──`)
process.exit(bad ? 1 : 0)
