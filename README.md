# LeadNama

**Find clients who need you, in 2 minutes, in PKR.**

LeadNama helps Pakistani freelancers and small agencies find local businesses that are
missing a website, reviews or social media, then pitch them in Urdu, Roman Urdu or
English. The full product spec is in [`docs/PROJECT.md`](docs/PROJECT.md).

## Status

| Week | Deliverable | State |
|---|---|---|
| 1 | Auth, search via Places API, lead list, CSV export | ✅ |
| 2 | Website checker + AI scoring | ✅ |
| 3 | Pitch writer (3 languages) + WhatsApp button | ✅ |
| 4 | Pipeline board + credits system | ✅ |
| 5 | Payments (JazzCash) + landing page | ✅ (Easypaisa wallet: not yet) |
| 6–8 | Beta, launch, Product Hunt | Not code |

## Stack

Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) ·
Google Places API (New) · Claude API · JazzCash hosted checkout

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a project and run both files in `supabase/migrations/` in order
   (SQL editor, or `supabase db push`).
3. **Google login:** in Supabase go to *Authentication → Providers → Google* and add your
   Google OAuth client. Add `http://localhost:3000/auth/callback` (and your production
   URL) to *Authentication → URL Configuration → Redirect URLs*.
4. **Places API:** in Google Cloud, enable **Places API (New)** and create a key restricted to it.
5. **Claude API:** create a key at console.anthropic.com.
6. **JazzCash:** get sandbox merchant ID, password and integrity salt from the JazzCash
   merchant portal. Set the return URL there to `<your site>/api/payments/jazzcash/return`.
7. **Env:** `cp .env.example .env.local` and fill it in.
8. **Run:** `npm run dev` and open http://localhost:3000.

## How it works

**Search** (`POST /api/search`). Places Text Search, up to 60 results in Pakistan. One
credit per business *new to the workspace*; seeing a business again is free.

**Website check + scoring** (`POST /api/analyze`). The browser sends results in batches
of 10, two at a time, so scores stream in. For each lead the server:
- crawls the website (`src/lib/sitecheck.ts`): loads? HTTPS? mobile viewport? Facebook /
  Instagram / TikTok / YouTube / LinkedIn links? A Facebook page listed as the "website"
  counts as no website. Private and internal addresses are blocked on every redirect hop.
- scores the batch with **one** Claude call (`claude-haiku-4-5`, structured JSON output)
  using what the user sells: a web dev wants "no website + good reviews", an SEO person
  wants "has site + few reviews" (`src/lib/services.ts`).

Checks are cached for 7 days and scores per service, so re-running a search or reopening
a lead costs nothing.

**Pitches** (`POST /api/pitch`). Written only when a lead is opened (`claude-opus-5`, low
effort, server-side refusal fallback), max 60 words, mentioning the lead's real gap.
Language × tone toggles, editable, saved per lead (capped at 12 per lead).

**Contact.** "Open in WhatsApp" uses `wa.me` with the pitch pre-filled, shown only for
Pakistani mobile numbers (+92 3xx). The user presses send. Opening WhatsApp or calling
moves the lead to *Contacted*.

**Pipeline** (`/pipeline`). New → Contacted → Replied → Meeting → Won/Lost. Drag and
drop on desktop, a stage picker on phones, plus notes and follow-up dates with a
"follow-ups due" count. Card details are fetched live from Google by `place_id`.

**Credits and plans** (`src/lib/plans.ts`, `refresh_credits()` / `consume_credits()`).
Monthly allowance resets lazily on the next request, no cron needed. Pack credits never
expire and are used after the monthly ones. Plans last 30 days per payment and drop back
to Free when they run out.

| | Free | Freelancer | Agency |
|---|---|---|---|
| Leads / month | 20 | 300 | 1,500 |
| Pitch languages | English | All 3 | All 3 |
| Pipeline board | – | ✓ | ✓ |
| CSV export | – | – | ✓ |

These gates follow spec §9 and live in one place (`FEATURES` in `src/lib/plans.ts`).

**Payments** (`/billing`). JazzCash hosted checkout: the customer pays with a JazzCash
wallet or any debit/credit card. The return handler checks the HMAC secure hash, the
transaction reference and the amount, then calls `fulfil_payment()`, which applies the
plan or pack exactly once. Only the service role can write payments.

## Before going live

- **JazzCash:** run a full sandbox payment. Field names and hashing follow the v1.1 page
  redirection guide; confirm them against the guide JazzCash gives you. Consider adding a
  server-to-server status inquiry for extra safety.
- **Easypaisa** wallet checkout isn't built yet. JazzCash already takes cards.
- **Google Places costs:** asking for phone, website and rating puts Text Search and
  Place Details in a higher-priced tier, and the pipeline page makes one Place Details
  call per card (capped at 150). Work out per-lead cost (Places + Claude) against the
  spec's 30% rule before fixing prices.
- **Google terms:** only `place_id` is stored. Business details are shown live with
  "© Google" attribution. Recheck the current Google Maps Platform terms.
- **Agency seats** (5 per workspace) are a v2 item; access checks already go through
  `is_workspace_member()` so it's a single place to extend.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm test` | Unit tests (Vitest) |
