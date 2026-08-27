import { isEvidenceStale } from "@/domain/evidence"
import type { Catalog, Evidence, Meeting, PlanScenario, StudentProfile } from "@/domain/types"

export type PlanCheckCode = "UNIT_LIMIT" | "DUPLICATE_COURSE" | "MEETING_CONFLICT" | "COMMITMENT_CONFLICT" | "MISSING_SECTION" | "NOT_OFFERED" | "PREREQUISITE_MISSING" | "PREREQUISITE_UNCERTAIN" | "FINAL_CONFLICT" | "DAY_CONSTRAINT" | "TIME_CONSTRAINT" | "TRANSITION_BUFFER" | "STALE_EVIDENCE"

export type PlanCheck = {
  id: string
  code: PlanCheckCode
  severity: "error" | "warning"
  deterministic: true
  affectedIds: string[]
  evidenceIds: string[]
  message: string
  suggestedRepairs: string[]
}

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number)
  return hours * 60 + mins
}

export const meetingsOverlap = (a: Meeting, b: Meeting) => a.days.some((day) => b.days.includes(day)) && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end)

const finalsOverlap = (a?: { start: string, end: string }, b?: { start: string, end: string }) => Boolean(a && b && new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end))

export const checkPlan = ({ scenario, catalog, profile, evidence, now }: { scenario: PlanScenario, catalog: Catalog, profile: StudentProfile, evidence: Evidence[], now: Date }): PlanCheck[] => {
  const checks: PlanCheck[] = []
  let sequence = 0
  const add = (code: PlanCheckCode, severity: "error" | "warning", affectedIds: string[], message: string, suggestedRepairs: string[], evidenceIds: string[] = []) => {
    sequence += 1
    checks.push({ id: `CHECK-${code}-${String(sequence).padStart(2, "0")}`, code, severity, deterministic: true, affectedIds, evidenceIds, message, suggestedRepairs })
  }
  const active = scenario.courses.filter((item) => item.status === "active")
  const totalUnits = active.reduce((sum, item) => sum + item.units, 0)
  if (totalUnits > scenario.unitLimit) add("UNIT_LIMIT", "error", active.map((item) => item.id), `${totalUnits} units exceed the ${scenario.unitLimit} unit scenario limit.`, ["Move a course to backups", "Reduce variable units"])

  const seen = new Map<string, string>()
  for (const item of active) {
    const prior = seen.get(item.courseId)
    if (prior) add("DUPLICATE_COURSE", "error", [prior, item.id], "The same course appears more than once.", ["Remove the duplicate course"])
    seen.set(item.courseId, item.id)
  }

  const selected = active.map((item) => ({ item, course: catalog.courses.find((course) => course.id === item.courseId), section: catalog.sections.find((section) => section.id === item.sectionId) }))
  for (const entry of selected) {
    if (!entry.section) {
      const offered = catalog.sections.some((section) => section.courseId === entry.item.courseId && section.termId === "TERM-2026-AUTUMN")
      add(offered ? "MISSING_SECTION" : "NOT_OFFERED", "error", [entry.item.id], offered ? "Choose a section before finalizing this course." : "No current term offering is stored for this course.", offered ? ["Select an available section"] : ["Verify the live schedule", "Move the course to a future term"])
    }
    if (entry.course?.prerequisiteUncertain) add("PREREQUISITE_UNCERTAIN", "warning", [entry.item.id], "The prerequisite interpretation needs review.", ["Open the official course page", "Ask an advisor"])
    const missing = entry.course?.prerequisites?.filter((id) => !profile.completedCourseIds.includes(id)) ?? []
    if (missing.length) add("PREREQUISITE_MISSING", "error", [entry.item.id, ...missing], "A required prerequisite is not completed or planned.", ["Add the prerequisite", "Choose another course"])
    if (entry.section) {
      const staleIds = entry.section.evidenceIds.filter((id) => {
        const found = evidence.find((item) => item.id === id)
        return !found || isEvidenceStale(found, now)
      })
      if (staleIds.length) add("STALE_EVIDENCE", "warning", [entry.section.id], "This section relies on stale schedule evidence.", ["Refresh the official schedule source"], staleIds)
      for (const itemMeeting of entry.section.meetings) {
        if (itemMeeting.days.some((day) => profile.excludedDays.includes(day))) add("DAY_CONSTRAINT", "error", [entry.item.id], "This section meets on a day marked unavailable.", ["Choose another section", "Change the day constraint"], entry.section.evidenceIds)
        if (minutes(itemMeeting.start) < minutes(profile.earliestStart) || minutes(itemMeeting.end) > minutes(profile.latestEnd)) add("TIME_CONSTRAINT", "error", [entry.item.id], "This section falls outside the allowed time window.", ["Choose another section", "Change the time constraint"], entry.section.evidenceIds)
      }
    }
  }

  for (let first = 0; first < selected.length; first += 1) {
    for (let second = first + 1; second < selected.length; second += 1) {
      const a = selected[first]
      const b = selected[second]
      if (!a.section || !b.section) continue
      if (a.section.meetings.some((one) => b.section!.meetings.some((two) => meetingsOverlap(one, two)))) add("MEETING_CONFLICT", "error", [a.item.id, b.item.id], "Two selected sections overlap.", ["Choose a different section", "Move one course to backups"], [...a.section.evidenceIds, ...b.section.evidenceIds])
      if (finalsOverlap(a.section.final, b.section.final)) add("FINAL_CONFLICT", "error", [a.item.id, b.item.id], "Two final exams overlap.", ["Choose a different section", "Replace one course"], [...a.section.evidenceIds, ...b.section.evidenceIds])
      for (const one of a.section.meetings) for (const two of b.section.meetings) {
        if (!one.days.some((day) => two.days.includes(day)) || meetingsOverlap(one, two)) continue
        const gap = Math.max(minutes(two.start) - minutes(one.end), minutes(one.start) - minutes(two.end))
        if (gap >= 0 && gap < profile.transitionBufferMinutes) add("TRANSITION_BUFFER", "warning", [a.item.id, b.item.id], `Only ${gap} minutes separate two classes.`, ["Choose a section with more travel time"])
      }
    }
  }

  for (const entry of selected) for (const commitment of scenario.commitments) {
    if (entry.section?.meetings.some((one) => commitment.meetings.some((two) => meetingsOverlap(one, two)))) add("COMMITMENT_CONFLICT", "error", [entry.item.id, commitment.id], `A course conflicts with ${commitment.title}.`, ["Choose another section", "Move the commitment"])
  }
  return checks
}
