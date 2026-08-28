import { LoginPage } from "@/features/auth/login-page"
import { safeNextPath } from "@/lib/auth/redirects"

const messages: Record<string, string> = {
  auth_configuration: "Account sign-in is not configured for this deployment.",
  auth_callback: "That sign-in could not be completed. Try again."
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string, reset?: string, next?: string }> }) {
  const { error, reset, next } = await searchParams
  const initialStatus = reset === "1" ? "The demo was reset. Log in to start onboarding again." : error ? messages[error] ?? "Sign-in could not be completed." : ""
  return <LoginPage initialStatus={initialStatus} nextPath={safeNextPath(next ?? null)} />
}
