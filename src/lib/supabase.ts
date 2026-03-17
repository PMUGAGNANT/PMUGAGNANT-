import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_SETUP_ERROR =
  "Supabase est connecte, mais la base PMU AI n'est pas initialisee. Ouvrez Supabase > SQL Editor puis executez le fichier supabase-setup.sql.";

let browserClient: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseConfigError() {
  return "Supabase n'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.";
}

type SupabaseAppError = {
  code?: string | null;
  message?: string;
  details?: string | null;
};

export function getSupabaseSetupError() {
  return SUPABASE_SETUP_ERROR;
}

export function isSupabaseSetupIssue(error?: SupabaseAppError | null) {
  if (!error) return false;

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const code = error.code ?? "";

  return (
    code === "42P01" ||
    code === "23503" ||
    code === "PGRST116" ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("violates foreign key constraint") ||
    message.includes("bets_user_id_fkey") ||
    message.includes("profiles") ||
    message.includes("bets")
  );
}

export function normalizeSupabaseAppError(error?: SupabaseAppError | null, fallback = "Erreur Supabase") {
  if (isSupabaseSetupIssue(error)) {
    return getSupabaseSetupError();
  }

  return error?.message || fallback;
}

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(getSupabaseConfigError());
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl!, supabaseAnonKey!);
  }

  return browserClient;
}

export function createSupabaseRequestClient(accessToken?: string) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export function hasSupabaseAdminConfig() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
