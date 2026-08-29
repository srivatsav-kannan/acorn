import { redirect } from "next/navigation"

// Agents guess tab paths (/app/scratchpad for the Scratchpad tab that lives
// at /app itself). A miss used to strand them on a 404 outside the workspace
// provider, where no tools are registered; landing on the workspace instead
// keeps the tool surface alive after any navigation.
export default function MissingWorkspacePath() {
  redirect("/app")
}
