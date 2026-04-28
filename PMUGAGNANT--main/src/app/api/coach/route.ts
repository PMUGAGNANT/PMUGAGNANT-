import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import {
  generateCoachAiAnswer,
  type CoachHistoryMessage,
} from "@/lib/coach-ai-provider";
import {
  buildCoachContext,
  buildCoachInsight,
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  buildDirectCoachAnswer,
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
const LOCAL_COACH_MODEL = "turfedge-supabase-brain";
const MAX_HISTORY_MESSAGES = 6;

type CoachRequestBody = {
  question?: unknown;
  messages?: unknown;
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
    "Pourquoi cette selection est forte ?",
    "Compare la course principale",
    "Je suis Premium, qu'est-ce que je debloque ?",
  ];
}

function getConversationHistory(body: CoachRequestBody | null): CoachHistoryMessage[] {
  if (!Array.isArray(body?.messages)) {
    return [];
  }

  return body.messages
    .filter((message): message is { role: unknown; content: unknown } => Boolean(message))
    .map(
      (message): CoachHistoryMessage => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content:
        typeof message.content === "string"
          ? message.content.trim().slice(0, MAX_QUESTION_LENGTH)
          : "",
      })
    )
    .filter((message) => message.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

async function buildCoachAnswer(
  question: string,
  accessLevel: CoachAccessLevel,
  context: ReturnType<typeof buildCoachContext>,
  history: CoachHistoryMessage[]
) {
  const fallbackAnswer = buildFallbackCoachAnswer(question, context, accessLevel);
  return generateCoachAiAnswer({
    systemPrompt: buildCoachSystemPrompt(accessLevel),
    userPrompt: buildCoachUserPrompt(question, context),
    history,
    fallbackAnswer,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CoachRequestBody | null;
    const question = getQuestion(body);
    const history = getConversationHistory(body);

    if (!question) {
      return badRequest("Question vide. Pose une question sur une course ou un cheval.");
    }

    const { state } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );
    const accessLevel = getAccessLevel(state.isSubscribed);
    const directAnswer = buildDirectCoachAnswer(question, accessLevel);

    if (directAnswer) {
      return NextResponse.json(
        {
          success: true,
          answer: directAnswer,
          insight: null,
          accessLevel,
          contextCount: 0,
          fallback: false,
          needsSetup: false,
          model: LOCAL_COACH_MODEL,
          provider: "supabase",
          suggestedQuestions: getSuggestedQuestions(),
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

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
    const insight = buildCoachInsight(question, context, accessLevel);
    const answerPayload = await buildCoachAnswer(question, accessLevel, context, history);

    logger.info("coach.response_ready", {
      accessLevel,
      contextCount: context.length,
      historyCount: history.length,
      provider: answerPayload.provider,
      model: answerPayload.model,
      fallback: answerPayload.fallback,
      needsSetup: answerPayload.needsSetup,
    });

    return NextResponse.json(
      {
        success: true,
        answer: answerPayload.answer,
        insight,
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
