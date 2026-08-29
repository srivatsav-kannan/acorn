"use client"

import { format } from "date-fns"
import type { CalendarEvent } from "@/domain/calendar"
import type { ProtectedWindow } from "@/domain/types"

// The scheduler-native view: seven day columns against an hour ruler, every
// timed entry placed at its real height, protected windows shaded underneath,
// and a hairline marking the present moment. Untimed entries keep their chip
// form in a lane above the ruler so nothing invents a false time.

const HOUR_PX = 52
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

const minutesOf = (time: string) => {
  const [hours, mins] = time.split(":").map(Number)
  return hours * 60 + mins
}

type Placed = {
  event: CalendarEvent
  start: number
  end: number
  lane: number
  laneCount: number
}

// Greedy lane assignment inside each overlapping cluster, so simultaneous
// entries sit side by side instead of hiding each other.
const placeDay = (dayEvents: CalendarEvent[]): Placed[] => {
  const timed = dayEvents.filter((event) => event.start).map((event) => ({
    event,
    start: minutesOf(event.start!),
    end: event.end ? Math.max(minutesOf(event.end), minutesOf(event.start!) + 20) : minutesOf(event.start!) + 40
  })).sort((a, b) => a.start - b.start || a.end - b.end)
  const placed: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -1
  const closeCluster = () => {
    const laneCount = cluster.reduce((max, item) => Math.max(max, item.lane + 1), 1)
    for (const item of cluster) item.laneCount = laneCount
    cluster = []
  }
  for (const item of timed) {
    if (cluster.length && item.start >= clusterEnd) closeCluster()
    const laneEnds: number[] = []
    for (const prior of cluster) laneEnds[prior.lane] = Math.max(laneEnds[prior.lane] ?? 0, prior.end)
    let lane = 0
    while ((laneEnds[lane] ?? 0) > item.start) lane += 1
    const entry: Placed = { ...item, lane, laneCount: 1 }
    cluster.push(entry)
    placed.push(entry)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  if (cluster.length) closeCluster()
  return placed
}

export const WeekView = ({ days, eventsByDay, protectedWindows, todayIso, nowMinutes, onDay, onEntry }: {
  days: string[]
  eventsByDay: Map<string, CalendarEvent[]>
  protectedWindows: ProtectedWindow[]
  todayIso: string
  nowMinutes: number
  onDay: (date: string) => void
  onEntry: (entry: CalendarEvent, fromDate: string) => void
}) => {
  const allTimed = days.flatMap((day) => (eventsByDay.get(day) ?? []).filter((event) => event.start))
  const windowStarts = protectedWindows.map((window) => minutesOf(window.start))
  const windowEnds = protectedWindows.map((window) => minutesOf(window.end))
  const earliest = Math.min(9 * 60, ...allTimed.map((event) => minutesOf(event.start!)), ...(windowStarts.length ? windowStarts : [9 * 60]))
  const latest = Math.max(18 * 60, ...allTimed.map((event) => event.end ? minutesOf(event.end) : minutesOf(event.start!) + 40), ...(windowEnds.length ? windowEnds : [18 * 60]))
  const startHour = Math.max(6, Math.floor(earliest / 60) - 1)
  const endHour = Math.min(23, Math.ceil(latest / 60) + 1)
  const gridHeight = (endHour - startHour) * HOUR_PX
  const top = (minute: number) => ((minute - startHour * 60) / 60) * HOUR_PX
  const hourLabel = (hour: number) => format(new Date(2026, 0, 5, hour), "h a")

  return <div className="week-scroll">
    <div className="week-frame">
      <div className="week-head-row">
        <span className="week-gutter-head" aria-hidden="true" />
        {days.map((iso) => {
          const date = new Date(`${iso}T12:00:00`)
          return <button key={iso} type="button" className={`week-day-head${iso === todayIso ? " today" : ""}`} onClick={() => onDay(iso)} aria-label={`Open ${iso}`}>
            <span className="week-day-name">{format(date, "EEE")}</span>
            <span className="week-day-date">{date.getDate()}</span>
          </button>
        })}
      </div>
      <div className="week-allday-row">
        <span className="week-gutter-head" aria-hidden="true" />
        {days.map((iso) => {
          const untimed = (eventsByDay.get(iso) ?? []).filter((event) => !event.start)
          return <div key={iso} className="week-allday-cell">
            {untimed.slice(0, 3).map((event) => <button key={event.id} type="button" className={`calendar-chip ${event.kind}${event.projected ? " projected" : ""}`} onClick={() => onEntry(event, iso)} title={event.title}>{event.title}</button>)}
            {untimed.length > 3 && <button type="button" className="calendar-more" onClick={() => onDay(iso)}>+{untimed.length - 3} more</button>}
          </div>
        })}
      </div>
      <div className="week-body">
        <div className="week-gutter" style={{ height: gridHeight }}>
          {Array.from({ length: endHour - startHour }, (_, index) => <span key={index} className="week-hour-label" style={{ top: index * HOUR_PX }}>{hourLabel(startHour + index)}</span>)}
        </div>
        {days.map((iso) => {
          const dayIndex = (new Date(`${iso}T12:00:00`).getDay() + 6) % 7
          const dayKey = DAY_KEYS[dayIndex]
          const placed = placeDay(eventsByDay.get(iso) ?? [])
          return <div key={iso} className={`week-day-col${iso === todayIso ? " today" : ""}`} style={{ height: gridHeight }}>
            {Array.from({ length: endHour - startHour }, (_, index) => <div key={index} className="week-hour-line" style={{ top: index * HOUR_PX }} aria-hidden="true" />)}
            {protectedWindows.filter((window) => window.days.includes(dayKey)).map((window) => {
              const from = Math.max(minutesOf(window.start), startHour * 60)
              const to = Math.min(minutesOf(window.end), endHour * 60)
              if (to <= from) return null
              return <div key={window.id} className="week-protected" style={{ top: top(from), height: top(to) - top(from) }} title={`Protected: ${window.label}`} aria-hidden="true"><span>{window.label}</span></div>
            })}
            {placed.map(({ event, start, end, lane, laneCount }) => {
              const clampedStart = Math.max(start, startHour * 60)
              const clampedEnd = Math.min(end, endHour * 60)
              if (clampedEnd <= clampedStart) return null
              const width = 100 / laneCount
              return <button key={event.id} type="button"
                className={`week-block ${event.kind}${event.projected ? " projected" : ""}`}
                style={{ top: top(clampedStart), height: Math.max(top(clampedEnd) - top(clampedStart), 18), left: `${lane * width}%`, width: `calc(${width}% - 3px)` }}
                onClick={() => onEntry(event, iso)}
                aria-label={`${event.title}, ${event.start}${event.end ? ` to ${event.end}` : ""}, ${iso}`}
                title={`${event.start}${event.end ? ` to ${event.end}` : ""} ${event.title}${event.detail ? ` · ${event.detail}` : ""}`}>
                <b>{event.title}</b>
                <span>{event.start}{event.end ? ` – ${event.end}` : ""}</span>
              </button>
            })}
            {iso === todayIso && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && <div className="week-now" style={{ top: top(nowMinutes) }} aria-hidden="true" />}
          </div>
        })}
      </div>
    </div>
  </div>
}
