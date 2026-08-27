import type { Catalog, Course, Day, Section, WorkspaceState } from "@/domain/types"

export type CourseSearchFilters = {
  query: string
  termId?: string
  minUnits?: number
  maxUnits?: number
  excludedDays?: Day[]
  earliestStart?: string
  latestEnd?: string
  subjects?: string[]
  levels?: number[]
}

export type CourseSearchResult = { course: Course, sections: Section[], score: number }

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

export const searchCourses = (catalog: Catalog, filters: CourseSearchFilters): CourseSearchResult[] => {
  const query = normalize(filters.query)
  const results = catalog.courses.map((course) => {
    const sections = catalog.sections.filter((section) => section.courseId === course.id)
      .filter((section) => !filters.termId || section.termId === filters.termId)
      .filter((section) => filters.minUnits === undefined || section.units >= filters.minUnits)
      .filter((section) => filters.maxUnits === undefined || section.units <= filters.maxUnits)
      .filter((section) => !filters.excludedDays?.some((day) => section.meetings.some((item) => item.days.includes(day))))
      .filter((section) => !filters.earliestStart || section.meetings.every((item) => item.start >= filters.earliestStart!))
      .filter((section) => !filters.latestEnd || section.meetings.every((item) => item.end <= filters.latestEnd!))
    const code = normalize(course.code)
    const text = normalize(`${course.code} ${course.title} ${course.description} ${course.tags.join(" ")}`)
    let score = query === code && query ? 1000 : code.startsWith(query) && query ? 700 : text.includes(query) && query ? 300 : query ? 0 : 100
    if (filters.subjects && !filters.subjects.includes(course.subject)) score = 0
    if (filters.levels && !filters.levels.includes(course.level)) score = 0
    if ((filters.termId || filters.minUnits !== undefined || filters.maxUnits !== undefined || filters.excludedDays || filters.earliestStart || filters.latestEnd) && sections.length === 0) score = 0
    return { course, sections, score }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.course.code.localeCompare(b.course.code))
  return query && results.some((item) => normalize(item.course.code) === query) ? results.filter((item) => normalize(item.course.code) === query) : results
}

export const searchWorkspace = (workspace: WorkspaceState, catalog: Catalog, query: string) => {
  const normalized = query.toLowerCase().trim()
  const tokens = normalized.split(/[^a-z0-9]+/).filter((token) => token.length > 2)
  const matches = (value: string) => {
    const text = value.toLowerCase()
    return Boolean(normalized && text.includes(normalized)) || tokens.some((token) => text.includes(token))
  }
  const groups: Array<{ type: string, items: Array<{ id: string, title: string, summary: string }> }> = []
  const library = workspace.contextItems.filter((item) => !item.archived && matches(`${item.title} ${item.summary} ${JSON.stringify(item.content)}`))
  const people = library.filter((item) => item.type === "person")
  const otherContext = library.filter((item) => item.type !== "person")
  if (people.length) groups.push({ type: "people", items: people.map((item) => ({ id: item.id, title: item.title, summary: item.summary })) })
  if (otherContext.length) groups.push({ type: "library", items: otherContext.map((item) => ({ id: item.id, title: item.title, summary: item.summary })) })
  const referencedEvidenceIds = new Set(workspace.contextItems.flatMap((item) => item.sourceEvidenceIds ?? []))
  const orphanedEvidence = workspace.evidence.filter((item) => !referencedEvidenceIds.has(item.id) && matches(`${item.title ?? ""} ${item.claim} ${item.sourceTitle}`))
  if (orphanedEvidence.length) groups.push({ type: "sources", items: orphanedEvidence.map((item) => ({ id: item.id, title: item.title || item.sourceTitle, summary: item.claim })) })
  const courses = searchCourses(catalog, { query }).slice(0, 6)
  if (courses.length) groups.push({ type: "courses", items: courses.map(({ course }) => ({ id: course.id, title: `${course.code} · ${course.title}`, summary: course.description })) })
  const programs = workspace.programs.filter((program) => matches(`${program.name} ${program.credential}`))
  if (programs.length) groups.push({ type: "programs", items: programs.map((program) => ({ id: program.id, title: program.name, summary: program.credential })) })
  const total = groups.reduce((sum, group) => sum + group.items.length, 0)
  return {
    query,
    sufficient: total > 0,
    groups,
    gaps: total > 0 ? [] : [`No durable workspace context strongly matches “${query}”.`]
  }
}
