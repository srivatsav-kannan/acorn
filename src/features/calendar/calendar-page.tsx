"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, addMonths, format, startOfMonth, subDays } from "date-fns"
import { useWorkspace } from "@/components/workspace-provider"
import { calendarEventsForRange, isoDate, type CalendarEvent } from "@/domain/calendar"
import { mergedOpportunities } from "@/domain/reference"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { standingForTerm, termForDate, timelineFor } from "@/domain/timeline"
import { CAMPUS_TIMEZONE, convertZonedTime, timezoneChoices, timezoneOffsetLabel } from "@/domain/timezone"

// One continuous calendar from New Student Orientation to commencement. The
// grid is a fixed lattice: cells never grow, and clicking a day or any single
// entry pins its summary in the inspector beside the grid instead of
// stretching rows. Everything timed carries a home timezone and the whole
// view re-expresses itself in whichever zone the viewer selects.

const yearHeadline: Record<string, string> = { "Frosh": "Freshman year", "Sophomore": "Sophomore year", "Junior": "Junior year", "Senior": "Senior year", "Fifth year": "Fifth year" }
const seasonNames: Record<string, string> = { AUTUMN: "Autumn quarter", WINTER: "Winter quarter", SPRING: "Spring quarter", SUMMER: "Summer" }
const kindLabel: Record<string, string> = { academic: "Stanford", course: "Class", club: "Club", activity: "Activity", todo: "Todo", event: "Event" }
const timezoneStorageKey = "acorn-display-timezone"

type Inspection = { kind: "day", date: string } | { kind: "entry", entry: CalendarEvent, fromDate?: string } | null

export const CalendarPage = () => {
  const value = useWorkspace()
  const timeline = timelineFor(value.workspace.profile, new Date())
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [inspection, setInspection] = useState<Inspection>(null)
  const [displayTimezone, setDisplayTimezone] = useState(CAMPUS_TIMEZONE)
  const [todoTitle, setTodoTitle] = useState("")
  const [todoDue, setTodoDue] = useState("")
  const [todoTime, setTodoTime] = useState("")
  const [todoDetail, setTodoDetail] = useState("")
  const [addingEvent, setAddingEvent] = useState(false)
  const [eventForm, setEventForm] = useState({ title: "", date: "", start: "", end: "", timezone: CAMPUS_TIMEZONE, description: "" })

  useEffect(() => {
    try {
      const stored = localStorage.getItem(timezoneStorageKey)
      if (stored && timezoneChoices.some((choice) => choice.id === stored)) {
        const timeout = window.setTimeout(() => setDisplayTimezone(stored), 0)
        return () => window.clearTimeout(timeout)
      }
    } catch {}
  }, [])
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
    const raw = calendarEventsForRange(value.workspace, value.catalog, opportunities, isoDate(subDays(gridStart, 1)), isoDate(addDays(gridStart, 42)))
    return raw.map((event) => {
      if (!event.start) return event
      const homeZone = event.timezone ?? CAMPUS_TIMEZONE
      if (homeZone === displayTimezone) return event
      const converted = convertZonedTime(event.date, event.start, homeZone, displayTimezone)
      const convertedEnd = event.end ? convertZonedTime(event.date, event.end, homeZone, displayTimezone) : undefined
      return { ...event, date: converted.date, start: converted.time, end: convertedEnd?.time }
    }).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "00:00").localeCompare(b.start ?? "00:00"))
  }, [value.workspace, value.catalog, opportunities, gridStart, displayTimezone])

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

  const openTodos = (value.workspace.todos ?? []).filter((todo) => !todo.done)
  const doneTodos = (value.workspace.todos ?? []).filter((todo) => todo.done)
  const addTodo = async () => {
    if (!todoTitle.trim()) return
    await value.onCommand({ type: "manage_todo", action: "add", todo: { title: todoTitle.trim(), due: todoDue || undefined, dueTime: todoDue && todoTime ? todoTime : undefined, detail: todoDetail.trim() || undefined } })
    setTodoTitle("")
    setTodoDue("")
    setTodoTime("")
    setTodoDetail("")
  }

  const upcomingEvents = useMemo(() => (value.workspace.events ?? []).slice().sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "")), [value.workspace.events])
  const addEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date) return
    await value.onCommand({ type: "manage_event", action: "add", event: { title: eventForm.title.trim(), date: eventForm.date, start: eventForm.start || undefined, end: eventForm.start && eventForm.end ? eventForm.end : undefined, timezone: eventForm.timezone !== CAMPUS_TIMEZONE ? eventForm.timezone : undefined, description: eventForm.description.trim() || undefined } })
    setAddingEvent(false)
    setEventForm({ title: "", date: "", start: "", end: "", timezone: CAMPUS_TIMEZONE, description: "" })
  }
  const removeEvent = async (eventId: string) => {
    await value.onCommand({ type: "manage_event", action: "remove", eventId })
    setInspection(null)
  }

  const inspectDay = (date: string) => setInspection((current) => current?.kind === "day" && current.date === date ? null : { kind: "day", date })
  const inspectEntry = (entry: CalendarEvent, fromDate?: string) => setInspection({ kind: "entry", entry, fromDate })
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

  const inspector = () => {
    if (!inspection) return <p className="muted inspector-empty">Click a day, or any single entry, and its summary lands here.</p>
    if (inspection.kind === "day") {
      const dayEvents = eventsByDay.get(inspection.date) ?? []
      return <>
        <h3>{format(new Date(`${inspection.date}T12:00:00`), "EEEE, MMMM d")}</h3>
        {dayEvents.length === 0 ? <p className="muted">Nothing scheduled.</p> : <ul className="inspector-day-list">
          {dayEvents.map((event) => <li key={event.id}>
            <button type="button" className="event-open" onClick={() => inspectEntry(event, inspection.date)}>
              <b>{event.start ? `${event.start}${event.end ? ` to ${event.end}` : ""}` : "All day"}</b>
              <span>{event.title}</span>
            </button>
          </li>)}
        </ul>}
      </>
    }
    const entry = inspection.entry
    return <>
      {inspection.fromDate && <button className="text-button inspector-back" type="button" onClick={() => setInspection({ kind: "day", date: inspection.fromDate! })}>← {inspection.fromDate}</button>}
      <h3>{entry.title}</h3>
      <p className="event-detail-when"><b>{entry.start ? `${entry.start}${entry.end ? ` to ${entry.end}` : ""}` : "All day"}</b> on {entry.date}, shown in {displayLabel}{entry.timezone && entry.timezone !== displayTimezone ? `; recorded in ${entry.timezone}` : ""}</p>
      {entry.detail ? <p className="event-detail-description">{entry.detail}</p> : <p className="event-detail-description muted">No description recorded.</p>}
      <div className="event-detail-actions">
        <span className={`legend-item ${entry.kind}`}>{kindLabel[entry.kind] ?? entry.kind}</span>
        {entry.projected && <span className="muted">Projected date</span>}
        {entry.kind === "event" && entry.sourceId && <button className="text-button" type="button" onClick={() => void removeEvent(entry.sourceId!)}>Remove event</button>}
        {entry.kind === "todo" && entry.sourceId && <button className="text-button" type="button" onClick={() => { void value.onCommand({ type: "manage_todo", action: "toggle", todoId: entry.sourceId! }); setInspection(null) }}>Mark done</button>}
      </div>
    </>
  }

  return <div className="page calendar-page">
    <header className="page-heading calendar-heading">
      <div>
        <h1>{headline}</h1>
        <p>{seasonNames[currentTermRef.season]} · {format(monthStart, "MMMM yyyy")}</p>
      </div>
      <div className="calendar-controls">
        <label className="timezone-control">
          <span className="sr-only">Times shown in</span>
          <select className="chunky-select" aria-label="Times shown in" value={displayTimezone} onChange={(event) => chooseTimezone(event.target.value)}>
            {timezoneChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} ({timezoneOffsetLabel(choice.id)})</option>)}
          </select>
        </label>
        <button className="secondary-button small" type="button" onClick={() => setMonthStart((current) => addMonths(current, -1))} aria-label="Previous month">← Previous</button>
        <button className="secondary-button small" type="button" onClick={() => setMonthStart(startOfMonth(new Date()))}>Today</button>
        <button className="secondary-button small" type="button" onClick={() => setMonthStart((current) => addMonths(current, 1))} aria-label="Next month">Next →</button>
      </div>
    </header>

    <div className="calendar-layout">
      <section className="calendar-panel" aria-label="Month calendar">
        <div className="calendar-weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {gridDays.map((day) => {
            const iso = isoDate(day)
            const dayEvents = eventsByDay.get(iso) ?? []
            const outside = day.getMonth() !== monthStart.getMonth()
            const selected = (inspection?.kind === "day" && inspection.date === iso) || (inspection?.kind === "entry" && inspection.entry.date === iso)
            const shown = dayEvents.slice(0, 2)
            return <div key={iso} className={`calendar-cell${outside ? " outside" : ""}${iso === todayIso ? " today" : ""}${selected ? " selected" : ""}`}>
              <button type="button" className="calendar-cell-date" onClick={() => inspectDay(iso)} aria-label={`Open ${iso}, ${dayEvents.length} items`}>{day.getDate()}</button>
              {shown.map((event) => <button key={event.id} type="button" className={`calendar-chip ${event.kind}${event.projected ? " projected" : ""}`} onClick={() => inspectEntry(event, iso)} title={event.title}>{event.start ? `${event.start} ` : ""}{event.title}</button>)}
              {dayEvents.length > 2 && <button type="button" className="calendar-more" onClick={() => inspectDay(iso)}>+{dayEvents.length - 2} more</button>}
            </div>
          })}
        </div>
        <div className="calendar-legend">
          <span className="legend-item academic">Stanford dates</span>
          <span className="legend-item course">Classes</span>
          <span className="legend-item club">Clubs</span>
          <span className="legend-item activity">Activities</span>
          <span className="legend-item event">Events</span>
          <span className="legend-item todo">Todos</span>
          <span className="legend-note">Dotted entries are projected until the registrar publishes that year.</span>
        </div>
      </section>

      <div className="calendar-side">
        <aside className="todo-panel inspector-panel" aria-label="Selection details">
          <div className="section-heading"><h2>Details</h2>{inspection && <button className="text-button" type="button" onClick={() => setInspection(null)}>Clear</button>}</div>
          {inspector()}
        </aside>

        <aside className="todo-panel events-panel" aria-label="Events">
          <div className="section-heading"><h2>Events</h2><button className="secondary-button small" type="button" onClick={() => setAddingEvent((current) => !current)}>{addingEvent ? "Cancel" : "Add event"}</button></div>
          {addingEvent && <form className="event-add" onSubmit={(event) => { event.preventDefault(); void addEvent() }}>
            <input aria-label="Event title" placeholder="What is happening" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} maxLength={100} required />
            <div className="event-add-row">
              <input aria-label="Event date" type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} required />
              <input aria-label="Start time" type="time" value={eventForm.start} onChange={(event) => setEventForm({ ...eventForm, start: event.target.value })} />
              <input aria-label="End time" type="time" value={eventForm.end} onChange={(event) => setEventForm({ ...eventForm, end: event.target.value })} disabled={!eventForm.start} />
            </div>
            <select aria-label="Event timezone" value={eventForm.timezone} onChange={(event) => setEventForm({ ...eventForm, timezone: event.target.value })}>
              {timezoneChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} ({timezoneOffsetLabel(choice.id)})</option>)}
            </select>
            <textarea aria-label="Event description" rows={2} placeholder="Description (optional)" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} maxLength={600} />
            <button className="primary-button small" type="submit" disabled={!eventForm.title.trim() || !eventForm.date}>Add event</button>
          </form>}
          {upcomingEvents.length === 0 && !addingEvent ? <p className="muted side-empty">Interviews, flights, review sessions: anything with its own date and time lives here.</p> : <ul className="side-event-list">
            {upcomingEvents.map((item) => <li key={item.id}>
              <button type="button" className="event-open" onClick={() => inspectStoredEvent(item.id)}>
                <b>{item.date}{item.start ? ` · ${item.start}` : ""}</b>
                <span>{item.title}</span>
                {item.addedBy === "agent" && <em className="agent-chip">Agent</em>}
              </button>
            </li>)}
          </ul>}
        </aside>

        <aside className="todo-panel" aria-label="Todos">
          <div className="section-heading"><h2>Todos</h2><span className="count-chip">{openTodos.length}</span></div>
          <div className="todo-add">
            <input aria-label="New todo" placeholder="Add a todo" value={todoTitle} onChange={(event) => setTodoTitle(event.target.value)} />
            <div className="event-add-row">
              <input aria-label="Due date" type="date" value={todoDue} onChange={(event) => setTodoDue(event.target.value)} />
              <input aria-label="Due time" type="time" value={todoTime} onChange={(event) => setTodoTime(event.target.value)} disabled={!todoDue} />
            </div>
            <input aria-label="Todo details" placeholder="Details (optional)" value={todoDetail} onChange={(event) => setTodoDetail(event.target.value)} maxLength={300} />
            <button className="primary-button small" type="button" onClick={() => void addTodo()} disabled={!todoTitle.trim()}>Add</button>
          </div>
          <ul className="todo-list">
            {openTodos.map((todo) => <li key={todo.id}>
              <label>
                <input type="checkbox" checked={false} onChange={() => void value.onCommand({ type: "manage_todo", action: "toggle", todoId: todo.id })} aria-label={`Complete ${todo.title}`} />
                <span><b>{todo.title}</b>{todo.due && <em>due {todo.due}{todo.dueTime ? ` at ${todo.dueTime}` : ""}</em>}{todo.detail && <small>{todo.detail}</small>}</span>
              </label>
              <span className={`todo-source ${todo.source}`}>{todo.source === "system" ? "Stanford" : todo.source === "agent" ? "Agent" : "You"}</span>
              <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "manage_todo", action: "remove", todoId: todo.id })} aria-label={`Remove ${todo.title}`}>Remove</button>
            </li>)}
          </ul>
          {doneTodos.length > 0 && <details className="todo-done">
            <summary>{doneTodos.length} done</summary>
            <ul className="todo-list">
              {doneTodos.map((todo) => <li key={todo.id} className="done">
                <label><input type="checkbox" checked onChange={() => void value.onCommand({ type: "manage_todo", action: "toggle", todoId: todo.id })} aria-label={`Reopen ${todo.title}`} /><span><b>{todo.title}</b></span></label>
              </li>)}
            </ul>
          </details>}
        </aside>
      </div>
    </div>
  </div>
}
