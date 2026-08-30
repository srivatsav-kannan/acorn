"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { buildFixture as buildDemoFixture, buildStanfordCatalog } from "@/data/fixture"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { executeCommand } from "@/domain/commands"
import { materializeLegacyResearch, refreshSystemEvidence } from "@/domain/evidence"
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

// Commit failures carry a machine-readable code so WebMCP tools can tell an
// agent whether a retry with the same idempotency key is safe.
class CommitError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export const WorkspaceProvider = ({ children, mode, initialWorkspace, userId, userEmail = "", catalog, isDemoAccount = false, localAccount = false }: { children: ReactNode, mode: "fixture" | "account", initialWorkspace?: WorkspaceState, userId?: string, userEmail?: string, catalog?: Catalog, isDemoAccount?: boolean, localAccount?: boolean }) => {
  const router = useRouter()
  const [initial] = useState(() => {
    if (mode === "account") {
      if (!initialWorkspace || !userId) throw new Error("Authenticated workspace data is required")
      return { workspace: refreshSystemEvidence(materializeLegacyResearch(initialWorkspace), institutionForWorkspace(initialWorkspace).buildEvidence()), catalog: catalog ?? buildStanfordCatalog() }
    }
    return buildDemoFixture()
  })
  const storageKey = localAccount ? localStorageKey : demoStorageKey
  const [booted, setBooted] = useState(mode === "account" || !localAccount)
  const [workspace, setWorkspace] = useState(initial.workspace)
  // One repository for the whole session. Registered WebMCP tools close over
  // it, so recovery paths swap its contents with replaceWorkspace instead of
  // constructing a replacement the tools would never see.
  const [repository] = useState(() => new MemoryWorkspaceRepository(initial))
  const [saveState, setSaveState] = useState<WorkspaceContextValue["saveState"]>("idle")
  const [message, setMessage] = useState<WorkspaceContextValue["message"]>(null)
  const counter = useRef(0)
  const commandQueue = useRef<Promise<unknown>>(Promise.resolve())
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
          repository.replaceWorkspace(next.workspace)
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
        repository.replaceWorkspace(next.workspace)
        setWorkspace(next.workspace)
      }, 0)
      return () => window.clearTimeout(timeout)
    } catch {
      localStorage.removeItem(demoStorageKey)
    }
  }, [initial.catalog, mode, localAccount, repository, router])

  const refresh = useCallback(async () => {
    const next = await repository.getWorkspace(workspace.id, ownerUserId)
    setWorkspace(next)
    if (mode === "fixture") localStorage.setItem(storageKey, JSON.stringify(next))
    return next
  }, [mode, ownerUserId, repository, storageKey, workspace.id])

  const restoreRemote = useCallback(async () => {
    // Two attempts, because this runs exactly when something already failed
    // and a stale in-memory workspace is worse than a short extra wait.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store", signal: AbortSignal.timeout(6000) })
        if (!response.ok) throw new Error(`Reload failed with status ${response.status}`)
        const payload = await response.json() as { workspace: WorkspaceState }
        repository.replaceWorkspace(payload.workspace)
        setWorkspace(payload.workspace)
        return
      } catch (error) {
        if (attempt === 1) throw new CommitError("RELOAD_FAILED", `The workspace could not be reloaded from the server, so local state may be stale. Reload the page before continuing. (${(error as Error).message})`)
      }
    }
  }, [repository])

  const persistWorkspace = useCallback(async (next: WorkspaceState, expectedVersion: number, idempotencyKey: string, previous?: WorkspaceState) => {
    if (mode === "fixture") {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setWorkspace(next)
      return
    }
    let response: Response
    try {
      response = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion, workspace: next, idempotencyKey }), signal: AbortSignal.timeout(8000) })
    } catch (error) {
      // The acknowledgement is lost, not necessarily the commit. A few
      // hundred bytes from /head settle which one happened, without the
      // multi-second full-payload reload that used to run here first.
      try {
        const headResponse = await fetch("/api/workspace/head", { cache: "no-store", signal: AbortSignal.timeout(5000) })
        if (headResponse.ok) {
          const head = await headResponse.json() as { version?: number, idempotencyKey?: string | null }
          if (head.version === expectedVersion + 1 && head.idempotencyKey === idempotencyKey) {
            repository.replaceWorkspace(next)
            setWorkspace(next)
            return
          }
          if (head.version === expectedVersion && previous) {
            repository.replaceWorkspace(previous)
            setWorkspace(previous)
            throw new CommitError("COMMIT_TIMEOUT", "The save has not landed and local state was rolled back. Retry with the identical idempotency key; if the delayed commit lands first, the retry returns its original receipt.")
          }
        }
      } catch (headError) {
        if (headError instanceof CommitError) throw headError
      }
      await restoreRemote()
      throw new CommitError("COMMIT_TIMEOUT", `The save did not confirm in time and the workspace was reloaded from the server. Retry with the same idempotency key; a landed commit will return its original receipt. (${(error as Error).message})`)
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { code?: string, message?: string }
      if (response.status !== 409 && previous) {
        // A deterministic rejection means nothing landed, so the captured
        // pre-mutation state restores instantly without a payload download.
        repository.replaceWorkspace(previous)
        setWorkspace(previous)
      } else {
        await restoreRemote()
      }
      throw new CommitError(payload.code ?? "COMMIT_FAILED", payload.message ?? "The change could not be saved.")
    }
    setWorkspace(next)
  }, [mode, repository, restoreRemote, storageKey])

  const runCommand = async (command: Record<string, unknown>) => {
    counter.current += 1
    const current = await repository.getWorkspace(workspace.id, ownerUserId)
    const expectedVersion = current.version
    const previous = structuredClone(current)
    const key = `UI-${crypto.randomUUID()}-${counter.current}`
    setSaveState("saving")
    try {
      await executeCommand(repository, { actor: { type: "human", id: ownerUserId }, ownerUserId, workspaceId: workspace.id, expectedVersion, idempotencyKey: key, command })
      const next = await refresh()
      await persistWorkspace(next, expectedVersion, key, previous)
      setSaveState("saved")
      setMessage({ kind: "success", text: "Saved" })
    } catch (error) {
      setSaveState("error")
      setMessage({ kind: "error", text: (error as Error).message })
      throw error
    }
  }

  // Every mutation in the session serializes through this one gate: rapid UI
  // interactions, and just as importantly agent tool calls, which used to
  // bypass it and race their commits into version conflicts. Each entrant
  // sees the state the previous one produced.
  const runExclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = commandQueue.current.then(task)
    commandQueue.current = run.catch(() => undefined)
    return run
  }, [])

  const onCommand = (command: Record<string, unknown>) => runExclusive(() => runCommand(command))

  const undo = async (receiptId: string) => {
    await onCommand({ type: "undo_action", receiptId })
  }

  const reset = async () => {
    if (mode === "fixture") {
      localStorage.removeItem(storageKey)
      window.location.replace(localAccount ? "/onboarding" : "/demo")
      return
    }
    setSaveState("saving")
    const response = await fetch("/api/account/reset", { method: "POST" })
    const result = await response.json().catch(() => ({ message: "The workspace could not be reset." })) as { ok?: boolean, message?: string }
    if (!response.ok || !result.ok) {
      setSaveState("error")
      setMessage({ kind: "error", text: result.message ?? "The workspace could not be reset." })
      return
    }
    router.replace("/onboarding")
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
      runExclusive,
      onWorkspaceChanged: async (next, expectedVersion, idempotencyKey, previous) => {
        setSaveState("saving")
        try {
          await persistWorkspace(next, expectedVersion, idempotencyKey, previous)
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
  }, [ownerUserId, persistWorkspace, repository, runExclusive, workspace.id])

  // The merge only reads the overlay, so recomputing it on every command
  // (against fifteen thousand imported courses) was pure waste.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mergedCatalog = useMemo(() => mergedCatalogFor(workspace, initial.catalog), [workspace.referenceOverlay, initial.catalog])

  return <WorkspaceContext.Provider value={{ workspace, catalog: mergedCatalog, mode, isDemoAccount, localAccount, userEmail, saveState, message, onCommand, undo, reset, signOut }}>{booted ? children : <ShellSkeleton />}{message && <div className={`workspace-toast ${message.kind}`} role="status"><span>{message.kind === "success" ? "✓" : "!"}</span>{message.text}</div>}</WorkspaceContext.Provider>
}

export const useWorkspace = () => {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return value
}

export const useOptionalWorkspace = () => useContext(WorkspaceContext)
