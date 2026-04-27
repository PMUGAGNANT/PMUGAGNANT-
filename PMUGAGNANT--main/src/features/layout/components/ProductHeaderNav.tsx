"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardHeaderAccount from "@/components/dashboard/DashboardHeaderAccount";

type ProductHeaderNavProps = {
  statusLabel?: string;
};

const PRODUCT_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/value-bets", label: "Value Bets" },
  { href: "/stats", label: "Stats" },
  { href: "/mes-paris", label: "Mon compte" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProductHeaderNav({
  statusLabel = "LIVE",
}: ProductHeaderNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#D4AF37]/20 bg-[#080A12]/92 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1480px] grid-cols-[auto_auto_1fr_auto_auto] items-center gap-4 px-4 py-3 md:px-6">
        <Link
          href="/dashboard"
          className="font-[var(--font-display)] text-[1.65rem] font-black tracking-[0.08em] text-[#D4AF37] no-underline"
        >
          PMU GAGNANT
        </Link>

        <span className="inline-flex items-center rounded-full border border-[#00C851]/35 bg-[#00C851]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#00C851]">
          {statusLabel}
        </span>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center justify-center gap-1 md:flex"
        >
          {PRODUCT_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
                  active
                    ? "bg-white/8 text-[#D4AF37]"
                    : "text-white/70 hover:bg-white/6 hover:text-[#D4AF37]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <details className="relative justify-self-end md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white">
            Menu
          </summary>
          <nav className="absolute right-0 top-[calc(100%+10px)] grid min-w-[190px] gap-1 rounded-lg border border-[#D4AF37]/20 bg-[#080A12] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            {PRODUCT_NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={`mobile-${item.href}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-3 text-xs font-black uppercase tracking-[0.08em] ${
                    active
                      ? "bg-white/8 text-[#D4AF37]"
                      : "text-white hover:bg-white/6"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </details>

        <DashboardHeaderAccount />
      </div>
    </header>
  );
}
