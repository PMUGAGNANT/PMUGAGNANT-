import OpenAI from "openai";
import { logger } from "@/lib/server-logger";

export type CoachHistoryMessage = {
  role: "assistant" | "user";
  content: string;
};

export type CoachAiResult = {
  answer: string;
  model: string | null;
  provider: "supabase" | "openai-compatible";
  fallback: boolean;
  needsSetup: boolean;
};

type GenerateCoachAnswerOptions = {
  systemPrompt: string;
  userPrompt: string;
  history: CoachHistoryMessage[];
  fallbackAnswer: string;
};

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 18_000;
const LOCAL_COACH_MODEL = "turfedge-supabase-brain";

function getOpenAiErrorSummary(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 400);
  }

  return String(error).slice(0, 400);
}

function getProviderMode() {
  return process.env.COACH_AI_PROVIDER?.trim().toLowerCase() ?? "supabase";
}

function getApiKey() {
  return process.env.COACH_AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
}

function getModelCandidates() {
  const configured =
    process.env.COACH_AI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  return [...new Set([configured, DEFAULT_MODEL, "gpt-4o-mini"].filter(Boolean))];
}

function getBaseUrl() {
  const value = process.env.COACH_AI_BASE_URL?.trim();
  return value ? value : undefined;
}

function getTimeoutMs() {
  const raw = process.env.COACH_AI_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : DEFAULT_TIMEOUT_MS;
  return Number.isFinite(parsed) && parsed >= 5_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

export async function generateCoachAiAnswer({
  systemPrompt,
  userPrompt,
  history,
  fallbackAnswer,
}: GenerateCoachAnswerOptions): Promise<CoachAiResult> {
  const providerMode = getProviderMode();

  if (providerMode === "supabase") {
    return {
      answer: fallbackAnswer,
      model: LOCAL_COACH_MODEL,
      provider: "supabase",
      fallback: false,
      needsSetup: false,
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("coach.provider_missing_key", {
      providerMode,
    });

    return {
      answer: fallbackAnswer,
      model: null,
      provider: "supabase",
      fallback: true,
      needsSetup: true,
    };
  }

  const modelCandidates = getModelCandidates();
  const timeout = getTimeoutMs();
  const client = new OpenAI({
    apiKey,
    baseURL: getBaseUrl(),
    timeout,
  });

  let lastError: unknown = null;

  for (const model of modelCandidates) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: "user", content: userPrompt },
        ],
        max_tokens: 520,
      });

      const answer = completion.choices[0]?.message?.content?.trim();

      logger.info("coach.provider_success", {
        providerMode,
        provider: "openai-compatible",
        model,
        usedHistoryCount: history.length,
      });

      return {
        answer: answer || fallbackAnswer,
        model,
        provider: "openai-compatible",
        fallback: false,
        needsSetup: false,
      };
    } catch (error) {
      lastError = error;
      logger.warn("coach.provider_model_failed", {
        providerMode,
        model,
        error: getOpenAiErrorSummary(error),
      });
    }
  }

  logger.warn("coach.provider_failed", {
    providerMode,
    models: modelCandidates,
    error: getOpenAiErrorSummary(lastError),
  });

  return {
    answer: fallbackAnswer,
    model: LOCAL_COACH_MODEL,
    provider: "supabase",
    fallback: true,
    needsSetup: false,
  };
}
