import type { BillingNotice } from "@/features/account/lib/bets-model";

export function BillingNoticeCard({ notice }: { notice: BillingNotice }) {
  const color =
    notice.tone === "success"
      ? "var(--pmu-primary)"
      : notice.tone === "loading"
        ? "var(--pmu-accent-blue)"
        : "var(--pmu-orange)";

  const background =
    notice.tone === "success"
      ? "var(--pmu-primary-fade)"
      : notice.tone === "loading"
        ? "color-mix(in srgb, var(--pmu-accent-blue) 10%, transparent)"
        : "color-mix(in srgb, var(--pmu-orange) 8%, transparent)";

  return (
    <section
      className="app-card p-5 md:p-6"
      style={{
        borderColor: `color-mix(in srgb, ${color} 26%, transparent)`,
        background,
      }}
    >
      <p className="app-kicker" style={{ color }}>
        Confirmation abonnement
      </p>
      <h2 className="mt-2 text-2xl font-black leading-tight text-[var(--pmu-text)]">
        {notice.title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
        {notice.message}
      </p>
    </section>
  );
}
