import { isEvidenceStale } from "@/domain/evidence"
import { effectiveCompletedCourseIds } from "@/domain/history"
import type { Activity, Catalog, Evidence, Meeting, PlanScenario, StudentProfile } from "@/domain/types"

export type PlanCheckCode = "UNIT_LIMIT" | "DUPLICATE_COURSE" | "MEETING_CONFLICT" | "COMMITMENT_CONFLICT" | "MISSING_SECTION" | "NOT_OFFERED" | "PREREQUISITE_MISSING" | "PREREQUISITE_UNCERTAIN" | "FINAL_CONFLICT" | "DAY_CONSTRAINT" | "TIME_CONSTRAINT" | "TRANSITION_BUFFER" | "PROTECTED_TIME" | "STALE_EVIDENCE"

export type PlanCheck = {
  id: string
  code: PlanCheckCode
  severity: "error" | "warning"
  deterministic: true
  affectedIds: string[]
  evidenceIds: string[]
  message: string
  suggestedRepairs: string[]
  // A concrete same-course section that clears every current constraint,
  // when one exists; the first suggested repair names it.
  alternative?: { sectionId: string, meets: string }
}

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number)
  return hours * 60 + mins
}

// Stanford calls a discussion component a "section", but in prose that word
// collides with the enrollable section itself, so surfaces say "discussion".
// Lectures are the assumed default and get no label.
export const meetingComponent = (type: Meeting["type"]) => type === "lecture" ? null : type === "section" ? "discussion" : type

export const meetingsOverlap = (a: Meeting, b: Meeting) => a.days.some((day) => b.days.includes(day)) && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end)

const finalsOverlap = (a?: { start: string, end: string }, b?: { start: string, end: string }) => Boolean(a && b && new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end))

export const checkPlan = ({ scenario, catalog, profile, evidence, activities, now, termId = "TERM-2026-AUTUMN" }: { scenario: PlanScenario, catalog: Catalog, profile: StudentProfile, evidence: Evidence[], activities?: Activity[], now: Date, termId?: string }): PlanCheck[] => {
  const checks: PlanCheck[] = []
  let sequence = 0
  const add = (code: PlanCheckCode, severity: "error" | "warning", affectedIds: string[], message: string, suggestedRepairs: string[], evidenceIds: string[] = [], alternative?: { sectionId: string, meets: string }) => {
    sequence += 1
    const repairs = alternative ? [`Switch to ${alternative.sectionId}, ${alternative.meets}`, ...suggestedRepairs] : suggestedRepairs
    checks.push({ id: `CHECK-${code}-${String(sequence).padStart(2, "0")}`, code, severity, deterministic: true, affectedIds, evidenceIds, message, suggestedRepairs: repairs, ...(alternative ? { alternative } : {}) })
  }
  // A scheduled activity is a scheduling constraint exactly like a scenario
  // commitment; students should never have to duplicate one into the plan
  // for the checks to notice it.
  const activityBlocks = (activities ?? []).filter((activity) => activity.schedule).map((activity) => ({
    id: activity.id,
    title: `${activity.name} (activity)`,
    meetings: [{ days: activity.schedule!.days, start: activity.schedule!.start, end: activity.schedule!.end, timezone: "America/Los_Angeles", type: "commitment" as const }]
  }))
  const commitmentBlocks = [...scenario.commitments, ...activityBlocks]
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
  const termHasSchedule = catalog.sections.some((section) => section.termId === termId)

  // A violation whose repair is "choose another section" earns a concrete
  // suggestion: the first same-course section this term that clears every
  // constraint against the rest of the scenario, protected windows and
  // transition buffers included.
  const describeMeets = (candidate: { meetings: Meeting[] }) => candidate.meetings.map((one) => `${meetingComponent(one.type) ? `${meetingComponent(one.type)} ` : ""}${one.days.join("/")} ${one.start}-${one.end}`).join(" and ")
  const fitsCleanly = (candidate: { meetings: Meeting[], final?: { start: string, end: string } }, replacingItemId: string) => {
    for (const one of candidate.meetings) {
      if (one.days.some((day) => profile.excludedDays.includes(day))) return false
      if (minutes(one.start) < minutes(profile.earliestStart) || minutes(one.end) > minutes(profile.latestEnd)) return false
      for (const window of profile.protectedWindows ?? []) {
        if (one.days.some((day) => window.days.includes(day)) && minutes(one.start) < minutes(window.end) && minutes(window.start) < minutes(one.end)) return false
      }
      for (const commitment of commitmentBlocks) if (commitment.meetings.some((two) => meetingsOverlap(one, two))) return false
    }
    for (const other of selected) {
      if (other.item.id === replacingItemId || !other.section) continue
      for (const one of candidate.meetings) for (const two of other.section.meetings) {
        if (meetingsOverlap(one, two)) return false
        if (one.days.some((day) => two.days.includes(day))) {
          const gap = Math.max(minutes(two.start) - minutes(one.end), minutes(one.start) - minutes(two.end))
          if (gap >= 0 && gap < profile.transitionBufferMinutes) return false
        }
      }
      if (finalsOverlap(candidate.final, other.section.final)) return false
    }
    return true
  }
  const alternativeCache = new Map<string, { sectionId: string, meets: string } | undefined>()
  const alternativeFor = (entry: typeof selected[number]) => {
    const cached = alternativeCache.get(entry.item.id)
    if (cached !== undefined || alternativeCache.has(entry.item.id)) return cached
    const found = catalog.sections.find((candidate) => candidate.courseId === entry.item.courseId && candidate.termId === termId && candidate.id !== entry.section?.id && fitsCleanly(candidate, entry.item.id))
    const value = found ? { sectionId: found.id, meets: describeMeets(found) } : undefined
    alternativeCache.set(entry.item.id, value)
    return value
  }
  for (const entry of selected) {
    if (!entry.section && termHasSchedule) {
      const offered = catalog.sections.some((section) => section.courseId === entry.item.courseId && section.termId === termId)
      add(offered ? "MISSING_SECTION" : "NOT_OFFERED", "error", [entry.item.id], offered ? "Choose a section before finalizing this course." : "No current term offering is stored for this course.", offered ? ["Select an available section"] : ["Verify the live schedule", "Move the course to a future term"], [], offered ? alternativeFor(entry) : undefined)
    }
    if (entry.course?.prerequisiteUncertain) add("PREREQUISITE_UNCERTAIN", "warning", [entry.item.id], "The prerequisite interpretation needs review.", ["Open the official course page", "Ask an advisor"])
    const completedWithCredit = effectiveCompletedCourseIds(profile)
    const missing = entry.course?.prerequisites?.filter((id) => !completedWithCredit.includes(id)) ?? []
    if (missing.length) {
      // Planning the prerequisite in the same term does not satisfy it, but
      // telling the student it is "not planned" while it sits in the plan
      // reads as a contradiction, so the message names the actual problem.
      const plannedHere = missing.some((id) => scenario.courses.some((item) => item.status === "active" && item.courseId === id))
      const message = plannedHere ? "A prerequisite is planned in this same term; it must be completed in an earlier term." : "A required prerequisite is not completed before this term."
      const repairs = plannedHere ? ["Move this course to a later term", "Take the prerequisite in an earlier term"] : ["Complete the prerequisite first", "Choose another course"]
      add("PREREQUISITE_MISSING", "error", [entry.item.id, ...missing], message, repairs)
    }
    if (entry.section) {
      const staleIds = entry.section.evidenceIds.filter((id) => {
        const found = evidence.find((item) => item.id === id)
        return !found || isEvidenceStale(found, now)
      })
      if (staleIds.length) add("STALE_EVIDENCE", "warning", [entry.section.id], "This section relies on stale schedule evidence.", ["Refresh the official schedule source"], staleIds)
      for (const itemMeeting of entry.section.meetings) {
        const component = meetingComponent(itemMeeting.type)
        if (itemMeeting.days.some((day) => profile.excludedDays.includes(day))) add("DAY_CONSTRAINT", "error", [entry.item.id], component ? `This section's ${component} meets on a day marked unavailable.` : "This section meets on a day marked unavailable.", ["Choose another section", "Change the day constraint"], entry.section.evidenceIds, alternativeFor(entry))
        if (minutes(itemMeeting.start) < minutes(profile.earliestStart) || minutes(itemMeeting.end) > minutes(profile.latestEnd)) add("TIME_CONSTRAINT", "error", [entry.item.id], component ? `This section's ${component} falls outside the allowed time window.` : "This section falls outside the allowed time window.", ["Choose another section", "Change the time constraint"], entry.section.evidenceIds, alternativeFor(entry))
        for (const window of profile.protectedWindows ?? []) {
          if (itemMeeting.days.some((day) => window.days.includes(day)) && minutes(itemMeeting.start) < minutes(window.end) && minutes(window.start) < minutes(itemMeeting.end)) {
            add("PROTECTED_TIME", "warning", [entry.item.id], `This section${component ? `'s ${component}` : ""} overlaps protected time: ${window.label}, ${window.days.join("/")} ${window.start} to ${window.end}.`, ["Choose another section", "Adjust the protected window"], entry.section.evidenceIds, alternativeFor(entry))
          }
        }
      }
    }
  }

  for (let first = 0; first < selected.length; first += 1) {
    for (let second = first + 1; second < selected.length; second += 1) {
      const a = selected[first]
      const b = selected[second]
      if (!a.section || !b.section) continue
      if (a.section.meetings.some((one) => b.section!.meetings.some((two) => meetingsOverlap(one, two)))) add("MEETING_CONFLICT", "error", [a.item.id, b.item.id], "Two selected sections overlap.", ["Choose a different section", "Move one course to backups"], [...a.section.evidenceIds, ...b.section.evidenceIds], alternativeFor(b) ?? alternativeFor(a))
      if (finalsOverlap(a.section.final, b.section.final)) add("FINAL_CONFLICT", "error", [a.item.id, b.item.id], "Two final exams overlap.", ["Choose a different section", "Replace one course"], [...a.section.evidenceIds, ...b.section.evidenceIds], alternativeFor(b) ?? alternativeFor(a))
      for (const one of a.section.meetings) for (const two of b.section.meetings) {
        if (!one.days.some((day) => two.days.includes(day)) || meetingsOverlap(one, two)) continue
        const gap = Math.max(minutes(two.start) - minutes(one.end), minutes(one.start) - minutes(two.end))
        if (gap >= 0 && gap < profile.transitionBufferMinutes) add("TRANSITION_BUFFER", "warning", [a.item.id, b.item.id], `Only ${gap} minutes separate ${a.course?.code ?? "one class"} and ${b.course?.code ?? "the next"}.`, ["Choose a section with more travel time"], [], alternativeFor(b) ?? alternativeFor(a))
      }
    }
  }

  for (const entry of selected) for (const commitment of commitmentBlocks) {
    if (entry.section?.meetings.some((one) => commitment.meetings.some((two) => meetingsOverlap(one, two)))) add("COMMITMENT_CONFLICT", "error", [entry.item.id, commitment.id], `A course conflicts with ${commitment.title}.`, ["Choose another section", "Move the commitment"], [], alternativeFor(entry))
  }
  return checks
}
