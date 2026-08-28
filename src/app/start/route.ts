import { NextResponse, type NextRequest } from "next/server"

// The default way in. A workspace starts in this browser with no account:
// the cookie marks the choice, onboarding collects the three durable facts,
// and the workspace itself lives in localStorage. Signing in later is optional
// and only exists for hosted deployments with account storage.
export function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : request.url
  const response = NextResponse.redirect(new URL("/onboarding", origin))
  response.cookies.set("course_context_local", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 })
  return response
}
