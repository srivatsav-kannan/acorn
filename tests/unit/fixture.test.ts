import { describe, expect, it } from "vitest"
import { buildFixture, fixtureHash } from "@/data/fixture"

describe("Stanford demo fixture", () => {
  it("is deterministic", () => {
    expect(fixtureHash(buildFixture())).toBe(fixtureHash(buildFixture()))
  })

  it("contains enough nearby course options for real planning", () => {
    const fixture = buildFixture()
    expect(fixture.catalog.courses.length).toBeGreaterThanOrEqual(30)
    expect(fixture.catalog.sections.length).toBeGreaterThanOrEqual(20)
  })

  it("keeps catalog courses and term sections separate", () => {
    const fixture = buildFixture()
    expect(fixture.catalog.courses.some((course) => course.id === "COURSE-CS-999")).toBe(true)
    expect(fixture.catalog.sections.some((section) => section.courseId === "COURSE-CS-999")).toBe(false)
  })

  it("contains the deliberate research gap and required stress fixtures", () => {
    const fixture = buildFixture()
    expect(fixture.workspace.uncertainties.some((item) => item.id === "UNCERTAINTY-LIVE-OFFERING")).toBe(true)
    for (const id of ["SECTION-CONFLICTING", "SECTION-FINAL-CONFLICT", "SECTION-FRIDAY", "SECTION-EARLY", "SECTION-TIGHT-TRANSITION", "SECTION-STALE"]) {
      expect(fixture.catalog.sections.some((section) => section.id === id)).toBe(true)
    }
  })

  it("contains genuinely different primary and lighter planning scenarios", () => {
    const plan = buildFixture().workspace.plans[0]
    expect(plan.scenarios).toHaveLength(2)
    const [primary, lighter] = plan.scenarios
    const activeUnits = (scenario: typeof primary) => scenario.courses.filter((course) => course.status === "active").reduce((sum, course) => sum + course.units, 0)
    expect(activeUnits(primary)).toBe(13)
    expect(activeUnits(lighter)).toBe(13)
    expect(primary.courses).not.toEqual(lighter.courses)
  })

  it("contains only fictional student data", () => {
    const serialized = JSON.stringify(buildFixture())
    expect(serialized).not.toMatch(/Srivatsav|Kannan|srivatsav/i)
    expect(buildFixture().workspace.profile.isFictional).toBe(true)
  })

  it("uses unique stable IDs across each entity collection", () => {
    const fixture = buildFixture()
    for (const collection of [
      fixture.catalog.courses,
      fixture.catalog.sections,
      fixture.workspace.contextItems,
      fixture.workspace.evidence,
      fixture.workspace.plans,
      fixture.workspace.programs
    ]) {
      expect(new Set(collection.map((item) => item.id)).size).toBe(collection.length)
      expect(collection.every((item) => /^[A-Z][A-Z0-9-]+$/.test(item.id))).toBe(true)
    }
  })
})
