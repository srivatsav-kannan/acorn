"use client"

import { useMemo, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { goalContentOf } from "@/domain/goals"
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
  const [jotTitle, setJotTitle] = useState("")
  const [jot, setJot] = useState("")
  const [jotTags, setJotTags] = useState("")
  const [milestoneFor, setMilestoneFor] = useState("")
  const [milestoneTitle, setMilestoneTitle] = useState("")
  const [milestoneDue, setMilestoneDue] = useState("")
  const [goalDraft, setGoalDraft] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editTags, setEditTags] = useState("")

  const items = useMemo(() => value.workspace.contextItems.filter((item) => !item.archived).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")), [value.workspace.contextItems])
  const visible = items.filter((item) => {
    if (query.trim() && !`${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const parseTags = (raw: string) => raw.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8)

  const addJot = async () => {
    const title = jotTitle.trim().slice(0, 80)
    if (!title) return
    await value.onCommand({ type: "create_context_item", item: { id: `NOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "note", title, summary: jot.trim().slice(0, 600), content: {}, collectionId: "COLLECTION-INBOX", tags: parseTags(jotTags) } })
    setJotTitle("")
    setJot("")
    setJotTags("")
  }

  const addMilestone = async (item: ContextItem) => {
    if (!milestoneTitle.trim()) return
    const structured = goalContentOf(item)
    const existing = (structured?.milestones ?? []).map((milestone) => ({ id: milestone.id, title: milestone.title, due: milestone.due, done: milestone.done }))
    await value.onCommand({ type: "manage_goal", action: "upsert", goal: {
      id: item.id,
      title: item.title,
      text: structured?.text ?? item.summary ?? undefined,
      status: structured?.status,
      targetDate: structured?.targetDate,
      courseIds: structured?.courseIds,
      opportunityIds: structured?.opportunityIds,
      milestones: [...existing, { title: milestoneTitle.trim(), due: milestoneDue || undefined }]
    } })
    setMilestoneFor("")
    setMilestoneTitle("")
    setMilestoneDue("")
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
      <input aria-label="Title" placeholder="Title" value={jotTitle} onChange={(event) => setJotTitle(event.target.value)} maxLength={80} />
      <textarea aria-label="Jot something down" rows={3} placeholder="Jot something down" value={jot} onChange={(event) => setJot(event.target.value)} />
      <div className="jot-row">
        <input aria-label="Tags" placeholder="tags, comma separated" value={jotTags} onChange={(event) => setJotTags(event.target.value)} />
        <button className="primary-button" type="button" onClick={() => void addJot()} disabled={!jotTitle.trim()}>Add to scratchpad</button>
      </div>
    </section>
    </div>

    <div className="scratch-filter">
      <input aria-label="Search the scratchpad" placeholder="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
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
          {(() => {
            if (item.type !== "goal") return null
            const structured = goalContentOf(item)
            const milestones = structured?.milestones ?? []
            return <div className="goal-structure">
              {milestones.length > 0 && <ul className="goal-milestones">
                {milestones.map((milestone) => <li key={milestone.id}>
                  <label className="goal-milestone">
                    <input type="checkbox" checked={milestone.done} onChange={() => void value.onCommand({ type: "manage_goal", action: "toggle_milestone", goalId: item.id, milestoneId: milestone.id, done: !milestone.done })} />
                    <span className={milestone.done ? "goal-milestone-done" : ""}>{milestone.title}{milestone.due ? ` · ${milestone.due}` : ""}</span>
                  </label>
                </li>)}
              </ul>}
              {milestoneFor === item.id ? <div className="milestone-add">
                <input aria-label={`New milestone for ${item.title}`} placeholder="Milestone" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} maxLength={100} autoFocus />
                <input aria-label="Milestone due date" type="date" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} />
                <div className="form-row-actions"><button className="secondary-button small" type="button" onClick={() => setMilestoneFor("")}>Cancel</button><button className="primary-button small" type="button" disabled={!milestoneTitle.trim()} onClick={() => void addMilestone(item)}>Add</button></div>
              </div> : <button className="text-button" type="button" onClick={() => { setMilestoneFor(item.id); setMilestoneTitle(""); setMilestoneDue("") }}>Add milestone</button>}
              {(structured?.courseIds ?? []).length > 0 && <div className="scratch-tags">{structured!.courseIds.map((id) => <span key={id}>{value.catalog.courses.find((course) => course.id === id)?.code ?? id}</span>)}</div>}
            </div>
          })()}
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
