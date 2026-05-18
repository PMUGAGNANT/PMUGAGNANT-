import {
  formatEuros,
  STATUS_CONFIG,
  type Bet,
} from "@/features/account/lib/bets-model";

export function BetHistoryCard({ bet }: { bet: Bet }) {
  const status = STATUS_CONFIG[bet.statut] ?? STATUS_CONFIG.EN_ATTENTE;
  const gainLabel =
    bet.gain !== null
      ? `${bet.gain >= 0 ? "+" : ""}${formatEuros(bet.gain)}`
      : "Résultat en attente";

  return (
    <article className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--pmu-text-soft)]">
            R{bet.reunion}C{bet.course} - {bet.hippodrome}
          </p>
          <h3 className="mt-2 text-xl font-black leading-tight text-[var(--pmu-text)]">
            #{bet.cheval_num} {bet.cheval_nom}
          </h3>
        </div>

        <span
          className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            color: status.color,
            background: status.background,
          }}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="app-pill text-xs">{bet.type_pari}</span>
        <span className="app-pill text-xs">Cote {bet.cote}</span>
        <span className="app-pill text-xs">Mise {formatEuros(bet.mise)}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_90%,transparent)] px-4 py-3 text-sm text-[var(--pmu-text-soft)]">
          {bet.date_str} à {bet.heure_depart}
        </div>
        <div
          className="rounded-[1rem] border px-4 py-3 text-sm font-black"
          style={{
            borderColor:
              bet.gain !== null
                ? bet.gain >= 0
                  ? "color-mix(in srgb, var(--pmu-primary) 24%, transparent)"
                  : "color-mix(in srgb, var(--pmu-red) 24%, transparent)"
                : "var(--pmu-border)",
            color:
              bet.gain !== null
                ? bet.gain >= 0
                  ? "var(--pmu-primary)"
                  : "var(--pmu-red)"
                : "var(--pmu-text-soft)",
            background:
              bet.gain !== null
                ? bet.gain >= 0
                  ? "color-mix(in srgb, var(--pmu-primary) 8%, transparent)"
                  : "color-mix(in srgb, var(--pmu-red) 8%, transparent)"
                : "color-mix(in srgb, var(--pmu-surface-2) 90%, transparent)",
          }}
        >
          {gainLabel}
        </div>
      </div>
    </article>
  );
}
