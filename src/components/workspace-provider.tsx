"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import type { Catalog, WorkspaceState } from "@/domain/types"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"
import { registerWebMcpTools } from "@/webmcp/register"
import { createCourseContextTools } from "@/webmcp/tools"

type WorkspaceContextValue = {
  workspace: WorkspaceState
  catalog: Catalog
  mode: "demo" | "account"
  userEmail: string
  saveState: "idle" | "saving" | "saved" | "error"
  message: { kind: "success" | "error", text: string } | null
  onCommand: (command: Record<string, unknown>) => Promise<void>
  undo: (receiptId: string) => Promise<void>
  reset: () => Promise<void>
  signOut: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const storageKey = "course-context-demo-v1"

export const WorkspaceProvider = ({ children, mode = "demo", initialWorkspace, userId, userEmail = "", catalog }: { children: ReactNode, mode?: "demo" | "account", initialWorkspace?: WorkspaceState, userId?: string, userEmail?: string, catalog?: Catalog }) => {
  const router = useRouter()
  const [initial] = useState(() => {
    const fixture = buildFixture()
    if (initialWorkspace) return { workspace: initialWorkspace, catalog: catalog ?? fixture.catalog }
    return fixture
  })
  const [workspace, setWorkspace] = useState(initial.workspace)
  const [repository, setRepository] = useState(() => new MemoryWorkspaceRepository(initial))
  const [saveState, setSaveState] = useState<WorkspaceContextValue["saveState"]>("idle")
  const [message, setMessage] = useState<WorkspaceContextValue["message"]>(null)
  const counter = useRef(0)
  const ownerUserId = userId ?? workspace.ownerUserId

  useEffect(() => {
    if (mode !== "demo") return

    const fresh = new URLSearchParams(window.location.search).get("fresh") === "1"
    if (fresh) {
      localStorage.removeItem(storageKey)
      window.history.replaceState(null, "", window.location.pathname)
      return
    }

    const stored = localStorage.getItem(storageKey)
    if (!stored) return

    try {
      const next = { workspace: JSON.parse(stored) as WorkspaceState, catalog: initial.catalog }
      const timeout = window.setTimeout(() => {
        setRepository(new MemoryWorkspaceRepository(next))
        setWorkspace(next.workspace)
      }, 0)
      return () => window.clearTimeout(timeout)
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [initial.catalog, mode])

  const refresh = useCallback(async () => {
    const next = await repository.getWorkspace(workspace.id, ownerUserId)
    setWorkspace(next)
    if (mode === "demo") localStorage.setItem(storageKey, JSON.stringify(next))
    return next
  }, [mode, ownerUserId, repository, workspace.id])

  const restoreRemote = useCallback(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" })
    if (!response.ok) throw new Error("Could not reload the workspace")
    const payload = await response.json() as { workspace: WorkspaceState }
    const nextFixture = { workspace: payload.workspace, catalog: initial.catalog }
    setRepository(new MemoryWorkspaceRepository(nextFixture))
    setWorkspace(payload.workspace)
  }, [initial.catalog])

  const persistWorkspace = useCallback(async (next: WorkspaceState, expectedVersion: number, idempotencyKey: string) => {
    if (mode === "demo") {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setWorkspace(next)
      return
    }
    const response = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion, workspace: next, idempotencyKey }) })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: "The change could not be saved." })) as { message?: string }
      await restoreRemote()
      throw new Error(payload.message ?? "The change could not be saved.")
    }
    setWorkspace(next)
  }, [mode, restoreRemote])

  const onCommand = async (command: Record<string, unknown>) => {
    counter.current += 1
    const current = await repository.getWorkspace(workspace.id, ownerUserId)
    const key = `UI-${crypto.randomUUID()}-${counter.current}`
    setSaveState("saving")
    try {
      await executeCommand(repository, { actor: { type: "human", id: ownerUserId }, ownerUserId, workspaceId: workspace.id, expectedVersion: current.version, idempotencyKey: key, command })
      const next = await refresh()
      await persistWorkspace(next, current.version, key)
      setSaveState("saved")
      setMessage({ kind: "success", text: "Saved to your workspace" })
    } catch (error) {
      setSaveState("error")
      setMessage({ kind: "error", text: (error as Error).message })
      throw error
    }
  }

  const undo = async (receiptId: string) => {
    await onCommand({ type: "undo_action", receiptId })
  }

  const reset = async () => {
    if (mode !== "demo") throw new Error("Account workspaces cannot be reset from the demo control")
    localStorage.removeItem(storageKey)
    const fixture = buildFixture()
    setRepository(new MemoryWorkspaceRepository(fixture))
    setWorkspace(fixture.workspace)
  }

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST", redirect: "follow" })
    router.push("/")
    router.refresh()
  }

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    const markedDocument = document as Document & { modelContext?: { registerTool: (tool: unknown) => { unregister?: () => void } | void } }
    const tools = createCourseContextTools({
      repository,
      session: { userId: ownerUserId, workspaceId: workspace.id, actor: { type: "agent", id: "AGENT-WEBMCP" } },
      now: () => new Date(),
      onWorkspaceChanged: async (next, expectedVersion, idempotencyKey) => {
        setSaveState("saving")
        try {
          await persistWorkspace(next, expectedVersion, idempotencyKey)
          setSaveState("saved")
          setMessage({ kind: "success", text: "Agent change saved" })
        } catch (error) {
          setSaveState("error")
          setMessage({ kind: "error", text: (error as Error).message })
          throw error
        }
      }
    })
    return registerWebMcpTools(markedDocument, tools)
  }, [ownerUserId, persistWorkspace, repository, workspace.id])

  return <WorkspaceContext.Provider value={{ workspace, catalog: initial.catalog, mode, userEmail, saveState, message, onCommand, undo, reset, signOut }}>{children}{message && <div className={`workspace-toast ${message.kind}`} role="status"><span>{message.kind === "success" ? "✓" : "!"}</span>{message.text}</div>}</WorkspaceContext.Provider>
}

export const useWorkspace = () => {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return value
}

export const useOptionalWorkspace = () => useContext(WorkspaceContext)
