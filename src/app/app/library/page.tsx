"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { LibraryPage } from "@/features/library/library-page"

export default function Page() { const value = useWorkspace(); return <AppShell activePage="library" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><LibraryPage workspace={value.workspace} onCommand={value.onCommand} /></AppShell> }
