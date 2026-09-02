import { createBrowserClient } from "@supabase/ssr"

export const getSupabasePublicConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""
})

export const isSupabaseConfigured = () => {
  const config = getSupabasePublicConfig()
  return Boolean(config.url && config.publishableKey)
}

export const createAcornBrowserClient = () => {
  const config = getSupabasePublicConfig()
  if (!config.url || !config.publishableKey) throw new Error("Supabase public configuration is missing")
  return createBrowserClient(config.url, config.publishableKey, { cookieOptions: { secure: process.env.NODE_ENV === "production" } })
}
