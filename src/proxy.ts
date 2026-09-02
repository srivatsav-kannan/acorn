import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const protectedPrefixes = ["/app", "/onboarding"]
const localUrl = (request: NextRequest, path: string) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  return new URL(path, host ? `${protocol}://${host}` : request.url)
}

// Every workspace lives behind an account and persists in Supabase. The only
// exception is the browser fixture Playwright drives, and it exists solely
// when the test flag is set at boot.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })
  const protectedRoute = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))
  if (!protectedRoute) return response

  if (process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && process.env.NODE_ENV !== "production" && (request.cookies.get("course_context_demo")?.value === "1" || request.cookies.get("course_context_local")?.value === "1")) return response

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return NextResponse.redirect(localUrl(request, "/login?error=auth_configuration"))

  const client = createServerClient(url, key, {
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    }
  })
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.redirect(localUrl(request, `/login?next=${encodeURIComponent(request.nextUrl.pathname)}`))
  return response
}

export const config = { matcher: ["/app/:path*", "/onboarding/:path*"] }
