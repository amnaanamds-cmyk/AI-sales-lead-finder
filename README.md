# LeadNama

**Find clients who need you, in 2 minutes, in PKR.**

LeadNama helps Pakistani freelancers and small agencies find local businesses that are
missing a website, reviews or social media, then pitch them in Urdu, Roman Urdu or
English. The full product spec is in [`docs/PROJECT.md`](docs/PROJECT.md).

## Status: Week 1

| Week | Deliverable | State |
|---|---|---|
| 1 | Auth, search via Places API, lead list, CSV export | ✅ |
| 2 | Website checker + AI scoring | — |
| 3 | Pitch writer (3 languages) + WhatsApp button | — |
| 4 | Pipeline board + credits system | schema + per-lead credit charging in place |
| 5 | Payments (JazzCash/Easypaisa) + landing page | basic landing page in place |

## Stack

Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Google Places API (New)

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a project, then run `supabase/migrations/0001_init.sql` in the SQL
   editor (or `supabase db push` with the CLI).
3. **Google login:** in Supabase go to *Authentication → Providers → Google*, and add your
   Google OAuth client ID and secret. Add `http://localhost:3000/auth/callback` (and your
   production URL) to *Authentication → URL Configuration → Redirect URLs*.
4. **Places API:** in Google Cloud, enable **Places API (New)** and create an API key
   restricted to it. Keep it server-side only.
5. **Env:** `cp .env.example .env.local` and fill in the three values.
6. **Run:** `npm run dev` and open http://localhost:3000.

## How it works

- `src/proxy.ts` refreshes the Supabase session and sends signed-out users to `/login`.
- On first sign-in a database trigger creates a `profiles` row and a free workspace with
  20 credits. `/onboarding` then asks what the user sells.
- `POST /api/search` runs a Places Text Search (up to 60 results, Pakistan only), charges
  one credit per lead through the `consume_credits` function, and records the search.
- CSV export happens in the browser (UTF‑8 with BOM so Excel shows Urdu correctly, with
  formula-injection escaping).

### Google Places terms

Only `place_id` is stored in `leads`. Business name, phone, website and rating are shown
live and never saved, and the list carries Google attribution. Later features (pipeline,
scoring) should re-fetch details by `place_id` with Place Details. Check the current
Google Maps Platform terms before changing this.

### Cost note

The field mask asks for phone, website and rating. Those fields put Text Search in a
higher-priced SKU. Work out the per-lead cost (Places plus AI tokens) before fixing
prices, per the spec's 30% rule.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |

## Not yet done

- Monthly credit reset (needs a scheduled job; planned with payments in week 5)
- Search history UI (searches are saved, not yet listed)
