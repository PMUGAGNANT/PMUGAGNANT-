"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pmu-combo-builder";
const MAX_SELECTIONS = 4;

export type ComboRole = "PEPITE" | "OUTSIDER";

export interface ComboSelection {
  id: string;
  dateStr?: string | null;
  reunion: number | string;
  course: number | string;
  courseLabel: string;
  cheval_num: number | string;
  cheval_nom: string;
  cote: number;
  role: ComboRole;
  confiance: number;
  probability: number;
}

export type ComboSelectionInput = Omit<ComboSelection, "probability"> & {
  probability?: number;
};

interface ComboContextValue {
  selections: ComboSelection[];
  stake: number;
  isOpen: boolean;
  addSelection: (selection: ComboSelectionInput) => void;
  removeSelection: (id: string) => void;
  clearSelections: () => void;
  setStake: (stake: number) => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  isSelected: (id: string) => boolean;
}

const ComboContext = createContext<ComboContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeSelection(selection: ComboSelectionInput): ComboSelection {
  const cote =
    Number.isFinite(selection.cote) && selection.cote > 1 ? round2(selection.cote) : 1;
  const confiance = Number.isFinite(selection.confiance)
    ? clamp(round2(selection.confiance), 0, 10)
    : 0;
  const probability = Number.isFinite(selection.probability ?? Number.NaN)
    ? clamp(round2(selection.probability ?? 0), 0.01, 0.95)
    : clamp(round2(confiance / 10), 0.01, 0.95);

  return {
    ...selection,
    cote,
    confiance,
    probability,
    cheval_nom: selection.cheval_nom.trim() || "Cheval",
    courseLabel: selection.courseLabel.trim() || `R${selection.reunion}C${selection.course}`,
  };
}

function isStoredComboSelection(value: unknown): value is ComboSelection {
  if (!value || typeof value !== "object") return false;

  const selection = value as ComboSelection;
  return (
    typeof selection.id === "string" &&
    typeof selection.cheval_nom === "string" &&
    typeof selection.courseLabel === "string" &&
    (selection.role === "PEPITE" || selection.role === "OUTSIDER") &&
    typeof selection.cote === "number" &&
    typeof selection.confiance === "number" &&
    typeof selection.probability === "number"
  );
}

function formatCote(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "--";
}

function formatPercent(value: number) {
  return `${round2(value * 100).toFixed(2)}%`;
}

function buildTicketText(
  selections: ComboSelection[],
  stake: number,
  combinedOdds: number,
  estimatedProbability: number,
  potentialGain: number
) {
  return [
    "Ticket combo PMU Gagnant",
    `Mise: ${round2(stake)} EUR`,
    `Cote combinee: ${formatCote(combinedOdds)}`,
    `Probabilite estimee: ${formatPercent(estimatedProbability)}`,
    `Gain potentiel: ${round2(potentialGain)} EUR`,
    "",
    ...selections.map(
      (selection, index) =>
        `${index + 1}. ${selection.courseLabel} - #${selection.cheval_num} ${
          selection.cheval_nom
        } - ${selection.role} - cote ${formatCote(selection.cote)}`
    ),
  ].join("\n");
}

export function ComboProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<ComboSelection[]>([]);
  const [stake, setStakeState] = useState(10);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const stored = raw ? (JSON.parse(raw) as unknown) : null;

        if (stored && typeof stored === "object") {
          const payload = stored as {
            selections?: unknown;
            stake?: unknown;
          };
          if (Array.isArray(payload.selections)) {
            setSelections(
              payload.selections.filter(isStoredComboSelection).slice(0, MAX_SELECTIONS)
            );
          }
          if (typeof payload.stake === "number" && Number.isFinite(payload.stake)) {
            setStakeState(Math.max(1, round2(payload.stake)));
          }
        }
      } catch {
        /* ignore local state */
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selections, stake })
      );
    } catch {
      /* ignore local state */
    }
  }, [hydrated, selections, stake]);

  const addSelection = useCallback((selection: ComboSelectionInput) => {
    const normalized = normalizeSelection(selection);

    setSelections((current) => {
      if (current.some((item) => item.id === normalized.id)) {
        return current;
      }

      if (current.length >= MAX_SELECTIONS) {
        return current;
      }

      return [...current, normalized];
    });
    setIsOpen(true);
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections((current) => current.filter((selection) => selection.id !== id));
  }, []);

  const clearSelections = useCallback(() => {
    setSelections([]);
  }, []);

  const updateStake = useCallback((nextStake: number) => {
    setStakeState(Number.isFinite(nextStake) ? Math.max(1, round2(nextStake)) : 1);
  }, []);

  const isSelected = useCallback(
    (id: string) => selections.some((selection) => selection.id === id),
    [selections]
  );

  const value = useMemo<ComboContextValue>(
    () => ({
      selections,
      stake,
      isOpen,
      addSelection,
      removeSelection,
      clearSelections,
      setStake: updateStake,
      openPanel: () => setIsOpen(true),
      closePanel: () => setIsOpen(false),
      togglePanel: () => setIsOpen((current) => !current),
      isSelected,
    }),
    [addSelection, clearSelections, isOpen, isSelected, removeSelection, selections, stake, updateStake]
  );

  return <ComboContext.Provider value={value}>{children}</ComboContext.Provider>;
}

export function useCombo() {
  const context = useContext(ComboContext);
  if (!context) {
    throw new Error("useCombo must be used inside ComboProvider.");
  }

  return context;
}

export function ComboPanel() {
  const {
    selections,
    stake,
    isOpen,
    removeSelection,
    clearSelections,
    setStake,
    closePanel,
    togglePanel,
  } = useCombo();
  const [copied, setCopied] = useState(false);

  const metrics = useMemo(() => {
    const combinedOdds =
      selections.length > 0
        ? selections.reduce((product, selection) => product * selection.cote, 1)
        : 0;
    const estimatedProbability =
      selections.length > 0
        ? selections.reduce((product, selection) => product * selection.probability, 1)
        : 0;
    const potentialGain = combinedOdds * stake;

    return {
      combinedOdds: round2(combinedOdds),
      estimatedProbability: round2(estimatedProbability),
      potentialGain: round2(potentialGain),
    };
  }, [selections, stake]);

  const canCopy = selections.length >= 2 && selections.length <= MAX_SELECTIONS;
  const missingCount = Math.max(0, 2 - selections.length);

  async function copyTicket() {
    if (!canCopy || !navigator.clipboard) return;

    await navigator.clipboard.writeText(
      buildTicketText(
        selections,
        stake,
        metrics.combinedOdds,
        metrics.estimatedProbability,
        metrics.potentialGain
      )
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={togglePanel}
        className="fixed bottom-4 right-4 z-50 rounded-lg border border-[var(--pmu-primary)] bg-[var(--pmu-primary)] px-4 py-3 text-sm font-semibold text-[var(--pmu-on-primary)]"
      >
        Combo ({selections.length})
      </button>
    );
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 max-h-[82vh] overflow-y-auto rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-4 text-[var(--pmu-text)] md:inset-x-auto md:right-5 md:bottom-5 md:w-[27rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-kicker">Ticket multi</p>
          <h2 className="mt-1 text-2xl font-black">Combo courses</h2>
          <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
            2 a 4 chevaux, pepites et outsiders seulement.
          </p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="rounded-lg border border-[var(--pmu-border)] px-3 py-2 text-sm font-semibold text-[var(--pmu-text-soft)]"
        >
          Fermer
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {selections.length > 0 ? (
          selections.map((selection) => (
            <div
              key={selection.id}
              className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    #{selection.cheval_num} {selection.cheval_nom}
                  </p>
                  <p className="mt-1 text-xs text-[var(--pmu-text-soft)]">
                    {selection.courseLabel}
                  </p>
                </div>
                <span className="rounded-lg border border-[var(--pmu-primary)] px-2 py-1 text-[11px] font-semibold text-[var(--pmu-primary)]">
                  {selection.role}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--pmu-text-soft)]">
                <span>Cote {formatCote(selection.cote)}</span>
                <span>Proba {formatPercent(selection.probability)}</span>
                <button
                  type="button"
                  onClick={() => removeSelection(selection.id)}
                  className="font-semibold text-[var(--pmu-red)]"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] p-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
            Ajoute une pepite ou un outsider depuis une course pour demarrer le ticket.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] p-3">
          <p className="app-label">Cote combinee</p>
          <p className="mt-1 text-lg font-black">{formatCote(metrics.combinedOdds)}</p>
        </div>
        <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] p-3">
          <p className="app-label">Proba estimee</p>
          <p className="mt-1 text-lg font-black">
            {formatPercent(metrics.estimatedProbability)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-highlight)] p-3">
          <p className="app-label">Gain</p>
          <p className="mt-1 text-lg font-black">{metrics.potentialGain} EUR</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="app-label">Mise</span>
        <input
          type="number"
          min="1"
          value={stake}
          onChange={(event) => setStake(Number(event.target.value))}
          className="app-input mt-2"
        />
      </label>

      {missingCount > 0 ? (
        <p className="mt-3 text-sm text-[var(--pmu-orange)]">
          Ajoute encore {missingCount} cheval{missingCount > 1 ? "x" : ""} pour copier le ticket.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canCopy}
          onClick={copyTicket}
          className="app-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? "Ticket copie" : "Copier le ticket"}
        </button>
        <button type="button" onClick={clearSelections} className="app-button-secondary">
          Vider
        </button>
      </div>
    </aside>
  );
}
