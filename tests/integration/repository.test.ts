import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/workspace/fixture"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

describe("demo repository isolation", () => {
  it("creates isolated clones and resets only the target session", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const a = await repository.createDemoSession("SESSION-A")
    const b = await repository.createDemoSession("SESSION-B")
    expect(a.workspaceId).not.toBe(b.workspaceId)

    await repository.mutateWorkspace(a.workspaceId, a.userId, 1, (workspace) => {
      workspace.profile.name = "Changed A"
      return { workspace, inverse: null }
    })
    expect((await repository.getWorkspace(a.workspaceId, a.userId)).profile.name).toBe("Changed A")
    expect((await repository.getWorkspace(b.workspaceId, b.userId)).profile.name).not.toBe("Changed A")

    await repository.resetDemoSession("SESSION-A")
    expect((await repository.getWorkspace(a.workspaceId, a.userId)).profile.name).toBe(buildFixture().workspace.profile.name)
  })

  it("expires demo sessions and fails closed", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture(), { now: () => new Date("2026-08-27T00:00:00Z") })
    const session = await repository.createDemoSession("SESSION-EXPIRES", 60)
    repository.setNow(() => new Date("2026-08-27T00:02:00Z"))
    await expect(repository.getSession(session.sessionId)).rejects.toMatchObject({ code: "SESSION_EXPIRED" })
  })

  it("keeps the canonical fixture immutable", async () => {
    const fixture = buildFixture()
    const repository = new MemoryWorkspaceRepository(fixture)
    const session = await repository.createDemoSession("SESSION-MUTATE")
    await repository.mutateWorkspace(session.workspaceId, session.userId, 1, (workspace) => {
      workspace.contextItems.length = 0
      return { workspace, inverse: null }
    })
    expect(buildFixture().workspace.contextItems.length).toBe(fixture.workspace.contextItems.length)
  })
})
