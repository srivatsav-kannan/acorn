"use client"

import { useWorkspace } from "@/components/workspace-provider"
import { HomePage } from "@/features/home/home-page"

export default function Page() { const value = useWorkspace(); return <HomePage workspace={value.workspace} catalog={value.catalog} /> }
