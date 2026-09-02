import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/workspace/fixture"
import {
  checkPlan,
  meetingsOverlap,
  type PlanCheckCode
} from "@/domain/planning/planner"
import type { Meeting, PlanScenario } from "@/domain/workspace/types"

const meeting = (day: Meeting["days"][number], start: string, end: string): Meeting => ({
  days: [day],
  start,
  end,
  timezone: "America/Los_Angeles",
  type: "lecture"
})

describe("meeting overlap", () => {
  it.each([
    [meeting("mon", "09:00", "10:00"), meeting("mon", "09:30", "10:30"), true],
    [meeting("mon", "09:00", "10:00"), meeting("mon", "10:00", "11:00"), false],
    [meeting("mon", "09:00", "10:00"), meeting("tue", "09:30", "10:30"), false],
    [meeting("fri", "23:00", "23:30"), meeting("fri", "23:15", "23:45"), true]
  ])("evaluates boundaries", (a, b, expected) => {
    expect(meetingsOverlap(a, b)).toBe(expected)
  })

  it("is symmetric for every valid interval", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1300 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 1300 }),
        fc.integer({ min: 1, max: 100 }),
        (aStart, aLength, bStart, bLength) => {
          const asTime = (minutes: number) => {
            const bounded = Math.min(minutes, 1439)
            return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`
          }
          const a = meeting("wed", asTime(aStart), asTime(Math.min(1439, aStart + aLength)))
          const b = meeting("wed", asTime(bStart), asTime(Math.min(1439, bStart + bLength)))
          expect(meetingsOverlap(a, b)).toBe(meetingsOverlap(b, a))
        }
      )
    )
  })
})

describe("plan checks", () => {
  const codes = (scenario: PlanScenario) => {
    const fixture = buildFixture()
    return checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    }).map((check) => check.code)
  }

  it("passes the canonical primary plan", () => {
    const fixture = buildFixture()
    const result = checkPlan({
      scenario: fixture.workspace.plans[0].scenarios[0],
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    expect(result.filter((check) => check.severity === "error")).toEqual([])
  })

  const cases: Array<[PlanCheckCode, (scenario: PlanScenario) => void]> = [
    ["UNIT_LIMIT", (s) => { s.unitLimit = 5 }],
    ["DUPLICATE_COURSE", (s) => { s.courses.push({ ...s.courses[0], id: "PLANCOURSE-DUPLICATE" }) }],
    ["MEETING_CONFLICT", (s) => { s.courses[1].sectionId = "SECTION-CONFLICTING" }],
    ["COMMITMENT_CONFLICT", (s) => { s.commitments.push({ id: "COMMITMENT-CONFLICT", title: "Research", meetings: [meeting("mon", "10:00", "11:00")] }) }],
    ["MISSING_SECTION", (s) => { s.courses[0].sectionId = null }],
    ["NOT_OFFERED", (s) => { s.courses.push({ id: "PLANCOURSE-NOT-OFFERED", courseId: "COURSE-CS-999", sectionId: null, units: 3, status: "active" }) }],
    ["PREREQUISITE_MISSING", (s) => { s.courses.push({ id: "PLANCOURSE-ADVANCED", courseId: "COURSE-CS-221", sectionId: "SECTION-CS-221-01", units: 3, status: "active" }) }],
    ["PREREQUISITE_UNCERTAIN", (s) => { s.courses.push({ id: "PLANCOURSE-UNCERTAIN", courseId: "COURSE-CS-147B", sectionId: "SECTION-CS-147B-01", units: 3, status: "active" }) }],
    ["FINAL_CONFLICT", (s) => { s.courses[1].sectionId = "SECTION-FINAL-CONFLICT" }],
    ["DAY_CONSTRAINT", (s) => { s.courses[1].sectionId = "SECTION-FRIDAY" }],
    ["TIME_CONSTRAINT", (s) => { s.courses[1].sectionId = "SECTION-EARLY" }],
    ["TRANSITION_BUFFER", (s) => { s.courses[1].sectionId = "SECTION-TIGHT-TRANSITION" }],
    ["STALE_EVIDENCE", (s) => { s.courses[1].sectionId = "SECTION-STALE" }]
  ]

  it.each(cases)("detects %s", (code, mutate) => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    mutate(scenario)
    expect(codes(scenario)).toContain(code)
  })

  it("does not count backup courses toward units or conflicts", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses.push({
      id: "PLANCOURSE-BACKUP",
      courseId: "COURSE-CS-221",
      sectionId: "SECTION-CONFLICTING",
      units: 5,
      status: "backup"
    })
    const found = codes(scenario)
    expect(found).not.toContain("UNIT_LIMIT")
    expect(found).not.toContain("MEETING_CONFLICT")
  })

  it("reports stable IDs, evidence, affected objects, and repairs", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.unitLimit = 5
    const result = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    const check = result.find((item) => item.code === "UNIT_LIMIT")
    expect(check).toMatchObject({
      id: expect.stringMatching(/^CHECK-/),
      severity: "error",
      deterministic: true
    })
    expect(check?.affectedIds.length).toBeGreaterThan(0)
    expect(check?.message).toBeTruthy()
    expect(check?.suggestedRepairs.length).toBeGreaterThan(0)
  })
})

describe("alternative section suggestions", () => {
  it("names a concrete same-course section that clears every constraint", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses[1].sectionId = "SECTION-EARLY"
    const result = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    const check = result.find((item) => item.code === "TIME_CONSTRAINT" && item.affectedIds.includes("PLANCOURSE-COMM-1"))
    expect(check?.alternative).toBeDefined()
    expect(check?.alternative?.sectionId).not.toBe("SECTION-EARLY")
    const suggested = fixture.catalog.sections.find((section) => section.id === check?.alternative?.sectionId)
    expect(suggested?.courseId).toBe("COURSE-COMM-1")
    expect(check?.suggestedRepairs[0]).toContain(`Switch to ${check?.alternative?.sectionId}`)
    expect(check?.alternative?.meets).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/)
  })

  it("offers no alternative when no sibling section fits", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses[1].sectionId = "SECTION-EARLY"
    const profile = structuredClone(fixture.workspace.profile)
    profile.latestEnd = "08:00"
    const result = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    const check = result.find((item) => item.code === "TIME_CONSTRAINT" && item.affectedIds.includes("PLANCOURSE-COMM-1"))
    expect(check).toBeDefined()
    expect(check?.alternative).toBeUndefined()
    expect(check?.suggestedRepairs[0]).toBe("Choose another section")
  })

  it("suggests a fitting replacement for a meeting conflict", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses[1].sectionId = "SECTION-CONFLICTING"
    const result = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    const check = result.find((item) => item.code === "MEETING_CONFLICT")
    expect(check?.alternative).toBeDefined()
    expect(check?.suggestedRepairs[0]).toContain("Switch to ")
  })
})

describe("bundled discussion components", () => {
  it("names the discussion when it is the meeting that violates", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses[1].sectionId = "SECTION-COMM-1-02"
    const profile = structuredClone(fixture.workspace.profile)
    profile.protectedWindows = [{ id: "WINDOW-RESEARCH", days: ["fri"], start: "10:00", end: "11:00", label: "Research block" }]
    const result = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    const check = result.find((item) => item.code === "PROTECTED_TIME" && item.affectedIds.includes("PLANCOURSE-COMM-1"))
    expect(check?.message).toContain("This section's discussion overlaps protected time")
    expect(check?.message).toContain("Research block")
  })

  it("keeps the plain wording when the lecture itself violates", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses[1].sectionId = "SECTION-EARLY"
    const result = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      now: new Date("2026-08-27T12:00:00Z")
    })
    const check = result.find((item) => item.code === "TIME_CONSTRAINT" && item.affectedIds.includes("PLANCOURSE-COMM-1"))
    expect(check?.message).toBe("This section falls outside the allowed time window.")
  })
})
