/* eslint-disable @typescript-eslint/no-explicit-any */
import { validateContextItem } from "@/domain/context"
import { upsertResearchLibraryItem, validateEvidence } from "@/domain/evidence"
import { applyAcademicHistory, validateAcademicHistoryPatch } from "@/domain/history"
import { emptyOverlay, validateOpportunity, validateOverlayCourse, validateOverlaySection, validateReferenceProgram } from "@/domain/reference"
import { assertSafeExternalUrl } from "@/domain/security"
import { isValidTimezone } from "@/domain/timezone"
import { compareTerms, parseTermId, supportsTimeline, termLabel } from "@/domain/timeline"
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

// An idempotency key names one operation. Replaying the same key with the
// same payload returns the stored receipt; replaying it with a different
// payload is a caller bug that must fail loudly, never acknowledge falsely.
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}
const commandHash = (command: Record<string, unknown>): string => {
  const text = stableStringify(command)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

// Format checks alone let 2026-02-30 and 25:61 through, so calendar values
// are checked against the actual calendar and clock.
const isRealDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}
const isRealTime = (value: string): boolean => {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(":").map(Number)
  return hours <= 23 && minutes <= 59
}

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
  manage_goal: "goal",
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
      const normalized = structuredClone(candidate)
      normalized.courses = Array.isArray(normalized.courses) ? normalized.courses : []
      normalized.commitments = Array.isArray(normalized.commitments) ? normalized.commitments : []
      plan.scenarios.push(normalized)
      changed.push({ type: "plan_scenario", id: candidate.id })
      continue
    }
    if (operation.type === "set_rationale") {
      const target = plan.scenarios.find((item) => item.id === command.scenarioId)
      if (!target) throw commandError("Scenario not found")
      const rationale = String(operation.rationale ?? "").trim()
      if (rationale.length > 500) throw commandError("A scenario rationale stays within 500 characters")
      target.rationale = rationale || undefined
      changed.push({ type: "plan_scenario", id: target.id })
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
  if (existing) {
    if (existing.commandHash && existing.commandHash !== commandHash(envelope.command)) {
      throw new RepositoryError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different operation. Use a fresh key for a new operation.")
    }
    return structuredClone(existing)
  }

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
      let item: ContextItem
      try { item = validateContextItem(command.item) as unknown as ContextItem }
      catch (error) { throw commandError((error as Error).message) }
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
      if (typeof patch.name === "string" && patch.name.trim()) {
        workspace.profile.name = patch.name.trim().slice(0, 80)
        // The workspace title carries the student's first name, so a rename
        // must not leave a previous owner's name on every export header.
        const firstName = workspace.profile.name.split(/\s+/)[0]
        const possessive = workspace.title.indexOf("'s ")
        workspace.title = `${firstName}'s ${possessive >= 0 ? workspace.title.slice(possessive + 3) : workspace.title}`
      }
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
      if (typeof patch.classYear === "string") {
        // With a structured timeline, standing is computed from the entry and
        // graduation dates, so a free-form class year would let the profile
        // contradict the map it sits next to.
        if (patch.classYear.trim() && supportsTimeline(workspace)) throw commandError("Class standing is derived from the entry and graduation dates on this profile. Change those dates on the Profile page instead of setting a class year.")
        workspace.profile.classYear = patch.classYear.trim().slice(0, 30) || undefined
      }
      if (typeof patch.recoveryPhone === "string") workspace.profile.recoveryPhone = patch.recoveryPhone.trim().slice(0, 24) || undefined
      if (typeof patch.earliestStart === "string") {
        if (!isRealTime(patch.earliestStart)) throw commandError("earliestStart uses 24h HH:MM with a real clock value")
        workspace.profile.earliestStart = patch.earliestStart
      }
      if (typeof patch.latestEnd === "string") {
        if (!isRealTime(patch.latestEnd)) throw commandError("latestEnd uses 24h HH:MM with a real clock value")
        workspace.profile.latestEnd = patch.latestEnd
      }
      if ((typeof patch.earliestStart === "string" || typeof patch.latestEnd === "string") && workspace.profile.latestEnd <= workspace.profile.earliestStart) throw commandError("The planning window's latest end must come after its earliest start")
      if (patch.transitionBufferMinutes !== undefined) {
        const buffer = Number(patch.transitionBufferMinutes)
        if (!Number.isInteger(buffer) || buffer < 0 || buffer > 120) throw commandError("transitionBufferMinutes must be an integer between 0 and 120")
        workspace.profile.transitionBufferMinutes = buffer
      }
      if (patch.protectedWindows !== undefined) {
        if (!Array.isArray(patch.protectedWindows) || patch.protectedWindows.length > 4) throw commandError("protectedWindows is a list of at most four windows")
        const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        workspace.profile.protectedWindows = patch.protectedWindows.map((raw: Record<string, unknown>, index: number) => {
          const days = Array.isArray(raw.days) ? raw.days.map(String).filter((day) => validDays.includes(day)) : []
          if (days.length === 0) throw commandError("A protected window needs at least one valid day")
          if (!isRealTime(String(raw.start)) || !isRealTime(String(raw.end))) throw commandError("Protected window times use 24h HH:MM with real clock values")
          if (String(raw.end) <= String(raw.start)) throw commandError("A protected window's end must come after its start")
          const label = String(raw.label ?? "").trim().slice(0, 60) || "Protected time"
          return { id: String(raw.id ?? `WINDOW-${index + 1}`), days: days as WorkspaceState["profile"]["excludedDays"], start: String(raw.start), end: String(raw.end), label }
        })
      }
      if (Array.isArray(patch.excludedDays)) workspace.profile.excludedDays = patch.excludedDays.filter((day): day is WorkspaceState["profile"]["excludedDays"][number] => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(String(day)))
      if (patch.declaredProgramId === null || (typeof patch.declaredProgramId === "string" && workspace.programs.some((program) => program.id === patch.declaredProgramId))) workspace.profile.declaredProgramId = patch.declaredProgramId as string | null
      changed.push({ type: "student_profile", id: workspace.profile.id })
    } else if (command.type === "update_academic_history") {
      let patch
      try { patch = validateAcademicHistoryPatch(command.patch ?? {}) }
      catch (error) { throw commandError((error as Error).message) }
      // Same rule as update_profile: with a structured timeline the standing
      // is computed, and a stored class year would contradict it.
      if (patch.classYear && supportsTimeline(workspace)) throw commandError("Class standing is derived from the entry and graduation dates on this profile. Change those dates on the Profile page instead of setting a class year.")
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
      // The overlay entry remembers which evidence backs it, so exports and
      // views can distinguish a source-backed correction from a bare claim.
      course.evidenceIds = [evidence.id]
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
    } else if (command.type === "archive_evidence") {
      const evidenceId = String(command.evidenceId ?? "").trim()
      const evidence = workspace.evidence.find((item) => item.id === evidenceId)
      if (!evidence) throw commandError("Evidence not found in this workspace")
      if (evidence.addedBy === "system") throw commandError("Shipped institutional evidence cannot be archived")
      // Provenance survives: the record is marked superseded and its Library
      // source card is archived, never deleted.
      evidence.status = "superseded"
      changed.push({ type: "evidence", id: evidence.id })
      for (const item of workspace.contextItems) {
        if (item.sourceEvidenceIds?.includes(evidence.id) && !item.archived) {
          item.archived = true
          item.updatedAt = new Date().toISOString()
          changed.push({ type: "context_item", id: item.id })
        }
      }
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
        const title = String(command.todo?.title ?? "").trim()
        if (!title) throw commandError("A todo needs a title")
        if (title.length > 120) throw commandError("A todo title stays within 120 characters")
        const due = command.todo?.due ? String(command.todo.due) : undefined
        if (due && !isRealDate(due)) throw commandError("A todo due date uses YYYY-MM-DD and must be a real calendar date")
        const dueTime = command.todo?.dueTime ? String(command.todo.dueTime) : undefined
        if (dueTime && !isRealTime(dueTime)) throw commandError("A todo due time uses 24h HH:MM with a real clock value")
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
          // A todo born from a goal milestone completes the milestone too, so
          // the two views never disagree about what is done.
          for (const item of workspace.contextItems.filter((candidate) => candidate.type === "goal" && !candidate.archived)) {
            const milestones = (item.content as { milestones?: Array<{ todoId?: string, done: boolean }> }).milestones
            const linked = milestones?.find((milestone) => milestone.todoId === workspace.todos[index].id)
            if (linked) {
              linked.done = workspace.todos[index].done
              item.updatedAt = new Date().toISOString()
              changed.push({ type: "goal", id: item.id })
            }
          }
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
        const title = String(input.title ?? "").trim()
        if (!title) throw commandError("An event needs a title")
        if (title.length > 100) throw commandError("An event title stays within 100 characters")
        const date = String(input.date ?? "")
        if (!isRealDate(date)) throw commandError("An event date uses YYYY-MM-DD and must be a real calendar date")
        for (const bound of [input.start, input.end]) if (bound && !isRealTime(String(bound))) throw commandError("Event times use 24h HH:MM with real clock values")
        if (input.end && !input.start) throw commandError("An end time needs a start time")
        if (input.start && input.end && String(input.end) < String(input.start)) throw commandError("An event's end time comes before its start time")
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
    } else if (command.type === "manage_goal") {
      workspace.contextItems = Array.isArray(workspace.contextItems) ? workspace.contextItems : []
      workspace.todos = Array.isArray(workspace.todos) ? workspace.todos : []
      const action = String(command.action ?? "")
      const goalItems = () => workspace.contextItems.filter((item) => item.type === "goal")
      const syncMilestoneTodo = (goalTitle: string, milestone: { id: string, title: string, due?: string, done: boolean, todoId?: string }) => {
        if (!milestone.due) {
          if (milestone.todoId) {
            workspace.todos = workspace.todos.filter((todo) => todo.id !== milestone.todoId)
            changed.push({ type: "todo", id: milestone.todoId })
            milestone.todoId = undefined
          }
          return
        }
        const existing = milestone.todoId ? workspace.todos.find((todo) => todo.id === milestone.todoId) : undefined
        if (existing) {
          existing.title = milestone.title
          existing.due = milestone.due
          existing.done = milestone.done
          existing.detail = `Milestone of ${goalTitle}`
        } else {
          const todoId = `TODO-${milestone.id.replace(/^MILESTONE-/, "")}`.slice(0, 60)
          milestone.todoId = todoId
          workspace.todos = workspace.todos.filter((todo) => todo.id !== todoId)
          workspace.todos.push({ id: todoId, title: milestone.title, detail: `Milestone of ${goalTitle}`, due: milestone.due, done: milestone.done, source: envelope.actor.type === "agent" ? "agent" : "human", createdAt: new Date().toISOString() })
        }
        changed.push({ type: "todo", id: milestone.todoId! })
      }
      if (action === "upsert") {
        const input = command.goal ?? {}
        const title = String(input.title ?? "").trim()
        if (!title) throw commandError("A goal needs a title")
        if (title.length > 120) throw commandError("A goal title stays within 120 characters")
        if (input.targetDate && !isRealDate(String(input.targetDate))) throw commandError("A goal target date uses YYYY-MM-DD and must be a real calendar date")
        const rawMilestones = Array.isArray(input.milestones) ? input.milestones : []
        if (rawMilestones.length > 12) throw commandError("A goal keeps at most twelve milestones")
        const goalId = String(input.id ?? `GOAL-${envelope.idempotencyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 28)}`)
        const existingItem = workspace.contextItems.find((item) => item.id === goalId)
        if (existingItem && existingItem.type !== "goal") throw commandError("That ID belongs to a non-goal item")
        const previous = existingItem ? (existingItem.content as { milestones?: Array<{ id: string, todoId?: string }> }).milestones ?? [] : []
        const milestones = rawMilestones.map((raw: Record<string, unknown>, index: number) => {
          const milestoneTitle = String(raw.title ?? "").trim()
          if (!milestoneTitle) throw commandError("Every milestone needs a title")
          if (milestoneTitle.length > 100) throw commandError("A milestone title stays within 100 characters")
          if (raw.due && !isRealDate(String(raw.due))) throw commandError("A milestone due date uses YYYY-MM-DD and must be a real calendar date")
          const id = String(raw.id ?? `MILESTONE-${goalId.replace(/^GOAL-/, "")}-${index + 1}`)
          const carried = previous.find((item) => item.id === id)
          return { id, title: milestoneTitle, due: raw.due ? String(raw.due) : undefined, done: raw.done === true, todoId: carried?.todoId }
        })
        // Milestones dropped in this upsert take their linked todos with them.
        for (const gone of previous.filter((item) => item.todoId && !milestones.some((kept: { id: string }) => kept.id === item.id))) {
          workspace.todos = workspace.todos.filter((todo) => todo.id !== gone.todoId)
          changed.push({ type: "todo", id: gone.todoId! })
        }
        for (const milestone of milestones) syncMilestoneTodo(title, milestone)
        const status = ["active", "achieved", "dropped"].includes(String(input.status)) ? input.status : "active"
        const content = { text: typeof input.why === "string" && input.why.trim() ? input.why.trim().slice(0, 600) : (existingItem?.content as { text?: string })?.text, status, targetDate: input.targetDate ? String(input.targetDate) : undefined, milestones, courseIds: Array.isArray(input.courseIds) ? input.courseIds.map(String).slice(0, 12) : [], opportunityIds: Array.isArray(input.opportunityIds) ? input.opportunityIds.map(String).slice(0, 12) : [] }
        const summary = content.text ? content.text.slice(0, 140) : milestones.length ? `Next: ${milestones.find((item: { done: boolean }) => !item.done)?.title ?? "all milestones done"}` : ""
        if (existingItem) {
          existingItem.title = title
          existingItem.summary = summary
          existingItem.content = content
          existingItem.tags = sanitizeTags(input.tags) ?? existingItem.tags
          existingItem.updatedAt = new Date().toISOString()
        } else {
          workspace.contextItems.push({ id: goalId, type: "goal", title, summary, content, tags: sanitizeTags(input.tags), collectionId: "COLLECTION-INBOX", addedBy: envelope.actor, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        }
        changed.push({ type: "goal", id: goalId })
      } else if (action === "toggle_milestone") {
        const item = goalItems().find((candidate) => candidate.id === command.goalId)
        if (!item) throw commandError("Goal not found")
        const content = item.content as { milestones?: Array<{ id: string, title: string, due?: string, done: boolean, todoId?: string }> }
        const milestone = content.milestones?.find((candidate) => candidate.id === command.milestoneId)
        if (!milestone) throw commandError("Milestone not found")
        milestone.done = command.done !== false
        if (milestone.todoId) {
          const todo = workspace.todos.find((candidate) => candidate.id === milestone.todoId)
          if (todo) {
            todo.done = milestone.done
            changed.push({ type: "todo", id: todo.id })
          }
        }
        item.updatedAt = new Date().toISOString()
        changed.push({ type: "goal", id: item.id })
      } else if (action === "set_status") {
        const item = goalItems().find((candidate) => candidate.id === command.goalId)
        if (!item) throw commandError("Goal not found")
        if (!["active", "achieved", "dropped"].includes(String(command.status))) throw commandError("Goal status must be active, achieved, or dropped")
        ;(item.content as { status?: string }).status = String(command.status)
        item.updatedAt = new Date().toISOString()
        changed.push({ type: "goal", id: item.id })
      } else if (action === "remove") {
        const item = goalItems().find((candidate) => candidate.id === command.goalId)
        if (!item) throw commandError("Goal not found")
        for (const milestone of ((item.content as { milestones?: Array<{ todoId?: string }> }).milestones ?? [])) {
          if (milestone.todoId) {
            workspace.todos = workspace.todos.filter((todo) => todo.id !== milestone.todoId)
            changed.push({ type: "todo", id: milestone.todoId })
          }
        }
        workspace.contextItems = workspace.contextItems.filter((candidate) => candidate.id !== item.id)
        changed.push({ type: "goal", id: item.id })
      } else throw commandError("Goal action must be upsert, toggle_milestone, set_status, or remove")
    } else if (command.type === "set_course_interest") {
      const courseId = String(command.courseId ?? "").trim()
      if (!courseId) throw commandError("A course ID is required")
      workspace.interestedCourseIds = Array.isArray(workspace.interestedCourseIds) ? workspace.interestedCourseIds : []
      const has = workspace.interestedCourseIds.includes(courseId)
      if (command.interested && !has) workspace.interestedCourseIds.push(courseId)
      if (!command.interested && has) workspace.interestedCourseIds = workspace.interestedCourseIds.filter((id) => id !== courseId)
      workspace.courseIntents = workspace.courseIntents && typeof workspace.courseIntents === "object" ? workspace.courseIntents : {}
      if (command.interested && typeof command.intendedTermId === "string" && command.intendedTermId.trim()) {
        if (!parseTermId(command.intendedTermId)) throw commandError("intendedTermId must be a term ID such as TERM-2027-WINTER")
        workspace.courseIntents[courseId] = command.intendedTermId
      }
      if (!command.interested) delete workspace.courseIntents[courseId]
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
      let schedule
      if (input.schedule) {
        const scheduleDays = Array.isArray(input.schedule.days) ? input.schedule.days.map(String).filter((day: string) => days.includes(day)) : []
        if (scheduleDays.length === 0 || !isRealTime(String(input.schedule.start)) || !isRealTime(String(input.schedule.end))) throw commandError("An activity schedule needs days and real HH:MM start and end times")
        if (String(input.schedule.end) <= String(input.schedule.start)) throw commandError("An activity's end time must come after its start time")
        schedule = { days: scheduleDays, start: String(input.schedule.start), end: String(input.schedule.end), location: typeof input.schedule.location === "string" ? input.schedule.location.trim().slice(0, 80) : undefined }
      }
      for (const bound of [input.startDate, input.endDate]) if (bound && !isRealDate(String(bound))) throw commandError("Activity dates use YYYY-MM-DD and must be real calendar dates")
      const dates = Array.isArray(input.dates) ? input.dates.slice(0, 30).map((item: Record<string, unknown>) => {
        if (!isRealDate(String(item?.date)) || !String(item?.label ?? "").trim()) throw commandError("Each activity date needs a real YYYY-MM-DD date and a label")
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
      // Undo restores the full snapshot taken before the target action, so an
      // undo of anything except the newest not-yet-undone action would erase
      // every commit made after it. The frontier rule forbids that: undos walk
      // backward one step at a time, newest first, and each failure mode gets
      // its own honest message.
      const receiptId = String(command.receiptId ?? "")
      const target = workspace.receipts.find((item) => item.receiptId === receiptId)
      if (!target) throw commandError("No action with that receipt exists in this workspace")
      if (target.undoAvailable === false) throw commandError("An undo cannot itself be undone")
      const undone = new Set(workspace.activity.filter((item) => item.undoneAt).map((item) => item.receiptId))
      if (undone.has(receiptId)) throw commandError("This action was already undone")
      const frontier = [...workspace.receipts].reverse().find((item) => item.undoAvailable && !undone.has(item.receiptId))
      if (frontier && frontier.receiptId !== receiptId) throw commandError("Only the most recent action can be undone, so newer committed work is never erased. Undo newer actions first, newest to oldest.")
      const snapshot = workspace.undoSnapshots[receiptId]
      if (!snapshot) throw commandError("This action is outside the undo window; only the ten most recent mutations keep snapshots")
      const restored = structuredClone(snapshot)
      const original = workspace.activity.find((item) => item.receiptId === command.receiptId)
      if (original) original.undoneAt = new Date().toISOString()
      changed.push(...(original?.changed ?? []))
      // The snapshot rewinds workspace CONTENT only. The ledger is history,
      // not state: receipts, activity, and the snapshot map carry forward so
      // an undone action stays visible and marked, never erased.
      restored.undoSnapshots = structuredClone(workspace.undoSnapshots)
      restored.receipts = structuredClone(workspace.receipts)
      restored.activity = structuredClone(workspace.activity)
      Object.assign(workspace, restored)
      // The restored snapshot carries the version it was taken at; the undo
      // itself is a new mutation, so the receipt must count from the current
      // version, not the snapshot's.
      workspace.version = before.version
    } else throw commandError("Unsupported command")

    const receiptId = actionId(envelope.idempotencyKey)
    const undoAvailable = command.type !== "undo_action"
    if (undoAvailable) {
      // A stored snapshot must not carry its own undo history: undo_action
      // reattaches the live map anyway, and nesting made every commit double
      // the payload until the database cancelled reads of it. Only the ten
      // newest snapshots stay undoable, and older entries from before this
      // rule are stripped and pruned the same way.
      workspace.undoSnapshots[receiptId] = { ...before, undoSnapshots: {} }
      const keys = Object.keys(workspace.undoSnapshots)
      for (const key of keys.slice(0, Math.max(0, keys.length - 10))) delete workspace.undoSnapshots[key]
      for (const kept of Object.values(workspace.undoSnapshots)) kept.undoSnapshots = {}
    }
    const receipt: ActionReceipt = {
      ok: true,
      receiptId,
      workspaceVersion: workspace.version + 1,
      changed,
      undoAvailable,
      actor: envelope.actor,
      visibleChange: true,
      primaryVisibleId: primaryVisibleType[command.type] ? changed.find((item) => item.type === primaryVisibleType[command.type])?.id : undefined,
      commandHash: commandHash(envelope.command)
    }
    workspace.receipts.push(receipt)
    if (workspace.receipts.length > 300) workspace.receipts.splice(0, workspace.receipts.length - 300)
    workspace.activity.push({
      id: `ACTIVITY-${receiptId.replace(/^ACTION-/, "")}`,
      receiptId,
      actor: envelope.actor,
      summary: command.type.replaceAll("_", " "),
      changed,
      createdAt: new Date().toISOString(),
      undoAvailable
    })
    if (workspace.activity.length > 500) workspace.activity.splice(0, workspace.activity.length - 500)
    return { workspace, inverse: before, result: receipt }
  })
  return mutation.result!
}
