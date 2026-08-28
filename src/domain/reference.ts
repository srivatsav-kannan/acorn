import type { Catalog, Course, ReferenceOverlay, Section, WorkspaceState } from "@/domain/types"

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
