import Link from "next/link";
import { PACKS, PLANS, type Plan } from "@/lib/plans";

const STEPS = [
  { title: "Search", body: "Type a business type and city, like “salons in Peshawar”. Get up to 60 businesses from Google Maps." },
  { title: "Spot the gap", body: "We check each one: no website? Broken site? No Instagram? Few reviews? AI scores who's most likely to buy." },
  { title: "Pitch", body: "Get a short, personal WhatsApp message in Urdu, Roman Urdu or English. Tap once to open it in WhatsApp." },
  { title: "Close", body: "Move each lead from Contacted to Won on your pipeline board, with follow-up reminders." },
];

const FEATURES = [
  {
    title: "A free report they can open",
    body: "Cold messages from unknown numbers get ignored. Send a link to a short check-up of their website, Google reviews and social media, with your quote in PKR. They can save it as a PDF.",
  },
  {
    title: "Know who's interested",
    body: "See the moment a business opens your report. LeadNama puts them at the top of your Today list so you message them while they're thinking about it.",
  },
  {
    title: "Follow-ups that actually happen",
    body: "Most deals need a second message. Today lists who's due and who hasn't replied in 3 days, and writes a polite follow-up in their language.",
  },
  {
    title: "See what's working",
    body: "Reply rate, meetings, clients won and PKR earned, so you know your outreach is paying off.",
  },
];

const SAMPLES = [
  {
    lang: "Roman Urdu",
    text: "Assalam o Alaikum! Aap ke salon ke 4.7 rating aur 180 reviews dekh kar bohat acha laga. Maine notice kiya ke aap ki koi website nahi hai, is liye naye customers online booking nahi kar pate. Main local businesses ke liye simple websites banata hoon. Kya main aap ko ek chhota sa sample dikhaun?",
  },
  {
    lang: "English",
    text: "Hi! Congratulations on your 4.7 rating from 180 Google reviews. I noticed your website doesn't open properly on mobile, where most of your customers are searching. I build fast, mobile-friendly sites for local businesses. Would you be open to a quick look at what I'd change?",
  },
  {
    lang: "اردو",
    text: "السلام علیکم! آپ کے ریسٹورنٹ کی 4.6 ریٹنگ واقعی قابلِ تعریف ہے۔ میں نے دیکھا کہ آپ کا Instagram پیج موجود نہیں، جبکہ آج کل زیادہ تر گاہک وہیں کھانا دیکھ کر آتے ہیں۔ میں سوشل میڈیا سنبھالتا ہوں۔ کیا میں آپ کو چند آئیڈیاز بھیج سکتا ہوں؟",
    rtl: true,
  },
];

const FAQ = [
  {
    q: "Where does the business data come from?",
    a: "Google Maps (Places API). We show it live and only keep Google's place ID, as Google's terms require.",
  },
  {
    q: "Do you send WhatsApp messages for me?",
    a: "No, and that's on purpose. Bulk automated WhatsApp gets numbers banned. LeadNama opens WhatsApp with your message filled in; you press send.",
  },
  {
    q: "How do I pay?",
    a: "In PKR through JazzCash: JazzCash wallet or any debit/credit card. No international card needed, and no auto-renewal.",
  },
  {
    q: "What counts as a lead credit?",
    a: "Each new business that appears in your search results. Seeing the same business again in a later search is free.",
  },
];

function pkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">
      <nav className="flex items-center justify-between py-5">
        <span className="text-xl font-bold">
          Lead<span className="text-emerald-600">Nama</span>
        </span>
        <div className="flex items-center gap-5 text-sm font-medium">
          <Link href="/demo" className="hover:underline">Demo</Link>
          <a href="#pricing" className="hover:underline">Pricing</a>
          <Link href="/login" className="hover:underline">Sign in</Link>
        </div>
      </nav>

      <section className="py-16 text-center sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">For Pakistani freelancers and agencies</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Find clients who need you,
          <br />
          in 2 minutes, in PKR.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-500">
          Stop fighting for foreign gigs. LeadNama finds local businesses with no website, weak social media or few
          reviews, scores who&apos;s most likely to buy, and writes the WhatsApp pitch for you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
          >
            Get 20 free leads every month
          </Link>
          <Link
            href="/demo"
            className="rounded-lg border border-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Try the live demo
          </Link>
        </div>
        <p className="mt-3 text-sm text-zinc-500">Sign in with Google. No card needed. The demo needs no sign-up.</p>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="text-sm font-semibold text-emerald-600">Step {i + 1}</div>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="pb-20">
        <h2 className="text-center text-2xl font-bold">Built to turn messages into clients</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-20">
        <h2 className="text-center text-2xl font-bold">Pitches that sound like you</h2>
        <p className="mt-2 text-center text-zinc-500">Every message mentions the business&apos;s real gap. No fake claims, no hard sell.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SAMPLES.map((s) => (
            <figure key={s.lang} className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <figcaption className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{s.lang}</figcaption>
              <p dir={s.rtl ? "rtl" : "ltr"} className="mt-2 text-sm leading-relaxed">{s.text}</p>
            </figure>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-8 pb-20">
        <h2 className="text-center text-2xl font-bold">Simple pricing in rupees</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {(Object.keys(PLANS) as Plan[]).map((id) => (
            <div
              key={id}
              className={`rounded-xl border p-6 ${id === "freelancer" ? "border-emerald-600 shadow-sm" : "border-zinc-200 dark:border-zinc-800"}`}
            >
              <h3 className="font-semibold">{PLANS[id].name}</h3>
              <p className="mt-2 text-3xl font-bold">
                {PLANS[id].pricePkr ? pkr(PLANS[id].pricePkr) : "Free"}
                {PLANS[id].pricePkr > 0 && <span className="text-base font-normal text-zinc-500">/mo</span>}
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                {PLANS[id].leads.toLocaleString()} leads per month
                <br />
                {PLANS[id].blurb}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Hate subscriptions? Buy credit packs: {PACKS.map((p) => `${p.credits} leads for ${pkr(p.pricePkr)}`).join(" · ")}.
        </p>
      </section>

      <section className="pb-24">
        <h2 className="text-center text-2xl font-bold">Questions</h2>
        <div className="mx-auto mt-6 max-w-2xl divide-y divide-zinc-200 dark:divide-zinc-800">
          {FAQ.map((f) => (
            <details key={f.q} className="py-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-zinc-500">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
        © LeadNama · Made in Pakistan
      </footer>
    </main>
  );
}
