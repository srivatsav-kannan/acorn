import { cookies } from "next/headers"
import { OnboardingPage } from "@/features/onboarding/onboarding-page"

export default async function Page() {
  const jar = await cookies()
  const fixture = process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && jar.get("course_context_local")?.value === "1"
  return <OnboardingPage browserWorkspace={fixture} />
}
