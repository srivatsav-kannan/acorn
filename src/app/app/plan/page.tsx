"use client"

import { useWorkspace } from "@/components/workspace-provider"
import { PlanPage } from "@/features/plan/plan-page"

export default function Page() { const value = useWorkspace(); return <PlanPage workspace={value.workspace} catalog={value.catalog} onCommand={value.onCommand} /> }
