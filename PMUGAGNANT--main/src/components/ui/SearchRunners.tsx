"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchRunnerType = "numero" | "jockey" | "driver" | "entraineur" | "cheval" | "hippodrome";

type SearchRunnerEntry = {
  reunion: number;
  course: number;
  hippodrome: string;
  nomCourse: string;
  heureDepart: string;
  discipline: string;
  cheval: string;
  numPmu: number;
  cote: number | null;
  nombrePartants: number;
};

type SearchRunnerGroup = {
  type: SearchRunnerType;
  name: string;
  entries: SearchRunnerEntry[];
  totalEntries: number;
};

type SearchRunnerResponse = {
  success: boolean;
  query: string;
  date: string;
  results: SearchRunnerGroup[];
  totalResults: number;
  error?: string;
};

type SearchRunnersProps = {
  dateStr: string;
};

type KeyboardOption =
  | { kind: "entry"; group: SearchRunnerGroup; entry: SearchRunnerEntry }
  | { kind: "suggestion"; label: string };

const POPULAR_SEARCHES = ["Bazire", "Abrivard", "Nivard", "Lemaire", "Soumillon"];

const TYPE_LABELS: Record<SearchRunnerType, string> = {
  numero: "Numéro PMU",
  jockey: "Jockey",
  driver: "Driver",
  entraineur: "Entraîneur",
  cheval: "Cheval",
  hippodrome: "Hippodrome",
};

const TYPE_EMOJIS: Record<SearchRunnerType, string> = {
  numero: "No",
  jockey: "🏇",
  driver: "🏇",
  entraineur: "🎯",
  cheval: "🐎",
  hippodrome: "🏟",
};

function getOddsTone(cote: number | null) {
  if (cote === null) {
    return "text-[var(--pmu-text-muted)]";
  }

  if (cote < 5) {
    return "text-[var(--pmu-primary)]";
  }

  if (cote <= 10) {
    return "text-[var(--pmu-gold)]";
  }

  return "text-[var(--pmu-text-muted)]";
}

function normalizeResultsMessage(query: string) {
  return `Aucun résultat pour « ${query} » dans les courses du jour`;
}

export function SearchRunners({ dateStr }: SearchRunnersProps) {
  const router = useRouter();
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchRunnerGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFocused(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    abortRef.current?.abort();

    const isNumericQuery = /^\d+$/.test(debouncedQuery);
    const requestKey =
      debouncedQuery.length >= 2 || isNumericQuery ? `${dateStr}:${debouncedQuery}` : "";

    if (!requestKey) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    void fetch(`/api/search-runners?q=${encodeURIComponent(debouncedQuery)}&date=${dateStr}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as SearchRunnerResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Recherche indisponible.");
        }

        setResults(payload.results ?? []);
        setError(null);
        setActiveIndex(-1);
        setResolvedRequestKey(requestKey);
      })
      .catch((fetchError) => {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        setResults([]);
        setError(
          fetchError instanceof Error ? fetchError.message : "Impossible de lancer la recherche."
        );
        setResolvedRequestKey(requestKey);
      })

    return () => {
      controller.abort();
    };
  }, [dateStr, debouncedQuery]);

  const loading =
    (debouncedQuery.length >= 2 || /^\d+$/.test(debouncedQuery)) &&
    resolvedRequestKey !== `${dateStr}:${debouncedQuery}`;

  const keyboardOptions = useMemo<KeyboardOption[]>(() => {
    const trimmed = query.trim();
    if (trimmed.length >= 2 || /^\d+$/.test(trimmed)) {
      return results.flatMap((group) =>
        group.entries.map((entry) => ({
          kind: "entry" as const,
          group,
          entry,
        }))
      );
    }

    return POPULAR_SEARCHES.map((label) => ({
      kind: "suggestion" as const,
      label,
    }));
  }, [query, results]);

  const showSuggestions = focused && query.trim().length === 0;
  const isNumericQuery = /^\d+$/.test(query.trim());
  const showResults = open && focused && (query.trim().length >= 2 || isNumericQuery || showSuggestions || loading || !!error);

  function goToEntry(entry: SearchRunnerEntry) {
    setOpen(false);
    setFocused(false);
    setActiveIndex(-1);
    router.push(`/course/${entry.reunion}/${entry.course}?date=${dateStr}`);
  }

  function applySuggestion(label: string) {
    setQuery(label);
    setError(null);
    setOpen(true);
    setFocused(true);
    setActiveIndex(-1);
    setResolvedRequestKey("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function clearSearch() {
    abortRef.current?.abort();
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setError(null);
    setOpen(true);
    setFocused(true);
    setActiveIndex(-1);
    setResolvedRequestKey("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults || keyboardOptions.length === 0) {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % keyboardOptions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? keyboardOptions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const option = keyboardOptions[activeIndex];
      if (!option) {
        return;
      }

      if (option.kind === "suggestion") {
        applySuggestion(option.label);
        return;
      }

      goToEntry(option.entry);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <section id="search-runners" className="app-card p-4 md:p-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4" ref={rootRef}>
        <div className="space-y-2">
          <p className="app-kicker">Recherche rapide</p>
          <div>
            <h2 className="app-section-title">Qui court aujourd’hui ?</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Trouve un jockey, un driver, un entraîneur, un cheval ou un hippodrome et ouvre directement la bonne course du jour.
            </p>
          </div>
        </div>

        <div className="relative">
          <label htmlFor={inputId} className="sr-only">
            Rechercher un jockey, entraîneur ou cheval
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--pmu-text-muted)]">
              🔍
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder="No, cheval, jockey, entraîneur, hippodrome..."
              className="app-input pl-11 pr-12"
              aria-label="Rechercher un jockey, entraîneur ou cheval"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showResults}
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
              }
              onFocus={() => {
                setFocused(true);
                setOpen(true);
              }}
              onChange={(event) => {
                const nextValue = event.target.value;
                setQuery(nextValue);
                setError(null);
                setOpen(true);
                setActiveIndex(-1);
                if (nextValue.trim().length < 2) {
                  setResults([]);
                  setResolvedRequestKey("");
                }
              }}
              onKeyDown={handleKeyDown}
            />

            {query ? (
              <button
                type="button"
                aria-label="Vider la recherche"
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface)] text-sm text-[var(--pmu-text-muted)] transition hover:border-[var(--pmu-border-strong)] hover:text-[var(--pmu-text)]"
                onClick={clearSearch}
              >
                ✕
              </button>
            ) : null}
          </div>

          {showResults ? (
            <div
              id={listboxId}
              role="listbox"
              className="app-card absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 max-h-[28rem] overflow-y-auto p-3 shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
            >
              {showSuggestions ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
                    Recherches populaires
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_SEARCHES.map((label, index) => {
                      const active = activeIndex === index;
                      return (
                        <button
                          key={label}
                          id={`${listboxId}-option-${index}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`app-pill ${active ? "app-pill--active" : ""}`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => applySuggestion(label)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {loading ? (
                <div className="grid gap-2">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-4"
                    >
                      <div className="h-3 w-32 rounded-full bg-[color-mix(in_srgb,var(--pmu-text)_12%,transparent)]" />
                      <div className="mt-3 h-4 w-2/3 rounded-full bg-[color-mix(in_srgb,var(--pmu-text)_10%,transparent)]" />
                      <div className="mt-2 h-3 w-1/2 rounded-full bg-[color-mix(in_srgb,var(--pmu-text)_8%,transparent)]" />
                    </div>
                  ))}
                </div>
              ) : null}

              {!loading && error ? (
                <p className="px-1 py-2 text-sm text-[var(--pmu-orange)]">{error}</p>
              ) : null}

              {!loading && !error && (query.trim().length >= 2 || /^\d+$/.test(query.trim())) && results.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[var(--pmu-text-soft)]">
                  {normalizeResultsMessage(query.trim())}
                </p>
              ) : null}

              {!loading && !error && (query.trim().length >= 2 || /^\d+$/.test(query.trim())) && results.length > 0 ? (
                <div className="grid gap-3">
                  {results.map((group) => (
                    <div
                      key={`${group.type}-${group.name}`}
                      className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-4 py-3"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black tracking-tight text-[var(--pmu-text)]">
                            {TYPE_EMOJIS[group.type]} {group.name.toUpperCase()}
                          </p>
                          <p className="mt-1 text-xs text-[var(--pmu-text-soft)]">
                            {TYPE_LABELS[group.type]} — {group.totalEntries} course{group.totalEntries > 1 ? "s" : ""} aujourd’hui
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {group.entries.map((entry) => {
                          const optionIndex = keyboardOptions.findIndex(
                            (option) =>
                              option.kind === "entry" &&
                              option.group.type === group.type &&
                              option.group.name === group.name &&
                              option.entry.reunion === entry.reunion &&
                              option.entry.course === entry.course &&
                              option.entry.numPmu === entry.numPmu
                          );
                          const active = optionIndex === activeIndex;

                          return (
                            <button
                              key={`${group.type}-${group.name}-${entry.reunion}-${entry.course}-${entry.numPmu}`}
                              id={optionIndex >= 0 ? `${listboxId}-option-${optionIndex}` : undefined}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`rounded-lg border px-3 py-3 text-left transition ${
                                active
                                  ? "border-[var(--pmu-primary)] bg-[color-mix(in_srgb,var(--pmu-primary)_8%,var(--pmu-surface))]"
                                  : "border-[var(--pmu-border)] bg-[var(--pmu-surface)] hover:border-[var(--pmu-border-strong)]"
                              }`}
                              onMouseEnter={() => setActiveIndex(optionIndex)}
                              onClick={() => goToEntry(entry)}
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[var(--pmu-text)]">
                                <span>
                                  R{entry.reunion}C{entry.course} {entry.hippodrome}
                                </span>
                                <span className="text-[var(--pmu-text-soft)]">•</span>
                                <span>{entry.heureDepart}</span>
                                <span className="text-[var(--pmu-text-soft)]">•</span>
                                <span className="text-[var(--pmu-text-soft)]">{entry.nomCourse}</span>
                              </div>
                              {group.type !== "hippodrome" ? (
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                  <span className="font-semibold text-[var(--pmu-text)]">
                                    → N°{entry.numPmu} {entry.cheval}
                                  </span>
                                  <span className={`${getOddsTone(entry.cote)} text-xs font-bold`}>
                                    {entry.cote !== null ? `Cote ${entry.cote}` : "Cote n.c."}
                                  </span>
                                  <span className="text-xs text-[var(--pmu-text-soft)]">
                                    {entry.discipline} • {entry.nombrePartants} partants
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-[var(--pmu-text-soft)]">
                                  {entry.discipline} • {entry.nombrePartants} partants
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
