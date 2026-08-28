/* eslint-disable @typescript-eslint/no-explicit-any */
import { validateContextItem } from "@/domain/context"
import { upsertResearchLibraryItem, validateEvidence } from "@/domain/evidence"
import { emptyOverlay, validateOverlayCourse, validateOverlaySection } from "@/domain/reference"
import { validateSavedView } from "@/domain/views"
import type { ActionReceipt, Actor, ChangedEntity, ContextItem, Preference, WorkspaceState } from "@/domain/types"
import { MemoryWorkspaceRepository, RepositoryError } from "@/store/memory-repository"

type Envelope = {
  actor: Actor
  ownerUserId?: string
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
    if (operation.type === "set_unit_limit") {
      const target = plan.scenarios.find((item) => item.id === command.scenarioId)
      const limit = Number(operation.unitLimit)
      if (!target || !Number.isInteger(limit) || limit < 1 || limit > 30) throw commandError("Scenario and unit limit are required")
      target.unitLimit = limit
      changed.push({ type: "plan_scenario", id: target.id })
      continue
    }
    if (operation.type === "rename_scenario") {
      const target = plan.scenarios.find((item) => item.id === command.scenarioId)
      if (!target || !String(operation.name ?? "").trim()) throw commandError("Scenario and name are required")
      target.name = String(operation.name).trim().slice(0, 60)
      changed.push({ type: "plan_scenario", id: target.id })
      continue
    }
    if (operation.type === "set_active_scenario") {
      const target = plan.scenarios.find((item) => item.id === command.scenarioId)
      if (!target) throw commandError("Scenario not found")
      plan.activeScenarioId = target.id
      changed.push({ type: "plan", id: plan.id })
      continue
    }
    if (operation.type === "delete_scenario") {
      if (plan.scenarios.length <= 1) throw commandError("A plan must keep at least one scenario")
      const index = plan.scenarios.findIndex((item) => item.id === command.scenarioId)
      if (index < 0) throw commandError("Scenario not found")
      const [removed] = plan.scenarios.splice(index, 1)
      if (plan.activeScenarioId === removed.id) plan.activeScenarioId = plan.scenarios[0].id
      changed.push({ type: "plan_scenario", id: removed.id })
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
    } else if (operation.type === "set_units") {
      const item = scenario.courses.find((candidate) => candidate.id === operation.planCourseId)
      const units = Number(operation.units)
      if (!item || !Number.isInteger(units) || units < 1 || units > 20) throw commandError("Plan course or units are invalid")
      item.units = units
      changed.push({ type: "plan_course", id: item.id })
    } else if (operation.type === "add_commitment") {
      const commitment = operation.commitment
      if (!commitment?.id || !String(commitment.title ?? "").trim() || !Array.isArray(commitment.meetings) || commitment.meetings.length === 0 || scenario.commitments.some((item) => item.id === commitment.id)) throw commandError("A valid unique commitment is required")
      scenario.commitments.push(structuredClone(commitment))
      changed.push({ type: "commitment", id: commitment.id })
    } else if (operation.type === "remove_commitment") {
      const index = scenario.commitments.findIndex((item) => item.id === operation.commitmentId)
      if (index < 0) throw commandError("Commitment not found")
      const [removed] = scenario.commitments.splice(index, 1)
      changed.push({ type: "commitment", id: removed.id })
    } else throw commandError("Unsupported plan operation")
  }
}

export const executeCommand = async (repository: MemoryWorkspaceRepository, envelope: Envelope): Promise<ActionReceipt> => {
  const accessUserId = envelope.ownerUserId ?? envelope.actor.id
  const existingWorkspace = await repository.getWorkspace(envelope.workspaceId, accessUserId)
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

  const ownerId = accessUserId
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
    } else if (command.type === "update_context_item") {
      const item = workspace.contextItems.find((candidate) => candidate.id === command.itemId)
      if (!item) throw commandError("Context item not found")
      if (typeof command.title === "string" && command.title.trim()) item.title = command.title.trim()
      if (typeof command.summary === "string" && command.summary.trim()) item.summary = command.summary.trim()
      if (command.content && typeof command.content === "object") item.content = structuredClone(command.content)
      if (typeof command.collectionId === "string" && workspace.collections.some((collection) => collection.id === command.collectionId)) item.collectionId = command.collectionId
      item.updatedAt = new Date().toISOString()
      changed.push({ type: "context_item", id: item.id })
    } else if (command.type === "archive_context_item") {
      const item = workspace.contextItems.find((candidate) => candidate.id === command.itemId)
      if (!item) throw commandError("Context item not found")
      item.archived = true
      changed.push({ type: "context_item", id: item.id })
    } else if (command.type === "restore_context_item") {
      const item = workspace.contextItems.find((candidate) => candidate.id === command.itemId)
      if (!item) throw commandError("Context item not found")
      item.archived = false
      changed.push({ type: "context_item", id: item.id })
    } else if (command.type === "set_student_preference") {
      const preference = command.preference as Preference
      if (!preference?.id || !preference.label) throw commandError("Preference requires an ID and label")
      const index = workspace.profile.preferences.findIndex((item) => item.id === preference.id)
      if (index >= 0) workspace.profile.preferences[index] = structuredClone(preference)
      else workspace.profile.preferences.push(structuredClone(preference))
      changed.push({ type: "preference", id: preference.id })
    } else if (command.type === "set_student_preferences") {
      const preferences = command.preferences as Preference[]
      if (!Array.isArray(preferences) || preferences.length === 0 || preferences.some((preference) => !preference?.id || !preference.label)) throw commandError("At least one complete preference is required")
      for (const preference of preferences) {
        const index = workspace.profile.preferences.findIndex((item) => item.id === preference.id)
        if (index >= 0) workspace.profile.preferences[index] = structuredClone(preference)
        else workspace.profile.preferences.push(structuredClone(preference))
        changed.push({ type: "preference", id: preference.id })
      }
    } else if (command.type === "delete_student_preference") {
      const index = workspace.profile.preferences.findIndex((item) => item.id === command.preferenceId)
      if (index < 0) throw commandError("Preference not found")
      const [removed] = workspace.profile.preferences.splice(index, 1)
      changed.push({ type: "preference", id: removed.id })
    } else if (command.type === "update_profile") {
      if (envelope.actor.type !== "human") throw commandError("Profile identity changes require the student")
      const patch = command.patch as Record<string, unknown>
      if (typeof patch.name === "string" && patch.name.trim()) workspace.profile.name = patch.name.trim().slice(0, 80)
      if (typeof patch.summary === "string") {
        workspace.profile.summary = patch.summary.trim().slice(0, 1200)
        const goal = workspace.contextItems.find((item) => item.type === "goal" && !item.archived)
        if (goal) {
          goal.summary = workspace.profile.summary
          goal.content = { ...goal.content, text: workspace.profile.summary }
          goal.updatedAt = new Date().toISOString()
          changed.push({ type: "context_item", id: goal.id })
        }
      }
      if (typeof patch.earliestStart === "string" && /^\d{2}:\d{2}$/.test(patch.earliestStart)) workspace.profile.earliestStart = patch.earliestStart
      if (typeof patch.latestEnd === "string" && /^\d{2}:\d{2}$/.test(patch.latestEnd)) workspace.profile.latestEnd = patch.latestEnd
      if (Array.isArray(patch.excludedDays)) workspace.profile.excludedDays = patch.excludedDays.filter((day): day is WorkspaceState["profile"]["excludedDays"][number] => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(String(day)))
      if (patch.declaredProgramId === null || (typeof patch.declaredProgramId === "string" && workspace.programs.some((program) => program.id === patch.declaredProgramId))) workspace.profile.declaredProgramId = patch.declaredProgramId as string | null
      changed.push({ type: "student_profile", id: workspace.profile.id })
    } else if (command.type === "set_completed_courses") {
      if (envelope.actor.type !== "human") throw commandError("Completed courses require student confirmation")
      const courseIds = command.courseIds as string[]
      if (!Array.isArray(courseIds) || courseIds.some((id) => typeof id !== "string")) throw commandError("Completed courses must be a list")
      workspace.profile.completedCourseIds = [...new Set(courseIds)]
      workspace.profile.residentCourseIds = workspace.profile.residentCourseIds.filter((id) => workspace.profile.completedCourseIds.includes(id))
      workspace.profile.courseGrades = Object.fromEntries(Object.entries(workspace.profile.courseGrades).filter(([id]) => workspace.profile.completedCourseIds.includes(id)))
      changed.push({ type: "student_profile", id: workspace.profile.id })
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
      const libraryItem = upsertResearchLibraryItem(workspace, evidence, envelope.actor)
      changed.push({ type: "context_item", id: libraryItem.id })
    } else if (command.type === "extend_reference") {
      let evidence, course
      try {
        evidence = validateEvidence(command.evidence)
        course = validateOverlayCourse(command.course ?? {})
      } catch (error) { throw commandError((error as Error).message) }
      if (!evidence.id) throw commandError("Reference evidence needs a stable ID")
      const overlay = workspace.referenceOverlay ?? emptyOverlay()
      workspace.referenceOverlay = overlay
      const courseIndex = overlay.courses.findIndex((item) => item.id === course.id)
      if (courseIndex >= 0) overlay.courses[courseIndex] = course
      else overlay.courses.push(course)
      changed.push({ type: "reference_course", id: course.id })
      if (command.section) {
        let sectionRecord
        try { sectionRecord = validateOverlaySection(command.section, course.id, workspace.currentTermId, evidence.id) }
        catch (error) { throw commandError((error as Error).message) }
        const sectionIndex = overlay.sections.findIndex((item) => item.id === sectionRecord.id)
        if (sectionIndex >= 0) overlay.sections[sectionIndex] = sectionRecord
        else overlay.sections.push(sectionRecord)
        changed.push({ type: "reference_section", id: sectionRecord.id })
      }
      const evidenceIndex = workspace.evidence.findIndex((item) => item.id === evidence.id)
      if (evidenceIndex >= 0) workspace.evidence[evidenceIndex] = evidence
      else workspace.evidence.push(evidence)
      changed.push({ type: "evidence", id: evidence.id })
      const libraryItem = upsertResearchLibraryItem(workspace, evidence, envelope.actor)
      changed.push({ type: "context_item", id: libraryItem.id })
    } else if (command.type === "remove_reference_course") {
      const overlay = workspace.referenceOverlay ?? emptyOverlay()
      const index = overlay.courses.findIndex((item) => item.id === command.courseId)
      if (index < 0) throw commandError("Reference course not found in this workspace")
      const [removed] = overlay.courses.splice(index, 1)
      overlay.sections = overlay.sections.filter((item) => item.courseId !== removed.id)
      workspace.referenceOverlay = overlay
      changed.push({ type: "reference_course", id: removed.id })
    } else if (command.type === "configure_view") {
      let view
      try { view = validateSavedView(command.view, workspace.id) }
      catch (error) { throw commandError((error as Error).message) }
      const viewIndex = workspace.savedViews.findIndex((item) => item.id === view.id)
      if (viewIndex >= 0) workspace.savedViews[viewIndex] = view
      else workspace.savedViews.push(view)
      changed.push({ type: "saved_view", id: view.id })
    } else if (command.type === "delete_saved_view") {
      const index = workspace.savedViews.findIndex((item) => item.id === command.viewId)
      if (index < 0) throw commandError("Saved view not found")
      const [removed] = workspace.savedViews.splice(index, 1)
      changed.push({ type: "saved_view", id: removed.id })
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
      visibleChange: true,
      primaryVisibleId: command.type === "save_research" ? changed.find((item) => item.type === "context_item")?.id : command.type === "extend_reference" ? changed.find((item) => item.type === "reference_course")?.id : undefined
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
