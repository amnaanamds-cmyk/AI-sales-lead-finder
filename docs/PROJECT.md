# LeadNama: Full Project Detail

## 1. The idea
An AI tool for Pakistani freelancers and small agencies. You type a business type and a city ("salons in Peshawar"). It finds matching businesses, checks what they're missing (website, reviews, social media), scores how likely they are to buy, and writes a ready-to-send pitch in Urdu, Roman Urdu, or English.

**One-line pitch:** "Find clients who need you, in 2 minutes, in PKR."

## 2. The problem
- Pakistan has a huge freelancer base, but most compete on Fiverr/Upwork for foreign clients while local businesses go unserved.
- Finding local clients today means scrolling Google Maps, checking each business by hand, and writing every message from scratch. That's hours per day.
- Global tools (Apollo, Clay, Hunter, Ami AI) are priced in dollars, need international cards, and have weak data on Pakistani small businesses.

## 3. Target users
1. **Freelancers:** web devs, designers, social media managers, SEO people, video editors.
2. **Small agencies (2–15 people):** digital marketing and software houses.
3. **Later:** B2B sellers (POS systems, accounting software, even HOSTIX) who need local sales leads.

## 4. Features

**MVP (v1)**
- **Lead search:** by category + city/area, pulled from the Google Places API.
- **Digital gap check:** for each business:
  - Has a website? Does it load? Is it mobile-friendly? SSL?
  - Rating and review count
  - Facebook/Instagram links found on their site
- **AI lead score (0–100):** Claude judges fit based on the user's service. A web dev wants "no website + good reviews"; an SEO person wants "has website + few reviews".
- **AI pitch writer:** a personalized message per lead that references its actual gap, with a language toggle (Urdu / Roman Urdu / English) and a tone toggle (formal / friendly).
- **Pipeline board:** New → Contacted → Replied → Meeting → Won/Lost.
- **One-click contact:** opens WhatsApp or the phone dialer with the pitch pre-filled. The user sends it manually.
- **Export:** CSV.

**v2 (after first paying users)**
- Saved searches with alerts ("5 new cafés opened in Hayatabad")
- Follow-up reminders and AI follow-up messages
- Team seats and lead assignment for agencies
- Proposal generator: turn a won lead into a PDF quote
- Chrome extension to score any business website you visit
- Portfolio matching: attach your past work, and the AI picks the best sample per lead

## 5. User flow
1. Sign up (Google login) and pick your service ("I build websites").
2. Search: "Restaurants, University Road, Peshawar"
3. Get a list of ~20–60 businesses, sorted by AI score.
4. Tap a lead to see its gaps, score reason, and draft pitch.
5. Edit if needed, tap WhatsApp, send.
6. Move the card on the pipeline board as the deal progresses.

## 6. Tech stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + Tailwind | Fast to build, good with Claude Code |
| Backend/DB/Auth | Supabase | Postgres, auth, row-level security for multi-tenant |
| Business data | Google Places API | Best coverage in Pakistan |
| Website check | Serverless crawler (fetch + HTML parse) | Detect site, SSL, mobile, social links |
| AI | Claude API | Scoring + pitches, strong in Urdu |
| Payments | JazzCash / Easypaisa (Safepay as an option) | Local cards and wallets |
| Hosting | Vercel | Free tier to start |
| Background jobs | Supabase Edge Functions or a queue | Crawl and score leads in parallel |

## 7. Database (core tables)
- `users`: id, name, email, service_type, language_pref
- `workspaces`: id, owner_id, plan, credits_left
- `searches`: id, workspace_id, query, city, created_at
- `leads`: id, workspace_id, place_id, name, phone, website, rating, review_count
- `lead_checks`: lead_id, has_site, site_live, ssl, mobile_ok, socials
- `lead_scores`: lead_id, score, reason
- `pitches`: lead_id, language, tone, text
- `pipeline`: lead_id, stage, notes, next_followup
- `payments`: workspace_id, amount, method, status

> Implementation note: `users` is `public.profiles` (Supabase owns `auth.users`), and
> `leads` stores only `place_id` plus our own data. Name, phone, website and rating are
> fetched live from Google when needed, per section 11. See
> `supabase/migrations/0001_init.sql`.

## 8. AI design
**Scoring prompt (returns JSON):**
> You are a sales analyst. The user sells: {service}. Here is a business: {name, category, rating, reviews, website status, socials}. Score 0–100 how likely they need and can pay for this service. Return only JSON: {"score": n, "reason": "one sentence", "main_gap": "..."}

**Pitch prompt:**
> Write a short WhatsApp message (max 60 words) in {language}, {tone} tone, from a {service} provider to {business}. Mention this specific gap: {main_gap}. Mention one compliment (e.g., their rating). End with a soft question, not a hard sell. No fake claims.

**Cost control:**
- Use a small, cheap Claude model for scoring and a stronger one only for pitches.
- Score in batches of 10 leads per call.
- Generate pitches only when the user opens a lead, not for all 60 upfront.

## 9. Pricing
| Plan | Price | Includes |
|---|---|---|
| Free | PKR 0 | 20 leads/month, English pitches only |
| Freelancer | ~PKR 1,500/mo | 300 leads, all languages, pipeline |
| Agency | ~PKR 5,000/mo | 1,500 leads, 5 seats, exports |
| Credit packs | Pay-as-you-go | For users who hate subscriptions |

**Revenue math:** 200 freelancers × 1,500 + 30 agencies × 5,000 = **PKR 450,000/month**.

**Cost check:** each lead costs a Places API call plus AI tokens. Calculate the per-lead cost before fixing prices, and keep it under ~30% of what you charge.

## 10. Go-to-market
1. **Pre-launch:** a landing page plus a waitlist. Post "I found 50 Peshawar restaurants with no website in 2 min" in Pakistani freelancer Facebook groups and on LinkedIn.
2. **Beta:** 30 free users in exchange for feedback and testimonials.
3. **Content:** short videos showing a real search leading to a real client win.
4. **Partnerships:** freelancing trainers and courses (DigiSkills-style communities).
5. **Referrals:** a free month for each paying referral.
6. **Product Hunt:** launch once there are testimonials and a demo video.

## 11. Legal and risks
- **Google Places terms:** strict about storing Places data long-term and require Google attribution. Store `place_id` and refresh details when needed rather than keeping a permanent copy. Read the current terms before building. OpenStreetMap is a free backup, but its Pakistan coverage is thinner.
- **No LinkedIn or Facebook scraping.** It violates their terms and gets you blocked.
- **No automated bulk WhatsApp.** Numbers get banned, and it's spam. Keep sending manual, one tap per lead.
- **Data:** only use public business info. Don't collect personal data about owners beyond what's on the business listing.
- **Competition:** big tools could add Pakistan support. The moat is local language, local payments, local pricing, and community.

## 12. Build roadmap
| Week | Deliverable |
|---|---|
| 1 | Auth, search via Places API, lead list, CSV export |
| 2 | Website checker + AI scoring |
| 3 | Pitch writer (3 languages) + WhatsApp button |
| 4 | Pipeline board + credits system |
| 5 | Payments (JazzCash/Easypaisa) + landing page |
| 6 | Beta with 30 users, fix issues |
| 7–8 | Public launch + Product Hunt |

## 13. Success metrics
- **Activation:** % of signups who run a search and open a pitch
- **Reply rate:** users report replies, which proves the pitches work
- **Free → paid conversion:** aim for 5%+
- **Churn:** users who win a client stay. Track "client won" as the north-star metric.
