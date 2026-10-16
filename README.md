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

If delivery fails, the visitor gets their form back and a message to try again
or call.

## Set up GHL (once)

1. In Kayla's sub-account: **Automation → Workflows → New → Inbound Webhook** trigger. Copy its URL.
2. Map `email`, `phone`, `first_name`, `name` to the contact; add `kind` as a tag or branch condition.
3. Add actions: create or update contact, add to pipeline, notify Kayla, and auto-reply by SMS or email.

## Deploy (replaces ascensioncleaningco.netlify.app)

```
npx netlify-cli login
npx netlify-cli link        # choose the existing ascensioncleaningco site
npx netlify-cli env:set GHL_WEBHOOK_URL "https://services.leadconnectorhq.com/hooks/..."
npx netlify-cli deploy --prod
```

Then point Kayla's domain at the site in Netlify → Domain management.

## Commands

- `npm test`: lead rules, page wiring, and what `lead.js` sends
- `node scripts/mutate.mjs`: remove each guard in turn; every one must fail a test
- `node scripts/dev.mjs`: local preview at http://127.0.0.1:8888 with a fake GHL webhook that prints leads
- `npm run prelaunch`: lists what still has to come from Kayla; exits non-zero until done

## Still needed from Kayla

Run `npm run prelaunch` for the current list. Real details go in `public/config.js` and `public/privacy.html`.
