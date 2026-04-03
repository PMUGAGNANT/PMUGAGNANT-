"use client";

const TELEGRAM_URL = "https://t.me/+L5YPZoscEeMxMjM0";

export function TelegramCTA() {
  return (
    <section
      className="app-card overflow-hidden border border-[color-mix(in_srgb,#0088CC_35%,transparent)] p-6 md:p-8"
      style={{ background: "color-mix(in srgb, #0088CC 12%, var(--pmu-surface))" }}
      aria-label="Canal Telegram PMU Gagnant"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-black text-[var(--pmu-text)] md:text-xl">
            📱 Recevoir les signaux en direct
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--pmu-text-soft)]">
            Rejoins le canal Telegram gratuit
          </p>
        </div>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-xl px-6 py-3.5 text-center text-sm font-black uppercase tracking-wide text-white transition hover:opacity-90"
          style={{ background: "#0088CC" }}
        >
          OUVRIR LE CANAL →
        </a>
      </div>
    </section>
  );
}
