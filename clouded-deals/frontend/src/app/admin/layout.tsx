"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "grid" },
  { href: "/admin/analytics", label: "Analytics", icon: "chart" },
  { href: "/admin/scraper", label: "Scraper", icon: "terminal" },
  { href: "/admin/settings", label: "Settings", icon: "sliders" },
] as const;

const ICONS: Record<string, string> = {
  grid: "M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4Zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z",
  chart: "M3 3v18h18M7 16l4-4 4 4 5-6",
  terminal:
    "M5.5 7.5 9 11l-3.5 3.5M12 17h6",
  sliders:
    "M12 3v4m0 14v-4m-7-5H3m4 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm14 0h-2m-4 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM8 17H3m4 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm14 0h-7",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [noSession, setNoSession] = useState(false);

  // ----- Auth check -----
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No Supabase — allow access for development / preview
      setUser("dev@localhost");
      setChecking(false);
      return;
    }

    let subscription: { unsubscribe: () => void } | undefined;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          // Allow access but show a warning — don't block the admin panel
          setUser("unauthenticated");
          setNoSession(true);
          setChecking(false);
          return;
        }
        setUser(session.user.email ?? session.user.id);
        setChecking(false);
      } catch {
        // Auth failed — allow through for dev
        setUser("dev@localhost");
        setChecking(false);
      }
    })();

    try {
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setUser(session.user.email ?? session.user.id);
          setNoSession(false);
        } else {
          setNoSession(true);
        }
      });
      subscription = sub;
    } catch {
      // Auth listener not available
    }

    return () => subscription?.unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <Link
            href="/admin"
            className="text-lg font-bold text-green-600 dark:text-green-400"
          >
            CloudedDeals
          </Link>
          <p className="mt-0.5 text-xs text-zinc-400">Admin Panel</p>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={ICONS[icon]}
                  />
                </svg>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            &larr; Back to site
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {NAV_ITEMS.find(
              (n) =>
                n.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(n.href)
            )?.label ?? "Admin"}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{user}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Auth warning */}
        {noSession && (
          <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Not signed in — admin data is read-only. Sign in for full access.
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
