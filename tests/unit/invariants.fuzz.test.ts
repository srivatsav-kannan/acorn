import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { goalContentOf } from "@/domain/goals"
import { RepositoryError, MemoryWorkspaceRepository } from "@/store/memory-repository"
import type { WorkspaceState } from "@/domain/types"

// Property-based sequences of plausible and garbage commands, with workspace
// invariants checked after every step. A command may succeed or fail with a
// clean RepositoryError; anything else, or any broken invariant, is a bug.

const day = fc.constantFrom("mon", "tue", "wed", "thu", "fri", "sat", "sun")
const maybe = <T,>(arb: fc.Arbitrary<T>) => fc.option(arb, { nil: undefined })
const shortText = fc.string({ minLength: 0, maxLength: 30 })
const dateish = fc.oneof(fc.constant("2026-10-05"), fc.constant("2026-02-30"), fc.constant("garbage"), fc.constant("2028-02-29"), shortText)
const timeish = fc.oneof(fc.constant("10:00"), fc.constant("25:61"), fc.constant("nope"), fc.constant("23:59"))

const commandArb = fc.oneof(
  fc.record({ type: fc.constant("manage_todo"), action: fc.constantFrom("add", "toggle", "remove", "junk"), todo: maybe(fc.record({ title: shortText, due: maybe(dateish), dueTime: maybe(timeish) })), todoId: maybe(shortText) }),
  fc.record({ type: fc.constant("manage_event"), action: fc.constantFrom("add", "update", "remove", "junk"), event: maybe(fc.record({ id: maybe(shortText), title: shortText, date: dateish, start: maybe(timeish), end: maybe(timeish), timezone: maybe(fc.constantFrom("America/New_York", "Mars/Olympus", "UTC")) })), eventId: maybe(shortText) }),
  fc.record({ type: fc.constant("manage_goal"), action: fc.constantFrom("upsert", "toggle_milestone", "set_status", "remove", "junk"), goal: maybe(fc.record({ id: maybe(fc.constantFrom("GOAL-FUZZ-A", "GOAL-FUZZ-B")), title: shortText, targetDate: maybe(dateish), milestones: maybe(fc.array(fc.record({ title: shortText, due: maybe(dateish), done: maybe(fc.boolean()) }), { maxLength: 4 })) })), goalId: maybe(fc.constantFrom("GOAL-FUZZ-A", "GOAL-FUZZ-B", "GOAL-NOPE")), milestoneId: maybe(shortText), status: maybe(fc.constantFrom("active", "achieved", "dropped", "junk")), done: maybe(fc.boolean()) }),
  fc.record({ type: fc.constant("set_course_interest"), courseId: maybe(fc.constantFrom("COURSE-CS-148", "COURSE-PSYCH-1", "")), interested: fc.boolean(), intendedTermId: maybe(fc.constantFrom("TERM-2027-WINTER", "sometime", "TERM-2028-SPRING")) }),
  fc.record({ type: fc.constant("update_profile"), patch: fc.record({ name: maybe(shortText), earliestStart: maybe(timeish), latestEnd: maybe(timeish), transitionBufferMinutes: maybe(fc.integer({ min: -10, max: 200 })), protectedWindows: maybe(fc.array(fc.record({ days: fc.array(day, { maxLength: 3 }), start: timeish, end: timeish, label: shortText }), { maxLength: 5 })) }) }),
  fc.record({ type: fc.constant("create_context_item"), item: fc.record({ id: maybe(shortText), type: fc.constantFrom("note", "goal", "junk"), title: shortText, summary: shortText, content: fc.constant({}) }) }),
  fc.record({ type: fc.constant("undo_action"), receiptId: maybe(shortText) }),
  fc.record({ type: fc.constant("totally_unknown_command"), payload: shortText })
)

const checkInvariants = (workspace: WorkspaceState) => {
  expect(workspace.receipts.length).toBeLessThanOrEqual(300)
  expect(workspace.activity.length).toBeLessThanOrEqual(500)
  const snapshots = Object.values(workspace.undoSnapshots)
  expect(snapshots.length).toBeLessThanOrEqual(6)
  for (const snapshot of snapshots) {
    expect(Object.keys(snapshot.undoSnapshots)).toHaveLength(0)
    expect(snapshot.receipts).toHaveLength(0)
    expect(snapshot.activity).toHaveLength(0)
  }
  const todoIds = new Set(workspace.todos.map((todo) => todo.id))
  expect(todoIds.size).toBe(workspace.todos.length)
  for (const item of workspace.contextItems.filter((candidate) => candidate.type === "goal")) {
    const goal = goalContentOf(item)
    if (!goal) continue
    for (const milestone of goal.milestones) {
      if (milestone.todoId && !item.archived) {
        expect(todoIds.has(milestone.todoId)).toBe(true)
        const linked = workspace.todos.find((todo) => todo.id === milestone.todoId)!
        expect(linked.done).toBe(milestone.done)
      }
    }
  }
  for (const courseId of Object.keys(workspace.courseIntents ?? {})) {
    expect(workspace.interestedCourseIds).toContain(courseId)
  }
  for (const window of workspace.profile.protectedWindows ?? []) {
    expect(window.end > window.start).toBe(true)
    expect(window.days.length).toBeGreaterThan(0)
  }
}

describe("workspace invariants under fuzzed command sequences", () => {
  it("either applies cleanly or refuses cleanly, never corrupting state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(commandArb, { minLength: 5, maxLength: 25 }), async (commands) => {
        const repository = new MemoryWorkspaceRepository(buildFixture())
        let version = 1
        for (const [index, command] of commands.entries()) {
          try {
            const receipt = await executeCommand(repository, { actor: { type: "agent", id: "AGENT-FUZZ" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion: version, idempotencyKey: `FUZZ-${index}-${version}`, command: command as Record<string, unknown> })
            if (receipt.ok) {
              expect(receipt.workspaceVersion).toBe(version + 1)
              version = receipt.workspaceVersion
            }
          } catch (error) {
            expect(error).toBeInstanceOf(RepositoryError)
            expect(typeof (error as RepositoryError).code).toBe("string")
            expect((error as Error).message.length).toBeGreaterThan(0)
          }
          const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
          expect(workspace.version).toBe(version)
          checkInvariants(workspace)
        }
      }),
      { numRuns: 60 }
    )
  })
})
