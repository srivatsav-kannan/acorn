import type { CalendarEvent } from "@/domain/planning/calendar"
import { CAMPUS_TIMEZONE } from "@/domain/planning/timezone"

// A minimal, dependency-free iCalendar export of derived calendar entries, so
// a month of classes, registrar dates, events, and timed todos drops into
// Google Calendar or Apple Calendar in one file. All-day entries export as
// date values; timed entries carry their recorded IANA zone as a TZID.

const escapeText = (value: string): string => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

const compact = (date: string) => date.replaceAll("-", "")
const compactTime = (time: string) => `${time.replace(":", "")}00`

const foldLine = (line: string): string => {
  if (line.length <= 73) return line
  const parts: string[] = []
  let rest = line
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73))
    rest = ` ${rest.slice(73)}`
  }
  parts.push(rest)
  return parts.join("\r\n")
}

export const buildIcs = (events: CalendarEvent[], calendarName = "Acorn"): string => {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Acorn//Workspace Calendar//EN",
    `X-WR-CALNAME:${escapeText(calendarName)}`
  ]
  for (const event of events) {
    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${event.id}@acorn`)
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.detail) lines.push(`DESCRIPTION:${escapeText(event.detail)}`)
    if (event.start) {
      const zone = event.timezone ?? CAMPUS_TIMEZONE
      lines.push(`DTSTART;TZID=${zone}:${compact(event.date)}T${compactTime(event.start)}`)
      lines.push(`DTEND;TZID=${zone}:${compact(event.date)}T${compactTime(event.end ?? event.start)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(event.date)}`)
    }
    lines.push(`CATEGORIES:${escapeText(event.kind)}`)
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return lines.map(foldLine).join("\r\n") + "\r\n"
}
