"use client";

import { usePathname } from "next/navigation";
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
  const s = value as ComboSelection;
  return (
    typeof s.id === "string" &&
    typeof s.cheval_nom === "string" &&
    typeof s.courseLabel === "string" &&
    (s.role === "PEPITE" || s.role === "OUTSIDER") &&
    typeof s.cote === "number" &&
    typeof s.confiance === "number" &&
    typeof s.probability === "number"
  );
}

function formatCote(value: number) {
  return Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}x` : "--";
}

function formatPercent(value: number) {
  return `${round2(value * 100).toFixed(1)}%`;
}

function buildTicketText(
  selections: ComboSelection[],
  stake: number,
  combinedOdds: number,
  estimatedProbability: number,
  potentialGain: number
) {
  return [
    "🎯 Ticket combo TurfEdge",
    `Mise : ${round2(stake)} €`,
    `Cote combinée : ${combinedOdds.toFixed(1)}x`,
    `Probabilité estimée : ${formatPercent(estimatedProbability)}`,
    `Gain potentiel : ${round2(potentialGain)} €`,
    "",
    ...selections.map(
      (s, i) =>
        `${i + 1}. ${s.courseLabel} — N°${s.cheval_num} ${s.cheval_nom} (${s.role}) @ ${s.cote.toFixed(1)}x`
    ),
  ].join("\n");
}

/* ── Context Provider ─────────────────────────────────────── */

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
          const payload = stored as { selections?: unknown; stake?: unknown };
          if (Array.isArray(payload.selections)) {
            setSelections(
              payload.selections.filter(isStoredComboSelection).slice(0, MAX_SELECTIONS)
            );
          }
          if (typeof payload.stake === "number" && Number.isFinite(payload.stake)) {
            setStakeState(Math.max(1, round2(payload.stake)));
          }
        }
      } catch { /* ignore */ } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections, stake }));
    } catch { /* ignore */ }
  }, [hydrated, selections, stake]);

  const addSelection = useCallback((selection: ComboSelectionInput) => {
    const normalized = normalizeSelection(selection);
    setSelections((current) => {
      if (current.some((item) => item.id === normalized.id)) return current;
      if (current.length >= MAX_SELECTIONS) return current;
      return [...current, normalized];
    });
    setIsOpen(true);
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections((current) => current.filter((s) => s.id !== id));
  }, []);

  const clearSelections = useCallback(() => setSelections([]), []);
  const updateStake = useCallback((nextStake: number) => {
    setStakeState(Number.isFinite(nextStake) ? Math.max(1, round2(nextStake)) : 1);
  }, []);
  const isSelected = useCallback(
    (id: string) => selections.some((s) => s.id === id),
    [selections]
  );

  const value = useMemo<ComboContextValue>(
    () => ({
      selections, stake, isOpen,
      addSelection, removeSelection, clearSelections,
      setStake: updateStake,
      openPanel: () => setIsOpen(true),
      closePanel: () => setIsOpen(false),
      togglePanel: () => setIsOpen((v) => !v),
      isSelected,
    }),
    [addSelection, clearSelections, isOpen, isSelected, removeSelection, selections, stake, updateStake]
  );

  return <ComboContext.Provider value={value}>{children}</ComboContext.Provider>;
}

export function useCombo() {
  const context = useContext(ComboContext);
  if (!context) throw new Error("useCombo must be used inside ComboProvider.");
  return context;
}

/* ── Bouton flottant ──────────────────────────────────────── */

function ComboTrigger({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ouvrir le combo — ${count} cheval${count !== 1 ? "x" : ""} sélectionné${count !== 1 ? "s" : ""}`}
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        border: "1px solid var(--pmu-primary)",
        borderRadius: "8px",
        background: "var(--pmu-primary)",
        color: "var(--pmu-on-primary)",
        padding: "0.7rem 1.1rem",
        fontSize: "0.88rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "opacity 0.18s",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h10M4 18h6"/>
      </svg>
      Combo
      {count > 0 && (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "var(--pmu-on-primary)",
          color: "var(--pmu-primary)",
          fontSize: "0.72rem",
          fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Carte cheval dans le combo ───────────────────────────── */

function ComboCard({
  selection,
  onRemove,
}: {
  selection: ComboSelection;
  onRemove: () => void;
}) {
  const roleLabel = selection.role === "PEPITE" ? "💎 Pépite" : "🚀 Outsider";
  const roleColor = selection.role === "PEPITE"
    ? { border: "rgba(140,109,47,0.35)", bg: "rgba(244,237,216,0.6)", text: "var(--pmu-gold)" }
    : { border: "rgba(42,77,18,0.25)", bg: "var(--pmu-primary-soft)", text: "var(--pmu-primary)" };

  return (
    <div style={{
      border: "1px solid var(--pmu-border)",
      borderRadius: "8px",
      background: "var(--pmu-surface-highlight)",
      padding: "12px 14px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "1rem",
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--pmu-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            N°{selection.cheval_num} {selection.cheval_nom}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--pmu-text-muted)", marginTop: "2px" }}>
            {selection.courseLabel}
          </p>
        </div>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          border: `1px solid ${roleColor.border}`,
          borderRadius: "999px",
          background: roleColor.bg,
          color: roleColor.text,
          padding: "2px 10px",
          fontSize: "0.7rem",
          fontWeight: 700,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          {roleLabel}
        </span>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "8px",
        marginTop: "10px",
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "var(--pmu-text-muted)", letterSpacing: "0.06em" }}>Cote</p>
          <p style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--pmu-primary)",
            marginTop: "2px",
          }}>
            {formatCote(selection.cote)}
          </p>
        </div>
        <div style={{ textAlign: "center", borderLeft: "1px solid var(--pmu-border)", borderRight: "1px solid var(--pmu-border)" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "var(--pmu-text-muted)", letterSpacing: "0.06em" }}>Confiance</p>
          <p style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--pmu-text)",
            marginTop: "2px",
          }}>
            {selection.confiance.toFixed(1)}/10
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "var(--pmu-text-muted)", letterSpacing: "0.06em" }}>Proba</p>
          <p style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--pmu-text)",
            marginTop: "2px",
          }}>
            {formatPercent(selection.probability)}
          </p>
        </div>
      </div>

      {/* Supprimer */}
      <button
        type="button"
        onClick={onRemove}
        style={{
          display: "block",
          width: "100%",
          marginTop: "10px",
          paddingTop: "8px",
          borderTop: "1px solid var(--pmu-border)",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--pmu-red)",
          textAlign: "center",
          background: "none",
          cursor: "pointer",
        }}
      >
        Retirer du combo
      </button>
    </div>
  );
}

/* ── Slots vides ──────────────────────────────────────────── */

function EmptySlot({ index }: { index: number }) {
  return (
    <div style={{
      border: "1px dashed var(--pmu-border-strong)",
      borderRadius: "8px",
      padding: "14px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    }}>
      <div style={{
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        border: "1px dashed var(--pmu-border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--pmu-text-muted)",
        fontSize: "0.8rem",
        fontWeight: 600,
      }}>
        {index}
      </div>
      <p style={{ fontSize: "0.78rem", color: "var(--pmu-text-muted)" }}>
        Ajoute une pépite ou un outsider depuis une course
      </p>
    </div>
  );
}

/* ── Panel principal ──────────────────────────────────────── */

export function ComboPanel() {
  const pathname = usePathname();
  const {
    selections, stake, isOpen,
    removeSelection, clearSelections,
    setStake, closePanel, togglePanel,
  } = useCombo();
  const [copied, setCopied] = useState(false);

  const metrics = useMemo(() => {
    const combinedOdds =
      selections.length > 0
        ? selections.reduce((p, s) => p * s.cote, 1)
        : 0;
    const estimatedProbability =
      selections.length > 0
        ? selections.reduce((p, s) => p * s.probability, 1)
        : 0;
    return {
      combinedOdds: round2(combinedOdds),
      estimatedProbability: round2(estimatedProbability),
      potentialGain: round2(combinedOdds * stake),
    };
  }, [selections, stake]);

  const canCopy = selections.length >= 2;
  const missingCount = Math.max(0, 2 - selections.length);
  const slotsToShow = Math.max(0, 2 - selections.length);
  const disabled = pathname === "/login" || pathname.startsWith("/admin");

  async function copyTicket() {
    if (!canCopy || !navigator.clipboard) return;
    await navigator.clipboard.writeText(
      buildTicketText(selections, stake, metrics.combinedOdds, metrics.estimatedProbability, metrics.potentialGain)
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (disabled) {
    return null;
  }

  if (!isOpen) {
    return <ComboTrigger count={selections.length} onClick={togglePanel} />;
  }

  return (
    <aside style={{
      position: "fixed",
      right: "1.25rem",
      bottom: "1.25rem",
      zIndex: 50,
      width: "min(calc(100vw - 2.5rem), 26rem)",
      maxHeight: "85vh",
      overflowY: "auto",
      border: "1px solid var(--pmu-border-strong)",
      borderRadius: "8px",
      background: "var(--pmu-surface)",
      boxShadow: "0 8px 32px rgba(24,22,15,0.14)",
      color: "var(--pmu-text)",
    }}>

      {/* Header */}
      <div style={{
        position: "sticky",
        top: 0,
        background: "var(--pmu-surface)",
        borderBottom: "1px solid var(--pmu-border)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        zIndex: 1,
      }}>
        <div>
          <p style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--pmu-primary)",
          }}>
            Ticket multi
          </p>
          <h2 style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "1.5rem",
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--pmu-text)",
            marginTop: "2px",
            lineHeight: 1,
          }}>
            Combo courses
          </h2>
          <p style={{ fontSize: "0.75rem", color: "var(--pmu-text-muted)", marginTop: "4px" }}>
            {selections.length === 0
              ? "Ajoute 2 à 4 pépites ou outsiders"
              : `${selections.length} cheval${selections.length > 1 ? "x" : ""} sélectionné${selections.length > 1 ? "s" : ""} — max ${MAX_SELECTIONS}`}
          </p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          style={{
            border: "1px solid var(--pmu-border)",
            borderRadius: "6px",
            background: "var(--pmu-surface-highlight)",
            color: "var(--pmu-text-soft)",
            padding: "6px 12px",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Fermer
        </button>
      </div>

      {/* Liste des chevaux */}
      <div style={{ padding: "12px 16px", display: "grid", gap: "8px" }}>
        {selections.map((s) => (
          <ComboCard
            key={s.id}
            selection={s}
            onRemove={() => removeSelection(s.id)}
          />
        ))}
        {/* Slots vides */}
        {Array.from({ length: slotsToShow }).map((_, i) => (
          <EmptySlot key={i} index={selections.length + i + 1} />
        ))}
      </div>

      {/* Métriques */}
      {selections.length > 0 && (
        <div style={{
          borderTop: "1px solid var(--pmu-border)",
          borderBottom: "1px solid var(--pmu-border)",
          padding: "12px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          background: "var(--pmu-surface-2)",
        }}>
          <div>
            <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "var(--pmu-text-muted)", letterSpacing: "0.06em" }}>
              Cote combinée
            </p>
            <p style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--pmu-primary)",
              marginTop: "2px",
            }}>
              {formatCote(metrics.combinedOdds)}
            </p>
          </div>
          <div style={{ borderLeft: "1px solid var(--pmu-border)", paddingLeft: "12px" }}>
            <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "var(--pmu-text-muted)", letterSpacing: "0.06em" }}>
              Proba
            </p>
            <p style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--pmu-text)",
              marginTop: "2px",
            }}>
              {formatPercent(metrics.estimatedProbability)}
            </p>
          </div>
          <div style={{ borderLeft: "1px solid var(--pmu-border)", paddingLeft: "12px" }}>
            <p style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "var(--pmu-gold)", letterSpacing: "0.06em" }}>
              Gain potentiel
            </p>
            <p style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--pmu-gold)",
              marginTop: "2px",
            }}>
              {metrics.potentialGain > 0 ? `${metrics.potentialGain.toFixed(0)} €` : "-- €"}
            </p>
          </div>
        </div>
      )}

      {/* Mise + actions */}
      <div style={{ padding: "14px 16px", display: "grid", gap: "12px" }}>
        <div>
          <label style={{
            display: "block",
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--pmu-text-muted)",
            marginBottom: "6px",
          }}>
            Ma mise (€)
          </label>
          <input
            type="number"
            min="1"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            style={{
              width: "100%",
              border: "1px solid var(--pmu-border-strong)",
              borderRadius: "6px",
              background: "var(--pmu-surface-highlight)",
              color: "var(--pmu-text)",
              padding: "8px 12px",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          />
        </div>

        {missingCount > 0 && (
          <p style={{
            fontSize: "0.78rem",
            color: "var(--pmu-orange)",
            padding: "8px 10px",
            border: "1px solid rgba(184,80,48,0.2)",
            borderRadius: "6px",
            background: "var(--pmu-earth-light)",
          }}>
            Ajoute encore {missingCount} cheval{missingCount > 1 ? "x" : ""} pour pouvoir copier le ticket.
          </p>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            disabled={!canCopy}
            onClick={copyTicket}
            style={{
              flex: 1,
              border: "1px solid var(--pmu-primary)",
              borderRadius: "8px",
              background: canCopy ? "var(--pmu-primary)" : "var(--pmu-primary-soft)",
              color: canCopy ? "var(--pmu-on-primary)" : "var(--pmu-text-muted)",
              padding: "10px 16px",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: canCopy ? "pointer" : "not-allowed",
              opacity: canCopy ? 1 : 0.7,
              transition: "opacity 0.18s",
            }}
          >
            {copied ? "✓ Copié !" : "Copier le ticket"}
          </button>
          {selections.length > 0 && (
            <button
              type="button"
              onClick={clearSelections}
              style={{
                border: "1px solid var(--pmu-border)",
                borderRadius: "8px",
                background: "var(--pmu-surface-highlight)",
                color: "var(--pmu-text-soft)",
                padding: "10px 14px",
                fontSize: "0.82rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Vider
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
