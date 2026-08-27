"use client"

import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"

export default function Page() {
  const value = useWorkspace()
  const entries = [...value.workspace.activity].reverse()
  return <AppShell activePage="activity" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><div className="page activity-page">
    <header className="page-heading"><div><p className="eyebrow">Auditable changes</p><h1>Activity</h1><p>Every human and agent mutation appears here with a receipt.</p></div></header>
    {entries.length === 0 ? <section className="activity-empty"><strong>No workspace changes yet</strong><p>Add a course, capture a note, or let the agent make a proposed change. The receipt will appear here.</p></section> : <ol className="activity-ledger">{entries.map((entry) => <li key={entry.id}><span className={`actor-badge ${entry.actor.type}`}>{entry.actor.type === "agent" ? "Agent" : entry.actor.type === "human" ? "You" : "System"}</span><div><h2>{entry.summary.replaceAll("_", " ")}</h2><p>{entry.changed.map((item) => `${item.type}: ${item.id}`).join(" · ")}</p><small>Receipt {entry.receiptId} · workspace version recorded</small></div><span className={entry.undoneAt ? "status-pill" : "status-pill completed"}>{entry.undoneAt ? "Undone" : "Applied"}</span>{entry.undoAvailable && !entry.undoneAt && <button className="text-button" type="button" onClick={() => value.undo(entry.receiptId)}>Undo</button>}</li>)}</ol>}
  </div></AppShell>
}
