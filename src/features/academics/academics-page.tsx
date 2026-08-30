"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { apExamPresets, apGrantFor, apScoreChoices, ibExamPresets, ibScoreChoices } from "@/data/institutions/stanford-ap"
import { creditCategory } from "@/domain/history"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { evaluateDegreePlan, planForTerm } from "@/domain/degree-plan"
import { checkPlan, meetingComponent } from "@/domain/planner"
import { referenceChanges } from "@/domain/reference"
import { searchCourses } from "@/domain/search"
import { termLabel, termSequence, timelineFor } from "@/domain/timeline"
import type { Course, Meeting, Section } from "@/domain/types"

const shortTermLabel = (termId: string) => termLabel(termId).replace("Autumn", "Aut").replace("Winter", "Win").replace("Spring", "Spr").replace("Summer", "Sum")

// One page, three boxes, no tabs. The plan sits front and center with a
// quarter cycler and a note on any planned class. The catalog rides the rail
// so adding to the plan is one click away, and external credit lives in its
// own box under the plan. The numbers that matter stretch across the top.
// Schedule collisions stay off this page: the calendar's week grid is where
// overlapping blocks and protected windows are visible, so the checks here
// stick to degree matters, prerequisites, duplicates, units, and offerings.

const humanEvidence = (id: string, claim: string, sourceUrl: string) => ({
  id,
  title: "Added by hand",
  claim,
  sourceUrl: sourceUrl || "https://navigator.stanford.edu/classes",
  sourceTitle: "Student-provided reference",
  retrievedAt: new Date().toISOString(),
  classification: "student",
  confidence: 0.6,
  status: "current"
})

const waysOrder = ["A-II", "AQR", "CE", "ED", "ER", "FR", "SI", "SMA"]

export const AcademicsPage = () => {
  const value = useWorkspace()
  const workspace = value.workspace
  const timeline = timelineFor(workspace.profile, new Date())
  const [query, setQuery] = useState("")
  const [planTermId, setPlanTermId] = useState(workspace.currentTermId)
  const [drawerCourseId, setDrawerCourseId] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [noteForPlanCourse, setNoteForPlanCourse] = useState("")
  const [planNoteDraft, setPlanNoteDraft] = useState("")
  const [addingCourse, setAddingCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({ code: "", title: "", units: "3", description: "", sourceUrl: "" })
  const [creditKind, setCreditKind] = useState<"ap" | "ib" | "college">("ap")
  const [creditExam, setCreditExam] = useState(apExamPresets[0].exam)
  const [creditScore, setCreditScore] = useState("5")
  const [creditUnits, setCreditUnits] = useState(() => String(apGrantFor(apExamPresets[0].exam, 5)?.units ?? 0))
  const [creditSatisfies, setCreditSatisfies] = useState<string[]>(() => apGrantFor(apExamPresets[0].exam, 5)?.satisfiesCodes ?? [])
  const [creditInstitution, setCreditInstitution] = useState("")
  const [creditCourseTitle, setCreditCourseTitle] = useState("")
  const [addingCredit, setAddingCredit] = useState(false)
  const [showAllSections, setShowAllSections] = useState(false)
  const [fixSection, setFixSection] = useState<{ id: string, sectionNumber: string, meetings: Array<{ days: Meeting["days"], start: string, end: string, type: "lecture" | "section" | "lab" | "seminar", location: string }>, sourceUrl: string } | null>(null)

  const institution = institutionForWorkspace(workspace)
  const shippedCourses = useMemo(() => new Map(institution.buildCatalog().courses.map((course) => [course.id, course])), [institution])
  const overlayCourseIds = useMemo(() => new Set((workspace.referenceOverlay?.courses ?? []).map((course) => course.id)), [workspace.referenceOverlay?.courses])
  const overlayAuthor = (courseId: string) => {
    const entry = (workspace.referenceOverlay?.courses ?? []).find((item) => item.id === courseId) as { addedBy?: { type?: string } } | undefined
    return entry?.addedBy?.type === "agent" ? "agent" : "hand"
  }

  const terms = useMemo(() => termSequence(workspace.currentTermId, timeline.expectedGraduationTermId).slice(0, 15), [workspace.currentTermId, timeline.expectedGraduationTermId])
  const termIndex = terms.findIndex((term) => term.id === planTermId)
  const cycleTerm = (direction: 1 | -1) => {
    const next = terms[(termIndex + direction + terms.length) % terms.length]
    if (next) setPlanTermId(next.id)
  }
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(() => deferredQuery.trim() ? searchCourses(value.catalog, { query: deferredQuery }).slice(0, 10) : [], [value.catalog, deferredQuery])
  const interested = new Set(workspace.interestedCourseIds ?? [])
  const interestedCourses = (workspace.interestedCourseIds ?? []).map((id) => value.catalog.courses.find((course) => course.id === id)).filter((course): course is Course => Boolean(course))

  const plan = planForTerm(workspace, planTermId)
  const scenario = plan?.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan?.scenarios[0]
  const plannedUnits = scenario?.courses.filter((item) => item.status === "active").reduce((total, item) => total + item.units, 0) ?? 0
  const activityUnits = (workspace.activities ?? []).reduce((total, activity) => total + (activity.units ?? 0), 0)
  const scheduleCodes = useMemo(() => new Set(["PROTECTED_TIME", "TRANSITION_BUFFER", "MEETING_CONFLICT", "COMMITMENT_CONFLICT", "TIME_CONSTRAINT", "DAY_CONSTRAINT", "FINAL_CONFLICT"]), [])
  const checks = useMemo(() => plan && scenario ? checkPlan({ scenario, catalog: value.catalog, profile: workspace.profile, evidence: workspace.evidence, activities: workspace.activities, now: new Date(), termId: plan.termId }).filter((check) => !scheduleCodes.has(check.code)).slice(0, 3) : [], [plan, scenario, value.catalog, workspace.profile, workspace.evidence, workspace.activities, scheduleCodes])
  const degree = useMemo(() => evaluateDegreePlan(workspace, value.catalog, new Date()), [workspace, value.catalog])

  const waysCovered = useMemo(() => {
    const covered = new Set<string>()
    const courseIds = new Set<string>(workspace.profile.completedCourseIds)
    for (const eachPlan of workspace.plans) {
      const active = eachPlan.scenarios.find((item) => item.id === eachPlan.activeScenarioId) ?? eachPlan.scenarios[0]
      for (const item of active?.courses ?? []) if (item.status === "active") courseIds.add(item.courseId)
    }
    for (const id of courseIds) for (const way of value.catalog.courses.find((candidate) => candidate.id === id)?.ways ?? []) covered.add(way)
    return covered
  }, [workspace.profile.completedCourseIds, workspace.plans, value.catalog])

  const planCourse = (course: Course) => value.onCommand({ type: "edit_plan", termId: planTermId, operations: [{ type: "add_course", planCourse: { id: `PLANCOURSE-${course.id.replace(/^COURSE-/, "")}-${planTermId.slice(5)}`, courseId: course.id, sectionId: value.catalog.sections.find((section) => section.courseId === course.id && section.termId === planTermId)?.id ?? null, units: course.maxUnits, status: "active" } }] })
  const removePlanned = (planCourseId: string) => plan && value.onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario?.id, operations: [{ type: "remove_course", planCourseId }] })

  const submitCourse = async () => {
    const code = courseForm.code.trim().toUpperCase()
    if (!code || !courseForm.title.trim()) return
    await value.onCommand({ type: "extend_reference", course: { code, title: courseForm.title.trim(), description: courseForm.description.trim(), units: Number(courseForm.units) || 3, sourceUrl: courseForm.sourceUrl.trim() || undefined }, evidence: humanEvidence(`EVIDENCE-HAND-${code.replace(/[^A-Z0-9]/g, "-")}`, `${code} added by hand from the student's own information.`, courseForm.sourceUrl.trim()) })
    setAddingCourse(false)
    setCourseForm({ code: "", title: "", units: "3", description: "", sourceUrl: "" })
    setQuery(code)
  }

  const saveClassNote = async (courseId: string) => {
    if (!planNoteDraft.trim()) return
    await value.onCommand({ type: "annotate_course", courseId, note: { text: planNoteDraft.trim() } })
    setPlanNoteDraft("")
  }

  const chooseCredit = (exam: string, score: string) => {
    setCreditExam(exam)
    setCreditScore(score)
    if (creditKind === "ap") {
      const grant = apGrantFor(exam, Number(score))
      setCreditUnits(String(grant?.units ?? 0))
      setCreditSatisfies(grant?.satisfiesCodes ?? [])
    }
  }
  const chooseCreditKind = (kind: "ap" | "ib" | "college") => {
    setCreditKind(kind)
    setCreditSatisfies([])
    setCreditUnits("0")
    if (kind === "ap") { setCreditExam(apExamPresets[0].exam); setCreditScore("5"); const grant = apGrantFor(apExamPresets[0].exam, 5); setCreditUnits(String(grant?.units ?? 0)); setCreditSatisfies(grant?.satisfiesCodes ?? []) }
    if (kind === "ib") { setCreditExam(ibExamPresets[0]); setCreditScore("7") }
    if (kind === "college") { setCreditExam(""); setCreditScore("") }
  }
  const apCredits = workspace.profile.apCredits ?? []
  const addCredit = async () => {
    const exam = creditKind === "college" ? `${creditCourseTitle.trim() || "College course"}` : creditExam
    if (creditKind === "college" && !creditCourseTitle.trim()) return
    await value.onCommand({ type: "update_academic_history", patch: { apCredits: [...apCredits, {
      id: `CREDIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      exam,
      kind: creditKind,
      institution: creditKind === "college" ? creditInstitution.trim() || undefined : undefined,
      score: creditKind === "college" ? undefined : Number(creditScore),
      unitsGranted: Number(creditUnits) || 0,
      satisfiesCourseIds: creditSatisfies.map((code) => value.catalog.courses.find((course) => course.code === code)?.id).filter((id): id is string => Boolean(id))
    }] } })
    setAddingCredit(false)
    setCreditInstitution("")
    setCreditCourseTitle("")
    chooseCreditKind("ap")
  }

  const drawerCourse = drawerCourseId ? value.catalog.courses.find((course) => course.id === drawerCourseId) : undefined
  const drawerNotes = drawerCourseId ? workspace.courseNotes?.[drawerCourseId] ?? [] : []
  const allDrawerSections = drawerCourseId ? value.catalog.sections.filter((section) => section.courseId === drawerCourseId) : []
  const drawerSections = showAllSections ? allDrawerSections : allDrawerSections.slice(0, 6)
  const drawerDiff = drawerCourse ? referenceChanges(shippedCourses.get(drawerCourse.id) as unknown as Record<string, unknown> | undefined, drawerCourse as unknown as Record<string, unknown>, ["title", "description", "minUnits", "maxUnits"]) : []
  const completedIds = workspace.profile.completedCourseIds
  const openDrawer = (courseId: string) => { setDrawerCourseId(courseId); setShowAllSections(false); setFixSection(null); setNoteDraft("") }
  const closeDrawer = () => { setDrawerCourseId(""); setShowAllSections(false); setFixSection(null) }
  const addNote = async () => {
    if (!noteDraft.trim() || !drawerCourseId) return
    await value.onCommand({ type: "annotate_course", courseId: drawerCourseId, note: { text: noteDraft.trim() } })
    setNoteDraft("")
  }
  const describeMeeting = (meeting: Meeting) => `${meetingComponent(meeting.type) ? `${meetingComponent(meeting.type)} ` : ""}${meeting.days.join("/")} ${meeting.start} to ${meeting.end}${meeting.location ? ` at ${meeting.location}` : ""}`
  const openFix = (section?: Section) => setFixSection(section
    ? { id: section.id, sectionNumber: section.sectionNumber, meetings: section.meetings.map((meeting) => ({ days: [...meeting.days], start: meeting.start, end: meeting.end, type: meeting.type === "commitment" ? "lecture" : meeting.type, location: meeting.location ?? "" })), sourceUrl: "" }
    : { id: "", sectionNumber: "", meetings: [{ days: [], start: "09:30", end: "10:20", type: "lecture", location: "" }], sourceUrl: "" })
  const patchFixMeeting = (index: number, patch: Partial<{ days: Meeting["days"], start: string, end: string, type: "lecture" | "section" | "lab" | "seminar", location: string }>) =>
    setFixSection((current) => current ? { ...current, meetings: current.meetings.map((meeting, at) => at === index ? { ...meeting, ...patch } : meeting) } : current)
  const toggleFixDay = (index: number, day: Meeting["days"][number]) =>
    setFixSection((current) => current ? { ...current, meetings: current.meetings.map((meeting, at) => at === index ? { ...meeting, days: meeting.days.includes(day) ? meeting.days.filter((one) => one !== day) : [...meeting.days, day] } : meeting) } : current)
  const submitFix = async () => {
    if (!drawerCourse || !fixSection) return
    const sectionNumber = (fixSection.sectionNumber.trim() || "01").slice(0, 6)
    const id = fixSection.id || `SECTION-${drawerCourse.id.replace(/^COURSE-/, "")}-${sectionNumber.toUpperCase().replace(/[^A-Z0-9-]/g, "") || "A1"}`
    const meetings = fixSection.meetings.filter((meeting) => meeting.days.length > 0 && meeting.start && meeting.end && meeting.start < meeting.end)
    if (meetings.length === 0) return
    await value.onCommand({
      type: "extend_reference",
      course: { id: drawerCourse.id, code: drawerCourse.code, title: drawerCourse.title, description: drawerCourse.description, subject: drawerCourse.subject, level: drawerCourse.level, minUnits: drawerCourse.minUnits, maxUnits: drawerCourse.maxUnits, tags: drawerCourse.tags, ways: drawerCourse.ways, offeredSeasons: drawerCourse.offeredSeasons, prerequisites: drawerCourse.prerequisites, prerequisiteUncertain: drawerCourse.prerequisiteUncertain, sourceUrl: fixSection.sourceUrl.trim() || drawerCourse.sourceUrl, catalogYear: drawerCourse.catalogYear },
      section: { id, sectionNumber, units: drawerCourse.maxUnits, meetings: meetings.map((meeting) => ({ days: meeting.days, start: meeting.start, end: meeting.end, type: meeting.type, location: meeting.location.trim() || undefined })) },
      evidence: humanEvidence(`EVIDENCE-HAND-${id}`, `${drawerCourse.code} section ${sectionNumber} recorded by hand from the student's own information.`, fixSection.sourceUrl.trim())
    })
    setFixSection(null)
  }

  const catalogRow = (course: Course, sectionsCount: number) => {
    const unverified = overlayCourseIds.has(course.id)
    return <article className="cat-row" key={course.id}>
      <button className="cat-row-main" type="button" onClick={() => openDrawer(course.id)}>
        <b>{course.code}</b>
        <span>{course.title}</span>
        <small>{course.minUnits === course.maxUnits ? `${course.maxUnits} units` : `${course.minUnits} to ${course.maxUnits} units`}{course.ways?.length ? ` · ${course.ways.join(", ")}` : ""}{sectionsCount > 0 ? ` · ${sectionsCount} section${sectionsCount === 1 ? "" : "s"}` : ""}</small>
        {unverified && <em className="unverified-banner">{shippedCourses.has(course.id) ? "Amended" : "Added"} by {overlayAuthor(course.id)} · unverified</em>}
      </button>
      <div className="cat-row-actions">
        <button className={interested.has(course.id) ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_course_interest", courseId: course.id, interested: !interested.has(course.id) })}>{interested.has(course.id) ? "Interested ✓" : "Interested"}</button>
        <button className="chip-button plan" type="button" onClick={() => void planCourse(course)} aria-label={`Plan ${course.code} for ${shortTermLabel(planTermId)}`}>Plan for {shortTermLabel(planTermId)}</button>
      </div>
    </article>
  }

  return <div className="page academics-page">
    <header className="page-heading"><div><h1>Academics</h1></div></header>

    <div className="stat-row" aria-label="Degree numbers">
      <div className="stat-tile"><em>{degree.completedUnits}</em><span>units earned</span></div>
      <div className="stat-tile"><em>{plannedUnits}{activityUnits > 0 ? ` +${activityUnits}` : ""}</em><span>planned {shortTermLabel(planTermId)}{activityUnits > 0 ? " +activities" : ""}</span></div>
      <div className="stat-tile"><em>{degree.projectedUnits} / {degree.requiredUnits}</em><span>toward degree</span></div>
      <div className="stat-tile"><em>{waysOrder.filter((way) => waysCovered.has(way)).length} / {waysOrder.length}</em><span>WAYS covered</span></div>
    </div>

    <div className="academics-layout">
      <div className="academics-main">
        <section className="panel-card plan-box" aria-label="Plan">
          <div className="plan-box-head">
            <button className="secondary-button small" type="button" onClick={() => cycleTerm(-1)} aria-label="Previous quarter">←</button>
            <select className="chunky-select plan-term-select" aria-label="Planning term" value={planTermId} onChange={(event) => setPlanTermId(event.target.value)}>
              {terms.map((term) => <option key={term.id} value={term.id}>{termLabel(term.id)}</option>)}
            </select>
            <button className="secondary-button small" type="button" onClick={() => cycleTerm(1)} aria-label="Next quarter">→</button>
            <span className="unit-total">{plannedUnits} units</span>
          </div>
          {!scenario || scenario.courses.length === 0 ? <p className="muted plan-empty-note">Nothing planned for {termLabel(planTermId)} yet. Pick a course from the catalog on the right and its meetings land on the calendar.</p> : <ul className="plan-box-list">
            {scenario.courses.map((item) => {
              const course = value.catalog.courses.find((candidate) => candidate.id === item.courseId)
              const notes = workspace.courseNotes?.[item.courseId] ?? []
              const open = noteForPlanCourse === item.id
              return <li key={item.id}>
                <div className="plan-box-row">
                  <span><b>{course?.code ?? item.courseId}</b><small>{course?.title}</small></span>
                  <em>{item.units}</em>
                  <button className="text-button" type="button" onClick={() => { setNoteForPlanCourse(open ? "" : item.id); setPlanNoteDraft("") }}>{notes.length > 0 ? `Notes (${notes.length})` : "Note"}</button>
                  <button className="text-button" type="button" onClick={() => void removePlanned(item.id)} aria-label={`Remove ${course?.code ?? item.courseId} from plan`}>Remove</button>
                </div>
                {open && <div className="plan-note-area">
                  {notes.map((note) => <p key={note.id} className="plan-note"><span className={`note-author ${note.author}`}>{note.author === "agent" ? "Agent" : "You"}</span>{note.text}<button className="text-button" type="button" onClick={() => void value.onCommand({ type: "annotate_course", courseId: item.courseId, removeNoteId: note.id })} aria-label="Remove note">Remove</button></p>)}
                  <div className="course-note-add">
                    <textarea aria-label={`Note on ${course?.code ?? item.courseId}`} rows={2} maxLength={600} placeholder="Heavy problem sets. Take with a lighter Tuesday." value={planNoteDraft} onChange={(event) => setPlanNoteDraft(event.target.value)} />
                    <button className="primary-button small" type="button" disabled={!planNoteDraft.trim()} onClick={() => void saveClassNote(item.courseId)}>Add note</button>
                  </div>
                </div>}
              </li>
            })}
          </ul>}
          {checks.length > 0 && <div className="plan-rail-checks">
            {checks.map((check, index) => <p key={index} className={check.severity}><b>{check.code.replaceAll("_", " ").toLowerCase()}</b> {check.message}{check.alternative ? ` ${check.suggestedRepairs[0]} instead.` : ""}</p>)}
          </div>}
        </section>

        <section className="panel-card done-box" aria-label="AP, IB, and transfer credit">
          <div className="section-heading"><h2>AP, IB, and transfer credit</h2><button className="secondary-button small" type="button" onClick={() => setAddingCredit((current) => !current)}>{addingCredit ? "Cancel" : "Add credit"}</button></div>
              {addingCredit && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void addCredit() }}>
                <div className="kind-toggle-row" role="radiogroup" aria-label="Credit type">
                  {([["ap", "AP"], ["ib", "IB"], ["college", "Transfer"]] as const).map(([kind, label]) => <button key={kind} type="button" role="radio" aria-checked={creditKind === kind} className={creditKind === kind ? "day-toggle active" : "day-toggle"} onClick={() => chooseCreditKind(kind)}>{label}</button>)}
                </div>
                {creditKind === "ap" && <>
                  <label>Exam<select value={creditExam} onChange={(event) => chooseCredit(event.target.value, creditScore)}>{apExamPresets.map((preset) => <option key={preset.exam} value={preset.exam}>{preset.exam}</option>)}</select></label>
                  <div className="add-form-row">
                    <label>Score<select value={creditScore} onChange={(event) => chooseCredit(creditExam, event.target.value)}>{apScoreChoices.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>
                    <label>Units Stanford granted<input type="number" min={0} max={45} value={creditUnits} onChange={(event) => setCreditUnits(event.target.value)} /></label>
                  </div>
                  {creditSatisfies.length > 0 && <p className="add-form-note">Counts as {creditSatisfies.join(" and ")} by default.</p>}
                  {apGrantFor(creditExam, Number(creditScore)) === null && <p className="add-form-note">The chart grants no units for this score, so record it with the units from your own credit report.</p>}
                </>}
                {creditKind === "ib" && <>
                  <label>Subject<select value={creditExam} onChange={(event) => setCreditExam(event.target.value)}>{ibExamPresets.map((exam) => <option key={exam} value={exam}>{exam}</option>)}</select></label>
                  <div className="add-form-row">
                    <label>Score<select value={creditScore} onChange={(event) => setCreditScore(event.target.value)}>{ibScoreChoices.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>
                    <label>Units Stanford granted<input type="number" min={0} max={45} value={creditUnits} onChange={(event) => setCreditUnits(event.target.value)} /></label>
                  </div>
                </>}
                {creditKind === "college" && <>
                  <div className="add-form-row">
                    <label>College or university<input value={creditInstitution} onChange={(event) => setCreditInstitution(event.target.value)} maxLength={80} placeholder="Foothill College" /></label>
                    <label>Course<input value={creditCourseTitle} onChange={(event) => setCreditCourseTitle(event.target.value)} maxLength={80} placeholder="MATH 1C Multivariable Calculus" required /></label>
                  </div>
                  <label>Units Stanford granted<input type="number" min={0} max={45} value={creditUnits} onChange={(event) => setCreditUnits(event.target.value)} /></label>
                </>}
                <button className="primary-button" type="submit">Save credit</button>
              </form>}
          {apCredits.length === 0 ? <p className="muted">No credits recorded.</p> : <ul className="history-list">{apCredits.map((credit) => <li key={credit.id}><span><b>{credit.exam}</b><small>{[creditCategory(credit) === "ib" ? "IB" : creditCategory(credit) === "college" ? (credit.institution || "Transfer") : "AP", credit.score !== undefined ? `score ${credit.score}` : null, credit.unitsGranted !== undefined ? `${credit.unitsGranted} units granted` : null].filter(Boolean).join(" · ")}</small></span><button className="text-button" type="button" onClick={() => void value.onCommand({ type: "update_academic_history", patch: { apCredits: apCredits.filter((item) => item.id !== credit.id) } })}>Remove</button></li>)}</ul>}
        </section>
      </div>

      <aside className="academics-rail">
        <section className="panel-card catalog-box" aria-label="Catalog">
          <div className="section-heading"><h2>Catalog</h2><button className="secondary-button small" type="button" onClick={() => setAddingCourse((current) => !current)}>{addingCourse ? "Cancel" : "Add a course"}</button></div>
          <input aria-label="Search courses" placeholder={`Search ${value.catalog.courses.length.toLocaleString()} courses`} value={query} onChange={(event) => setQuery(event.target.value)} />
          {addingCourse && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitCourse() }}>
            <div className="add-form-row">
              <label>Code<input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} placeholder="CS 329S" required maxLength={12} /></label>
              <label>Units<select value={courseForm.units} onChange={(event) => setCourseForm({ ...courseForm, units: event.target.value })}>{[1, 2, 3, 4, 5].map((units) => <option key={units} value={units}>{units}</option>)}</select></label>
            </div>
            <label>Title<input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required maxLength={120} /></label>
            <label>Source URL<input value={courseForm.sourceUrl} onChange={(event) => setCourseForm({ ...courseForm, sourceUrl: event.target.value })} placeholder="https://navigator.stanford.edu/classes…" /></label>
            <button className="primary-button small" type="submit">Add course</button>
          </form>}
          {query.trim() !== "" && <div className="cat-list">
            {results.length === 0 ? <div className="empty-card"><strong>No matches</strong><p>Add it by hand or ask your agent to research it.</p></div> : results.map(({ course, sections }) => catalogRow(course, sections.length))}
          </div>}
          {query.trim() === "" && interestedCourses.length > 0 && <>
            <div className="section-heading interested-heading"><h3>Interested</h3><span className="count-chip">{interestedCourses.length}</span></div>
            <div className="cat-list">{interestedCourses.map((course) => <div key={course.id}>{catalogRow(course, value.catalog.sections.filter((section) => section.courseId === course.id).length)}{workspace.courseIntents?.[course.id] && <p className="muted intent-note">Intended for {shortTermLabel(workspace.courseIntents[course.id])}</p>}</div>)}</div>
          </>}
          {query.trim() === "" && interestedCourses.length === 0 && <p className="muted side-empty">Plan or add your courses. You or your agent can add any course missing from the catalog.</p>}
        </section>
      </aside>
    </div>

    {drawerCourse && <div className="drawer-backdrop" role="presentation" onMouseDown={closeDrawer}>
      <aside className="course-drawer" aria-label={`${drawerCourse.code} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading"><div><h2>{drawerCourse.code}</h2><p className="drawer-subtitle">{drawerCourse.title}</p></div><button className="icon-button" onClick={closeDrawer} aria-label="Close course details">×</button></div>
        {overlayCourseIds.has(drawerCourse.id) && <p className="unverified-banner block">This entry was {shippedCourses.has(drawerCourse.id) ? "amended" : "added"} outside the official import and is unverified.</p>}
        {drawerDiff.length > 0 && <div className="reference-diff"><b>Changed from the shipped catalog</b><ul>{drawerDiff.map((change) => <li key={change.field}><span>{change.label}</span><em>{change.was}</em><strong>{change.now}</strong></li>)}</ul></div>}
        {drawerCourse.description && <p className="drawer-description">{drawerCourse.description}</p>}
        {drawerCourse.prerequisites && drawerCourse.prerequisites.length > 0 && <div className="drawer-block"><h3>Prerequisites</h3><p>{drawerCourse.prerequisites.map((id) => value.catalog.courses.find((course) => course.id === id)?.code ?? id).join(", ")}</p></div>}
        <div className="drawer-block">
          <div className="section-heading"><h3>Sections</h3><button className="text-button" type="button" onClick={() => openFix()}>Add a section</button></div>
          {allDrawerSections.length === 0 && !fixSection && <p className="muted">No stored sections this term. Add one from the official listing, or ask your agent to.</p>}
          {drawerSections.length > 0 && <ul className="drawer-section-list">{drawerSections.map((section) => <li key={section.id}><b>{section.sectionNumber}</b><span>{section.meetings.map(describeMeeting).join("; ")}</span><button className="text-button" type="button" onClick={() => openFix(section)}>Fix times</button></li>)}</ul>}
          {allDrawerSections.length > 6 && <button className="text-button" type="button" onClick={() => setShowAllSections((current) => !current)}>{showAllSections ? "Show fewer" : `Show all ${allDrawerSections.length} sections`}</button>}
          {fixSection && <form className="add-form section-fix" onSubmit={(event) => { event.preventDefault(); void submitFix() }}>
            <div className="add-form-row">
              <label>Section number<input value={fixSection.sectionNumber} onChange={(event) => setFixSection((current) => current ? { ...current, sectionNumber: event.target.value } : current)} maxLength={6} placeholder="01-02" /></label>
              <label>Source URL<input value={fixSection.sourceUrl} onChange={(event) => setFixSection((current) => current ? { ...current, sourceUrl: event.target.value } : current)} placeholder="https://navigator.stanford.edu/classes…" /></label>
            </div>
            {fixSection.meetings.map((meetingDraft, index) => <div className="fix-meeting" key={index}>
              <div className="kind-toggle-row" role="group" aria-label={`Meeting ${index + 1} days`}>
                {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => <button key={day} type="button" className={meetingDraft.days.includes(day) ? "day-toggle active" : "day-toggle"} onClick={() => toggleFixDay(index, day)}>{day}</button>)}
              </div>
              <div className="add-form-row">
                <label>Start<input type="time" value={meetingDraft.start} onChange={(event) => patchFixMeeting(index, { start: event.target.value })} /></label>
                <label>End<input type="time" value={meetingDraft.end} onChange={(event) => patchFixMeeting(index, { end: event.target.value })} /></label>
                <label>Kind<select value={meetingDraft.type} onChange={(event) => patchFixMeeting(index, { type: event.target.value as "lecture" | "section" | "lab" | "seminar" })}><option value="lecture">Lecture</option><option value="section">Discussion</option><option value="lab">Lab</option><option value="seminar">Seminar</option></select></label>
              </div>
              <div className="add-form-row">
                <label>Location<input value={meetingDraft.location} onChange={(event) => patchFixMeeting(index, { location: event.target.value })} maxLength={80} placeholder="Hewlett 200" /></label>
                {fixSection.meetings.length > 1 && <button className="text-button" type="button" onClick={() => setFixSection((current) => current ? { ...current, meetings: current.meetings.filter((one, at) => at !== index) } : current)}>Remove meeting</button>}
              </div>
            </div>)}
            <div className="add-form-row">
              {fixSection.meetings.length < 4 && <button className="secondary-button small" type="button" onClick={() => setFixSection((current) => current ? { ...current, meetings: [...current.meetings, { days: [], start: "09:30", end: "10:20", type: "section", location: "" }] } : current)}>Add a meeting</button>}
              <button className="primary-button small" type="submit">Save correction</button>
              <button className="text-button" type="button" onClick={() => setFixSection(null)}>Cancel</button>
            </div>
            <p className="muted add-form-note">Corrections replace the shipped listing in your workspace and are marked unverified until the agent or you re-verify them.</p>
          </form>}
        </div>
        <div className="drawer-block">
          <h3>Notes</h3>
          {drawerNotes.length === 0 && <p className="muted">Nothing yet. Impressions, warnings, and instructor gossip all belong here.</p>}
          <ul className="course-note-list">{drawerNotes.map((note) => <li key={note.id}><span className={`note-author ${note.author}`}>{note.author === "agent" ? "Agent" : "You"}</span><p>{note.text}</p><button className="text-button" type="button" onClick={() => void value.onCommand({ type: "annotate_course", courseId: drawerCourse.id, removeNoteId: note.id })} aria-label="Remove note">Remove</button></li>)}</ul>
          <div className="course-note-add"><textarea aria-label="Add a note" rows={2} placeholder="Seems heavy alongside MATH 51. RateMyProfessor is skeptical." value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={600} /><button className="primary-button small" type="button" onClick={() => void addNote()} disabled={!noteDraft.trim()}>Add note</button></div>
        </div>
        <div className="drawer-actions">
          <button className={completedIds.includes(drawerCourse.id) ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_completed_courses", courseIds: completedIds.includes(drawerCourse.id) ? completedIds.filter((id) => id !== drawerCourse.id) : [...completedIds, drawerCourse.id] })}>{completedIds.includes(drawerCourse.id) ? "Completed ✓" : "Completed"}</button>
          <button className={interested.has(drawerCourse.id) ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_course_interest", courseId: drawerCourse.id, interested: !interested.has(drawerCourse.id) })}>{interested.has(drawerCourse.id) ? "Interested ✓" : "Interested"}</button>
          <button className="primary-button" type="button" onClick={() => void planCourse(drawerCourse)}>Plan for {shortTermLabel(planTermId)}</button>
        </div>
      </aside>
    </div>}
  </div>
}
