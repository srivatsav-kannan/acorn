"use client"

import { useState } from "react"
import type { WorkspaceState } from "@/domain/types"

const captureTypes = ["note", "task", "link", "person", "club", "idea", "question", "decision", "commitment", "scratch document"]

export const LibraryPage = ({ workspace, onCommand }: { workspace: WorkspaceState, onCommand: (command: Record<string, unknown>) => void }) => {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("note")
  const [title, setTitle] = useState("")
  const [query, setQuery] = useState("")
  const items = workspace.contextItems.filter((item) => !item.archived && `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()))
  const save = () => {
    const normalized = type === "scratch document" ? "scratch_document" : type
    onCommand({ type: "create_context_item", item: { id: `ITEM-${Date.now()}`, type: normalized, title, summary: `Captured as a ${type} in your shared workspace.`, content: { text: "Captured from the workspace." }, collectionId: type === "club" ? "COLLECTION-CLUBS" : "COLLECTION-INBOX" } })
    setTitle("")
    setOpen(false)
  }
  return <div className="page library-page">
    <header className="page-heading"><div><p className="eyebrow">Persistent context</p><h1>Library</h1><p>The ideas, people, links, decisions, and research that should not disappear into a chat.</p></div><button className="primary-button" type="button" onClick={() => setOpen(true)}>+ Add to workspace</button></header>
    <div className="library-layout"><aside className="collection-sidebar"><label className="library-search"><span aria-hidden="true">⌕</span><input aria-label="Search Library" placeholder="Search Library" value={query} onChange={(event) => setQuery(event.target.value)} /></label><nav aria-label="Library collections">{workspace.collections.map((collection, index) => <button className={index === 0 ? "collection-link active" : "collection-link"} key={collection.id}><span>{collection.name}</span><em>{workspace.contextItems.filter((item) => item.collectionId === collection.id).length}</em></button>)}</nav><div className="library-hint"><span>⌘</span><p><b>Shared context</b><small>Anything stored here is available to you and your agent.</small></p></div></aside>
      <section className="library-content"><div className="section-heading"><div><h2>Recent context</h2><span className="count-badge">{items.length}</span></div><select aria-label="Sort Library"><option>Recently updated</option><option>Title</option></select></div><div className="context-grid">{items.map((item) => <article className="context-card" key={item.id}><div className="context-card-top"><span className={`type-icon ${item.type}`}>{item.type === "person" ? "P" : item.type === "idea" ? "✦" : "N"}</span><span className="context-type">{item.type.replaceAll("_", " ")}</span><button className="more-button" aria-label={`More options for ${item.title}`}>···</button></div><h3>{item.title}</h3><p>{item.summary}</p><div className="context-meta"><span>{item.addedBy?.type === "agent" ? "Added by agent" : "Added by you"}</span>{item.sourceEvidenceIds?.length ? <b>1 source</b> : null}</div></article>)}</div></section>
    </div>
    {open && <div className="modal-backdrop" role="presentation"><form className="capture-modal" onSubmit={(event) => { event.preventDefault(); save() }}><div className="drawer-heading"><div><p className="eyebrow">Quick capture</p><h2>Add to workspace</h2></div><button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><label>Type<select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}>{captureTypes.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label>Title<input aria-label="Title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Details<textarea aria-label="Details" rows={4} placeholder="What should you and the agent remember?" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="primary-button">Save</button></div></form></div>}
  </div>
}
