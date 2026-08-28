import type { StudentProfile, WorkspaceState } from "@/domain/types"

// The degree timeline is deterministic term arithmetic the application owns.
// Quarter identity, ordering, academic years, standing, and units-to-degree
// math never depend on model judgment, so every agent and every page reads the
// same answers. Term IDs follow TERM-<calendar year>-<SEASON>.

export type Season = "AUTUMN" | "WINTER" | "SPRING" | "SUMMER"

export type TermRef = {
  id: string
  year: number
  season: Season
  academicYearStart: number
  index: number
}

export type DegreeTimeline = {
  entryTermId: string
  expectedGraduationTermId: string
  degree: string
}

const seasonOrder: Record<Season, number> = { AUTUMN: 0, WINTER: 1, SPRING: 2, SUMMER: 3 }
const seasons: Season[] = ["AUTUMN", "WINTER", "SPRING", "SUMMER"]

export const parseTermId = (termId: string): TermRef | null => {
  const match = /^TERM-(\d{4})-(AUTUMN|WINTER|SPRING|SUMMER)$/.exec(termId)
  if (!match) return null
  const year = Number(match[1])
  const season = match[2] as Season
  const academicYearStart = season === "AUTUMN" ? year : year - 1
  return { id: termId, year, season, academicYearStart, index: academicYearStart * 4 + seasonOrder[season] }
}

export const termId = (year: number, season: Season) => `TERM-${year}-${season}`

export const termLabel = (idOrRef: string | TermRef): string => {
  const ref = typeof idOrRef === "string" ? parseTermId(idOrRef) : idOrRef
  if (!ref) return typeof idOrRef === "string" ? idOrRef.replace(/^TERM-/, "").replaceAll("-", " ").toLowerCase() : ""
  return `${ref.season[0]}${ref.season.slice(1).toLowerCase()} ${ref.year}`
}

export const academicYearLabel = (idOrRef: string | TermRef): string => {
  const ref = typeof idOrRef === "string" ? parseTermId(idOrRef) : idOrRef
  if (!ref) return ""
  return `${ref.academicYearStart}-${String((ref.academicYearStart + 1) % 100).padStart(2, "0")}`
}

export const compareTerms = (a: string, b: string): number => {
  const left = parseTermId(a)
  const right = parseTermId(b)
  if (!left || !right) return 0
  return left.index - right.index
}

export const nextTerm = (idOrRef: string | TermRef, includeSummer = false): TermRef => {
  const ref = typeof idOrRef === "string" ? parseTermId(idOrRef) : idOrRef
  if (!ref) throw new Error(`Unrecognized term ID: ${String(idOrRef)}`)
  let order = seasonOrder[ref.season] + 1
  if (!includeSummer && order === seasonOrder.SUMMER) order += 1
  const rolled = order > 3
  const season = seasons[rolled ? 0 : order]
  const academicYearStart = rolled ? ref.academicYearStart + 1 : ref.academicYearStart
  const year = season === "AUTUMN" ? academicYearStart : academicYearStart + 1
  return parseTermId(termId(year, season))!
}

export const termSequence = (entryTermId: string, endTermId: string, includeSummer = false): TermRef[] => {
  const start = parseTermId(entryTermId)
  const end = parseTermId(endTermId)
  if (!start || !end || end.index < start.index) return start ? [start] : []
  const sequence: TermRef[] = []
  let cursor = start
  while (cursor.index <= end.index && sequence.length < 40) {
    if (includeSummer || cursor.season !== "SUMMER") sequence.push(cursor)
    cursor = nextTerm(cursor, true)
  }
  return sequence
}

// Sep-Dec is Autumn, Jan-Mar Winter, Apr-Jun Spring, Jul-Aug Summer.
export const termForDate = (date: Date): TermRef => {
  const month = date.getMonth()
  const year = date.getFullYear()
  if (month >= 8) return parseTermId(termId(year, "AUTUMN"))!
  if (month <= 2) return parseTermId(termId(year, "WINTER"))!
  if (month <= 5) return parseTermId(termId(year, "SPRING"))!
  return parseTermId(termId(year, "SUMMER"))!
}

export const termStatus = (target: string, now: Date): "past" | "current" | "future" => {
  const ref = parseTermId(target)
  if (!ref) return "future"
  const current = termForDate(now)
  if (ref.index < current.index) return "past"
  if (ref.index > current.index) return "future"
  return "current"
}

export const degreeOptions = [
  { id: "BS", label: "BS", years: 4 },
  { id: "BA", label: "BA", years: 4 },
  { id: "BS-MS", label: "BS with coterminal MS", years: 5 },
  { id: "BA-MS", label: "BA with coterminal MS", years: 5 }
] as const

export const isCoterm = (degree: string) => degree.includes("MS")

// 180 units complete a Stanford bachelor's degree. A coterminal master's adds
// 45 graduate units on top of it.
export const unitsRequired = (degree: string) => isCoterm(degree) ? 225 : 180

export const defaultGraduationTerm = (entryTermId: string, degree: string): string => {
  const entry = parseTermId(entryTermId)
  if (!entry) return entryTermId
  const years = degreeOptions.find((option) => option.id === degree)?.years ?? (isCoterm(degree) ? 5 : 4)
  return termId(entry.academicYearStart + years, "SPRING")
}

export const defaultTimeline = (now: Date, degree = "BS"): DegreeTimeline => {
  const current = termForDate(now)
  const entry = termId(current.academicYearStart, "AUTUMN")
  return { entryTermId: entry, expectedGraduationTermId: defaultGraduationTerm(entry, degree), degree }
}

export const timelineFor = (profile: StudentProfile, now: Date): DegreeTimeline =>
  profile.timeline ?? defaultTimeline(now)

export const standingForTerm = (timeline: DegreeTimeline, target: string): string => {
  const entry = parseTermId(timeline.entryTermId)
  const ref = parseTermId(target)
  if (!entry || !ref) return ""
  const year = ref.academicYearStart - entry.academicYearStart + 1
  if (year <= 0) return "Before entry"
  const names = ["Frosh", "Sophomore", "Junior", "Senior", "Fifth year"]
  return names[Math.min(year, 5) - 1]
}

export const supportsTimeline = (workspace: Pick<WorkspaceState, "currentTermId">) => parseTermId(workspace.currentTermId) !== null
