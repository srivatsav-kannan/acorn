import { LoginPage } from "@/features/auth/login-page"
import { safeNextPath } from "@/lib/auth/redirects"
import { isDemoAccountConfigured } from "@/lib/demo-account"
import { isSupabaseServerConfigured } from "@/lib/supabase/server"

const messages: Record<string, string> = {
  auth_configuration: "Account sign-in is not configured for this deployment.",
  auth_callback: "That sign-in link could not be completed. Request a new link and try again."
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string, demo?: string, reset?: string, next?: string }> }) {
  const { error, demo, reset, next } = await searchParams
  const initialStatus = reset === "1" ? "Demo reset. Sign in to begin onboarding." : error ? messages[error] ?? "Sign-in could not be completed." : ""
  return <LoginPage initialStatus={initialStatus} demoAvailable={isSupabaseServerConfigured() && isDemoAccountConfigured()} demoRequested={demo === "1"} nextPath={safeNextPath(next ?? null)} />
}
