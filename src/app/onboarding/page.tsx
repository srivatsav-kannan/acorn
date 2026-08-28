import { cookies } from "next/headers"
import { OnboardingPage } from "@/features/onboarding/onboarding-page"

export default async function Page() {
  const jar = await cookies()
  return <OnboardingPage browserWorkspace={jar.get("course_context_local")?.value === "1"} />
}
