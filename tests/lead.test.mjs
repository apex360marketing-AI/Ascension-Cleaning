// Lead intake rules for the website → GoHighLevel bridge. Run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLead, KINDS } from '../netlify/lib/lead.mjs'

const NOW = Date.parse('2026-10-16T12:00:00Z')
const base = (over = {}) => ({
  kind: 'quote',
  fields: { 'q-name': 'Sam Lee', 'q-email': 'sam@example.com', 'q-phone': '250-555-0123' },
  extra: { estimate_low: 180, estimate_high: 240 },
  page: '/#quote',
  website: '',
  elapsed_ms: 40_000,
  ...over,
})

test('a real quote request becomes a GHL contact with name, email and phone', () => {
  const r = buildLead(base(), NOW)
  assert.equal(r.ok, true)
  assert.equal(r.spam, false)
  assert.equal(r.lead.name, 'Sam Lee')
  assert.equal(r.lead.first_name, 'Sam')
  assert.equal(r.lead.email, 'sam@example.com')
  assert.equal(r.lead.phone, '+12505550123')
  assert.equal(r.lead.kind, 'quote')
  assert.equal(r.lead.submitted_at, '2026-10-16T12:00:00.000Z')
})

test('a bot that fills the hidden website field is dropped quietly, not forwarded', () => {
  /** The honeypot is invisible to people; anything in it means a bot. Reply 200
   *  so the bot learns nothing, but never forward it to Kayla. */
  const r = buildLead(base({ website: 'http://spam.example' }), NOW)
  assert.equal(r.ok, true)
  assert.equal(r.spam, true)
})

test('a form submitted faster than a person could type is treated as a bot', () => {
  const r = buildLead(base({ elapsed_ms: 400 }), NOW)
  assert.equal(r.spam, true)
})

test('an unknown form type is refused so the webhook only gets forms the site has', () => {
  const r = buildLead(base({ kind: 'admin_reset' }), NOW)
  assert.equal(r.ok, false)
  assert.equal(r.status, 400)
})

test('a lead with no way to reach the person is refused', () => {
  /** Kayla can't follow up without an email or phone, and contactless posts
   *  are how junk floods a CRM. */
  const r = buildLead(base({ fields: { 'q-name': 'Sam' } }), NOW)
  assert.equal(r.ok, false)
  assert.equal(r.status, 422)
})

test('a malformed email is not accepted as the contact method', () => {
  const r = buildLead(base({ fields: { 'q-name': 'Sam', 'q-email': 'not-an-email' } }), NOW)
  assert.equal(r.ok, false)
})

test('oversized or non-text fields are trimmed or dropped before reaching GHL', () => {
  const huge = 'x'.repeat(5000)
  const r = buildLead(base({ fields: { 'q-name': 'Sam', 'q-email': 'sam@example.com', notes: huge, obj: { a: 1 }, num: 3 } }), NOW)
  assert.equal(r.ok, true)
  assert.equal(r.lead.fields.notes.length, 2000)
  assert.equal('obj' in r.lead.fields, false)
  assert.equal(r.lead.fields.num, '3')
})

test('more than 60 fields is refused', () => {
  const fields = { 'q-email': 'sam@example.com' }
  for (let i = 0; i < 61; i++) fields['f' + i] = 'v'
  assert.equal(buildLead(base({ fields }), NOW).ok, false)
})

test('a non-object body is refused', () => {
  assert.equal(buildLead(null, NOW).ok, false)
  assert.equal(buildLead('quote', NOW).ok, false)
  assert.equal(buildLead([], NOW).ok, false)
})

test("a commercial request names the contact person, not the business", () => {
  /** The commercial form lists the business before the person; GHL's contact
   *  name must be the human Kayla will phone. */
  const r = buildLead(base({ kind: 'commercial', fields: { 'c-biz': 'Lakeview Dental', 'c-name': 'Ana Ruiz', 'c-email': 'ana@lakeview.example' } }), NOW)
  assert.equal(r.lead.name, 'Ana Ruiz')
  assert.equal(r.lead.fields['c-biz'], 'Lakeview Dental')
})

test('every form on the site has a known kind', () => {
  for (const k of ['quote', 'booking', 'commercial', 'referral_signup', 'referral_invite', 'partner', 'gift_card_request', 'newsletter']) {
    assert.ok(KINDS.has(k), k)
  }
})
