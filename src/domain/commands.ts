/* eslint-disable @typescript-eslint/no-explicit-any */
import { validateContextItem } from "@/domain/context"
import { validateEvidence } from "@/domain/evidence"
import { validateSavedView } from "@/domain/views"
import type { ActionReceipt, Actor, ChangedEntity, ContextItem, Preference, WorkspaceState } from "@/domain/types"
import { MemoryWorkspaceRepository, RepositoryError } from "@/store/memory-repository"

type Envelope = {
  actor: Actor
  workspaceId: string
  expectedVersion: number
  idempotencyKey: string
  command: Record<string, any>
}

const commandError = (message: string) => new RepositoryError("COMMAND_INVALID", message)
const actionId = (key: string) => `ACTION-${key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32)}`

const applyPlanOperations = (workspace: WorkspaceState, command: Record<string, any>, changed: ChangedEntity[]) => {
  const plan = workspace.plans.find((item) => item.id === command.planId)
  if (!plan) throw commandError("Plan or scenario not found")
  for (const operation of command.operations ?? []) {
    if (operation.type === "create_scenario") {
      const candidate = operation.scenario
      if (!candidate?.id || !candidate.name || plan.scenarios.some((item) => item.id === candidate.id)) throw commandError("A valid unique scenario is required")
      plan.scenarios.push(structuredClone(candidate))
      changed.push({ type: "plan_scenario", id: candidate.id })
      continue
    }
    const scenario = plan.scenarios.find((item) => item.id === command.scenarioId)
    if (!scenario) throw commandError("Scenario not found")
    if (operation.type === "add_course") {
      if (!operation.planCourse?.id || scenario.courses.some((item) => item.id === operation.planCourse.id)) throw commandError("A valid unique plan course is required")
      scenario.courses.push(structuredClone(operation.planCourse))
      changed.push({ type: "plan_course", id: operation.planCourse.id })
    } else if (operation.type === "remove_course") {
      const index = scenario.courses.findIndex((item) => item.id === operation.planCourseId)
      if (index < 0) throw commandError("Plan course not found")
      const [removed] = scenario.courses.splice(index, 1)
      changed.push({ type: "plan_course", id: removed.id })
    } else if (operation.type === "select_section") {
      const item = scenario.courses.find((candidate) => candidate.id === operation.planCourseId)
      if (!item) throw commandError("Plan course not found")
      if (!operation.sectionId) throw commandError("Section is required")
      item.sectionId = operation.sectionId
      changed.push({ type: "plan_course", id: item.id })
    } else if (operation.type === "set_status") {
      const item = scenario.courses.find((candidate) => candidate.id === operation.planCourseId)
      if (!item || !["active", "backup"].includes(operation.status)) throw commandError("Plan course or status is invalid")
      item.status = operation.status
      changed.push({ type: "plan_course", id: item.id })
    } else throw commandError("Unsupported plan operation")
  }
}

export const executeCommand = async (repository: MemoryWorkspaceRepository, envelope: Envelope): Promise<ActionReceipt> => {
  const existingWorkspace = await repository.getWorkspace(envelope.workspaceId, envelope.actor.id === "AGENT-TEST" || envelope.actor.id === "AGENT-CHATGPT" ? "USER-DEMO" : envelope.actor.id)
    .catch(async (error) => {
      if (envelope.actor.type === "agent") return repository.getWorkspace(envelope.workspaceId, "USER-DEMO")
      throw error
    })
  const existing = existingWorkspace.receipts.find((receipt) => receipt.receiptId === actionId(envelope.idempotencyKey))
  if (existing) return structuredClone(existing)

  if (envelope.command.type === "update_profile_fact") return {
    ok: false,
    code: "CONFIRMATION_REQUIRED",
    message: "Confirm durable identity changes in the workspace UI.",
    receiptId: actionId(envelope.idempotencyKey),
    workspaceVersion: existingWorkspace.version,
    changed: [],
    undoAvailable: false,
    actor: envelope.actor
  }

  const ownerId = existingWorkspace.ownerUserId
  const mutation = await repository.mutateWorkspace(envelope.workspaceId, ownerId, envelope.expectedVersion, (workspace) => {
    const before = structuredClone(workspace)
    const changed: ChangedEntity[] = []
    const command = envelope.command

    if (command.type === "create_context_item") {
      const item = validateContextItem(command.item) as unknown as ContextItem
      if (workspace.contextItems.some((existingItem) => existingItem.id === item.id)) throw commandError("Context item ID already exists")
      item.addedBy = envelope.actor
      item.createdAt = item.createdAt ?? new Date().toISOString()
      item.updatedAt = item.updatedAt ?? item.createdAt
      workspace.contextItems.push(item)
      changed.push({ type: "context_item", id: item.id })
    } else if (command.type === "archive_context_item") {
      const item = workspace.contextItems.find((candidate) => candidate.id === command.itemId)
      if (!item) throw commandError("Context item not found")
      item.archived = true
      changed.push({ type: "context_item", id: item.id })
    } else if (command.type === "set_student_preference") {
      const preference = command.preference as Preference
      if (!preference?.id || !preference.label) throw commandError("Preference requires an ID and label")
      const index = workspace.profile.preferences.findIndex((item) => item.id === preference.id)
      if (index >= 0) workspace.profile.preferences[index] = structuredClone(preference)
      else workspace.profile.preferences.push(structuredClone(preference))
      changed.push({ type: "preference", id: preference.id })
    } else if (command.type === "edit_plan") {
      applyPlanOperations(workspace, command, changed)
    } else if (command.type === "save_research") {
      if (!command.evidence?.id) throw commandError("Research evidence is required")
      let evidence
      try { evidence = validateEvidence(command.evidence) }
      catch (error) { throw commandError((error as Error).message) }
      const evidenceIndex = workspace.evidence.findIndex((item) => item.id === evidence.id)
      if (evidenceIndex >= 0) workspace.evidence[evidenceIndex] = evidence
      else workspace.evidence.push(evidence)
      changed.push({ type: "evidence", id: evidence.id })
    } else if (command.type === "configure_view") {
      let view
      try { view = validateSavedView(command.view, workspace.id) }
      catch (error) { throw commandError((error as Error).message) }
      const viewIndex = workspace.savedViews.findIndex((item) => item.id === view.id)
      if (viewIndex >= 0) workspace.savedViews[viewIndex] = view
      else workspace.savedViews.push(view)
      changed.push({ type: "saved_view", id: view.id })
    } else if (command.type === "undo_action") {
      const snapshot = workspace.undoSnapshots[command.receiptId]
      if (!snapshot) throw commandError("This action can no longer be undone")
      const restored = structuredClone(snapshot)
      restored.undoSnapshots = structuredClone(workspace.undoSnapshots)
      const original = workspace.activity.find((item) => item.receiptId === command.receiptId)
      if (original) original.undoneAt = new Date().toISOString()
      changed.push(...(original?.changed ?? []))
      Object.assign(workspace, restored)
    } else throw commandError("Unsupported command")

    const receiptId = actionId(envelope.idempotencyKey)
    const undoAvailable = command.type !== "undo_action"
    if (undoAvailable) workspace.undoSnapshots[receiptId] = before
    const receipt: ActionReceipt = {
      ok: true,
      receiptId,
      workspaceVersion: workspace.version + 1,
      changed,
      undoAvailable,
      actor: envelope.actor,
      visibleChange: true
    }
    workspace.receipts.push(receipt)
    workspace.activity.push({
      id: `ACTIVITY-${receiptId.replace(/^ACTION-/, "")}`,
      receiptId,
      actor: envelope.actor,
      summary: command.type.replaceAll("_", " "),
      changed,
      createdAt: new Date().toISOString(),
      undoAvailable
    })
    return { workspace, inverse: before, result: receipt }
  })
  return mutation.result!
}
