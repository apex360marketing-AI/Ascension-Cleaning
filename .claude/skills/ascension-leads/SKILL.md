---
name: ascension-leads
description: How website leads flow on the Ascension Cleaning site (forms → lead function → Netlify Database + GoHighLevel → owner dashboard). Use when adding or changing a form, a lead field, a lead status, the dashboard, or the database schema.
---

# Ascension leads and dashboard

## The flow

1. A form on `public/index.html` calls `sendLead(kind, root, extra)` from `public/lead.js`.
   That collects typed fields and ticked boxes only: never file inputs or passwords.
2. `POST /.netlify/functions/lead` (`netlify/functions/lead.mjs`) validates the lead with
   the pure, unit-tested `buildLead()` in `netlify/lib/lead.mjs`.
3. The lead is **saved to Netlify Database first** (`leads` table), then forwarded to
   GoHighLevel (`GHL_WEBHOOK_URL`). `ghl_delivered` records GHL's answer: true, false, or
   null when no webhook is set.
4. The visitor gets 200 if the lead was saved **or** delivered. Only when both fail does
   the page hand the form back and ask them to retry.
5. Kayla works leads at `/dashboard/`, backed by `GET/PATCH/DELETE /api/leads[/:id]`
   (`netlify/functions/leads.mts`).

## Auth

- Netlify Identity through `@netlify/identity`. Registration should be **invite-only**.
- The API requires a signed-in user whose roles include **`admin`**. It also checks that
  `Origin` matches the site on every write, because the session is a cookie.
- The browser side is `src/dashboard-auth.js`. The deploy bundles it to
  `public/dashboard/auth.js` (`npm run build:dashboard`, gitignored) and exposes it as
  `window.AscAuth`. `public/dashboard/app.js` is a plain script that only uses `AscAuth`.
- Invite and password-reset emails link to the home page with `#invite_token=`/`#recovery_token=`.
  A one-line script in the `<head>` of `public/index.html` forwards those to `/dashboard/`.
- `acceptInvite()` and `recoverPassword()` don't set the `nf_jwt` cookie by themselves.
  The dashboard calls `login()` right afterwards so the API can read the session.

## Adding a new form kind

1. Add the kind to `KINDS` in `netlify/lib/lead.mjs`.
2. Call `sendLead('<kind>', …)` on the page. `tests/site.test.mjs` lists the kinds it expects.
3. Add a plain-English label to `KINDS` in `public/dashboard/app.js`, and labels for any
   new field ids to `FIELD`. `tests/dashboard.test.mjs` fails if a kind has no label.
4. Run `npm test`, then `node scripts/mutate.mjs` if you touched a guard.

## Changing the schema or statuses

- The schema lives in `db/schema.ts` (Drizzle, `drizzle-orm@beta`). After any change, run
  `npx drizzle-kit generate --name <verb_noun>`. Migrations go to `netlify/database/migrations/`,
  and Netlify applies them on deploy. Never apply, push or hand-edit an applied migration.
- Statuses are `LEAD_STATUSES` in `db/schema.ts` and `STATUSES` in `app.js`. These must
  match in the same order (tested). The UI label for `lost` is "Closed".

## Gotchas

- Everything in a lead is stranger-typed. The dashboard escapes it with `esc()`, and a test
  guards the common fields. Keep it that way for anything new.
- `npm test` is the deploy gate (`npm test && npm run build:dashboard`). Don't import the
  database from anything the tests import: the tests run in plain Node with no database.
- The local database has no tables until a deploy applies the migrations, so
  `netlify dev` logs "not saved to the database". That's expected.
- Photos never leave the visitor's device. The lead only carries `photo_count`.
