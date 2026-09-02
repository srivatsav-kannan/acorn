import { NextResponse, type NextRequest } from "next/server"
import { createAcornServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  if (isSupabaseServerConfigured()) {
    const client = await createAcornServerClient()
    await client.auth.signOut()
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  const response = NextResponse.redirect(new URL("/", host ? `${protocol}://${host}` : request.url), 303)
  response.cookies.set("course_context_demo", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
  response.cookies.set("course_context_local", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
  return response
}
