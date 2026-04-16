"use client";

import { useEffect, useState } from "react";
import { applyReferralCode } from "@/lib/referral-client";
import { normalizeReferralCode } from "@/lib/referral";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type ReferralInputProps = {
  defaultCode?: string;
};

export function ReferralInput({ defaultCode = "" }: ReferralInputProps) {
  const [code, setCode] = useState(() => normalizeReferralCode(defaultCode));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    setCode(normalizeReferralCode(defaultCode));
  }, [defaultCode]);

  async function handleApply() {
    setMessage("");

    if (!hasSupabaseConfig()) {
      setTone("error");
      setMessage("Connexion indisponible pour le moment.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setTone("info");
      setMessage("Cree ou connecte ton compte, puis le code sera applique.");
      return;
    }

    setLoading(true);

    try {
      const successMessage = await applyReferralCode(code, session.access_token);
      setTone("success");
      setMessage(successMessage);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  const toneClass =
    tone === "success"
      ? "border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-fade)] text-[var(--pmu-primary)]"
      : tone === "error"
        ? "border-[color-mix(in_srgb,var(--pmu-red)_26%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_10%,transparent)] text-[var(--pmu-red)]"
        : "border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] text-[var(--pmu-text-soft)]";

  return (
    <section className="mt-6 rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] p-5">
      <p className="app-kicker">Code parrainage</p>
      <h3 className="mt-3 text-2xl font-black leading-[1.02] text-[var(--pmu-text)]">
        Tu as un code invite ?
      </h3>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
        Entre-le ici pour activer 7 jours premium offerts.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr),auto]">
        <input
          value={code}
          onChange={(event) => setCode(normalizeReferralCode(event.target.value))}
          placeholder="ABC12345"
          maxLength={8}
          className="app-input font-mono text-base font-black uppercase tracking-[0.18em]"
        />
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={loading || code.length < 4}
          className="app-button-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Validation..." : "Valider mon code"}
        </button>
      </div>

      {defaultCode ? (
        <p className="mt-3 text-sm font-semibold text-[var(--pmu-primary)]">
          Code detecte automatiquement depuis ton lien d&apos;invitation.
        </p>
      ) : null}

      {message ? (
        <div className={`mt-4 rounded-[1rem] border px-4 py-3 text-sm font-semibold leading-7 ${toneClass}`}>
          {message}
        </div>
      ) : null}
    </section>
  );
}
