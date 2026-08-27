import { NextResponse, type NextRequest } from "next/server"

export function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const origin = host ? `${protocol}://${host}` : request.url
  const response = NextResponse.redirect(new URL("/app?fresh=1", origin))
  response.cookies.set("course_context_demo", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 })
  return response
}
