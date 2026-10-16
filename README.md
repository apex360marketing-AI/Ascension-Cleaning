# Ascension — Residential & Commercial Cleaning

Kayla Horricks' cleaning business site (Kelowna / West Kelowna). Static page on
Netlify; every form goes to Kayla's GoHighLevel account through one Netlify
Function.

## How leads flow

Browser form → `public/lead.js` → `POST /.netlify/functions/lead` →
`netlify/lib/lead.mjs` checks it (known form, real email or phone, honeypot,
not submitted in under 1.5 s, size caps) → GHL inbound webhook (`GHL_WEBHOOK_URL`).

Forms wired: quote, booking, commercial walkthrough, referral sign-up and
invite, partner program, gift card request, seasonal list. Each lead carries a
`kind` so one GHL workflow can branch. Uploaded photos stay on the visitor's
device; the lead carries `photo_count`, so have the workflow text them asking
for the photos. Gift cards are requests: no payment is taken on the site, and
Kayla sends a payment link.

Every lead is also saved to Netlify Database first, so nothing is lost if GHL
is down. The visitor only gets their form back, with a message to try again or
call, if the lead could be neither saved nor delivered.

## Lead dashboard (`/dashboard/`)

Kayla's private Lead Desk: an overview (new leads waiting, this week, bookings,
win rate, leads per week, which forms bring them in), a filterable and searchable
lead list, and a detail panel for each lead with call/text/email buttons, a stage
(New → Contacted → Quoted → Booked / Closed) and notes.

Access goes through Netlify Identity. To set it up once:

1. Netlify → **Project configuration → Identity**: set registration to **Invite only**.
2. **Identity → Invite users**: invite Kayla. The email link lets her choose a password.
3. Once she's accepted, click her name and add the role **`admin`**. Without it she
   sees a "no access yet" screen.

## Set up GHL (once)

1. In Kayla's sub-account: **Automation → Workflows → New → Inbound Webhook** trigger. Copy its URL.
2. Map `email`, `phone`, `first_name`, `name` to the contact; add `kind` as a tag or branch condition.
3. Add actions: create or update contact, add to pipeline, notify Kayla, and auto-reply by SMS or email.

## Deploy (replaces ascensioncleaningco.netlify.app)

```
npm test                                   # the gate: deploy only on green
npx netlify-cli login
npx netlify-cli link --id 1164a89a-18f8-44b4-97db-34bf771f236d   # ascensioncleaningco
npx netlify-cli env:set GHL_WEBHOOK_URL "https://services.leadconnectorhq.com/hooks/..."
npx netlify-cli deploy --no-build          # draft → check it with scripts/smoke.mjs
npx netlify-cli deploy --no-build --prod   # live
node scripts/smoke.mjs https://ascensioncleaningco.netlify.app --send-test-lead
```

`--no-build` is needed because the site's dashboard settings still carry the
old Next.js app's build command and plugins. That site is also connected to the
GitHub repo `cleaning-ascension-3060e8`: a push there redeploys the old app over
this one. Either push this project to that repo, or unlink the repo in Netlify
(Project configuration → Build & deploy → Continuous deployment).

Then point Kayla's domain at the site in Netlify → Domain management.

## Commands

- `npm test`: lead rules, page wiring, and what `lead.js` sends
- `node scripts/mutate.mjs`: remove each guard in turn; every one must fail a test
- `node scripts/dev.mjs`: local preview at http://127.0.0.1:8888 with a fake GHL webhook that prints leads
- `npm run prelaunch`: lists what still has to come from Kayla; exits non-zero until done

## Still needed from Kayla

Run `npm run prelaunch` for the current list. Real details go in `public/config.js` and `public/privacy.html`.
