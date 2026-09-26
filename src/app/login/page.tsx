import Link from "next/link";
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
      <GoogleButton next={typeof next === "string" ? next : undefined} />
    </main>
  );
}
