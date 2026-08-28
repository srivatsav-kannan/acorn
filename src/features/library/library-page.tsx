"use client"

import { useMemo, useState } from "react"
import type { ContextItem, WorkspaceState } from "@/domain/types"

const captureTypes = ["note", "task", "link", "person", "club", "idea", "question", "decision", "commitment", "scratch document"]

export const LibraryPage = ({ workspace, onCommand }: { workspace: WorkspaceState, onCommand: (command: Record<string, unknown>) => void }) => {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContextItem | null>(null)
  const [type, setType] = useState("note")
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [collectionId, setCollectionId] = useState("COLLECTION-INBOX")
  const [activeCollection, setActiveCollection] = useState("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const items = useMemo(() => workspace.contextItems
    .filter((item) => activeCollection === "archived" ? item.archived : !item.archived)
    .filter((item) => activeCollection === "all" || activeCollection === "archived" || item.collectionId === activeCollection)
    .filter((item) => `${item.title} ${item.summary} ${JSON.stringify(item.content)}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))), [activeCollection, query, sort, workspace.contextItems])

  const resetForm = () => { setType("note"); setTitle(""); setDetails(""); setCollectionId("COLLECTION-INBOX"); setEditing(null) }
  const startEdit = (item: ContextItem) => {
    setEditing(item)
    setType(item.type === "scratch_document" ? "scratch document" : item.type)
    setTitle(item.title)
    setDetails(String(item.content.text ?? item.summary))
    setCollectionId(item.collectionId)
    setOpen(true)
  }
  const save = () => {
    const normalized = type === "scratch document" ? "scratch_document" : type
    if (editing) onCommand({ type: "update_context_item", itemId: editing.id, title, summary: details || title, content: { ...editing.content, text: details }, collectionId })
    else onCommand({ type: "create_context_item", item: { id: `ITEM-${crypto.randomUUID().toUpperCase()}`, type: normalized, title, summary: details || `Saved ${type}`, content: { text: details }, collectionId } })
    resetForm()
    setOpen(false)
  }
  return <div className="page library-page">
    <header className="page-heading"><div><h1>Library</h1></div><button className="primary-button" type="button" onClick={() => { resetForm(); setOpen(true) }}>+ Add to workspace</button></header>
    <div className="library-layout"><aside className="collection-sidebar"><label className="library-search"><span aria-hidden="true">⌕</span><input aria-label="Search Library" placeholder="Search Library" value={query} onChange={(event) => setQuery(event.target.value)} /></label><nav aria-label="Library collections"><button className={activeCollection === "all" ? "collection-link active" : "collection-link"} onClick={() => setActiveCollection("all")}><span>All context</span><em>{workspace.contextItems.filter((item) => !item.archived).length}</em></button>{workspace.collections.map((collection) => <button className={activeCollection === collection.id ? "collection-link active" : "collection-link"} onClick={() => setActiveCollection(collection.id)} key={collection.id}><span>{collection.name}</span><em>{workspace.contextItems.filter((item) => !item.archived && item.collectionId === collection.id).length}</em></button>)}<button className={activeCollection === "archived" ? "collection-link active" : "collection-link"} onClick={() => setActiveCollection("archived")}><span>Archived</span><em>{workspace.contextItems.filter((item) => item.archived).length}</em></button></nav></aside>
      <section className="library-content"><div className="section-heading"><div><h2>{activeCollection === "all" ? "All context" : activeCollection === "archived" ? "Archived" : workspace.collections.find((collection) => collection.id === activeCollection)?.name}</h2><span className="count-badge">{items.length}</span></div><select aria-label="Sort Library" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently updated</option><option value="title">Title</option></select></div>{items.length === 0 ? <div className="library-empty"><span>⌕</span><h3>No context matches this view</h3><p>Change the collection or search, or add something you want the workspace to remember.</p><button className="secondary-button" onClick={() => { setQuery(""); setActiveCollection("all") }}>Clear filters</button></div> : <div className="context-grid">{items.map((item) => <article className="context-card" key={item.id}><div className="context-card-top"><span className={`type-icon ${item.type}`}>{item.type === "person" ? "P" : item.type === "idea" ? "✦" : item.type === "source" ? "↗" : "N"}</span><span className="context-type">{item.type.replaceAll("_", " ")}</span>{item.archived ? <button className="text-button" onClick={() => onCommand({ type: "restore_context_item", itemId: item.id })} aria-label={`Restore ${item.title}`}>Restore</button> : <button className="more-button" onClick={() => startEdit(item)} aria-label={`Edit ${item.title}`}>Edit</button>}</div><h3>{item.title}</h3><p>{item.summary}</p>{typeof item.content.sourceUrl === "string" && <a className="source-card-link" href={item.content.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}<div className="context-meta"><span>{item.addedBy?.type === "agent" ? "Added by agent" : "Added by you"}</span>{item.sourceEvidenceIds?.length ? <b>{item.sourceEvidenceIds.length} source{item.sourceEvidenceIds.length === 1 ? "" : "s"}</b> : null}</div></article>)}</div>}</section>
    </div>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={() => { setOpen(false); resetForm() }}><form className="capture-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); save() }}><div className="drawer-heading"><div><h2>{editing ? editing.title : "Add to workspace"}</h2></div><button type="button" className="icon-button" onClick={() => { setOpen(false); resetForm() }} aria-label="Close">×</button></div><label>Type<select aria-label="Type" value={type} disabled={Boolean(editing)} onChange={(event) => setType(event.target.value)}>{captureTypes.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label>Collection<select aria-label="Collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>{workspace.collections.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}</select></label><label>Title<input aria-label="Title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Details<textarea aria-label="Details" rows={5} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What should you and the agent remember?" /></label><div className="modal-actions">{editing && <button type="button" className="danger-text-button" onClick={() => { onCommand({ type: "archive_context_item", itemId: editing.id }); setOpen(false); resetForm() }}>Archive</button>}<button type="button" className="secondary-button" onClick={() => { setOpen(false); resetForm() }}>Cancel</button><button type="submit" className="primary-button">{editing ? "Save changes" : "Save"}</button></div></form></div>}
  </div>
}
