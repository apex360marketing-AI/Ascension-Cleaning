// The live page: every lead form must reach Kayla, and nothing fake ships.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
const leadJs = fs.readFileSync(new URL('../public/lead.js', import.meta.url), 'utf8')

test('every lead form on the page posts to the lead function', () => {
  /** Before this, all of them ended in a "sent" toast and nothing was sent. */
  for (const kind of ['quote', 'booking', 'commercial', 'referral_signup', 'referral_invite', 'partner', 'gift_card_request', 'newsletter']) {
    assert.ok(html.includes(`sendLead('${kind}'`), `form "${kind}" is not wired`)
  }
  assert.ok(!html.includes('{{ GHL_'), 'an unwired GHL TODO is left in the page')
  assert.match(html, /<script src="\/lead\.js"/)
  assert.match(html, /<script src="\/config\.js"/)
})

test('the placeholder phone number is never shown or dialled', () => {
  assert.ok(!html.includes('tel:+12500000000'))
  assert.ok(!/>\s*250-000-0000\s*</.test(html))
})

test('the gift card form does not claim a card was sent when nothing was paid', () => {
  assert.ok(!html.includes('Gift card sent'))
})

test('the page is one document and links a privacy notice', () => {
  assert.equal((html.match(/<!doctype html>/gi) || []).length, 1)
  assert.match(html, /href="\/privacy\.html"/)
  assert.ok(fs.existsSync(new URL('../public/privacy.html', import.meta.url)))
})

// Run lead.js against a fake DOM to check what actually leaves the browser.
function loadLead() {
  const sent = []
  const toasts = []
  const ctx = {
    window: {},
    document: { addEventListener() {}, querySelectorAll: () => [] },
    location: { pathname: '/', hash: '#quote' },
    performance: { now: () => 60_000 },
    toast: (m) => toasts.push(m),
    fetch: async (url, opts) => {
      sent.push({ url, body: JSON.parse(opts.body), headers: opts.headers })
      return { ok: ctx.__ok ?? true }
    },
    console,
  }
  ctx.window = ctx
  vm.createContext(ctx)
  vm.runInContext(leadJs, ctx)
  return { ctx, sent, toasts }
}
const el = (props) => ({ id: '', name: '', type: 'text', value: '', checked: false, ...props })
const root = (els) => ({ querySelectorAll: () => els, querySelector: (s) => (s === '[name="website"]' ? els.find((e) => e.name === 'website') || null : null) })

test('uploaded photos and passwords are never sent, only typed fields and ticked boxes', async () => {
  /** Photos can show the inside of someone's home; they stay on the device.
   *  A password field (portal preview) must never travel to the CRM. */
  const { ctx, sent } = loadLead()
  await ctx.sendLead('quote', root([
    el({ id: 'q-name', value: ' Sam Lee ' }),
    el({ id: 'q-email', type: 'email', value: 'sam@example.com' }),
    el({ id: 'q-photo-input', type: 'file', value: 'C:\\fakepath\\kitchen.jpg' }),
    el({ id: 'auth-pass', type: 'password', value: 'hunter2' }),
    el({ name: 'qex', type: 'checkbox', value: 'Oven', checked: true }),
    el({ name: 'qex', type: 'checkbox', value: 'Fridge', checked: false }),
    el({ name: 'website', value: '' }),
  ]), { photo_count: 2 })
  const b = sent[0].body
  assert.equal(sent[0].url, '/.netlify/functions/lead')
  assert.equal(b.kind, 'quote')
  assert.deepEqual(b.fields, { 'q-name': 'Sam Lee', 'q-email': 'sam@example.com', qex: 'Oven' })
  assert.equal(b.extra.photo_count, 2)
  assert.equal(b.website, '')
  assert.equal(sent[0].headers['Content-Type'], 'application/json')
})

test('the hidden honeypot value travels separately and is not mixed into the fields', async () => {
  const { ctx, sent } = loadLead()
  await ctx.sendLead('newsletter', root([el({ id: 'jr-email', value: 'a@b.co' }), el({ name: 'website', value: 'bot-text' })]))
  assert.equal(sent[0].body.website, 'bot-text')
  assert.equal('website' in sent[0].body.fields, false)
})

test('a failed send tells the visitor plainly instead of pretending it worked', async () => {
  const { ctx, toasts } = loadLead()
  ctx.__ok = false
  const ok = await ctx.sendLead('booking', root([el({ id: 'b-email', value: 'a@b.co' })]))
  assert.equal(ok, false)
  assert.match(toasts[0], /didn.t go through/)
})

test('when a send fails the form comes back and the "done" panel hides', async () => {
  /** The page shows its confirmation immediately; if delivery then fails, the
   *  visitor must get their form back rather than a false "Kayla will call". */
  const { ctx } = loadLead()
  ctx.__ok = false
  const okPanel = { hidden: false }
  ctx.document.getElementById = (id) => (id === 'book-ok' ? okPanel : null)
  const form = { ...root([el({ id: 'b-email', value: 'a@b.co' })]), tagName: 'FORM', id: 'book-form', hidden: true }
  await ctx.sendLead('booking', form)
  assert.equal(form.hidden, false)
  assert.equal(okPanel.hidden, true)
})
