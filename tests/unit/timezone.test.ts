import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { calendarEventsForRange } from "@/domain/calendar"
import { executeCommand } from "@/domain/commands"
import { convertZonedTime, isValidTimezone, timezoneOffsetLabel, zonedTimeToInstant } from "@/domain/timezone"
import { exportBlocks } from "@/webmcp/export"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

describe("timezone arithmetic", () => {
  it("converts Pacific wall time to other zones, dates included", () => {
    expect(convertZonedTime("2026-10-05", "15:00", "America/Los_Angeles", "America/New_York")).toEqual({ date: "2026-10-05", time: "18:00" })
    expect(convertZonedTime("2026-10-05", "15:00", "America/Los_Angeles", "Asia/Kolkata")).toEqual({ date: "2026-10-06", time: "03:30" })
    expect(convertZonedTime("2026-10-05", "15:00", "America/Los_Angeles", "America/Los_Angeles")).toEqual({ date: "2026-10-05", time: "15:00" })
    expect(convertZonedTime("2026-10-06", "03:30", "Asia/Kolkata", "America/Los_Angeles")).toEqual({ date: "2026-10-05", time: "15:00" })
  })

  it("respects daylight saving on both sides of the transition", () => {
    expect(convertZonedTime("2026-07-01", "12:00", "America/Los_Angeles", "UTC").time).toBe("19:00")
    expect(convertZonedTime("2026-01-15", "12:00", "America/Los_Angeles", "UTC").time).toBe("20:00")
    expect(zonedTimeToInstant("2026-01-15", "12:00", "America/Los_Angeles").toISOString()).toBe("2026-01-15T20:00:00.000Z")
  })

  it("labels offsets and rejects invented zones", () => {
    expect(timezoneOffsetLabel("UTC")).toBe("UTC")
    expect(timezoneOffsetLabel("Asia/Kolkata")).toBe("UTC+5:30")
    expect(isValidTimezone("America/New_York")).toBe(true)
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false)
  })
})

describe("workspace events", () => {
  const setup = () => new MemoryWorkspaceRepository(buildFixture())
  const run = (repository: MemoryWorkspaceRepository, command: Record<string, unknown>, expectedVersion: number, key: string, actor: "human" | "agent" = "human") =>
    executeCommand(repository, { actor: { type: actor, id: `${actor.toUpperCase()}-TEST` }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })

  it("adds, updates, and removes events with full validation", async () => {
    const repository = setup()
    await expect(run(repository, { type: "manage_event", action: "add", event: { title: "", date: "2026-10-05" } }, 1, "E0")).rejects.toThrow(/needs a title/)
    await expect(run(repository, { type: "manage_event", action: "add", event: { title: "X", date: "October 5" } }, 1, "E1")).rejects.toThrow(/YYYY-MM-DD/)
    await expect(run(repository, { type: "manage_event", action: "add", event: { title: "X", date: "2026-10-05", end: "16:00" } }, 1, "E2")).rejects.toThrow(/needs a start/)
    await expect(run(repository, { type: "manage_event", action: "add", event: { title: "X", date: "2026-10-05", start: "15:00", timezone: "Mars/Olympus_Mons" } }, 1, "E3")).rejects.toThrow(/IANA/)
    const receipt = await run(repository, { type: "manage_event", action: "add", event: { title: "CURIS interview", date: "2026-10-05", start: "15:00", end: "15:45", timezone: "America/New_York", description: "Zoom link arrives by email." } }, 1, "E4", "agent")
    expect(receipt.primaryVisibleId).toBeTruthy()
    let workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.events[0]).toMatchObject({ title: "CURIS interview", timezone: "America/New_York", addedBy: "agent" })
    const eventId = workspace.events[0].id
    await run(repository, { type: "manage_event", action: "update", event: { id: eventId, title: "CURIS interview, round two", date: "2026-10-06", start: "10:00" } }, 2, "E5")
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.events[0].title).toBe("CURIS interview, round two")
    await expect(run(repository, { type: "manage_event", action: "update", event: { id: "EVENT-NOPE", title: "X", date: "2026-10-05" } }, 3, "E6")).rejects.toThrow(/not found/)
    await run(repository, { type: "manage_event", action: "remove", eventId }, 3, "E7")
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.events).toHaveLength(0)
    await expect(run(repository, { type: "manage_event", action: "remove", eventId: "EVENT-NOPE" }, 4, "E8")).rejects.toThrow(/not found/)
  })

  it("derives events and timed todos onto the calendar and into the export", async () => {
    const { workspace, catalog } = buildFixture()
    workspace.events.push({ id: "EVENT-1", title: "Flight home", description: "SFO to CDG", date: "2026-12-13", start: "19:30", timezone: "America/Los_Angeles", addedBy: "human", createdAt: "2026-08-29T00:00:00Z" })
    workspace.todos.push({ id: "TODO-TIMED", title: "Submit study list", due: "2026-10-09", dueTime: "17:00", done: false, source: "human", createdAt: "2026-08-29T00:00:00Z" })
    const events = calendarEventsForRange(workspace, catalog, [], "2026-10-01", "2026-12-20")
    const flight = events.find((event) => event.kind === "event")!
    expect(flight).toMatchObject({ date: "2026-12-13", start: "19:30", detail: "SFO to CDG", timezone: "America/Los_Angeles", sourceId: "EVENT-1" })
    const timedTodo = events.find((event) => event.id === "TODO-TODO-TIMED")!
    expect(timedTodo.start).toBe("17:00")
    const exported = exportBlocks(workspace, catalog, [], "events", new Date("2026-10-01T12:00:00Z")).join("\n")
    expect(exported).toContain("Flight home")
    expect(exported).toContain("America/Los_Angeles")
  })
})
