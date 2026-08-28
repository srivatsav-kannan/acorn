"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ActivityEntry } from "@/domain/types"
import { mergedOpportunities } from "@/domain/reference"
import { searchWorkspace } from "@/domain/search"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { parseTermId, termLabel } from "@/domain/timeline"
import { useOptionalWorkspace } from "@/components/workspace-provider"
import { ExploreFill, HomeFill, LibraryFill, PlanFill, ProfileFill, ProgramsFill, SearchIcon, TogetherFill } from "@/components/icons"

const navigation = [
  ["Home", "/app", "home"],
  ["Plan", "/app/plan", "plan"],
  ["Stanford", "/app/explore", "explore"],
  ["Library", "/app/library", "library"],
  ["Programs", "/app/programs", "programs"],
  ["Profile", "/app/profile", "profile"],
  ["Plan together", "/app/agent", "agent"]
] as const

const mobileGlyph = (key: string) => {
  if (key === "home") return <HomeFill />
  if (key === "plan") return <PlanFill />
  if (key === "explore") return <ExploreFill />
  if (key === "library") return <LibraryFill />
  if (key === "programs") return <ProgramsFill />
  if (key === "profile") return <ProfileFill />
  return <TogetherFill />
}

const pageForPath = (pathname: string | null) => {
  if (!pathname) return "home"
  if (pathname.startsWith("/app/plan")) return "plan"
  if (pathname.startsWith("/app/explore")) return "explore"
  if (pathname.startsWith("/app/library")) return "library"
  if (pathname.startsWith("/app/programs")) return "programs"
  if (pathname.startsWith("/app/agent")) return "agent"
  if (pathname.startsWith("/app/profile")) return "profile"
  if (pathname.startsWith("/app/settings")) return "settings"
  if (pathname.startsWith("/app/activity")) return "activity"
  return "home"
}

export const AppShell = ({ activePage, quarter = "", children, activity, onUndo }: { activePage?: string, quarter?: string, children: ReactNode, activity?: ActivityEntry[], onUndo?: (receiptId: string) => void }) => {
  const [activityOpen, setActivityOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [mobile, setMobile] = useState(false)
  const pathname = usePathname()
  const workspaceValue = useOptionalWorkspace()
  const activeKey = activePage ?? pageForPath(pathname)
  const activityEntries = activity ?? workspaceValue?.workspace.activity ?? []
  const handleUndo = onUndo ?? workspaceValue?.undo
  const exploreLabel = workspaceValue ? institutionForWorkspace(workspaceValue.workspace).shortName : "Stanford"
  const quarterLabel = workspaceValue ? (parseTermId(workspaceValue.workspace.currentTermId) ? termLabel(workspaceValue.workspace.currentTermId) : "Current term") : quarter
  const initials = workspaceValue?.workspace.profile.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || workspaceValue?.userEmail?.[0]?.toUpperCase() || "AC"
  const searchResults = workspaceValue && searchQuery.trim() ? searchWorkspace(workspaceValue.workspace, workspaceValue.catalog, searchQuery, mergedOpportunities(institutionForWorkspace(workspaceValue.workspace).buildOpportunities(), workspaceValue.workspace.referenceOverlay?.opportunities)) : null
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia("(max-width: 900px)")
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === "Escape") setSearchOpen(false)
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])
  const resultHref = (type: string) => type === "courses" || type === "opportunities" ? "/app/explore" : type === "programs" ? "/app/programs" : "/app/library"
  return <div className="app-frame">
    <a className="skip-link" href="#workspace-content">Skip to workspace</a>
    <header className="topbar">
      <Link className="wordmark" href="/app" aria-label="CourseContext workspace">CourseContext<i aria-hidden="true">.</i></Link>
      <span className="term-tag">{quarterLabel}</span>
      <div className="topbar-actions">
        {workspaceValue && <span className={`save-indicator ${workspaceValue.saveState}`} aria-live="polite"><i />{workspaceValue.saveState === "saving" ? "Saving" : workspaceValue.saveState === "error" ? "Not saved" : workspaceValue.mode === "fixture" ? "Saved in this browser" : "Saved"}</span>}
        <button className="quiet-button search-button" type="button" aria-label="Search workspace" onClick={() => setSearchOpen(true)}><SearchIcon width={14} height={14} /><span>Search</span><kbd>⌘K</kbd></button>
        <button className="topbar-text-button" type="button" onClick={() => setActivityOpen(true)} aria-label="Activity">Activity</button>
        <Link className="avatar-button" href="/app/profile" aria-label="Account">{initials}</Link>
      </div>
    </header>
    <aside className="sidebar">
      <nav aria-label="Primary">
        {navigation.map(([name, href, key]) => <Link key={key} className={activeKey === key ? "nav-link active" : "nav-link"} href={href}>{key === "explore" ? exploreLabel : name}</Link>)}
      </nav>
      <Link className="settings-link" href="/app/settings">Settings</Link>
    </aside>
    <main id="workspace-content" className="workspace-main">{children}</main>
    {mobile && <nav className="mobile-nav" aria-label="Mobile">
      {navigation.map(([name, href, key]) => <Link key={key} className={activeKey === key ? "active" : ""} href={href} aria-label={key === "explore" ? exploreLabel : name}><span aria-hidden="true">{mobileGlyph(key)}</span><span aria-hidden="true">{key === "explore" ? exploreLabel : name === "Plan together" ? "Together" : name}</span></Link>)}
    </nav>}
    {activityOpen && <div className="drawer-backdrop" role="presentation" onMouseDown={() => setActivityOpen(false)}>
      <aside className="activity-drawer" aria-label="Activity panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading"><div><h2>Activity</h2></div><button className="icon-button" onClick={() => setActivityOpen(false)} aria-label="Close activity">×</button></div>
        {activityEntries.length === 0 ? <div className="empty-drawer"><strong>No changes yet</strong><p>Every edit shows up here with who made it and an undo.</p></div> : <ol className="activity-list">
          {[...activityEntries].reverse().map((entry) => <li key={entry.id}><span className={`actor-dot ${entry.actor.type}`} /><div><strong>{entry.summary}</strong><p>{entry.actor.type === "agent" ? "Agent" : "You"} · just now</p><span>{entry.changed.length} workspace item{entry.changed.length === 1 ? "" : "s"} changed</span></div>{entry.undoAvailable && !entry.undoneAt && handleUndo && <button className="text-button" onClick={() => handleUndo(entry.receiptId)}>Undo</button>}</li>)}
        </ol>}
      </aside>
    </div>}
    {searchOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
      <section className="workspace-search-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-search-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="workspace-search-field"><SearchIcon width={17} height={17} /><input autoFocus aria-label="Search courses, notes, people, and programs" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search courses, notes, people, and programs"/><button className="icon-button" type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div>
        <h2 id="workspace-search-title" className="sr-only">Workspace search</h2>
        {!searchQuery.trim() && <div className="search-empty"><strong>Search everything</strong><p>Courses, notes, people, programs, clubs, and sources.</p></div>}
        {searchResults?.groups.map((group) => <section className="search-result-group" key={group.type}><h3>{group.type}</h3>{group.items.map((item) => <Link href={resultHref(group.type)} key={item.id} onClick={() => setSearchOpen(false)}><strong>{item.title}</strong><span>{item.summary}</span></Link>)}</section>)}
        {searchResults && !searchResults.sufficient && <div className="search-gap" role="status"><strong>No durable match yet</strong><p>{searchResults.gaps[0]}</p><a href="/app/library">Add this as an open question</a></div>}
      </section>
    </div>}
  </div>
}
