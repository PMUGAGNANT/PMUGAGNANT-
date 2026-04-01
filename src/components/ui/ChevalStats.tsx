"use client";

import type { ScoredParticipant } from "@/lib/types";

type ChevalStatsProps = {
  runner: ScoredParticipant;
  /** Score algo médian du peloton pour approx. IMDC */
  medianFieldScoreAlgo: number;
  estTrot: boolean;
};

function reposTone(days: number | null | undefined): {
  label: string;
  color: string;
  emoji: string;
} {
  if (days == null || !Number.isFinite(days)) {
    return { label: "Repos inconnu", color: "var(--pmu-text-muted)", emoji: "—" };
  }
  if (days < 9) return { label: "trop court", color: "#ff9800", emoji: "⚠️" };
  if (days <= 23) return { label: "optimal", color: "#00c853", emoji: "✅" };
  if (days <= 45) return { label: "prolongé", color: "#ffc107", emoji: "⏳" };
  return { label: "trop long", color: "#f44336", emoji: "❌" };
}

function formatImdc(runner: ScoredParticipant, median: number): { text: string; hint: string } {
  const delta = runner.scoreAlgo - median;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0.5) {
    return { text: `+${rounded}`, hint: "Monte de catégorie / champ plus relevé — ⚠️" };
  }
  if (rounded < -0.5) {
    return { text: `${rounded}`, hint: "Descend de catégorie — engagement plus favorable ✅" };
  }
  return { text: `${rounded >= 0 ? "+" : ""}${rounded}`, hint: "Niveau cohérent avec le peloton" };
}

function recentFromMusic(runner: ScoredParticipant): { codes: string[]; emojis: string[] } {
  const pos = runner.musicStats?.recentPositions;
  if (pos && pos.length > 0) {
    const slice = pos.slice(-6);
    const codes = slice.map((p) => (p === 1 ? "1a" : p <= 3 ? `${p}e` : `${p}a`));
    const emojis = slice.map((p) => (p === 1 ? "✅" : p <= 3 ? "✅" : "❌"));
    return { codes, emojis };
  }
  const m = (runner.musique || "").trim();
  if (!m) return { codes: [], emojis: [] };
  const parts = m.split(/\s+/).filter(Boolean).slice(-6);
  return {
    codes: parts,
    emojis: parts.map((p) => (/^1|^1a|^1e|^v/i.test(p) ? "✅" : /[234]/.test(p) ? "✅" : "❌")),
  };
}

export type FerrureBadge = {
  emoji: string;
  label: string;
  className: string;
};

export function getFerrureBadges(ferrure: string | null | undefined, estTrot: boolean): FerrureBadge[] {
  if (!estTrot) return [];
  const f = (ferrure || "").toLowerCase();
  if (!f.trim()) {
    return [{ emoji: "🔩", label: "Ferré — configuration standard", className: "text-[var(--pmu-text-muted)]" }];
  }
  const badges: FerrureBadge[] = [];
  const deffer = f.includes("défer") || f.includes("defer");
  const plaqu = f.includes("plaqu");
  const premiere = f.includes("prem") || f.includes("1ere") || f.includes("1ère");
  if (deffer && premiere) {
    badges.push({
      emoji: "🥕",
      label: "NOUVEAUTÉ FERRURE — À SURVEILLER",
      className: "font-black text-[#00e676]",
    });
  } else if (deffer) {
    badges.push({
      emoji: "👣",
      label: "Déferré D4 — configuration offensive",
      className: "text-[#00c853]",
    });
  }
  if (plaqu) {
    badges.push({ emoji: "🛡️", label: "Plaqué — protection légère", className: "text-[#ffc107]" });
  }
  if (premiere && !deffer) {
    badges.push({
      emoji: "🥕",
      label: "PREMIÈRE FOIS DANS CETTE CONFIG",
      className: "text-[#00e676]",
    });
  }
  if (badges.length === 0) {
    badges.push({ emoji: "🔩", label: "Ferrure : " + (ferrure || ""), className: "text-[var(--pmu-text-soft)]" });
  }
  return badges;
}

export function ChevalStats({ runner, medianFieldScoreAlgo, estTrot }: ChevalStatsProps) {
  const courses = Math.max(0, runner.nombreCourses || 0);
  const vic = Math.max(0, runner.nombreVictoires || 0);
  const plc = Math.max(0, runner.nombrePlaces || 0);
  const winRate = courses > 0 ? (vic / courses) * 100 : 0;
  const placeRate = courses > 0 ? (plc / courses) * 100 : 0;
  const { codes, emojis } = recentFromMusic(runner);
  const days = runner.daysSinceLastRun;
  const rp = reposTone(days);
  const imdc = formatImdc(runner, medianFieldScoreAlgo);
  const ferrureBadges = getFerrureBadges(runner.ferrure, estTrot);

  return (
    <section className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
      <h3 className="text-base font-black text-[var(--pmu-text)]">
        N°{runner.numPmu} — {runner.nom}
      </h3>
      <p className="mt-2 text-sm font-bold text-[var(--pmu-text-soft)]">
        {courses} courses · {vic} victoires · {plc} places
      </p>
      <p className="mt-1 text-sm text-[var(--pmu-text)]">
        Taux victoire : {winRate.toFixed(0)}% · Taux placé : {placeRate.toFixed(0)}%
      </p>

      {codes.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-black uppercase text-[var(--pmu-text-muted)]">Dernières courses</p>
          <div className="mt-1 flex flex-wrap gap-2 font-mono text-sm">
            {codes.map((c, i) => (
              <span key={`${c}-${i}`}>
                {c} {emojis[i] ?? ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-1 text-sm">
        <p>
          <span className="text-[var(--pmu-text-muted)]">Repos </span>
          <span style={{ color: rp.color }} className="font-bold">
            {days != null ? `${Math.round(days)} jours` : "n.c."} {rp.emoji} ({rp.label})
          </span>
        </p>
        <p>
          <span className="text-[var(--pmu-text-muted)]">IMDC (vs peloton) </span>
          <span className="font-black text-[var(--pmu-text)]">{imdc.text}</span>{" "}
          <span className="text-[var(--pmu-text-soft)]">{imdc.hint}</span>
        </p>
      </div>

      {ferrureBadges.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {ferrureBadges.map((b) => (
            <span
              key={b.label}
              className={`rounded-full border border-[var(--pmu-border)] px-2 py-1 text-[10px] font-bold ${b.className}`}
            >
              {b.emoji} {b.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
