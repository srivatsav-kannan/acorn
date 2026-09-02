import { ResetPasswordPage } from "@/features/auth/reset-password-page"
import { createAcornServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

export default async function Page() {
  if (!isSupabaseServerConfigured()) return <ResetPasswordPage expired />
  const client = await createAcornServerClient()
  const { data } = await client.auth.getUser()
  return <ResetPasswordPage expired={!data.user} />
}
