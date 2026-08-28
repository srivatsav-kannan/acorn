import { assertSafeExternalUrl } from "@/domain/security"
import type { Catalog, Course, Program, ReferenceOverlay, RequirementRule, Section, WorkspaceState } from "@/domain/types"

// The institutional catalog is shared and read-only. A workspace can carry its
// own reference overlay: courses and sections an agent or student added with a
// source, for gaps the shipped pack does not cover. Overlay entries win on ID
// collisions so a corrected record replaces a stale shipped one.

export const emptyOverlay = (): ReferenceOverlay => ({ courses: [], sections: [] })

export const workspaceOverlay = (workspace: WorkspaceState): ReferenceOverlay => workspace.referenceOverlay ?? emptyOverlay()

export const isOverlayCourse = (workspace: WorkspaceState, courseId: string) => workspaceOverlay(workspace).courses.some((course) => course.id === courseId)

export const mergeCatalog = (base: Catalog, overlay: ReferenceOverlay | undefined): Catalog => {
  if (!overlay || (overlay.courses.length === 0 && overlay.sections.length === 0)) return base
  const overlayCourseIds = new Set(overlay.courses.map((course) => course.id))
  const overlaySectionIds = new Set(overlay.sections.map((section) => section.id))
  return {
    courses: [...base.courses.filter((course) => !overlayCourseIds.has(course.id)), ...overlay.courses],
    sections: [...base.sections.filter((section) => !overlaySectionIds.has(section.id)), ...overlay.sections]
  }
}

export const mergedCatalogFor = (workspace: WorkspaceState, base: Catalog): Catalog => mergeCatalog(base, workspace.referenceOverlay)

const requireText = (value: unknown, field: string, max = 200): string => {
  const text = String(value ?? "").trim()
  if (!text) throw new Error(`A reference course needs a ${field}`)
  return text.slice(0, max)
}

export const validateOverlayCourse = (input: Record<string, unknown>): Course => {
  const code = requireText(input.code, "course code", 20)
  const id = requireText(input.id ?? `COURSE-${code.replaceAll(" ", "-").replaceAll("&", "AND")}`, "stable ID", 60)
  if (!/^[A-Z][A-Z0-9-]+$/.test(id)) throw new Error("A reference course ID must be an uppercase stable identifier")
  const minUnits = Number(input.minUnits ?? input.units ?? 0)
  const maxUnits = Number(input.maxUnits ?? input.units ?? minUnits)
  if (!Number.isFinite(minUnits) || minUnits < 0 || minUnits > 20 || maxUnits < minUnits || maxUnits > 20) throw new Error("Reference course units must be between 0 and 20")
  return {
    id,
    code,
    title: requireText(input.title, "title", 160),
    description: String(input.description ?? "").trim().slice(0, 600),
    subject: requireText(input.subject ?? code.split(" ")[0], "subject", 20),
    level: Number.isFinite(Number(input.level)) ? Number(input.level) : 100,
    minUnits,
    maxUnits,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).slice(0, 30)).slice(0, 8) : [],
    sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl : undefined,
    catalogYear: typeof input.catalogYear === "string" ? input.catalogYear : undefined,
    prerequisites: Array.isArray(input.prerequisites) ? input.prerequisites.map((item) => String(item)).slice(0, 12) : undefined,
    prerequisiteUncertain: input.prerequisiteUncertain === true ? true : undefined
  }
}

const ruleTypes = new Set(["course", "any_of", "all_of", "choose_n", "course_group", "minimum_units", "minimum_grade", "residency", "manual_review"])

export const validateRequirementRule = (input: Record<string, unknown>, budget = { rules: 0 }, depth = 0): RequirementRule => {
  budget.rules += 1
  if (budget.rules > 60) throw new Error("A program can hold at most 60 requirement rules")
  if (depth > 4) throw new Error("Requirement rules can nest at most five levels")
  const type = String(input.type ?? "")
  if (!ruleTypes.has(type)) throw new Error(`Unsupported requirement rule type: ${type || "missing"}`)
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim().slice(0, 80) : undefined
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : undefined
  const courseIdList = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`A ${type} rule needs a course list`)
    return value.map((item) => requireText(item, "course ID", 60)).slice(0, 40)
  }
  const childRules = (value: unknown): RequirementRule[] => {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`A ${type} rule needs child rules`)
    return value.map((item) => validateRequirementRule(item as Record<string, unknown>, budget, depth + 1))
  }
  const count = (value: unknown): number => {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) throw new Error(`A ${type} rule needs a count between 1 and 30`)
    return parsed
  }
  if (type === "course") return { id, title, type, courseId: requireText(input.courseId, "course ID", 60) }
  if (type === "manual_review") return { id, title, type, reason: requireText(input.reason, "manual review reason", 300) }
  if (type === "course_group") return { id, title, type, count: count(input.count), courseIds: courseIdList(input.courseIds) }
  if (type === "minimum_units") {
    const units = Number(input.units)
    if (!Number.isInteger(units) || units < 1 || units > 200) throw new Error("A minimum_units rule needs units between 1 and 200")
    return { id, title, type, units, courseIds: courseIdList(input.courseIds) }
  }
  if (type === "minimum_grade") return { id, title, type, courseId: requireText(input.courseId, "course ID", 60), grade: requireText(input.grade, "grade", 4) }
  if (type === "residency") return { id, title, type, count: count(input.count), courseIds: courseIdList(input.courseIds) }
  if (type === "choose_n") return { id, title, type, count: count(input.count), rules: childRules(input.rules) }
  return { id, title, type: type as "any_of" | "all_of", rules: childRules(input.rules) }
}

export const validateReferenceProgram = (input: Record<string, unknown>, evidenceId: string): Program => {
  const name = requireText(input.name, "program name", 120)
  const id = requireText(input.id ?? `PROGRAM-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`, "stable program ID", 80)
  if (!/^[A-Z][A-Z0-9-]+$/.test(id)) throw new Error("A reference program ID must be an uppercase stable identifier")
  const sourceUrl = requireText(input.sourceUrl, "official source URL", 300)
  assertSafeExternalUrl(sourceUrl)
  if (!Array.isArray(input.requirements) || input.requirements.length === 0) throw new Error("A reference program needs at least one requirement")
  if (input.requirements.length > 24) throw new Error("A reference program supports at most 24 requirements")
  const budget = { rules: 0 }
  const requirements = input.requirements.map((raw, index) => {
    const item = raw as Record<string, unknown>
    const title = requireText(item.title, "requirement title", 140)
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 80) : `REQUIREMENT-${id.replace(/^PROGRAM-/, "")}-${index + 1}`,
      title,
      rule: validateRequirementRule((item.rule ?? {}) as Record<string, unknown>, budget),
      evidenceIds: [evidenceId]
    }
  })
  return {
    id,
    name,
    credential: requireText(input.credential ?? "Program", "credential", 60),
    catalogYear: requireText(input.catalogYear ?? "Current", "catalog year", 20),
    sourceUrl,
    summary: typeof input.summary === "string" && input.summary.trim() ? input.summary.trim().slice(0, 400) : undefined,
    requirements
  }
}

export const validateOverlaySection = (input: Record<string, unknown>, courseId: string, termId: string, evidenceId: string): Section => {
  const meetings = Array.isArray(input.meetings) ? input.meetings : []
  if (meetings.length === 0) throw new Error("A reference section needs at least one meeting")
  const days = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
  const parsed = meetings.slice(0, 6).map((raw) => {
    const item = raw as Record<string, unknown>
    const meetingDays = Array.isArray(item.days) ? item.days.map((day) => String(day)).filter((day) => days.has(day)) : []
    const start = String(item.start ?? "")
    const end = String(item.end ?? "")
    if (meetingDays.length === 0 || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) throw new Error("Each meeting needs valid days and a start before its end, as HH:MM")
    return {
      days: meetingDays as Section["meetings"][number]["days"],
      start,
      end,
      timezone: typeof item.timezone === "string" ? item.timezone : "America/Los_Angeles",
      type: (["lecture", "section", "lab", "seminar"].includes(String(item.type)) ? item.type : "lecture") as Section["meetings"][number]["type"],
      location: typeof item.location === "string" ? item.location.slice(0, 80) : undefined
    }
  })
  const units = Number(input.units ?? 0)
  if (!Number.isFinite(units) || units < 0 || units > 20) throw new Error("Reference section units must be between 0 and 20")
  return {
    id: requireText(input.id ?? `SECTION-${courseId.replace(/^COURSE-/, "")}-A1`, "section ID", 70),
    courseId,
    termId,
    sectionNumber: String(input.sectionNumber ?? "01").slice(0, 6),
    instructor: String(input.instructor ?? "See official listing").slice(0, 80),
    units,
    meetings: parsed,
    evidenceIds: [evidenceId]
  }
}
