export function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
}

export function getSupabaseServiceConfig() {
  const browserConfig = getSupabaseBrowserConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    ...browserConfig,
    serviceRoleKey,
    configured: Boolean(browserConfig.url && serviceRoleKey),
  };
}
