"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const GREEN = "#0B8B4B";
const GREEN_SOFT = "#E8F5ED";
const DARK = "#121417";
const GOLD_SOFT = "#FFF5D9";
const RED = "#D84A4A";
const RED_SOFT = "#FDECEC";
const SLATE = "#5F6B76";

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeSelectedDate(rawDate: string | null) {
  if (!rawDate) return getTodayDateStr();
  if (/^\d{8}$/.test(rawDate)) return rawDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return fromIsoDate(rawDate);
  return getTodayDateStr();
}

function formatDateLabel(dateStr: string) {
  const date = parsePmuDate(dateStr);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat("fr-FR").format(value)} EUR`;
}

function formatOdds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return Number(value).toFixed(1);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(Number(value) * 100)}%`;
}

function formatCountdown(minutesUntilStart: number) {
  if (minutesUntilStart <= 0) return "Depart imminent";
  if (minutesUntilStart < 60) return `Dans ${Math.round(minutesUntilStart)} min`;
  const hours = Math.floor(minutesUntilStart / 60);
  const minutes = Math.round(minutesUntilStart % 60);
  return `Dans ${hours}h${String(minutes).padStart(2, "0")}`;
}

function formatRevealTime(minutesUntilStart: number) {
  const remaining = minutesUntilStart - 30;
  if (remaining <= 0) return "Ouverture imminente";
  return `Ouverture dans ${formatCountdown(remaining).replace(/^Dans /, "")}`;
}

function formatPosition(position: number | null | undefined) {
  if (!position) return "n.c.";
  return position === 1 ? "1er" : `${position}e`;
}

function getHumanLead(
  participant: ScoredParticipant | null,
  estPlat: boolean
): { label: string; value: string } {
  if (!participant) {
    return { label: "Repere humain", value: "Info humaine indisponible" };
  }

  const orderedLeads = estPlat
    ? [
        { label: "Jockey", value: participant.jockey },
        { label: "Driver", value: participant.driver },
        { label: "Entraineur", value: participant.entraineur },
      ]
    : [
        { label: "Driver", value: participant.driver },
        { label: "Jockey", value: participant.jockey },
        { label: "Entraineur", value: participant.entraineur },
      ];

  const match = orderedLeads.find((entry) => entry.value && entry.value.trim().length > 0);
  return match
    ? { label: match.label, value: match.value!.trim() }
    : { label: "Repere humain", value: "Info humaine indisponible" };
}

function getHumanReference(participant: ScoredParticipant | null, estPlat: boolean) {
  const lead = getHumanLead(participant, estPlat);
  return `${lead.label}: ${lead.value}`;
}

function formatTicketType(type: string | null | undefined) {
  if (!type) return "Lecture prudente";
  switch (type) {
    case "GAGNANT":
      return "Simple gagnant";
    case "PLACE":
      return "Simple place";
    case "COUPLE_GAGNANT":
      return "Couple gagnant";
    case "COUPLE_PLACE":
      return "Couple place";
    default:
      return type;
  }
}

function describeLisibilite(lisibilite: string) {
  switch (lisibilite) {
    case "LISIBLE":
      return "Course propre, hierarchie plus fiable.";
    case "COMPLEXE":
      return "Course ouverte, ecarts plus serres.";
    default:
      return "Course trop diffuse pour une lecture nette.";
  }
}

function formatObjective(objective: ScoredParticipant["prediction"]["objective"] | null | undefined) {
  switch (objective) {
    case "GAGNE":
      return "Vise la gagne";
    case "PODIUM":
      return "Profil podium";
    case "TOP5":
      return "Vise le top 5";
    default:
      return "Speculatif";
  }
}

function describeTicketIntent(runner: ScoredParticipant) {
  if (runner.prediction.typePariConseille === "PLACE") {
    if (runner.prediction.objective === "TOP5") {
      return "Cheval surtout solide pour accrocher une place elargie plutot qu'une gagne seche.";
    }
    return "Le moteur le prefere en couverture place, plus fiable que franchement offensif.";
  }

  if (runner.prediction.objective === "GAGNE") {
    return "Le moteur voit ici un vrai ticket de gagne, avec suffisamment de tenue pour l'assumer.";
  }

  return "Lecture offensive mesuree: ticket jouable si la course ne se resserre pas davantage.";
}

function formatVariation(variation: number | null | undefined) {
  if (variation === null || variation === undefined || !Number.isFinite(variation)) return null;
  const rounded = round1(variation);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function getConfidenceFill(score: number) {
  return `${Math.max(0, Math.min(score, 10)) * 10}%`;
}

function getActionTone(action: string, valueBet: boolean) {
  if (action === "MISER" && valueBet) {
    return { background: "#E8F5ED", color: GREEN, label: "VALUE BET ✅" };
  }

  return { background: "#FDECEC", color: RED, label: "EVITER ❌" };
}

function getConfianceStyle(score: number) {
  if (score >= 7.5) return { background: "#E8F5E9", color: GREEN };
  if (score >= 5.5) return { background: "#FFF8E1", color: "#A66B00" };
  return { background: "#FDECEA", color: RED };
}

function getTicketSimple(analysis: RaceAnalysis | null) {
  if (!analysis) return null;
  return (
    analysis.ranking.find(
      (runner) =>
        runner.prediction.decision !== "REJET" &&
        runner.prediction.typePariConseille === "GAGNANT"
    ) ??
    analysis.ranking.find((runner) => runner.prediction.decision !== "REJET") ??
    analysis.favori
  );
}

function getBasePlace(analysis: RaceAnalysis | null, simpleTicket: ScoredParticipant | null) {
  if (!analysis) return null;
  return (
    analysis.ranking.find(
      (runner) =>
        runner.numPmu !== simpleTicket?.numPmu &&
        runner.prediction.decision !== "REJET" &&
        runner.prediction.typePariConseille === "PLACE"
    ) ??
    analysis.top5.find((runner) => runner.numPmu !== simpleTicket?.numPmu) ??
    null
  );
}

function getArrivalPosition(numPmu: number | null | undefined, arrival: ArrivalRow[]) {
  if (!numPmu) return null;
  return arrival.find((runner) => runner.numPmu === numPmu)?.position ?? null;
}

function getOutcomeTone(position: number | null, placeMode = false) {
  if (position === null) {
    return {
      label: "Resultat indisponible",
      background: "#F3F4F6",
      color: "#606A73",
    };
  }

  if (position === 1) {
    return {
      label: placeMode ? "Dans les 3" : "Gagnant",
      background: GREEN_SOFT,
      color: GREEN,
    };
  }

  if (placeMode && position <= 3) {
    return {
      label: "Place",
      background: GOLD_SOFT,
      color: "#A06A00",
    };
  }

  return {
    label: "Perdu",
    background: RED_SOFT,
    color: RED,
  };
}

function getVerdictTone(label: string) {
  if (label === "Ticket gagnant" || label === "Pari fort") {
    return { background: GREEN_SOFT, color: GREEN };
  }
  if (label === "Ticket place" || label === "Base prudente" || label === "Course ouverte") {
    return { background: GOLD_SOFT, color: "#A06A00" };
  }
  return { background: RED_SOFT, color: RED };
}

function buildVerdict(
  response: RaceApiResponse | null,
  analysis: RaceAnalysis | null,
  simpleTicket: ScoredParticipant | null
) {
  const technicalFavorite = analysis?.favori ?? null;
  const recommendation = analysis?.recommandation?.decision ?? "PAS DE VALIDATION FORTE";
  const confidence = analysis?.scoreConfiance?.score ?? 0;
  const lisibilite = analysis?.prediction.lisibilite ?? "LOTERIE";
  const solidity = analysis?.soliditeFavori?.score ?? 0;
  const placeTicket = simpleTicket?.prediction.typePariConseille === "PLACE";

  if (response?.isFinished && response.officialArrival.length > 0 && simpleTicket) {
    const position = getArrivalPosition(simpleTicket.numPmu, response.officialArrival);
    if (position === 1) {
      return {
        title: "Ticket gagnant",
        subtitle: `Le ticket principal N${simpleTicket.numPmu} a gagne la course.`,
        label: "Bilan officiel",
      };
    }
    if (position !== null && position <= 3) {
      return {
        title: "Ticket place",
        subtitle: `Le ticket principal N${simpleTicket.numPmu} termine ${formatPosition(position)}.`,
        label: "Bilan officiel",
      };
    }
    if (position !== null) {
      return {
        title: "Ticket manque",
        subtitle: `Le ticket principal N${simpleTicket.numPmu} termine ${formatPosition(position)}.`,
        label: "Bilan officiel",
      };
    }
  }

  if (recommendation === "PARI OFFENSIF" && confidence >= 7) {
    return {
      title: "Ticket offensif",
      subtitle: `Le ticket principal ressort proprement avec ${confidence}/10 de confiance sur une course ${lisibilite.toLowerCase()}.`,
      label: "Verdict moteur",
    };
  }

  if (placeTicket && solidity >= 68) {
    return {
      title: "Base place",
      subtitle: "Le moteur prefere une base place solide plutot qu'une attaque gagnante trop agressive.",
      label: "Verdict moteur",
    };
  }

  if (lisibilite === "LOTERIE") {
    return {
      title: "Course a laisser",
      subtitle: "La course est trop ouverte pour sortir un vrai ticket propre.",
      label: "Verdict moteur",
    };
  }

  if (recommendation === "SURVEILLANCE ACTIVE" || lisibilite === "COMPLEXE") {
    return {
      title: "Lecture prudente",
      subtitle: "Le favori reste jouable, mais l'ecart avec ses poursuivants est trop court pour valider un ticket offensif.",
      label: "Verdict moteur",
    };
  }

  if (technicalFavorite && solidity >= 70) {
    return {
      title: "Sous surveillance",
      subtitle: "Le favori tient encore, mais la course demande plus de prudence que d'engagement.",
      label: "Verdict moteur",
    };
  }

  return {
    title: "Lecture reservee",
    subtitle: "Le moteur prefere rester defensif plutot que d'insister sur un ticket peu clair.",
    label: "Verdict moteur",
  };
}

function buildStrengths(
  analysis: RaceAnalysis | null,
  favorite: ScoredParticipant | null,
  placeBase: ScoredParticipant | null
) {
  if (!analysis || !favorite) return [];

  const points: string[] = [];
  const solidity = analysis.soliditeFavori;

  if ((favorite.musicStats?.trend ?? 0) > 0.5) points.push("Forme recente orientee a la hausse.");
  if ((favorite.musicStats?.fiabilite ?? 0) >= 0.75) points.push("Profil fiable dans la musique recente.");
  if (favorite.signaux.victoire >= 8) points.push("Signal de victoire present dans le moteur.");
  if (favorite.signaux.podium >= 8) points.push("Base podium solide pour securiser la course.");
  if ((favorite.stalle ?? favorite.placeCorde ?? 99) <= 4 && analysis.courseInfo.estPlat) {
    points.push("Bon numero de stalle pour le parcours.");
  }
  if (placeBase && placeBase.numPmu !== favorite.numPmu) {
    points.push(`Base place complementaire: N${placeBase.numPmu} ${placeBase.nom}.`);
  }
  if (solidity?.score && solidity.score >= 72) {
    points.push(`Solidite correcte du favori (${round1(solidity.score)}/100).`);
  }

  return points.slice(0, 4);
}

function buildWarnings(analysis: RaceAnalysis | null, favorite: ScoredParticipant | null) {
  if (!analysis || !favorite) return [];

  const warnings: string[] = [];
  const solidity = analysis.soliditeFavori;

  if (analysis.prediction.lisibilite === "COMPLEXE") {
    warnings.push("Course serree: le top 3 se tient de pres.");
  }
  if (analysis.prediction.lisibilite === "LOTERIE") {
    warnings.push("Course trop ouverte pour une validation propre.");
  }
  if (solidity && solidity.ecartScore <= 2.5) {
    warnings.push(`Ecart faible avec le 2e: ${round1(solidity.ecartScore)} pts.`);
  }
  if (favorite.signaux.risque >= 8) {
    warnings.push("Risque technique eleve dans le profil du favori.");
  }
  if (favorite.prediction.typePariConseille === "PLACE") {
    warnings.push("Le moteur voit surtout une base place, pas une vraie gagne seche.");
  }

  return warnings.slice(0, 3);
}

function buildContextHighlights(data: RaceApiResponse, analysis: RaceAnalysis | null) {
  const items: string[] = [];

  if (data.courseInfo.terrain) {
    items.push(`Terrain: ${data.courseInfo.terrain}`);
  }
  if (data.courseInfo.meteo) {
    items.push(`Meteo: ${data.courseInfo.meteo}`);
  }
  items.push(`Lisibilite: ${analysis?.prediction.lisibilite ?? "N/A"}`);

  if (analysis?.soliditeFavori?.ecartScore !== undefined) {
    items.push(`Ecart favori / 2e: ${round1(analysis.soliditeFavori.ecartScore)} pts`);
  }

  return items;
}

function Pill({
  children,
  background = "#F3F4F6",
  color = DARK,
}: {
  children: React.ReactNode;
  background?: string;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        background,
        color,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  kicker,
  children,
  accent = "rgba(18,24,39,0.05)",
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <section
      style={{
        margin: "0 0 18px",
        borderRadius: 28,
        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,251,0.9))",
        padding: 22,
        border: `1px solid ${accent}`,
        boxShadow: "0 22px 42px rgba(15,23,42,0.08)",
      }}
    >
      {kicker ? (
        <div style={{ fontSize: 11, fontWeight: 800, color: GREEN, marginBottom: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {kicker}
        </div>
      ) : null}
      <div style={{ fontSize: 26, lineHeight: "30px", fontWeight: 900, color: DARK, marginBottom: 16, letterSpacing: "-0.5px" }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const palette =
    tone === "good"
      ? { background: "#F4FBF7", border: "#D9F0E2", value: GREEN }
      : tone === "warn"
        ? { background: "#FFF8E6", border: "#F6E7B6", value: "#A06A00" }
        : tone === "bad"
          ? { background: "#FFF2F2", border: "#F7D5D5", value: RED }
          : { background: "#F8FAFC", border: "#E7ECF1", value: DARK };

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 16,
        background: palette.background,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ fontSize: 11, color: SLATE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, lineHeight: "30px", fontWeight: 800, color: palette.value, marginBottom: hint ? 6 : 0 }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 12, color: SLATE, lineHeight: "16px" }}>{hint}</div> : null}
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const tone = getConfianceStyle(score);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: SLATE, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Confiance
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: tone.color }}>{score}/10</div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#E7ECF1", overflow: "hidden" }}>
        <div
          style={{
            width: getConfidenceFill(score),
            height: "100%",
            borderRadius: 999,
            background: tone.color,
          }}
        />
      </div>
    </div>
  );
}

function BetPlanCard({
  label,
  summary,
}: {
  label: string;
  summary: { chevaux: number[]; eligible: boolean; confiance: number; raison: string } | null;
}) {
  if (!summary) return null;

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        background: summary.eligible ? "#F4FBF7" : "#F8FAFC",
        border: `1px solid ${summary.eligible ? "#D9F0E2" : "#E7ECF1"}`,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: DARK }}>{label}</div>
        <Pill
          background={summary.eligible ? "#E8F5ED" : "#F3F4F6"}
          color={summary.eligible ? GREEN : SLATE}
        >
          {summary.eligible ? "Jouable" : "Bloque"}
        </Pill>
      </div>
      <div style={{ fontSize: 14, color: DARK, fontWeight: 700 }}>
        {summary.chevaux.length > 0 ? `Chevaux: ${summary.chevaux.map((num) => `N${num}`).join(" - ")}` : "Aucune combinaison"}
      </div>
      <div style={{ fontSize: 13, color: SLATE }}>
        Confiance moyenne {summary.confiance}/10
      </div>
      <div style={{ fontSize: 13, color: SLATE, lineHeight: "18px" }}>{summary.raison}</div>
    </div>
  );
}

function TicketPanel({
  title,
  subtitle,
  runner,
  badge,
  accent,
  placeMode = false,
  arrivalPosition,
}: {
  title: string;
  subtitle: string;
  runner: ScoredParticipant;
  badge: string;
  accent: string;
  placeMode?: boolean;
  arrivalPosition?: number | null;
}) {
  const outcome = getOutcomeTone(arrivalPosition ?? null, placeMode);
  const variation = formatVariation(runner.variationCote);
  const actionTone = getActionTone(runner.prediction.action, runner.prediction.valueBet);

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${accent}`,
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          background: `${accent}22`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: DARK }}>{title}</div>
        <Pill background={`${accent}33`} color={accent}>
          {badge}
        </Pill>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 18,
              background: accent,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: "0 16px 28px rgba(0,0,0,0.12)",
            }}
          >
            {runner.numPmu}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 24, lineHeight: "28px", fontWeight: 800, color: DARK, marginBottom: 6 }}>
              {runner.nom}
            </div>
            <div style={{ fontSize: 14, lineHeight: "18px", color: SLATE, marginBottom: 10 }}>
              {subtitle}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Pill background="#EEF8F1" color={GREEN}>
                {formatObjective(runner.prediction.objective)}
              </Pill>
              <Pill background={actionTone.background} color={actionTone.color}>
                {actionTone.label}
              </Pill>
              {runner.stalle || runner.placeCorde ? (
                <Pill background="#F3F4F6" color={SLATE}>
                  Stalle {runner.stalle ?? runner.placeCorde}
                </Pill>
              ) : null}
              {runner.poids ? (
                <Pill background={GOLD_SOFT} color="#A06A00">
                  Poids {runner.poids.toFixed(1)} kg
                </Pill>
              ) : null}
              <Pill background="#EEF5FF" color="#1660C7">
                PMU {formatOdds(runner.cote)}
              </Pill>
              <Pill background="#F4FBF7" color={GREEN}>
                Proba reel. {formatPercent(runner.prediction.probaEstimee)}
              </Pill>
              {variation ? (
                <Pill background="#FFF8E6" color="#A06A00">
                  Var. {variation}
                </Pill>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <ConfidenceBar score={runner.prediction.confiance} />
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: "18px", color: SLATE }}>
            {describeTicketIntent(runner)} Mise reco: {formatCurrency(runner.prediction.miseBase100) ?? "0 EUR"} sur bankroll 100 EUR.
          </div>
          {arrivalPosition !== undefined ? (
            <span
              style={{
                flexShrink: 0,
                background: outcome.background,
                color: outcome.color,
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {arrivalPosition ? `${outcome.label} (${formatPosition(arrivalPosition)})` : outcome.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SecondaryRunnerCard({
  title,
  runner,
  accent,
  placeMode = false,
  arrivalPosition,
  humanReference,
}: {
  title: string;
  runner: ScoredParticipant;
  accent: string;
  placeMode?: boolean;
  arrivalPosition?: number | null;
  humanReference: string;
}) {
  const outcome = getOutcomeTone(arrivalPosition ?? null, placeMode);
  const variation = formatVariation(runner.variationCote);

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${accent}33`,
        background: "#F9FBFC",
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
          {title}
        </div>
        {arrivalPosition !== undefined ? (
          <span
            style={{
              background: outcome.background,
              color: outcome.color,
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {arrivalPosition ? `${outcome.label} ${formatPosition(arrivalPosition)}` : outcome.label}
          </span>
        ) : null}
      </div>

      <div>
        <div style={{ fontSize: 20, lineHeight: "24px", fontWeight: 800, color: DARK }}>
          N{runner.numPmu} {runner.nom}
        </div>
        <div style={{ fontSize: 13, color: SLATE, marginTop: 4 }}>{humanReference}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Pill background="#EEF8F1" color={GREEN}>
          {formatObjective(runner.prediction.objective)}
        </Pill>
        <Pill
          background={getActionTone(runner.prediction.action, runner.prediction.valueBet).background}
          color={getActionTone(runner.prediction.action, runner.prediction.valueBet).color}
        >
          {getActionTone(runner.prediction.action, runner.prediction.valueBet).label}
        </Pill>
        {runner.stalle || runner.placeCorde ? (
          <Pill background="#F3F4F6" color={SLATE}>
            Stalle {runner.stalle ?? runner.placeCorde}
          </Pill>
        ) : null}
        {runner.poids ? (
          <Pill background={GOLD_SOFT} color="#A06A00">
            Poids {runner.poids.toFixed(1)} kg
          </Pill>
        ) : null}
        <Pill background="#EEF5FF" color="#1660C7">
          PMU {formatOdds(runner.cote)}
        </Pill>
        {variation ? (
          <Pill background="#FFF8E6" color="#A06A00">
            Var. {variation}
          </Pill>
        ) : null}
      </div>

      <ConfidenceBar score={runner.prediction.confiance} />
    </div>
  );
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ reunion: string; course: string }>;
}) {
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

    params
      .then(({ reunion: reunionParam, course: courseParam }) => {
        if (cancelled) return;
        setReunion(Number.parseInt(reunionParam, 10));
        setCourse(Number.parseInt(courseParam, 10));
      })
      .catch(() => {
        if (!cancelled) {
          setError("Impossible de lire la course.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!reunion || !course) return;

    let cancelled = false;

    async function loadRace() {
      let headers: HeadersInit | undefined;
      if (hasSupabaseConfig()) {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers = { Authorization: `Bearer ${session.access_token}` };
        }
      }

      fetch(`/api/race/${reunion}/${course}?date=${selectedDate}`, { headers })
        .then(async (response) => {
        const json = (await response.json()) as RaceApiResponse;
        if (!response.ok || !json.success) {
          throw new Error(json.error || "Course introuvable");
        }
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Analyse indisponible");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    }

    void loadRace();

    return () => {
      cancelled = true;
    };
  }, [course, reunion, selectedDate]);

  const analysis = data?.analysis ?? null;
  const technicalFavorite = analysis?.favori ?? null;
  const simpleTicket = getTicketSimple(analysis);
  const placeBase = getBasePlace(analysis, simpleTicket);
  const verdict = buildVerdict(data, analysis, simpleTicket);
  const verdictTone = getVerdictTone(verdict.title);
  const strengths = buildStrengths(analysis, technicalFavorite, placeBase);
  const warnings = buildWarnings(analysis, technicalFavorite);
  const technicalFavoritePosition = getArrivalPosition(technicalFavorite?.numPmu, data?.officialArrival ?? []);
  const simpleTicketPosition = getArrivalPosition(simpleTicket?.numPmu, data?.officialArrival ?? []);
  const placeBasePosition = getArrivalPosition(placeBase?.numPmu, data?.officialArrival ?? []);
  const readableDate = formatDateLabel(selectedDate);
  const contextHighlights = data ? buildContextHighlights(data, analysis) : [];
  const daySignal = analysis?.prediction.journeeSignal ?? null;

  if (loading) {
    return (
      <div style={{ width: "min(1180px, calc(100% - 24px))", margin: "0 auto", minHeight: "100vh", background: "#F6F8F9" }}>
        <div style={{ height: 64, background: "rgba(18,22,26,0.92)" }} />
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: index === 0 ? 230 : 160,
                borderRadius: 24,
                background: "linear-gradient(90deg, #ECECEC 25%, #F7F7F7 50%, #ECECEC 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s linear infinite",
              }}
            />
          ))}
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ width: "min(1180px, calc(100% - 24px))", margin: "0 auto", minHeight: "100vh", background: "#F6F8F9" }}>
        <div
          style={{
            height: 64,
            background: "rgba(18,22,26,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontWeight: 800,
          }}
        >
          Analyse course
        </div>
        <div style={{ padding: 16 }}>
          <SectionCard title="Analyse indisponible" kicker="Erreur">
            <div style={{ fontSize: 15, lineHeight: "22px", color: SLATE, marginBottom: 16 }}>
              {error || "La course n&apos;a pas pu etre chargee."}
            </div>
            <button
              onClick={() => router.push(`/?date=${selectedDate}`)}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 16,
                padding: "15px 18px",
                background: DARK,
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Retour aux courses
            </button>
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "min(1180px, calc(100% - 24px))",
        margin: "0 auto",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,132,61,0.12), transparent 24%), linear-gradient(180deg, #F7FAF8 0%, #EEF3F4 100%)",
        paddingBottom: 88,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 80,
          height: 64,
          background: "rgba(18,22,26,0.9)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
        }}
      >
        <button
          onClick={() => router.push(`/?date=${selectedDate}`)}
          style={{
            position: "absolute",
            left: 16,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.1)",
            color: "#FFFFFF",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          {"<"}
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px" }}>
          R{data.courseInfo.reunion}C{data.courseInfo.course} - {data.courseInfo.hippodrome}
        </div>
      </div>

      <div style={{ paddingTop: 18, display: "grid", gap: 18 }}>
        <SectionCard title={data.courseInfo.nomCourse} kicker="Lecture course" accent="rgba(11,139,75,0.12)">
          <div style={{ fontSize: 16, fontWeight: 700, color: SLATE, marginBottom: 14 }}>
            {data.courseInfo.hippodrome} - {readableDate}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <Pill background={GREEN_SOFT} color={GREEN}>{data.courseInfo.discipline}</Pill>
            <Pill>{data.courseInfo.distance}m</Pill>
            <Pill>{data.courseInfo.nombrePartants} partants</Pill>
            {formatCurrency(data.courseInfo.allocation) ? (
              <Pill background={GOLD_SOFT} color="#A06A00">
                Allocation {formatCurrency(data.courseInfo.allocation)}
              </Pill>
            ) : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div>
              <div style={{ fontSize: 42, lineHeight: "42px", fontWeight: 900, color: DARK }}>
                {data.courseInfo.heureDepart}
              </div>
              <div style={{ fontSize: 14, color: SLATE, marginTop: 6 }}>
                {data.isFinished
                  ? "Course terminee"
                  : data.pronoAvailable
                    ? "Analyse ouverte"
                    : formatRevealTime(data.minutesUntilStart)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <Pill
                background={data.isFinished ? "#ECEFF4" : data.pronoAvailable ? GREEN_SOFT : "#F3F4F6"}
                color={data.isFinished ? "#4B5563" : data.pronoAvailable ? GREEN : SLATE}
              >
                {data.isFinished ? "Resultat disponible" : data.pronoAvailable ? "Lecture active" : "T-30"}
              </Pill>
              {!data.isFinished ? (
                <span style={{ fontSize: 13, color: "#D97706", fontWeight: 700 }}>
                  {formatCountdown(data.minutesUntilStart)}
                </span>
              ) : null}
            </div>
          </div>
          {contextHighlights.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #E7ECF1",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {contextHighlights.map((item) => (
                <Pill key={item} background="#F8FAFC" color={SLATE}>
                  {item}
                </Pill>
              ))}
            </div>
          ) : null}
        </SectionCard>

        {!data.pronoAvailable && !data.isFinished ? (
          <SectionCard title="Lecture a venir" kicker="Tempo moteur">
            <div style={{ fontSize: 15, lineHeight: "22px", color: SLATE }}>
              Le moteur ouvrira sa lecture detaillee 30 minutes avant le depart officiel.
              Pour cette course, l&apos;analyse sera visible via {formatRevealTime(data.minutesUntilStart).toLowerCase()}.
            </div>
          </SectionCard>
        ) : null}

        {data.paywall?.required && !analysis ? (
          <SectionCard title="Pronostic reserve aux abonnes" kicker="PMU AI Premium">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 15, lineHeight: "22px", color: SLATE }}>
                La page d&apos;accueil reste gratuite, mais le classement complet, les value bets,
                les mises Kelly et les tickets detailles sont reserves aux abonnes.
              </div>
              {data.paywall.preview?.favori ? (
                <div
                  style={{
                    borderRadius: 18,
                    padding: 14,
                    background: "#F8FAFC",
                    border: "1px solid #E7ECF1",
                  }}
                >
                  <div style={{ fontSize: 12, color: SLATE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Apercu gratuit
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>
                    Favori technique: N{data.paywall.preview.favori.numPmu} {data.paywall.preview.favori.nom}
                  </div>
                  <div style={{ fontSize: 14, color: SLATE, marginTop: 6 }}>
                    Lisibilite {data.paywall.preview.lisibilite} · {data.paywall.preview.recommendation ?? "Lecture premium"}
                  </div>
                </div>
              ) : null}
              <button
                onClick={() => router.push("/login?redirect=/mes-paris")}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 16,
                  padding: "15px 18px",
                  background: GREEN,
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Se connecter et s&apos;abonner
              </button>
            </div>
          </SectionCard>
        ) : null}

        {analysis && simpleTicket ? (
          <>
            <SectionCard title={verdict.title} kicker={verdict.label} accent="rgba(11,139,75,0.12)">
              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    borderRadius: 22,
                    background: "#F8FAFC",
                    border: "1px solid #E7ECF1",
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: GREEN, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                        Ticket conseille
                      </div>
                      <div style={{ fontSize: 26, lineHeight: "30px", fontWeight: 900, color: DARK, marginBottom: 6 }}>
                        N{simpleTicket.numPmu} {simpleTicket.nom}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: "20px", color: SLATE }}>
                        {getHumanReference(simpleTicket, data.courseInfo.estPlat)}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <Pill background={verdictTone.background} color={verdictTone.color}>
                        {verdict.title}
                      </Pill>
                      <Pill background={`${GREEN}14`} color={GREEN}>
                        {formatTicketType(simpleTicket.prediction.typePariConseille)}
                      </Pill>
                    </div>
                  </div>

                  <div style={{ fontSize: 15, lineHeight: "22px", color: SLATE, marginBottom: 14 }}>
                    {verdict.subtitle}
                  </div>

                  {technicalFavorite && technicalFavorite.numPmu !== simpleTicket.numPmu ? (
                    <div
                      style={{
                        borderRadius: 16,
                        background: "#FFFFFF",
                        border: "1px solid #E7ECF1",
                        padding: "12px 14px",
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ fontSize: 12, color: SLATE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                        Favori technique moteur
                      </div>
                      <div style={{ fontSize: 15, lineHeight: "21px", color: DARK, fontWeight: 700 }}>
                        N{technicalFavorite.numPmu} {technicalFavorite.nom}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: "18px", color: SLATE, marginTop: 4 }}>
                        Le moteur voit ce cheval comme repere technique, mais le ticket conseille reste N{simpleTicket.numPmu}.
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <MetricCard
                      label="Confiance IA"
                      value={`${analysis.scoreConfiance?.score ?? 0}/10`}
                      hint={analysis.prediction.decisionCourse === "VALIDE" ? "Ticket jouable pour la gagne" : "Lecture plutot defensive"}
                      tone={
                        (analysis.scoreConfiance?.score ?? 0) >= 7
                          ? "good"
                          : (analysis.scoreConfiance?.score ?? 0) >= 6
                            ? "warn"
                            : "bad"
                      }
                    />
                    <MetricCard
                      label="Tenue du repere"
                      value={`${round1(analysis.soliditeFavori?.score ?? 0)}/100`}
                      hint="Mesure si le repere principal tient reellement la course."
                      tone={
                        (analysis.soliditeFavori?.score ?? 0) >= 72
                          ? "good"
                          : (analysis.soliditeFavori?.score ?? 0) >= 62
                            ? "warn"
                            : "bad"
                      }
                    />
                    <MetricCard
                      label="Angle de jeu"
                      value={simpleTicket.prediction.action}
                      hint={simpleTicket.prediction.valueBet ? "Value bet confirme" : "Pas assez d'edge pour miser"}
                      tone={simpleTicket.prediction.action === "MISER" ? "good" : "bad"}
                    />
                    <MetricCard
                      label="Lisibilite"
                      value={analysis.prediction.lisibilite}
                      hint={describeLisibilite(analysis.prediction.lisibilite)}
                      tone={
                        analysis.prediction.lisibilite === "LISIBLE"
                          ? "good"
                          : analysis.prediction.lisibilite === "COMPLEXE"
                            ? "warn"
                            : "bad"
                      }
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
            <SectionCard title="Value et mise" kicker="Decision bankroll" accent="rgba(11,139,75,0.1)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MetricCard
                  label="Cote actuelle"
                  value={formatOdds(simpleTicket.cote)}
                  hint="Cote PMU au moment de l'analyse"
                  tone="default"
                />
                <MetricCard
                  label="Proba reelle"
                  value={formatPercent(simpleTicket.prediction.probaEstimee)}
                  hint={`Marche ${formatPercent(simpleTicket.prediction.probabiliteImplicite)}`}
                  tone={simpleTicket.prediction.valueBet ? "good" : "warn"}
                />
                <MetricCard
                  label="Mise Kelly"
                  value={formatCurrency(simpleTicket.prediction.miseBase100) ?? "0 EUR"}
                  hint={`Cap bankroll ${Math.round(simpleTicket.prediction.bankrollPct * 100)}%`}
                  tone={simpleTicket.prediction.action === "MISER" ? "good" : "bad"}
                />
                <MetricCard
                  label="Decision"
                  value={simpleTicket.prediction.action}
                  hint={
                    simpleTicket.prediction.valueBet
                      ? "Value bet confirme: proba reelle > proba cote x 1.15"
                      : "Aucun value bet confirme"
                  }
                  tone={simpleTicket.prediction.action === "MISER" ? "good" : "bad"}
                />
              </div>

              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(simpleTicket.prediction.topFacteurs ?? []).map((factor) => (
                  <Pill key={factor} background="#F4FBF7" color={GREEN}>
                    {factor}
                  </Pill>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Paris optimises" kicker="Simple, couple, trio, quinte, multi">
              <div style={{ display: "grid", gap: 10 }}>
                <BetPlanCard label="Simple gagnant" summary={analysis.bettingPlan.simpleGagnant} />
                <BetPlanCard label="Couple" summary={analysis.bettingPlan.couple} />
                <BetPlanCard label="Trio" summary={analysis.bettingPlan.trio} />
                <BetPlanCard label="Quinte" summary={analysis.bettingPlan.quinte} />
                <BetPlanCard label="Multi" summary={analysis.bettingPlan.multi} />
              </div>
            </SectionCard>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
            <SectionCard title="Alertes intelligentes" kicker="Lecture globale">
              <div style={{ display: "grid", gap: 12 }}>
                {daySignal ? (
                  <div
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      background:
                        daySignal.label === "JOURNEE_FAVORABLE"
                          ? "#F4FBF7"
                          : daySignal.label === "JOURNEE_DEFAVORABLE"
                            ? "#FFF2F2"
                            : "#F8FAFC",
                      border:
                        daySignal.label === "JOURNEE_FAVORABLE"
                          ? "1px solid #D9F0E2"
                          : daySignal.label === "JOURNEE_DEFAVORABLE"
                            ? "1px solid #F7D5D5"
                            : "1px solid #E7ECF1",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: SLATE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      Indicateur journee
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: DARK, marginBottom: 8 }}>
                      {daySignal.label.replaceAll("_", " ")}
                    </div>
                    <div style={{ fontSize: 14, color: SLATE, marginBottom: 10 }}>
                      Score global {daySignal.score}/100
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {daySignal.raisons.map((reason) => (
                        <div key={reason} style={{ fontSize: 14, lineHeight: "20px", color: SLATE }}>
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {analysis.alertes.length > 0 ? (
                  analysis.alertes.map((alert) => (
                    <div
                      key={alert}
                      style={{
                        borderRadius: 16,
                        padding: "12px 14px",
                        background: "#FFF8E6",
                        border: "1px solid #F1DFC2",
                        color: "#8A5A00",
                        fontSize: 14,
                        lineHeight: "20px",
                      }}
                    >
                      {alert}
                    </div>
                  ))
                ) : (
                  <div style={{ color: SLATE, fontSize: 14 }}>Aucune alerte additionnelle sur cette course.</div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Plan de jeu" kicker="Lecture ticket" accent="rgba(11,139,75,0.14)">
              <TicketPanel
                title="Ticket principal"
                subtitle={getHumanReference(simpleTicket, data.courseInfo.estPlat)}
                runner={simpleTicket}
                badge={formatTicketType(simpleTicket.prediction.typePariConseille)}
                accent={GREEN}
                arrivalPosition={data.isFinished ? simpleTicketPosition : undefined}
              />

              {placeBase || (technicalFavorite && technicalFavorite.numPmu !== simpleTicket.numPmu) ? (
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 10,
                  }}
                >
                  {placeBase && placeBase.numPmu !== simpleTicket.numPmu ? (
                    <SecondaryRunnerCard
                      title="Base place de secours"
                      runner={placeBase}
                      accent="#C38700"
                      placeMode
                      arrivalPosition={data.isFinished ? placeBasePosition : undefined}
                      humanReference={getHumanReference(placeBase, data.courseInfo.estPlat)}
                    />
                  ) : null}

                  {technicalFavorite && technicalFavorite.numPmu !== simpleTicket.numPmu ? (
                    <SecondaryRunnerCard
                      title="Favori technique moteur"
                      runner={technicalFavorite}
                      accent="#1560C7"
                      arrivalPosition={data.isFinished ? technicalFavoritePosition : undefined}
                      humanReference={getHumanReference(technicalFavorite, data.courseInfo.estPlat)}
                    />
                  ) : null}
                </div>
              ) : null}
            </SectionCard>
            </div>

            {data.isFinished && data.officialArrival.length > 0 ? (
              <SectionCard title="Debrief officiel" kicker="Arrivee course">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {data.officialArrival.slice(0, 3).map((runner) => (
                    <Pill key={`${runner.position}-${runner.numPmu}`} background="#F3F4F6" color={DARK}>
                      {formatPosition(runner.position)} N{runner.numPmu} {runner.nom}
                    </Pill>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: "#F9FBFC",
                      border: "1px solid #E7ECF1",
                    }}
                  >
                    <div style={{ fontSize: 12, color: SLATE, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Ticket principal
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: DARK, marginBottom: 6 }}>
                      N{simpleTicket.numPmu} {simpleTicket.nom}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: getOutcomeTone(simpleTicketPosition, false).background,
                        color: getOutcomeTone(simpleTicketPosition, false).color,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                      >
                      {simpleTicketPosition ? `${getOutcomeTone(simpleTicketPosition, false).label} (${formatPosition(simpleTicketPosition)})` : "Resultat indisponible"}
                    </span>
                  </div>

                  {placeBase && placeBase.numPmu !== simpleTicket.numPmu ? (
                    <div
                      style={{
                        borderRadius: 18,
                        padding: 14,
                        background: "#F9FBFC",
                        border: "1px solid #E7ECF1",
                      }}
                    >
                      <div style={{ fontSize: 12, color: SLATE, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Base place
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: DARK, marginBottom: 6 }}>
                        N{placeBase.numPmu} {placeBase.nom}
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: getOutcomeTone(placeBasePosition, true).background,
                          color: getOutcomeTone(placeBasePosition, true).color,
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {placeBasePosition ? `${getOutcomeTone(placeBasePosition, true).label} (${formatPosition(placeBasePosition)})` : "Resultat indisponible"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
            <SectionCard title="Lecture moteur" kicker="Ce qui tient / ce qui force la prudence">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    borderRadius: 18,
                    border: "1px solid #D9F0E2",
                    background: "#F4FBF7",
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: GREEN, marginBottom: 10 }}>Ce qui tient dans la course</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {strengths.length > 0 ? (
                      strengths.map((point) => (
                        <div
                          key={point}
                          style={{
                            borderRadius: 14,
                            padding: "12px 14px",
                            background: "#FFFFFF",
                            border: "1px solid #D9F0E2",
                            color: "#0A6F3B",
                            fontSize: 14,
                            lineHeight: "20px",
                          }}
                        >
                          {point}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: SLATE, fontSize: 14 }}>Aucun point fort franc ne ressort du moteur.</div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 18,
                    border: "1px solid #F1DFC2",
                    background: "#FFF7E8",
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#8A5A00", marginBottom: 10 }}>Ce qui force la prudence</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {warnings.length > 0 ? (
                      warnings.map((point) => (
                        <div
                          key={point}
                          style={{
                            borderRadius: 14,
                            padding: "12px 14px",
                            background: "#FFFFFF",
                            border: "1px solid #F1DFC2",
                            color: "#8A5A00",
                            fontSize: 14,
                            lineHeight: "20px",
                          }}
                        >
                          {point}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: SLATE, fontSize: 14 }}>Pas d&apos;alerte majeure remontee par le moteur.</div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Radar top 5" kicker="Classement du moteur">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {analysis.top5.map((runner, index) => {
                  const position = data.isFinished ? getArrivalPosition(runner.numPmu, data.officialArrival) : null;
                  return (
                    <div
                      key={runner.numPmu}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 1fr auto",
                        gap: 12,
                        alignItems: "center",
                        padding: 14,
                        borderRadius: 18,
                        background: index === 0 ? "#F4FBF7" : "#F8FAFC",
                        border: `1px solid ${index === 0 ? "#D9F0E2" : "#E7ECF1"}`,
                      }}
                    >
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 15,
                          background: index === 0 ? GREEN : DARK,
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          fontWeight: 800,
                        }}
                      >
                        {runner.numPmu}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: DARK, lineHeight: "22px" }}>{runner.nom}</div>
                        <div style={{ fontSize: 13, color: SLATE, marginTop: 4 }}>
                          Score {round1(runner.prediction.scoreFinalPari)} - PMU {formatOdds(runner.cote)} - Proba {formatPercent(runner.prediction.probaEstimee)}
                          {runner.stalle || runner.placeCorde ? ` - Stalle ${runner.stalle ?? runner.placeCorde}` : ""} - Mise {formatCurrency(runner.prediction.miseBase100) ?? "0 EUR"}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          <Pill
                            background={getActionTone(runner.prediction.action, runner.prediction.valueBet).background}
                            color={getActionTone(runner.prediction.action, runner.prediction.valueBet).color}
                          >
                            {getActionTone(runner.prediction.action, runner.prediction.valueBet).label}
                          </Pill>
                          {(runner.prediction.topFacteurs ?? []).map((factor) => (
                            <Pill key={`${runner.numPmu}-${factor}`} background="#F3F4F6" color={SLATE}>
                              {factor}
                            </Pill>
                          ))}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <ConfidenceBar score={runner.prediction.confiance} />
                        </div>
                      </div>
                      {position ? (
                        <Pill
                          background={position <= 3 ? GREEN_SOFT : "#F3F4F6"}
                          color={position <= 3 ? GREEN : SLATE}
                        >
                          {formatPosition(position)}
                        </Pill>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
            </div>
          </>
        ) : null}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 1180,
          height: 72,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(18px)",
          borderTop: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 -12px 30px rgba(15,23,42,0.08)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 120,
        }}
      >
        <button
          onClick={() => router.push(`/?date=${selectedDate}`)}
          style={{ border: "none", background: "transparent", color: GREEN, fontWeight: 800, cursor: "pointer" }}
        >
          Courses
        </button>
        <button
          onClick={() => router.push("/mes-paris")}
          style={{ border: "none", background: "transparent", color: SLATE, fontWeight: 700, cursor: "pointer" }}
        >
          Mes Paris
        </button>
        <button
          onClick={() => router.push(`/bilan?date=${selectedDate}`)}
          style={{ border: "none", background: "transparent", color: SLATE, fontWeight: 700, cursor: "pointer" }}
        >
          Bilan
        </button>
      </div>
    </div>
  );
}




