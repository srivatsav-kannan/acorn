"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { PlanPage } from "@/features/plan/plan-page"

export default function Page() { const value = useWorkspace(); return <AppShell activePage="plan" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><PlanPage workspace={value.workspace} catalog={value.catalog} onCommand={value.onCommand} /></AppShell> }
