"use client";

import { useEffect, useState } from "react";
import { useCombo } from "@/components/ComboBuilder";
import type { ArrivalRow } from "@/features/race/components/ParticipantsTable";
import type { RoleCheval, RoleId, LisibiliteRoleCheval } from "@/lib/horse-roles";
import { calculerKelly } from "@/lib/kelly";

const ROLE_STYLES: Record<
  RoleId,
  {
    background: string;
    border: string;
    color: string;
  }
> = {
  FAVORI: {
    background: "#EAF3DE",
    border: "rgba(42,77,18,0.2)",
    color: "#2A4D12",
  },
  PEPITE: {
    background: "#FDFAF2",
    border: "rgba(140,109,47,0.3)",
    color: "#8C6D2F",
  },
  OUTSIDER: {
    background: "#F0F9E8",
    border: "rgba(42,77,18,0.2)",
    color: "#2A4D12",
  },
  OUBLIE: {
    background: "#FDFCF9",
    border: "rgba(24,22,15,0.09)",
    color: "#9C9485",
  },
};

type CourseRolesCourse = {
  dateStr?: string | null;
  reunion?: number | string | null;
  course?: number | string | null;
  hippodrome?: string | null;
  nomCourse?: string | null;
};

function formatCote(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

function formatScore(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function getRiskClass(level: "FAIBLE" | "MOYEN" | "ELEVE") {
  if (level === "FAIBLE") {
    return "border-[var(--pmu-primary)] bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]";
  }
  if (level === "MOYEN") {
    return "border-[var(--pmu-orange)] bg-[var(--pmu-earth-light)] text-[var(--pmu-orange)]";
  }
  return "border-[var(--pmu-red)] bg-[var(--pmu-earth-light)] text-[var(--pmu-red)]";
}

function getCourseLabel(course?: CourseRolesCourse | null) {
  const raceLabel =
    course?.reunion !== null &&
    course?.reunion !== undefined &&
    course?.course !== null &&
    course?.course !== undefined
      ? `R${course.reunion}C${course.course}`
      : "Course PMU";
  const place = course?.hippodrome ?? course?.nomCourse ?? "";

  return place ? `${raceLabel} ${place}` : raceLabel;
}

function getFinalPosition(
  officialArrival: ArrivalRow[] | null | undefined,
  chevalNum: number
) {
  const row = officialArrival?.find(
    (arrival) => String(arrival.numPmu) === String(chevalNum)
  );

  if (!row?.position) return null;
  return row.position === 1 ? "1er" : `${row.position}e`;
}

export function CourseRoles({
  roles,
  lisibilite = "COMPLEXE",
  course,
  officialArrival = [],
}: {
  roles: RoleCheval[];
  lisibilite?: LisibiliteRoleCheval;
  course?: CourseRolesCourse | null;
  officialArrival?: ArrivalRow[] | null;
}) {
  const { addSelection, isSelected, selections } = useCombo();
  const [bankroll, setBankroll] = useState(1000);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = window.localStorage.getItem("pmu-bankroll");
      const parsed = stored ? Number(stored) : 1000;
      if (Number.isFinite(parsed) && parsed > 0) {
        setBankroll(parsed);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function updateBankroll(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBankroll(0);
      return;
    }

    setBankroll(parsed);
    window.localStorage.setItem("pmu-bankroll", String(parsed));
  }

  if (roles.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {roles.map((role) => {
        const style = ROLE_STYLES[role.role];
        const score = Math.max(0, Math.min(100, formatScore(role.score_cheval)));
        const positionFinale = getFinalPosition(officialArrival, role.cheval_num);
        const showKelly = role.role !== "FAVORI";
        const canAddToCombo = role.role === "PEPITE" || role.role === "OUTSIDER";
        const comboId = `${course?.dateStr ?? "date"}-${course?.reunion ?? "R"}-${
          course?.course ?? "C"
        }-${role.cheval_num}-${role.role}`;
        const selectedInCombo = isSelected(comboId);
        const comboFull = selections.length >= 4 && !selectedInCombo;
        const kelly = showKelly
          ? calculerKelly({
              bankroll: Math.max(bankroll, 1),
              cote: role.cote,
              confiance: role.confiance,
              qualite: role.score_cheval,
              lisibilite,
            })
          : null;

        return (
          <article
            key={role.role}
            style={{
              background: style.background,
              border: `1px solid ${style.border}`,
              borderRadius: "8px",
              padding: "0.85rem 1rem",
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <span
                style={{
                  color: style.color,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {role.emoji} {role.label}
              </span>
              <span
                style={{
                  color: style.color,
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontWeight: 700,
                }}
              >
                {formatCote(role.cote)}x
              </span>
            </div>

            <p
              title={role.cheval_nom}
              style={{
                color: "#1A2018",
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "1rem",
                fontStyle: "italic",
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {role.cheval_nom}
            </p>
            <p style={{ color: "#6b6b4a", fontSize: "0.65rem" }}>
              N°{role.cheval_num}
              {positionFinale ? ` · arrivée ${positionFinale}` : ""}
            </p>

            <div
              style={{
                background: style.color,
                borderRadius: "999px",
                height: "3px",
                marginTop: "0.5rem",
                maxWidth: "100%",
                width: `${score}%`,
              }}
            />

            <p
              style={{
                color: "#6b6b4a",
                fontSize: "0.68rem",
                lineHeight: 1.3,
                marginTop: "0.45rem",
              }}
            >
              {role.raison}
            </p>

            {kelly ? (
              <div className="mt-3 border-t border-[var(--pmu-border)] pt-3">
                <label className="block">
                  <span className="app-label">Bankroll</span>
                  <input
                    type="number"
                    min="1"
                    value={bankroll || ""}
                    onChange={(event) => updateBankroll(event.target.value)}
                    className="app-input mt-1 w-full"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "#6b6b4a" }}>
                  <span>
                    Mise suggérée :{" "}
                    <strong style={{ color: "#1A2018" }}>
                      {kelly.mise_conseille} EUR
                    </strong>{" "}
                    ({kelly.fraction_bankroll}%)
                  </span>
                  <span className={`rounded-lg border px-2 py-1 font-semibold ${getRiskClass(kelly.niveau_risque)}`}>
                    {kelly.niveau_risque}
                  </span>
                </div>
              </div>
            ) : null}

            {canAddToCombo ? (
              <button
                type="button"
                disabled={selectedInCombo || comboFull}
                onClick={() =>
                  addSelection({
                    id: comboId,
                    dateStr: course?.dateStr ?? null,
                    reunion: course?.reunion ?? "R",
                    course: course?.course ?? "C",
                    courseLabel: getCourseLabel(course),
                    cheval_num: role.cheval_num,
                    cheval_nom: role.cheval_nom,
                    cote: role.cote,
                    role: role.role === "PEPITE" ? "PEPITE" : "OUTSIDER",
                    confiance: role.confiance,
                    probability: role.confiance / 10,
                  })
                }
                className="mt-3 w-full rounded-lg border border-[var(--pmu-primary)] bg-[var(--pmu-primary-fade)] px-3 py-2 text-sm font-semibold text-[var(--pmu-primary)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {selectedInCombo
                  ? "Dans le combo"
                  : comboFull
                    ? "Combo complet"
                    : "Ajouter au combo"}
              </button>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
