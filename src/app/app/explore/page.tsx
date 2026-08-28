"use client"

import { useWorkspace } from "@/components/workspace-provider"
import { ExplorePage } from "@/features/explore/explore-page"

export default function Page() { const value = useWorkspace(); return <ExplorePage workspace={value.workspace} catalog={value.catalog} onCommand={value.onCommand} /> }
