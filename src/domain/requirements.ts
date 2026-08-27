import type { RequirementRule } from "@/domain/types"

export type RequirementStatus = "completed" | "planned" | "missing" | "manual_review"

export type RequirementEvaluation = {
  ruleId: string
  status: RequirementStatus
  contributingCourseIds: string[]
  completedCourseIds: string[]
  plannedCourseIds: string[]
  detail?: string
}

type Input = {
  rule: RequirementRule
  completedCourseIds: string[]
  plannedCourseIds: string[]
  courseUnits: Record<string, number>
  courseGrades: Record<string, string>
  residentCourseIds: string[]
  allowDoubleCount: boolean
}

const gradeRank: Record<string, number> = { "A+": 13, A: 12, "A-": 11, "B+": 10, B: 9, "B-": 8, "C+": 7, C: 6, "C-": 5, D: 4, F: 0 }
const statusRank: Record<RequirementStatus, number> = { completed: 3, planned: 2, manual_review: 1, missing: 0 }

export const evaluateRequirement = (input: Input): RequirementEvaluation => {
  const completed = new Set(input.completedCourseIds)
  const planned = new Set(input.plannedCourseIds)

  const evaluate = (rule: RequirementRule, unavailable = new Set<string>()): RequirementEvaluation => {
    const base = (status: RequirementStatus, contributingCourseIds: string[] = [], detail?: string): RequirementEvaluation => ({
      ruleId: rule.id ?? `RULE-${rule.type.toUpperCase()}`,
      status,
      contributingCourseIds,
      completedCourseIds: contributingCourseIds.filter((id) => completed.has(id)),
      plannedCourseIds: contributingCourseIds.filter((id) => planned.has(id)),
      detail
    })
    const usable = (id: string) => input.allowDoubleCount || !unavailable.has(id)
    const statusFor = (ids: string[]) => {
      if (ids.length === 0) return "missing" as const
      return ids.every((id) => completed.has(id)) ? "completed" as const : "planned" as const
    }

    if (rule.type === "course") {
      if (!usable(rule.courseId)) return base("missing")
      if (completed.has(rule.courseId)) return base("completed", [rule.courseId])
      if (planned.has(rule.courseId)) return base("planned", [rule.courseId])
      return base("missing")
    }
    if (rule.type === "manual_review") return base("manual_review", [], rule.reason)
    if (rule.type === "course_group") {
      const available = rule.courseIds.filter((id) => usable(id) && (completed.has(id) || planned.has(id)))
      if (available.length < rule.count) return base("missing", available)
      const selected = available.sort((a, b) => Number(completed.has(b)) - Number(completed.has(a))).slice(0, rule.count)
      return base(statusFor(selected), selected)
    }
    if (rule.type === "minimum_units") {
      const available = rule.courseIds.filter((id) => usable(id) && (completed.has(id) || planned.has(id)))
      const selected: string[] = []
      let units = 0
      for (const id of available.sort((a, b) => Number(completed.has(b)) - Number(completed.has(a)))) {
        selected.push(id)
        units += input.courseUnits[id] ?? 0
        if (units >= rule.units) break
      }
      return units >= rule.units ? base(statusFor(selected), selected) : base("missing", selected, `${units} of ${rule.units} units`)
    }
    if (rule.type === "minimum_grade") {
      if (!usable(rule.courseId)) return base("missing")
      const actual = input.courseGrades[rule.courseId]
      if (completed.has(rule.courseId) && actual && (gradeRank[actual] ?? -1) >= (gradeRank[rule.grade] ?? 99)) return base("completed", [rule.courseId])
      if (planned.has(rule.courseId)) return base("planned", [rule.courseId])
      return base("missing")
    }
    if (rule.type === "residency") {
      const found = rule.courseIds.filter((id) => usable(id) && input.residentCourseIds.includes(id)).slice(0, rule.count)
      return found.length >= rule.count ? base("completed", found) : base("missing", found)
    }

    if (rule.type === "any_of") {
      const candidates = rule.rules.map((child) => evaluate(child, unavailable)).sort((a, b) => statusRank[b.status] - statusRank[a.status])
      const selected = candidates[0] ?? base("missing")
      return base(selected.status, selected.contributingCourseIds, selected.detail)
    }

    if (rule.type === "choose_n") {
      const candidates = rule.rules.map((child) => evaluate(child, unavailable)).filter((result) => result.status === "completed" || result.status === "planned")
        .sort((a, b) => statusRank[b.status] - statusRank[a.status])
      if (candidates.length < rule.count) return base("missing", candidates.flatMap((item) => item.contributingCourseIds))
      const selected = candidates.slice(0, rule.count)
      const ids = selected.flatMap((item) => item.contributingCourseIds)
      return base(selected.every((item) => item.status === "completed") ? "completed" : "planned", ids)
    }

    const used = new Set(unavailable)
    const results = rule.rules.map((child) => {
      const result = evaluate(child, used)
      if (!input.allowDoubleCount) result.contributingCourseIds.forEach((id) => used.add(id))
      return result
    })
    const ids = results.flatMap((item) => item.contributingCourseIds)
    if (results.some((item) => item.status === "missing")) return base("missing", ids)
    if (results.some((item) => item.status === "manual_review")) return base("manual_review", ids)
    return base(results.every((item) => item.status === "completed") ? "completed" : "planned", ids)
  }

  return evaluate(input.rule)
}
