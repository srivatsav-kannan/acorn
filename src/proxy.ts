import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const protectedPrefixes = ["/app", "/onboarding"]
const localUrl = (request: NextRequest, path: string) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  return new URL(path, host ? `${protocol}://${host}` : request.url)
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })
  const protectedRoute = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))
  if (!protectedRoute) return response
  if (process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && request.cookies.get("course_context_demo")?.value === "1") return response

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return NextResponse.redirect(localUrl(request, "/login?reason=account_setup_required"))

  const client = createServerClient(url, key, {
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
