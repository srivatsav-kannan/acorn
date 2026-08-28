/* eslint-disable @typescript-eslint/no-explicit-any */
import { validateContextItem } from "@/domain/context"
import { upsertResearchLibraryItem, validateEvidence } from "@/domain/evidence"
import { applyAcademicHistory, validateAcademicHistoryPatch } from "@/domain/history"
import { emptyOverlay, validateOpportunity, validateOverlayCourse, validateOverlaySection, validateReferenceProgram } from "@/domain/reference"
import { assertSafeExternalUrl } from "@/domain/security"
import { isValidTimezone } from "@/domain/timezone"
import { compareTerms, parseTermId, termLabel } from "@/domain/timeline"
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

const sanitizeTags = (tags: unknown): string[] | undefined => {
  if (!Array.isArray(tags)) return undefined
  const cleaned = tags.map((tag) => String(tag).trim().toLowerCase().slice(0, 24)).filter(Boolean).slice(0, 8)
  return cleaned.length ? [...new Set(cleaned)] : undefined
}

// Which changed-entity type a command's receipt should point the interface at.
const primaryVisibleType: Record<string, string> = {
  save_research: "context_item",
  extend_reference: "reference_course",
  add_reference_program: "reference_program",
  extend_reference_opportunity: "reference_opportunity",
  manage_todo: "todo",
  manage_event: "event",
  upsert_activity: "activity",
  remove_activity: "activity",
  annotate_course: "course_note",
  set_course_interest: "course_interest",
  set_opportunity_interest: "opportunity_interest",
  set_goals: "student_profile",
  ingest_context_items: "context_item"
}

const applyPlanOperations = (workspace: WorkspaceState, command: Record<string, any>, changed: ChangedEntity[]) => {
  let plan = workspace.plans.find((item) => item.id === command.planId)
  if (!plan && typeof command.termId === "string") {
    plan = workspace.plans.find((item) => item.termId === command.termId)
    if (!plan) {
      const ref = parseTermId(command.termId)
      if (!ref) throw commandError("A new term plan needs a term ID like TERM-2027-WINTER")
      plan = {
        id: `PLAN-${ref.year}-${ref.season}`,
        title: termLabel(ref),
        termId: ref.id,
        activeScenarioId: `SCENARIO-${ref.year}-${ref.season}-1`,
        scenarios: [{ id: `SCENARIO-${ref.year}-${ref.season}-1`, name: "First draft", unitLimit: 20, courses: [], commitments: [] }]
      }
      workspace.plans.push(plan)
      workspace.plans.sort((a, b) => compareTerms(a.termId, b.termId))
      changed.push({ type: "plan", id: plan.id })
    }
    command.scenarioId = command.scenarioId ?? plan.activeScenarioId
    command.planId = plan.id
  }
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
      item.tags = sanitizeTags(command.item?.tags)
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
      if (Array.isArray(command.tags)) item.tags = sanitizeTags(command.tags)
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
      if (typeof patch.classYear === "string") workspace.profile.classYear = patch.classYear.trim().slice(0, 30) || undefined
      if (typeof patch.recoveryPhone === "string") workspace.profile.recoveryPhone = patch.recoveryPhone.trim().slice(0, 24) || undefined
      if (typeof patch.earliestStart === "string" && /^\d{2}:\d{2}$/.test(patch.earliestStart)) workspace.profile.earliestStart = patch.earliestStart
      if (typeof patch.latestEnd === "string" && /^\d{2}:\d{2}$/.test(patch.latestEnd)) workspace.profile.latestEnd = patch.latestEnd
      if (Array.isArray(patch.excludedDays)) workspace.profile.excludedDays = patch.excludedDays.filter((day): day is WorkspaceState["profile"]["excludedDays"][number] => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(String(day)))
      if (patch.declaredProgramId === null || (typeof patch.declaredProgramId === "string" && workspace.programs.some((program) => program.id === patch.declaredProgramId))) workspace.profile.declaredProgramId = patch.declaredProgramId as string | null
      changed.push({ type: "student_profile", id: workspace.profile.id })
    } else if (command.type === "update_academic_history") {
      let patch
      try { patch = validateAcademicHistoryPatch(command.patch ?? {}) }
      catch (error) { throw commandError((error as Error).message) }
      applyAcademicHistory(workspace.profile, patch)
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
    } else if (command.type === "add_reference_program") {
      let evidence, program
      try {
        evidence = validateEvidence(command.evidence)
        program = validateReferenceProgram(command.program ?? {}, String((command.evidence as Record<string, unknown>)?.id ?? ""))
      } catch (error) { throw commandError((error as Error).message) }
      if (!evidence.id) throw commandError("Reference evidence needs a stable ID")
      program.addedBy = envelope.actor
      const programIndex = workspace.programs.findIndex((item) => item.id === program.id)
      if (programIndex >= 0) {
        if (!workspace.programs[programIndex].addedBy) throw commandError("Shipped institutional programs are read-only. Choose a new program ID.")
        workspace.programs[programIndex] = program
      } else workspace.programs.push(program)
      changed.push({ type: "reference_program", id: program.id })
      const evidenceIndex = workspace.evidence.findIndex((item) => item.id === evidence.id)
      if (evidenceIndex >= 0) workspace.evidence[evidenceIndex] = evidence
      else workspace.evidence.push(evidence)
      changed.push({ type: "evidence", id: evidence.id })
      const libraryItem = upsertResearchLibraryItem(workspace, evidence, envelope.actor)
      changed.push({ type: "context_item", id: libraryItem.id })
    } else if (command.type === "remove_reference_program") {
      const index = workspace.programs.findIndex((item) => item.id === command.programId)
      if (index < 0) throw commandError("Program not found in this workspace")
      if (!workspace.programs[index].addedBy) throw commandError("Shipped institutional programs cannot be removed")
      const [removed] = workspace.programs.splice(index, 1)
      if (workspace.profile.declaredProgramId === removed.id) workspace.profile.declaredProgramId = null
      changed.push({ type: "reference_program", id: removed.id })
    } else if (command.type === "extend_reference_opportunity") {
      let evidence, opportunity
      try {
        evidence = validateEvidence(command.evidence)
        opportunity = validateOpportunity(command.opportunity ?? {})
      } catch (error) { throw commandError((error as Error).message) }
      if (!evidence.id) throw commandError("Reference evidence needs a stable ID")
      opportunity.addedBy = envelope.actor
      opportunity.evidenceIds = [evidence.id]
      const overlay = workspace.referenceOverlay ?? emptyOverlay()
      overlay.opportunities = overlay.opportunities ?? []
      workspace.referenceOverlay = overlay
      const index = overlay.opportunities.findIndex((item) => item.id === opportunity.id)
      if (index >= 0) overlay.opportunities[index] = opportunity
      else overlay.opportunities.push(opportunity)
      changed.push({ type: "reference_opportunity", id: opportunity.id })
      const evidenceIndex = workspace.evidence.findIndex((item) => item.id === evidence.id)
      if (evidenceIndex >= 0) workspace.evidence[evidenceIndex] = evidence
      else workspace.evidence.push(evidence)
      changed.push({ type: "evidence", id: evidence.id })
      const libraryItem = upsertResearchLibraryItem(workspace, evidence, envelope.actor)
      changed.push({ type: "context_item", id: libraryItem.id })
    } else if (command.type === "remove_reference_opportunity") {
      const overlay = workspace.referenceOverlay ?? emptyOverlay()
      overlay.opportunities = overlay.opportunities ?? []
      const index = overlay.opportunities.findIndex((item) => item.id === command.opportunityId)
      if (index < 0) throw commandError("This entry is part of the shipped reference or does not exist")
      const [removed] = overlay.opportunities.splice(index, 1)
      workspace.referenceOverlay = overlay
      changed.push({ type: "reference_opportunity", id: removed.id })
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
    } else if (command.type === "manage_todo") {
      workspace.todos = Array.isArray(workspace.todos) ? workspace.todos : []
      const action = String(command.action ?? "")
      if (action === "add") {
        const title = String(command.todo?.title ?? "").trim().slice(0, 120)
        if (!title) throw commandError("A todo needs a title")
        const due = command.todo?.due ? String(command.todo.due) : undefined
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw commandError("A todo due date uses YYYY-MM-DD")
        const dueTime = command.todo?.dueTime ? String(command.todo.dueTime) : undefined
        if (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)) throw commandError("A todo due time uses 24h HH:MM")
        if (dueTime && !due) throw commandError("A due time needs a due date")
        const todo = {
          id: String(command.todo?.id ?? `TODO-${envelope.idempotencyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28)}`),
          title,
          detail: typeof command.todo?.detail === "string" && command.todo.detail.trim() ? command.todo.detail.trim().slice(0, 300) : undefined,
          due,
          dueTime,
          done: false,
          source: envelope.actor.type === "agent" ? "agent" as const : "human" as const,
          createdAt: new Date().toISOString()
        }
        if (workspace.todos.some((item) => item.id === todo.id)) throw commandError("Todo ID already exists")
        workspace.todos.push(todo)
        changed.push({ type: "todo", id: todo.id })
      } else if (action === "toggle" || action === "remove") {
        const index = workspace.todos.findIndex((item) => item.id === command.todoId)
        if (index < 0) throw commandError("Todo not found")
        if (action === "toggle") {
          workspace.todos[index].done = !workspace.todos[index].done
          changed.push({ type: "todo", id: workspace.todos[index].id })
        } else {
          const [removed] = workspace.todos.splice(index, 1)
          changed.push({ type: "todo", id: removed.id })
        }
      } else throw commandError("Todo action must be add, toggle, or remove")
    } else if (command.type === "manage_event") {
      workspace.events = Array.isArray(workspace.events) ? workspace.events : []
      const action = String(command.action ?? "")
      if (action === "remove") {
        const index = workspace.events.findIndex((item) => item.id === command.eventId)
        if (index < 0) throw commandError("Event not found")
        const [removed] = workspace.events.splice(index, 1)
        changed.push({ type: "event", id: removed.id })
      } else if (action === "add" || action === "update") {
        const input = command.event ?? {}
        const title = String(input.title ?? "").trim().slice(0, 100)
        if (!title) throw commandError("An event needs a title")
        const date = String(input.date ?? "")
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw commandError("An event date uses YYYY-MM-DD")
        const time = /^\d{2}:\d{2}$/
        for (const bound of [input.start, input.end]) if (bound && !time.test(String(bound))) throw commandError("Event times use 24h HH:MM")
        if (input.end && !input.start) throw commandError("An end time needs a start time")
        const timezone = input.timezone ? String(input.timezone) : undefined
        if (timezone && !isValidTimezone(timezone)) throw commandError("Unknown timezone; use an IANA name such as America/New_York")
        const event = {
          id: String(input.id ?? `EVENT-${envelope.idempotencyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28)}`),
          title,
          description: typeof input.description === "string" && input.description.trim() ? input.description.trim().slice(0, 600) : undefined,
          date,
          start: input.start ? String(input.start) : undefined,
          end: input.end ? String(input.end) : undefined,
          timezone,
          addedBy: envelope.actor.type === "agent" ? "agent" as const : "human" as const,
          createdAt: new Date().toISOString()
        }
        const index = workspace.events.findIndex((item) => item.id === event.id)
        if (action === "add" && index >= 0) throw commandError("Event ID already exists")
        if (action === "update" && index < 0) throw commandError("Event not found")
        if (index >= 0) workspace.events[index] = { ...event, createdAt: workspace.events[index].createdAt }
        else workspace.events.push(event)
        changed.push({ type: "event", id: event.id })
      } else throw commandError("Event action must be add, update, or remove")
    } else if (command.type === "set_course_interest") {
      const courseId = String(command.courseId ?? "").trim()
      if (!courseId) throw commandError("A course ID is required")
      workspace.interestedCourseIds = Array.isArray(workspace.interestedCourseIds) ? workspace.interestedCourseIds : []
      const has = workspace.interestedCourseIds.includes(courseId)
      if (command.interested && !has) workspace.interestedCourseIds.push(courseId)
      if (!command.interested && has) workspace.interestedCourseIds = workspace.interestedCourseIds.filter((id) => id !== courseId)
      changed.push({ type: "course_interest", id: courseId })
    } else if (command.type === "set_opportunity_interest") {
      const opportunityId = String(command.opportunityId ?? "").trim()
      if (!opportunityId) throw commandError("An opportunity ID is required")
      workspace.interestedOpportunityIds = Array.isArray(workspace.interestedOpportunityIds) ? workspace.interestedOpportunityIds : []
      const has = workspace.interestedOpportunityIds.includes(opportunityId)
      if (command.interested && !has) workspace.interestedOpportunityIds.push(opportunityId)
      if (!command.interested && has) workspace.interestedOpportunityIds = workspace.interestedOpportunityIds.filter((id) => id !== opportunityId)
      changed.push({ type: "opportunity_interest", id: opportunityId })
    } else if (command.type === "annotate_course") {
      const courseId = String(command.courseId ?? "").trim()
      if (!courseId) throw commandError("A course ID is required")
      workspace.courseNotes = workspace.courseNotes && typeof workspace.courseNotes === "object" ? workspace.courseNotes : {}
      const notes = workspace.courseNotes[courseId] ?? []
      if (typeof command.removeNoteId === "string" && command.removeNoteId) {
        const index = notes.findIndex((note) => note.id === command.removeNoteId)
        if (index < 0) throw commandError("Course note not found")
        const [removed] = notes.splice(index, 1)
        workspace.courseNotes[courseId] = notes
        changed.push({ type: "course_note", id: removed.id })
      } else {
        const text = String(command.note?.text ?? "").trim().slice(0, 600)
        if (!text) throw commandError("A course note needs text")
        const note = {
          id: `NOTE-${envelope.idempotencyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28)}`,
          text,
          author: envelope.actor.type === "agent" ? "agent" as const : "human" as const,
          at: new Date().toISOString()
        }
        if (notes.some((existing) => existing.id === note.id)) throw commandError("Course note ID already exists")
        notes.push(note)
        workspace.courseNotes[courseId] = notes
        changed.push({ type: "course_note", id: note.id })
      }
    } else if (command.type === "upsert_activity") {
      const input = command.activity ?? {}
      const name = String(input.name ?? "").trim().slice(0, 80)
      if (!name) throw commandError("An activity needs a name")
      const kind = ["research", "job", "volunteering", "athletics", "arts", "other"].includes(String(input.kind)) ? input.kind : "other"
      const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      const time = /^\d{2}:\d{2}$/
      const isoDate = /^\d{4}-\d{2}-\d{2}$/
      let schedule
      if (input.schedule) {
        const scheduleDays = Array.isArray(input.schedule.days) ? input.schedule.days.map(String).filter((day: string) => days.includes(day)) : []
        if (scheduleDays.length === 0 || !time.test(String(input.schedule.start)) || !time.test(String(input.schedule.end))) throw commandError("An activity schedule needs days and HH:MM start and end times")
        schedule = { days: scheduleDays, start: String(input.schedule.start), end: String(input.schedule.end), location: typeof input.schedule.location === "string" ? input.schedule.location.trim().slice(0, 80) : undefined }
      }
      for (const bound of [input.startDate, input.endDate]) if (bound && !isoDate.test(String(bound))) throw commandError("Activity dates use YYYY-MM-DD")
      const dates = Array.isArray(input.dates) ? input.dates.slice(0, 30).map((item: Record<string, unknown>) => {
        if (!isoDate.test(String(item?.date)) || !String(item?.label ?? "").trim()) throw commandError("Each activity date needs a YYYY-MM-DD date and a label")
        return { date: String(item.date), label: String(item.label).trim().slice(0, 80) }
      }) : undefined
      const activity = {
        id: String(input.id ?? `ACTIVITY-${envelope.idempotencyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28)}`),
        name,
        kind,
        detail: typeof input.detail === "string" && input.detail.trim() ? input.detail.trim().slice(0, 400) : undefined,
        organizer: typeof input.organizer === "string" && input.organizer.trim() ? input.organizer.trim().slice(0, 80) : undefined,
        sourceUrl: typeof input.sourceUrl === "string" && input.sourceUrl ? input.sourceUrl : undefined,
        schedule,
        startDate: input.startDate ? String(input.startDate) : undefined,
        endDate: input.endDate ? String(input.endDate) : undefined,
        dates,
        addedBy: envelope.actor.type === "agent" ? "agent" as const : "human" as const
      }
      if (activity.sourceUrl) {
        try { assertSafeExternalUrl(activity.sourceUrl) } catch (error) { throw commandError((error as Error).message) }
      }
      workspace.activities = Array.isArray(workspace.activities) ? workspace.activities : []
      const index = workspace.activities.findIndex((item) => item.id === activity.id)
      if (index >= 0) workspace.activities[index] = activity
      else workspace.activities.push(activity)
      changed.push({ type: "activity", id: activity.id })
    } else if (command.type === "remove_activity") {
      workspace.activities = Array.isArray(workspace.activities) ? workspace.activities : []
      const index = workspace.activities.findIndex((item) => item.id === command.activityId)
      if (index < 0) throw commandError("Activity not found")
      const [removed] = workspace.activities.splice(index, 1)
      changed.push({ type: "activity", id: removed.id })
    } else if (command.type === "set_goals") {
      const degree = typeof command.degree === "string" ? command.degree.trim().slice(0, 24) : undefined
      const goal = typeof command.goal === "string" ? command.goal.trim().slice(0, 1200) : undefined
      if (degree === undefined && goal === undefined) throw commandError("Provide a degree objective, a goal, or both")
      if (degree !== undefined) {
        if (!degree) throw commandError("A degree objective cannot be empty")
        const timeline = workspace.profile.timeline
        if (timeline) timeline.degree = degree
        else workspace.profile.timeline = { entryTermId: workspace.currentTermId, expectedGraduationTermId: workspace.currentTermId, degree }
      }
      if (goal !== undefined) {
        workspace.profile.summary = goal
        const goalItem = workspace.contextItems.find((item) => item.type === "goal" && !item.archived)
        if (goalItem) {
          goalItem.summary = goal
          goalItem.content = { ...goalItem.content, text: goal }
          goalItem.updatedAt = new Date().toISOString()
          changed.push({ type: "context_item", id: goalItem.id })
        }
      }
      changed.push({ type: "student_profile", id: workspace.profile.id })
    } else if (command.type === "ingest_context_items") {
      const items = Array.isArray(command.items) ? command.items : []
      if (items.length === 0) throw commandError("Provide at least one item to ingest")
      if (items.length > 20) throw commandError("Ingest at most twenty items per call")
      if (!workspace.collections.some((collection) => collection.id === "COLLECTION-INBOX")) workspace.collections.push({ id: "COLLECTION-INBOX", name: "Inbox", description: "Uncategorized context" })
      const keyPart = envelope.idempotencyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24)
      items.forEach((raw: Record<string, unknown>, index: number) => {
        const title = String(raw?.title ?? "").trim().slice(0, 80)
        if (!title) throw commandError("Every ingested item needs a title")
        const item: ContextItem = {
          id: `NOTE-${keyPart}-${index + 1}`,
          type: "note",
          title,
          summary: String(raw?.summary ?? "").trim().slice(0, 600),
          content: {},
          collectionId: "COLLECTION-INBOX",
          tags: sanitizeTags(raw?.tags),
          addedBy: envelope.actor,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        if (workspace.contextItems.some((existing) => existing.id === item.id)) throw commandError("Ingested item ID already exists; use a new idempotency key")
        workspace.contextItems.push(item)
        changed.push({ type: "context_item", id: item.id })
      })
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
      primaryVisibleId: primaryVisibleType[command.type] ? changed.find((item) => item.type === primaryVisibleType[command.type])?.id : undefined
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
