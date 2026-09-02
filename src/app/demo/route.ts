import { NextResponse, type NextRequest } from "next/server"

export function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : request.url
  const testFixture = process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && process.env.NODE_ENV !== "production"
  const response = NextResponse.redirect(new URL(testFixture ? "/app?fresh=1" : "/login", origin))
  if (testFixture) {
    response.cookies.set("course_context_demo", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 })
    response.cookies.set("course_context_local", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
  }
  return response
}
