"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getTodayDateStr } from "@/lib/date-utils";

type SearchRunnerType = "jockey" | "driver" | "entraineur" | "cheval";

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

type EntryOption = {
  groupType: SearchRunnerType;
  groupName: string;
  entry: SearchRunnerEntry;
};

const TYPE_LABELS: Record<SearchRunnerType, string> = {
  jockey: "Jockey",
  driver: "Driver",
  entraineur: "Entraîneur",
  cheval: "Cheval",
};

const TYPE_ICONS: Record<SearchRunnerType, string> = {
  jockey: "🏇",
  driver: "🏇",
  entraineur: "🎯",
  cheval: "🐎",
};

function formatOdds(value: number | null) {
  if (value == null) {
    return "n.c.";
  }

  return value.toLocaleString("fr-FR", {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  });
}

export function SidebarSearch() {
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
        setActiveIndex(-1);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    abortRef.current?.abort();

    const requestKey =
      debouncedQuery.length >= 2 ? `${getTodayDateStr()}:${debouncedQuery}` : "";

    if (!requestKey) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    void fetch(
      `/api/search-runners?q=${encodeURIComponent(debouncedQuery)}&date=${getTodayDateStr()}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
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
          fetchError instanceof Error
            ? fetchError.message
            : "Impossible de lancer la recherche.",
        );
        setResolvedRequestKey(requestKey);
      })

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const loading =
    debouncedQuery.length >= 2 &&
    resolvedRequestKey !== `${getTodayDateStr()}:${debouncedQuery}`;

  const options = useMemo<EntryOption[]>(
    () =>
      results.flatMap((group) =>
        group.entries.map((entry) => ({
          groupType: group.type,
          groupName: group.name,
          entry,
        })),
      ),
    [results],
  );

  function goToEntry(entry: SearchRunnerEntry) {
    setOpen(false);
    setActiveIndex(-1);
    router.push(`/course/${entry.reunion}/${entry.course}?date=${getTodayDateStr()}`);
  }

  function clearSearch() {
    abortRef.current?.abort();
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setError(null);
    setOpen(false);
    setActiveIndex(-1);
    setResolvedRequestKey("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        goToEntry(option.entry);
      }
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative mb-3">
      <label htmlFor={inputId} className="sr-only">
        Rechercher un jockey, un entraîneur ou un cheval
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--pmu-text-muted)]">
          🔍
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="Jockey, entraîneur"
          className="h-12 w-full rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] pl-10 pr-10 text-[13px] text-[var(--pmu-text)] outline-none transition placeholder:text-[var(--pmu-text-muted)] focus:border-[var(--pmu-border-strong)]"
          aria-label="Recherche jockey, entraîneur ou cheval"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setOpen(true);
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            setError(null);
            if (nextValue.trim().length >= 2) {
              setOpen(true);
            } else {
              setResults([]);
              setResolvedRequestKey("");
            }
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />

        {query ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-xs text-[var(--pmu-text-muted)] transition hover:bg-[var(--pmu-surface)] hover:text-[var(--pmu-text)]"
            onClick={clearSearch}
          >
            ×
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="app-card absolute left-0 top-[calc(100%+0.6rem)] z-[1000] max-h-[420px] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto p-3 shadow-[0_18px_40px_rgba(0,0,0,0.42)]"
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3"
                >
                  <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text)_12%,transparent)]" />
                  <div className="mt-2 h-3 w-3/4 rounded-full bg-[color-mix(in_srgb,var(--pmu-text)_8%,transparent)]" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && error ? (
            <p className="px-1 py-2 text-sm text-[var(--pmu-orange)]">{error}</p>
          ) : null}

          {!loading && !error && results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-[var(--pmu-text-soft)]">Aucun résultat</p>
          ) : null}

          {!loading && !error && results.length > 0 ? (
            <div className="space-y-3">
              {results.map((group) => (
                <div
                  key={`${group.type}-${group.name}`}
                  className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3"
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--pmu-text)]">
                    <span>{TYPE_ICONS[group.type]}</span>
                    <span className="truncate">{group.name}</span>
                    <span className="text-xs font-medium text-[var(--pmu-text-muted)]">
                      • {TYPE_LABELS[group.type]}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.entries.map((entry, entryIndex) => {
                      const optionIndex = options.findIndex(
                        (option) =>
                          option.groupType === group.type &&
                          option.groupName === group.name &&
                          option.entry.reunion === entry.reunion &&
                          option.entry.course === entry.course &&
                          option.entry.numPmu === entry.numPmu,
                      );
                      const active = optionIndex === activeIndex;
                      const prefix = entryIndex === group.entries.length - 1 ? "└─" : "├─";

                      return (
                        <button
                          key={`${group.type}-${group.name}-${entry.reunion}-${entry.course}-${entry.numPmu}`}
                          id={optionIndex >= 0 ? `${listboxId}-option-${optionIndex}` : undefined}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`block w-full rounded-lg px-2 py-2 text-left transition ${
                            active
                              ? "bg-[color-mix(in_srgb,var(--pmu-primary)_8%,var(--pmu-surface))]"
                              : "hover:bg-[var(--pmu-surface)]"
                          }`}
                          onMouseEnter={() => setActiveIndex(optionIndex)}
                          onClick={() => goToEntry(entry)}
                        >
                          <div className="text-[12px] font-semibold text-[var(--pmu-text)]">
                            <span className="mr-1 text-[var(--pmu-text-muted)]">{prefix}</span>
                            R{entry.reunion}C{entry.course} {entry.hippodrome} {entry.heureDepart} → N°
                            {entry.numPmu} {entry.cheval}
                          </div>
                          <div className="mt-1 pl-4 text-[11px] text-[var(--pmu-text-soft)]">
                            {entry.nomCourse} • {entry.discipline} • Cote {formatOdds(entry.cote)}
                          </div>
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
  );
}
