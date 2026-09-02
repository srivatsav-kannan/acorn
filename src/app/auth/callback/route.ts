import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { safeNextPath } from "@/lib/auth/redirects"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : url.origin
  const code = url.searchParams.get("code")
  const next = safeNextPath(url.searchParams.get("next"))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) return NextResponse.redirect(new URL("/login?error=auth_configuration", origin))
  // Auth bounces here without a code when the link was already used or has
  // expired. A recovery link goes back to the request page with that said.
  if (!code) return NextResponse.redirect(new URL(next === "/reset-password" ? "/forgot-password?expired=1" : "/login?error=auth_link", origin))

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
    }
  })
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL("/login?error=auth_callback", origin))
  return NextResponse.redirect(new URL(next, origin))
}
