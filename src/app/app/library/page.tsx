"use client"

import { useWorkspace } from "@/components/workspace-provider"
import { LibraryPage } from "@/features/library/library-page"

export default function Page() { const value = useWorkspace(); return <LibraryPage workspace={value.workspace} onCommand={value.onCommand} /> }
