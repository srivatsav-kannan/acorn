"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import type { Catalog, WorkspaceState } from "@/domain/types"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"
import { registerWebMcpTools } from "@/webmcp/register"
import { createCourseContextTools } from "@/webmcp/tools"

type WorkspaceContextValue = {
  workspace: WorkspaceState
  catalog: Catalog
  onCommand: (command: Record<string, unknown>) => Promise<void>
  undo: (receiptId: string) => Promise<void>
  reset: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const storageKey = "course-context-demo-v1"

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [initial] = useState(() => {
    const fixture = buildFixture()
    if (typeof window === "undefined") return fixture
    const stored = localStorage.getItem(storageKey)
    if (!stored) return fixture
    try { return { workspace: JSON.parse(stored) as WorkspaceState, catalog: fixture.catalog } }
    catch { localStorage.removeItem(storageKey); return fixture }
  })
  const [workspace, setWorkspace] = useState(initial.workspace)
  const [repository, setRepository] = useState(() => new MemoryWorkspaceRepository(initial))
  const counter = useRef(0)

  const refresh = async () => {
    const next = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    setWorkspace(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const onCommand = async (command: Record<string, unknown>) => {
    counter.current += 1
    await executeCommand(repository, {
      actor: { type: "human", id: "USER-DEMO" },
      workspaceId: "WORKSPACE-DEMO",
      expectedVersion: (await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).version,
      idempotencyKey: `UI-${Date.now()}-${counter.current}`,
      command
    })
    await refresh()
  }

  const undo = async (receiptId: string) => {
    await onCommand({ type: "undo_action", receiptId })
  }

  const reset = () => {
    localStorage.removeItem(storageKey)
    const fixture = buildFixture()
    setRepository(new MemoryWorkspaceRepository(fixture))
    setWorkspace(fixture.workspace)
  }

  useEffect(() => {
    const markedDocument = document as Document & { __courseContextWebMcpRegistered?: boolean, modelContext?: { registerTool: (tool: unknown) => { unregister?: () => void } | void } }
    if (markedDocument.__courseContextWebMcpRegistered) return
    markedDocument.__courseContextWebMcpRegistered = true
    const tools = createCourseContextTools({
      repository,
      session: { userId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", actor: { type: "agent", id: "AGENT-WEBMCP" } },
      now: () => new Date()
    })
    registerWebMcpTools(markedDocument, tools)
  }, [repository])

  return <WorkspaceContext.Provider value={{ workspace, catalog: initial.catalog, onCommand, undo, reset }}>{children}</WorkspaceContext.Provider>
}

export const useWorkspace = () => {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return value
}

export const useOptionalWorkspace = () => useContext(WorkspaceContext)
