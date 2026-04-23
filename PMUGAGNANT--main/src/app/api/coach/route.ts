import OpenAI from "openai";
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import {
  buildCoachContext,
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  buildFallbackCoachAnswer,
  getCoachDateWindow,
  type CoachAccessLevel,
} from "@/lib/coach-context";
import { getTodayDateStr, toIsoDate } from "@/lib/date-utils";
import {
  listCourseRecordsBetween,
  listPredictionsBetween,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import { logger } from "@/lib/server-logger";
import { getRequestSubscriptionState } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 700;
const DEFAULT_MODEL = "gpt-4.1-mini";
const LOCAL_COACH_MODEL = "turfedge-supabase-brain";

type CoachRequestBody = {
  question?: unknown;
};

function getQuestion(body: CoachRequestBody | null) {
  if (typeof body?.question !== "string") {
    return "";
  }

  return body.question.trim().slice(0, MAX_QUESTION_LENGTH);
}

function getAccessLevel(isSubscribed: boolean): CoachAccessLevel {
  return isSubscribed ? "premium" : "preview";
}

function getSuggestedQuestions() {
  return [
    "Tu penses quoi du meilleur cheval du jour ?",
    "Quel value bet est le plus interessant ?",
    "Analyse R1C1 #5 avec les donnees TurfEdge",
  ];
}

function getModelCandidates() {
  const configured = process.env.OPENAI_MODEL?.trim();
  return [...new Set([configured, DEFAULT_MODEL, "gpt-4o-mini"].filter(Boolean))] as string[];
}

function getOpenAiErrorSummary(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 400);
  }

  return String(error).slice(0, 400);
}

async function buildCoachAnswer(
  question: string,
  accessLevel: CoachAccessLevel,
  context: ReturnType<typeof buildCoachContext>
) {
  const fallbackAnswer = buildFallbackCoachAnswer(question, context, accessLevel);
  const useOpenAi = process.env.COACH_AI_PROVIDER?.trim().toLowerCase() === "openai";

  if (!useOpenAi) {
    return {
      answer: fallbackAnswer,
      model: LOCAL_COACH_MODEL,
      provider: "supabase" as const,
      fallback: false,
      needsSetup: false,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      answer: fallbackAnswer,
      model: null,
      provider: "supabase" as const,
      fallback: true,
      needsSetup: true,
    };
  }

  const modelCandidates = getModelCandidates();

  const client = new OpenAI({ apiKey });
  let lastError: unknown = null;

  for (const model of modelCandidates) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildCoachSystemPrompt(accessLevel) },
          { role: "user", content: buildCoachUserPrompt(question, context) },
        ],
        max_tokens: 520,
      });
      const answer = completion.choices[0]?.message?.content?.trim();

      return {
        answer: answer || fallbackAnswer,
        model,
        provider: "openai" as const,
        fallback: false,
        needsSetup: false,
      };
    } catch (error) {
      lastError = error;
      logger.warn("coach.openai_model_failed", {
        model,
        error: getOpenAiErrorSummary(error),
      });
    }
  }

  logger.warn("coach.openai_failed", {
    models: modelCandidates,
    error: getOpenAiErrorSummary(lastError),
  });

  return {
    answer: fallbackAnswer,
    model: LOCAL_COACH_MODEL,
    provider: "supabase" as const,
    fallback: false,
    needsSetup: false,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CoachRequestBody | null;
    const question = getQuestion(body);

    if (!question) {
      return badRequest("Question vide. Pose une question sur une course ou un cheval.");
    }

    const { state } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );
    const accessLevel = getAccessLevel(state.isSubscribed);
    const todayIso = toIsoDate(getTodayDateStr());
    const range = getCoachDateWindow(todayIso);
    const [predictions, courses, outcomes] = await Promise.all([
      listPredictionsBetween(range.startIso, range.endIso),
      listCourseRecordsBetween(range.startIso, range.endIso),
      listRunnerOutcomesBetween(range.startIso, range.endIso),
    ]);
    const context = buildCoachContext(
      question,
      predictions,
      courses,
      outcomes,
      accessLevel
    );
    const answerPayload = await buildCoachAnswer(question, accessLevel, context);

    return NextResponse.json(
      {
        success: true,
        answer: answerPayload.answer,
        accessLevel,
        contextCount: context.length,
        fallback: answerPayload.fallback,
        needsSetup: answerPayload.needsSetup,
        model: answerPayload.model,
        provider: answerPayload.provider,
        suggestedQuestions: getSuggestedQuestions(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    return serverError("Echec du coach IA TurfEdge.", error);
  }
}
