"use client"

import Link from "next/link"
import { useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { apExamPresets, apGrantFor, apScoreChoices, apUnitChoices } from "@/data/institutions/stanford-ap"
import { degreeOptions, defaultGraduationTerm, parseTermId, standingForTerm, supportsTimeline, termId, termLabel, timelineFor } from "@/domain/timeline"

const planningDays = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"]
] as const

// Standing is normally derived from the degree timeline; an explicit choice
// from this list overrides it. Free text has no business here.
const standingChoices = ["Frosh", "Sophomore", "Junior", "Senior", "Fifth year", "Coterm", "Graduate student"]

const priorityChoices = [
  "Keep mornings free",
  "Keep Fridays light",
  "No classes after 5 pm",
  "No back-to-back classes",
  "Small discussion classes",
  "Front-load major requirements",
  "Leave room for research",
  "Protect club and athletics time",
  "One exploratory class each quarter",
  "Target a lighter first quarter"
]

export const ProfilePage = () => {
  const value = useWorkspace()
  const profile = value.workspace.profile
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [summary, setSummary] = useState(profile.summary)
  const [earliestStart, setEarliestStart] = useState(profile.earliestStart)
  const [latestEnd, setLatestEnd] = useState(profile.latestEnd)
  const [excludedDays, setExcludedDays] = useState([...profile.excludedDays])
  const [addingCredit, setAddingCredit] = useState(false)
  const [creditExam, setCreditExam] = useState(apExamPresets[0].exam)
  const [creditScore, setCreditScore] = useState("5")
  const [creditUnits, setCreditUnits] = useState(() => String(apGrantFor(apExamPresets[0].exam, 5)?.units ?? 0))
  const [creditSatisfies, setCreditSatisfies] = useState<string[]>(() => apGrantFor(apExamPresets[0].exam, 5)?.satisfiesCodes ?? [])
  const [addingPriority, setAddingPriority] = useState(false)
  const [priorityLabel, setPriorityLabel] = useState(priorityChoices[0])
  const [priorityStrength, setPriorityStrength] = useState<"hard" | "soft">("soft")
  const [completedQuery, setCompletedQuery] = useState("")
  const saveProfile = async () => {
    await value.onCommand({ type: "update_profile", patch: { name, summary, earliestStart, latestEnd, excludedDays } })
    setEditing(false)
  }
  const apCredits = profile.apCredits ?? []
  const saveCredits = (credits: typeof apCredits) => value.onCommand({ type: "update_academic_history", patch: { apCredits: credits } })
  const chooseCredit = (exam: string, score: string) => {
    setCreditExam(exam)
    setCreditScore(score)
    const grant = apGrantFor(exam, Number(score))
    setCreditUnits(String(grant?.units ?? 0))
    setCreditSatisfies(grant?.satisfiesCodes ?? [])
  }
  const courseIdForCode = (code: string) => value.catalog.courses.find((course) => course.code === code)?.id
  const addCredit = async () => {
    const credit = {
      id: `AP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      exam: creditExam,
      score: Number(creditScore),
      unitsGranted: Number(creditUnits),
      satisfiesCourseIds: creditSatisfies.map(courseIdForCode).filter((id): id is string => Boolean(id))
    }
    await saveCredits([...apCredits, credit])
    chooseCredit(apExamPresets[0].exam, "5")
    setAddingCredit(false)
  }
  const timelineSupported = supportsTimeline(value.workspace)
  const timeline = timelineFor(profile, new Date())
  const entryYear = parseTermId(timeline.entryTermId)?.year ?? 2026
  const gradYear = parseTermId(timeline.expectedGraduationTermId)?.year ?? entryYear + 4
  const derivedStanding = timelineSupported ? standingForTerm(timeline, value.workspace.currentTermId) : ""
  const saveTimeline = (nextEntryYear: number, nextGradYear: number, nextDegree: string) => {
    const entryTermId = termId(nextEntryYear, "AUTUMN")
    const fallback = defaultGraduationTerm(entryTermId, nextDegree)
    const graduationTermId = nextGradYear > nextEntryYear ? termId(nextGradYear, "SPRING") : fallback
    return value.onCommand({ type: "update_academic_history", patch: { timeline: { entryTermId, expectedGraduationTermId: graduationTermId, degree: nextDegree } } })
  }
  const saveStanding = (standing: string) => value.onCommand({ type: "update_profile", patch: { classYear: standing } })
  const addPriority = async () => {
    await value.onCommand({ type: "set_student_preference", preference: { id: `PREFERENCE-${crypto.randomUUID().toUpperCase()}`, label: priorityLabel, strength: priorityStrength, value: true } })
    setPriorityLabel(priorityChoices[0])
    setPriorityStrength("soft")
    setAddingPriority(false)
  }
  const availablePriorities = priorityChoices.filter((choice) => !profile.preferences.some((preference) => preference.label === choice))
  const completedCourses = profile.completedCourseIds.map((id) => value.catalog.courses.find((course) => course.id === id)).filter(Boolean)
  const courseMatches = completedQuery.trim() ? value.catalog.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(completedQuery.toLowerCase()) && !profile.completedCourseIds.includes(course.id)).slice(0, 6) : []

  return <div className="page settings-page profile-tab-page">
    <header className="page-heading"><div><h1>Profile</h1>{timelineSupported && <p className="heading-sub">{timeline.degree} · {termLabel(timeline.entryTermId)} to {termLabel(timeline.expectedGraduationTermId)}</p>}</div><Link className="secondary-button" href="/app/settings">Account settings</Link></header>
    <section className="settings-card profile-settings"><div className="section-heading"><div><h2>{profile.name || "About you"}</h2></div><button className="text-button" type="button" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel" : "Edit profile"}</button></div>
      {editing ? <form onSubmit={(event) => { event.preventDefault(); void saveProfile() }}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Goals and planning context<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><div className="settings-inline"><label>Earliest class<input type="time" value={earliestStart} onChange={(event) => setEarliestStart(event.target.value)} /></label><label>Latest class end<input type="time" value={latestEnd} onChange={(event) => setLatestEnd(event.target.value)} /></label></div><fieldset className="protected-days"><legend>Days to keep free</legend><p>Plan checks treat meetings on these days as conflicts.</p><div>{planningDays.map(([day, label]) => <label key={day}><input type="checkbox" checked={excludedDays.includes(day)} onChange={(event) => setExcludedDays((current) => event.target.checked ? [...current, day] : current.filter((item) => item !== day))} /><span>{label}</span></label>)}</div></fieldset><div className="modal-actions"><button className="primary-button" type="submit">Save profile</button></div></form> : <>{profile.summary ? <p>{profile.summary}</p> : <p className="muted">Add your name and what you want help figuring out.</p>}<dl>
        <div><dt><label htmlFor="standing-select">Class standing</label></dt><dd><select id="standing-select" className="inline-select" value={standingChoices.includes(profile.classYear ?? "") ? profile.classYear : ""} onChange={(event) => void saveStanding(event.target.value)}><option value="">{derivedStanding ? `${derivedStanding} (from timeline)` : "Not set"}</option>{standingChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></dd></div>
        <div><dt>Catalog year</dt><dd>{profile.catalogYear}</dd></div>
        <div><dt>Earliest start</dt><dd>{profile.earliestStart}</dd></div>
        <div><dt>Latest end</dt><dd>{profile.latestEnd}</dd></div>
        <div><dt>Protected days</dt><dd>{profile.excludedDays.length ? planningDays.filter(([day]) => profile.excludedDays.includes(day)).map(([, label]) => label.slice(0, 3)).join(", ") : "None"}</dd></div>
      </dl></>}
    </section>
    {timelineSupported && <section className="settings-card timeline-settings"><div className="section-heading"><div><h2>Degree timeline</h2></div><span className="muted">{termLabel(timeline.entryTermId)} to {termLabel(timeline.expectedGraduationTermId)}</span></div>
      <p>Entry, graduation, and degree drive the four and five year map, class standing, and unit targets.</p>
      <div className="timeline-fields">
        <label>Degree<select value={timeline.degree} onChange={(event) => void saveTimeline(entryYear, parseTermId(timeline.expectedGraduationTermId)?.year ?? entryYear + (event.target.value.includes("MS") ? 5 : 4), event.target.value)}>{degreeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}{!degreeOptions.some((option) => option.id === timeline.degree) && <option value={timeline.degree}>{timeline.degree}</option>}</select></label>
        <label>Entered in autumn<select value={entryYear} onChange={(event) => void saveTimeline(Number(event.target.value), gradYear, timeline.degree)}>{Array.from({ length: 9 }, (_, index) => entryYear - 4 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Graduating in spring<select value={gradYear} onChange={(event) => void saveTimeline(entryYear, Number(event.target.value), timeline.degree)}>{Array.from({ length: 8 }, (_, index) => entryYear + 1 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      </div>
    </section>}
    <section className="settings-card completed-settings"><div className="section-heading"><div><h2>Completed courses</h2><span className="count-badge">{completedCourses.length}</span></div></div><label className="completed-course-search">Search the catalog<input value={completedQuery} onChange={(event) => setCompletedQuery(event.target.value)} /></label>{courseMatches.length > 0 && <div className="completed-search-results">{courseMatches.map((course) => <button key={course.id} type="button" onClick={() => { void value.onCommand({ type: "set_completed_courses", courseIds: [...profile.completedCourseIds, course.id] }); setCompletedQuery("") }}><b>{course.code}</b><span>{course.title}</span><em>Add</em></button>)}</div>}{completedCourses.length === 0 ? <div className="settings-empty"><strong>No completed courses added</strong><span>Your account starts empty. Add a course when you want it used in planning.</span></div> : <div className="completed-course-list">{completedCourses.map((course) => course && <article key={course.id}><span><strong>{course.code}</strong><small>{course.title}</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "set_completed_courses", courseIds: profile.completedCourseIds.filter((id) => id !== course.id) })}>Remove</button></article>)}</div>}</section>
    <section className="settings-card credit-settings"><div className="section-heading"><div><h2>AP credit</h2><span className="count-badge">{apCredits.length}</span></div><button className="secondary-button" type="button" onClick={() => setAddingCredit((current) => !current)}>{addingCredit ? "Cancel" : "Add credit"}</button></div>
      <p>Credits count toward units, prerequisites, and requirement checks. Defaults follow Stanford&apos;s AP chart; adjust units to match your credit report.</p>
      {addingCredit && <form className="credit-form" onSubmit={(event) => { event.preventDefault(); void addCredit() }}>
        <label>Exam<select value={creditExam} onChange={(event) => chooseCredit(event.target.value, creditScore)}>{apExamPresets.map((preset) => <option key={preset.exam} value={preset.exam}>{preset.exam}</option>)}</select></label>
        <div className="settings-inline">
          <label>Score<select value={creditScore} onChange={(event) => chooseCredit(creditExam, event.target.value)}>{apScoreChoices.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>
          <label>Units granted<select value={creditUnits} onChange={(event) => setCreditUnits(event.target.value)}>{[...new Set([Number(creditUnits), ...apUnitChoices])].sort((a, b) => a - b).map((units) => <option key={units} value={units}>{units}</option>)}</select></label>
        </div>
        {creditSatisfies.length > 0 && <p className="credit-form-note">Counts as {creditSatisfies.join(" and ")}.</p>}
        {apGrantFor(creditExam, Number(creditScore)) === null && <p className="credit-form-note">Stanford grants no units for this exam and score. It is recorded for context only.</p>}
        <div className="modal-actions"><button className="primary-button" type="submit">Save credit</button></div>
      </form>}
      <p className="credit-form-note">IB and college transfer credit come in through your agent, which reads your transcript and records each grant with update_student_context.</p>
      {apCredits.length === 0 ? <div className="settings-empty"><strong>No credits added</strong><span>Record AP results so plans and requirement checks account for them.</span></div> : <div className="completed-course-list">{apCredits.map((credit) => <article key={credit.id}><span><strong>{credit.exam}</strong><small>{[credit.score !== undefined ? `Score ${credit.score}` : null, credit.unitsGranted !== undefined ? `${credit.unitsGranted} units` : null, credit.satisfiesCourseIds?.length ? `Counts as ${credit.satisfiesCourseIds.map((id) => value.catalog.courses.find((course) => course.id === id)?.code ?? id).join(", ")}` : null].filter(Boolean).join(" · ") || "Recorded credit"}</small></span><button className="text-button" type="button" onClick={() => saveCredits(apCredits.filter((item) => item.id !== credit.id))}>Remove</button></article>)}</div>}
    </section>
    <section className="settings-card priority-settings"><div className="section-heading"><div><h2>Planning priorities</h2></div>{availablePriorities.length > 0 && <button className="secondary-button" type="button" onClick={() => { setPriorityLabel(availablePriorities[0]); setAddingPriority((current) => !current) }}>{addingPriority ? "Cancel" : "Add priority"}</button>}</div>
      <p>Chosen from a fixed list so checks can read them deterministically. Anything more specific reaches the workspace through your agent.</p>
      {addingPriority && <form className="priority-form" onSubmit={(event) => { event.preventDefault(); void addPriority() }}>
        <label>Priority<select value={priorityLabel} onChange={(event) => setPriorityLabel(event.target.value)}>{availablePriorities.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>
        <fieldset className="priority-strength"><legend className="sr-only">Importance</legend>
          <label><input type="radio" name="priority-strength" checked={priorityStrength === "soft"} onChange={() => setPriorityStrength("soft")} />Preference</label>
          <label><input type="radio" name="priority-strength" checked={priorityStrength === "hard"} onChange={() => setPriorityStrength("hard")} />Hard constraint</label>
        </fieldset>
        <button className="primary-button" type="submit">Save priority</button>
      </form>}
      <div className="priority-list">{profile.preferences.map((preference) => <article key={preference.id}><span className={preference.strength}>{preference.strength === "hard" ? "Hard" : "Flexible"}</span><strong>{preference.label}</strong><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_student_preference", preferenceId: preference.id })} aria-label={`Remove ${preference.label}`}>Remove</button></article>)}</div>
    </section>
  </div>
}
