"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { AgentConnectionPage } from "@/features/agent/agent-connection-page"

export default function Page() {
  const value = useWorkspace()
  return <AppShell activePage="agent" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><AgentConnectionPage workspace={value.workspace} /></AppShell>
}
