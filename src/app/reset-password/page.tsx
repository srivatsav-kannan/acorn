import { ResetPasswordPage } from "@/features/auth/reset-password-page"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

export default async function Page() {
  if (!isSupabaseServerConfigured()) return <ResetPasswordPage expired />
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  return <ResetPasswordPage expired={!data.user} />
}
