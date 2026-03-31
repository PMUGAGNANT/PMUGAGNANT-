"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { asArray } from "@/lib/array-utils";
import { fromIsoDate, getTodayDateStr, parsePmuDate } from "@/lib/date-utils";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import type { RaceAnalysis, RaceSummary, ScoredParticipant } from "@/lib/types";

interface ArrivalRow {
  position: number | null;
  numPmu: number;
  nom: string;
  jockey: string | null;
  entraineur: string | null;
}

interface RaceApiResponse {
  success: boolean;
  courseInfo: RaceSummary;
  officialArrival: ArrivalRow[];
  minutesUntilStart: number;
  pronoAvailable: boolean;
  isFinished: boolean;
  analysis: RaceAnalysis | null;
  paywall?: {
    required: boolean;
    preview?: {
      lisibilite: string;
      recommendation: string | null;
      favori: { numPmu: number; nom: string } | null;
    } | null;
  } | null;
  error?: string;
}

/* ─── Palette (mode clair, teal pro) ─────────────────── */
const G = "#0d9488";
const G_DIM = "rgba(13, 148, 136, 0.12)";
const DARK = "#f0f4f9";
const DARK_GLASS = "rgba(255, 255, 255, 0.88)";
const CARD = "#ffffff";
const CARD2 = "#f8fafc";
const CARD_HI = "#f1f5f9";
const BORDER = "rgba(15, 23, 42, 0.1)";
const BORDER_SOFT = "rgba(15, 23, 42, 0.06)";
const MUTED = "#64748b";
const WHITE = "#0f172a";
const GOLD = "#d97706";
const GOLD_DIM = "rgba(217, 119, 6, 0.1)";
const RED = "#e11d48";
const RED_DIM = "rgba(225, 29, 72, 0.1)";
const BLUE = "#2563eb";
const BLUE_DIM = "rgba(37, 99, 235, 0.1)";
const VIOLET = "#7c3aed";

/* ─── Helpers (identiques) ─────────────────────────────── */
function round1(v: number) { return Math.round(v * 10) / 10; }

function normalizeSelectedDate(raw: string | null) {
  if (!raw) return getTodayDateStr();
  if (/^\d{8}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fromIsoDate(raw);
  return getTodayDateStr();
}

function formatDateLabel(d: string) {
  return parsePmuDate(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatCurrency(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  return `${new Intl.NumberFormat("fr-FR").format(v)} EUR`;
}

function formatOdds(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  return Number(v).toFixed(1);
}

function formatPercent(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${Math.round(Number(v) * 100)}%`;
}

function formatCountdown(m: number) {
  if (m <= 0) return "Départ imminent";
  if (m < 60) return `Dans ${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const mn = Math.round(m % 60);
  return `Dans ${h}h${String(mn).padStart(2, "0")}`;
}

function formatRevealTime(m: number) {
  const r = m - 30;
  if (r <= 0) return "Ouverture imminente";
  return `Ouverture dans ${formatCountdown(r).replace(/^Dans /, "")}`;
}

function formatPosition(p: number | null | undefined) {
  if (!p) return "n.c.";
  return p === 1 ? "1er" : `${p}e`;
}

function getHumanLead(p: ScoredParticipant | null, estPlat: boolean): { label: string; value: string } {
  if (!p) return { label: "Repère humain", value: "Info humaine indisponible" };
  const list = estPlat
    ? [{ label: "Jockey", value: p.jockey }, { label: "Driver", value: p.driver }, { label: "Entraîneur", value: p.entraineur }]
    : [{ label: "Driver", value: p.driver }, { label: "Jockey", value: p.jockey }, { label: "Entraîneur", value: p.entraineur }];
  const m = list.find(e => e.value && e.value.trim().length > 0);
  return m ? { label: m.label, value: m.value!.trim() } : { label: "Repère humain", value: "Info humaine indisponible" };
}

function getHumanReference(p: ScoredParticipant | null, estPlat: boolean) {
  const l = getHumanLead(p, estPlat);
  return `${l.label}: ${l.value}`;
}

function formatTicketType(t: string | null | undefined) {
  if (!t) return "Lecture prudente";
  switch (t) {
    case "GAGNANT": return "Simple gagnant";
    case "PLACE": return "Simple place";
    case "COUPLE_GAGNANT": return "Couple gagnant";
    case "COUPLE_PLACE": return "Couple place";
    default: return t;
  }
}

function describeLisibilite(l: string) {
  switch (l) {
    case "LISIBLE": return "Course propre, hiérarchie plus fiable.";
    case "COMPLEXE": return "Course ouverte, écarts plus serrés.";
    default: return "Course trop diffuse pour une lecture nette.";
  }
}

function formatObjective(o: ScoredParticipant["prediction"]["objective"] | null | undefined) {
  switch (o) {
    case "GAGNE": return "Vise la gagne";
    case "PODIUM": return "Profil podium";
    case "TOP5": return "Vise le top 5";
    default: return "Spéculatif";
  }
}

function describeTicketIntent(r: ScoredParticipant) {
  if (r.prediction.typePariConseille === "PLACE") {
    if (r.prediction.objective === "TOP5") return "Cheval surtout solide pour accrocher une place élargie plutôt qu'une gagne sèche.";
    return "Le moteur le préfère en couverture place, plus fiable que franchement offensif.";
  }
  if (r.prediction.objective === "GAGNE") return "Le moteur voit ici un vrai ticket de gagne, avec suffisamment de tenue pour l'assumer.";
  return "Lecture offensive mesurée : ticket jouable si la course ne se resserre pas davantage.";
}

function formatVariation(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  const r = round1(v);
  return `${r > 0 ? "+" : ""}${r}%`;
}

function getConfidenceFill(s: number) { return `${Math.max(0, Math.min(s, 10)) * 10}%`; }

function getActionTone(action: string, valueBet: boolean) {
  if (action === "MISER" && valueBet) return { bg: G_DIM, color: G, label: "VALUE BET ✅" };
  return { bg: RED_DIM, color: RED, label: "ÉVITER ❌" };
}

function getConfianceStyle(s: number) {
  if (s >= 7.5) return { color: G };
  if (s >= 5.5) return { color: GOLD };
  return { color: RED };
}

function getTicketSimple(analysis: RaceAnalysis | null) {
  if (!analysis) return null;
  return (
    analysis.ranking.find(r => r.prediction.decision !== "REJET" && r.prediction.typePariConseille === "GAGNANT") ??
    analysis.ranking.find(r => r.prediction.decision !== "REJET") ??
    analysis.favori
  );
}

function getBasePlace(analysis: RaceAnalysis | null, simpleTicket: ScoredParticipant | null) {
  if (!analysis) return null;
  return (
    analysis.ranking.find(r => r.numPmu !== simpleTicket?.numPmu && r.prediction.decision !== "REJET" && r.prediction.typePariConseille === "PLACE") ??
    analysis.top5.find(r => r.numPmu !== simpleTicket?.numPmu) ??
    null
  );
}

function getArrivalPosition(numPmu: number | null | undefined, arrival: ArrivalRow[]) {
  if (!numPmu) return null;
  return arrival.find(r => r.numPmu === numPmu)?.position ?? null;
}

function getOutcomeTone(position: number | null, placeMode = false) {
  if (position === null) return { label: "Résultat indisponible", bg: CARD2, color: MUTED };
  if (position === 1) return { label: placeMode ? "Dans les 3" : "Gagnant", bg: G_DIM, color: G };
  if (placeMode && position <= 3) return { label: "Place", bg: GOLD_DIM, color: GOLD };
  return { label: "Perdu", bg: RED_DIM, color: RED };
}

function getVerdictTone(label: string) {
  if (label === "Ticket gagnant" || label === "Pari fort") return { bg: G_DIM, color: G };
  if (label === "Ticket place" || label === "Base prudente" || label === "Course ouverte") return { bg: GOLD_DIM, color: GOLD };
  return { bg: RED_DIM, color: RED };
}

function buildVerdict(response: RaceApiResponse | null, analysis: RaceAnalysis | null, simpleTicket: ScoredParticipant | null) {
  const technicalFavorite = analysis?.favori ?? null;
  const recommendation = analysis?.recommandation?.decision ?? "PAS DE VALIDATION FORTE";
  const confidence = analysis?.scoreConfiance?.score ?? 0;
  const lisibilite = analysis?.prediction.lisibilite ?? "LOTERIE";
  const solidity = analysis?.soliditeFavori?.score ?? 0;
  const placeTicket = simpleTicket?.prediction.typePariConseille === "PLACE";

  if (response?.isFinished && response.officialArrival.length > 0 && simpleTicket) {
    const position = getArrivalPosition(simpleTicket.numPmu, response.officialArrival);
    if (position === 1) return { title: "Ticket gagnant", subtitle: `Le ticket principal N${simpleTicket.numPmu} a gagné la course.`, label: "Bilan officiel" };
    if (position !== null && position <= 3) return { title: "Ticket place", subtitle: `Le ticket principal N${simpleTicket.numPmu} termine ${formatPosition(position)}.`, label: "Bilan officiel" };
    if (position !== null) return { title: "Ticket manqué", subtitle: `Le ticket principal N${simpleTicket.numPmu} termine ${formatPosition(position)}.`, label: "Bilan officiel" };
  }

  if (recommendation === "PARI OFFENSIF" && confidence >= 7) return { title: "Ticket offensif", subtitle: `Le ticket principal ressort proprement avec ${confidence}/10 de confiance sur une course ${lisibilite.toLowerCase()}.`, label: "Verdict moteur" };
  if (placeTicket && solidity >= 68) return { title: "Base place", subtitle: "Le moteur préfère une base place solide plutôt qu'une attaque gagnante trop agressive.", label: "Verdict moteur" };
  if (lisibilite === "LOTERIE") return { title: "Course à laisser", subtitle: "La course est trop ouverte pour sortir un vrai ticket propre.", label: "Verdict moteur" };
  if (recommendation === "SURVEILLANCE ACTIVE" || lisibilite === "COMPLEXE") return { title: "Lecture prudente", subtitle: "Le favori reste jouable, mais l'écart avec ses poursuivants est trop court pour valider un ticket offensif.", label: "Verdict moteur" };
  if (technicalFavorite && solidity >= 70) return { title: "Sous surveillance", subtitle: "Le favori tient encore, mais la course demande plus de prudence que d'engagement.", label: "Verdict moteur" };
  return { title: "Lecture réservée", subtitle: "Le moteur préfère rester défensif plutôt que d'insister sur un ticket peu clair.", label: "Verdict moteur" };
}

function buildStrengths(analysis: RaceAnalysis | null, favorite: ScoredParticipant | null, placeBase: ScoredParticipant | null) {
  if (!analysis || !favorite) return [];
  const points: string[] = [];
  const solidity = analysis.soliditeFavori;
  if ((favorite.musicStats?.trend ?? 0) > 0.5) points.push("Forme récente orientée à la hausse.");
  if ((favorite.musicStats?.fiabilite ?? 0) >= 0.75) points.push("Profil fiable dans la musique récente.");
  if (favorite.signaux.victoire >= 8) points.push("Signal de victoire présent dans le moteur.");
  if (favorite.signaux.podium >= 8) points.push("Base podium solide pour sécuriser la course.");
  if ((favorite.stalle ?? favorite.placeCorde ?? 99) <= 4 && analysis.courseInfo.estPlat) points.push("Bon numéro de stalle pour le parcours.");
  if (placeBase && placeBase.numPmu !== favorite.numPmu) points.push(`Base place complémentaire : N${placeBase.numPmu} ${placeBase.nom}.`);
  if (solidity?.score && solidity.score >= 72) points.push(`Solidité correcte du favori (${round1(solidity.score)}/100).`);
  return points.slice(0, 4);
}

function buildWarnings(analysis: RaceAnalysis | null, favorite: ScoredParticipant | null) {
  if (!analysis || !favorite) return [];
  const warnings: string[] = [];
  const solidity = analysis.soliditeFavori;
  if (analysis.prediction.lisibilite === "COMPLEXE") warnings.push("Course serrée : le top 3 se tient de près.");
  if (analysis.prediction.lisibilite === "LOTERIE") warnings.push("Course trop ouverte pour une validation propre.");
  if (solidity && solidity.ecartScore <= 2.5) warnings.push(`Écart faible avec le 2e : ${round1(solidity.ecartScore)} pts.`);
  if (favorite.signaux.risque >= 8) warnings.push("Risque technique élevé dans le profil du favori.");
  if (favorite.prediction.typePariConseille === "PLACE") warnings.push("Le moteur voit surtout une base place, pas une vraie gagne sèche.");
  return warnings.slice(0, 3);
}

function buildContextHighlights(data: RaceApiResponse, analysis: RaceAnalysis | null) {
  const items: string[] = [];
  if (data.courseInfo.terrain) items.push(`Terrain : ${data.courseInfo.terrain}`);
  if (data.courseInfo.meteo) items.push(`Météo : ${data.courseInfo.meteo}`);
  items.push(`Lisibilité : ${analysis?.prediction.lisibilite ?? "N/A"}`);
  if (analysis?.soliditeFavori?.ecartScore !== undefined) items.push(`Écart favori / 2e : ${round1(analysis.soliditeFavori.ecartScore)} pts`);
  return items;
}

function formatDaySignalTitle(label: string) {
  const s = label.replaceAll("_", " ").toLowerCase();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Primitives UI ────────────────────────────────────── */

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --g: ${G};
    --dark: ${DARK};
    --card: ${CARD};
    --card2: ${CARD2};
    --border: ${BORDER};
    --muted: ${MUTED};
    --white: ${WHITE};
    --gold: ${GOLD};
    --red: ${RED};
    --blue: ${BLUE};
    --violet: ${VIOLET};
    --font-display: 'Outfit', system-ui, sans-serif;
    --font-body: 'DM Sans', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  }

  .course-detail-shell {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 85% 52% at 50% -28%, rgba(13, 148, 136, 0.1), transparent 56%),
      radial-gradient(ellipse 68% 42% at 98% 8%, rgba(37, 99, 235, 0.06), transparent 52%),
      radial-gradient(ellipse 48% 32% at 2% 88%, rgba(124, 58, 237, 0.05), transparent 48%),
      var(--dark);
  }

  .shimmer {
    background: linear-gradient(90deg, ${CARD} 25%, ${CARD2} 50%, ${CARD} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .fade-up { animation: fadeUp 0.45s ease forwards; }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.8s cubic-bezier(.4,0,.2,1);
  }

  button { font-family: var(--font-body); }
`;

function Tag({ children, color = WHITE, bg = CARD2, mono = false }: { children: ReactNode; color?: string; bg?: string; mono?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "5px 11px", borderRadius: 9999,
      background: bg, color, fontSize: 10, fontWeight: 600,
      letterSpacing: "0.06em", textTransform: "uppercase",
      fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
      border: `1px solid ${BORDER_SOFT}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
    }}>
      {children}
    </span>
  );
}

function Card({ children, accent, style }: { children: ReactNode; accent?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: `linear-gradient(165deg, ${CARD_HI}f0 0%, ${CARD} 48%, ${CARD} 100%)`,
      borderRadius: 16,
      border: `1px solid ${accent ?? BORDER}`,
      overflow: "hidden",
      boxShadow: `0 20px 48px rgba(2, 6, 23, 0.45), 0 0 0 1px rgba(45, 212, 191, 0.04)`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionCard({ title, kicker, children, accent }: { title: string; kicker?: string; children: ReactNode; accent?: string }) {
  return (
    <Card accent={accent} style={{ marginBottom: 0 }}>
      <div style={{ padding: "22px 22px 0" }}>
        {kicker && (
          <div style={{ fontSize: 10, fontWeight: 600, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, opacity: 0.95 }}>
            {kicker}
          </div>
        )}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: WHITE, marginBottom: 16, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
          {title}
        </div>
      </div>
      <div style={{ padding: "0 22px 22px" }}>
        {children}
      </div>
    </Card>
  );
}

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const colors = { default: WHITE, good: G, warn: GOLD, bad: RED };
  const bgs = { default: CARD2, good: G_DIM, warn: GOLD_DIM, bad: RED_DIM };
  const borders = { default: BORDER, good: `${G}44`, warn: `${GOLD}44`, bad: `${RED}44` };

  return (
    <div style={{ padding: 14, borderRadius: 10, background: bgs[tone], border: `1px solid ${borders[tone]}` }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: colors[tone], lineHeight: 1, marginBottom: hint ? 6 : 0 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const { color } = getConfianceStyle(score);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>Confiance</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{score}/10</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: `${DARK}cc`, border: `1px solid ${BORDER_SOFT}`, overflow: "hidden" }}>
        <div className="bar-fill" style={{ width: getConfidenceFill(score), background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
      </div>
    </div>
  );
}

function BetPlanRow({ label, summary }: { label: string; summary: { chevaux: number[]; eligible: boolean; confiance: number; raison: string } | null }) {
  if (!summary) return null;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 0", borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, marginTop: 5, flexShrink: 0, background: summary.eligible ? G : MUTED }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{label}</span>
          <Tag color={summary.eligible ? G : MUTED} bg={summary.eligible ? G_DIM : CARD2}>
            {summary.eligible ? "Jouable" : "Bloqué"}
          </Tag>
        </div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{summary.raison}</div>
        {asArray<number>(summary.chevaux).length > 0 && (
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {asArray<number>(summary.chevaux).map((n) => (
              <span key={n} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 4, background: CARD2, color: WHITE }}>
                N{n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RunnerBadge({ num, accent = CARD2 }: { num: number; accent?: string }) {
  return (
    <div style={{
      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(145deg, ${accent}, ${CARD})`,
      border: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: WHITE,
      boxShadow: "0 6px 16px rgba(2,6,23,0.35)",
    }}>
      {num}
    </div>
  );
}

function TicketPanel({ title, subtitle, runner, badge, accent, placeMode = false, arrivalPosition }: {
  title: string; subtitle: string; runner: ScoredParticipant; badge: string;
  accent: string; placeMode?: boolean; arrivalPosition?: number | null;
}) {
  const outcome = getOutcomeTone(arrivalPosition ?? null, placeMode);
  const variation = formatVariation(runner.variationCote);
  const actionTone = getActionTone(runner.prediction.action, runner.prediction.valueBet);

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${accent}40`, overflow: "hidden", boxShadow: "0 12px 32px rgba(2,6,23,0.35)" }}>
      {/* Header strip */}
      <div style={{ padding: "12px 16px", background: `linear-gradient(90deg, ${accent}22, ${accent}0d)`, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${BORDER_SOFT}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</span>
        <Tag color={accent} bg={`${accent}20`}>{badge}</Tag>
      </div>

      <div style={{ padding: 16 }}>
        {/* Runner header */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <RunnerBadge num={runner.numPmu} accent={accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: WHITE, lineHeight: 1.1 }}>{runner.nom}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{subtitle}</div>
          </div>
          {arrivalPosition !== undefined && (
            <Tag color={outcome.color} bg={outcome.bg}>{arrivalPosition ? `${outcome.label} (${formatPosition(arrivalPosition)})` : outcome.label}</Tag>
          )}
        </div>

        {/* Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          <Tag color={G} bg={G_DIM}>{formatObjective(runner.prediction.objective)}</Tag>
          <Tag color={actionTone.color} bg={actionTone.bg}>{actionTone.label}</Tag>
          {(runner.stalle || runner.placeCorde) && <Tag color={MUTED} bg={CARD2}>Stalle {runner.stalle ?? runner.placeCorde}</Tag>}
          {runner.poids && <Tag color={GOLD} bg={GOLD_DIM}>Poids {runner.poids.toFixed(1)} kg</Tag>}
          <Tag color={BLUE} bg={BLUE_DIM} mono>PMU {formatOdds(runner.cote)}</Tag>
          <Tag color={G} bg={G_DIM}>Proba {formatPercent(runner.prediction.probaEstimee)}</Tag>
          {variation && <Tag color={GOLD} bg={GOLD_DIM}>{variation}</Tag>}
        </div>

        <ConfidenceBar score={runner.prediction.confiance} />

        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6, color: MUTED }}>
          {describeTicketIntent(runner)} — Mise reco : {formatCurrency(runner.prediction.miseBase100) ?? "0 EUR"} / bankroll 100 EUR.
        </div>
      </div>
    </div>
  );
}

function SecondaryRunnerCard({ title, runner, accent, placeMode = false, arrivalPosition, humanReference }: {
  title: string; runner: ScoredParticipant; accent: string; placeMode?: boolean; arrivalPosition?: number | null; humanReference: string;
}) {
  const outcome = getOutcomeTone(arrivalPosition ?? null, placeMode);
  const variation = formatVariation(runner.variationCote);
  const actionTone = getActionTone(runner.prediction.action, runner.prediction.valueBet);

  return (
    <div style={{ padding: 16, borderRadius: 14, background: `linear-gradient(165deg, ${CARD2}, ${CARD})`, border: `1px solid ${BORDER}`, boxShadow: "0 10px 28px rgba(2,6,23,0.32)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</span>
        {arrivalPosition !== undefined && (
          <Tag color={outcome.color} bg={outcome.bg}>{arrivalPosition ? `${outcome.label} ${formatPosition(arrivalPosition)}` : outcome.label}</Tag>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <RunnerBadge num={runner.numPmu} accent={accent} />
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: WHITE }}>{runner.nom}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{humanReference}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        <Tag color={G} bg={G_DIM}>{formatObjective(runner.prediction.objective)}</Tag>
        <Tag color={actionTone.color} bg={actionTone.bg}>{actionTone.label}</Tag>
        {(runner.stalle || runner.placeCorde) && <Tag>Stalle {runner.stalle ?? runner.placeCorde}</Tag>}
        {runner.poids && <Tag color={GOLD} bg={GOLD_DIM}>Poids {runner.poids.toFixed(1)} kg</Tag>}
        <Tag color={BLUE} bg={BLUE_DIM} mono>PMU {formatOdds(runner.cote)}</Tag>
        {variation && <Tag color={GOLD} bg={GOLD_DIM}>{variation}</Tag>}
      </div>
      <ConfidenceBar score={runner.prediction.confiance} />
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────── */
export default function CourseDetailPage({ params }: { params: Promise<{ reunion: string; course: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reunion, setReunion] = useState<number | null>(null);
  const [course, setCourse] = useState<number | null>(null);
  const [data, setData] = useState<RaceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedDate = normalizeSelectedDate(searchParams.get("date"));

  useEffect(() => {
    let cancelled = false;
    params.then(({ reunion: r, course: c }) => {
      if (cancelled) return;
      setReunion(Number.parseInt(r, 10));
      setCourse(Number.parseInt(c, 10));
    }).catch(() => { if (!cancelled) { setError("Impossible de lire la course."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [params]);

  useEffect(() => {
    if (!reunion || !course) return;
    let cancelled = false;
    async function loadRace() {
      try {
        let headers: HeadersInit | undefined;
        if (hasSupabaseConfig()) {
          const supabase = getSupabaseBrowserClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) headers = { Authorization: `Bearer ${session.access_token}` };
        }
        const r = await fetch(`/api/race/${reunion}/${course}?date=${selectedDate}`, { headers });
        const json = (await r.json()) as RaceApiResponse;
        if (!r.ok || !json.success) throw new Error(json.error || "Course introuvable");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Analyse indisponible");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRace();
    return () => { cancelled = true; };
  }, [course, reunion, selectedDate]);

  const analysis = data?.analysis ?? null;
  const technicalFavorite = analysis?.favori ?? null;
  const simpleTicket = getTicketSimple(analysis);
  const placeBase = getBasePlace(analysis, simpleTicket);
  const verdict = buildVerdict(data, analysis, simpleTicket);
  const verdictTone = getVerdictTone(verdict.title);
  const strengths = buildStrengths(analysis, technicalFavorite, placeBase);
  const warnings = buildWarnings(analysis, technicalFavorite);
  const officialArrivalRows = asArray<ArrivalRow>(data?.officialArrival);
  const technicalFavoritePosition = getArrivalPosition(technicalFavorite?.numPmu, officialArrivalRows);
  const simpleTicketPosition = getArrivalPosition(simpleTicket?.numPmu, officialArrivalRows);
  const placeBasePosition = getArrivalPosition(placeBase?.numPmu, officialArrivalRows);
  const readableDate = formatDateLabel(selectedDate);
  const contextHighlights = data ? buildContextHighlights(data, analysis) : [];
  const daySignal = analysis?.prediction.journeeSignal ?? null;
  const alertesList = asArray<string>(analysis?.alertes);
  const top5Runners = asArray<ScoredParticipant>(analysis?.top5);

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="course-detail-shell" style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
        <style>{css}</style>
        <div style={{ height: 60, background: CARD, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }} />
        {[230, 120, 120, 180, 160].map((h, i) => (
          <div key={i} className="shimmer" style={{ height: h, borderRadius: 12, marginBottom: 14 }} />
        ))}
      </div>
    );
  }

  /* Error state */
  if (error || !data) {
    return (
      <div className="course-detail-shell" style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
        <style>{css}</style>
        <div style={{ height: 60, background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <span style={{ color: WHITE, fontFamily: "var(--font-display)", fontWeight: 800 }}>Analyse course</span>
        </div>
        <SectionCard title="Analyse indisponible" kicker="Erreur">
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 16 }}>{error || "La course n'a pas pu être chargée."}</p>
          <button onClick={() => router.push(`/?date=${selectedDate}`)} style={{ width: "100%", padding: "14px 0", borderRadius: 8, border: "none", background: G, color: "#ffffff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            ← Retour aux courses
          </button>
        </SectionCard>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div className="course-detail-shell" style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 90 }}>
      <style>{css}</style>

      {/* Top nav */}
      <div style={{
        position: "sticky", top: 0, zIndex: 80, height: 60,
        background: DARK_GLASS, backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 16px",
      }}>
        <button onClick={() => router.push(`/?date=${selectedDate}`)} style={{
          position: "absolute", left: 16, width: 32, height: 32, borderRadius: 8,
          border: `1px solid ${BORDER}`, background: CARD2, color: WHITE,
          fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          ←
        </button>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "-0.01em" }}>
          R{data.courseInfo.reunion}C{data.courseInfo.course} — {data.courseInfo.hippodrome}
        </span>
      </div>

      <div style={{ padding: "20px 16px", display: "grid", gap: 16 }} className="fade-up">

        {/* ── Hero card ── */}
        <Card accent={`${G}44`}>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: G, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
              Lecture course
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: WHITE, lineHeight: 1.15, marginBottom: 6, letterSpacing: "-0.02em" }}>
              {data.courseInfo.nomCourse}
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
              {data.courseInfo.hippodrome} · {readableDate}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              <Tag color={G} bg={G_DIM}>{data.courseInfo.discipline}</Tag>
              <Tag color={MUTED} bg={CARD2}>{data.courseInfo.distance}m</Tag>
              <Tag color={MUTED} bg={CARD2}>{data.courseInfo.nombrePartants} partants</Tag>
              {formatCurrency(data.courseInfo.allocation) && (
                <Tag color={GOLD} bg={GOLD_DIM}>Alloc. {formatCurrency(data.courseInfo.allocation)}</Tag>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 42, fontWeight: 500, color: WHITE, lineHeight: 1 }}>
                  {data.courseInfo.heureDepart}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
                  {data.isFinished ? "Course terminée" : data.pronoAvailable ? "Analyse ouverte" : formatRevealTime(data.minutesUntilStart)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <Tag
                  color={data.isFinished ? MUTED : data.pronoAvailable ? G : MUTED}
                  bg={data.isFinished ? CARD2 : data.pronoAvailable ? G_DIM : CARD2}
                >
                  {data.isFinished ? "Résultat disponible" : data.pronoAvailable ? "Lecture active" : "T-30"}
                </Tag>
                {!data.isFinished && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: GOLD }}>{formatCountdown(data.minutesUntilStart)}</span>
                )}
              </div>
            </div>

            {contextHighlights.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {contextHighlights.map(item => <Tag key={item} color={MUTED}>{item}</Tag>)}
              </div>
            )}
          </div>
        </Card>

        {/* ── T-30 message ── */}
        {!data.pronoAvailable && !data.isFinished && (
          <SectionCard title="Lecture à venir" kicker="Tempo moteur">
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
              Le moteur ouvrira sa lecture détaillée 30 minutes avant le départ officiel.
              Pour cette course, {"l'analyse"} sera visible {formatRevealTime(data.minutesUntilStart).toLowerCase()}.
            </p>
          </SectionCard>
        )}

        {/* ── Paywall ── */}
        {data.paywall?.required && !analysis && (
          <SectionCard title="Pronostic réservé aux abonnés" kicker="PMU AI Premium">
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>
              {"La page d'accueil"} reste gratuite, mais le classement complet, les value bets, les mises Kelly et les tickets
              détaillés sont réservés aux abonnés.
            </p>
            {data.paywall.preview?.favori && (
              <div style={{ padding: 14, borderRadius: 10, background: CARD2, border: `1px solid ${BORDER}`, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Aperçu gratuit</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: WHITE }}>
                  Favori technique : N{data.paywall.preview.favori.numPmu} {data.paywall.preview.favori.nom}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  Lisibilité {data.paywall.preview.lisibilite} · {data.paywall.preview.recommendation ?? "Lecture premium"}
                </div>
              </div>
            )}
            <button onClick={() => router.push("/login?redirect=/mes-paris")} style={{
              width: "100%", padding: "14px 0", borderRadius: 8, border: "none",
              background: G, color: "#ffffff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, cursor: "pointer",
            }}>
              Se connecter et {"s'abonner"}
            </button>
          </SectionCard>
        )}

        {analysis && simpleTicket && (
          <>
            {/* ── Verdict ── */}
            <Card accent={`${verdictTone.color}44`}>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: verdictTone.color, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
                  {verdict.label}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 900, color: WHITE, lineHeight: 1.1, marginBottom: 4 }}>
                      {verdict.title}
                    </div>
                    <div style={{ fontSize: 10, color: G, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                      Ticket conseillé
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: WHITE }}>
                      N{simpleTicket.numPmu} {simpleTicket.nom}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      {getHumanReference(simpleTicket, data.courseInfo.estPlat)}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                    <Tag color={verdictTone.color} bg={verdictTone.bg}>{verdict.title}</Tag>
                    <Tag color={G} bg={G_DIM}>{formatTicketType(simpleTicket.prediction.typePariConseille)}</Tag>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 16 }}>{verdict.subtitle}</p>

                {technicalFavorite && technicalFavorite.numPmu !== simpleTicket.numPmu && (
                  <div style={{ padding: "12px 14px", borderRadius: 8, background: CARD2, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Favori technique moteur</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: WHITE }}>
                      N{technicalFavorite.numPmu} {technicalFavorite.nom}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      Le moteur voit ce cheval comme repère technique, mais le ticket conseillé reste N{simpleTicket.numPmu}.
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Metric label="Confiance IA" value={`${analysis.scoreConfiance?.score ?? 0}/10`} hint={analysis.prediction.decisionCourse === "VALIDE" ? "Ticket jouable" : "Lecture défensive"} tone={(analysis.scoreConfiance?.score ?? 0) >= 7 ? "good" : (analysis.scoreConfiance?.score ?? 0) >= 6 ? "warn" : "bad"} />
                  <Metric label="Tenue repère" value={`${round1(analysis.soliditeFavori?.score ?? 0)}/100`} hint="Solidité du repère principal" tone={(analysis.soliditeFavori?.score ?? 0) >= 72 ? "good" : (analysis.soliditeFavori?.score ?? 0) >= 62 ? "warn" : "bad"} />
                  <Metric label="Angle de jeu" value={simpleTicket.prediction.action} hint={simpleTicket.prediction.valueBet ? "Value bet confirmé" : "Pas d'edge suffisant"} tone={simpleTicket.prediction.action === "MISER" ? "good" : "bad"} />
                  <Metric label="Lisibilité" value={analysis.prediction.lisibilite} hint={describeLisibilite(analysis.prediction.lisibilite)} tone={analysis.prediction.lisibilite === "LISIBLE" ? "good" : analysis.prediction.lisibilite === "COMPLEXE" ? "warn" : "bad"} />
                </div>
              </div>
            </Card>

            {/* ── 2-col grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

              {/* Value & mise */}
              <SectionCard title="Value et mise" kicker="Décision bankroll" accent={`${G}33`}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Metric label="Cote actuelle" value={formatOdds(simpleTicket.cote)} hint="Cote PMU au moment de l'analyse" />
                  <Metric label="Proba réelle" value={formatPercent(simpleTicket.prediction.probaEstimee)} hint={`Marché ${formatPercent(simpleTicket.prediction.probabiliteImplicite)}`} tone={simpleTicket.prediction.valueBet ? "good" : "warn"} />
                  <Metric label="Mise Kelly" value={formatCurrency(simpleTicket.prediction.miseBase100) ?? "0 EUR"} hint={`Cap bankroll ${Math.round(simpleTicket.prediction.bankrollPct * 100)}%`} tone={simpleTicket.prediction.action === "MISER" ? "good" : "bad"} />
                  <Metric label="Décision" value={simpleTicket.prediction.action} hint={simpleTicket.prediction.valueBet ? "Value bet : proba > cote × 1.15" : "Aucun value bet"} tone={simpleTicket.prediction.action === "MISER" ? "good" : "bad"} />
                </div>
                {(simpleTicket.prediction.topFacteurs ?? []).length > 0 && (
                  <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {asArray<string>(simpleTicket.prediction.topFacteurs).map((f) => <Tag key={f} color={G} bg={G_DIM}>{f}</Tag>)}
                  </div>
                )}
              </SectionCard>

              {/* Paris optimisés */}
              <SectionCard title="Paris optimisés" kicker="Simple · Couple · Trio · Quinte · Multi">
                <div>
                  <BetPlanRow label="Simple gagnant" summary={analysis.bettingPlan.simpleGagnant} />
                  <BetPlanRow label="Couple" summary={analysis.bettingPlan.couple} />
                  <BetPlanRow label="Trio" summary={analysis.bettingPlan.trio} />
                  <BetPlanRow label="Quinte" summary={analysis.bettingPlan.quinte} />
                  <BetPlanRow label="Multi" summary={analysis.bettingPlan.multi} />
                </div>
              </SectionCard>
            </div>

            {/* ── 2-col grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

              {/* Alertes */}
              <SectionCard title="Alertes intelligentes" kicker="Lecture globale">
                <div style={{ display: "grid", gap: 10 }}>
                  {daySignal && (
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: daySignal.label === "JOURNEE_FAVORABLE" ? G_DIM : daySignal.label === "JOURNEE_DEFAVORABLE" ? RED_DIM : CARD2,
                      border: `1px solid ${daySignal.label === "JOURNEE_FAVORABLE" ? `${G}44` : daySignal.label === "JOURNEE_DEFAVORABLE" ? `${RED}44` : BORDER}`,
                    }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Indicateur journée</div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: WHITE, marginBottom: 6, letterSpacing: "-0.02em" }}>
                        {formatDaySignalTitle(daySignal.label)}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: MUTED, marginBottom: 8 }}>Score {daySignal.score}/100</div>
                      {asArray<string>(daySignal.raisons).map((r) => (
                        <div key={r} style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{r}</div>
                      ))}
                    </div>
                  )}
                  {alertesList.length > 0 ? (
                    alertesList.map((a) => (
                      <div key={a} style={{ padding: "10px 14px", borderRadius: 8, background: GOLD_DIM, border: `1px solid ${GOLD}44`, fontSize: 13, color: GOLD, lineHeight: 1.5 }}>
                        {a}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: MUTED }}>Aucune alerte additionnelle sur cette course.</div>
                  )}
                </div>
              </SectionCard>

              {/* Plan de jeu */}
              <SectionCard title="Plan de jeu" kicker="Lecture ticket" accent={`${G}33`}>
                <TicketPanel
                  title="Ticket principal"
                  subtitle={getHumanReference(simpleTicket, data.courseInfo.estPlat)}
                  runner={simpleTicket}
                  badge={formatTicketType(simpleTicket.prediction.typePariConseille)}
                  accent={G}
                  arrivalPosition={data.isFinished ? simpleTicketPosition : undefined}
                />
                {(placeBase && placeBase.numPmu !== simpleTicket.numPmu) || (technicalFavorite && technicalFavorite.numPmu !== simpleTicket.numPmu) ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {placeBase && placeBase.numPmu !== simpleTicket.numPmu && (
                      <SecondaryRunnerCard title="Base place de secours" runner={placeBase} accent={GOLD} placeMode arrivalPosition={data.isFinished ? placeBasePosition : undefined} humanReference={getHumanReference(placeBase, data.courseInfo.estPlat)} />
                    )}
                    {technicalFavorite && technicalFavorite.numPmu !== simpleTicket.numPmu && (
                      <SecondaryRunnerCard title="Favori technique moteur" runner={technicalFavorite} accent={BLUE} arrivalPosition={data.isFinished ? technicalFavoritePosition : undefined} humanReference={getHumanReference(technicalFavorite, data.courseInfo.estPlat)} />
                    )}
                  </div>
                ) : null}
              </SectionCard>
            </div>

            {/* ── Debrief officiel ── */}
            {data.isFinished && officialArrivalRows.length > 0 && (
              <SectionCard title="Débrief officiel" kicker="Arrivée course">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {officialArrivalRows.slice(0, 3).map((r) => (
                    <Tag key={`${r.position}-${r.numPmu}`} color={WHITE} bg={CARD2}>
                      {formatPosition(r.position)} N{r.numPmu} {r.nom}
                    </Tag>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ padding: 14, borderRadius: 10, background: CARD2, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Ticket principal</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: WHITE, marginBottom: 8 }}>N{simpleTicket.numPmu} {simpleTicket.nom}</div>
                    <Tag color={getOutcomeTone(simpleTicketPosition, false).color} bg={getOutcomeTone(simpleTicketPosition, false).bg}>
                      {simpleTicketPosition ? `${getOutcomeTone(simpleTicketPosition, false).label} (${formatPosition(simpleTicketPosition)})` : "Résultat indisponible"}
                    </Tag>
                  </div>
                  {placeBase && placeBase.numPmu !== simpleTicket.numPmu && (
                    <div style={{ padding: 14, borderRadius: 10, background: CARD2, border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Base place</div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: WHITE, marginBottom: 8 }}>N{placeBase.numPmu} {placeBase.nom}</div>
                      <Tag color={getOutcomeTone(placeBasePosition, true).color} bg={getOutcomeTone(placeBasePosition, true).bg}>
                        {placeBasePosition ? `${getOutcomeTone(placeBasePosition, true).label} (${formatPosition(placeBasePosition)})` : "Résultat indisponible"}
                      </Tag>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ── 2-col grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

              {/* Lecture moteur */}
              <SectionCard title="Lecture moteur" kicker="Ce qui tient / ce qui force la prudence">
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ padding: 14, borderRadius: 10, background: G_DIM, border: `1px solid ${G}33` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>✓ Ce qui tient</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {strengths.length > 0 ? strengths.map(p => (
                        <div key={p} style={{ padding: "10px 12px", borderRadius: 8, background: CARD2, border: `1px solid ${G}33`, fontSize: 13, color: WHITE, lineHeight: 1.5 }}>{p}</div>
                      )) : <div style={{ fontSize: 13, color: MUTED }}>Aucun point fort franc ne ressort du moteur.</div>}
                    </div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: GOLD_DIM, border: `1px solid ${GOLD}33` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚠ Ce qui force la prudence</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {warnings.length > 0 ? warnings.map(p => (
                        <div key={p} style={{ padding: "10px 12px", borderRadius: 8, background: CARD2, border: `1px solid ${GOLD}33`, fontSize: 13, color: WHITE, lineHeight: 1.5 }}>{p}</div>
                      )) : <div style={{ fontSize: 13, color: MUTED }}>{`Pas d'alerte majeure remontée par le moteur.`}</div>}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Radar top 5 */}
              <SectionCard title="Radar top 5" kicker="Classement du moteur">
                <div style={{ display: "grid", gap: 10 }}>
                  {top5Runners.map((runner, index) => {
                    const position = data.isFinished ? getArrivalPosition(runner.numPmu, officialArrivalRows) : null;
                    const at = getActionTone(runner.prediction.action, runner.prediction.valueBet);
                    return (
                      <div key={runner.numPmu} style={{
                        display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 12, alignItems: "center",
                        padding: 12, borderRadius: 10,
                        background: index === 0 ? G_DIM : CARD2,
                        border: `1px solid ${index === 0 ? `${G}44` : BORDER}`,
                      }}>
                        <RunnerBadge num={runner.numPmu} accent={index === 0 ? G : CARD} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: WHITE }}>{runner.nom}</div>
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontFamily: "var(--font-mono)" }}>
                            Score {round1(runner.prediction.scoreFinalPari)} · PMU {formatOdds(runner.cote)} · Proba {formatPercent(runner.prediction.probaEstimee)}
                          </div>
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <Tag color={at.color} bg={at.bg}>{at.label}</Tag>
                            {asArray<string>(runner.prediction.topFacteurs).map((f) => <Tag key={`${runner.numPmu}-${f}`} color={MUTED}>{f}</Tag>)}
                          </div>
                          <div style={{ marginTop: 8 }}><ConfidenceBar score={runner.prediction.confiance} /></div>
                        </div>
                        {position && <Tag color={position <= 3 ? G : MUTED} bg={position <= 3 ? G_DIM : CARD2}>{formatPosition(position)}</Tag>}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 960, height: 64,
        background: DARK_GLASS, backdropFilter: "blur(20px)",
        borderTop: `1px solid ${BORDER}`,
        display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 120,
      }}>
        {[
          { label: "Courses", path: `/?date=${selectedDate}`, active: true },
          { label: "Mes Paris", path: "/mes-paris", active: false },
          { label: "Bilan", path: `/bilan?date=${selectedDate}`, active: false },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{
            border: "none", background: "transparent", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700,
            color: item.active ? G : MUTED, padding: "8px 16px",
          }}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
