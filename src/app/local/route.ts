import { NextResponse, type NextRequest } from "next/server"

// Local workspace entry for builds without hosted accounts. The workspace is
// created at onboarding and lives in this browser's storage.
export function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : request.url
  if (process.env.COURSE_CONTEXT_E2E_FIXTURE !== "true") return NextResponse.redirect(new URL("/login", origin))
  const response = NextResponse.redirect(new URL("/onboarding", origin))
  const options = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 }
  response.cookies.set("course_context_demo", "1", options)
  response.cookies.set("course_context_local", "1", options)
  return response
}
