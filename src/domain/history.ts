import { compareTerms, defaultGraduationTerm, parseTermId } from "@/domain/timeline"
import type { ApCredit, StudentProfile } from "@/domain/types"

// Academic history is structured context: completed courses, AP and transfer
// credit, and class standing. Both the student and an agent write it through
// the same command, and requirement evaluation reads one merged view so an AP
// equivalency counts exactly like a completed course.

export const effectiveCompletedCourseIds = (profile: StudentProfile): string[] =>
  [...new Set([...profile.completedCourseIds, ...(profile.apCredits ?? []).flatMap((credit) => credit.satisfiesCourseIds ?? [])])]

const requireText = (value: unknown, field: string, max = 120): string => {
  const text = String(value ?? "").trim()
  if (!text) throw new Error(`Academic history needs a ${field}`)
  return text.slice(0, max)
}

export const validateApCredit = (input: Record<string, unknown>): ApCredit => {
  const exam = requireText(input.exam, "named exam or credit source", 80)
  const id = String(input.id ?? `AP-${exam.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`).slice(0, 80)
  const credit: ApCredit = { id, exam }
  if (input.score !== undefined && input.score !== null && input.score !== "") {
    const score = Number(input.score)
    if (!Number.isFinite(score) || score < 1 || score > 5) throw new Error("An AP score must be between 1 and 5")
    credit.score = score
  }
  if (input.unitsGranted !== undefined && input.unitsGranted !== null && input.unitsGranted !== "") {
    const units = Number(input.unitsGranted)
    if (!Number.isFinite(units) || units < 0 || units > 45) throw new Error("Granted units must be between 0 and 45")
    credit.unitsGranted = units
  }
  if (Array.isArray(input.satisfiesCourseIds)) credit.satisfiesCourseIds = input.satisfiesCourseIds.map((item) => String(item)).filter(Boolean).slice(0, 8)
  if (typeof input.note === "string" && input.note.trim()) credit.note = input.note.trim().slice(0, 300)
  return credit
}

export type AcademicHistoryPatch = {
  classYear?: string
  completedCourses?: Array<{ courseId: string, grade?: string }>
  apCredits?: ApCredit[]
  timeline?: { entryTermId: string, expectedGraduationTermId: string, degree: string }
}

export const validateAcademicHistoryPatch = (input: Record<string, unknown>): AcademicHistoryPatch => {
  const patch: AcademicHistoryPatch = {}
  if (typeof input.classYear === "string") patch.classYear = input.classYear.trim().slice(0, 30)
  const timelineInput = input.timeline as Record<string, unknown> | undefined
  if (timelineInput && typeof timelineInput === "object") {
    const entryTermId = String(timelineInput.entryTermId ?? "")
    const degree = String(timelineInput.degree ?? "BS").trim().slice(0, 30) || "BS"
    if (!parseTermId(entryTermId)) throw new Error("The entry term must look like TERM-2026-AUTUMN")
    const expectedGraduationTermId = String(timelineInput.expectedGraduationTermId ?? "") || defaultGraduationTerm(entryTermId, degree)
    if (!parseTermId(expectedGraduationTermId)) throw new Error("The graduation term must look like TERM-2030-SPRING")
    if (compareTerms(expectedGraduationTermId, entryTermId) <= 0) throw new Error("Graduation must come after the entry term")
    patch.timeline = { entryTermId, expectedGraduationTermId, degree }
  }
  if (Array.isArray(input.completedCourses)) {
    if (input.completedCourses.length > 80) throw new Error("Academic history supports at most 80 completed courses")
    patch.completedCourses = input.completedCourses.map((raw) => {
      const item = raw as Record<string, unknown>
      const courseId = requireText(item.courseId, "course ID for each completed course", 60)
      const grade = typeof item.grade === "string" && item.grade.trim() ? item.grade.trim().slice(0, 4) : undefined
      return { courseId, grade }
    })
  }
  if (Array.isArray(input.apCredits)) {
    if (input.apCredits.length > 24) throw new Error("Academic history supports at most 24 AP or transfer credits")
    patch.apCredits = input.apCredits.map((item) => validateApCredit(item as Record<string, unknown>))
  }
  if (patch.classYear === undefined && !patch.completedCourses && !patch.apCredits && !patch.timeline) throw new Error("Academic history needs a class year, timeline, completed courses, or credits")
  return patch
}

export const applyAcademicHistory = (profile: StudentProfile, patch: AcademicHistoryPatch) => {
  if (patch.classYear !== undefined) profile.classYear = patch.classYear || undefined
  if (patch.timeline) profile.timeline = patch.timeline
  if (patch.completedCourses) {
    profile.completedCourseIds = [...new Set(patch.completedCourses.map((item) => item.courseId))]
    profile.courseGrades = Object.fromEntries(patch.completedCourses.filter((item) => item.grade).map((item) => [item.courseId, item.grade as string]))
    profile.residentCourseIds = profile.residentCourseIds.filter((id) => profile.completedCourseIds.includes(id))
  }
  if (patch.apCredits) profile.apCredits = patch.apCredits
}
