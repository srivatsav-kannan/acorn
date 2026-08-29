import type { ContextItem, WorkspaceState } from "@/domain/types"

// A structured goal is a context item of type "goal" whose content carries
// milestones, links, and a status, so a long-running objective has one
// organizing spine instead of scattering into unrelated records. Milestones
// with due dates materialize as linked todos, and completing either side
// completes the other.

export type GoalMilestone = { id: string, title: string, due?: string, done: boolean, todoId?: string }

export type GoalContent = {
  text?: string
  status: "active" | "achieved" | "dropped"
  targetDate?: string
  milestones: GoalMilestone[]
  courseIds: string[]
  opportunityIds: string[]
}

export const goalContentOf = (item: ContextItem): GoalContent | null => {
  if (item.type !== "goal") return null
  const content = item.content as Partial<GoalContent> | undefined
  if (!content || !Array.isArray(content.milestones)) return null
  return {
    text: typeof content.text === "string" ? content.text : undefined,
    status: content.status === "achieved" || content.status === "dropped" ? content.status : "active",
    targetDate: typeof content.targetDate === "string" ? content.targetDate : undefined,
    milestones: content.milestones as GoalMilestone[],
    courseIds: Array.isArray(content.courseIds) ? content.courseIds as string[] : [],
    opportunityIds: Array.isArray(content.opportunityIds) ? content.opportunityIds as string[] : []
  }
}

export const structuredGoals = (workspace: WorkspaceState): Array<{ item: ContextItem, goal: GoalContent }> =>
  workspace.contextItems
    .filter((item) => !item.archived && item.type === "goal")
    .map((item) => ({ item, goal: goalContentOf(item) }))
    .filter((entry): entry is { item: ContextItem, goal: GoalContent } => entry.goal !== null)

export const nextMilestone = (goal: GoalContent): GoalMilestone | undefined =>
  goal.status === "active" ? goal.milestones.find((milestone) => !milestone.done) : undefined
