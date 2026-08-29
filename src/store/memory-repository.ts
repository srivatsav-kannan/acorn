import type { Fixture, WorkspaceState } from "@/domain/types"

export class RepositoryError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

type Session = { sessionId: string, workspaceId: string, userId: string, expiresAt: string }

export class MemoryWorkspaceRepository {
  readonly catalog
  private readonly canonical: WorkspaceState
  private workspaces = new Map<string, WorkspaceState>()
  private sessions = new Map<string, Session>()
  private now: () => Date

  constructor(fixture: Fixture, options: { now?: () => Date } = {}) {
    this.catalog = structuredClone(fixture.catalog)
    this.canonical = structuredClone(fixture.workspace)
    this.workspaces.set(this.canonical.id, structuredClone(this.canonical))
    this.now = options.now ?? (() => new Date())
  }

  setNow(now: () => Date) { this.now = now }

  // Swap a workspace's state in place, keeping this repository instance and
  // every closure holding it valid. Registered WebMCP tools capture the
  // repository once, so recovery from a failed commit must never construct a
  // replacement repository or those tools keep writing into an orphan.
  replaceWorkspace(workspace: WorkspaceState) {
    this.workspaces.set(workspace.id, structuredClone(workspace))
  }

  async getWorkspace(workspaceId: string, userId: string) {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace || workspace.ownerUserId !== userId) throw new RepositoryError("FORBIDDEN", "You do not have access to this workspace")
    return structuredClone(workspace)
  }

  async mutateWorkspace<T>(workspaceId: string, userId: string, expectedVersion: number, mutate: (workspace: WorkspaceState) => { workspace: WorkspaceState, inverse: unknown, result?: T }) {
    const current = this.workspaces.get(workspaceId)
    if (!current || current.ownerUserId !== userId) throw new RepositoryError("FORBIDDEN", "You do not have access to this workspace")
    if (current.version !== expectedVersion) throw new RepositoryError("VERSION_CONFLICT", `Expected workspace version ${expectedVersion}, received ${current.version}`)
    const draft = structuredClone(current)
    const output = mutate(draft)
    output.workspace.version = current.version + 1
    this.workspaces.set(workspaceId, structuredClone(output.workspace))
    return { workspace: structuredClone(output.workspace), inverse: output.inverse, result: output.result }
  }

  async createDemoSession(sessionId: string, ttlSeconds = 60 * 60 * 4) {
    const suffix = sessionId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) || "DEMO"
    const workspaceId = `WORKSPACE-${suffix}`
    const userId = `USER-${suffix}`
    const workspace = structuredClone(this.canonical)
    workspace.id = workspaceId
    workspace.ownerUserId = userId
    workspace.version = 1
    workspace.profile.id = `PROFILE-${suffix}`
    workspace.activity = []
    workspace.receipts = []
    workspace.undoSnapshots = {}
    this.workspaces.set(workspaceId, workspace)
    const session = { sessionId, workspaceId, userId, expiresAt: new Date(this.now().getTime() + ttlSeconds * 1000).toISOString() }
    this.sessions.set(sessionId, session)
    return structuredClone(session)
  }

  async getSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new RepositoryError("SESSION_NOT_FOUND", "Demo session not found")
    if (new Date(session.expiresAt) <= this.now()) {
      this.sessions.delete(sessionId)
      this.workspaces.delete(session.workspaceId)
      throw new RepositoryError("SESSION_EXPIRED", "Demo session expired")
    }
    return structuredClone(session)
  }

  async resetDemoSession(sessionId: string) {
    const session = await this.getSession(sessionId)
    const workspace = structuredClone(this.canonical)
    workspace.id = session.workspaceId
    workspace.ownerUserId = session.userId
    workspace.profile.id = `PROFILE-${session.userId.replace(/^USER-/, "")}`
    workspace.version = 1
    workspace.activity = []
    workspace.receipts = []
    workspace.undoSnapshots = {}
    this.workspaces.set(session.workspaceId, workspace)
    return structuredClone(session)
  }
}
