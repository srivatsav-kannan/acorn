"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, addMonths, format, startOfMonth, subDays } from "date-fns"
import { useWorkspace } from "@/components/workspace-provider"
import { calendarEventsForRange, isoDate, type CalendarEvent } from "@/domain/calendar"
import { buildIcs } from "@/domain/ics"
import { mergedOpportunities } from "@/domain/reference"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { standingForTerm, termForDate, timelineFor } from "@/domain/timeline"
import { CAMPUS_TIMEZONE, convertZonedTime, timezoneChoices, timezoneOffsetLabel } from "@/domain/timezone"
import { WeekView } from "@/features/calendar/week-view"

// One continuous calendar from New Student Orientation to commencement. The
// grid is a fixed lattice: cells never grow, and clicking a day or any single
// entry pins its summary in the inspector beside the grid. Every day takes a
// quick add for an event, a todo, or a club event; classes and weekly
// meetings come from the academics and activities pages, which is also the
// only place they are removed.

const yearHeadline: Record<string, string> = { "Frosh": "Freshman year", "Sophomore": "Sophomore year", "Junior": "Junior year", "Senior": "Senior year", "Fifth year": "Fifth year" }
const seasonNames: Record<string, string> = { AUTUMN: "Autumn quarter", WINTER: "Winter quarter", SPRING: "Spring quarter", SUMMER: "Summer" }
const kindLabel: Record<string, string> = { academic: "Stanford", course: "Class", club: "Club", activity: "Activity", todo: "Todo", event: "Event" }
const timezoneStorageKey = "acorn-display-timezone"
const viewStorageKey = "acorn-calendar-view"

type Inspection = { kind: "day", date: string } | { kind: "entry", entry: CalendarEvent, fromDate?: string } | null
type ComposerState = { date: string, kind: "event" | "todo" | "club", title: string, timing: "allday" | "time" | "period", start: string, end: string, detail: string, timezone: string, activityId: string } | null

export const CalendarPage = () => {
  const value = useWorkspace()
  const timeline = timelineFor(value.workspace.profile, new Date())
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<"month" | "week">("month")
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor])
  const weekStart = useMemo(() => subDays(anchor, (anchor.getDay() + 6) % 7), [anchor])
  const [inspection, setInspection] = useState<Inspection>(null)
  const [displayTimezone, setDisplayTimezone] = useState(CAMPUS_TIMEZONE)
  const [composer, setComposer] = useState<ComposerState>(null)
  const [upcomingTab, setUpcomingTab] = useState<"todos" | "events">("todos")
  const [todosShown, setTodosShown] = useState(8)
  const [eventsShown, setEventsShown] = useState(8)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(timezoneStorageKey)
      const storedView = localStorage.getItem(viewStorageKey)
      const timeout = window.setTimeout(() => {
        if (stored && timezoneChoices.some((choice) => choice.id === stored)) setDisplayTimezone(stored)
        if (storedView === "week" || storedView === "month") setView(storedView)
      }, 0)
      return () => window.clearTimeout(timeout)
    } catch {}
  }, [])
  const chooseView = (next: "month" | "week") => {
    setView(next)
    try { localStorage.setItem(viewStorageKey, next) } catch {}
  }
  const chooseTimezone = (timezone: string) => {
    setDisplayTimezone(timezone)
    try { localStorage.setItem(timezoneStorageKey, timezone) } catch {}
  }

  const opportunities = useMemo(() => mergedOpportunities(institutionForWorkspace(value.workspace).buildOpportunities(), value.workspace.referenceOverlay?.opportunities), [value.workspace])

  const gridStart = useMemo(() => {
    const start = startOfMonth(monthStart)
    return subDays(start, (start.getDay() + 6) % 7)
  }, [monthStart])
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)), [gridStart])

  // Derive in home zones over a padded range, then re-express every timed
  // entry in the display zone; the padding keeps entries that cross midnight
  // during conversion from falling off the grid's edges.
  const events = useMemo(() => {
    const rangeStart = view === "week" ? subDays(weekStart, 1) : subDays(gridStart, 1)
    const rangeEnd = view === "week" ? addDays(weekStart, 8) : addDays(gridStart, 42)
    const raw = calendarEventsForRange(value.workspace, value.catalog, opportunities, isoDate(rangeStart), isoDate(rangeEnd))
    return raw.map((event) => {
      if (!event.start) return event
      const homeZone = event.timezone ?? CAMPUS_TIMEZONE
      if (homeZone === displayTimezone) return event
      const converted = convertZonedTime(event.date, event.start, homeZone, displayTimezone)
      const convertedEnd = event.end ? convertZonedTime(event.date, event.end, homeZone, displayTimezone) : undefined
      return { ...event, date: converted.date, start: converted.time, end: convertedEnd?.time }
    }).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "00:00").localeCompare(b.start ?? "00:00"))
  }, [value.workspace, value.catalog, opportunities, gridStart, weekStart, view, displayTimezone])

  // The export uses home-zone times with real TZIDs rather than the converted
  // display times, so calendar apps place every instant correctly themselves.
  const downloadIcs = () => {
    const raw = calendarEventsForRange(value.workspace, value.catalog, opportunities, isoDate(startOfMonth(monthStart)), isoDate(addDays(startOfMonth(addMonths(monthStart, 1)), -1)))
    const blob = new Blob([buildIcs(raw, `Acorn ${format(monthStart, "MMMM yyyy")}`)], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const anchorEl = document.createElement("a")
    anchorEl.href = url
    anchorEl.download = `acorn-${format(monthStart, "yyyy-MM")}.ics`
    anchorEl.click()
    URL.revokeObjectURL(url)
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    return map
  }, [events])

  const currentTermRef = termForDate(addDays(monthStart, 14))
  const standing = standingForTerm(timeline, currentTermRef.id)
  const headline = yearHeadline[standing] ?? (standing === "Before entry" ? "Before Stanford" : standing || "Your calendar")
  const todayIso = isoDate(new Date())

  const openTodos = useMemo(() => [...(value.workspace.todos ?? []).filter((todo) => !todo.done)].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")), [value.workspace.todos])
  const doneTodos = (value.workspace.todos ?? []).filter((todo) => todo.done)
  const joinedClubs = (value.workspace.activities ?? []).filter((activity) => activity.kind === "club")

  // The upcoming feed carries everything dated in the next six months:
  // events, club and activity one-offs, and registrar dates. Recurring class
  // and activity meetings stay on the grid, where repetition reads as rhythm
  // instead of noise. Schedule instances are the entries whose id ends at
  // the bare date; dated one-offs carry a label suffix past it.
  const upcoming = useMemo(() => {
    const horizon = addDays(new Date(), 180)
    return calendarEventsForRange(value.workspace, value.catalog, opportunities, todayIso, isoDate(horizon))
      .filter((event) => {
        if (event.kind === "todo" || event.kind === "course") return false
        if (event.id.startsWith("ACTIVITY-") && /-\d{4}-\d{2}-\d{2}$/.test(event.id)) return false
        return true
      })
      .map((event) => {
        if (!event.start) return event
        const homeZone = event.timezone ?? CAMPUS_TIMEZONE
        if (homeZone === displayTimezone) return event
        const converted = convertZonedTime(event.date, event.start, homeZone, displayTimezone)
        const convertedEnd = event.end ? convertZonedTime(event.date, event.end, homeZone, displayTimezone) : undefined
        return { ...event, date: converted.date, start: converted.time, end: convertedEnd?.time }
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))
  }, [value.workspace, value.catalog, opportunities, todayIso, displayTimezone])

  const openComposer = (date: string) => {
    setComposer({ date, kind: "event", title: "", timing: "time", start: "12:00", end: "", detail: "", timezone: displayTimezone, activityId: joinedClubs[0]?.id ?? "" })
    setInspection(null)
  }

  const submitComposer = async () => {
    if (!composer || !composer.title.trim() || !composer.date) return
    const timed = composer.timing !== "allday"
    if (composer.kind === "todo") {
      await value.onCommand({ type: "manage_todo", action: "add", todo: { title: composer.title.trim(), due: composer.date, dueTime: timed && composer.start ? composer.start : undefined, detail: composer.detail.trim() || undefined } })
    } else if (composer.kind === "event") {
      await value.onCommand({ type: "manage_event", action: "add", event: { title: composer.title.trim(), date: composer.date, start: timed && composer.start ? composer.start : undefined, end: composer.timing === "period" && composer.start && composer.end ? composer.end : undefined, timezone: composer.timezone !== CAMPUS_TIMEZONE ? composer.timezone : undefined, description: composer.detail.trim() || undefined } })
    } else {
      const activity = joinedClubs.find((club) => club.id === composer.activityId)
      if (!activity) return
      await value.onCommand({ type: "upsert_activity", activity: { ...activity, dates: [...(activity.dates ?? []), { date: composer.date, label: composer.title.trim(), ...(timed && composer.start ? { start: composer.start } : {}), ...(composer.timing === "period" && composer.start && composer.end ? { end: composer.end } : {}) }] } })
    }
    setComposer(null)
  }

  const removeEvent = async (eventId: string) => {
    await value.onCommand({ type: "manage_event", action: "remove", eventId })
    setInspection(null)
  }

  const inspectDay = (date: string) => { setComposer(null); setInspection((current) => current?.kind === "day" && current.date === date ? null : { kind: "day", date }) }
  const inspectEntry = (entry: CalendarEvent, fromDate?: string) => { setComposer(null); setInspection({ kind: "entry", entry, fromDate }) }
  const inspectStoredEvent = (id: string) => {
    const converted = events.find((event) => event.sourceId === id && event.kind === "event")
    if (converted) { inspectEntry(converted); return }
    const raw = (value.workspace.events ?? []).find((event) => event.id === id)
    if (!raw) return
    const homeZone = raw.timezone ?? CAMPUS_TIMEZONE
    const start = raw.start ? convertZonedTime(raw.date, raw.start, homeZone, displayTimezone) : undefined
    const end = raw.start && raw.end ? convertZonedTime(raw.date, raw.end, homeZone, displayTimezone) : undefined
    inspectEntry({ id: `EVENT-${raw.id}`, date: start?.date ?? raw.date, start: start?.time, end: end?.time, title: raw.title, detail: raw.description, kind: "event", timezone: raw.timezone, sourceId: raw.id })
  }

  const displayLabel = timezoneChoices.find((choice) => choice.id === displayTimezone)?.label ?? displayTimezone

  const composerForm = composer && <form className="composer" onSubmit={(event) => { event.preventDefault(); void submitComposer() }}>
    <div className="section-heading"><h3>Add to {composer.date ? format(new Date(`${composer.date}T12:00:00`), "EEE, MMM d") : "the calendar"}</h3><button className="text-button" type="button" onClick={() => setComposer(null)}>Cancel</button></div>
    <div className="kind-toggle-row" role="radiogroup" aria-label="What to add">
      {([["event", "Event"], ["todo", "Todo"], ["club", "Club event"]] as const).map(([kind, label]) => <button key={kind} type="button" role="radio" aria-checked={composer.kind === kind} className={composer.kind === kind ? "day-toggle active" : "day-toggle"} onClick={() => setComposer({ ...composer, kind })}>{label}</button>)}
    </div>
    {composer.kind === "club" && (joinedClubs.length === 0 ? <p className="add-form-note">Join a club in Activities first.</p> : <label>Club<select value={composer.activityId} onChange={(event) => setComposer({ ...composer, activityId: event.target.value })}>{joinedClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>)}
    <input aria-label="Title" placeholder={composer.kind === "todo" ? "What needs doing" : "What is happening"} value={composer.title} onChange={(event) => setComposer({ ...composer, title: event.target.value })} maxLength={100} required />
    <div className="add-form-row">
      <label>Date<input type="date" value={composer.date} onChange={(event) => setComposer({ ...composer, date: event.target.value })} required /></label>
      <label>Timing<select aria-label="Timing" value={composer.timing} onChange={(event) => setComposer({ ...composer, timing: event.target.value as "allday" | "time" | "period" })}>
        <option value="allday">All day</option>
        <option value="time">At a time</option>
        {composer.kind !== "todo" && <option value="period">Start and end</option>}
      </select></label>
    </div>
    {composer.timing !== "allday" && <div className="add-form-row">
      <label>Start<input type="time" value={composer.start} onChange={(event) => setComposer({ ...composer, start: event.target.value })} required /></label>
      {composer.timing === "period" && <label>End<input type="time" value={composer.end} onChange={(event) => setComposer({ ...composer, end: event.target.value })} required /></label>}
    </div>}
    {composer.kind === "event" && <select aria-label="Event timezone" value={composer.timezone} onChange={(event) => setComposer({ ...composer, timezone: event.target.value })}>
      {timezoneChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} ({timezoneOffsetLabel(choice.id)})</option>)}
    </select>}
    {composer.kind !== "club" && <textarea aria-label="Details" rows={2} placeholder="Details (optional)" value={composer.detail} onChange={(event) => setComposer({ ...composer, detail: event.target.value })} maxLength={600} />}
    <button className="primary-button small" type="submit" disabled={!composer.title.trim() || (composer.kind === "club" && !composer.activityId)}>{composer.kind === "todo" ? "Add todo" : composer.kind === "club" ? "Add club event" : "Add event"}</button>
    <p className="add-form-note">Classes come from Academics. Weekly club meetings come from Activities.</p>
  </form>

  const inspector = () => {
    if (!inspection) return <p className="muted inspector-empty">Click a day or an entry to see it.</p>
    if (inspection.kind === "day") {
      const dayEvents = eventsByDay.get(inspection.date) ?? []
      return <>
        <h3>{format(new Date(`${inspection.date}T12:00:00`), "EEEE, MMMM d")}</h3>
        {dayEvents.length === 0 ? <p className="muted">Nothing scheduled.</p> : <ul className="inspector-day-list">
          {dayEvents.map((event) => <li key={event.id}>
            <button type="button" className="event-open" onClick={() => inspectEntry(event, inspection.date)}>
              <b>{event.start ? `${event.start}${event.end ? ` to ${event.end}` : ""}` : "All day"}</b>
              <span>{event.title}</span>
              <em className={`legend-item ${event.kind}`}>{kindLabel[event.kind] ?? event.kind}</em>
            </button>
          </li>)}
        </ul>}
        <button className="secondary-button small inspector-add" type="button" onClick={() => openComposer(inspection.date)}>Add to this day</button>
      </>
    }
    const entry = inspection.entry
    return <>
      {inspection.fromDate && <button className="text-button inspector-back" type="button" onClick={() => setInspection({ kind: "day", date: inspection.fromDate! })}>← {inspection.fromDate}</button>}
      <h3>{entry.title}</h3>
      <p className="event-detail-when"><b>{entry.start ? `${entry.start}${entry.end ? ` to ${entry.end}` : ""}` : "All day"}</b> on {entry.date}, shown in {displayLabel}{entry.timezone && entry.timezone !== displayTimezone ? `, recorded in ${entry.timezone}` : ""}</p>
      {entry.detail ? <p className="event-detail-description">{entry.detail}</p> : <p className="event-detail-description muted">No description recorded.</p>}
      <div className="event-detail-actions">
        <span className={`legend-item ${entry.kind}`}>{kindLabel[entry.kind] ?? entry.kind}</span>
        {entry.projected && <span className="muted">Projected date</span>}
        {entry.kind === "event" && entry.sourceId && <button className="text-button" type="button" onClick={() => void removeEvent(entry.sourceId!)}>Remove event</button>}
        {entry.kind === "todo" && entry.sourceId && <button className="text-button" type="button" onClick={() => { void value.onCommand({ type: "manage_todo", action: "toggle", todoId: entry.sourceId! }); setInspection(null) }}>Mark done</button>}
        {(entry.kind === "course" || entry.kind === "activity" || entry.kind === "club") && <span className="muted">Managed in {entry.kind === "course" ? "Academics" : "Activities"}</span>}
      </div>
    </>
  }

  return <div className="page calendar-page">
    <header className="page-heading calendar-heading">
      <div>
        <h1>{headline}</h1>
        <p>{seasonNames[currentTermRef.season]} · {view === "week" ? `${format(weekStart, "MMM d")} to ${format(addDays(weekStart, 6), "MMM d, yyyy")}` : format(monthStart, "MMMM yyyy")}</p>
      </div>
      <div className="calendar-controls">
        <div className="view-toggle" role="group" aria-label="Calendar view">
          <button className={`secondary-button small${view === "month" ? " toggled" : ""}`} type="button" aria-pressed={view === "month"} onClick={() => chooseView("month")}>Month</button>
          <button className={`secondary-button small${view === "week" ? " toggled" : ""}`} type="button" aria-pressed={view === "week"} onClick={() => chooseView("week")}>Week</button>
        </div>
        <label className="timezone-control">
          <span className="sr-only">Times shown in</span>
          <select className="chunky-select" aria-label="Times shown in" value={displayTimezone} onChange={(event) => chooseTimezone(event.target.value)}>
            {timezoneChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} ({timezoneOffsetLabel(choice.id)})</option>)}
          </select>
        </label>
        <button className="secondary-button small" type="button" onClick={() => setAnchor((current) => view === "week" ? subDays(current, 7) : addMonths(current, -1))} aria-label={view === "week" ? "Previous week" : "Previous month"}>← Previous</button>
        <button className="secondary-button small" type="button" onClick={() => setAnchor(new Date())}>Today</button>
        <button className="secondary-button small" type="button" onClick={() => setAnchor((current) => view === "week" ? addDays(current, 7) : addMonths(current, 1))} aria-label={view === "week" ? "Next week" : "Next month"}>Next →</button>
        <button className="secondary-button small" type="button" onClick={downloadIcs} aria-label="Download this month as an ICS calendar file">Download .ics</button>
      </div>
    </header>

    <div className="calendar-layout">
      <section className="calendar-panel" aria-label={view === "week" ? "Week calendar" : "Month calendar"}>
        {view === "week" && <WeekView
          days={Array.from({ length: 7 }, (_, index) => isoDate(addDays(weekStart, index)))}
          eventsByDay={eventsByDay}
          protectedWindows={value.workspace.profile.protectedWindows ?? []}
          todayIso={todayIso}
          nowMinutes={new Date().getHours() * 60 + new Date().getMinutes()}
          onDay={inspectDay}
          onEntry={inspectEntry}
        />}
        {view === "month" && <>
        <div className="calendar-weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {gridDays.map((day) => {
            const iso = isoDate(day)
            const dayEvents = eventsByDay.get(iso) ?? []
            const outside = day.getMonth() !== monthStart.getMonth()
            const selected = (inspection?.kind === "day" && inspection.date === iso) || (inspection?.kind === "entry" && inspection.entry.date === iso)
            const shown = dayEvents.slice(0, 2)
            return <div key={iso} className={`calendar-cell${outside ? " outside" : ""}${iso === todayIso ? " today" : ""}${selected ? " selected" : ""}`}>
              <div className="calendar-cell-head">
                <button type="button" className="calendar-cell-date" onClick={() => inspectDay(iso)} aria-label={`Open ${iso}, ${dayEvents.length} items`}>{day.getDate()}</button>
                <button type="button" className="calendar-cell-add" onClick={() => openComposer(iso)} aria-label={`Add to ${iso}`}>+</button>
              </div>
              {shown.map((event) => <button key={event.id} type="button" className={`calendar-chip ${event.kind}${event.projected ? " projected" : ""}`} onClick={() => inspectEntry(event, iso)} title={event.title}>{event.start ? `${event.start} ` : ""}{event.title}</button>)}
              {dayEvents.length > 2 && <button type="button" className="calendar-more" onClick={() => inspectDay(iso)}>+{dayEvents.length - 2} more</button>}
            </div>
          })}
        </div>
        </>}
        <div className="calendar-legend">
          <span className="legend-item academic">Stanford dates</span>
          <span className="legend-item course">Classes</span>
          <span className="legend-item club">Clubs</span>
          <span className="legend-item activity">Activities</span>
          <span className="legend-item event">Events</span>
          <span className="legend-item todo">Todos</span>
        </div>
      </section>

      <div className="calendar-side">
        <aside className="todo-panel inspector-panel" aria-label="Selection details">
          <div className="section-heading"><h2>Details</h2>{inspection && !composer && <button className="text-button" type="button" onClick={() => setInspection(null)}>Clear</button>}</div>
          {composer ? composerForm : inspector()}
        </aside>

        <aside className="todo-panel upcoming-panel" aria-label="Upcoming">
          <div className="section-heading">
            <div className="subtab-row small" role="tablist" aria-label="Upcoming">
              {([["todos", "Todos"], ["events", "Events"]] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={upcomingTab === key} className={upcomingTab === key ? "subtab active" : "subtab"} onClick={() => setUpcomingTab(key)}>{label}</button>)}
            </div>
            <button className="secondary-button small" type="button" onClick={() => openComposer(todayIso)}>Add</button>
          </div>
          {upcomingTab === "todos" && <>
            {openTodos.length === 0 ? <p className="muted side-empty">Nothing open.</p> : <ul className="todo-list">
              {openTodos.slice(0, todosShown).map((todo) => <li key={todo.id}>
                <label>
                  <input type="checkbox" checked={false} onChange={() => void value.onCommand({ type: "manage_todo", action: "toggle", todoId: todo.id })} aria-label={`Complete ${todo.title}`} />
                  <span><b>{todo.title}</b>{todo.due && <em>due {todo.due}{todo.dueTime ? ` at ${todo.dueTime}` : ""}</em>}{todo.detail && <small>{todo.detail}</small>}</span>
                </label>
                <span className={`todo-source ${todo.source}`}>{todo.source === "system" ? "Stanford" : todo.source === "agent" ? "Agent" : "You"}</span>
                <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "manage_todo", action: "remove", todoId: todo.id })} aria-label={`Remove ${todo.title}`}>Remove</button>
              </li>)}
            </ul>}
            {openTodos.length > todosShown && <button className="text-button show-more" type="button" onClick={() => setTodosShown((current) => current + 8)}>Show {Math.min(8, openTodos.length - todosShown)} more</button>}
            {doneTodos.length > 0 && <details className="todo-done">
              <summary>{doneTodos.length} done</summary>
              <ul className="todo-list">
                {doneTodos.map((todo) => <li key={todo.id} className="done">
                  <label><input type="checkbox" checked onChange={() => void value.onCommand({ type: "manage_todo", action: "toggle", todoId: todo.id })} aria-label={`Reopen ${todo.title}`} /><span><b>{todo.title}</b></span></label>
                </li>)}
              </ul>
            </details>}
          </>}
          {upcomingTab === "events" && <>
            {upcoming.length === 0 ? <p className="muted side-empty">Nothing in the next six months.</p> : <ul className="side-event-list">
              {upcoming.slice(0, eventsShown).map((item) => <li key={item.id}>
                <button type="button" className="event-open" onClick={() => item.kind === "event" && item.sourceId ? inspectStoredEvent(item.sourceId) : inspectEntry(item)}>
                  <b>{item.date}{item.start ? ` · ${item.start}` : ""}</b>
                  <span>{item.title}</span>
                  <em className={`legend-item ${item.kind}`}>{kindLabel[item.kind] ?? item.kind}</em>
                </button>
              </li>)}
            </ul>}
            {upcoming.length > eventsShown && <button className="text-button show-more" type="button" onClick={() => setEventsShown((current) => current + 8)}>Show {Math.min(8, upcoming.length - eventsShown)} more</button>}
          </>}
        </aside>
      </div>
    </div>
  </div>
}
