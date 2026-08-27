"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { ProgramsPage } from "@/features/programs/programs-page"

export default function Page() { const value = useWorkspace(); return <AppShell activePage="programs" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><ProgramsPage workspace={value.workspace} catalog={value.catalog} onCommand={value.onCommand} /></AppShell> }
