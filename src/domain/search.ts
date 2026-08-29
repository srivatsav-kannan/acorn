import type { Catalog, Course, Day, Opportunity, Section, WorkspaceState } from "@/domain/types"

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
  const sectionsByCourse = new Map<string, Section[]>()
  for (const section of catalog.sections) {
    const list = sectionsByCourse.get(section.courseId)
    if (list) list.push(section)
    else sectionsByCourse.set(section.courseId, [section])
  }
  const results = catalog.courses.map((course) => {
    const termSections = (sectionsByCourse.get(course.id) ?? []).filter((section) => !filters.termId || section.termId === filters.termId)
    const sections = termSections
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
    // A course with stored sections must keep at least one that fits the
    // constraints. A course with no stored schedule stays visible as unknown.
    if (termSections.length > 0 && sections.length === 0) score = 0
    return { course, sections, score }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.course.code.localeCompare(b.course.code))
  return query && results.some((item) => normalize(item.course.code) === query) ? results.filter((item) => normalize(item.course.code) === query) : results
}

export const searchWorkspace = (workspace: WorkspaceState, catalog: Catalog, query: string, opportunities: Opportunity[] = []) => {
  const normalized = query.toLowerCase().trim()
  const tokens = normalized.split(/[^a-z0-9]+/).filter((token) => token.length > 2)
  const matches = (value: string) => {
    const text = value.toLowerCase()
    return Boolean(normalized && text.includes(normalized)) || tokens.some((token) => text.includes(token))
  }
  const brief = (value: string) => value.length > 110 ? `${value.slice(0, 109).trimEnd()}…` : value
  const groups: Array<{ type: string, items: Array<{ id: string, title: string, summary: string }> }> = []
  const library = workspace.contextItems.filter((item) => !item.archived && matches(`${item.title} ${item.summary} ${JSON.stringify(item.content)}`))
  const people = library.filter((item) => item.type === "person")
  const otherContext = library.filter((item) => item.type !== "person")
  if (people.length) groups.push({ type: "people", items: people.slice(0, 6).map((item) => ({ id: item.id, title: item.title, summary: brief(item.summary) })) })
  if (otherContext.length) groups.push({ type: "library", items: otherContext.slice(0, 6).map((item) => ({ id: item.id, title: item.title, summary: brief(item.summary), url: (item.content as { sourceUrl?: string } | undefined)?.sourceUrl })) })
  const referencedEvidenceIds = new Set(workspace.contextItems.flatMap((item) => item.sourceEvidenceIds ?? []))
  const orphanedEvidence = workspace.evidence.filter((item) => !referencedEvidenceIds.has(item.id) && matches(`${item.title ?? ""} ${item.claim} ${item.sourceTitle}`))
  if (orphanedEvidence.length) groups.push({ type: "sources", items: orphanedEvidence.slice(0, 6).map((item) => ({ id: item.id, title: item.title || item.sourceTitle, summary: brief(item.claim), url: item.sourceUrl })) })
  const courses = searchCourses(catalog, { query }).slice(0, 5)
  if (courses.length) groups.push({ type: "courses", items: courses.map(({ course }) => ({ id: course.id, title: `${course.code} · ${course.title}`, summary: brief(course.description) })) })
  const programs = workspace.programs.filter((program) => matches(`${program.name} ${program.credential}`))
  if (programs.length) groups.push({ type: "programs", items: programs.slice(0, 6).map((program) => ({ id: program.id, title: program.name, summary: program.credential })) })
  const matchedOpportunities = opportunities.filter((item) => matches(`${item.name} ${item.summary} ${item.tags.join(" ")}`))
  if (matchedOpportunities.length) groups.push({ type: "opportunities", items: matchedOpportunities.slice(0, 6).map((item) => ({ id: item.id, title: item.name, summary: brief(item.summary) })) })
  // Sufficiency means the saved workspace can answer this question, so only
  // durable context counts toward it. Catalog courses and the opportunity
  // directory match almost any academic phrase and used to mask real gaps.
  const durableTypes = new Set(["people", "library", "sources", "programs"])
  const durableTotal = groups.filter((group) => durableTypes.has(group.type)).reduce((sum, group) => sum + group.items.length, 0)
  const programSeeking = /\b(program|degree|major|minor|master|masters|ms|mscs|phd|coterm|coterminal|requirements?)\b/.test(normalized)
  const gaps: string[] = []
  if (durableTotal === 0) gaps.push(`No durable workspace context strongly matches “${query}”. Research it and save the findings with save_research.`)
  if (programSeeking && !groups.some((group) => group.type === "programs")) gaps.push(`No program reference in this workspace matches “${query}”. If the program is real, add it with extend_reference from an official source.`)
  // A query naming an exact course code that the catalog does not carry is a
  // reference gap even when looser matches pad the result groups.
  const catalogCodes = new Set(catalog.courses.map((course) => normalize(course.code)))
  const subjects = new Set(catalog.courses.map((course) => course.code.split(" ")[0].toUpperCase()))
  const missingCodes = new Set<string>()
  for (const match of query.matchAll(/([A-Za-z][A-Za-z&]{1,6})\s*-?\s*(\d{1,3}[A-Za-z]{0,2})\b/g)) {
    const subject = match[1].toUpperCase()
    if (!subjects.has(subject)) continue
    const codeText = `${subject} ${match[2].toUpperCase()}`
    if (!catalogCodes.has(normalize(codeText))) missingCodes.add(codeText)
  }
  for (const code of [...missingCodes].slice(0, 2)) gaps.push(`No catalog course matches ${code}. If it is real, add it with extend_reference from an official source.`)
  // Club and organization questions padded with note matches used to claim
  // sufficiency while the directory had nothing; name that gap.
  const orgSeeking = /\b(club|clubs|association|intramural|hackathon|society|fraternity|sorority)\b/.test(normalized)
  if (orgSeeking && !groups.some((group) => group.type === "opportunities")) gaps.push(`No club or program listing matches “${query}”. If it exists, add it with extend_reference as an opportunity, with an official source.`)
  return {
    query,
    sufficient: gaps.length === 0,
    groups,
    gaps
  }
}
