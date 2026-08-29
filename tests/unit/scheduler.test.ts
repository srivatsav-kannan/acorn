import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { checkPlan } from "@/domain/planner"
import { suggestSections } from "@/domain/scheduler"
import type { Activity } from "@/domain/types"

const now = new Date("2026-08-27T12:00:00Z")

const run = (mutate?: (fixture: ReturnType<typeof buildFixture>) => void, activities?: Activity[]) => {
  const fixture = buildFixture()
  mutate?.(fixture)
  return suggestSections({
    scenario: fixture.workspace.plans[0].scenarios[0],
    catalog: fixture.catalog,
    profile: fixture.workspace.profile,
    evidence: fixture.workspace.evidence,
    activities,
    now,
    termId: "TERM-2026-AUTUMN"
  })
}

describe("suggest_sections", () => {
  it("returns a clean top option covering every active course", () => {
    const result = run()
    expect(result.options.length).toBeGreaterThan(0)
    const best = result.options[0]
    expect(best.warningCount).toBe(0)
    expect(best.sections.map((section) => section.courseId).sort()).toEqual(["COURSE-COMM-1", "COURSE-CS-106B", "COURSE-MATH-51"])
    expect(best.daysOnCampus).toBeGreaterThan(0)
    expect(best.span).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
    expect(result.unschedulable).toEqual([])
    expect(result.capped).toBe(false)
  })

  it("routes around a protected window by choosing a different section", () => {
    const result = run((fixture) => {
      fixture.workspace.profile.protectedWindows = [{ id: "WINDOW-TUE", days: ["tue"], start: "10:00", end: "11:00", label: "Team meeting" }]
    })
    const best = result.options[0]
    const comm = best.sections.find((section) => section.courseId === "COURSE-COMM-1")
    expect(comm?.sectionId).not.toBe("SECTION-COMM-1-01")
    expect(best.warningCount).toBe(0)
  })

  it("treats a scheduled activity as a hard block and reports course-level issues once", () => {
    const activity: Activity = { id: "ACTIVITY-JOB", name: "Startup work", kind: "job", schedule: { days: ["tue", "thu"], start: "13:00", end: "17:00" }, addedBy: "human" }
    const fixture = buildFixture()
    fixture.workspace.plans[0].scenarios[0].courses.push({ id: "PLANCOURSE-NOWHERE", courseId: "COURSE-CS-999", sectionId: null, units: 3, status: "active" })
    const result = suggestSections({
      scenario: fixture.workspace.plans[0].scenarios[0],
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      activities: [activity],
      now,
      termId: "TERM-2026-AUTUMN"
    })
    for (const option of result.options) {
      const comm = option.sections.find((section) => section.courseId === "COURSE-COMM-1")
      expect(comm?.sectionId).not.toBe("SECTION-COMM-1-02")
    }
    expect(result.unschedulable).toEqual([{ planCourseId: "PLANCOURSE-NOWHERE", courseId: "COURSE-CS-999", reason: "No stored section this term." }])
    expect(result.standingIssues.some((issue) => issue.includes("No current term offering"))).toBe(true)
  })
})

describe("activities in plan checks", () => {
  it("flags a section overlapping a scheduled activity and names the activity", () => {
    const fixture = buildFixture()
    const scenario = structuredClone(fixture.workspace.plans[0].scenarios[0])
    scenario.courses[1].sectionId = "SECTION-COMM-1-02"
    const activity: Activity = { id: "ACTIVITY-JOB", name: "Startup work", kind: "job", schedule: { days: ["tue", "thu"], start: "13:00", end: "17:00" }, addedBy: "human" }
    const checks = checkPlan({
      scenario,
      catalog: fixture.catalog,
      profile: fixture.workspace.profile,
      evidence: fixture.workspace.evidence,
      activities: [activity],
      now,
      termId: "TERM-2026-AUTUMN"
    })
    const conflict = checks.find((check) => check.code === "COMMITMENT_CONFLICT")
    expect(conflict?.message).toBe("A course conflicts with Startup work (activity).")
    expect(conflict?.affectedIds).toContain("ACTIVITY-JOB")
  })
})
