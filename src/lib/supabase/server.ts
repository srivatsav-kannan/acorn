import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const getSupabaseServerConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""
})

export const isSupabaseServerConfigured = () => {
  const config = getSupabaseServerConfig()
  return Boolean(config.url && config.publishableKey)
}

export const createAcornServerClient = async () => {
  const config = getSupabaseServerConfig()
  if (!config.url || !config.publishableKey) throw new Error("Supabase public configuration is missing")
  const cookieStore = await cookies()
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch { /* Server Components cannot always write refreshed cookies. The proxy handles refresh. */ }
      }
    }
  })
}
