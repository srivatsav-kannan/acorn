"use client"

import { useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { mergedOpportunities, referenceChanges } from "@/domain/reference"
import type { Activity, Day, Opportunity } from "@/domain/types"

// Yours in front, the directory on the rail. One add form covers a club, a
// job, research, or practice, and can list a new club in the directory in
// the same breath. Every card carries its weekly hours, and meetings and
// one-off events live in a single list with one add control: flip it to
// weekly and it sets the recurring block, leave it one-off and it lands on
// that date. Everything here shows up on the calendar and is removed here.

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

const minutesOf = (time: string) => {
  const [hours, mins] = time.split(":").map(Number)
  return hours * 60 + mins
}
const hoursPerWeek = (activity: Activity) => {
  if (!activity.schedule) return 0
  const perDay = Math.max(0, minutesOf(activity.schedule.end) - minutesOf(activity.schedule.start))
  return Math.round((perDay * activity.schedule.days.length) / 6) / 10
}

const emptyForm = { id: "", name: "", kind: "club", organizer: "", detail: "", notes: "", units: "", days: [] as string[], start: "15:00", end: "17:00", startDate: "", endDate: "", listInDirectory: false, summary: "", url: "" }

export const ActivitiesPage = () => {
  const value = useWorkspace()
  const workspace = value.workspace
  const [mineQuery, setMineQuery] = useState("")
  const [directoryQuery, setDirectoryQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [meetingFormFor, setMeetingFormFor] = useState("")
  const [meetingForm, setMeetingForm] = useState({ mode: "once" as "once" | "weekly", date: "", label: "", start: "15:00", end: "16:00", days: [] as string[] })
  const [notesFor, setNotesFor] = useState("")
  const [notesDraft, setNotesDraft] = useState("")

  const institution = institutionForWorkspace(workspace)
  const shippedOpportunities = useMemo(() => new Map(institution.buildOpportunities().map((opportunity) => [opportunity.id, opportunity])), [institution])
  const opportunities = useMemo(() => mergedOpportunities(institution.buildOpportunities(), workspace.referenceOverlay?.opportunities), [institution, workspace.referenceOverlay?.opportunities])
  const activities = useMemo(() => workspace.activities ?? [], [workspace.activities])
  const joinedByOpportunity = useMemo(() => new Map(activities.filter((activity) => activity.opportunityId).map((activity) => [activity.opportunityId!, activity])), [activities])

  const mine = useMemo(() => {
    const needle = mineQuery.trim().toLowerCase()
    if (!needle) return activities
    return activities.filter((activity) => `${activity.name} ${activity.detail ?? ""} ${activity.notes ?? ""} ${activity.organizer ?? ""}`.toLowerCase().includes(needle))
  }, [activities, mineQuery])
  const directory = useMemo(() => {
    const needle = directoryQuery.trim().toLowerCase()
    if (!needle) return opportunities
    return opportunities.filter((opportunity) => `${opportunity.name} ${opportunity.summary}`.toLowerCase().includes(needle))
  }, [opportunities, directoryQuery])
  const weeklyHours = Math.round(activities.reduce((total, activity) => total + hoursPerWeek(activity), 0) * 10) / 10

  const saveActivity = async (activity: Partial<Activity> & { name: string }) => {
    await value.onCommand({ type: "upsert_activity", activity })
  }

  const submitForm = async () => {
    if (!form.name.trim()) return
    const existing = activities.find((item) => item.id === form.id)
    const schedule = form.days.length > 0 ? { days: form.days as Day[], start: form.start, end: form.end } : undefined
    if (form.listInDirectory && !form.id) {
      await value.onCommand({ type: "extend_reference_opportunity", opportunity: { name: form.name.trim(), kind: form.kind === "research" ? "research" : form.kind === "club" ? "club" : "program", summary: form.summary.trim() || form.detail.trim() || `${form.name.trim()}, added by a member.`, url: form.url.trim() || undefined }, evidence: humanEvidence(`EVIDENCE-HAND-CLUB-${form.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 40)}`, `${form.name.trim()} added by hand.`, form.url.trim()) })
    }
    await saveActivity({
      id: form.id || undefined,
      name: form.name.trim(),
      kind: form.kind as Activity["kind"],
      organizer: form.organizer.trim() || undefined,
      detail: form.detail.trim() || undefined,
      notes: form.notes.trim() || undefined,
      units: form.units ? Number(form.units) : undefined,
      schedule,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      dates: existing?.dates,
      opportunityId: existing?.opportunityId,
      sourceUrl: form.url.trim() || existing?.sourceUrl
    })
    setFormOpen(false)
    setForm(emptyForm)
  }

  const joinClub = async (opportunity: Opportunity) => {
    await saveActivity({
      id: `ACTIVITY-CLUB-${opportunity.id.replace(/^OPPORTUNITY-/, "").slice(0, 40)}`,
      name: opportunity.name,
      kind: opportunity.kind === "research" ? "research" : "club",
      opportunityId: opportunity.id,
      sourceUrl: opportunity.url
    })
  }

  const submitMeeting = async (activity: Activity) => {
    if (meetingForm.mode === "weekly") {
      if (meetingForm.days.length === 0) return
      await saveActivity({ ...activity, schedule: { days: meetingForm.days as Day[], start: meetingForm.start, end: meetingForm.end } })
    } else {
      if (!meetingForm.date || !meetingForm.label.trim()) return
      await saveActivity({ ...activity, dates: [...(activity.dates ?? []), { date: meetingForm.date, label: meetingForm.label.trim(), ...(meetingForm.start ? { start: meetingForm.start } : {}), ...(meetingForm.start && meetingForm.end ? { end: meetingForm.end } : {}) }] })
    }
    setMeetingFormFor("")
    setMeetingForm({ mode: "once", date: "", label: "", start: "15:00", end: "16:00", days: [] })
  }

  const removeDated = async (activity: Activity, index: number) => {
    await saveActivity({ ...activity, dates: (activity.dates ?? []).filter((_, position) => position !== index) })
  }
  const clearWeekly = async (activity: Activity) => {
    await saveActivity({ ...activity, schedule: undefined })
  }

  const saveNotes = async (activity: Activity) => {
    await saveActivity({ ...activity, notes: notesDraft.trim() || undefined })
    setNotesFor("")
    setNotesDraft("")
  }

  const editActivity = (activity: Activity) => {
    setForm({ id: activity.id, name: activity.name, kind: activity.kind, organizer: activity.organizer ?? "", detail: activity.detail ?? "", notes: activity.notes ?? "", units: activity.units ? String(activity.units) : "", days: activity.schedule?.days ?? [], start: activity.schedule?.start ?? "15:00", end: activity.schedule?.end ?? "17:00", startDate: activity.startDate ?? "", endDate: activity.endDate ?? "", listInDirectory: false, summary: "", url: activity.sourceUrl ?? "" })
    setFormOpen(true)
  }

  const mineCard = (activity: Activity) => {
    const linked = activity.opportunityId ? opportunities.find((opportunity) => opportunity.id === activity.opportunityId) : undefined
    const hours = hoursPerWeek(activity)
    const meetingOpen = meetingFormFor === activity.id
    return <article className="club-card" key={activity.id}>
      <div className="club-card-top">
        <span className={`kind-chip ${activity.kind === "club" ? "club" : activity.kind === "research" ? "research" : "program"}`}>{activity.kind}</span>
        {hours > 0 && <span className="hours-chip">{hours} h/wk</span>}
        {activity.units ? <span className="hours-chip">{activity.units} units</span> : null}
        {activity.addedBy === "agent" && <span className="agent-chip">Agent</span>}
      </div>
      <h3>{activity.name}</h3>
      {(activity.detail || linked?.summary) && <p>{activity.detail ?? linked?.summary}</p>}
      <dl className="club-facts">
        {activity.organizer && <div><dt>With</dt><dd>{activity.organizer}</dd></div>}
        {activity.schedule && <div><dt>Weekly</dt><dd>{activity.schedule.days.join(", ")} {activity.schedule.start} to {activity.schedule.end} <button className="text-button" type="button" onClick={() => void clearWeekly(activity)} aria-label={`Clear weekly meetings for ${activity.name}`}>Clear</button></dd></div>}
        {(activity.dates ?? []).map((dated, index) => <div key={dated.date + dated.label}><dt>{dated.label}</dt><dd>{dated.date}{dated.start ? ` · ${dated.start}${dated.end ? ` to ${dated.end}` : ""}` : ""} <button className="text-button" type="button" onClick={() => void removeDated(activity, index)} aria-label={`Remove ${dated.label}`}>Remove</button></dd></div>)}
      </dl>
      {activity.notes && notesFor !== activity.id && <p className="activity-notes">{activity.notes}</p>}
      {notesFor === activity.id && <div className="plan-rationale-edit">
        <textarea aria-label={`Notes on ${activity.name}`} rows={3} maxLength={600} value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} autoFocus />
        <div className="form-row-actions"><button className="secondary-button small" type="button" onClick={() => setNotesFor("")}>Cancel</button><button className="primary-button small" type="button" onClick={() => void saveNotes(activity)}>Save</button></div>
      </div>}
      {meetingOpen && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitMeeting(activity) }}>
        <div className="kind-toggle-row" role="radiogroup" aria-label="Meeting type">
          {([["once", "One-off"], ["weekly", "Weekly"]] as const).map(([mode, label]) => <button key={mode} type="button" role="radio" aria-checked={meetingForm.mode === mode} className={meetingForm.mode === mode ? "day-toggle active" : "day-toggle"} onClick={() => setMeetingForm({ ...meetingForm, mode })}>{label}</button>)}
        </div>
        {meetingForm.mode === "once" ? <>
          <div className="add-form-row">
            <label>Date<input type="date" value={meetingForm.date} onChange={(event) => setMeetingForm({ ...meetingForm, date: event.target.value })} required /></label>
            <label>What happens<input value={meetingForm.label} onChange={(event) => setMeetingForm({ ...meetingForm, label: event.target.value })} placeholder="General meeting" required maxLength={80} /></label>
          </div>
          <div className="add-form-row">
            <label>Start<input type="time" value={meetingForm.start} onChange={(event) => setMeetingForm({ ...meetingForm, start: event.target.value })} /></label>
            <label>End<input type="time" value={meetingForm.end} onChange={(event) => setMeetingForm({ ...meetingForm, end: event.target.value })} disabled={!meetingForm.start} /></label>
          </div>
        </> : <>
          <div className="day-toggle-row">{dayChoices.map(([code, label]) => <label key={code} className={meetingForm.days.includes(code) ? "day-toggle active" : "day-toggle"}><input type="checkbox" checked={meetingForm.days.includes(code)} onChange={(event) => setMeetingForm({ ...meetingForm, days: event.target.checked ? [...meetingForm.days, code] : meetingForm.days.filter((day) => day !== code) })} />{label}</label>)}</div>
          <div className="add-form-row">
            <label>From<input type="time" value={meetingForm.start} onChange={(event) => setMeetingForm({ ...meetingForm, start: event.target.value })} /></label>
            <label>To<input type="time" value={meetingForm.end} onChange={(event) => setMeetingForm({ ...meetingForm, end: event.target.value })} /></label>
          </div>
        </>}
        <button className="primary-button small" type="submit">{meetingForm.mode === "weekly" ? "Set weekly meetings" : "Add event"}</button>
      </form>}
      <div className="club-card-actions">
        <button className="text-button" type="button" onClick={() => { setMeetingFormFor(meetingOpen ? "" : activity.id); setMeetingForm({ mode: "once", date: "", label: "", start: "15:00", end: "16:00", days: activity.schedule?.days ?? [] }) }}>{meetingOpen ? "Cancel" : "Add meeting or event"}</button>
        <button className="text-button" type="button" onClick={() => { setNotesFor(activity.id); setNotesDraft(activity.notes ?? "") }}>{activity.notes ? "Edit notes" : "Add notes"}</button>
        <button className="text-button" type="button" onClick={() => editActivity(activity)}>Edit</button>
        {(activity.sourceUrl || linked?.url) && <a className="text-button" href={activity.sourceUrl ?? linked?.url} target="_blank" rel="noreferrer">Site</a>}
        <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "remove_activity", activityId: activity.id })}>Remove</button>
      </div>
    </article>
  }

  const directoryCard = (opportunity: Opportunity) => {
    const marked = (workspace.interestedOpportunityIds ?? []).includes(opportunity.id)
    const joined = joinedByOpportunity.get(opportunity.id)
    const overlayEntry = (workspace.referenceOverlay?.opportunities ?? []).find((item) => item.id === opportunity.id)
    const diff = overlayEntry ? referenceChanges(shippedOpportunities.get(opportunity.id) as unknown as Record<string, unknown> | undefined, opportunity as unknown as Record<string, unknown>, ["summary", "commitment", "timing", "url"]) : []
    return <article className="dir-card" key={opportunity.id}>
      <div className="club-card-top"><span className={`kind-chip ${opportunity.kind}`}>{opportunity.kind}</span>{overlayEntry && <span className="unverified-banner">{shippedOpportunities.has(opportunity.id) ? "Amended" : "Added"} by {overlayEntry.addedBy?.type === "agent" ? "agent" : "hand"} · unverified</span>}</div>
      <h3>{opportunity.name}</h3>
      <p>{opportunity.summary}</p>
      {opportunity.commitment && <small className="muted">{opportunity.commitment}</small>}
      {diff.length > 0 && <div className="reference-diff"><b>Changed from the shipped listing</b><ul>{diff.map((change) => <li key={change.field}><span>{change.label}</span><em>{change.was}</em><strong>{change.now}</strong></li>)}</ul></div>}
      <div className="club-card-actions">
        {joined ? <span className="chip-button active joined-chip">Joined ✓</span> : <button className="chip-button plan" type="button" onClick={() => void joinClub(opportunity)}>Join</button>}
        <button className={marked ? "chip-button active" : "chip-button"} type="button" onClick={() => void value.onCommand({ type: "set_opportunity_interest", opportunityId: opportunity.id, interested: !marked })}>{marked ? "Interested ✓" : "Interested"}</button>
        {opportunity.url && <a className="text-button" href={opportunity.url} target="_blank" rel="noreferrer">Site</a>}
        {overlayEntry && <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "remove_reference_opportunity", opportunityId: opportunity.id })}>{shippedOpportunities.has(opportunity.id) ? "Restore original" : "Remove"}</button>}
      </div>
    </article>
  }

  return <div className="page activities-page">
    <header className="page-heading"><div><h1>Clubs and activities</h1><p>Yours in front with the hours they take, the whole directory one search away.</p></div></header>

    <div className="activities-layout">
      <section className="activities-main" aria-label="Mine">
        <div className="section-heading">
          <h2>Mine</h2>
          <span className="count-chip">{activities.length}</span>
          {weeklyHours > 0 && <span className="muted">{weeklyHours} hours a week</span>}
          <button className="secondary-button small mine-add" type="button" onClick={() => { setForm(emptyForm); setFormOpen((current) => !current) }}>{formOpen ? "Cancel" : "Add your own"}</button>
        </div>
        <input aria-label="Search your activities" placeholder="Search yours" value={mineQuery} onChange={(event) => setMineQuery(event.target.value)} />

        {formOpen && <form className="add-form" onSubmit={(event) => { event.preventDefault(); void submitForm() }}>
          <div className="add-form-row">
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={80} /></label>
            <label>Kind<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>{["club", "research", "job", "volunteering", "athletics", "arts", "other"].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label>With<input value={form.organizer} onChange={(event) => setForm({ ...form, organizer: event.target.value })} placeholder="Professor, group, employer" maxLength={80} /></label>
          </div>
          <label>Details<textarea rows={2} value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} maxLength={400} /></label>
          <label>Notes<textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={600} placeholder="Anything you or your agent should remember" /></label>
          <fieldset className="days-fieldset"><legend>Meets weekly on</legend>
            <div className="day-toggle-row">{dayChoices.map(([code, label]) => <label key={code} className={form.days.includes(code) ? "day-toggle active" : "day-toggle"}><input type="checkbox" checked={form.days.includes(code)} onChange={(event) => setForm({ ...form, days: event.target.checked ? [...form.days, code] : form.days.filter((day) => day !== code) })} />{label}</label>)}</div>
          </fieldset>
          <div className="add-form-row">
            <label>From<input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
            <label>To<input type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label>
            <label>Units, if any<input type="number" min={0} max={10} value={form.units} onChange={(event) => setForm({ ...form, units: event.target.value })} placeholder="0" /></label>
          </div>
          <div className="add-form-row">
            <label>Starts<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
            <label>Ends<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
          </div>
          {!form.id && <label className="directory-check"><input type="checkbox" checked={form.listInDirectory} onChange={(event) => setForm({ ...form, listInDirectory: event.target.checked })} />List it in the directory too, so others can find it</label>}
          {form.listInDirectory && !form.id && <>
            <label>What it is, for the directory<textarea rows={2} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} maxLength={300} /></label>
            <label>Site<input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://…" /></label>
          </>}
          <button className="primary-button" type="submit">{form.id ? "Save" : "Add"}</button>
        </form>}

        {mine.length === 0 && !formOpen ? <div className="empty-card"><strong>{mineQuery ? "No matches in yours" : "Nothing here yet"}</strong><p>{mineQuery ? "Try the directory search on the right." : "Join a club from the directory or add your own research, job, or practice hours."}</p></div> : <div className="club-grid mine-grid">{mine.map(mineCard)}</div>}
      </section>

      <aside className="activities-rail" aria-label="Directory">
        <section className="panel-card directory-box">
          <div className="section-heading"><h2>Directory</h2><span className="count-chip">{opportunities.length}</span></div>
          <input aria-label="Search the directory" placeholder="Clubs, research, programs" value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} />
          <div className="dir-list">
            {directory.length === 0 ? <p className="muted side-empty">Nothing matches. Add your own on the left and list it here.</p> : directory.map(directoryCard)}
          </div>
        </section>
      </aside>
    </div>
  </div>
}
