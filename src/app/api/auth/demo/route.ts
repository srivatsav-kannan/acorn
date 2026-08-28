import { NextResponse } from "next/server"
import { getDemoAccountConfig, isDemoAccountConfigured } from "@/lib/demo-account"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

export async function POST() {
  if (!isSupabaseServerConfigured() || !isDemoAccountConfigured()) {
    return NextResponse.json({ ok: false, message: "Demo login is not configured." }, { status: 503 })
  }
  const client = await createCourseContextServerClient()
  const config = getDemoAccountConfig()
  const { error } = await client.auth.signInWithPassword({ email: config.email, password: config.password })
  if (error) return NextResponse.json({ ok: false, message: "Demo login is unavailable." }, { status: 503 })
  return NextResponse.json({ ok: true })
}
