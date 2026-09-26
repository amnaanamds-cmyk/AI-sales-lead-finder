import { SERVICES } from "@/lib/services";
import { saveService } from "./actions";

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <h1 className="text-2xl font-bold">What do you sell?</h1>
      <p className="mt-1 text-zinc-500">
        We use this to score leads and write your pitches.
      </p>
      {error && (
        <p className="mt-4 text-sm text-red-600">Please pick a service.</p>
      )}

      <form action={saveService} className="mt-8 space-y-6">
        <fieldset className="space-y-2">
          {SERVICES.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-3 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 dark:border-zinc-800 dark:has-[:checked]:bg-emerald-950"
            >
              <input type="radio" name="service" value={s.id} required className="accent-emerald-600" />
              {s.label}
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium">Preferred pitch language</span>
          <select
            name="language"
            defaultValue="en"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          >
            <option value="en">English</option>
            <option value="roman_ur">Roman Urdu</option>
            <option value="ur">اردو (Urdu)</option>
          </select>
        </label>

        <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700">
          Continue
        </button>
      </form>
    </main>
  );
}
