"use client";

import { useEffect, useState } from "react";
import { useCombo } from "@/components/ComboBuilder";
import type { RoleCheval, RoleId, LisibiliteRoleCheval } from "@/lib/horse-roles";
import { calculerKelly } from "@/lib/kelly";

const ROLE_STYLES: Record<
  RoleId,
  {
    card: string;
    text: string;
    bar: string;
  }
> = {
  FAVORI: {
    card: "border-blue-400 bg-blue-950/30",
    text: "text-blue-300",
    bar: "bg-blue-400",
  },
  PEPITE: {
    card: "border-yellow-400 bg-yellow-950/30",
    text: "text-yellow-300",
    bar: "bg-yellow-400",
  },
  OUTSIDER: {
    card: "border-green-400 bg-green-950/30",
    text: "text-green-300",
    bar: "bg-green-400",
  },
  OUBLIE: {
    card: "border-slate-400 bg-slate-800/30",
    text: "text-slate-300",
    bar: "bg-slate-400",
  },
};

function formatCote(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

function formatScore(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function getRiskClass(level: "FAIBLE" | "MOYEN" | "ELEVE") {
  if (level === "FAIBLE") return "border-green-300 bg-green-100 text-green-700";
  if (level === "MOYEN") return "border-orange-300 bg-orange-100 text-orange-700";
  return "border-red-300 bg-red-100 text-red-700";
}

type CourseRolesCourse = {
  dateStr?: string | null;
  reunion?: number | string | null;
  course?: number | string | null;
  hippodrome?: string | null;
  nomCourse?: string | null;
};

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

export function CourseRoles({
  roles,
  lisibilite = "COMPLEXE",
  course,
}: {
  roles: RoleCheval[];
  lisibilite?: LisibiliteRoleCheval;
  course?: CourseRolesCourse | null;
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
        const score = formatScore(role.score_cheval);
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
            className={`rounded-lg border p-4 ${style.card}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${style.text}`}>
                  {role.emoji} {role.label}
                </p>
                <h3 className="mt-2 truncate text-lg font-bold text-[var(--pmu-text)]">
                  N°{role.cheval_num} {role.cheval_nom}
                </h3>
              </div>

              <span
                className={`rounded-lg border border-current px-2 py-1 text-xs font-semibold ${style.text}`}
              >
                Cote {formatCote(role.cote)}
              </span>
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-lg bg-black/20">
                <div
                  className={`h-full rounded-lg ${style.bar}`}
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-[var(--pmu-text-soft)]">
                  Score algo{" "}
                  <strong className="text-[var(--pmu-text)]">{score}/100</strong>
                </span>
                <span className="text-[var(--pmu-text-soft)]">
                  Confiance{" "}
                  <strong className="text-[var(--pmu-text)]">
                    {role.confiance.toFixed(1)}/10
                  </strong>
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
              {role.raison}
            </p>

            {kelly ? (
              <div className="mt-4 rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-[var(--pmu-text-muted)]">
                    Ma bankroll
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={bankroll || ""}
                    onChange={(event) => updateBankroll(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] px-3 py-2 text-sm text-[var(--pmu-text)]"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--pmu-text)]">
                    Mise conseillee : {kelly.mise_conseille} EUR ({kelly.fraction_bankroll}% bankroll)
                  </p>
                  <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${getRiskClass(kelly.niveau_risque)}`}>
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
                className="mt-4 w-full rounded-lg border border-[var(--pmu-primary)] bg-[var(--pmu-primary-fade)] px-3 py-2 text-sm font-semibold text-[var(--pmu-primary)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {selectedInCombo
                  ? "Dans le combo"
                  : comboFull
                    ? "Combo complet"
                    : "+ Ajouter au combo"}
              </button>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
