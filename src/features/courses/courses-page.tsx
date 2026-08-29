"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { apExamPresets, apGrantFor, apScoreChoices, ibExamPresets, ibScoreChoices } from "@/data/institutions/stanford-ap"
import { creditCategory } from "@/domain/history"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { evaluateDegreePlan, planForTerm } from "@/domain/degree-plan"
import { checkPlan } from "@/domain/planner"
import { mergedOpportunities, referenceChanges } from "@/domain/reference"
import { searchCourses } from "@/domain/search"
import { termLabel, termSequence, timelineFor } from "@/domain/timeline"
import type { Course, Opportunity } from "@/domain/types"

const shortTermLabel = (termId: string) => termLabel(termId).replace("Autumn", "Aut").replace("Winter", "Win").replace("Spring", "Spr").replace("Summer", "Sum")

// Courses, clubs, and everything you commit time to, with the plan rail
// beside it. Marking a course interested keeps it in context; planning it for
// a term puts every lecture on the calendar. Anything the catalog is missing
// can be added by hand or by an agent, and stays visibly unverified.

const dayChoices = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]] as const

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

export const CoursesPage = ({ initialTab = "courses" }: { initialTab?: "courses" | "clubs" | "activities" | "history" }) => {
  const value = useWorkspace()
  const workspace = value.workspace
  const timeline = timelineFor(workspace.profile, new Date())
  const [tab, setTab] = useState<"courses" | "clubs" | "activities" | "history">(initialTab)
  const [query, setQuery] = useState("")
  const [planTermId, setPlanTermId] = useState(workspace.currentTermId)
  const [drawerCourseId, setDrawerCourseId] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [addingCourse, setAddingCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({ code: "", title: "", units: "3", description: "", sourceUrl: "" })
  const [addingClub, setAddingClub] = useState(false)
  const [clubForm, setClubForm] = useState({ name: "", kind: "club", summary: "", url: "", commitment: "", dateOne: "", dateOneLabel: "", dateTwo: "", dateTwoLabel: "" })
  const [activityForm, setActivityForm] = useState({ id: "", name: "", kind: "research", organizer: "", detail: "", days: [] as string[], start: "15:00", end: "17:00", startDate: "", endDate: "", dateOne: "", dateOneLabel: "" })
  const [activityOpen, setActivityOpen] = useState(false)
  const [completedQuery, setCompletedQuery] = useState("")
  const [creditKind, setCreditKind] = useState<"ap" | "ib" | "college">("ap")
  const [creditExam, setCreditExam] = useState(apExamPresets[0].exam)
  const [creditScore, setCreditScore] = useState("5")
  const [creditUnits, setCreditUnits] = useState(() => String(apGrantFor(apExamPresets[0].exam, 5)?.units ?? 0))
  const [creditSatisfies, setCreditSatisfies] = useState<string[]>(() => apGrantFor(apExamPresets[0].exam, 5)?.satisfiesCodes ?? [])
  const [creditInstitution, setCreditInstitution] = useState("")
  const [creditCourseTitle, setCreditCourseTitle] = useState("")
  const [addingCredit, setAddingCredit] = useState(false)
  const [rationaleDraft, setRationaleDraft] = useState<string | null>(null)

  const institution = institutionForWorkspace(workspace)
  const shippedCourses = useMemo(() => new Map(institution.buildCatalog().courses.map((course) => [course.id, course])), [institution])
  const shippedOpportunities = useMemo(() => new Map(institution.buildOpportunities().map((opportunity) => [opportunity.id, opportunity])), [institution])
  const opportunities = useMemo(() => mergedOpportunities(institution.buildOpportunities(), workspace.referenceOverlay?.opportunities), [institution, workspace.referenceOverlay?.opportunities])
  const overlayCourseIds = useMemo(() => new Set((workspace.referenceOverlay?.courses ?? []).map((course) => course.id)), [workspace.referenceOverlay?.courses])
  const overlayAuthor = (courseId: string) => {
    const entry = (workspace.referenceOverlay?.courses ?? []).find((item) => item.id === courseId) as { addedBy?: { type?: string } } | undefined
    return entry?.addedBy?.type === "agent" ? "agent" : "hand"
  }

  const terms = useMemo(() => termSequence(workspace.currentTermId, timeline.expectedGraduationTermId).slice(0, 15), [workspace.currentTermId, timeline.expectedGraduationTermId])
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(() => deferredQuery.trim() ? searchCourses(value.catalog, { query: deferredQuery }).slice(0, 12) : [], [value.catalog, deferredQuery])
  const interested = new Set(workspace.interestedCourseIds ?? [])
  const interestedCourses = (workspace.interestedCourseIds ?? []).map((id) => value.catalog.courses.find((course) => course.id === id)).filter((course): course is Course => Boolean(course))

  const plan = planForTerm(workspace, planTermId)
  const scenario = plan?.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan?.scenarios[0]
  const plannedUnits = scenario?.courses.filter((item) => item.status === "active").reduce((total, item) => total + item.units, 0) ?? 0
  const checks = useMemo(() => plan && scenario ? checkPlan({ scenario, catalog: value.catalog, profile: workspace.profile, evidence: workspace.evidence, activities: workspace.activities, now: new Date(), termId: plan.termId }).slice(0, 3) : [], [plan, scenario, value.catalog, workspace.profile, workspace.evidence, workspace.activities])
  const degree = useMemo(() => evaluateDegreePlan(workspace, value.catalog, new Date()), [workspace, value.catalog])

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

  const submitClub = async () => {
    if (!clubForm.name.trim() || !clubForm.summary.trim()) return
    const dates = [clubForm.dateOne && clubForm.dateOneLabel ? { date: clubForm.dateOne, label: clubForm.dateOneLabel } : null, clubForm.dateTwo && clubForm.dateTwoLabel ? { date: clubForm.dateTwo, label: clubForm.dateTwoLabel } : null].filter(Boolean)
    await value.onCommand({ type: "extend_reference_opportunity", opportunity: { name: clubForm.name.trim(), kind: clubForm.kind, summary: clubForm.summary.trim(), url: clubForm.url.trim() || undefined, commitment: clubForm.commitment.trim() || undefined, dates: dates.length ? dates : undefined }, evidence: humanEvidence(`EVIDENCE-HAND-CLUB-${clubForm.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 40)}`, `${clubForm.name.trim()} added by hand.`, clubForm.url.trim()) })
    setAddingClub(false)
    setClubForm({ name: "", kind: "club", summary: "", url: "", commitment: "", dateOne: "", dateOneLabel: "", dateTwo: "", dateTwoLabel: "" })
  }

  const submitActivity = async () => {
    if (!activityForm.name.trim()) return
    const schedule = activityForm.days.length > 0 ? { days: activityForm.days, start: activityForm.start, end: activityForm.end } : undefined
    const dates = activityForm.dateOne && activityForm.dateOneLabel ? [{ date: activityForm.dateOne, label: activityForm.dateOneLabel }] : undefined
    await value.onCommand({ type: "upsert_activity", activity: { id: activityForm.id || undefined, name: activityForm.name.trim(), kind: activityForm.kind, organizer: activityForm.organizer.trim() || undefined, detail: activityForm.detail.trim() || undefined, schedule, startDate: activityForm.startDate || undefined, endDate: activityForm.endDate || undefined, dates } })
    setActivityOpen(false)
    setActivityForm({ id: "", name: "", kind: "research", organizer: "", detail: "", days: [], start: "15:00", end: "17:00", startDate: "", endDate: "", dateOne: "", dateOneLabel: "" })
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
  const completedCourses = workspace.profile.completedCourseIds.map((id) => value.catalog.courses.find((course) => course.id === id)).filter((course): course is Course => Boolean(course))
  const completedMatches = completedQuery.trim() ? value.catalog.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(completedQuery.toLowerCase()) && !workspace.profile.completedCourseIds.includes(course.id)).slice(0, 6) : []

  const drawerCourse = drawerCourseId ? value.catalog.courses.find((course) => course.id === drawerCourseId) : undefined
  const drawerNotes = drawerCourseId ? workspace.courseNotes?.[drawerCourseId] ?? [] : []
  const drawerSections = drawerCourseId ? value.catalog.sections.filter((section) => section.courseId === drawerCourseId).slice(0, 4) : []
  const drawerDiff = drawerCourse ? referenceChanges(shippedCourses.get(drawerCourse.id) as unknown as Record<string, unknown> | undefined, drawerCourse as unknown as Record<string, unknown>, ["title", "description", "minUnits", "maxUnits"]) : []
  const addNote = async () => {
    if (!noteDraft.trim() || !drawerCourseId) return
    await value.onCommand({ type: "annotate_course", courseId: drawerCourseId, note: { text: noteDraft.trim() } })
    setNoteDraft("")
  }

  const courseRow = (course: Course, sectionsCount: number) => {
    const unverified = overlayCourseIds.has(course.id)
    return <article className="course-row" key={course.id}>
      <button className="course-row-main" type="button" onClick={() => setDrawerCourseId(course.id)}>
        <b>{course.code}</b>
        <span className="course-row-title">{course.title}</span>
        <span className="course-row-meta">{course.minUnits === course.maxUnits ? `${course.maxUnits} units` : `${course.minUnits} to ${course.maxUnits} units`}{course.ways?.length ? ` · ${course.ways.join(", ")}` : ""}{sectionsCount > 0 ? ` · ${sectionsCount} section${sectionsCount === 1 ? "" : "s"}` : ""}</span>
        {unverified && <span className="unverified-banner">{shippedCourses.has(course.id) ? "Amended" : "Added"} by {overlayAuthor(course.id)} · unverified</span>}
      </button>
      <div className="course-row-actions">
        <button className={interested.has(course.id) ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_course_interest", courseId: course.id, interested: !interested.has(course.id) })}>{interested.has(course.id) ? "Interested ✓" : "Interested"}</button>
        <button className="chip-button plan" type="button" onClick={() => void planCourse(course)} aria-label={`Plan ${course.code} for ${shortTermLabel(planTermId)}`}>Plan for {shortTermLabel(planTermId)}</button>
      </div>
    </article>
  }

  const clubCard = (opportunity: Opportunity) => {
    const marked = (workspace.interestedOpportunityIds ?? []).includes(opportunity.id)
    const overlayEntry = (workspace.referenceOverlay?.opportunities ?? []).find((item) => item.id === opportunity.id)
    const diff = overlayEntry ? referenceChanges(shippedOpportunities.get(opportunity.id) as unknown as Record<string, unknown> | undefined, opportunity as unknown as Record<string, unknown>, ["summary", "commitment", "timing", "url"]) : []
    return <article className="club-card" key={opportunity.id}>
      <div className="club-card-top"><span className={`kind-chip ${opportunity.kind}`}>{opportunity.kind}</span>{overlayEntry && <span className="unverified-banner">{shippedOpportunities.has(opportunity.id) ? "Amended" : "Added"} by {overlayEntry.addedBy?.type === "agent" ? "agent" : "hand"} · unverified</span>}</div>
      <h3>{opportunity.name}</h3>
      <p>{opportunity.summary}</p>
      <dl className="club-facts">
        {opportunity.commitment && <div><dt>Commitment</dt><dd>{opportunity.commitment}</dd></div>}
        {opportunity.timing && <div><dt>Timing</dt><dd>{opportunity.timing}</dd></div>}
        {(opportunity.dates ?? []).map((dated) => <div key={dated.date + dated.label}><dt>{dated.label}</dt><dd>{dated.date}</dd></div>)}
      </dl>
      {diff.length > 0 && <div className="reference-diff"><b>Changed from the shipped listing</b><ul>{diff.map((change) => <li key={change.field}><span>{change.label}</span><em>{change.was}</em><strong>{change.now}</strong></li>)}</ul></div>}
      <div className="club-card-actions">
        <button className={marked ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_opportunity_interest", opportunityId: opportunity.id, interested: !marked })}>{marked ? "Interested ✓" : "Interested"}</button>
        {opportunity.url && <a className="text-button" href={opportunity.url} target="_blank" rel="noreferrer">Site</a>}
        {overlayEntry && <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "remove_reference_opportunity", opportunityId: opportunity.id })}>{shippedOpportunities.has(opportunity.id) ? "Restore original" : "Remove"}</button>}
      </div>
      {marked && (opportunity.dates ?? []).length === 0 && <p className="club-hint">No dates recorded yet, so nothing lands on the calendar. Add them here or have your agent fetch the real deadlines.</p>}
    </article>
  }

  return <div className="page courses-page">
    <header className="page-heading"><div><h1>Courses and clubs</h1><p>Track what you might take, plan what you will, and put your time on the calendar.</p></div></header>

    <div className="subtab-row" role="tablist" aria-label="Courses sections">
      {([["courses", "Courses"], ["clubs", "Clubs"], ["activities", "Activities"], ["history", "History"]] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "subtab active" : "subtab"} onClick={() => setTab(key)}>{label}</button>)}
    </div>

    {tab === "courses" && <div className="courses-layout">
      <section className="courses-main">
        <div className="course-search-row">
          <input aria-label="Search courses" placeholder={`Search ${value.catalog.courses.length.toLocaleString()} courses by code, title, or topic`} value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="secondary-button" type="button" onClick={() => setAddingCourse((current) => !current)}>{addingCourse ? "Cancel" : "Add a course"}</button>
        </div>
        {addingCourse && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitCourse() }}>
          <div className="add-form-row">
            <label>Code<input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} placeholder="CS 329S" required maxLength={12} /></label>
            <label>Title<input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required maxLength={120} /></label>
            <label>Units<select value={courseForm.units} onChange={(event) => setCourseForm({ ...courseForm, units: event.target.value })}>{[1, 2, 3, 4, 5].map((units) => <option key={units} value={units}>{units}</option>)}</select></label>
          </div>
          <label>Description<textarea rows={2} value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} maxLength={400} /></label>
          <label>Source URL<input value={courseForm.sourceUrl} onChange={(event) => setCourseForm({ ...courseForm, sourceUrl: event.target.value })} placeholder="https://navigator.stanford.edu/classes…" /></label>
          <p className="add-form-note">Hand-added courses carry an unverified banner until an agent or you confirm them against the catalog.</p>
          <button className="primary-button" type="submit">Add course</button>
        </form>}
        {query.trim() === "" && interestedCourses.length > 0 && <section className="interested-strip">
          <h2>Interested</h2>
          <div className="course-list">{interestedCourses.map((course) => <div key={course.id}>{courseRow(course, value.catalog.sections.filter((section) => section.courseId === course.id).length)}{workspace.courseIntents?.[course.id] && <p className="muted intent-note">Intended for {shortTermLabel(workspace.courseIntents[course.id])}</p>}</div>)}</div>
        </section>}
        {query.trim() === "" && interestedCourses.length === 0 && <div className="empty-card"><strong>Search the whole catalog</strong><p>Every one of the {value.catalog.courses.length.toLocaleString()} imported courses is here. Mark what looks interesting; plan what you decide on.</p></div>}
        {query.trim() !== "" && <div className="course-list">
          {results.length === 0 ? <div className="empty-card"><strong>No matches</strong><p>Nothing in the catalog matches that. Add it by hand or ask your agent to research it.</p></div> : results.map(({ course, sections }) => courseRow(course, sections.length))}
        </div>}
      </section>

      <aside className="plan-rail" aria-label="Plan">
        <div className="section-heading"><h2>Plan</h2><span className="muted" title="Completed courses and external credit plus planned units, against the degree total">{degree.projectedUnits} of {degree.requiredUnits} toward degree</span></div>
        <div className="term-select-row">
          <select className="chunky-select" aria-label="Planning term" value={planTermId} onChange={(event) => setPlanTermId(event.target.value)}>
            {terms.map((term) => <option key={term.id} value={term.id}>{termLabel(term.id)}</option>)}
          </select>
          <span className="unit-total">{plannedUnits} units</span>
        </div>
        {!scenario || scenario.courses.length === 0 ? <p className="muted plan-empty-note">Nothing planned for {termLabel(planTermId)} yet. Plan a course from the list and its lectures land on the calendar.</p> : <ul className="plan-rail-list">
          {scenario.courses.map((item) => {
            const course = value.catalog.courses.find((candidate) => candidate.id === item.courseId)
            return <li key={item.id}><span><b>{course?.code ?? item.courseId}</b><small>{course?.title}</small></span><em>{item.units}</em><button className="text-button" type="button" onClick={() => void removePlanned(item.id)} aria-label={`Remove ${course?.code ?? item.courseId} from plan`}>Remove</button></li>
          })}
        </ul>}
        {scenario && (rationaleDraft !== null ? <div className="plan-rationale-edit">
          <textarea aria-label="Why this scenario" rows={3} maxLength={500} value={rationaleDraft} onChange={(event) => setRationaleDraft(event.target.value)} autoFocus />
          <div className="form-row-actions"><button className="secondary-button small" type="button" onClick={() => setRationaleDraft(null)}>Cancel</button><button className="primary-button small" type="button" onClick={async () => { await value.onCommand({ type: "edit_plan", planId: plan!.id, scenarioId: scenario.id, operations: [{ type: "set_rationale", rationale: rationaleDraft }] }); setRationaleDraft(null) }}>Save</button></div>
        </div> : scenario.rationale ? <button className="plan-rationale" type="button" onClick={() => setRationaleDraft(scenario.rationale ?? "")} aria-label="Edit why this scenario"><b>Why this shape</b> {scenario.rationale}</button> : scenario.courses.length > 0 ? <button className="text-button plan-rationale-add" type="button" onClick={() => setRationaleDraft("")}>Add why this shape</button> : null)}
        {checks.length > 0 && <div className="plan-rail-checks">
          {checks.map((check, index) => <p key={index} className={check.severity}><b>{check.code.replaceAll("_", " ").toLowerCase()}</b> {check.message}{check.alternative ? ` ${check.suggestedRepairs[0]} instead.` : ""}</p>)}
        </div>}
      </aside>
    </div>}

    {tab === "clubs" && <div className="clubs-layout">
      <div className="course-search-row">
        <p className="muted">Interested clubs put their recorded dates on the calendar.</p>
        <button className="secondary-button" type="button" onClick={() => setAddingClub((current) => !current)}>{addingClub ? "Cancel" : "Add a club"}</button>
      </div>
      {addingClub && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitClub() }}>
        <div className="add-form-row">
          <label>Name<input value={clubForm.name} onChange={(event) => setClubForm({ ...clubForm, name: event.target.value })} required maxLength={100} /></label>
          <label>Kind<select value={clubForm.kind} onChange={(event) => setClubForm({ ...clubForm, kind: event.target.value })}><option value="club">Club</option><option value="research">Research</option><option value="program">Program</option></select></label>
          <label>Commitment<input value={clubForm.commitment} onChange={(event) => setClubForm({ ...clubForm, commitment: event.target.value })} placeholder="4 hours a week" maxLength={80} /></label>
        </div>
        <label>What it is<textarea rows={2} value={clubForm.summary} onChange={(event) => setClubForm({ ...clubForm, summary: event.target.value })} required maxLength={300} /></label>
        <label>Site<input value={clubForm.url} onChange={(event) => setClubForm({ ...clubForm, url: event.target.value })} placeholder="https://…" /></label>
        <div className="add-form-row">
          <label>Date<input type="date" value={clubForm.dateOne} onChange={(event) => setClubForm({ ...clubForm, dateOne: event.target.value })} /></label>
          <label>What happens then<input value={clubForm.dateOneLabel} onChange={(event) => setClubForm({ ...clubForm, dateOneLabel: event.target.value })} placeholder="Applications close" maxLength={80} /></label>
        </div>
        <div className="add-form-row">
          <label>Second date<input type="date" value={clubForm.dateTwo} onChange={(event) => setClubForm({ ...clubForm, dateTwo: event.target.value })} /></label>
          <label>What happens then<input value={clubForm.dateTwoLabel} onChange={(event) => setClubForm({ ...clubForm, dateTwoLabel: event.target.value })} maxLength={80} /></label>
        </div>
        <button className="primary-button" type="submit">Add club</button>
      </form>}
      <div className="club-grid">{opportunities.map(clubCard)}</div>
    </div>}

    {tab === "activities" && <div className="activities-layout">
      <div className="course-search-row">
        <p className="muted">Research, jobs, athletics: recurring time that belongs on the calendar next to your classes.</p>
        <button className="secondary-button" type="button" onClick={() => setActivityOpen((current) => !current)}>{activityOpen ? "Cancel" : "Add an activity"}</button>
      </div>
      {activityOpen && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitActivity() }}>
        <div className="add-form-row">
          <label>Name<input value={activityForm.name} onChange={(event) => setActivityForm({ ...activityForm, name: event.target.value })} required maxLength={80} /></label>
          <label>Kind<select value={activityForm.kind} onChange={(event) => setActivityForm({ ...activityForm, kind: event.target.value })}>{["research", "job", "volunteering", "athletics", "arts", "other"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
          <label>With<input value={activityForm.organizer} onChange={(event) => setActivityForm({ ...activityForm, organizer: event.target.value })} placeholder="Professor, group, employer" maxLength={80} /></label>
        </div>
        <label>Details<textarea rows={2} value={activityForm.detail} onChange={(event) => setActivityForm({ ...activityForm, detail: event.target.value })} maxLength={400} /></label>
        <fieldset className="days-fieldset"><legend>Repeats on</legend>
          <div className="day-toggle-row">{dayChoices.map(([code, label]) => <label key={code} className={activityForm.days.includes(code) ? "day-toggle active" : "day-toggle"}><input type="checkbox" checked={activityForm.days.includes(code)} onChange={(event) => setActivityForm({ ...activityForm, days: event.target.checked ? [...activityForm.days, code] : activityForm.days.filter((day) => day !== code) })} />{label}</label>)}</div>
        </fieldset>
        <div className="add-form-row">
          <label>From<input type="time" value={activityForm.start} onChange={(event) => setActivityForm({ ...activityForm, start: event.target.value })} /></label>
          <label>To<input type="time" value={activityForm.end} onChange={(event) => setActivityForm({ ...activityForm, end: event.target.value })} /></label>
        </div>
        <div className="add-form-row">
          <label>Starts<input type="date" value={activityForm.startDate} onChange={(event) => setActivityForm({ ...activityForm, startDate: event.target.value })} /></label>
          <label>Ends<input type="date" value={activityForm.endDate} onChange={(event) => setActivityForm({ ...activityForm, endDate: event.target.value })} /></label>
        </div>
        <div className="add-form-row">
          <label>One-off date<input type="date" value={activityForm.dateOne} onChange={(event) => setActivityForm({ ...activityForm, dateOne: event.target.value })} /></label>
          <label>What happens then<input value={activityForm.dateOneLabel} onChange={(event) => setActivityForm({ ...activityForm, dateOneLabel: event.target.value })} placeholder="Application due" maxLength={80} /></label>
        </div>
        <button className="primary-button" type="submit">{activityForm.id ? "Save activity" : "Add activity"}</button>
      </form>}
      {(workspace.activities ?? []).length === 0 && !activityOpen ? <div className="empty-card"><strong>No activities yet</strong><p>Add research, a job, or practice hours, and the weekly schedule shows up beside your classes.</p></div> : <div className="club-grid">
        {(workspace.activities ?? []).map((activity) => <article className="club-card" key={activity.id}>
          <div className="club-card-top"><span className={`kind-chip ${activity.kind === "research" ? "research" : "club"}`}>{activity.kind}</span>{activity.addedBy === "agent" && <span className="agent-chip">Agent</span>}</div>
          <h3>{activity.name}</h3>
          {activity.detail && <p>{activity.detail}</p>}
          <dl className="club-facts">
            {activity.organizer && <div><dt>With</dt><dd>{activity.organizer}</dd></div>}
            {activity.schedule && <div><dt>Weekly</dt><dd>{activity.schedule.days.join(", ")} {activity.schedule.start} to {activity.schedule.end}</dd></div>}
            {(activity.dates ?? []).map((dated) => <div key={dated.date}><dt>{dated.label}</dt><dd>{dated.date}</dd></div>)}
          </dl>
          <div className="club-card-actions">
            <button className="text-button" type="button" onClick={() => { setActivityForm({ id: activity.id, name: activity.name, kind: activity.kind, organizer: activity.organizer ?? "", detail: activity.detail ?? "", days: activity.schedule?.days ?? [], start: activity.schedule?.start ?? "15:00", end: activity.schedule?.end ?? "17:00", startDate: activity.startDate ?? "", endDate: activity.endDate ?? "", dateOne: activity.dates?.[0]?.date ?? "", dateOneLabel: activity.dates?.[0]?.label ?? "" }); setActivityOpen(true); setTab("activities") }}>Edit</button>
            <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "remove_activity", activityId: activity.id })}>Remove</button>
          </div>
        </article>)}
      </div>}
    </div>}

    {tab === "history" && <div className="history-layout">
      <section className="panel-card">
        <div className="section-heading"><h2>Completed courses</h2><span className="count-chip">{completedCourses.length}</span></div>
        <input aria-label="Search the catalog" placeholder="Search the catalog to mark a course completed" value={completedQuery} onChange={(event) => setCompletedQuery(event.target.value)} />
        {completedMatches.length > 0 && <div className="completed-search-results">{completedMatches.map((course) => <button key={course.id} type="button" onClick={() => { void value.onCommand({ type: "set_completed_courses", courseIds: [...workspace.profile.completedCourseIds, course.id] }); setCompletedQuery("") }}><b>{course.code}</b><span>{course.title}</span><em>Add</em></button>)}</div>}
        {completedCourses.length === 0 ? <p className="muted">Courses you mark completed count toward prerequisites and units.</p> : <ul className="history-list">{completedCourses.map((course) => <li key={course.id}><span><b>{course.code}</b><small>{course.title}</small></span><button className="text-button" type="button" onClick={() => void value.onCommand({ type: "set_completed_courses", courseIds: workspace.profile.completedCourseIds.filter((id) => id !== course.id) })}>Remove</button></li>)}</ul>}
      </section>
      <section className="panel-card">
        <div className="section-heading"><h2>Credit before Stanford</h2><button className="secondary-button small" type="button" onClick={() => setAddingCredit((current) => !current)}>{addingCredit ? "Cancel" : "Add credit"}</button></div>
        <p className="muted">AP and IB come from their exam lists; college co-enrollment is entered directly. The units Stanford actually granted are yours to type in from your credit report.</p>
        {addingCredit && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void addCredit() }}>
          <div className="kind-toggle-row" role="radiogroup" aria-label="Credit type">
            {([["ap", "AP"], ["ib", "IB"], ["college", "College course"]] as const).map(([kind, label]) => <button key={kind} type="button" role="radio" aria-checked={creditKind === kind} className={creditKind === kind ? "day-toggle active" : "day-toggle"} onClick={() => chooseCreditKind(kind)}>{label}</button>)}
          </div>
          {creditKind === "ap" && <>
            <label>Exam<select value={creditExam} onChange={(event) => chooseCredit(event.target.value, creditScore)}>{apExamPresets.map((preset) => <option key={preset.exam} value={preset.exam}>{preset.exam}</option>)}</select></label>
            <div className="add-form-row">
              <label>Score<select value={creditScore} onChange={(event) => chooseCredit(creditExam, event.target.value)}>{apScoreChoices.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>
              <label>Units Stanford granted<input type="number" min={0} max={45} value={creditUnits} onChange={(event) => setCreditUnits(event.target.value)} /></label>
            </div>
            {creditSatisfies.length > 0 && <p className="add-form-note">Counts as {creditSatisfies.join(" and ")} by default.</p>}
            {apGrantFor(creditExam, Number(creditScore)) === null && <p className="add-form-note">The chart grants no units for this score; record it with the units from your own credit report.</p>}
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
        {apCredits.length === 0 ? <p className="muted">No credits recorded.</p> : <ul className="history-list">{apCredits.map((credit) => <li key={credit.id}><span><b>{credit.exam}</b><small>{[creditCategory(credit) === "ib" ? "IB" : creditCategory(credit) === "college" ? (credit.institution || "College") : "AP", credit.score !== undefined ? `score ${credit.score}` : null, credit.unitsGranted !== undefined ? `${credit.unitsGranted} units granted` : null].filter(Boolean).join(" · ")}</small></span><button className="text-button" type="button" onClick={() => void value.onCommand({ type: "update_academic_history", patch: { apCredits: apCredits.filter((item) => item.id !== credit.id) } })}>Remove</button></li>)}</ul>}
      </section>
    </div>}

    {drawerCourse && <div className="drawer-backdrop" role="presentation" onMouseDown={() => setDrawerCourseId("")}>
      <aside className="course-drawer" aria-label={`${drawerCourse.code} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading"><div><h2>{drawerCourse.code}</h2><p className="drawer-subtitle">{drawerCourse.title}</p></div><button className="icon-button" onClick={() => setDrawerCourseId("")} aria-label="Close course details">×</button></div>
        {overlayCourseIds.has(drawerCourse.id) && <p className="unverified-banner block">This entry was {shippedCourses.has(drawerCourse.id) ? "amended" : "added"} outside the official import and is unverified.</p>}
        {drawerDiff.length > 0 && <div className="reference-diff"><b>Changed from the shipped catalog</b><ul>{drawerDiff.map((change) => <li key={change.field}><span>{change.label}</span><em>{change.was}</em><strong>{change.now}</strong></li>)}</ul></div>}
        {drawerCourse.description && <p className="drawer-description">{drawerCourse.description}</p>}
        {drawerCourse.prerequisites && drawerCourse.prerequisites.length > 0 && <div className="drawer-block"><h3>Prerequisites</h3><p>{drawerCourse.prerequisites.map((id) => value.catalog.courses.find((course) => course.id === id)?.code ?? id).join(", ")}</p></div>}
        {drawerSections.length > 0 && <div className="drawer-block"><h3>Sections</h3><ul className="drawer-section-list">{drawerSections.map((section) => <li key={section.id}><b>{section.sectionNumber}</b><span>{section.instructor}</span><span>{section.meetings.map((meeting) => `${meeting.days.join("/")} ${meeting.start} to ${meeting.end}`).join("; ")}</span></li>)}</ul></div>}
        <div className="drawer-block">
          <h3>Notes</h3>
          {drawerNotes.length === 0 && <p className="muted">Nothing yet. Impressions, warnings, and instructor gossip all belong here.</p>}
          <ul className="course-note-list">{drawerNotes.map((note) => <li key={note.id}><span className={`note-author ${note.author}`}>{note.author === "agent" ? "Agent" : "You"}</span><p>{note.text}</p><button className="text-button" type="button" onClick={() => void value.onCommand({ type: "annotate_course", courseId: drawerCourse.id, removeNoteId: note.id })} aria-label="Remove note">Remove</button></li>)}</ul>
          <div className="course-note-add"><textarea aria-label="Add a note" rows={2} placeholder="Seems heavy alongside MATH 51. RateMyProfessor is skeptical." value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={600} /><button className="primary-button small" type="button" onClick={() => void addNote()} disabled={!noteDraft.trim()}>Add note</button></div>
        </div>
        <div className="drawer-actions">
          <button className={interested.has(drawerCourse.id) ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_course_interest", courseId: drawerCourse.id, interested: !interested.has(drawerCourse.id) })}>{interested.has(drawerCourse.id) ? "Interested ✓" : "Interested"}</button>
          <button className="primary-button" type="button" onClick={() => void planCourse(drawerCourse)}>Plan for {shortTermLabel(planTermId)}</button>
        </div>
      </aside>
    </div>}
  </div>
}
