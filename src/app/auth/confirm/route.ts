import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { safeNextPath } from "@/lib/auth/redirects"

const otpTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

// Email templates that link with a token hash instead of a code land here.
// Verifying the hash needs no state from the browser that requested it, so
// a link opened on a phone still works when the request came from a laptop.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : url.origin
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  const next = safeNextPath(url.searchParams.get("next"))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!tokenHash || !type || !otpTypes.has(type) || !supabaseUrl || !publishableKey) return NextResponse.redirect(new URL("/login?error=auth_configuration", origin))

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
    }
  })
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : "/login?error=auth_link", origin))
  return NextResponse.redirect(new URL(next, origin))
}
