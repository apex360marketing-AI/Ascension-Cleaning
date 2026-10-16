// Pre-launch gate: lists everything that still has to come from Kayla before
// the site can take real customers. Exits 1 until the list is empty.
//   npm run prelaunch
import fs from 'node:fs'
import vm from 'node:vm'

const html = fs.readFileSync('public/index.html', 'utf8')
const privacy = fs.readFileSync('public/privacy.html', 'utf8')
const cfgCtx = { window: {}, document: { addEventListener() {} } }
vm.createContext(cfgCtx)
vm.runInContext(fs.readFileSync('public/config.js', 'utf8'), cfgCtx)
const cfg = cfgCtx.window.ASCENSION || {}

const todo = []
if (!cfg.phone) todo.push('config.js: real phone number (menu + footer tap-to-call are hidden until set)')
if (!cfg.email) todo.push('config.js: real email on a domain that receives mail')
if (!cfg.reviewsUrl) todo.push('config.js: Google Business Profile review link')
if (/TODO\(launch\)/.test(privacy)) todo.push('privacy.html: legal business name, contact email and date')
const ph = (html.match(/class="t-ph"/g) || []).length
if (ph) todo.push(`index.html: ${ph} sample testimonial(s) — replace with real Google reviews (with permission) or remove`)
if (/Preview only/.test(html)) todo.push('index.html: client portal / sign-in is a preview — connect it (GHL client portal, Jobber) or hide it')
if (/Bonded &amp; Insured|bonded/i.test(html)) todo.push('index.html: "bonded & insured" — confirm the policy (insurer, coverage) or remove the claim')
if (/re-clean guarantee|100% satisfaction/i.test(html)) todo.push('index.html: guarantee wording — confirm Kayla will honour it as written')
todo.push('Netlify: set GHL_WEBHOOK_URL (Site configuration → Environment variables), then submit one test lead and confirm it lands in GHL')

console.log(todo.length ? 'Not ready to launch:\n' + todo.map((t) => '  ☐ ' + t).join('\n') : 'Ready to launch.')
process.exit(todo.length ? 1 : 0)
