import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const filesUnder = (root: string): string[] => readdirSync(root).flatMap((name) => {
  const path = join(root, name)
  return statSync(path).isDirectory() ? filesUnder(path) : [path]
})

describe("source conformance", () => {
  it("contains no private student identity in committed product fixtures", () => {
    const roots = ["src"]
    const text = roots.filter((root) => {
      try { return statSync(root).isDirectory() } catch { return false }
    }).flatMap(filesUnder).filter((file) => /\.(ts|tsx|json|css)$/.test(file) && !file.endsWith("stanford-catalog.json")).map((file) => readFileSync(file, "utf8")).join("\n")
    expect(text).not.toMatch(/srivatsav|kannan|@stanford\.edu/i)
  })

  it("does not use prohibited decorative UI patterns", () => {
    const roots = ["src/components", "src/features", "src/app"]
    const text = roots.filter((root) => {
      try { return statSync(root).isDirectory() } catch { return false }
    }).flatMap(filesUnder).filter((file) => /\.(ts|tsx|css)$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n")
    expect(text).not.toMatch(/purple|violet|glassmorphism|backdrop-filter|linear-gradient|radial-gradient|drop-shadow\(0 0/i)
  })

  it("does not place external enrollment or messaging in the tool surface", () => {
    const file = readFileSync("src/webmcp/tools.ts", "utf8")
    expect(file).not.toMatch(/enroll_course|submit_enrollment|send_email|send_message/)
  })
})
