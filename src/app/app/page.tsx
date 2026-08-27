"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { HomePage } from "@/features/home/home-page"

export default function Page() { const value = useWorkspace(); return <AppShell activePage="home" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><HomePage workspace={value.workspace} catalog={value.catalog} /></AppShell> }
