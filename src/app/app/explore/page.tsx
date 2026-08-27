"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { ExplorePage } from "@/features/explore/explore-page"

export default function Page() { const value = useWorkspace(); return <AppShell activePage="explore" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><ExplorePage workspace={value.workspace} catalog={value.catalog} onCommand={value.onCommand} /></AppShell> }
