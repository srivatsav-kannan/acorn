import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

// Timezone arithmetic on date-fns and its IANA-aware TZDate, so wall-clock
// conversions stay correct decades out, daylight saving rules included. An
// event records the zone it was created in; the calendar re-expresses it in
// whatever zone the viewer selects, shifting the date when a conversion
// crosses midnight.

export const CAMPUS_TIMEZONE = "America/Los_Angeles"

export const timezoneChoices: Array<{ id: string, label: string }> = [
  { id: "America/Los_Angeles", label: "Stanford (Pacific)" },
  { id: "America/Denver", label: "Mountain" },
  { id: "America/Chicago", label: "Central" },
  { id: "America/New_York", label: "Eastern" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris" },
  { id: "Asia/Kolkata", label: "India" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Australia/Sydney", label: "Sydney" }
]

export const isValidTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

// The wall-clock time (date, HH:MM) in `timezone`, as a UTC instant.
export const zonedTimeToInstant = (date: string, time: string, timezone: string): Date => {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  return new Date(new TZDate(year, month - 1, day, hour, minute, timezone).getTime())
}

// Re-express a wall-clock moment recorded in one zone as the wall-clock
// moment in another. The returned date can differ from the input date.
export const convertZonedTime = (date: string, time: string, fromTimezone: string, toTimezone: string): { date: string, time: string } => {
  if (fromTimezone === toTimezone) return { date, time }
  const instant = zonedTimeToInstant(date, time, fromTimezone)
  const zoned = new TZDate(instant.getTime(), toTimezone)
  return { date: format(zoned, "yyyy-MM-dd"), time: format(zoned, "HH:mm") }
}

// A short current-offset label such as "UTC+5:30" for the zone picker.
export const timezoneOffsetLabel = (timezone: string, at = new Date()): string => {
  const zoned = new TZDate(at.getTime(), timezone)
  const minutes = -zoned.getTimezoneOffset()
  if (minutes === 0) return "UTC"
  const sign = minutes > 0 ? "+" : "-"
  const magnitude = Math.abs(minutes)
  const hours = Math.floor(magnitude / 60)
  const rest = magnitude % 60
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`
}
