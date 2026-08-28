import { cookies } from "next/headers"
import { LandingPage } from "@/features/landing/landing-page"

export default async function Page() {
  const jar = await cookies()
  const hasWorkspace = jar.get("course_context_local")?.value === "1" || jar.get("course_context_demo")?.value === "1"
  return <LandingPage hasWorkspace={hasWorkspace} />
}
