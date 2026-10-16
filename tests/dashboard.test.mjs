// Kayla's lead dashboard: wired up, private, and in step with the site's forms.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { KINDS } from '../netlify/lib/lead.mjs'

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const page = read('public/dashboard/index.html')
const app = read('public/dashboard/app.js')
const home = read('public/index.html')
const schema = read('db/schema.ts')
const api = read('netlify/functions/leads.mts')
const toml = read('netlify.toml')

test('the dashboard page loads its sign-in bundle and app, and is never indexed', () => {
  assert.match(page, /<script src="\/dashboard\/auth\.js"><\/script>/)
  assert.match(page, /<script src="\/dashboard\/app\.js"><\/script>/)
  assert.match(page, /name="robots" content="noindex/)
  assert.match(toml, /for = "\/dashboard\/\*"[\s\S]*X-Robots-Tag = "noindex/)
  assert.match(toml, /command = "npm test && npm run build:dashboard"/)
})

test('every website form has a plain-English name on the dashboard', () => {
  /** A new form kind added to the lead rules must also get a label here,
   *  or Kayla sees raw ids like "gift_card_request". */
  for (const k of KINDS) assert.match(app, new RegExp(`\\b${k}: '`), `no dashboard label for "${k}"`)
})

test('the dashboard offers exactly the stages the API accepts', () => {
  const db = schema.match(/LEAD_STATUSES = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1))
  const list = app.slice(app.indexOf('var STATUSES = ['), app.indexOf('var STATUS = {}'))
  const ui = [...list.matchAll(/\{ id: '([a-z]+)', label:/g)].map((m) => m[1])
  assert.deepEqual(ui, db)
})

test('the dashboard API requires a signed-in admin and same-site writes', () => {
  assert.match(api, /if \(!user\) return json\(401/)
  assert.match(api, /roles\?\.includes\('admin'\)/)
  assert.match(api, /origin !== new URL\(req\.url\)\.origin/)
})

test('invite and password-reset links that land on the home page reach the dashboard', () => {
  assert.match(home, /invite\|recovery\|confirmation\|email_change\)_token=/)
  assert.match(home, /location\.replace\('\/dashboard\/'\+location\.hash\)/)
})

test('lead content is escaped before it reaches the page', () => {
  /** Leads are typed by strangers; a name like <img onerror> must render as text. */
  // confirm() and textContent take plain text, so only HTML-building lines count
  const html = app.split('\n').filter((l) => !/confirm\(|textContent/.test(l)).join('\n')
  for (const field of ['displayName(l)', 'l.notes', 'l.email', 'l.name', 'p[1]']) {
    const raw = new RegExp(`'\\s*\\+\\s*${field.replace(/[.()[\]]/g, '\\$&')}\\s*\\+\\s*'`)
    assert.ok(!raw.test(html), `${field} is inserted into HTML without esc()`)
  }
})
