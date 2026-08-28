import { NextResponse, type NextRequest } from "next/server"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  if (isSupabaseServerConfigured()) {
    const client = await createCourseContextServerClient()
    await client.auth.signOut()
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  return NextResponse.redirect(new URL("/", host ? `${protocol}://${host}` : request.url), 303)
}
