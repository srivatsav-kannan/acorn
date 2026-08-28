import { academicDatesBetween, noClassDates, quarterClassRange } from "@/data/institutions/stanford-academic-calendar"
import { parseTermId } from "@/domain/timeline"
import type { Catalog, Day, Opportunity, WorkspaceState } from "@/domain/types"

// Everything the calendar shows is derived on demand from workspace state and
// reference data. Nothing is stored twice: planning a course, marking a club,
// or adding an activity is enough for its dates to appear here.

export type CalendarEventKind = "academic" | "course" | "club" | "activity" | "todo" | "event"

export type CalendarEvent = {
  id: string
  date: string
  start?: string
  end?: string
  title: string
  detail?: string
  kind: CalendarEventKind
  timezone?: string
  sourceId?: string
  projected?: boolean
  noClasses?: boolean
}

const dayCodes: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const parseIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

const eachDay = (from: string, to: string, limit = 800): string[] => {
  const days: string[] = []
  const cursor = parseIso(from)
  const end = parseIso(to)
  while (cursor <= end && days.length < limit) {
    days.push(isoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

const within = (date: string, from: string, to: string) => date >= from && date <= to

const clampRange = (start: string, end: string, from: string, to: string): [string, string] | null => {
  const lo = start > from ? start : from
  const hi = end < to ? end : to
  return lo <= hi ? [lo, hi] : null
}

const recurringDays = (days: Day[], start: string, end: string, from: string, to: string, skip: Array<{ start: string, end: string }> = []): string[] => {
  const range = clampRange(start, end, from, to)
  if (!range) return []
  return eachDay(range[0], range[1]).filter((date) => {
    if (!days.includes(dayCodes[parseIso(date).getDay()])) return false
    return !skip.some((block) => date >= block.start && date <= block.end)
  })
}

export const calendarEventsForRange = (workspace: WorkspaceState, catalog: Catalog, opportunities: Opportunity[], from: string, to: string): CalendarEvent[] => {
  const events: CalendarEvent[] = []
  const firstYear = parseIso(from).getFullYear() - 1
  const lastYear = parseIso(to).getFullYear()

  for (const item of academicDatesBetween(firstYear, lastYear)) {
    const range = clampRange(item.date, item.endDate ?? item.date, from, to)
    if (!range) continue
    for (const date of eachDay(range[0], range[1])) {
      events.push({ id: `ACADEMIC-${item.date}-${item.label.slice(0, 18)}-${date}`, date, title: item.label, kind: "academic", projected: item.projected, noClasses: item.noClasses })
    }
  }

  const sectionById = new Map(catalog.sections.map((section) => [section.id, section]))
  const courseById = new Map(catalog.courses.map((course) => [course.id, course]))
  for (const plan of workspace.plans) {
    const ref = parseTermId(plan.termId)
    if (!ref) continue
    const classRange = quarterClassRange(ref.academicYearStart, ref.season)
    if (!classRange) continue
    const skip = noClassDates(ref.academicYearStart)
    const scenario = plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]
    if (!scenario) continue
    for (const planCourse of scenario.courses) {
      const course = courseById.get(planCourse.courseId)
      const section = planCourse.sectionId ? sectionById.get(planCourse.sectionId) : undefined
      const label = course?.code ?? planCourse.courseId
      if (section && section.meetings.length > 0) {
        for (const meeting of section.meetings) {
          for (const date of recurringDays(meeting.days, classRange.start, classRange.end, from, to, skip)) {
            events.push({ id: `COURSE-${plan.termId}-${planCourse.id}-${meeting.start}-${date}`, date, start: meeting.start, end: meeting.end, title: label, detail: [course?.title, meeting.location].filter(Boolean).join(" · "), kind: "course", projected: classRange.projected })
          }
        }
      } else {
        // A planned course with no published section still marks the quarter's
        // first class day so the plan is visible on the calendar.
        if (within(classRange.start, from, to)) events.push({ id: `COURSE-${plan.termId}-${planCourse.id}-start`, date: classRange.start, title: `${label} begins`, detail: course?.title, kind: "course", projected: classRange.projected })
      }
    }
    for (const commitment of scenario.commitments) {
      for (const meeting of commitment.meetings) {
        for (const date of recurringDays(meeting.days, classRange.start, classRange.end, from, to, skip)) {
          events.push({ id: `COMMIT-${plan.termId}-${commitment.id}-${meeting.start}-${date}`, date, start: meeting.start, end: meeting.end, title: commitment.title, kind: "activity" })
        }
      }
    }
  }

  const interested = new Set(workspace.interestedOpportunityIds ?? [])
  for (const opportunity of opportunities) {
    if (!interested.has(opportunity.id)) continue
    for (const dated of opportunity.dates ?? []) {
      if (within(dated.date, from, to)) events.push({ id: `CLUB-${opportunity.id}-${dated.date}-${dated.label.slice(0, 12)}`, date: dated.date, title: `${opportunity.name}: ${dated.label}`, kind: "club" })
    }
  }

  for (const activity of workspace.activities ?? []) {
    if (activity.schedule) {
      const start = activity.startDate ?? from
      const end = activity.endDate ?? to
      for (const date of recurringDays(activity.schedule.days, start, end, from, to)) {
        events.push({ id: `ACTIVITY-${activity.id}-${date}`, date, start: activity.schedule.start, end: activity.schedule.end, title: activity.name, detail: activity.schedule.location, kind: "activity" })
      }
    }
    for (const dated of activity.dates ?? []) {
      if (within(dated.date, from, to)) events.push({ id: `ACTIVITY-${activity.id}-${dated.date}-${dated.label.slice(0, 12)}`, date: dated.date, title: `${activity.name}: ${dated.label}`, kind: "activity" })
    }
  }

  for (const todo of workspace.todos ?? []) {
    if (todo.due && !todo.done && within(todo.due, from, to)) {
      events.push({ id: `TODO-${todo.id}`, date: todo.due, start: todo.dueTime, title: todo.title, detail: todo.detail, kind: "todo", sourceId: todo.id })
    }
  }

  for (const item of workspace.events ?? []) {
    if (within(item.date, from, to)) {
      events.push({ id: `EVENT-${item.id}`, date: item.date, start: item.start, end: item.end, title: item.title, detail: item.description, kind: "event", timezone: item.timezone, sourceId: item.id })
    }
  }

  // All-day entries (registrar dates, deadlines, todos) lead each day so a
  // crowded cell shows the milestone before the 9 a.m. lecture.
  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "00:00").localeCompare(b.start ?? "00:00"))
}
