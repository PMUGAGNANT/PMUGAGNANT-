import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function hasSupabaseAdminConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabaseConfigError() {
  return "Supabase n'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.";
}

export function getSupabaseAdminConfigError() {
  return "Supabase admin n'est pas configure. Ajoutez SUPABASE_SERVICE_ROLE_KEY.";
}

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(getSupabaseConfigError());
  }

  if (!browserClient) {
    browserClient = createClient(getSupabaseUrl()!, getSupabaseAnonKey()!);
  }

  return browserClient;
}

export function createSupabaseRequestClient(accessToken?: string) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createClient(getSupabaseUrl()!, getSupabaseAnonKey()!, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export function getSupabaseAdminClient() {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl()!, getSupabaseServiceRoleKey()!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

export function getRequiredSupabaseAdminClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error(getSupabaseAdminConfigError());
  }

  return client;
}
