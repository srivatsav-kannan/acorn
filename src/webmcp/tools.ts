/* eslint-disable @typescript-eslint/no-explicit-any */
import { executeCommand } from "@/domain/commands"
import { checkPlan } from "@/domain/planner"
import { evaluateRequirement } from "@/domain/requirements"
import { searchCourses, searchWorkspace } from "@/domain/search"
import type { Actor, WorkspaceState } from "@/domain/types"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

type JsonSchema = { type: "object", additionalProperties: false, properties?: Record<string, Record<string, unknown>>, required?: string[] }
type Tool = {
  name: string
  description: string
  inputSchema: JsonSchema
  annotations: { readOnlyHint: boolean, untrustedContentHint: boolean }
  examples: Array<Record<string, unknown>>
  execute: (input: any) => Promise<any>
}

type Setup = {
  repository: MemoryWorkspaceRepository
  session: { userId: string, workspaceId: string, actor: Actor }
  now: () => Date
  onWorkspaceChanged?: (workspace: WorkspaceState, expectedVersion: number, idempotencyKey: string) => Promise<void>
}

const schema = (properties: JsonSchema["properties"] = {}, required: string[] = []): JsonSchema => ({ type: "object", additionalProperties: false, properties, required })
const field = (type: string, description: string) => ({ type, description })
const annotations = (readOnlyHint: boolean, untrustedContentHint = false) => ({ readOnlyHint, untrustedContentHint })
const evidenceField = {
  type: "object",
  additionalProperties: false,
  description: "A source-backed research record. A successful save creates or updates a visible Library source card.",
  properties: {
    id: field("string", "Stable evidence ID, for example EVIDENCE-CS522-AUT26"),
    title: field("string", "Short student-facing title for the Library card"),
    claim: field("string", "Concise normalized finding supported by the source"),
    sourceUrl: field("string", "Direct HTTPS source URL"),
    sourceTitle: field("string", "Human-readable source title"),
    retrievedAt: field("string", "ISO 8601 retrieval timestamp"),
    classification: { type: "string", enum: ["official", "experiential", "student", "derived"], description: "Evidence classification" },
    confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence from zero to one" },
    status: { type: "string", enum: ["current", "stale", "superseded"], description: "Current evidence status" },
    expiresAt: field("string", "Optional ISO 8601 expiry timestamp"),
    authority: { type: "string", enum: ["catalog", "term_schedule", "program_requirements", "experiential"], description: "Question-specific source authority" }
  },
  required: ["id", "title", "claim", "sourceUrl", "sourceTitle", "retrievedAt", "classification", "confidence", "status"]
}

export const createCourseContextTools = ({ repository, session, now, onWorkspaceChanged }: Setup): Tool[] => {
  const workspace = () => repository.getWorkspace(session.workspaceId, session.userId)
  const mutate = async (input: any, command: Record<string, unknown>) => {
    try {
      const result = await executeCommand(repository, {
        actor: session.actor,
        ownerUserId: session.userId,
        workspaceId: session.workspaceId,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        command
      })
      if (result.ok && onWorkspaceChanged) await onWorkspaceChanged(await workspace(), input.expectedVersion, input.idempotencyKey)
      return result
    } catch (error) {
      const code = (error as { code?: string }).code ?? "COMMAND_FAILED"
      return { ok: false, code, retryable: code === "VERSION_CONFLICT", message: (error as Error).message }
    }
  }

  return [
    {
      name: "search_workspace",
      description: "Search durable student context before external research. Call after get_planning_context for every new planning task.",
      inputSchema: schema({ query: field("string", "Question or topic to search for") }, ["query"]),
      annotations: annotations(true),
      examples: [{ query: "professor research" }],
      execute: async ({ query }) => searchWorkspace(await workspace(), repository.catalog, query)
    },
    {
      name: "get_planning_context",
      description: "Start here. Get the active workspace, version, student priorities, safety boundaries, and recommended tool sequence.",
      inputSchema: schema(),
      annotations: annotations(true),
      examples: [{}],
      execute: async () => {
        const value = await workspace()
        const currentPlan = value.plans[0]
        return { workspaceId: value.id, version: value.version, currentTermId: value.currentTermId, currentPlanId: currentPlan?.id ?? null, activeScenarioId: currentPlan?.activeScenarioId ?? null, workflow: ["Search the workspace before external research", "Discover current plan and scenario IDs before editing", "Explain tradeoffs before consequential edits", "Use one atomic mutation with the current version", "Run check_plan after every plan edit"], boundaries: ["Never enroll or submit forms", "Store useful research with provenance", "Preserve explicit hard constraints"], profile: { summary: value.profile.summary, preferences: value.profile.preferences, constraints: { excludedDays: value.profile.excludedDays, earliestStart: value.profile.earliestStart, latestEnd: value.profile.latestEnd } }, uncertainties: value.uncertainties }
      }
    },
    {
      name: "search_courses",
      description: "Search the imported catalog and current term sections with planning filters.",
      inputSchema: schema({ query: field("string", "Course code, title, topic, or keyword"), termId: field("string", "Stable academic term ID") }, ["query"]),
      annotations: annotations(true),
      examples: [{ query: "design", termId: "Use currentTermId from get_planning_context" }],
      execute: async (input) => ({ results: searchCourses(repository.catalog, input).slice(0, 6).map(({ course, sections }) => ({ id: course.id, code: course.code, title: course.title, units: `${course.minUnits}-${course.maxUnits}`, sectionIds: sections.map((item) => item.id) })) })
    },
    {
      name: "get_plan",
      description: "Get a term plan with scenarios, selected courses, backups, and commitments.",
      inputSchema: schema({ planId: field("string", "Stable plan ID") }),
      annotations: annotations(true),
      examples: [{ planId: "Use currentPlanId from get_planning_context" }],
      execute: async ({ planId }) => {
        const value = await workspace()
        const plan = value.plans.find((item) => item.id === (planId ?? value.plans[0]?.id))
        return { workspaceVersion: value.version, plan: plan ? {
          id: plan.id,
          activeScenarioId: plan.activeScenarioId,
          scenarios: plan.scenarios.map((scenario) => ({
            id: scenario.id,
            name: scenario.name,
            unitLimit: scenario.unitLimit,
            courses: scenario.courses,
            commitments: scenario.commitments.map((commitment) => ({ id: commitment.id, title: commitment.title }))
          }))
        } : null }
      }
    },
    {
      name: "check_plan",
      description: "Run deterministic unit, schedule, prerequisite, evidence, and constraint checks.",
      inputSchema: schema({ planId: field("string", "Stable plan ID"), scenarioId: field("string", "Stable scenario ID") }),
      annotations: annotations(true),
      examples: [{ planId: "Use the current plan ID", scenarioId: "Use a scenario ID returned by get_plan" }],
      execute: async ({ planId, scenarioId }) => {
        const value = await workspace()
        const plan = value.plans.find((item) => item.id === planId) ?? value.plans[0]
        const selected = plan?.scenarios.find((item) => item.id === scenarioId) ?? plan?.scenarios[0]
        return { workspaceVersion: value.version, checks: selected ? checkPlan({ scenario: selected, catalog: repository.catalog, profile: value.profile, evidence: value.evidence, now: now() }) : [] }
      }
    },
    {
      name: "get_program_progress",
      description: "Evaluate program requirements against completed and planned courses.",
      inputSchema: schema({ programId: field("string", "Stable program ID") }),
      annotations: annotations(true),
      examples: [{ programId: "PROGRAM-CS-BS" }],
      execute: async ({ programId }) => {
        const value = await workspace()
        const program = value.programs.find((item) => item.id === programId) ?? value.programs[0]
        const planned = value.plans.flatMap((plan) => plan.scenarios[0]?.courses.filter((item) => item.status === "active").map((item) => item.courseId) ?? [])
        const units = Object.fromEntries(repository.catalog.courses.map((course) => [course.id, course.maxUnits]))
        return { workspaceVersion: value.version, program: program ? { id: program.id, name: program.name, requirements: program.requirements.map((requirement) => ({ id: requirement.id, title: requirement.title, ...evaluateRequirement({ rule: requirement.rule, completedCourseIds: value.profile.completedCourseIds, plannedCourseIds: planned, courseUnits: units, courseGrades: value.profile.courseGrades, residentCourseIds: value.profile.residentCourseIds, allowDoubleCount: false }) })) } : null }
      }
    },
    {
      name: "save_research",
      description: "Save externally researched evidence and create or update its visible, searchable source card in the Research collection. Returns primaryVisibleId for the Library item.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), evidence: evidenceField }, ["expectedVersion", "idempotencyKey", "evidence"]),
      annotations: annotations(false, true),
      examples: [],
      execute: async (input) => mutate(input, { type: "save_research", evidence: input.evidence })
    },
    {
      name: "save_workspace_item",
      description: "Save a visible note, task, person, club, link, decision, or other context item.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), item: field("object", "Visible workspace item") }, ["expectedVersion", "idempotencyKey", "item"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "create_context_item", item: { ...input.item, content: input.item.content ?? { text: input.item.text ?? "" } } })
    },
    {
      name: "update_student_context",
      description: "Add or update student preferences and planning constraints.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), preferences: { type: "array", minItems: 1, description: "Complete visible priorities to add or update", items: { type: "object", additionalProperties: false, properties: { id: field("string", "Stable preference ID"), label: field("string", "Student-facing priority label"), strength: { type: "string", enum: ["hard", "soft"] }, value: { description: "Boolean, number, or text value" } }, required: ["id", "label", "strength", "value"] } } }, ["expectedVersion", "idempotencyKey", "preferences"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "set_student_preferences", preferences: input.preferences })
    },
    {
      name: "edit_plan",
      description: "Apply an atomic semantic edit to a plan scenario and return a receipt.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), planId: field("string", "Stable plan ID"), scenarioId: field("string", "Stable scenario ID"), operations: field("array", "Atomic plan operations") }, ["expectedVersion", "idempotencyKey", "planId", "scenarioId", "operations"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "edit_plan", planId: input.planId, scenarioId: input.scenarioId, operations: input.operations })
    },
    {
      name: "configure_view",
      description: "Create a safe block-based workspace view without arbitrary executable code.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), view: field("object", "Validated block view") }, ["expectedVersion", "idempotencyKey", "view"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "configure_view", view: input.view })
    }
  ]
}
