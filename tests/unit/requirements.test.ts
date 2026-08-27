import { describe, expect, it } from "vitest"
import { evaluateRequirement } from "@/domain/requirements"
import type { RequirementRule } from "@/domain/types"

const evaluate = (
  rule: RequirementRule,
  completed = ["COURSE-CS-106A"],
  planned = ["COURSE-CS-106B"]
) => evaluateRequirement({
  rule,
  completedCourseIds: completed,
  plannedCourseIds: planned,
  courseUnits: { "COURSE-CS-106A": 5, "COURSE-CS-106B": 5, "COURSE-MATH-51": 5 },
  courseGrades: { "COURSE-CS-106A": "A" },
  residentCourseIds: completed,
  allowDoubleCount: false
})

describe("requirement evaluator", () => {
  it.each([
    [{ type: "course", courseId: "COURSE-CS-106A" }, "completed"],
    [{ type: "course", courseId: "COURSE-CS-106B" }, "planned"],
    [{ type: "course", courseId: "COURSE-CS-999" }, "missing"],
    [{ type: "any_of", rules: [{ type: "course", courseId: "COURSE-CS-999" }, { type: "course", courseId: "COURSE-CS-106A" }] }, "completed"],
    [{ type: "all_of", rules: [{ type: "course", courseId: "COURSE-CS-106A" }, { type: "course", courseId: "COURSE-CS-106B" }] }, "planned"],
    [{ type: "choose_n", count: 2, rules: [{ type: "course", courseId: "COURSE-CS-106A" }, { type: "course", courseId: "COURSE-CS-106B" }, { type: "course", courseId: "COURSE-MATH-51" }] }, "planned"],
    [{ type: "course_group", courseIds: ["COURSE-CS-106A", "COURSE-MATH-51"], count: 1 }, "completed"],
    [{ type: "minimum_units", units: 10, courseIds: ["COURSE-CS-106A", "COURSE-CS-106B"] }, "planned"],
    [{ type: "minimum_grade", courseId: "COURSE-CS-106A", grade: "B" }, "completed"],
    [{ type: "residency", count: 1, courseIds: ["COURSE-CS-106A"] }, "completed"],
    [{ type: "manual_review", reason: "Advisor approval required" }, "manual_review"]
  ] satisfies Array<[RequirementRule, string]>)("evaluates %#", (rule, status) => {
    expect(evaluate(rule).status).toBe(status)
  })

  it("does not mark planned work as completed", () => {
    const result = evaluate({ type: "course", courseId: "COURSE-CS-106B" })
    expect(result.status).toBe("planned")
    expect(result.completedCourseIds).toEqual([])
  })

  it("includes source rule IDs and contributing courses", () => {
    const rule: RequirementRule = { id: "RULE-CORE", type: "course", courseId: "COURSE-CS-106A" }
    expect(evaluate(rule)).toMatchObject({
      ruleId: "RULE-CORE",
      contributingCourseIds: ["COURSE-CS-106A"]
    })
  })

  it("prevents the same course from satisfying two all-of children when double count is disabled", () => {
    const rule: RequirementRule = {
      type: "all_of",
      rules: [
        { type: "course_group", courseIds: ["COURSE-CS-106A"], count: 1 },
        { type: "course_group", courseIds: ["COURSE-CS-106A"], count: 1 }
      ]
    }
    expect(evaluate(rule, ["COURSE-CS-106A"], []).status).toBe("missing")
  })
})
