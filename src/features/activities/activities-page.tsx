"use client"

import { useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { mergedOpportunities, referenceChanges } from "@/domain/reference"
import type { Activity, Day, Opportunity } from "@/domain/types"

// Clubs and every other commitment live here together. Joining a club turns
// it into a real activity: its meetings and events go on the calendar under
// the club's name, notes stay attached, and anything with registrar units
// counts into the academics totals. Things added here are removed here, so
// the calendar never quietly loses a source of truth.

const dayChoices = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]] as const

const humanEvidence = (id: string, claim: string, sourceUrl: string) => ({
  id,
  title: "Added by hand",
  claim,
  sourceUrl: sourceUrl || "https://studentaffairs.stanford.edu/",
  sourceTitle: "Student-provided reference",
  retrievedAt: new Date().toISOString(),
  classification: "student",
  confidence: 0.6,
  status: "current"
})

const emptyActivityForm = { id: "", name: "", kind: "research", organizer: "", detail: "", notes: "", units: "", days: [] as string[], start: "15:00", end: "17:00", startDate: "", endDate: "" }

export const ActivitiesPage = () => {
  const value = useWorkspace()
  const workspace = value.workspace
  const [filter, setFilter] = useState<"all" | "mine" | "directory">("all")
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityForm, setActivityForm] = useState(emptyActivityForm)
  const [addingClub, setAddingClub] = useState(false)
  const [clubForm, setClubForm] = useState({ name: "", kind: "club", summary: "", url: "", commitment: "", dateOne: "", dateOneLabel: "" })
  const [eventFormFor, setEventFormFor] = useState("")
  const [eventForm, setEventForm] = useState({ date: "", label: "", start: "", end: "" })
  const [notesFor, setNotesFor] = useState("")
  const [notesDraft, setNotesDraft] = useState("")

  const institution = institutionForWorkspace(workspace)
  const shippedOpportunities = useMemo(() => new Map(institution.buildOpportunities().map((opportunity) => [opportunity.id, opportunity])), [institution])
  const opportunities = useMemo(() => mergedOpportunities(institution.buildOpportunities(), workspace.referenceOverlay?.opportunities), [institution, workspace.referenceOverlay?.opportunities])
  const activities = useMemo(() => workspace.activities ?? [], [workspace.activities])
  const joinedByOpportunity = useMemo(() => new Map(activities.filter((activity) => activity.opportunityId).map((activity) => [activity.opportunityId!, activity])), [activities])

  const saveActivity = async (activity: Partial<Activity> & { name: string }) => {
    await value.onCommand({ type: "upsert_activity", activity })
  }

  const submitActivity = async () => {
    if (!activityForm.name.trim()) return
    const existing = activities.find((item) => item.id === activityForm.id)
    const schedule = activityForm.days.length > 0 ? { days: activityForm.days as Day[], start: activityForm.start, end: activityForm.end } : undefined
    await saveActivity({
      id: activityForm.id || undefined,
      name: activityForm.name.trim(),
      kind: activityForm.kind as Activity["kind"],
      organizer: activityForm.organizer.trim() || undefined,
      detail: activityForm.detail.trim() || undefined,
      notes: activityForm.notes.trim() || undefined,
      units: activityForm.units ? Number(activityForm.units) : undefined,
      schedule,
      startDate: activityForm.startDate || undefined,
      endDate: activityForm.endDate || undefined,
      dates: existing?.dates,
      opportunityId: existing?.opportunityId,
      sourceUrl: existing?.sourceUrl
    })
    setActivityOpen(false)
    setActivityForm(emptyActivityForm)
  }

  const joinClub = async (opportunity: Opportunity) => {
    await saveActivity({
      id: `ACTIVITY-CLUB-${opportunity.id.replace(/^OPPORTUNITY-/, "").slice(0, 40)}`,
      name: opportunity.name,
      kind: "club",
      opportunityId: opportunity.id,
      sourceUrl: opportunity.url,
      organizer: undefined
    })
    setFilter("all")
  }

  const submitClub = async () => {
    if (!clubForm.name.trim() || !clubForm.summary.trim()) return
    const dates = clubForm.dateOne && clubForm.dateOneLabel ? [{ date: clubForm.dateOne, label: clubForm.dateOneLabel }] : undefined
    await value.onCommand({ type: "extend_reference_opportunity", opportunity: { name: clubForm.name.trim(), kind: clubForm.kind, summary: clubForm.summary.trim(), url: clubForm.url.trim() || undefined, commitment: clubForm.commitment.trim() || undefined, dates }, evidence: humanEvidence(`EVIDENCE-HAND-CLUB-${clubForm.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 40)}`, `${clubForm.name.trim()} added by hand.`, clubForm.url.trim()) })
    setAddingClub(false)
    setClubForm({ name: "", kind: "club", summary: "", url: "", commitment: "", dateOne: "", dateOneLabel: "" })
  }

  const submitEvent = async (activity: Activity) => {
    if (!eventForm.date || !eventForm.label.trim()) return
    await saveActivity({
      ...activity,
      dates: [...(activity.dates ?? []), { date: eventForm.date, label: eventForm.label.trim(), ...(eventForm.start ? { start: eventForm.start } : {}), ...(eventForm.start && eventForm.end ? { end: eventForm.end } : {}) }]
    })
    setEventFormFor("")
    setEventForm({ date: "", label: "", start: "", end: "" })
  }

  const removeEvent = async (activity: Activity, index: number) => {
    await saveActivity({ ...activity, dates: (activity.dates ?? []).filter((_, position) => position !== index) })
  }

  const saveNotes = async (activity: Activity) => {
    await saveActivity({ ...activity, notes: notesDraft.trim() || undefined })
    setNotesFor("")
    setNotesDraft("")
  }

  const editActivity = (activity: Activity) => {
    setActivityForm({ id: activity.id, name: activity.name, kind: activity.kind, organizer: activity.organizer ?? "", detail: activity.detail ?? "", notes: activity.notes ?? "", units: activity.units ? String(activity.units) : "", days: activity.schedule?.days ?? [], start: activity.schedule?.start ?? "15:00", end: activity.schedule?.end ?? "17:00", startDate: activity.startDate ?? "", endDate: activity.endDate ?? "" })
    setActivityOpen(true)
  }

  const mineCard = (activity: Activity) => {
    const linked = activity.opportunityId ? opportunities.find((opportunity) => opportunity.id === activity.opportunityId) : undefined
    return <article className="club-card" key={activity.id}>
      <div className="club-card-top"><span className={`kind-chip ${activity.kind === "club" ? "club" : activity.kind === "research" ? "research" : "program"}`}>{activity.kind}</span>{activity.addedBy === "agent" && <span className="agent-chip">Agent</span>}</div>
      <h3>{activity.name}</h3>
      {(activity.detail || linked?.summary) && <p>{activity.detail ?? linked?.summary}</p>}
      <dl className="club-facts">
        {activity.organizer && <div><dt>With</dt><dd>{activity.organizer}</dd></div>}
        {activity.schedule && <div><dt>Weekly</dt><dd>{activity.schedule.days.join(", ")} {activity.schedule.start} to {activity.schedule.end}</dd></div>}
        {activity.units && <div><dt>Units</dt><dd>{activity.units}, counted in academics</dd></div>}
        {(activity.dates ?? []).map((dated, index) => <div key={dated.date + dated.label}><dt>{dated.label}</dt><dd>{dated.date}{dated.start ? ` · ${dated.start}${dated.end ? ` to ${dated.end}` : ""}` : ""} <button className="text-button" type="button" onClick={() => void removeEvent(activity, index)} aria-label={`Remove ${dated.label}`}>Remove</button></dd></div>)}
      </dl>
      {activity.notes && notesFor !== activity.id && <p className="activity-notes">{activity.notes}</p>}
      {notesFor === activity.id ? <div className="plan-rationale-edit">
        <textarea aria-label={`Notes on ${activity.name}`} rows={3} maxLength={600} value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} autoFocus />
        <div className="form-row-actions"><button className="secondary-button small" type="button" onClick={() => setNotesFor("")}>Cancel</button><button className="primary-button small" type="button" onClick={() => void saveNotes(activity)}>Save</button></div>
      </div> : null}
      {eventFormFor === activity.id && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitEvent(activity) }}>
        <div className="add-form-row">
          <label>Date<input type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} required /></label>
          <label>What happens<input value={eventForm.label} onChange={(event) => setEventForm({ ...eventForm, label: event.target.value })} placeholder="General meeting" required maxLength={80} /></label>
        </div>
        <div className="add-form-row">
          <label>Start<input type="time" value={eventForm.start} onChange={(event) => setEventForm({ ...eventForm, start: event.target.value })} /></label>
          <label>End<input type="time" value={eventForm.end} onChange={(event) => setEventForm({ ...eventForm, end: event.target.value })} disabled={!eventForm.start} /></label>
        </div>
        <p className="add-form-note">Lands on the calendar as {activity.name}. Leave the times empty for an all-day entry.</p>
        <button className="primary-button small" type="submit">Add event</button>
      </form>}
      <div className="club-card-actions">
        <button className="text-button" type="button" onClick={() => { setEventFormFor(eventFormFor === activity.id ? "" : activity.id); setEventForm({ date: "", label: "", start: "", end: "" }) }}>{eventFormFor === activity.id ? "Cancel event" : "Add event"}</button>
        <button className="text-button" type="button" onClick={() => { setNotesFor(activity.id); setNotesDraft(activity.notes ?? "") }}>{activity.notes ? "Edit notes" : "Add notes"}</button>
        <button className="text-button" type="button" onClick={() => editActivity(activity)}>Edit</button>
        {linked?.url && <a className="text-button" href={linked.url} target="_blank" rel="noreferrer">Site</a>}
        <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "remove_activity", activityId: activity.id })}>Remove</button>
      </div>
    </article>
  }

  const directoryCard = (opportunity: Opportunity) => {
    const marked = (workspace.interestedOpportunityIds ?? []).includes(opportunity.id)
    const joined = joinedByOpportunity.get(opportunity.id)
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
        {joined ? <span className="chip-button active joined-chip">Joined ✓</span> : <button className="chip-button plan" type="button" onClick={() => void joinClub(opportunity)}>Join</button>}
        <button className={marked ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_opportunity_interest", opportunityId: opportunity.id, interested: !marked })}>{marked ? "Interested ✓" : "Interested"}</button>
        {opportunity.url && <a className="text-button" href={opportunity.url} target="_blank" rel="noreferrer">Site</a>}
        {overlayEntry && <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "remove_reference_opportunity", opportunityId: opportunity.id })}>{shippedOpportunities.has(opportunity.id) ? "Restore original" : "Remove"}</button>}
      </div>
      {joined && <p className="club-hint">Joined. Manage its meetings, events, and notes in your list above.</p>}
      {marked && !joined && (opportunity.dates ?? []).length === 0 && <p className="club-hint">No dates recorded yet, so nothing lands on the calendar. Add them here or have your agent fetch the real ones.</p>}
    </article>
  }

  return <div className="page courses-page">
    <header className="page-heading"><div><h1>Clubs and activities</h1><p>Join what matters, put its time on the calendar, and keep the notes attached.</p></div></header>

    <div className="course-search-row activities-controls">
      <div className="kind-toggle-row" role="radiogroup" aria-label="Show">
        {([["all", "All"], ["mine", "Mine"], ["directory", "Directory"]] as const).map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={filter === key} className={filter === key ? "day-toggle active" : "day-toggle"} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
      <div className="form-row-actions">
        <button className="secondary-button" type="button" onClick={() => { setAddingClub(false); setActivityForm(emptyActivityForm); setActivityOpen((current) => !current) }}>{activityOpen ? "Cancel" : "Add an activity"}</button>
        <button className="secondary-button" type="button" onClick={() => { setActivityOpen(false); setAddingClub((current) => !current) }}>{addingClub ? "Cancel" : "Add to the directory"}</button>
      </div>
    </div>

    {activityOpen && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitActivity() }}>
      <div className="add-form-row">
        <label>Name<input value={activityForm.name} onChange={(event) => setActivityForm({ ...activityForm, name: event.target.value })} required maxLength={80} /></label>
        <label>Kind<select value={activityForm.kind} onChange={(event) => setActivityForm({ ...activityForm, kind: event.target.value })}>{["club", "research", "job", "volunteering", "athletics", "arts", "other"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
        <label>With<input value={activityForm.organizer} onChange={(event) => setActivityForm({ ...activityForm, organizer: event.target.value })} placeholder="Professor, group, employer" maxLength={80} /></label>
      </div>
      <label>Details<textarea rows={2} value={activityForm.detail} onChange={(event) => setActivityForm({ ...activityForm, detail: event.target.value })} maxLength={400} /></label>
      <label>Notes<textarea rows={2} value={activityForm.notes} onChange={(event) => setActivityForm({ ...activityForm, notes: event.target.value })} maxLength={600} placeholder="Anything you or your agent should remember about this one" /></label>
      <fieldset className="days-fieldset"><legend>Meets on</legend>
        <div className="day-toggle-row">{dayChoices.map(([code, label]) => <label key={code} className={activityForm.days.includes(code) ? "day-toggle active" : "day-toggle"}><input type="checkbox" checked={activityForm.days.includes(code)} onChange={(event) => setActivityForm({ ...activityForm, days: event.target.checked ? [...activityForm.days, code] : activityForm.days.filter((day) => day !== code) })} />{label}</label>)}</div>
      </fieldset>
      <div className="add-form-row">
        <label>From<input type="time" value={activityForm.start} onChange={(event) => setActivityForm({ ...activityForm, start: event.target.value })} /></label>
        <label>To<input type="time" value={activityForm.end} onChange={(event) => setActivityForm({ ...activityForm, end: event.target.value })} /></label>
        <label>Units, if any<input type="number" min={0} max={10} value={activityForm.units} onChange={(event) => setActivityForm({ ...activityForm, units: event.target.value })} placeholder="0" /></label>
      </div>
      <div className="add-form-row">
        <label>Starts<input type="date" value={activityForm.startDate} onChange={(event) => setActivityForm({ ...activityForm, startDate: event.target.value })} /></label>
        <label>Ends<input type="date" value={activityForm.endDate} onChange={(event) => setActivityForm({ ...activityForm, endDate: event.target.value })} /></label>
      </div>
      <p className="add-form-note">Weekly meetings recur on the calendar between the start and end dates. Units count into the academics totals.</p>
      <button className="primary-button" type="submit">{activityForm.id ? "Save activity" : "Add activity"}</button>
    </form>}

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
      <button className="primary-button" type="submit">Add to the directory</button>
    </form>}

    {(filter === "all" || filter === "mine") && <section className="mine-section">
      <div className="section-heading"><h2>Mine</h2><span className="count-chip">{activities.length}</span></div>
      {activities.length === 0 ? <div className="empty-card"><strong>Nothing joined yet</strong><p>Join a club from the directory or add research, a job, or practice hours, and the time shows up beside your classes.</p></div> : <div className="club-grid">{activities.map(mineCard)}</div>}
    </section>}

    {(filter === "all" || filter === "directory") && <section className="directory-section">
      <div className="section-heading"><h2>Directory</h2><span className="count-chip">{opportunities.length}</span></div>
      <div className="club-grid">{opportunities.map(directoryCard)}</div>
    </section>}
  </div>
}
