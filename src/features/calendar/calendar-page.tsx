"use client"

import { useEffect, useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { calendarEventsForRange, isoDate, type CalendarEvent } from "@/domain/calendar"
import { mergedOpportunities } from "@/domain/reference"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { standingForTerm, termForDate, timelineFor } from "@/domain/timeline"
import { CAMPUS_TIMEZONE, convertZonedTime, timezoneChoices, timezoneOffsetLabel } from "@/domain/timezone"

// One continuous calendar from New Student Orientation to commencement.
// Everything timed carries a home timezone (campus Pacific unless an event
// says otherwise), and the whole view re-expresses itself in whichever zone
// the viewer selects, shifting dates when a conversion crosses midnight.

const yearHeadline: Record<string, string> = { "Frosh": "Freshman year", "Sophomore": "Sophomore year", "Junior": "Junior year", "Senior": "Senior year", "Fifth year": "Fifth year" }
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const seasonNames: Record<string, string> = { AUTUMN: "Autumn quarter", WINTER: "Winter quarter", SPRING: "Spring quarter", SUMMER: "Summer" }
const kindLabel: Record<string, string> = { academic: "Stanford", course: "Class", club: "Club", activity: "Activity", todo: "Todo", event: "Event" }
const timezoneStorageKey = "acorn-display-timezone"

export const CalendarPage = () => {
  const value = useWorkspace()
  const timeline = timelineFor(value.workspace.profile, new Date())
  const [monthStart, setMonthStart] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedEventId, setSelectedEventId] = useState("")
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
    const start = new Date(monthStart)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return start
  }, [monthStart])
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(day.getDate() + index)
    return day
  }), [gridStart])

  // Derive in home zones over a padded range, then re-express every timed
  // entry in the display zone. The padding keeps events that cross midnight
  // during conversion from falling off the grid's edges.
  const events = useMemo(() => {
    const paddedFrom = new Date(gridStart)
    paddedFrom.setDate(paddedFrom.getDate() - 1)
    const paddedTo = new Date(gridStart)
    paddedTo.setDate(paddedTo.getDate() + 42)
    const raw = calendarEventsForRange(value.workspace, value.catalog, opportunities, isoDate(paddedFrom), isoDate(paddedTo))
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

  const midMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 15)
  const currentTermRef = termForDate(midMonth)
  const standing = standingForTerm(timeline, currentTermRef.id)
  const headline = yearHeadline[standing] ?? (standing === "Before entry" ? "Before Stanford" : standing || "Your calendar")
  const todayIso = isoDate(new Date())
  const shiftMonth = (delta: number) => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))

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
  const removeEvent = (eventId: string) => value.onCommand({ type: "manage_event", action: "remove", eventId })

  const selectedEvents = selectedDate ? eventsByDay.get(selectedDate) ?? [] : []
  const toggleEventDetail = (id: string) => setSelectedEventId((current) => current === id ? "" : id)

  const eventDetail = (event: CalendarEvent) => <div className="event-detail" role="region" aria-label={`${event.title} details`}>
    <p className="event-detail-when"><b>{event.start ? `${event.start}${event.end ? ` to ${event.end}` : ""}` : "All day"}</b> on {event.date}, shown in {timezoneChoices.find((choice) => choice.id === displayTimezone)?.label ?? displayTimezone}{event.timezone && event.timezone !== displayTimezone ? `; recorded in ${event.timezone}` : ""}</p>
    {event.detail ? <p className="event-detail-description">{event.detail}</p> : <p className="event-detail-description muted">No description recorded.</p>}
    <div className="event-detail-actions">
      <span className={`legend-item ${event.kind}`}>{kindLabel[event.kind] ?? event.kind}</span>
      {event.projected && <span className="muted">Projected date</span>}
      {event.kind === "event" && event.sourceId && <button className="text-button" type="button" onClick={() => void removeEvent(event.sourceId!)}>Remove event</button>}
      {event.kind === "todo" && event.sourceId && <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "manage_todo", action: "toggle", todoId: event.sourceId })}>Mark done</button>}
    </div>
  </div>

  return <div className="page calendar-page">
    <header className="page-heading calendar-heading">
      <div>
        <h1>{headline}</h1>
        <p>{seasonNames[currentTermRef.season]} · {monthNames[monthStart.getMonth()]} {monthStart.getFullYear()}</p>
      </div>
      <div className="calendar-controls">
        <label className="timezone-control">
          <span className="sr-only">Times shown in</span>
          <select className="chunky-select" aria-label="Times shown in" value={displayTimezone} onChange={(event) => chooseTimezone(event.target.value)}>
            {timezoneChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} ({timezoneOffsetLabel(choice.id)})</option>)}
          </select>
        </label>
        <button className="secondary-button small" type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">← Previous</button>
        <button className="secondary-button small" type="button" onClick={() => setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
        <button className="secondary-button small" type="button" onClick={() => shiftMonth(1)} aria-label="Next month">Next →</button>
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
            const shown = dayEvents.slice(0, 3)
            return <button key={iso} type="button" className={`calendar-cell${outside ? " outside" : ""}${iso === todayIso ? " today" : ""}${iso === selectedDate ? " selected" : ""}`} onClick={() => { setSelectedDate(iso === selectedDate ? "" : iso); setSelectedEventId("") }} aria-label={`${iso}, ${dayEvents.length} items`}>
              <span className="calendar-cell-date">{day.getDate()}</span>
              <span className="calendar-cell-events">
                {shown.map((event) => <span key={event.id} className={`calendar-event-line ${event.kind}${event.projected ? " projected" : ""}`}>{event.start ? `${event.start} ` : ""}{event.title}</span>)}
                {dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3} more</span>}
              </span>
            </button>
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
        {selectedDate && <div className="calendar-day-detail" role="region" aria-label={`Details for ${selectedDate}`}>
          <h2>{selectedDate}</h2>
          {selectedEvents.length === 0 ? <p className="muted">Nothing scheduled.</p> : <ul>
            {selectedEvents.map((event) => <li key={event.id} className={event.kind}>
              <button type="button" className="event-open" onClick={() => toggleEventDetail(event.id)} aria-expanded={selectedEventId === event.id}>
                <b>{event.start ? `${event.start}${event.end ? ` to ${event.end}` : ""}` : "All day"}</b>
                <span>{event.title}{event.projected ? " (projected)" : ""}</span>
              </button>
              {selectedEventId === event.id && eventDetail(event)}
            </li>)}
          </ul>}
        </div>}
      </section>

      <div className="calendar-side">
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
              <button type="button" className="event-open" onClick={() => toggleEventDetail(`EVENT-${item.id}`)} aria-expanded={selectedEventId === `EVENT-${item.id}`}>
                <b>{item.date}{item.start ? ` · ${item.start}` : ""}</b>
                <span>{item.title}</span>
                {item.addedBy === "agent" && <em className="agent-chip">Agent</em>}
              </button>
              {selectedEventId === `EVENT-${item.id}` && <div className="event-detail" role="region" aria-label={`${item.title} details`}>
                <p className="event-detail-when"><b>{item.start ? `${item.start}${item.end ? ` to ${item.end}` : ""}` : "All day"}</b> on {item.date}{item.timezone ? `, recorded in ${item.timezone}` : ", campus time"}</p>
                {item.description ? <p className="event-detail-description">{item.description}</p> : <p className="event-detail-description muted">No description recorded.</p>}
                <div className="event-detail-actions"><button className="text-button" type="button" onClick={() => void removeEvent(item.id)}>Remove event</button></div>
              </div>}
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
