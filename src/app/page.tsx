import Link from "next/link";

const STEPS = [
  { title: "Search", body: "Type a business type and city — “salons in Peshawar”." },
  { title: "Spot the gap", body: "See who has no website, few reviews or no social pages." },
  { title: "Pitch", body: "Send a ready-made message in Urdu, Roman Urdu or English." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4">
      <nav className="flex items-center justify-between py-5">
        <span className="text-xl font-bold">
          Lead<span className="text-emerald-600">Nama</span>
        </span>
        <Link href="/login" className="text-sm font-medium hover:underline">
          Sign in
        </Link>
      </nav>

      <section className="py-16 text-center sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Find clients who need you,
          <br />
          in 2 minutes, in PKR.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-500">
          LeadNama finds local Pakistani businesses that are missing a website, reviews
          or social media — and helps you pitch them.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Get 20 free leads
        </Link>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="text-sm font-semibold text-emerald-600">Step {i + 1}</div>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
