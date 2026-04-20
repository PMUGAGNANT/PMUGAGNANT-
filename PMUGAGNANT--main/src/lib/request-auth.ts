import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createSupabaseRequestClient,
  getSupabaseConfigError,
} from "@/lib/supabase";
import { getBearerToken } from "@/lib/request-utils";
import { serviceUnavailable, serverError, unauthorized } from "@/lib/api-response";

export function getSupabaseRequestClientFromRequest(req: NextRequest) {
  const token = getBearerToken(req.headers.get("authorization"));
  return createSupabaseRequestClient(token);
}

function isMissingSessionError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AuthSessionMissingError" ||
      error.message.toLowerCase().includes("auth session missing"))
  );
}

export async function getOptionalRequestUser(
  req: NextRequest
): Promise<{
  client: SupabaseClient | null;
  user: User | null;
  errorResponse?: ReturnType<typeof serviceUnavailable> | ReturnType<typeof serverError>;
}> {
  const token = getBearerToken(req.headers.get("authorization"));
  const client = getSupabaseRequestClientFromRequest(req);

  if (!client) {
    return {
      client: null,
      user: null,
      errorResponse: serviceUnavailable(getSupabaseConfigError()),
    };
  }

  if (!token) {
    return { client, user: null };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    if (isMissingSessionError(error)) {
      return { client, user: null };
    }

    return {
      client,
      user: null,
      errorResponse: serverError("Echec de l'authentification.", error),
    };
  }

  return { client, user };
}

export async function getAuthenticatedRequestUser(
  req: NextRequest
): Promise<
  | { client: SupabaseClient; user: User }
  | {
      errorResponse:
        | ReturnType<typeof unauthorized>
        | ReturnType<typeof serviceUnavailable>
        | ReturnType<typeof serverError>;
    }
> {
  const auth = await getOptionalRequestUser(req);

  if (auth.errorResponse) {
    return { errorResponse: auth.errorResponse };
  }

  if (!auth.client || !auth.user) {
    return { errorResponse: unauthorized("Connexion requise.") };
  }

  return {
    client: auth.client,
    user: auth.user,
  };
}
