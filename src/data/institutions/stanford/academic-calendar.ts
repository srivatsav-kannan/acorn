import type { Season } from "@/domain/planning/timeline"

// Stanford academic calendar dates the planner and calendar rely on.
// 2026-27 is transcribed from the registrar's published calendar
// (studentservices.stanford.edu, retrieved August 28, 2026). Years without a
// published calendar are projected from the registrar's recurring patterns
// and carry projected: true so the interface and agents can say so.

export type AcademicDateKind = "milestone" | "holiday" | "deadline" | "exams" | "break"

export type AcademicDate = {
  date: string
  endDate?: string
  label: string
  kind: AcademicDateKind
  season: Season
  noClasses?: boolean
  projected?: boolean
}

const OFFICIAL_2026: AcademicDate[] = [
  { date: "2026-09-15", label: "New undergraduates arrive; New Student Orientation begins; Convocation", kind: "milestone", season: "AUTUMN", noClasses: true },
  { date: "2026-09-21", label: "Yom Kippur (no classes)", kind: "holiday", season: "AUTUMN", noClasses: true },
  { date: "2026-09-22", label: "Autumn quarter begins; instruction begins", kind: "milestone", season: "AUTUMN" },
  { date: "2026-09-22", label: "Preliminary Study List deadline, 5 p.m.", kind: "deadline", season: "AUTUMN" },
  { date: "2026-10-09", label: "Final Study List deadline; last day to add or drop", kind: "deadline", season: "AUTUMN" },
  { date: "2026-11-03", label: "Democracy Day: day of civic service (no classes)", kind: "holiday", season: "AUTUMN", noClasses: true },
  { date: "2026-11-13", label: "Course withdrawal and grading basis deadline", kind: "deadline", season: "AUTUMN" },
  { date: "2026-11-23", endDate: "2026-11-27", label: "Thanksgiving Recess (no classes)", kind: "break", season: "AUTUMN", noClasses: true },
  { date: "2026-12-04", label: "Last day of Autumn classes", kind: "milestone", season: "AUTUMN" },
  { date: "2026-12-07", endDate: "2026-12-11", label: "Autumn end-quarter examinations", kind: "exams", season: "AUTUMN" },
  { date: "2026-12-12", label: "Undergraduate housing closes for Winter Break", kind: "milestone", season: "AUTUMN" },
  { date: "2026-12-19", endDate: "2027-01-03", label: "Winter Closure: the University is closed", kind: "break", season: "WINTER", noClasses: true },
  { date: "2027-01-04", label: "Winter quarter begins; instruction begins", kind: "milestone", season: "WINTER" },
  { date: "2027-01-04", label: "Preliminary Study List deadline, 5 p.m.", kind: "deadline", season: "WINTER" },
  { date: "2027-01-18", label: "Martin Luther King, Jr., Day (no classes)", kind: "holiday", season: "WINTER", noClasses: true },
  { date: "2027-01-22", label: "Final Study List deadline; last day to add or drop", kind: "deadline", season: "WINTER" },
  { date: "2027-02-15", label: "Presidents' Day (no classes)", kind: "holiday", season: "WINTER", noClasses: true },
  { date: "2027-02-26", label: "Course withdrawal and grading basis deadline", kind: "deadline", season: "WINTER" },
  { date: "2027-03-12", label: "Last day of Winter classes", kind: "milestone", season: "WINTER" },
  { date: "2027-03-15", endDate: "2027-03-19", label: "Winter end-quarter examinations", kind: "exams", season: "WINTER" },
  { date: "2027-03-20", endDate: "2027-03-28", label: "Spring break", kind: "break", season: "SPRING", noClasses: true },
  { date: "2027-03-29", label: "Spring quarter begins; instruction begins", kind: "milestone", season: "SPRING" },
  { date: "2027-03-29", label: "Preliminary Study List deadline, 5 p.m.", kind: "deadline", season: "SPRING" },
  { date: "2027-04-16", label: "Final Study List deadline; last day to add or drop", kind: "deadline", season: "SPRING" },
  { date: "2027-05-21", label: "Course withdrawal and grading basis deadline", kind: "deadline", season: "SPRING" },
  { date: "2027-05-31", label: "Memorial Day (no classes)", kind: "holiday", season: "SPRING", noClasses: true },
  { date: "2027-06-02", label: "Last day of Spring classes", kind: "milestone", season: "SPRING" },
  { date: "2027-06-03", label: "Day before finals (no classes)", kind: "milestone", season: "SPRING", noClasses: true },
  { date: "2027-06-04", endDate: "2027-06-09", label: "Spring end-quarter examinations", kind: "exams", season: "SPRING" },
  { date: "2027-06-13", label: "Commencement", kind: "milestone", season: "SPRING" },
  { date: "2027-06-21", label: "Summer quarter begins; instruction begins", kind: "milestone", season: "SUMMER" },
  { date: "2027-07-05", label: "Independence Day holiday (no classes)", kind: "holiday", season: "SUMMER", noClasses: true },
  { date: "2027-08-12", label: "Last day of Summer classes", kind: "milestone", season: "SUMMER" },
  { date: "2027-08-13", endDate: "2027-08-14", label: "Summer end-quarter examinations", kind: "exams", season: "SUMMER" }
]

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const make = (year: number, month: number, day: number) => new Date(year, month - 1, day)
const shifted = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

// Weekday helpers for projections. weekday: 0 Sunday through 6 Saturday.
const onOrAfter = (start: Date, weekday: number) => shifted(start, (weekday - start.getDay() + 7) % 7)
const nthWeekdayOfMonth = (year: number, month: number, weekday: number, nth: number) => shifted(onOrAfter(make(year, month, 1), weekday), (nth - 1) * 7)
const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
  const last = make(year, month + 1, 0)
  return shifted(last, -((last.getDay() - weekday + 7) % 7))
}

// The registrar's recurring shape: autumn instruction begins on a Tuesday in
// the back half of September, winter on the first working Monday of January,
// spring on the Monday about a week after winter finals, and summer near the
// third Monday of June. Projected years follow that shape.
const projectedYear = (academicYearStart: number): AcademicDate[] => {
  const y = academicYearStart
  const autumnStart = onOrAfter(make(y, 9, 20), 2)
  const nso = shifted(autumnStart, -7)
  const autumnLast = onOrAfter(make(y, 12, 3), 5)
  const autumnExams = onOrAfter(shifted(autumnLast, 1), 1)
  const thanksgiving = nthWeekdayOfMonth(y, 11, 4, 4)
  const winterStart = onOrAfter(make(y + 1, 1, 2), 1)
  const winterLast = onOrAfter(make(y + 1, 3, 10), 5)
  const winterExams = onOrAfter(shifted(winterLast, 1), 1)
  const springStart = onOrAfter(shifted(shifted(winterExams, 4), 1), 1)
  const springLast = onOrAfter(make(y + 1, 6, 1), 3)
  const springExams = shifted(springLast, 2)
  const commencement = onOrAfter(shifted(springExams, 5), 0)
  const summerStart = onOrAfter(make(y + 1, 6, 18), 1)
  const summerLast = onOrAfter(make(y + 1, 8, 10), 4)
  const project = (date: Date, label: string, kind: AcademicDateKind, season: Season, endDate?: Date, noClasses?: boolean): AcademicDate => ({ date: iso(date), endDate: endDate ? iso(endDate) : undefined, label, kind, season, noClasses, projected: true })
  return [
    project(nso, "New Student Orientation begins (projected)", "milestone", "AUTUMN", undefined, true),
    project(autumnStart, "Autumn quarter begins (projected)", "milestone", "AUTUMN"),
    project(thanksgiving && shifted(thanksgiving, -3), "Thanksgiving Recess (projected)", "break", "AUTUMN", shifted(thanksgiving, 1), true),
    project(autumnLast, "Last day of Autumn classes (projected)", "milestone", "AUTUMN"),
    project(autumnExams, "Autumn end-quarter examinations (projected)", "exams", "AUTUMN", shifted(autumnExams, 4)),
    project(make(y, 12, 19), "Winter Closure (projected)", "break", "WINTER", make(y + 1, 1, 3), true),
    project(winterStart, "Winter quarter begins (projected)", "milestone", "WINTER"),
    project(nthWeekdayOfMonth(y + 1, 1, 1, 3), "Martin Luther King, Jr., Day (projected)", "holiday", "WINTER", undefined, true),
    project(nthWeekdayOfMonth(y + 1, 2, 1, 3), "Presidents' Day (projected)", "holiday", "WINTER", undefined, true),
    project(winterLast, "Last day of Winter classes (projected)", "milestone", "WINTER"),
    project(winterExams, "Winter end-quarter examinations (projected)", "exams", "WINTER", shifted(winterExams, 4)),
    project(shifted(springStart, -8), "Spring break (projected)", "break", "SPRING", shifted(springStart, -1), true),
    project(springStart, "Spring quarter begins (projected)", "milestone", "SPRING"),
    project(lastWeekdayOfMonth(y + 1, 5, 1), "Memorial Day (projected)", "holiday", "SPRING", undefined, true),
    project(springLast, "Last day of Spring classes (projected)", "milestone", "SPRING"),
    project(springExams, "Spring end-quarter examinations (projected)", "exams", "SPRING", shifted(springExams, 5)),
    project(commencement, "Commencement (projected)", "milestone", "SPRING"),
    project(summerStart, "Summer quarter begins (projected)", "milestone", "SUMMER"),
    project(summerLast, "Last day of Summer classes (projected)", "milestone", "SUMMER")
  ]
}

export const academicYearDates = (academicYearStart: number): AcademicDate[] =>
  academicYearStart === 2026 ? OFFICIAL_2026 : projectedYear(academicYearStart)

export const academicDatesBetween = (firstYearStart: number, lastYearStart: number): AcademicDate[] => {
  const all: AcademicDate[] = []
  for (let year = firstYearStart; year <= lastYearStart; year += 1) all.push(...academicYearDates(year))
  return all.sort((a, b) => a.date.localeCompare(b.date))
}

// The span in which a quarter's classes actually meet, used to place course
// meetings on real calendar days.
export const quarterClassRange = (academicYearStart: number, season: Season): { start: string, end: string, projected: boolean } | null => {
  const dates = academicYearDates(academicYearStart)
  const begins = dates.find((item) => item.season === season && item.kind === "milestone" && item.label.includes("quarter begins"))
  const last = dates.find((item) => item.season === season && item.kind === "milestone" && item.label.includes("Last day of"))
  if (!begins || !last) return null
  return { start: begins.date, end: last.date, projected: Boolean(begins.projected || last.projected) }
}

// Days with no classes inside a quarter (holidays, recesses), so recurring
// meetings skip them.
export const noClassDates = (academicYearStart: number): Array<{ start: string, end: string }> =>
  academicYearDates(academicYearStart).filter((item) => item.noClasses).map((item) => ({ start: item.date, end: item.endDate ?? item.date }))
