import Link from "next/link";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/billing", label: "Billing" },
  { href: "/onboarding", label: "Settings" },
];

export function AppHeader({ name, active }: { name: string; active: string }) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/search" className="text-lg font-bold">
            Lead<span className="text-emerald-600">Nama</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={
                  n.href === active
                    ? "font-semibold text-emerald-700 dark:text-emerald-400"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-zinc-500 sm:inline">{name}</span>
          <form action="/auth/signout" method="post">
            <button className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
