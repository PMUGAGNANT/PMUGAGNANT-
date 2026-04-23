"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type CoachRole = "assistant" | "user";

type CoachMessage = {
  id: string;
  role: CoachRole;
  content: string;
  meta?: string;
};

type CoachApiResponse = {
  success?: boolean;
  answer?: string;
  error?: string;
  accessLevel?: "premium" | "preview";
  contextCount?: number;
  fallback?: boolean;
  needsSetup?: boolean;
  model?: string | null;
  suggestedQuestions?: string[];
};

const INITIAL_MESSAGE: CoachMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Je suis le Coach IA TurfEdge. Demande-moi un avis sur un cheval, une course, un value bet ou une selection du jour.",
};

const DEFAULT_SUGGESTIONS = [
  "Tu penses quoi du meilleur cheval du jour ?",
  "Quel value bet est le plus interessant ?",
  "Analyse R1C1 #5 avec les donnees TurfEdge",
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
    if (loading) return "Analyse en cours";
    if (lastAccessLevel === "premium") return "Mode Premium";
    if (lastAccessLevel === "preview") return "Apercu gratuit";
    return "Connecte aux donnees TurfEdge";
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
        <span className="turf-coach-trigger__text">Coach</span>
      </button>
    );
  }

  return (
    <aside className="turf-coach-panel" aria-label="Coach IA TurfEdge">
      <header className="turf-coach-panel__header">
        <div>
          <p className="turf-coach-panel__eyebrow">Coach IA TurfEdge</p>
          <h2 className="turf-coach-panel__title">Pose ta question</h2>
          <p className="turf-coach-panel__status">{statusLabel}</p>
        </div>
        <button
          type="button"
          className="turf-coach-panel__close"
          onClick={() => setOpen(false)}
          aria-label="Fermer le Coach IA"
        >
          Fermer
        </button>
      </header>

      <div className="turf-coach-panel__messages">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`turf-coach-message turf-coach-message--${message.role}`}
          >
            <p>{message.content}</p>
            {message.meta ? <span>{message.meta}</span> : null}
          </article>
        ))}
        {loading ? (
          <article className="turf-coach-message turf-coach-message--assistant">
            <p>Je lis les signaux TurfEdge et les resultats disponibles...</p>
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
          placeholder="Ex: Tu penses quoi de R9C6 #5 ?"
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
