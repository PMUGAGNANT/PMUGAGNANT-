"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type CoachRole = "assistant" | "user";

type CoachInsight = {
  intent:
    | "horse"
    | "best"
    | "value"
    | "result"
    | "compare"
    | "avoid"
    | "why"
    | "help"
    | "premium"
    | "greeting"
    | "general";
  title: string;
  subtitle: string;
  verdict: string;
  tone: "green" | "orange" | "red" | "neutral";
  action: string;
  metrics: Array<{
    label: string;
    value: string;
    tone?: "green" | "orange" | "red" | "neutral";
  }>;
  facts: string[];
  rivals: Array<{
    label: string;
    score: string;
  }>;
};

type CoachMessage = {
  id: string;
  role: CoachRole;
  content: string;
  meta?: string;
  insight?: CoachInsight | null;
};

type CoachApiResponse = {
  success?: boolean;
  answer?: string;
  insight?: CoachInsight | null;
  error?: string;
  accessLevel?: "premium" | "preview";
  contextCount?: number;
  fallback?: boolean;
  needsSetup?: boolean;
  model?: string | null;
  provider?: "supabase" | "openai";
  suggestedQuestions?: string[];
};

const INITIAL_MESSAGE: CoachMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Ecris librement. Je peux analyser un cheval, comparer une course, expliquer un choix, lire une arrivee ou t'aider sur Premium.",
};

const DEFAULT_SUGGESTIONS = [
  "Pourquoi cette selection est forte ?",
  "Compare la course principale",
  "Je suis Premium, qu'est-ce que je debloque ?",
];

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getAccessToken() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

function CoachInsightCard({ insight }: { insight: CoachInsight }) {
  return (
    <div className={`turf-coach-insight turf-coach-insight--${insight.tone}`}>
      <div className="turf-coach-insight__head">
        <div>
          <span>{insight.intent}</span>
          <strong>{insight.title}</strong>
          <small>{insight.subtitle}</small>
        </div>
        <em>{insight.verdict}</em>
      </div>

      <div className="turf-coach-insight__metrics">
        {insight.metrics.map((metric) => (
          <div
            key={`${metric.label}-${metric.value}`}
            data-tone={metric.tone ?? "neutral"}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <div className="turf-coach-insight__facts">
        {insight.facts.slice(0, 3).map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </div>

      {insight.rivals.length > 0 ? (
        <div className="turf-coach-insight__rivals">
          <span>Rivaux directs</span>
          {insight.rivals.map((rival) => (
            <strong key={rival.label}>
              {rival.label} <small>{rival.score}</small>
            </strong>
          ))}
        </div>
      ) : null}

      <p>{insight.action}</p>
    </div>
  );
}

export function TurfEdgeCoach() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>([INITIAL_MESSAGE]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const [lastAccessLevel, setLastAccessLevel] = useState<"premium" | "preview" | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const disabled = pathname === "/login" || pathname.startsWith("/admin");
  const canSubmit = draft.trim().length > 0 && !loading;

  const statusLabel = useMemo(() => {
    if (loading) return "Lecture des signaux";
    if (lastAccessLevel === "premium") return "Premium: details complets";
    if (lastAccessLevel === "preview") return "Apercu: mise masquee";
    return "Supabase Brain actif";
  }, [lastAccessLevel, loading]);

  const askCoach = useCallback(async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    const userMessage: CoachMessage = {
      id: createMessageId(),
      role: "user",
      content: cleanQuestion,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setLoading(true);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const payload = (await response.json()) as CoachApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Coach IA indisponible.");
      }

      setLastAccessLevel(payload.accessLevel ?? null);
      if (payload.suggestedQuestions?.length) {
        setSuggestions(payload.suggestedQuestions);
      }

      const setupMeta = payload.needsSetup
        ? "Configuration OpenAI a verifier: reponse de secours basee sur les donnees."
        : payload.fallback
          ? "Reponse de secours: l'IA n'a pas repondu correctement."
          : payload.provider === "supabase"
            ? "Moteur TurfEdge Supabase: donnees reelles, zero blabla invente."
            : payload.model
              ? `Modele: ${payload.model}`
              : undefined;

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: payload.answer ?? "Donnees insuffisantes pour repondre.",
          meta: setupMeta,
          insight: payload.insight ?? null,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Coach IA indisponible pour le moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askCoach(draft);
  }

  function openCoach() {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }

  if (disabled) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="turf-coach-trigger"
        onClick={openCoach}
        aria-label="Ouvrir le Coach IA TurfEdge"
      >
        <span className="turf-coach-trigger__mark">IA</span>
        <span className="turf-coach-trigger__text">Coach TurfEdge</span>
      </button>
    );
  }

  return (
    <aside className="turf-coach-panel" aria-label="Coach IA TurfEdge">
      <header className="turf-coach-panel__header">
        <div className="turf-coach-panel__brand">
          <Image src="/logo-turfedge.png" alt="" width={64} height={64} />
          <div>
            <p className="turf-coach-panel__eyebrow">Coach IA TurfEdge</p>
            <h2 className="turf-coach-panel__title">Supabase Brain</h2>
            <p className="turf-coach-panel__status">{statusLabel}</p>
          </div>
        </div>
        <div className="turf-coach-panel__actions" aria-label="Actions du Coach IA">
          <button
            type="button"
            className="turf-coach-panel__icon"
            onClick={() => setOpen(false)}
            aria-label="Retour a la page"
            title="Retour"
          >
            ←
          </button>
          <button
            type="button"
            className="turf-coach-panel__icon turf-coach-panel__icon--close"
            onClick={() => setOpen(false)}
            aria-label="Fermer le Coach IA"
            title="Fermer"
          >
            ×
          </button>
        </div>
      </header>

      <div className="turf-coach-panel__modes" aria-label="Capacites du Coach IA">
        <span>Analyse cheval</span>
        <span>Value bet</span>
        <span>Arrivee</span>
      </div>

      <div className="turf-coach-panel__messages">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`turf-coach-message turf-coach-message--${message.role}`}
          >
            {message.insight ? <CoachInsightCard insight={message.insight} /> : null}
            <p>{message.content}</p>
            {message.meta ? <span>{message.meta}</span> : null}
          </article>
        ))}
        {loading ? (
          <article className="turf-coach-message turf-coach-message--assistant turf-coach-message--loading">
            <div className="turf-coach-loading-orbit" aria-hidden="true" />
            <p>Je croise scores, cotes, value et arrivees Supabase...</p>
          </article>
        ) : null}
      </div>

      <div className="turf-coach-panel__suggestions">
        {suggestions.slice(0, 3).map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => void askCoach(suggestion)}
            disabled={loading}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form className="turf-coach-panel__form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="turf-coach-question">
          Question au Coach IA
        </label>
        <textarea
          ref={inputRef}
          id="turf-coach-question"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex: Pourquoi R9C6 #5 ? Compare R1C4. Je suis Premium pourquoi c'est flou ?"
          maxLength={700}
          rows={3}
        />
        <button type="submit" disabled={!canSubmit}>
          {loading ? "Analyse..." : "Demander"}
        </button>
      </form>

      <p className="turf-coach-panel__legal">
        Jeu responsable. Les reponses sont une aide a la decision, jamais une garantie.
      </p>
    </aside>
  );
}
