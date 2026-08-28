"use client"

import { useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { calendarEventsForRange, isoDate, type CalendarEvent } from "@/domain/calendar"
import { mergedOpportunities } from "@/domain/reference"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { standingForTerm, termForDate, timelineFor } from "@/domain/timeline"

// One continuous calendar from New Student Orientation to commencement.
// The year headline tracks who you are that academic year; the grid holds the
// registrar's dates, planned class meetings, club deadlines, activities, and
// dated todos, all derived live from workspace state.

const yearHeadline: Record<string, string> = { "Frosh": "Freshman year", "Sophomore": "Sophomore year", "Junior": "Junior year", "Senior": "Senior year", "Fifth year": "Fifth year" }
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const seasonNames: Record<string, string> = { AUTUMN: "Autumn quarter", WINTER: "Winter quarter", SPRING: "Spring quarter", SUMMER: "Summer" }

export const CalendarPage = () => {
  const value = useWorkspace()
  const timeline = timelineFor(value.workspace.profile, new Date())
  const [monthStart, setMonthStart] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState("")
  const [todoTitle, setTodoTitle] = useState("")
  const [todoDue, setTodoDue] = useState("")

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

  const events = useMemo(() => calendarEventsForRange(value.workspace, value.catalog, opportunities, isoDate(gridDays[0]), isoDate(gridDays[41])), [value.workspace, value.catalog, opportunities, gridDays])
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
    await value.onCommand({ type: "manage_todo", action: "add", todo: { title: todoTitle.trim(), due: todoDue || undefined } })
    setTodoTitle("")
    setTodoDue("")
  }

  const selectedEvents = selectedDate ? eventsByDay.get(selectedDate) ?? [] : []

  return <div className="page calendar-page">
    <header className="page-heading calendar-heading">
      <div>
        <h1>{headline}</h1>
        <p>{seasonNames[currentTermRef.season]} · {monthNames[monthStart.getMonth()]} {monthStart.getFullYear()}</p>
      </div>
      <div className="calendar-controls">
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
            return <button key={iso} type="button" className={`calendar-cell${outside ? " outside" : ""}${iso === todayIso ? " today" : ""}${iso === selectedDate ? " selected" : ""}`} onClick={() => setSelectedDate(iso === selectedDate ? "" : iso)} aria-label={`${iso}, ${dayEvents.length} items`}>
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
          <span className="legend-item todo">Todos</span>
          <span className="legend-note">Dotted entries are projected until the registrar publishes that year.</span>
        </div>
        {selectedDate && <div className="calendar-day-detail" role="region" aria-label={`Details for ${selectedDate}`}>
          <h2>{selectedDate}</h2>
          {selectedEvents.length === 0 ? <p className="muted">Nothing scheduled.</p> : <ul>
            {selectedEvents.map((event) => <li key={event.id} className={event.kind}><b>{event.start ? `${event.start} to ${event.end ?? ""}` : "All day"}</b><span>{event.title}{event.detail ? ` · ${event.detail}` : ""}{event.projected ? " (projected)" : ""}</span></li>)}
          </ul>}
        </div>}
      </section>

      <aside className="todo-panel" aria-label="Todos">
        <div className="section-heading"><h2>Todos</h2><span className="count-chip">{openTodos.length}</span></div>
        <div className="todo-add">
          <input aria-label="New todo" placeholder="Add a todo" value={todoTitle} onChange={(event) => setTodoTitle(event.target.value)} />
          <input aria-label="Due date" type="date" value={todoDue} onChange={(event) => setTodoDue(event.target.value)} />
          <button className="primary-button small" type="button" onClick={() => void addTodo()} disabled={!todoTitle.trim()}>Add</button>
        </div>
        <ul className="todo-list">
          {openTodos.map((todo) => <li key={todo.id}>
            <label>
              <input type="checkbox" checked={false} onChange={() => void value.onCommand({ type: "manage_todo", action: "toggle", todoId: todo.id })} aria-label={`Complete ${todo.title}`} />
              <span><b>{todo.title}</b>{todo.due && <em>due {todo.due}</em>}{todo.detail && <small>{todo.detail}</small>}</span>
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
}
