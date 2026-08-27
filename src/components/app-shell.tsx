"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { ActivityEntry } from "@/domain/types"
import { searchWorkspace } from "@/domain/search"
import { useOptionalWorkspace } from "@/components/workspace-provider"

const navigation = [
  ["Home", "/app", "home"], ["Plan", "/app/plan", "plan"], ["Explore", "/app/explore", "explore"],
  ["Library", "/app/library", "library"], ["Programs", "/app/programs", "programs"]
]

export const AppShell = ({ activePage, quarter, children, activity = [], onUndo }: { activePage: string, quarter: string, children: ReactNode, activity?: ActivityEntry[], onUndo?: (receiptId: string) => void }) => {
  const [activityOpen, setActivityOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [mobile, setMobile] = useState(false)
  const workspaceValue = useOptionalWorkspace()
  const searchResults = workspaceValue && searchQuery.trim() ? searchWorkspace(workspaceValue.workspace, workspaceValue.catalog, searchQuery) : null
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
  const resultHref = (type: string) => type === "courses" ? "/app/explore" : type === "programs" ? "/app/programs" : "/app/library"
  return <div className="app-frame">
    <a className="skip-link" href="#workspace-content">Skip to workspace</a>
    <header className="topbar">
      <a className="wordmark" href="/app" aria-label="CourseContext workspace"><span className="wordmark-mark">C</span><span>CourseContext</span></a>
      <div className="term-chip"><span className="live-dot" />{quarter}</div>
      <div className="topbar-actions">
        <button className="quiet-button search-button" type="button" aria-label="Search workspace" onClick={() => setSearchOpen(true)}><span aria-hidden="true">⌕</span><span>Search workspace</span><kbd>⌘K</kbd></button>
        <button className="icon-label-button" type="button" onClick={() => setActivityOpen(true)} aria-label="Activity"><span aria-hidden="true">◷</span><span>Activity</span></button>
        <a className="avatar-button" href="/app/settings" aria-label="Account">AC</a>
      </div>
    </header>
    <aside className="sidebar">
      <nav aria-label="Primary">
        <p className="nav-label">Workspace</p>
        {navigation.map(([name, href, key]) => <a key={key} className={activePage === key ? "nav-link active" : "nav-link"} href={href}><span className="nav-icon" aria-hidden="true">{({ home: "⌂", plan: "▦", explore: "⌕", library: "▤", programs: "◎" } as Record<string, string>)[key]}</span>{name}</a>)}
      </nav>
      <div className="sidebar-context">
        <p className="nav-label">Current focus</p>
        <strong>Autumn planning</strong>
        <span>CS + design</span>
      </div>
      <a className="settings-link" href="/app/settings">Settings</a>
    </aside>
    <main id="workspace-content" className="workspace-main">{children}</main>
    {mobile && <nav className="mobile-nav" aria-label="Mobile">
      {navigation.slice(0, 5).map(([name, href, key]) => <a key={key} className={activePage === key ? "active" : ""} href={href}><span aria-hidden="true">{({ home: "⌂", plan: "▦", explore: "⌕", library: "▤", programs: "◎" } as Record<string, string>)[key]}</span>{name}</a>)}
    </nav>}
    {activityOpen && <div className="drawer-backdrop" role="presentation" onMouseDown={() => setActivityOpen(false)}>
      <aside className="activity-drawer" aria-label="Activity panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading"><div><p className="eyebrow">Shared history</p><h2>Activity</h2></div><button className="icon-button" onClick={() => setActivityOpen(false)} aria-label="Close activity">×</button></div>
        {activity.length === 0 ? <div className="empty-drawer"><strong>No changes yet</strong><p>Human and agent actions will appear here with attribution and undo.</p></div> : <ol className="activity-list">
          {[...activity].reverse().map((entry) => <li key={entry.id}><span className={`actor-dot ${entry.actor.type}`} /><div><strong>{entry.summary}</strong><p>{entry.actor.type === "agent" ? "Agent" : "You"} · just now</p><span>{entry.changed.length} workspace item{entry.changed.length === 1 ? "" : "s"} changed</span></div>{entry.undoAvailable && !entry.undoneAt && onUndo && <button className="text-button" onClick={() => onUndo(entry.receiptId)}>Undo</button>}</li>)}
        </ol>}
      </aside>
    </div>}
    {searchOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
      <section className="workspace-search-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-search-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="workspace-search-field"><span aria-hidden="true">⌕</span><input autoFocus aria-label="Search courses, notes, people, and programs" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search courses, notes, people, and programs"/><button className="icon-button" type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div>
        <h2 id="workspace-search-title" className="sr-only">Workspace search</h2>
        {!searchQuery.trim() && <div className="search-empty"><strong>Search the durable workspace</strong><p>Find courses, saved context, people, and program requirements without leaving your current task.</p></div>}
        {searchResults?.groups.map((group) => <section className="search-result-group" key={group.type}><h3>{group.type}</h3>{group.items.map((item) => <a href={resultHref(group.type)} key={item.id} onClick={() => setSearchOpen(false)}><strong>{item.title}</strong><span>{item.summary}</span></a>)}</section>)}
        {searchResults && !searchResults.sufficient && <div className="search-gap" role="status"><strong>No durable match yet</strong><p>{searchResults.gaps[0]}</p><a href="/app/library">Add this as an open question</a></div>}
      </section>
    </div>}
  </div>
}
