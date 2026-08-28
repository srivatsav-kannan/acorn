"use client"

import { useWorkspace } from "@/components/workspace-provider"
import { AgentConnectionPage } from "@/features/agent/agent-connection-page"

export default function Page() {
  const value = useWorkspace()
  return <AgentConnectionPage workspace={value.workspace} />
}
