// Deterministic timezone arithmetic built on the platform's own IANA data.
// An event records the zone it was created in; the calendar re-expresses it
// in whatever zone the viewer selects, shifting the date when a conversion
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

const wallParts = (instant: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]))
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) % 24, minute: Number(parts.minute) }
}

// The wall-clock time (date, HH:MM) in `timezone`, as a UTC instant. Solved by
// iteration because offsets depend on the answer; two rounds converge for
// every real zone, DST transitions included.
export const zonedTimeToInstant = (date: string, time: string, timezone: string): Date => {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let guess = target
  for (let round = 0; round < 3; round += 1) {
    const wall = wallParts(new Date(guess), timezone)
    const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
    if (wallAsUtc === target) break
    guess += target - wallAsUtc
  }
  return new Date(guess)
}

// Re-express a wall-clock moment recorded in one zone as the wall-clock
// moment in another. The returned date can differ from the input date.
export const convertZonedTime = (date: string, time: string, fromTimezone: string, toTimezone: string): { date: string, time: string } => {
  if (fromTimezone === toTimezone) return { date, time }
  const instant = zonedTimeToInstant(date, time, fromTimezone)
  const wall = wallParts(instant, toTimezone)
  return {
    date: `${wall.year}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`,
    time: `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`
  }
}

// A short current-offset label such as "UTC+5:30" for the zone picker.
export const timezoneOffsetLabel = (timezone: string, at = new Date()): string => {
  const wall = wallParts(at, timezone)
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  const utc = wallParts(at, "UTC")
  const utcAsUtc = Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute)
  const minutes = Math.round((wallAsUtc - utcAsUtc) / 60000)
  if (minutes === 0) return "UTC"
  const sign = minutes > 0 ? "+" : "-"
  const magnitude = Math.abs(minutes)
  const hours = Math.floor(magnitude / 60)
  const rest = magnitude % 60
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`
}
