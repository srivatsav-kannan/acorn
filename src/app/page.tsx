import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AuthHashHandoff } from "@/features/landing/auth-hash-handoff"
import { LandingPage } from "@/features/landing/landing-page"

// The landing only needs to know which door to offer. A Supabase auth cookie
// is a cheap, local signal that a session probably exists; the proxy still
// verifies the session for real before any workspace route renders.
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  // An auth email built from the project's site URL drops its code here
  // instead of on the callback. Hand it over rather than losing it.
  const { code } = await searchParams
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`)
  const jar = await cookies()
  const signedIn = jar.getAll().some((cookie) => /^sb-.+-auth-token/.test(cookie.name) && cookie.value.length > 0)
    || (process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && process.env.NODE_ENV !== "production" && (jar.get("course_context_demo")?.value === "1" || jar.get("course_context_local")?.value === "1"))
  return <><AuthHashHandoff /><LandingPage signedIn={signedIn} /></>
}
