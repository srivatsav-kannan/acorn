"use client"

import { useWorkspace } from "@/components/workspace-provider"
import { ProgramsPage } from "@/features/programs/programs-page"

export default function Page() { const value = useWorkspace(); return <ProgramsPage workspace={value.workspace} catalog={value.catalog} onCommand={value.onCommand} /> }
