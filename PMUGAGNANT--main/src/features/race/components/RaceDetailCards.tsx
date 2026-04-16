import Link from "next/link";

import type {
  ArrivalRow,
  CourseParticipantRow,
} from "@/features/race/components/ParticipantsTable";
import { RaceStatusPill } from "@/features/race/components/RaceStatusPill";
import {
  formatDiscipline,
  formatMinutesLabel,
  type PronosticCardData,
  type RaceCourseInfo,
  type RacePaywallPreview,
} from "@/features/race/lib/race-page-model";
import {
  getPriorityToneColor,
  type RacePriorityBadge,
} from "@/lib/race-priority";
import type { RoleCheval, TypeRoleCheval } from "@/lib/horse-roles";

export function LockedTicketCard({
  previewLabel,
  previewLisibilite,
  previewRecommendation,
}: {
  previewLabel?: string | null;
  previewLisibilite?: string | null;
  previewRecommendation?: string | null;
}) {
  return (
    <section className="app-card p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <RaceStatusPill label="Réservé premium" tone="warning" />
        {previewLisibilite ? <span className="app-pill text-xs">{previewLisibilite}</span> : null}
      </div>

      <h2 className="mt-4 text-3xl font-black text-[var(--pmu-text)]">
        Le ticket détaillé est verrouillé
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
        Le tableau des partants reste accessible, mais la lecture complète du
        moteur et le ticket d&apos;exécution sont réservés à l&apos;accès Premium.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Cheval repéré</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {previewLabel || "Signal en cours"}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Orientation</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {previewRecommendation || "Lecture à confirmer"}
          </p>
        </div>
      </div>

      <Link href="/premium" className="app-button-primary mt-5 inline-flex">
        Débloquer le pronostic premium
      </Link>
    </section>
  );
}

export function AnalysisPendingCard() {
  return (
    <section className="app-card p-5 md:p-6">
      <RaceStatusPill label="Analyse en cours" tone="neutral" />
      <h2 className="mt-4 text-3xl font-black text-[var(--pmu-text)]">
        Le moteur termine la lecture
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
        Les partants sont déjà visibles, mais le ticket n&apos;est pas encore
        assez ferme pour être affiché ici.
      </p>
    </section>
  );
}

export function TopFiveCard({
  top5,
  participants,
}: {
  top5: Array<number | string>;
  participants: CourseParticipantRow[];
}) {
  if (top5.length === 0) {
    return null;
  }

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Lecture moteur</p>
          <h2 className="app-section-title">Top 5 de l&apos;algo</h2>
        </div>
      </div>

      <div className="grid gap-3">
        {top5.map((numero, index) => {
          const participant = participants.find(
            (item) => String(item.numero) === String(numero)
          );

          return (
            <div
              key={`${numero}-${index}`}
              className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pmu-primary-soft)] text-sm font-black text-[var(--pmu-primary)]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-black text-[var(--pmu-text)]">
                    N° {numero} {participant?.nom || `Cheval ${numero}`}
                  </p>
                  <p className="text-sm text-[var(--pmu-text-soft)]">
                    {participant?.entraineur ||
                      participant?.jockey ||
                      participant?.driver ||
                      "Profil à confirmer"}
                  </p>
                </div>
              </div>

              <div className="text-right text-sm">
                <p className="font-black text-[var(--pmu-text)]">
                  {Math.round(participant?.scoreIa ?? 0) || "--"}
                </p>
                <p className="text-[var(--pmu-text-soft)]">
                  {typeof participant?.cote === "number"
                    ? `Cote ${participant.cote.toFixed(1)}`
                    : "Cote --"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getRoleTone(role: TypeRoleCheval) {
  switch (role) {
    case "FAVORI":
      return "var(--pmu-primary)";
    case "PEPITE":
      return "var(--pmu-orange)";
    case "OUTSIDER":
      return "var(--pmu-red)";
    case "OUBLIE":
      return "var(--pmu-blue)";
  }
}

function getRoleHint(role: TypeRoleCheval) {
  switch (role) {
    case "FAVORI":
      return "Plus basse cote du matin.";
    case "PEPITE":
      return "Score fort au-dessus de 6.0.";
    case "OUTSIDER":
      return "Baisse nette depuis le matin.";
    case "OUBLIE":
      return "Score solide sans signal marche.";
  }
}

function formatVariation(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function HorseRolesCard({ roles }: { roles: RoleCheval[] }) {
  if (roles.length === 0) {
    return null;
  }

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Lecture moteur</p>
          <h2 className="app-section-title">Roles chevaux</h2>
        </div>
        <span className="app-pill text-xs">{roles.length} signaux</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((role) => {
          const tone = getRoleTone(role.role);

          return (
            <div
              key={role.role}
              className="rounded-[1.15rem] border px-4 py-4"
              style={{
                borderColor: `color-mix(in srgb, ${tone} 28%, transparent)`,
                background: `color-mix(in srgb, ${tone} 9%, var(--pmu-surface))`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-black uppercase tracking-[0.14em]"
                    style={{ color: tone }}
                  >
                    {role.emoji} {role.label}
                  </p>
                  <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                    No {role.cheval_num} {role.cheval_nom}
                  </p>
                </div>
                <span
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-sm font-black"
                  style={{
                    color: tone,
                    background: `color-mix(in srgb, ${tone} 14%, transparent)`,
                  }}
                >
                  {role.cheval_num}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                {getRoleHint(role.role)}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="app-label">Cote</p>
                  <p className="mt-1 font-mono font-black text-[var(--pmu-text)]">
                    {role.cote.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="app-label">Score</p>
                  <p className="mt-1 font-mono font-black text-[var(--pmu-text)]">
                    {Math.round(role.score_cheval)}
                  </p>
                </div>
                <div>
                  <p className="app-label">Marche</p>
                  <p className="mt-1 font-mono font-black text-[var(--pmu-text)]">
                    {formatVariation(role.variation_cote)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OfficialArrivalCard({ arrivee }: { arrivee: ArrivalRow[] }) {
  if (arrivee.length === 0) {
    return null;
  }

  const top5 = arrivee.slice(0, 5);

  return (
    <section
      style={{
        background: "var(--pmu-surface)",
        border: "1px solid var(--pmu-border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "var(--pmu-gold)",
          display: "flex",
          justifyContent: "space-between",
          padding: "0.6rem 1rem",
        }}
      >
        <span
          style={{
            color: "rgba(255,240,200,0.85)",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Arrivée officielle PMU
        </span>
        <span style={{ color: "#FFE8A3", fontSize: "0.72rem", fontWeight: 700 }}>
          Homologué
        </span>
      </div>

      <div style={{ padding: "1rem" }}>
        <div className="grid gap-2 sm:grid-cols-5">
          {top5.map((row, index) => (
            <div
              key={`${row.numPmu}-${index}`}
              style={{
                background:
                  index === 0
                    ? "#F4EDD8"
                    : index < 3
                      ? "#F5F2EB"
                      : "var(--pmu-surface)",
                border: "1px solid",
                borderColor:
                  index === 0
                    ? "rgba(140,109,47,0.3)"
                    : "rgba(24,22,15,0.08)",
                borderRadius: "8px",
                padding: "0.75rem 0.5rem",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: index === 0 ? "#8C6D2F" : "#9C9485",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  marginBottom: "0.3rem",
                  textTransform: "uppercase",
                }}
              >
                {index === 0 ? "1er" : `${index + 1}e`}
              </p>
              <p
                style={{
                  color:
                    index === 0 ? "#8C6D2F" : index < 3 ? "#5A5444" : "#9C9485",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {row.numPmu}
              </p>
              <p
                style={{
                  color: "#5A5444",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  lineHeight: 1.2,
                  marginTop: "0.3rem",
                }}
              >
                {row.nom}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 border-t border-[var(--pmu-border)] pt-3 sm:grid-cols-3">
          {[
            { label: "Rapport gagnant", value: "--" },
            { label: "Rapport placé", value: "--" },
            { label: "Couplé gagnant", value: "--" },
          ].map((rapport) => (
            <div
              key={rapport.label}
              style={{
                background: "#F5F2EB",
                borderRadius: "6px",
                padding: "0.6rem 0.75rem",
              }}
            >
              <p
                style={{
                  color: "#9C9485",
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                  textTransform: "uppercase",
                }}
              >
                {rapport.label}
              </p>
              <p
                style={{
                  color: "#2A4D12",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                }}
              >
                {rapport.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CourseDeskCard({
  courseInfo,
  minutesUntilStart,
  pronostic,
  paywallRequired,
  paywallPreview,
  isFinished,
  refreshPriority,
}: {
  courseInfo: RaceCourseInfo;
  minutesUntilStart?: number | null;
  pronostic: PronosticCardData | null;
  paywallRequired: boolean;
  paywallPreview?: RacePaywallPreview | null;
  isFinished: boolean;
  refreshPriority?: RacePriorityBadge | null;
}) {
  const mainHorse = pronostic?.favoris?.[0] ?? paywallPreview?.favori?.numPmu ?? null;

  return (
    <section className="app-card p-5 md:p-6">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Desk course</p>
          <h2 className="app-section-title">Lecture rapide</h2>
        </div>
        <RaceStatusPill
          label={isFinished ? "Terminée" : paywallRequired ? "Preview" : "Active"}
          tone={isFinished ? "neutral" : paywallRequired ? "warning" : "primary"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Discipline</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {formatDiscipline(courseInfo.discipline)}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Fenêtre</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {formatMinutesLabel(minutesUntilStart)}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Cheval principal</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {mainHorse ? `N° ${mainHorse}` : "À confirmer"}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Pari</p>
          <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
            {pronostic?.betType || paywallPreview?.recommendation || "En attente"}
          </p>
        </div>
        {refreshPriority ? (
          <div className="app-card-muted px-4 py-4 sm:col-span-2">
            <p className="app-label">Cadence moteur</p>
            <p
              className="mt-2 text-lg font-black"
              style={{ color: getPriorityToneColor(refreshPriority.tone) }}
            >
              {refreshPriority.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--pmu-text-soft)]">
              {refreshPriority.detail}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-4">
        <p className="app-label">Contexte piste</p>
        <p className="mt-2 text-sm leading-7 text-[var(--pmu-text-soft)]">
          {[
            courseInfo.terrain ? `Terrain ${courseInfo.terrain}` : null,
          courseInfo.meteo ? `Météo ${courseInfo.meteo}` : null,
            courseInfo.nombrePartants ? `${courseInfo.nombrePartants} partants` : null,
          ]
            .filter(Boolean)
            .join(" - ") || "Le contexte piste est encore en consolidation."}
        </p>
      </div>
    </section>
  );
}
