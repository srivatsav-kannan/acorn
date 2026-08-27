const states = {
  loading: ["Loading workspace", "Bringing your planning context together."],
  empty: ["Nothing here yet", "Add something yourself or ask the agent to help."],
  partial: ["Some information is missing", "The available context is shown and gaps are labeled."],
  stale: ["Information needs review", "Refresh the source before making a consequential decision."],
  permission: ["You do not have access", "Switch workspaces or ask the owner for access."],
  error: ["Something went wrong", "Your existing workspace has not been changed."],
  rollback: ["Your change was not saved", "The complete operation was rolled back safely."],
  success: ["Saved", "The workspace, context, and activity record are up to date."]
} as const

export const StatusState = ({ kind }: { kind: keyof typeof states }) => <section className={`status-state status-${kind}`} role={kind === "error" || kind === "rollback" ? "alert" : "status"}>
  <span className="status-mark" aria-hidden="true" />
  <div><strong>{states[kind][0]}</strong><p>{states[kind][1]}</p></div>
</section>
