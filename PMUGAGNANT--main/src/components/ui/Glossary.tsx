"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { GLOSSARY, type GlossaryEntry } from "@/lib/beginner-labels";

export function GlossaryPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const disabled = pathname === "/login" || pathname.startsWith("/admin");

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return GLOSSARY;
    const q = search.toLowerCase().trim();
    return GLOSSARY.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q)
    );
  }, [search]);

  if (disabled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-20 right-4 z-[900] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--pmu-border-strong)] text-lg shadow-lg transition hover:scale-105 md:bottom-6"
        style={{
          background:
            "linear-gradient(168deg, var(--pmu-surface-highlight) 0%, var(--pmu-surface) 100%)",
          boxShadow: "var(--pmu-shadow-sm)",
        }}
        aria-label="Ouvrir le glossaire"
        title="Glossaire"
      >
        📖
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[950] flex items-end justify-center md:items-center md:p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-[var(--pmu-border-strong)] md:rounded-3xl"
            style={{
              background:
                "linear-gradient(168deg, var(--pmu-surface-highlight) 0%, var(--pmu-surface) 100%)",
              maxHeight: "85vh",
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--pmu-border)] px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-[var(--pmu-text)]">
                  📖 Glossaire du turf
                </h2>
                <p className="mt-0.5 text-xs text-[var(--pmu-text-muted)]">
                  {GLOSSARY.length} termes expliqués simplement
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--pmu-border)] text-[var(--pmu-text-muted)] transition hover:text-[var(--pmu-text)]"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-3">
              <input
                type="text"
                placeholder="Rechercher un terme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-input text-sm"
              />
            </div>

            <div
              className="space-y-1 overflow-y-auto px-5 pb-6"
              style={{ maxHeight: "calc(85vh - 160px)" }}
            >
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--pmu-text-muted)]">
                  Aucun terme trouvé pour « {search} »
                </p>
              )}
              {filtered.map((entry) => (
                <GlossaryItem key={entry.term} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GlossaryItem({ entry }: { entry: GlossaryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      className="w-full rounded-xl px-4 py-3 text-left transition hover:bg-[var(--pmu-surface-highlight)]"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-[var(--pmu-text)]">{entry.term}</span>
        <span className="text-xs text-[var(--pmu-text-muted)]">
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-sm leading-relaxed text-[var(--pmu-text-soft)]">
            {entry.definition}
          </p>
          {entry.example && (
            <p
              className="rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{
                background: "var(--pmu-primary-fade)",
                color: "var(--pmu-primary)",
              }}
            >
              💡 {entry.example}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

export function TermTooltip({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  const entry = GLOSSARY.find(
    (e) => e.term.toLowerCase() === term.toLowerCase()
  );

  if (!entry) {
    return <>{children}</>;
  }

  return (
    <span className="group relative inline-block cursor-help">
      <span
        className="border-b border-dashed border-[var(--pmu-text-muted)]"
        style={{ borderBottomWidth: "1px" }}
      >
        {children}
      </span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-[var(--pmu-border-strong)] p-3 text-xs leading-relaxed opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
        style={{
          background: "var(--pmu-surface-2)",
          color: "var(--pmu-text-soft)",
        }}
      >
        <span className="mb-1 block font-black text-[var(--pmu-text)]">
          {entry.term}
        </span>
        {entry.definition}
      </span>
    </span>
  );
}
