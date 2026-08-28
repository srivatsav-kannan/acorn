"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { buildFixture as buildDemoFixture, buildStanfordCatalog } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { materializeLegacyResearch } from "@/domain/evidence"
import { mergedCatalogFor } from "@/domain/reference"
import type { Catalog, WorkspaceState } from "@/domain/types"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"
import { ShellSkeleton } from "@/components/shell-skeleton"
import { registerWebMcpTools } from "@/webmcp/register"
import { createCourseContextTools } from "@/webmcp/tools"

type WorkspaceContextValue = {
  workspace: WorkspaceState
  catalog: Catalog
  mode: "fixture" | "account"
  isDemoAccount: boolean
  localAccount: boolean
  userEmail: string
  saveState: "idle" | "saving" | "saved" | "error"
  message: { kind: "success" | "error", text: string } | null
  onCommand: (command: Record<string, unknown>) => Promise<void>
  undo: (receiptId: string) => Promise<void>
  reset: () => Promise<void>
  signOut: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const demoStorageKey = "course-context-demo-v1"
const localStorageKey = "course-context-local-v1"

export const WorkspaceProvider = ({ children, mode, initialWorkspace, userId, userEmail = "", catalog, isDemoAccount = false, localAccount = false }: { children: ReactNode, mode: "fixture" | "account", initialWorkspace?: WorkspaceState, userId?: string, userEmail?: string, catalog?: Catalog, isDemoAccount?: boolean, localAccount?: boolean }) => {
  const router = useRouter()
  const [initial] = useState(() => {
    if (mode === "account") {
      if (!initialWorkspace || !userId) throw new Error("Authenticated workspace data is required")
      return { workspace: materializeLegacyResearch(initialWorkspace), catalog: catalog ?? buildStanfordCatalog() }
    }
    return buildDemoFixture()
  })
  const storageKey = localAccount ? localStorageKey : demoStorageKey
  const [booted, setBooted] = useState(mode === "account" || !localAccount)
  const [workspace, setWorkspace] = useState(initial.workspace)
  const [repository, setRepository] = useState(() => new MemoryWorkspaceRepository(initial))
  const [saveState, setSaveState] = useState<WorkspaceContextValue["saveState"]>("idle")
  const [message, setMessage] = useState<WorkspaceContextValue["message"]>(null)
  const counter = useRef(0)
  const ownerUserId = userId ?? workspace.ownerUserId

  useEffect(() => {
    if (mode !== "fixture") return

    if (localAccount) {
      const stored = localStorage.getItem(localStorageKey)
      if (!stored) {
        router.replace("/onboarding")
        return
      }
      try {
        const next = { workspace: materializeLegacyResearch(JSON.parse(stored) as WorkspaceState), catalog: initial.catalog }
        localStorage.setItem(localStorageKey, JSON.stringify(next.workspace))
        const timeout = window.setTimeout(() => {
          setRepository(new MemoryWorkspaceRepository(next))
          setWorkspace(next.workspace)
          setBooted(true)
        }, 0)
        return () => window.clearTimeout(timeout)
      } catch {
        localStorage.removeItem(localStorageKey)
        router.replace("/onboarding")
      }
      return
    }

    const fresh = new URLSearchParams(window.location.search).get("fresh") === "1"
    if (fresh) {
      localStorage.removeItem(demoStorageKey)
      window.history.replaceState(null, "", window.location.pathname)
      return
    }

    const stored = localStorage.getItem(demoStorageKey)
    if (!stored) return

    try {
      const next = { workspace: materializeLegacyResearch(JSON.parse(stored) as WorkspaceState), catalog: initial.catalog }
      localStorage.setItem(demoStorageKey, JSON.stringify(next.workspace))
      const timeout = window.setTimeout(() => {
        setRepository(new MemoryWorkspaceRepository(next))
        setWorkspace(next.workspace)
      }, 0)
      return () => window.clearTimeout(timeout)
    } catch {
      localStorage.removeItem(demoStorageKey)
    }
  }, [initial.catalog, mode, localAccount, router])

  const refresh = useCallback(async () => {
    const next = await repository.getWorkspace(workspace.id, ownerUserId)
    setWorkspace(next)
    if (mode === "fixture") localStorage.setItem(storageKey, JSON.stringify(next))
    return next
  }, [mode, ownerUserId, repository, storageKey, workspace.id])

  const restoreRemote = useCallback(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" })
    if (!response.ok) throw new Error("Could not reload the workspace")
    const payload = await response.json() as { workspace: WorkspaceState }
    const nextFixture = { workspace: payload.workspace, catalog: initial.catalog }
    setRepository(new MemoryWorkspaceRepository(nextFixture))
    setWorkspace(payload.workspace)
  }, [initial.catalog])

  const persistWorkspace = useCallback(async (next: WorkspaceState, expectedVersion: number, idempotencyKey: string) => {
    if (mode === "fixture") {
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
  }, [mode, restoreRemote, storageKey])

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
      setMessage({ kind: "success", text: "Saved" })
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
    if (mode === "fixture") {
      localStorage.removeItem(storageKey)
      window.location.replace(localAccount ? "/onboarding" : "/demo")
      return
    }
    if (!isDemoAccount) throw new Error("Only the demo account can use this reset")
    setSaveState("saving")
    const response = await fetch("/api/demo/reset", { method: "POST" })
    const result = await response.json().catch(() => ({ message: "The demo could not be reset." })) as { ok?: boolean, message?: string }
    if (!response.ok || !result.ok) {
      setSaveState("error")
      setMessage({ kind: "error", text: result.message ?? "The demo could not be reset." })
      return
    }
    router.replace("/login?demo=1&reset=1")
    router.refresh()
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
          setMessage({ kind: "success", text: "Saved by your agent" })
        } catch (error) {
          setSaveState("error")
          setMessage({ kind: "error", text: (error as Error).message })
          throw error
        }
      }
    })
    return registerWebMcpTools(markedDocument, tools)
  }, [ownerUserId, persistWorkspace, repository, workspace.id])

  const mergedCatalog = useMemo(() => mergedCatalogFor(workspace, initial.catalog), [workspace, initial.catalog])

  return <WorkspaceContext.Provider value={{ workspace, catalog: mergedCatalog, mode, isDemoAccount, localAccount, userEmail, saveState, message, onCommand, undo, reset, signOut }}>{booted ? children : <ShellSkeleton />}{message && <div className={`workspace-toast ${message.kind}`} role="status"><span>{message.kind === "success" ? "✓" : "!"}</span>{message.text}</div>}</WorkspaceContext.Provider>
}

export const useWorkspace = () => {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return value
}

export const useOptionalWorkspace = () => useContext(WorkspaceContext)
