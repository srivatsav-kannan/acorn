import { LoginPage } from "@/features/auth/login-page"

const messages: Record<string, string> = {
  auth_configuration: "Account sign-in is not configured for this deployment.",
  auth_callback: "That sign-in link could not be completed. Request a new link and try again."
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <LoginPage initialStatus={error ? messages[error] ?? "Sign-in could not be completed." : ""} />
}
