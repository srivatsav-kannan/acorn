import { calendarEventsForRange, isoDate } from "@/domain/calendar"
import { goalContentOf } from "@/domain/goals"
import { creditCategory } from "@/domain/history"
import { standingForTerm, supportsTimeline, termLabel, timelineFor } from "@/domain/timeline"
import type { Catalog, Opportunity, WorkspaceState } from "@/domain/types"

// The bulk context pipe. Markdown compresses well in a model's context and
// mixes structure with prose notes naturally, so the export is a sequence of
// small markdown blocks. The tool layer pages over these blocks; every entity
// carries its stable ID in backticks so the agent can act on what it read.

type Section = "profile" | "goals" | "todos" | "events" | "scratchpad" | "plans" | "courses" | "clubs" | "activities" | "calendar" | "history"

const order: Section[] = ["profile", "goals", "todos", "events", "scratchpad", "plans", "courses", "clubs", "activities", "calendar", "history"]

export const exportBlocks = (workspace: WorkspaceState, catalog: Catalog, opportunities: Opportunity[], section: string, now: Date): string[] => {
  const sections: Section[] = section === "all" ? order : order.includes(section as Section) ? [section as Section] : order
  const courseById = new Map(catalog.courses.map((course) => [course.id, course]))
  const code = (courseId: string) => courseById.get(courseId)?.code ?? courseId
  const blocks: string[] = []

  for (const current of sections) {
    if (current === "profile") {
      const profile = workspace.profile
      const timeline = supportsTimeline(workspace) ? timelineFor(profile, now) : null
      blocks.push([
        `# ${workspace.title}`,
        `Student: ${profile.name || "unnamed"}. Institution: ${workspace.institution}. Current term: ${termLabel(workspace.currentTermId)}.`,
        timeline ? `Timeline: entered ${termLabel(timeline.entryTermId)}, graduating ${termLabel(timeline.expectedGraduationTermId)}, objective ${timeline.degree}. Standing now: ${standingForTerm(timeline, workspace.currentTermId)}.` : `No structured timeline; this is a custom institution.${profile.classYear ? ` Reported standing: ${profile.classYear}.` : ""}`,
        `Planning window: classes between ${profile.earliestStart} and ${profile.latestEnd}; protected days: ${profile.excludedDays.join(", ") || "none"}.`,
        ...(profile.protectedWindows?.length ? [`Protected time: ${profile.protectedWindows.map((window) => `${window.label} ${window.days.join("/")} ${window.start} to ${window.end}`).join("; ")}.`] : [])
      ].join("\n"))
    }
    if (current === "goals") {
      const preferences = workspace.profile.preferences.map((preference) => `- ${preference.strength === "hard" ? "Hard" : "Soft"}: ${preference.label} \`${preference.id}\``)
      const standing = workspace.contextItems.filter((item) => !item.archived && item.type === "goal").map((item) => {
        const structured = goalContentOf(item)
        if (!structured) return `- ${item.title}${item.summary ? `: ${item.summary}` : ""} \`${item.id}\``
        const milestones = structured.milestones.map((milestone) => `  - [${milestone.done ? "x" : " "}] ${milestone.title}${milestone.due ? ` (due ${milestone.due})` : ""} \`${milestone.id}\``)
        const links = [...structured.courseIds.map((id) => code(id)), ...structured.opportunityIds].join(", ")
        return [`- ${item.title} (${structured.status}${structured.targetDate ? `, target ${structured.targetDate}` : ""}) \`${item.id}\``, ...milestones, ...(links ? [`  Linked: ${links}`] : [])].join("\n")
      })
      blocks.push([`## Goals`, workspace.profile.summary ? workspace.profile.summary : "No goal note recorded yet.", ...(preferences.length ? ["Priorities:", ...preferences] : ["No priorities recorded."]), ...(standing.length ? ["Standing goals:", ...standing] : [])].join("\n"))
    }
    if (current === "todos") {
      const open = (workspace.todos ?? []).filter((todo) => !todo.done)
      const done = (workspace.todos ?? []).filter((todo) => todo.done)
      blocks.push([`## Todos (${open.length} open)`, ...open.map((todo) => `- [ ] ${todo.title}${todo.due ? ` (due ${todo.due}${todo.dueTime ? ` ${todo.dueTime}` : ""})` : ""}${todo.detail ? `: ${todo.detail}` : ""} \`${todo.id}\``), ...(done.length ? [`Done: ${done.map((todo) => todo.title).join("; ")}`] : [])].join("\n"))
    }
    if (current === "events") {
      const upcoming = (workspace.events ?? []).slice().sort((a, b) => a.date.localeCompare(b.date))
      blocks.push([`## Events (${upcoming.length})`, ...(upcoming.length ? upcoming.map((event) => `- ${event.date}${event.start ? ` ${event.start}${event.end ? ` to ${event.end}` : ""}` : ""}${event.timezone ? ` ${event.timezone}` : ""}: ${event.title}${event.description ? `. ${event.description}` : ""} \`${event.id}\``) : ["None recorded."])].join("\n"))
    }
    if (current === "scratchpad") {
      const items = workspace.contextItems.filter((item) => !item.archived)
      blocks.push(`## Scratchpad (${items.length} notes)`)
      for (const item of items) {
        const sourceUrl = (item.content as { sourceUrl?: string } | undefined)?.sourceUrl
        blocks.push([`### ${item.title} \`${item.id}\``, `${item.type}${item.tags?.length ? `, tags: ${item.tags.join(", ")}` : ""}, added by ${item.addedBy?.type ?? "human"}.`, item.summary, sourceUrl ? `Source: ${sourceUrl}` : ""].filter(Boolean).join("\n"))
      }
    }
    if (current === "plans") {
      blocks.push(`## Plans (${workspace.plans.length} terms)`)
      for (const plan of workspace.plans) {
        const scenario = plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]
        if (!scenario) continue
        const units = scenario.courses.filter((item) => item.status === "active").reduce((total, item) => total + item.units, 0)
        blocks.push([
          `### ${termLabel(plan.termId)} \`${plan.id}\` (${units} units planned)`,
          ...scenario.courses.map((item) => `- ${code(item.courseId)} (${item.units} units${item.status === "backup" ? ", backup" : ""}) \`${item.courseId}\``),
          ...(scenario.commitments.length ? [`Commitments: ${scenario.commitments.map((item) => item.title).join("; ")}`] : [])
        ].join("\n"))
      }
    }
    if (current === "courses") {
      const interested = (workspace.interestedCourseIds ?? []).map((id) => `- ${code(id)}: ${courseById.get(id)?.title ?? "unknown"}${workspace.courseIntents?.[id] ? ` (intended ${termLabel(workspace.courseIntents[id])})` : ""} \`${id}\``)
      blocks.push([`## Course tracker (${interested.length} interested)`, ...(interested.length ? interested : ["Nothing marked interested yet."])].join("\n"))
      const noted = Object.entries(workspace.courseNotes ?? {}).filter(([, notes]) => notes.length > 0)
      for (const [courseId, notes] of noted) {
        blocks.push([`### Notes on ${code(courseId)} \`${courseId}\``, ...notes.map((note) => `- (${note.author}) ${note.text} \`${note.id}\``)].join("\n"))
      }
      const custom = workspace.referenceOverlay?.courses ?? []
      if (custom.length) {
        const evidenceById = new Map(workspace.evidence.map((item) => [item.id, item]))
        const sourceBacked = (course: { evidenceIds?: string[] }) => (course.evidenceIds ?? []).some((id) => {
          const evidence = evidenceById.get(id)
          return evidence?.classification === "official" && evidence.status === "current"
        })
        const verified = custom.filter(sourceBacked)
        const unverified = custom.filter((course) => !sourceBacked(course))
        if (verified.length) blocks.push([`### Source-backed catalog additions and corrections`, ...verified.map((course) => `- ${course.code}: ${course.title} \`${course.id}\``)].join("\n"))
        if (unverified.length) blocks.push([`### Unverified catalog additions`, ...unverified.map((course) => `- ${course.code}: ${course.title} \`${course.id}\``)].join("\n"))
      }
    }
    if (current === "clubs") {
      const interested = new Set(workspace.interestedOpportunityIds ?? [])
      blocks.push(`## Clubs and programs (${opportunities.length} listed, ${interested.size} interested)`)
      for (const opportunity of opportunities) {
        blocks.push([
          `### ${opportunity.name} \`${opportunity.id}\`${interested.has(opportunity.id) ? " (interested)" : ""}`,
          `${opportunity.kind}${opportunity.commitment ? `, ${opportunity.commitment}` : ""}${opportunity.timing ? `, ${opportunity.timing}` : ""}.`,
          opportunity.summary,
          ...(opportunity.dates?.length ? [`Dates: ${opportunity.dates.map((dated) => `${dated.date} ${dated.label}`).join("; ")}`] : [])
        ].filter(Boolean).join("\n"))
      }
    }
    if (current === "activities") {
      const activities = workspace.activities ?? []
      blocks.push([`## Activities (${activities.length})`, ...(activities.length ? [] : ["None recorded."])].join("\n"))
      for (const activity of activities) {
        blocks.push([
          `### ${activity.name} \`${activity.id}\``,
          `${activity.kind}${activity.organizer ? ` with ${activity.organizer}` : ""}${activity.schedule ? `, ${activity.schedule.days.join("/")} ${activity.schedule.start} to ${activity.schedule.end}${activity.schedule.location ? ` at ${activity.schedule.location}` : ""}` : ""}.`,
          activity.startDate || activity.endDate ? `Runs ${activity.startDate ?? "now"} to ${activity.endDate ?? "open-ended"}.` : "",
          activity.detail ?? "",
          ...(activity.dates?.length ? [`Dates: ${activity.dates.map((dated) => `${dated.date} ${dated.label}`).join("; ")}`] : [])
        ].filter(Boolean).join("\n"))
      }
    }
    if (current === "calendar") {
      const from = isoDate(now)
      const toDate = new Date(now)
      toDate.setDate(toDate.getDate() + 60)
      const events = calendarEventsForRange(workspace, catalog, opportunities, from, isoDate(toDate))
      const highlights = events.filter((event) => event.kind !== "course" || event.title.endsWith("begins")).slice(0, 40)
      blocks.push([`## Next sixty days (${events.length} calendar entries, recurring class meetings collapsed)`, ...highlights.map((event) => `- ${event.date}${event.start ? ` ${event.start}` : ""}: ${event.title}${event.projected ? " (projected)" : ""}`)].join("\n"))
      const currentPlan = workspace.plans.find((plan) => plan.termId === workspace.currentTermId)
      const activeScenario = currentPlan?.scenarios.find((scenario) => scenario.id === currentPlan.activeScenarioId) ?? currentPlan?.scenarios[0]
      const meetingLines = (activeScenario?.courses ?? []).filter((item) => item.status === "active" && item.sectionId).map((item) => {
        const section = catalog.sections.find((candidate) => candidate.id === item.sectionId)
        if (!section) return null
        const meets = section.meetings.map((meeting) => `${meeting.days.join("/")} ${meeting.start} to ${meeting.end}${meeting.location ? ` at ${meeting.location}` : ""}`).join("; ")
        return `- ${code(item.courseId)}: ${meets}`
      }).filter((line): line is string => Boolean(line))
      if (meetingLines.length) blocks.push([`## Class meetings this term`, ...meetingLines].join("\n"))
    }
    if (current === "history") {
      const completed = workspace.profile.completedCourseIds.map((id) => code(id))
      const creditLabel = (credit: { kind?: string, exam: string, institution?: string }) => {
        const category = creditCategory(credit)
        return category === "ib" ? "IB" : category === "college" ? credit.institution || "College course" : "AP"
      }
      const credits = (workspace.profile.apCredits ?? []).map((credit) => `- ${creditLabel(credit)}: ${credit.exam}${credit.score ? `, score ${credit.score}` : ""}${credit.unitsGranted ? `, ${credit.unitsGranted} units granted` : ""}`)
      blocks.push([`## Academic history`, completed.length ? `Completed: ${completed.join(", ")}.` : "No completed courses recorded.", ...(credits.length ? ["External credit (AP, IB, and college coursework):", ...credits] : ["No external credit recorded."])].join("\n"))
    }
  }
  return blocks
}
