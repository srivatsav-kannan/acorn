import { redirect } from "next/navigation"

// Agents guess tab paths, and older links still name tabs from before the
// four-tab layout. A miss used to strand them on a 404 outside the workspace
// provider, where no tools are registered. Every unknown path lands on the
// closest tab instead, so the tool surface stays alive after any navigation.
const legacyTabs: Record<string, string> = {
  agent: "/app/collaborate",
  courses: "/app/academics",
  explore: "/app/academics",
  plan: "/app/academics",
  programs: "/app/academics",
  library: "/app/scratchpad",
  settings: "/app/profile"
}

export default async function MissingWorkspacePath({ params }: { params: Promise<{ missing: string[] }> }) {
  const { missing } = await params
  redirect(legacyTabs[missing[0] ?? ""] ?? "/app")
}
