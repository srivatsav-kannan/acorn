"use client"

import { useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { degreeOptions } from "@/domain/timeline"
import type { ContextItem } from "@/domain/types"

// The context layer. Anything that has no structured home lands here first:
// stray thoughts, overheard opportunities, language background, half-plans.
// Agents read it, act on it, and file into it, so a note jotted today can
// become a planned course or a tracked club tomorrow.

const typeLabel: Record<string, string> = { note: "Note", idea: "Idea", question: "Question", task: "Task", link: "Link", source: "Research", claim: "Claim", decision: "Decision", person: "Person", organization: "Organization", club: "Club", commitment: "Commitment", preference: "Preference", goal: "Goal", constraint: "Constraint", uncertainty: "Open question", document: "Document", scratch_document: "Scratch doc" }

export const ScratchpadPage = () => {
  const value = useWorkspace()
  const profile = value.workspace.profile
  const timeline = profile.timeline
  const [jot, setJot] = useState("")
  const [jotTags, setJotTags] = useState("")
  const [goalDraft, setGoalDraft] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState("")
  const [query, setQuery] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editTags, setEditTags] = useState("")

  const items = useMemo(() => value.workspace.contextItems.filter((item) => !item.archived && item.type !== "goal").sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")), [value.workspace.contextItems])
  const allTags = useMemo(() => [...new Set(items.flatMap((item) => item.tags ?? []))].sort(), [items])
  const visible = items.filter((item) => {
    if (tagFilter && !(item.tags ?? []).includes(tagFilter)) return false
    if (query.trim() && !`${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const parseTags = (raw: string) => raw.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8)

  const addJot = async () => {
    const lines = jot.trim().split("\n")
    const title = lines[0].slice(0, 80)
    if (!title) return
    await value.onCommand({ type: "create_context_item", item: { id: `NOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "note", title, summary: lines.slice(1).join("\n").trim().slice(0, 600), content: {}, collectionId: "COLLECTION-INBOX", tags: parseTags(jotTags) } })
    setJot("")
    setJotTags("")
  }

  const startEdit = (item: ContextItem) => {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditSummary(item.summary)
    setEditTags((item.tags ?? []).join(", "))
  }

  const saveEdit = async () => {
    await value.onCommand({ type: "update_context_item", itemId: editingId, title: editTitle, summary: editSummary, tags: parseTags(editTags) })
    setEditingId("")
  }

  const saveGoal = async () => {
    if (goalDraft === null) return
    await value.onCommand({ type: "set_goals", goal: goalDraft })
    setGoalDraft(null)
  }

  return <div className="page scratchpad-page">
    <header className="page-heading"><div><h1>Scratchpad</h1><p>Everything you and your agent should remember, before it has a proper home.</p></div></header>

    <div className="scratch-top-row">
    <section className="goals-card">
      <div className="goals-degree">
        <span className="field-label">Working toward</span>
        <select className="chunky-select" aria-label="Degree objective" value={timeline?.degree ?? "BS"} onChange={(event) => void value.onCommand({ type: "set_goals", degree: event.target.value })}>
          {degreeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          {timeline && !degreeOptions.some((option) => option.id === timeline.degree) && <option value={timeline.degree}>{timeline.degree}</option>}
        </select>
      </div>
      <div className="goals-note">
        <span className="field-label">The goal, in your own words</span>
        {goalDraft === null ? <button className="goals-note-view" type="button" onClick={() => setGoalDraft(profile.summary)}>{profile.summary || "What are you actually trying to get out of these four years? Click to write it down."}</button> : <div className="goals-note-edit">
          <textarea aria-label="Goal note" rows={3} value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} maxLength={1200} autoFocus />
          <div className="form-row-actions"><button className="secondary-button small" type="button" onClick={() => setGoalDraft(null)}>Cancel</button><button className="primary-button small" type="button" onClick={() => void saveGoal()}>Save goal</button></div>
        </div>}
      </div>
    </section>

    <section className="jot-card">
      <textarea aria-label="Jot something down" rows={3} placeholder="Jot something down. First line becomes the title." value={jot} onChange={(event) => setJot(event.target.value)} />
      <div className="jot-row">
        <input aria-label="Tags" placeholder="tags, comma separated" value={jotTags} onChange={(event) => setJotTags(event.target.value)} />
        <button className="primary-button" type="button" onClick={() => void addJot()} disabled={!jot.trim()}>Add to scratchpad</button>
      </div>
    </section>
    </div>

    <div className="scratch-filter">
      <input aria-label="Search the scratchpad" placeholder="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
      {allTags.length > 0 && <div className="tag-chips" role="group" aria-label="Filter by tag">
        <button className={tagFilter === "" ? "tag-chip active" : "tag-chip"} type="button" onClick={() => setTagFilter("")}>All</button>
        {allTags.map((tag) => <button key={tag} className={tagFilter === tag ? "tag-chip active" : "tag-chip"} type="button" onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}>{tag}</button>)}
      </div>}
    </div>

    {visible.length === 0 ? <div className="empty-card"><strong>Nothing here yet</strong><p>Jot the first thing above, or let your agent file what it learns with ingest_context.</p></div> : <div className="scratch-grid">
      {visible.map((item) => <article className="scratch-card" key={item.id}>
        {editingId === item.id ? <div className="scratch-edit">
          <input aria-label="Note title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} />
          <textarea aria-label="Note details" rows={3} value={editSummary} onChange={(event) => setEditSummary(event.target.value)} maxLength={600} />
          <input aria-label="Note tags" value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder="tags, comma separated" />
          <div className="form-row-actions"><button className="secondary-button small" type="button" onClick={() => setEditingId("")}>Cancel</button><button className="primary-button small" type="button" onClick={() => void saveEdit()}>Save</button></div>
        </div> : <>
          <div className="scratch-card-top">
            <span className="type-chip">{typeLabel[item.type] ?? item.type}</span>
            {item.addedBy?.type === "agent" && <span className="agent-chip">Agent</span>}
          </div>
          <h3>{item.title}</h3>
          {item.summary && <p>{item.summary}</p>}
          {(item.tags ?? []).length > 0 && <div className="scratch-tags">{(item.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>}
          <div className="scratch-card-actions">
            <button className="text-button" type="button" onClick={() => startEdit(item)}>Edit</button>
            <button className="text-button" type="button" onClick={() => void value.onCommand({ type: "archive_context_item", itemId: item.id })}>Archive</button>
          </div>
        </>}
      </article>)}
    </div>}
  </div>
}
