#!/usr/bin/env node
// Imports the Stanford catalog from the public ExploreCourses XML API.
//
// Outputs:
//   data/stanford/catalog-full.json          full fidelity, every department
//   src/data/institutions/stanford-catalog.json   trimmed build the app bundles
//
// Per-department XML responses are cached in scripts/import-stanford/.cache so
// an interrupted run resumes without refetching. Pass --refresh to refetch.

import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const cacheDir = join(root, "scripts", "import-stanford", ".cache")
const BASE = "https://explorecourses.stanford.edu"
const UA = { "User-Agent": "Mozilla/5.0 (CourseContext catalog importer; public data)" }
const refresh = process.argv.includes("--refresh")

// Departments whose descriptions and Autumn sections ship in the app bundle.
const DETAIL_DEPTS = new Set(["CS", "MATH", "STATS", "DATASCI", "EE", "CEE", "ME", "MS&E", "BIOE", "CHEMENG", "AA", "ENGR", "PHYSICS", "CHEM", "BIO", "HUMBIO", "PSYCH", "ECON", "POLISCI", "SOC", "COMM", "PHIL", "LINGUIST", "HISTORY", "ENGLISH", "SYMSYS", "INTLPOL", "PUBLPOL", "EDUC", "DESIGN", "ARTSTUDI", "MUSIC", "TAPS", "PWR", "COLLEGE", "THINK", "EARTHSYS", "BIOMEDIN", "AMSTUD", "CSRE", "FEMGEN", "URBANST"])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchText = async (url, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: UA })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      if (attempt === attempts) throw error
      await sleep(1200 * attempt)
    }
  }
}

const cached = async (name, url) => {
  const file = join(cacheDir, name)
  if (!refresh) {
    try { await access(file); return readFile(file, "utf8") } catch { /* fetch below */ }
  }
  const text = await fetchText(url)
  await writeFile(file, text)
  await sleep(250)
  return text
}

const decode = (value) => value
  .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&nbsp;", " ")
  .replace(/\s+/g, " ").trim()

const tag = (block, name) => {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)
  return match ? decode(match[1]) : ""
}

const dayMap = { Monday: "mon", Tuesday: "tue", Wednesday: "wed", Thursday: "thu", Friday: "fri", Saturday: "sat", Sunday: "sun" }

const toMinutesClock = (value) => {
  const match = /^(\d{1,2}):(\d{2}):\d{2} (AM|PM)$/.exec(value.trim())
  if (!match) return null
  let hours = Number(match[1]) % 12
  if (match[3] === "PM") hours += 12
  return `${String(hours).padStart(2, "0")}:${match[2]}`
}

const termIdFor = (term) => {
  const match = /^(\d{4})-\d{4} (Autumn|Winter|Spring|Summer)$/.exec(term)
  if (!match) return null
  const startYear = Number(match[1])
  const season = match[2].toUpperCase()
  const year = season === "AUTUMN" ? startYear : startYear + 1
  return `TERM-${year}-${season}`
}

const parseCourse = (block) => {
  const subject = tag(block, "subject")
  const code = tag(block, "code")
  if (!subject || !code) return null
  const course = {
    subject,
    code: `${subject} ${code}`,
    title: tag(block, "title"),
    description: tag(block, "description"),
    gers: tag(block, "gers").split(",").map((item) => item.trim()).filter(Boolean),
    unitsMin: Number(tag(block, "unitsMin")) || 0,
    unitsMax: Number(tag(block, "unitsMax")) || 0,
    grading: tag(block, "grading"),
    sections: []
  }
  const sectionBlocks = block.match(/<section>[\s\S]*?<\/section>/g) ?? []
  for (const sectionBlock of sectionBlocks) {
    const termId = termIdFor(tag(sectionBlock, "term"))
    const component = tag(sectionBlock, "component")
    if (!termId) continue
    const schedules = []
    for (const scheduleBlock of sectionBlock.match(/<schedule>[\s\S]*?<\/schedule>/g) ?? []) {
      const daysBlock = /<days>([\s\S]*?)<\/days>/.exec(scheduleBlock)?.[1] ?? ""
      const days = Object.keys(dayMap).filter((day) => daysBlock.includes(day)).map((day) => dayMap[day])
      const start = toMinutesClock(tag(scheduleBlock, "startTime") || "")
      const end = toMinutesClock(tag(scheduleBlock, "endTime") || "")
      if (days.length === 0 || !start || !end) continue
      schedules.push({ days, start, end, location: tag(scheduleBlock, "location") || undefined })
    }
    course.sections.push({ termId, sectionNumber: tag(sectionBlock, "sectionNumber") || "01", component, units: Number(tag(sectionBlock, "units")) || course.unitsMax, schedules })
  }
  return course
}

const main = async () => {
  await mkdir(cacheDir, { recursive: true })
  await mkdir(join(root, "data", "stanford"), { recursive: true })

  const deptXml = await cached("departments.xml", `${BASE}/?view=xml-20200810`)
  const departments = [...deptXml.matchAll(/<department longname="([^"]*)" name="([^"]*)"/g)].map((match) => ({ longname: decode(match[1]), name: decode(match[2]) }))
  console.log(`departments: ${departments.length}`)

  const allCourses = []
  let done = 0
  for (const dept of departments) {
    const encoded = encodeURIComponent(dept.name)
    const url = `${BASE}/search?view=xml-20200810&academicYear=&q=${encoded}&filter-departmentcode-${encoded}=on&filter-coursestatus-Active=on`
    let xml
    try { xml = await cached(`dept-${dept.name.replaceAll("&", "AND").replaceAll("/", "_")}.xml`, url) }
    catch (error) { console.warn(`skip ${dept.name}: ${error.message}`); continue }
    const blocks = xml.match(/<course>[\s\S]*?<\/course>/g) ?? []
    let count = 0
    for (const block of blocks) {
      const course = parseCourse(block)
      if (!course || course.subject !== dept.name) continue
      allCourses.push(course)
      count += 1
    }
    done += 1
    if (done % 20 === 0 || count > 200) console.log(`${done}/${departments.length} ${dept.name}: ${count} courses`)
  }

  const seen = new Set()
  const unique = allCourses.filter((course) => { if (seen.has(course.code)) return false; seen.add(course.code); return true })
  const retrievedAt = new Date().toISOString()
  const meta = { source: `${BASE}/`, retrievedAt, academicYear: "2026-2027", departments: departments.length, courses: unique.length, note: "Public ExploreCourses data. Verify live sections before enrolling." }

  await writeFile(join(root, "data", "stanford", "catalog-full.json"), JSON.stringify({ meta, courses: unique }))
  console.log(`full catalog: ${unique.length} courses`)

  const trimmed = unique.map((course) => {
    const detail = DETAIL_DEPTS.has(course.subject)
    const componentRank = { LEC: 0, SEM: 1, LNG: 2, WKS: 3, ITR: 4, PRC: 5, LAB: 6, ISS: 7, ACT: 8, INS: 9 }
    const autumn = detail ? course.sections
      .filter((section) => section.termId === "TERM-2026-AUTUMN" && section.component in componentRank && section.schedules.length > 0)
      .sort((a, b) => (componentRank[a.component] - componentRank[b.component]) || (Number(a.sectionNumber) || 99) - (Number(b.sectionNumber) || 99))
      .slice(0, 2) : []
    const seasons = [...new Set(course.sections.map((section) => /TERM-\d{4}-([A-Z])/.exec(section.termId)?.[1]).filter(Boolean))].sort().join("")
    const entry = { c: course.code, t: course.title.slice(0, 110) }
    if (course.unitsMin === course.unitsMax) { if (course.unitsMin !== 3) entry.u = course.unitsMin } else entry.u = [course.unitsMin, course.unitsMax]
    const ways = course.gers.filter((ger) => ger.startsWith("WAY-")).map((ger) => ger.replace("WAY-", ""))
    if (ways.length) entry.w = ways
    if (seasons) entry.o = seasons
    if (detail) {
      entry.d = course.description.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 200)
      if (autumn.length) entry.s = autumn.map((section) => ({ n: section.sectionNumber, m: section.schedules.map((schedule) => ({ d: schedule.days, s: schedule.start, e: schedule.end, l: schedule.location?.slice(0, 40) })) }))
    }
    return entry
  })
  const payload = { meta, courses: trimmed }
  const json = JSON.stringify(payload)
  await writeFile(join(root, "src", "data", "institutions", "stanford-catalog.json"), json)
  console.log(`bundled catalog: ${trimmed.length} courses, ${(json.length / 1024 / 1024).toFixed(2)} MB`)
}

main().catch((error) => { console.error(error); process.exit(1) })
