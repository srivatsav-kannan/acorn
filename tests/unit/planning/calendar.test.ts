import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/workspace/fixture"
import { academicYearDates, quarterClassRange } from "@/data/institutions/stanford/academic-calendar"
import { calendarEventsForRange } from "@/domain/planning/calendar"

describe("Stanford academic calendar data", () => {
  it("carries the registrar's official 2026-27 dates without a projected flag", () => {
    const dates = academicYearDates(2026)
    expect(dates.every((item) => !item.projected)).toBe(true)
    expect(dates.find((item) => item.label.includes("New Student Orientation"))?.date).toBe("2026-09-15")
    expect(dates.find((item) => item.label === "Autumn quarter begins; instruction begins")?.date).toBe("2026-09-22")
    expect(dates.find((item) => item.label.includes("Thanksgiving"))).toMatchObject({ date: "2026-11-23", endDate: "2026-11-27", noClasses: true })
    expect(dates.find((item) => item.label === "Commencement")?.date).toBe("2027-06-13")
  })

  it("projects unpublished years with the registrar's recurring shape, flagged as projections", () => {
    const dates = academicYearDates(2028)
    expect(dates.length).toBeGreaterThan(12)
    expect(dates.every((item) => item.projected)).toBe(true)
    const autumn = dates.find((item) => item.label.includes("Autumn quarter begins"))!
    const [year, month, day] = autumn.date.split("-").map(Number)
    const start = new Date(year, month - 1, day)
    expect(year).toBe(2028)
    expect(start.getDay()).toBe(2)
    expect(day).toBeGreaterThanOrEqual(20)
    const winter = dates.find((item) => item.label.includes("Winter quarter begins"))!
    expect(new Date(winter.date + "T12:00:00").getDay()).toBe(1)
  })

  it("exposes the span in which a quarter's classes meet", () => {
    expect(quarterClassRange(2026, "AUTUMN")).toEqual({ start: "2026-09-22", end: "2026-12-04", projected: false })
    expect(quarterClassRange(2027, "WINTER")?.projected).toBe(true)
  })
})

describe("calendar event derivation", () => {
  it("expands planned course meetings across the quarter and skips no-class days", () => {
    const { workspace, catalog } = buildFixture()
    const events = calendarEventsForRange(workspace, catalog, [], "2026-09-20", "2026-12-12")
    const courseMeetings = events.filter((event) => event.kind === "course" && event.start)
    expect(courseMeetings.length).toBeGreaterThan(20)
    expect(courseMeetings.some((event) => event.date < "2026-09-22")).toBe(false)
    expect(courseMeetings.some((event) => event.date >= "2026-11-23" && event.date <= "2026-11-27")).toBe(false)
    expect(events.some((event) => event.kind === "academic" && event.title.includes("Thanksgiving"))).toBe(true)
  })

  it("places todos, activities, and interested club dates on the calendar", () => {
    const { workspace, catalog } = buildFixture()
    workspace.todos.push({ id: "TODO-X", title: "Submit CURIS application", due: "2026-10-15", done: false, source: "human", createdAt: "2026-09-01T00:00:00Z" })
    workspace.activities.push({ id: "ACTIVITY-X", name: "Rivera lab", kind: "research", schedule: { days: ["tue"], start: "15:00", end: "17:00" }, startDate: "2026-10-01", endDate: "2026-10-31", addedBy: "human" })
    workspace.interestedOpportunityIds.push("OPPORTUNITY-TREEHACKS")
    const opportunities = [{ id: "OPPORTUNITY-TREEHACKS", kind: "club" as const, name: "TreeHacks", summary: "Hackathon", tags: [], dates: [{ date: "2026-10-20", label: "Applications open" }] }]
    const events = calendarEventsForRange(workspace, catalog, opportunities, "2026-10-01", "2026-10-31")
    expect(events.find((event) => event.kind === "todo")?.date).toBe("2026-10-15")
    expect(events.filter((event) => event.kind === "activity" && event.title === "Rivera lab").length).toBe(4)
    expect(events.find((event) => event.kind === "club")?.title).toContain("TreeHacks")
    const uninterested = calendarEventsForRange({ ...workspace, interestedOpportunityIds: [] }, catalog, opportunities, "2026-10-01", "2026-10-31")
    expect(uninterested.some((event) => event.kind === "club")).toBe(false)
  })
})
