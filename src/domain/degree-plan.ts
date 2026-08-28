import { effectiveCompletedCourseIds } from "@/domain/history"
import { compareTerms, parseTermId, termLabel, termSequence, termStatus, timelineFor, unitsRequired } from "@/domain/timeline"
import type { Catalog, Plan, WorkspaceState } from "@/domain/types"

// The degree evaluator walks the timeline in order and carries state forward:
// what counts as completed grows term by term, so a prerequisite satisfied by
// a Winter course is satisfied for Spring but not for the same Winter. This
// sequencing bookkeeping is exactly the kind of consistency work the
// application does deterministically on the agent's behalf.

export type TermPlanSummary = {
  termId: string
  label: string
  status: "past" | "current" | "future"
  planId: string | null
  courses: Array<{ planCourseId: string, courseId: string, code: string, title: string, units: number }>
  units: number
  issues: TimelineIssue[]
}

export type TimelineIssue = {
  code: "SEQUENCE_PREREQUISITE" | "DUPLICATE_ACROSS_TERMS" | "TERM_OVERLOAD" | "SCHEDULE_NOT_PUBLISHED"
  severity: "error" | "warning"
  termId: string
  message: string
  affectedIds: string[]
}

export type DegreeEvaluation = {
  timeline: { entryTermId: string, expectedGraduationTermId: string, degree: string }
  terms: TermPlanSummary[]
  completedUnits: number
  plannedUnits: number
  projectedUnits: number
  requiredUnits: number
  issues: TimelineIssue[]
}

const activeCourses = (plan: Plan | undefined) => {
  if (!plan) return []
  const scenario = plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]
  return scenario?.courses.filter((item) => item.status === "active") ?? []
}

export const planForTerm = (workspace: WorkspaceState, termId: string): Plan | undefined =>
  workspace.plans.find((plan) => plan.termId === termId)

export const evaluateDegreePlan = (workspace: WorkspaceState, catalog: Catalog, now: Date): DegreeEvaluation => {
  const timeline = timelineFor(workspace.profile, now)
  const sequence = termSequence(timeline.entryTermId, timeline.expectedGraduationTermId)
  const courseById = new Map(catalog.courses.map((course) => [course.id, course]))
  const termsWithSections = new Set(catalog.sections.map((section) => section.termId))
  const completedSoFar = new Set(effectiveCompletedCourseIds(workspace.profile))
  const completedUnits = [...completedSoFar].reduce((sum, id) => sum + (courseById.get(id)?.maxUnits ?? 0), 0)
    + (workspace.profile.apCredits ?? []).reduce((sum, credit) => sum + (credit.unitsGranted && !credit.satisfiesCourseIds?.length ? credit.unitsGranted : 0), 0)
  const plannedByTerm = new Map<string, string[]>()
  const issues: TimelineIssue[] = []
  const seenPlanned = new Map<string, string>()

  const terms: TermPlanSummary[] = sequence.map((ref) => {
    const plan = planForTerm(workspace, ref.id)
    const courses = activeCourses(plan).map((item) => {
      const course = courseById.get(item.courseId)
      return { planCourseId: item.id, courseId: item.courseId, code: course?.code ?? item.courseId, title: course?.title ?? "", units: item.units }
    })
    const termIssues: TimelineIssue[] = []
    const status = termStatus(ref.id, now)
    const units = courses.reduce((sum, item) => sum + item.units, 0)

    for (const item of courses) {
      const priorTerm = seenPlanned.get(item.courseId)
      if (priorTerm && priorTerm !== ref.id) {
        termIssues.push({ code: "DUPLICATE_ACROSS_TERMS", severity: "warning", termId: ref.id, affectedIds: [item.planCourseId], message: `${item.code} is already planned for ${termLabel(priorTerm)}.` })
      }
      const course = courseById.get(item.courseId)
      const missing = (course?.prerequisites ?? []).filter((id) => !completedSoFar.has(id))
      if (missing.length > 0 && status !== "past") {
        const codes = missing.map((id) => courseById.get(id)?.code ?? id).join(", ")
        termIssues.push({ code: "SEQUENCE_PREREQUISITE", severity: "error", termId: ref.id, affectedIds: [item.planCourseId, ...missing], message: `${item.code} needs ${codes} in an earlier term.` })
      }
      seenPlanned.set(item.courseId, seenPlanned.get(item.courseId) ?? ref.id)
    }
    if (units > 22) termIssues.push({ code: "TERM_OVERLOAD", severity: "warning", termId: ref.id, affectedIds: courses.map((item) => item.planCourseId), message: `${units} units in one quarter is above the 22 unit ceiling.` })
    if (courses.length > 0 && status !== "past" && !termsWithSections.has(ref.id) && parseTermId(ref.id)) {
      termIssues.push({ code: "SCHEDULE_NOT_PUBLISHED", severity: "warning", termId: ref.id, affectedIds: [], message: `No section schedule is stored for ${termLabel(ref.id)} yet, so times are unconfirmed.` })
    }

    for (const item of courses) completedSoFar.add(item.courseId)
    plannedByTerm.set(ref.id, courses.map((item) => item.courseId))
    issues.push(...termIssues)
    return { termId: ref.id, label: termLabel(ref.id), status, planId: plan?.id ?? null, courses, units, issues: termIssues }
  })

  const plannedUnits = terms.reduce((sum, term) => sum + term.units, 0)
  const required = unitsRequired(timeline.degree)
  return {
    timeline,
    terms,
    completedUnits,
    plannedUnits,
    projectedUnits: completedUnits + plannedUnits,
    requiredUnits: required,
    issues: [...issues].sort((a, b) => compareTerms(a.termId, b.termId))
  }
}

export const allPlannedCourseIds = (workspace: WorkspaceState): string[] =>
  [...new Set(workspace.plans.flatMap((plan) => activeCourses(plan).map((item) => item.courseId)))]
