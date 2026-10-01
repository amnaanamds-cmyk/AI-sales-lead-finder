# LeadNama

**Find clients who need you, in 2 minutes, in PKR.**

LeadNama helps Pakistani freelancers and small agencies find local businesses that are
missing a website, reviews or social media, pitch them on WhatsApp in Urdu, Roman Urdu or
English, and follow up until they become clients. The product spec is in
[`docs/PROJECT.md`](docs/PROJECT.md).

**Try it:** open `/demo` on any deployment. It runs entirely in the browser with sample
businesses, no sign-up and no API keys. `npm run build:demo` also produces it as a single
HTML file you can host anywhere.

## What it does

| | |
|---|---|
| **Search** | Business type + area + city → up to 60 businesses from Google Maps. One credit per business new to you; seeing it again is free. |
| **Gap check** | Website loads? HTTPS? Mobile-friendly? Facebook/Instagram/TikTok? Few Google reviews? |
| **Lead score** | 0–100 for *your* service: a web developer wants "no website + busy", an SEO person wants "has a site + few reviews". |
| **Pitch** | 60-word WhatsApp message mentioning the business's real gap, in English, Roman Urdu or Urdu, friendly or formal. One tap opens WhatsApp; you press send. |
| **Free report link** | A public page per business (`/r/…`) with a plain-language check-up of their online presence, your note, an optional PKR quote they can save as PDF, and a "Reply on WhatsApp" button. Cold messages from unknown numbers get ignored; a useful report earns a reply. |
| **Report opens** | You see when the business opens it (link-preview bots and your own visits are not counted). |
| **Today** | Who to message now: businesses that opened your report this week, follow-ups due, and anyone contacted 3+ days ago without a reply. One tap writes a polite follow-up that builds on your first message and includes the report link. |
| **Pipeline** | New → Contacted → Replied → Meeting → Won/Lost, with deal values in PKR, notes and follow-up dates. |
| **Results** | Contacted, reply rate, meetings, clients won and PKR earned, plus how many times over the deals have paid for LeadNama. |
| **Referrals** | Each user gets an invite link. When someone joins with it and makes a first payment, the inviter gets a free month. |
| **Payments** | JazzCash hosted checkout (wallet or any card). Plans for 30 days, or credit packs that never expire. |
| **Sign-in** | Google, or an emailed sign-in link. |

**It keeps working when a service is missing or down.** Without a Claude API key (or
during an outage) scores come from rules and pitches from hand-written templates in all
three languages (`src/lib/rules.ts`). Without Supabase keys the public pages and the demo
still work.

## Run it locally (no paid keys needed)

Needs Node 20+ and Docker.

```bash
npm install
npx supabase start            # local Postgres + auth; applies supabase/migrations
cp .env.example .env.local    # then fill in from the `supabase start` output:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#   LEADNAMA_SAMPLE_DATA=1    # search the sample businesses instead of Google
npm run dev                   # http://localhost:3000
```

Sign in with the email link. Locally, emails go to Mailpit at http://127.0.0.1:54324
(enable `[local_smtp]` in `supabase/config.toml` if you turned it off). Add
`ANTHROPIC_API_KEY` for AI scores and pitches, and `GOOGLE_PLACES_API_KEY` (remove
`LEADNAMA_SAMPLE_DATA`) for real businesses.

## Deploy (about 15 minutes)

1. **Supabase:** create a project at supabase.com. Run the three files in
   `supabase/migrations/` in order in the SQL editor (or `npx supabase db push`).
   - *Authentication → Providers:* turn on Email; turn on Google with your Google OAuth
     client if you want Google sign-in.
   - *Authentication → URL Configuration:* set the Site URL to your domain and add
     `https://<your-domain>/auth/callback` to Redirect URLs.
   - For real email volume, add your own SMTP under *Authentication → Emails*.
2. **Google Places:** in Google Cloud enable **Places API (New)** and create a key
   restricted to it.
3. **Claude API:** create a key at console.anthropic.com (optional; templates are used without it).
4. **JazzCash:** get the merchant ID, password and integrity salt from the JazzCash
   merchant portal and set the return URL to `https://<your-domain>/api/payments/jazzcash/return`.
5. **Vercel:** import the GitHub repo at vercel.com/new and add the variables from
   `.env.example` (`NEXT_PUBLIC_SITE_URL` = your domain). Deploy.

Then share `https://<your-domain>/demo` with anyone, and your own invite link from Settings.

## Project layout

```
src/app/            pages and API routes (search, today, pipeline, billing, settings, r/[token], demo)
src/components/     LeadPanel, ReportEditor, ReportView, AppHeader
src/lib/api.ts      the UI's backend interface; api.real.ts (server) and app/demo/demoStore.ts (browser)
src/lib/rules.ts    rule-based scores, template pitches/follow-ups, report findings
src/lib/ai.ts       Claude scoring (claude-haiku-4-5), pitches and follow-ups (claude-opus-5)
src/lib/sitecheck.ts website crawler with private-network blocking
supabase/migrations SQL schema, row-level security, credits, payments, reports, referrals
scripts/build-demo.mjs  builds the demo as one HTML file (dist/demo/index.html)
```

## Plans

| | Free | Freelancer | Agency |
|---|---|---|---|
| Price | PKR 0 | PKR 1,500 / 30 days | PKR 5,000 / 30 days |
| Leads / month | 20 | 300 | 1,500 |
| Pitch languages | English | All 3 | All 3 |
| Report links + opens | ✓ | ✓ | ✓ |
| Today, pipeline, follow-ups | – | ✓ | ✓ |
| CSV export | – | – | ✓ |

Gates live in one place (`FEATURES` in `src/lib/plans.ts`). Packs: 100 leads PKR 600,
500 leads PKR 2,500.

## Before going live

- **JazzCash:** run one real sandbox payment end to end and compare the field names with
  the guide JazzCash gives you. Easypaisa wallet checkout isn't built yet.
- **Google Places costs:** phone, website and rating put searches in a higher price tier,
  and Today/Pipeline make one Place Details call per card shown. Check per-lead cost
  against the spec's 30% rule.
- **Google terms:** only `place_id` is stored. Business details are shown live with
  attribution. A report's title is text the user confirms, and its findings are LeadNama's
  own website checks.
- **Not built yet:** agency team seats, saved-search alerts, Easypaisa.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run build:demo` | Self-contained demo page in `dist/demo/index.html` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
