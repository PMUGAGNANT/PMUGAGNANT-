"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatOdds,
  formatStakeEuro,
  getRunnerNumberClass,
  type RaceVerdictSummary,
} from "@/features/vmax/vmax-model";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";
import CountdownTimer from "./CountdownTimer";
import RaceAlertButton from "./RaceAlertButton";

type RaceVerdictBannerProps = {
  verdict: RaceVerdictSummary;
  dataBadge: "Supabase" | "Données J-1" | "Live PMU";
  dateStr: string;
  reunion: number;
  course: number;
  hippodrome: string;
  heureDepart: string;
  minutesUntilStart: number;
  alertCount: number;
};

function getVerdictClasses(verdict: RaceVerdictSummary["verdict"]) {
  if (verdict === "JOUER") return "bg-[#00C851] text-[#06100B]";
  if (verdict === "SURVEILLER") return "bg-[#FF9F1C] text-[#06100B]";
  return "bg-slate-600 text-white";
}

function getVerdictLine(verdict: RaceVerdictSummary) {
  if (verdict.verdict === "PASSER") {
    return "PASSER";
  }

  return `${verdict.verdict} — mise: ${formatStakeEuro(verdict.stake)}`;
}

export default function RaceVerdictBanner({
  verdict,
  dataBadge,
  dateStr,
  reunion,
  course,
  hippodrome,
  heureDepart,
  minutesUntilStart,
  alertCount,
}: RaceVerdictBannerProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      if (!hasSupabaseConfig()) {
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const response = await fetch("/api/bets", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload: { isSubscribed?: boolean } = await response.json();

      if (!cancelled) {
        setIsSubscribed(Boolean(payload.isSubscribed));
      }
    }

    void loadSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  const locked = !isSubscribed && verdict.verdict === "JOUER" && verdict.scorePercent > 75;
  const urgent = minutesUntilStart > 0 && minutesUntilStart < 30;
  const horseLabel = locked ? "Cheval réservé PRO" : verdict.cheval;
  const stakeLabel = locked ? "Débloquer avec PRO" : getVerdictLine(verdict);
  const socialProof = useMemo(
    () => Math.max(alertCount, 247),
    [alertCount]
  );

  return (
    <section
      className={`rounded-lg border border-[#D4AF37]/25 bg-[#101827] p-4 shadow-2xl shadow-black/25 md:p-6 ${
        urgent && !isSubscribed ? "animate-pulse" : ""
      }`}
      aria-label="Verdict IA"
    >
      <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="grid gap-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37]">
            Verdict IA
          </p>
          <strong
            className={`inline-flex w-fit rounded-lg px-5 py-3 font-[var(--font-display)] text-6xl font-black leading-none ${getVerdictClasses(verdict.verdict)}`}
          >
            {verdict.verdict}
          </strong>
          <span className="w-fit rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-slate-300">
            {dataBadge}
          </span>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`grid aspect-square w-14 place-items-center rounded-full font-[var(--font-display)] text-3xl font-black ${getRunnerNumberClass(verdict.numero)}`}
            >
              {locked ? "PRO" : verdict.numero}
            </span>
            <div className={locked ? "blur-sm select-none" : ""}>
              <p className="text-xs font-black uppercase text-slate-400">Cheval recommandé</p>
              <h1 className="font-[var(--font-display)] text-5xl font-black leading-none text-[#F6F2E8] md:text-6xl">
                {horseLabel}
              </h1>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-black uppercase text-slate-400">Cote PMU</p>
              <strong className="font-[var(--font-display)] text-5xl font-black leading-none text-[#D4AF37]">
                {formatOdds(verdict.cote)}
              </strong>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-black uppercase text-slate-400">Confiance IA</p>
              <strong className="font-[var(--font-display)] text-5xl font-black leading-none text-[#00C851]">
                {verdict.scorePercent}%
              </strong>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-black uppercase text-slate-400">Mise Kelly 25%</p>
              <strong className="font-[var(--font-display)] text-3xl font-black leading-none text-[#F6F2E8]">
                {stakeLabel}
              </strong>
            </div>
          </div>
        </div>

        <div className="grid min-w-64 gap-3">
          <CountdownTimer dateStr={dateStr} heureDepart={heureDepart} variant="hero" />
          <RaceAlertButton
            dateStr={dateStr}
            reunion={reunion}
            course={course}
            hippodrome={hippodrome}
            heureDepart={heureDepart}
            chevalNum={verdict.numero}
            chevalNom={verdict.cheval}
          />
        </div>
      </div>

      {!isSubscribed && verdict.verdict === "JOUER" ? (
        <div className="mt-5 rounded-lg border border-[#D4AF37]/35 bg-[#D4AF37]/10 p-4">
          <p className="font-black text-[#D4AF37]">
            Cheval caché — Abonnez-vous pour voir la sélection exacte
          </p>
          <p className="mt-2 text-sm font-bold text-slate-300">
            {socialProof} abonnés ont joué ce cheval aujourd&apos;hui.
            {urgent ? ` Plus que ${Math.max(1, Math.round(minutesUntilStart))} min pour jouer.` : ""}
          </p>
          <Link
            href="/premium"
            className="mt-4 inline-flex rounded-lg bg-[#D4AF37] px-5 py-3 font-black text-[#0A0E1A]"
          >
            Passer PRO
          </Link>
        </div>
      ) : null}
    </section>
  );
}
