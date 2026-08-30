import { checkPlan, meetingComponent } from "@/domain/planner"
import type { Activity, Catalog, Evidence, Meeting, PlanScenario, Section, StudentProfile } from "@/domain/types"

// Deterministic schedule generation over stored sections: every combination
// of section choices for the scenario's active courses is evaluated with the
// same checks the plan rail runs, hard schedule violations disqualify, and
// the survivors rank by fewest warnings, fewest campus days, then least idle
// time between classes. Issues independent of section choice, prerequisites
// or unit limits, are reported once instead of disqualifying every option.

const SECTION_DEPENDENT = new Set(["MEETING_CONFLICT", "FINAL_CONFLICT", "DAY_CONSTRAINT", "TIME_CONSTRAINT", "COMMITMENT_CONFLICT", "TRANSITION_BUFFER", "PROTECTED_TIME", "STALE_EVIDENCE"])

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number)
  return hours * 60 + mins
}

const describeMeets = (section: Section) => section.meetings.map((one: Meeting) => `${meetingComponent(one.type) ? `${meetingComponent(one.type)} ` : ""}${one.days.join("/")} ${one.start}-${one.end}`).join(" and ")

export type SectionOption = {
  rank: number
  sections: Array<{ courseId: string, sectionId: string, meets: string }>
  daysOnCampus: number
  span: string
  idleMinutes: number
  warningCount: number
  warnings: string[]
}

export type SectionSuggestions = {
  options: SectionOption[]
  unschedulable: Array<{ planCourseId: string, courseId: string, reason: string }>
  standingIssues: string[]
  considered: number
  capped: boolean
  note: string
}

export const suggestSections = ({ scenario, catalog, profile, evidence, activities, now, termId, limit = 2 }: { scenario: PlanScenario, catalog: Catalog, profile: StudentProfile, evidence: Evidence[], activities?: Activity[], now: Date, termId: string, limit?: number }): SectionSuggestions => {
  const active = scenario.courses.filter((item) => item.status === "active")
  // With real section counts, a course can offer dozens of discussion
  // pairings and the pool below keeps only the first few. Screening each
  // candidate against the fixed blocks first, protected windows, excluded
  // days, the day's time fence, commitments, and scheduled activities, keeps
  // the pool from filling with sections no choice elsewhere could ever save.
  const fixedBlocks = [
    ...(profile.protectedWindows ?? []).map((window) => ({ days: window.days as string[], start: window.start, end: window.end })),
    ...scenario.commitments.flatMap((commitment) => commitment.meetings.map((meeting) => ({ days: meeting.days as string[], start: meeting.start, end: meeting.end }))),
    ...(activities ?? []).filter((activity) => activity.schedule).map((activity) => ({ days: activity.schedule!.days as string[], start: activity.schedule!.start, end: activity.schedule!.end }))
  ]
  const excluded = new Set(profile.excludedDays ?? [])
  const clearsFixedBlocks = (section: Section) => section.meetings.every((meeting) =>
    meeting.days.every((day) => !excluded.has(day)) &&
    (!profile.earliestStart || meeting.start >= profile.earliestStart) &&
    (!profile.latestEnd || meeting.end <= profile.latestEnd) &&
    fixedBlocks.every((block) => !block.days.some((day) => meeting.days.includes(day as Meeting["days"][number])) || meeting.start >= block.end || meeting.end <= block.start))
  const perCourse = active.map((item) => {
    const candidates = catalog.sections.filter((section) => section.courseId === item.courseId && section.termId === termId)
    const clear = candidates.filter(clearsFixedBlocks)
    return { item, candidates: clear.length ? clear : candidates }
  })
  const unschedulable = perCourse.filter((entry) => entry.candidates.length === 0).map((entry) => ({ planCourseId: entry.item.id, courseId: entry.item.courseId, reason: "No stored section this term." }))
  const schedulable = perCourse.filter((entry) => entry.candidates.length > 0)

  let capped = false
  let width = 6
  const combinationCount = (max: number) => schedulable.reduce((total, entry) => total * Math.min(entry.candidates.length, max), 1)
  while (width > 1 && combinationCount(width) > 4000) {
    width -= 1
    capped = true
  }
  const pools = schedulable.map((entry) => entry.candidates.slice(0, width))
  const considered = pools.reduce((total, pool) => total * pool.length, schedulable.length ? 1 : 0)

  type Evaluated = { key: string, sections: Section[], warningMessages: string[], daysOnCampus: number, idleMinutes: number, earliest: number, latest: number }
  const evaluated: Evaluated[] = []
  let standingIssues: string[] = []

  const evaluate = (choice: Section[]) => {
    const clone = structuredClone(scenario)
    for (let index = 0; index < schedulable.length; index += 1) {
      const target = clone.courses.find((item) => item.id === schedulable[index].item.id)
      if (target) target.sectionId = choice[index].id
    }
    const checks = checkPlan({ scenario: clone, catalog, profile, evidence, activities, now, termId })
    if (!standingIssues.length) standingIssues = [...new Set(checks.filter((check) => !SECTION_DEPENDENT.has(check.code)).map((check) => `${check.severity}: ${check.message}`))]
    const sectionChecks = checks.filter((check) => SECTION_DEPENDENT.has(check.code))
    if (sectionChecks.some((check) => check.severity === "error")) return
    const warningMessages = [...new Set(sectionChecks.map((check) => check.message))]
    const byDay = new Map<string, Array<{ start: number, end: number }>>()
    for (const section of choice) for (const meeting of section.meetings) for (const day of meeting.days) {
      const list = byDay.get(day) ?? []
      list.push({ start: minutes(meeting.start), end: minutes(meeting.end) })
      byDay.set(day, list)
    }
    let idleMinutes = 0
    let earliest = Number.POSITIVE_INFINITY
    let latest = 0
    for (const list of byDay.values()) {
      list.sort((a, b) => a.start - b.start)
      for (let index = 1; index < list.length; index += 1) idleMinutes += Math.max(0, list[index].start - list[index - 1].end)
      earliest = Math.min(earliest, list[0].start)
      latest = Math.max(latest, list[list.length - 1].end)
    }
    evaluated.push({ key: choice.map((section) => section.id).join("+"), sections: choice, warningMessages, daysOnCampus: byDay.size, idleMinutes, earliest, latest })
  }

  const walk = (index: number, chosen: Section[]) => {
    if (index === pools.length) {
      if (chosen.length) evaluate(chosen)
      return
    }
    for (const candidate of pools[index]) walk(index + 1, [...chosen, candidate])
  }
  walk(0, [])

  evaluated.sort((a, b) => a.warningMessages.length - b.warningMessages.length || a.daysOnCampus - b.daysOnCampus || a.idleMinutes - b.idleMinutes || a.latest - b.latest || a.key.localeCompare(b.key))

  const asTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
  const options = evaluated.slice(0, Math.min(Math.max(limit, 1), 5)).map((entry, index) => ({
    rank: index + 1,
    sections: entry.sections.map((section) => ({ courseId: section.courseId, sectionId: section.id, meets: describeMeets(section) })),
    daysOnCampus: entry.daysOnCampus,
    span: entry.sections.length ? `${asTime(entry.earliest)}-${asTime(entry.latest)}` : "",
    idleMinutes: entry.idleMinutes,
    warningCount: entry.warningMessages.length,
    warnings: entry.warningMessages.slice(0, 3)
  }))

  return {
    options,
    unschedulable,
    standingIssues: standingIssues.slice(0, 3),
    considered,
    capped,
    note: "Stored sections only; verify live. Apply with edit_plan select_section."
  }
}
