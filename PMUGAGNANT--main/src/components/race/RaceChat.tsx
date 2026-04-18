"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type RaceMessageRow = Database["public"]["Tables"]["race_messages"]["Row"];
type RaceMessageInsert = Database["public"]["Tables"]["race_messages"]["Insert"];
type RaceMessageReactionRow =
  Database["public"]["Tables"]["race_message_reactions"]["Row"];
type ReactionEmoji = RaceMessageReactionRow["emoji"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type UserStreakRow = Database["public"]["Tables"]["user_streaks"]["Row"];

type ReactionSummary = {
  emoji: ReactionEmoji;
  count: number;
  reactedByMe: boolean;
};

type RaceChatMessage = RaceMessageRow & {
  reactions: ReactionSummary[];
};

type PinnedVerdict = {
  verdict: string;
  cheval: string;
  cote: string;
  mise: string;
};

type RaceChatProps = {
  raceId: string;
  raceDate: string;
  initialMessages: RaceChatMessage[];
  pinnedVerdict: PinnedVerdict;
};

type ChatUserState = {
  id: string | null;
  username: string;
  avatarInitials: string;
  isPro: boolean;
  winRate: number;
  winningStreak: number;
};

type BetForStats = {
  created_at: string;
  statut: string;
  gain: number | null;
  mise: number;
};

const REACTIONS: ReactionEmoji[] = ["🔥", "👀", "❌"];
const DEFAULT_USER: ChatUserState = {
  id: null,
  username: "Invité",
  avatarInitials: "IN",
  isPro: false,
  winRate: 0,
  winningStreak: 0,
};

function getTypedSupabase() {
  return getSupabaseBrowserClient() as SupabaseClient<Database>;
}

function clampMessage(value: string) {
  return value.trim().slice(0, 280);
}

function getInitials(label: string) {
  const initials = label
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "PM";
}

function getUserNameFromEmail(email: string | undefined) {
  if (!email) {
    return "Parieur TurfEdge";
  }

  return email.split("@")[0]?.replace(/[._-]+/g, " ") || "Parieur TurfEdge";
}

function hasPremiumAccess(profile: ProfileRow | null | undefined) {
  if (!profile) {
    return false;
  }

  const status = profile.subscription_status ?? "";
  const paid = Boolean(profile.is_subscribed) || status === "active" || status === "trialing";
  if (paid) {
    return true;
  }

  if (!profile.premium_access_expires_at) {
    return false;
  }

  const expiry = new Date(profile.premium_access_expires_at);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
}

function getRelativeTime(value: string, now: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "à l'instant";
  }

  const diffSeconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (diffSeconds < 45) return "à l'instant";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `il y a ${diffDays} j`;
}

function buildReactionSummaries(
  messageIds: string[],
  rows: RaceMessageReactionRow[],
  currentUserId: string | null
) {
  const grouped = new Map<string, ReactionSummary[]>();
  for (const id of messageIds) {
    grouped.set(
      id,
      REACTIONS.map((emoji) => ({ emoji, count: 0, reactedByMe: false }))
    );
  }

  for (const row of rows) {
    const summaries = grouped.get(row.message_id);
    if (!summaries) {
      continue;
    }

    const summary = summaries.find((item) => item.emoji === row.emoji);
    if (!summary) {
      continue;
    }

    summary.count += 1;
    if (currentUserId && row.user_id === currentUserId) {
      summary.reactedByMe = true;
    }
  }

  return grouped;
}

function mergeMessages(
  rows: RaceMessageRow[],
  reactionsByMessage: Map<string, ReactionSummary[]>
): RaceChatMessage[] {
  return rows
    .map((row) => ({
      ...row,
      reactions:
        reactionsByMessage.get(row.id) ??
        REACTIONS.map((emoji) => ({ emoji, count: 0, reactedByMe: false })),
    }))
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
}

function mergeIncomingMessage(messages: RaceChatMessage[], row: RaceMessageRow) {
  if (messages.some((message) => message.id === row.id)) {
    return messages;
  }

  return mergeMessages(
    [...messages, row],
    new Map(
      messages.map((message) => [
        message.id,
        message.reactions.map((reaction) => ({ ...reaction })),
      ])
    )
  );
}

function computeStatsFromBets(rows: BetForStats[]) {
  const settled = rows.filter((row) => row.statut !== "EN_ATTENTE" && row.gain !== null);
  const wins = settled.filter((row) => (row.gain ?? 0) > row.mise).length;
  const winRate = settled.length > 0 ? Math.round((wins / settled.length) * 100) : 0;
  const sorted = [...settled].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  let winningStreak = 0;

  for (const row of sorted) {
    if ((row.gain ?? 0) <= row.mise) {
      break;
    }

    winningStreak += 1;
  }

  return { winRate, winningStreak };
}

function getErrorMessage(value: unknown) {
  if (value instanceof Error) {
    if (value.message === "CHAT_RATE_LIMIT") {
      return "Trop de messages. Pause automatique de 10 minutes.";
    }

    if (value.message === "CHAT_BANNED") {
      return "Chat temporairement bloqué pour spam.";
    }

    return value.message;
  }

  return "Action chat indisponible.";
}

function MessageBadges({ message }: { message: RaceChatMessage }) {
  return (
    <span className="flex flex-wrap gap-1">
      {message.is_pro ? (
        <span className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-2 py-0.5 text-[0.62rem] font-black text-[#D4AF37]">
          PRO
        </span>
      ) : null}
      {message.win_rate > 60 ? (
        <span className="rounded-full border border-[#9B5DE5]/35 bg-[#9B5DE5]/15 px-2 py-0.5 text-[0.62rem] font-black text-[#D8B4FE]">
          EXPERT
        </span>
      ) : null}
      {message.winning_streak >= 3 ? (
        <span className="rounded-full border border-[#FF9F1C]/35 bg-[#FF9F1C]/15 px-2 py-0.5 text-[0.62rem] font-black text-[#FFCC80]">
          🔥 HOT
        </span>
      ) : null}
    </span>
  );
}

export default function RaceChat({
  raceId,
  raceDate,
  initialMessages,
  pinnedVerdict,
}: RaceChatProps) {
  const [messages, setMessages] = useState<RaceChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [userState, setUserState] = useState<ChatUserState>(DEFAULT_USER);
  const [onlineCount, setOnlineCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(Date.now());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const userIdRef = useRef<string | null>(null);

  const canWrite = userState.isPro && Boolean(userState.id);

  const loadReactions = useCallback(
    async (
      supabase: SupabaseClient<Database>,
      messageRows: RaceMessageRow[],
      currentUserId: string | null
    ) => {
      const messageIds = messageRows.map((message) => message.id);
      if (messageIds.length === 0) {
        return new Map<string, ReactionSummary[]>();
      }

      const { data } = await supabase
        .from("race_message_reactions")
        .select("*")
        .in("message_id", messageIds);

      return buildReactionSummaries(
        messageIds,
        (data ?? []) as RaceMessageReactionRow[],
        currentUserId
      );
    },
    []
  );

  const loadMessages = useCallback(
    async (supabase: SupabaseClient<Database>, currentUserId: string | null) => {
      const { data, error: loadError } = await supabase
        .from("race_messages")
        .select("*")
        .eq("race_id", raceId)
        .eq("race_date", raceDate)
        .order("created_at", { ascending: false })
        .limit(50);

      if (loadError) {
        throw new Error(loadError.message);
      }

      const rows = ((data ?? []) as RaceMessageRow[]).reverse();
      const reactionsByMessage = await loadReactions(supabase, rows, currentUserId);
      setMessages(mergeMessages(rows, reactionsByMessage));
    },
    [loadReactions, raceDate, raceId]
  );

  const refreshCurrentReactions = useCallback(
    async (supabase: SupabaseClient<Database>, currentUserId: string | null) => {
      setMessages((current) => {
        void loadReactions(supabase, current, currentUserId).then((reactionMap) => {
          setMessages(mergeMessages(current, reactionMap));
        });

        return current;
      });
    },
    [loadReactions]
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    userIdRef.current = userState.id;
  }, [userState.id]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(""), 4_500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function bootChat() {
      if (!hasSupabaseConfig()) {
        setLoading(false);
        setError("Supabase non configuré: chat en lecture seule.");
        return;
      }

      try {
        const supabase = getTypedSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let nextUserState: ChatUserState = DEFAULT_USER;

        if (session?.user) {
          const userName =
            typeof session.user.user_metadata?.name === "string"
              ? session.user.user_metadata.name
              : getUserNameFromEmail(session.user.email);
          const [{ data: profile }, { data: streak }, betsResponse] = await Promise.all([
            supabase
              .from("profiles")
              .select("id,is_subscribed,subscription_status,premium_access_expires_at,referral_count")
              .eq("id", session.user.id)
              .maybeSingle(),
            supabase
              .from("user_streaks")
              .select("user_id,current_streak,best_streak,updated_at")
              .eq("user_id", session.user.id)
              .maybeSingle(),
            fetch("/api/bets", {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(() => null),
          ]);
          let winRate = 0;
          let winningStreak = (streak as UserStreakRow | null)?.current_streak ?? 0;

          if (betsResponse?.ok) {
            const payload = (await betsResponse.json()) as {
              success?: boolean;
              bets?: BetForStats[];
            };
            const stats = computeStatsFromBets(payload.bets ?? []);
            winRate = stats.winRate;
            winningStreak = Math.max(winningStreak, stats.winningStreak);
          }

          nextUserState = {
            id: session.user.id,
            username: userName,
            avatarInitials: getInitials(userName),
            isPro: hasPremiumAccess(profile as ProfileRow | null | undefined),
            winRate,
            winningStreak,
          };
        }

        if (!cancelled) {
          setUserState(nextUserState);
          userIdRef.current = nextUserState.id;
          await loadMessages(supabase, nextUserState.id);
          setLoading(false);
        }

        const channel = supabase
          .channel(`race-chat-${raceId}-${raceDate}`, {
            config: { presence: { key: nextUserState.id ?? crypto.randomUUID() } },
          })
          .on("presence", { event: "sync" }, () => {
            const presenceState = channel.presenceState();
            const count = Object.values(presenceState).reduce(
              (sum, presences) => sum + presences.length,
              0
            );
            setOnlineCount(Math.max(1, count));
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "race_messages",
              filter: `race_id=eq.${raceId}`,
            },
            (payload) => {
              const row = payload.new as RaceMessageRow;
              if (row.race_date !== raceDate) {
                return;
              }

              setMessages((current) => mergeIncomingMessage(current, row));
              if (row.user_id !== userIdRef.current) {
                setToast(`💬 ${row.username}: ${row.content.slice(0, 64)}`);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "race_message_reactions",
            },
            () => {
              void refreshCurrentReactions(supabase, userIdRef.current);
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              void channel.track({
                online_at: new Date().toISOString(),
                race_id: raceId,
              });
            }
          });

        return () => {
          void supabase.removeChannel(channel);
        };
      } catch (bootError) {
        if (!cancelled) {
          setError(getErrorMessage(bootError));
          setLoading(false);
        }
      }

      return undefined;
    }

    let cleanup: (() => void) | undefined;
    void bootChat().then((nextCleanup) => {
      cleanup = nextCleanup;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loadMessages, raceDate, raceId, refreshCurrentReactions]);

  const remainingChars = 280 - draft.length;

  const pinnedText = useMemo(
    () =>
      `🤖 PMU GAGNANT IA · VERDICT — ${pinnedVerdict.verdict} le ${pinnedVerdict.cheval} — Cote ${pinnedVerdict.cote} — Mise: ${pinnedVerdict.mise}`,
    [pinnedVerdict]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!hasSupabaseConfig()) {
      setError("Chat indisponible: Supabase n'est pas configuré.");
      return;
    }

    if (!canWrite || !userState.id) {
      setError("Le chat écrit est réservé aux membres PRO.");
      return;
    }

    const content = clampMessage(draft);
    if (!content) {
      return;
    }

    setSending(true);
    try {
      const supabase = getTypedSupabase();
      const payload: RaceMessageInsert = {
        race_id: raceId,
        race_date: raceDate,
        user_id: userState.id,
        username: userState.username,
        avatar_initials: userState.avatarInitials,
        is_pro: userState.isPro,
        win_rate: userState.winRate,
        winning_streak: userState.winningStreak,
        content,
      };
      const { error: insertError } = await supabase.from("race_messages").insert(payload);

      if (insertError) {
        throw new Error(insertError.message);
      }

      setDraft("");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(messageId: string, emoji: ReactionEmoji) {
    setError("");

    if (!hasSupabaseConfig()) {
      setError("Réactions indisponibles: Supabase n'est pas configuré.");
      return;
    }

    if (!userState.id) {
      setError("Connecte-toi pour réagir gratuitement.");
      return;
    }

    const message = messages.find((item) => item.id === messageId);
    const alreadyReacted = Boolean(
      message?.reactions.find((reaction) => reaction.emoji === emoji)?.reactedByMe
    );

    try {
      const supabase = getTypedSupabase();
      if (alreadyReacted) {
        const { error: deleteError } = await supabase
          .from("race_message_reactions")
          .delete()
          .match({ message_id: messageId, user_id: userState.id, emoji });

        if (deleteError) {
          throw new Error(deleteError.message);
        }
      } else {
        const { error: insertError } = await supabase
          .from("race_message_reactions")
          .insert({ message_id: messageId, user_id: userState.id, emoji });

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      await refreshCurrentReactions(supabase, userState.id);
    } catch (reactionError) {
      setError(getErrorMessage(reactionError));
    }
  }

  return (
    <section className="grid gap-0 overflow-hidden rounded-lg border border-[#D4AF37]/20 bg-[#101827] shadow-2xl shadow-black/25 [animation:turfFadeUp_0.55s_ease_0.4s_both]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0A0E1A]/70 px-4 py-3 md:px-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D4AF37]">
            💬 Live chat · {onlineCount} connectés
          </p>
          <p className="mt-1 text-sm font-bold text-slate-400">
            Les parieurs suivent cette course en direct.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#00C851]/30 bg-[#00C851]/10 px-3 py-1 text-xs font-black text-[#00C851]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#00C851]" />
          LIVE
        </span>
      </header>

      <div className="h-[320px] overflow-y-auto px-4 py-4 md:h-[420px] md:px-5">
        <article className="mb-4 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4">
          <p className="text-xs font-black uppercase text-[#D4AF37]">Message épinglé IA</p>
          <p className="mt-2 text-sm font-black text-[#F6F2E8]">{pinnedText}</p>
        </article>

        {loading ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-slate-400">
            Connexion au chat live...
          </p>
        ) : messages.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-slate-400">
            Aucun message pour cette course. Les PRO peuvent ouvrir le bal.
          </p>
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#D4AF37]/20 font-[var(--font-display)] text-lg font-black text-[#D4AF37]">
                  {message.avatar_initials}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-black text-[#F6F2E8]">
                      {message.username}
                    </strong>
                    <MessageBadges message={message} />
                    <span className="text-xs font-bold text-slate-500">
                      {getRelativeTime(message.created_at, now)}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm font-bold leading-relaxed text-slate-300">
                    {message.content}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.reactions.map((reaction) => (
                      <button
                        type="button"
                        key={reaction.emoji}
                        onClick={() => void toggleReaction(message.id, reaction.emoji)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-black transition ${
                          reaction.reactedByMe
                            ? "border-[#D4AF37]/45 bg-[#D4AF37]/20 text-[#D4AF37]"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-[#D4AF37]/30 hover:text-[#D4AF37]"
                        }`}
                      >
                        {reaction.emoji} {reaction.count}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 bg-[#0A0E1A]/55 p-4 md:p-5">
        {canWrite ? (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="race-chat-message">
              Message live chat
            </label>
            <textarea
              id="race-chat-message"
              value={draft}
              maxLength={280}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ton avis sur la course, en 280 caractères..."
              className="min-h-20 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-[#F6F2E8] outline-none transition placeholder:text-slate-500 focus:border-[#D4AF37]/45"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={`text-xs font-black ${
                  remainingChars < 30 ? "text-[#FF9F1C]" : "text-slate-500"
                }`}
              >
                {remainingChars} caractères restants
              </span>
              <button
                type="submit"
                disabled={sending || clampMessage(draft).length === 0}
                className="w-full rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-black text-[#0A0E1A] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {sending ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4">
            <p className="font-black text-[#D4AF37]">
              Rejoignez la communauté PRO — 4,99€/mois
            </p>
            <p className="mt-1 text-sm font-bold text-slate-300">
              Lecture gratuite. Passe PRO pour écrire dans le chat live.
            </p>
            <Link
              href="/premium"
              className="mt-3 inline-flex w-full justify-center rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-black text-[#0A0E1A] sm:w-auto"
            >
              Passer PRO
            </Link>
          </div>
        )}

        {error ? (
          <p className="mt-3 rounded-lg border border-[#FF4D5A]/35 bg-[#FF4D5A]/10 px-3 py-2 text-sm font-bold text-[#FCA5A5]">
            {error}
          </p>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-[#D4AF37]/25 bg-[#101827] px-4 py-3 text-sm font-black text-[#F6F2E8] shadow-2xl shadow-black/40 sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-xs">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
