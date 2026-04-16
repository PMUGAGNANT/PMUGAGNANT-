"use client";

import { useState } from "react";

const TELEGRAM_APP_URL = "https://t.me/pmupredictionbot?start=pmugagnant";
const TELEGRAM_WEB_URL = "https://web.telegram.org/k/#@pmupredictionbot";

export function TelegramCTA() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(TELEGRAM_APP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

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
            Ouvre le bot Telegram gratuit
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--pmu-text-soft)]">
            Ouvre le bot, puis appuie sur Start. Si Telegram ne s&apos;ouvre pas automatiquement, copie le lien et colle-le dans l&apos;app.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 md:items-end">
          <a
            href={TELEGRAM_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-center text-sm font-black uppercase tracking-wide text-white transition hover:opacity-90"
            style={{ background: "#0088CC" }}
          >
            OUVRIR LE BOT →
          </a>
          <a
            href={TELEGRAM_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-center text-xs font-black uppercase tracking-wide transition hover:opacity-90"
            style={{
              borderColor: "color-mix(in srgb, #0088CC 45%, transparent)",
              color: "var(--pmu-text)",
              background: "color-mix(in srgb, #0088CC 10%, var(--pmu-surface))",
            }}
          >
            OUVRIR DANS L&apos;APP
          </a>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-center text-xs font-black uppercase tracking-wide transition hover:opacity-90"
            style={{
              borderColor: "color-mix(in srgb, #0088CC 45%, transparent)",
              color: "var(--pmu-text)",
              background: "color-mix(in srgb, #0088CC 10%, var(--pmu-surface))",
            }}
          >
            {copied ? "LIEN COPIÉ" : "COPIER LE LIEN"}
          </button>
        </div>
      </div>
    </section>
  );
}
