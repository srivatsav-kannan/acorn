import { NextResponse, type NextRequest } from "next/server"

// Test-only entry. Playwright uses this to exercise onboarding and planning
// without a mailbox for magic links; the workspace it creates lives in the
// test browser. Outside the fixture flag every road leads through an account.
export function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : request.url
  if (process.env.COURSE_CONTEXT_E2E_FIXTURE !== "true") return NextResponse.redirect(new URL("/login", origin))
  const response = NextResponse.redirect(new URL("/onboarding", origin))
  response.cookies.set("course_context_local", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 })
  return response
}
