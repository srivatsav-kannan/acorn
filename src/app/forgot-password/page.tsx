import { ForgotPasswordPage } from "@/features/auth/forgot-password-page"

export default async function Page({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams
  return <ForgotPasswordPage initialStatus={expired === "1" ? "That link was already used or has expired. Request a new one and open only the newest email." : ""} />
}
