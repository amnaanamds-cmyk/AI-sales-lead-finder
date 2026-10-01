import Link from "next/link";
import { supabaseConfigured } from "@/lib/config";
import { EmailLogin } from "./EmailLogin";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" className="text-2xl font-bold">
        Lead<span className="text-emerald-600">Nama</span>
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your first 20 leads every month are free.
        </p>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Sign-in failed. Please try again.
        </p>
      )}
      {supabaseConfigured() ? (
        <>
          <GoogleButton next={typeof next === "string" ? next : undefined} />
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <EmailLogin next={typeof next === "string" ? next : undefined} />
        </>
      ) : (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Sign-in isn&apos;t set up on this server yet (Supabase keys missing). See the README to connect it.
        </p>
      )}
      <Link
        href="/demo"
        className="text-center text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Or try the live demo, no sign-up needed →
      </Link>
    </main>
  );
}
