/* eslint-disable @typescript-eslint/no-explicit-any */
import { executeCommand } from "@/domain/commands"
import { evaluateDegreePlan } from "@/domain/degree-plan"
import { effectiveCompletedCourseIds } from "@/domain/history"
import { checkPlan } from "@/domain/planner"
import { mergedCatalogFor, mergedOpportunities } from "@/domain/reference"
import { standingForTerm, supportsTimeline, termSequence, timelineFor } from "@/domain/timeline"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { evaluateRequirement } from "@/domain/requirements"
import { searchCourses, searchWorkspace } from "@/domain/search"
import { exportBlocks } from "@/webmcp/export"
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
  // Serializes each mutation against every other mutation in the session,
  // including UI clicks, so concurrent tool calls cannot race their commits.
  runExclusive?: <T>(task: () => Promise<T>) => Promise<T>
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

export const createCourseContextTools = ({ repository, session, now, onWorkspaceChanged, runExclusive }: Setup): Tool[] => {
  const workspace = () => repository.getWorkspace(session.workspaceId, session.userId)
  const catalog = async () => mergedCatalogFor(await workspace(), repository.catalog)
  const gate = runExclusive ?? (<T,>(task: () => Promise<T>) => task())
  const mutate = (input: any, command: Record<string, unknown>) => gate(async () => {
    let applied: { receiptId: string } | null = null
    try {
      const result = await executeCommand(repository, {
        actor: session.actor,
        ownerUserId: session.userId,
        workspaceId: session.workspaceId,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        command
      })
      if (!result.ok) return result
      applied = result
      if (onWorkspaceChanged) await onWorkspaceChanged(await workspace(), input.expectedVersion, input.idempotencyKey)
      return result
    } catch (error) {
      const code = (error as { code?: string }).code ?? (applied ? "COMMIT_FAILED" : "COMMAND_FAILED")
      if (applied) {
        // The command ran locally but the durable commit did not confirm, and
        // the provider has already reloaded server truth over this repository.
        // A commit that actually landed carries its receipt in that reloaded
        // state, so answer with the real outcome instead of a false failure.
        const reloaded = await workspace().catch(() => null)
        const receipt = reloaded?.receipts.find((item) => item.receiptId === applied?.receiptId)
        if (receipt) return structuredClone(receipt)
      }
      const retryable = code === "VERSION_CONFLICT" || code === "COMMIT_TIMEOUT" || code === "COMMIT_FAILED"
      return { ok: false, code, retryable, message: (error as Error).message }
    }
  })

  return [
    {
      name: "search_workspace",
      description: "Search durable student context, courses, programs, and the club and research directory before external research. Call after get_planning_context for every new planning task.",
      inputSchema: schema({ query: field("string", "Question or topic to search for") }, ["query"]),
      annotations: annotations(true),
      examples: [{ query: "professor research" }],
      execute: async ({ query }) => {
        const value = await workspace()
        return searchWorkspace(value, mergedCatalogFor(value, repository.catalog), query, mergedOpportunities(institutionForWorkspace(value).buildOpportunities(), value.referenceOverlay?.opportunities))
      }
    },
    {
      name: "get_planning_context",
      description: "Start here. Get the active workspace, version, student priorities, safety boundaries, and recommended tool sequence.",
      inputSchema: schema(),
      annotations: annotations(true),
      examples: [{}],
      execute: async () => {
        const value = await workspace()
        const currentPlan = value.plans.find((plan) => plan.termId === value.currentTermId) ?? value.plans[0]
        const custom = value.institutionId === "INSTITUTION-CUSTOM"
        const timeline = supportsTimeline(value) ? timelineFor(value.profile, now()) : null
        return { workspaceId: value.id, version: value.version, institution: value.institution, referenceNote: custom ? "Custom school, beta. No shipped pack. Research this university and build its reference with extend_reference, courses and programs, each with an official source." : "Shipped reference is a sample. Fill gaps with extend_reference.", timeline: timeline ? { entry: timeline.entryTermId, graduation: timeline.expectedGraduationTermId, degree: timeline.degree, plannedTermIds: value.plans.map((plan) => plan.termId), remainingTerms: termSequence(value.currentTermId, timeline.expectedGraduationTermId).length } : null, history: { classYear: timeline ? standingForTerm(timeline, value.currentTermId) : value.profile.classYear ?? null, completedCourses: value.profile.completedCourseIds.length, externalCredits: (value.profile.apCredits ?? []).length }, tracker: { todos: (value.todos ?? []).filter((todo) => !todo.done).length, notes: value.contextItems.filter((item) => !item.archived).length, interested: (value.interestedCourseIds ?? []).length, activities: (value.activities ?? []).length }, currentTermId: value.currentTermId, currentPlanId: currentPlan?.id ?? null, activeScenarioId: currentPlan?.activeScenarioId ?? null, workflow: ["Pull export_context once for a fresh session", "Search the workspace before external research", "Discover plan and scenario IDs before editing", "One atomic mutation per version", "Run check_plan after every plan edit"], boundaries: ["Never enroll or submit forms", "Save research with provenance", "Keep hard constraints"], profile: { summary: value.profile.summary, preferences: value.profile.preferences, constraints: { excludedDays: value.profile.excludedDays, earliestStart: value.profile.earliestStart, latestEnd: value.profile.latestEnd } }, uncertainties: value.uncertainties.slice(0, 3).map((item) => ({ id: item.id, question: item.question.slice(0, 80), status: item.status })) }
      }
    },
    {
      name: "search_courses",
      description: "Search the imported catalog and current term sections with planning filters.",
      inputSchema: schema({ query: field("string", "Course code, title, topic, or keyword"), termId: field("string", "Stable academic term ID") }, ["query"]),
      annotations: annotations(true),
      examples: [{ query: "design", termId: "Use currentTermId from get_planning_context" }],
      execute: async (input) => ({ results: searchCourses(await catalog(), input).slice(0, 6).map(({ course, sections }) => ({ id: course.id, code: course.code, title: course.title, units: `${course.minUnits}-${course.maxUnits}`, sectionIds: sections.map((item) => item.id) })) })
    },
    {
      name: "get_plan",
      description: "Get one term's plan with scenarios, selected courses, backups, and commitments. Look up by planId or termId.",
      inputSchema: schema({ planId: field("string", "Stable plan ID"), termId: field("string", "Term ID such as TERM-2027-WINTER") }),
      annotations: annotations(true),
      examples: [{ planId: "Use currentPlanId from get_planning_context" }],
      execute: async ({ planId, termId }) => {
        const value = await workspace()
        const plan = value.plans.find((item) => item.id === planId) ?? value.plans.find((item) => item.termId === termId) ?? (planId || termId ? undefined : value.plans[0])
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
        const merged = mergedCatalogFor(value, repository.catalog)
        const degree = supportsTimeline(value) ? evaluateDegreePlan(value, merged, now()) : null
        return { workspaceVersion: value.version, checks: plan && selected ? checkPlan({ scenario: selected, catalog: merged, profile: value.profile, evidence: value.evidence, now: now(), termId: plan.termId }) : [], timelineIssues: degree ? degree.issues.slice(0, 8) : [], unitsToward: degree ? { projected: degree.projectedUnits, required: degree.requiredUnits } : null }
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
        const units = Object.fromEntries(mergedCatalogFor(value, repository.catalog).courses.map((course) => [course.id, course.maxUnits]))
        return { workspaceVersion: value.version, program: program ? { id: program.id, name: program.name, requirements: program.requirements.map((requirement) => {
          const evaluation = evaluateRequirement({ rule: requirement.rule, completedCourseIds: effectiveCompletedCourseIds(value.profile), plannedCourseIds: planned, courseUnits: units, courseGrades: value.profile.courseGrades, residentCourseIds: value.profile.residentCourseIds, allowDoubleCount: false })
          return { id: requirement.id, title: requirement.title, status: evaluation.status, courseIds: evaluation.contributingCourseIds.length ? evaluation.contributingCourseIds : undefined, detail: evaluation.detail ? evaluation.detail.slice(0, 120) : undefined }
        }) } : null }
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
      description: "Add or update the student's preferred name and goal, planning preferences, or structured academic history such as completed courses, AP and transfer credit, class standing, and the degree timeline. Pass one section per call. Context the student shared with you belongs here, visibly, not in your transcript.",
      inputSchema: schema({
        expectedVersion: field("number", "Current workspace version"),
        idempotencyKey: field("string", "Unique retry-safe operation key"),
        preferences: { type: "array", minItems: 1, description: "Complete visible priorities to add or update", items: { type: "object", additionalProperties: false, properties: { id: field("string", "Stable preference ID"), label: field("string", "Student-facing priority label"), strength: { type: "string", enum: ["hard", "soft"] }, value: { description: "Boolean, number, or text value" } }, required: ["id", "label", "strength", "value"] } },
        profile: {
          type: "object",
          additionalProperties: false,
          description: "Durable identity and planning-window facts the student told you",
          properties: {
            preferredName: field("string", "The name the student goes by"),
            goal: field("string", "What the student wants help figuring out, in their own words"),
            classStanding: field("string", "Only for custom institutions without a computed timeline. With a timeline, standing is derived from the profile's entry and graduation dates and this field is rejected"),
            earliestStart: field("string", "Earliest acceptable class start, 24h HH:MM"),
            latestEnd: field("string", "Latest acceptable class end, 24h HH:MM"),
            excludedDays: { type: "array", description: "Days to keep meeting-free, e.g. [\"fri\"]", items: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] } }
          }
        },
        academicHistory: {
          type: "object",
          additionalProperties: false,
          description: "Structured academic history. Provided lists replace the stored lists.",
          properties: {
            classYear: field("string", "Only for custom institutions without a computed timeline; rejected when standing is derived from the profile dates"),
            completedCourses: field("array", "Complete list of completed courses as {courseId, grade?}"),
            apCredits: field("array", "Complete list of credits as {exam, score?, unitsGranted?, satisfiesCourseIds?}. satisfiesCourseIds count as completed in checks.")
          }
        }
      }, ["expectedVersion", "idempotencyKey"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => {
        const sections = [input.profile, input.academicHistory, input.preferences].filter(Boolean).length
        if (sections !== 1) return { ok: false, code: "ONE_SECTION_PER_CALL", message: "Send profile, preferences, or academicHistory, exactly one per call, so each change is separately visible and undoable." }
        if (input.profile) return mutate(input, { type: "update_profile", patch: { name: input.profile.preferredName, summary: input.profile.goal, classYear: input.profile.classStanding, earliestStart: input.profile.earliestStart, latestEnd: input.profile.latestEnd, excludedDays: input.profile.excludedDays } })
        if (input.academicHistory) return mutate(input, { type: "update_academic_history", patch: input.academicHistory })
        if (!Array.isArray(input.preferences) || input.preferences.length === 0) return { ok: false, code: "COMMAND_INVALID", message: "Provide at least one complete preference." }
        return mutate(input, { type: "set_student_preferences", preferences: input.preferences })
      }
    },
    {
      name: "edit_plan",
      description: "Apply an atomic semantic edit to a plan scenario and return a receipt. Pass termId instead of planId to plan a future term. A plan for that term is created when missing, so a four or five year degree map builds term by term.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), planId: field("string", "Stable plan ID"), termId: field("string", "Term ID such as TERM-2027-WINTER, creates the term plan when missing"), scenarioId: field("string", "Stable scenario ID, defaults to the term's active scenario"), operations: field("array", "Atomic plan operations") }, ["expectedVersion", "idempotencyKey", "operations"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "edit_plan", planId: input.planId, termId: input.termId, scenarioId: input.scenarioId, operations: input.operations })
    },
    {
      name: "extend_reference",
      description: "Add or correct institutional reference: a course with an optional section, a program with a validated requirement tree, or a club, research, or campus program listing. Pass exactly one of course, program, or opportunity per call, always with a classified source. Reusing a shipped entry's ID amends it, and the interface shows the change against the original. Additions merge into search and checks and stay removable.",
      inputSchema: schema({
        expectedVersion: field("number", "Current workspace version"),
        idempotencyKey: field("string", "Unique retry-safe operation key"),
        course: {
          type: "object",
          additionalProperties: false,
          description: "The catalog course to add or correct",
          properties: {
            id: field("string", "Stable uppercase ID, for example COURSE-CS-329S"),
            code: field("string", "Official course code, for example CS 329S"),
            title: field("string", "Official course title"),
            description: field("string", "Short official description"),
            subject: field("string", "Subject code, for example CS"),
            level: field("number", "Numeric course level"),
            units: field("number", "Units when fixed"),
            minUnits: field("number", "Minimum units"),
            maxUnits: field("number", "Maximum units"),
            tags: field("array", "Short topical tags"),
            sourceUrl: field("string", "Official catalog URL for this course"),
            prerequisites: field("array", "Known prerequisite course IDs"),
            prerequisiteUncertain: field("boolean", "True when the prerequisite reading needs review")
          },
          required: ["code", "title"]
        },
        section: {
          type: "object",
          additionalProperties: false,
          description: "Optional current-term section with verified meeting times, only alongside course",
          properties: {
            id: field("string", "Stable section ID"),
            sectionNumber: field("string", "Official section number"),
            instructor: field("string", "Instructor as listed officially"),
            units: field("number", "Section units"),
            meetings: field("array", "Meetings as {days, start, end, type, location} with HH:MM times")
          },
          required: ["units", "meetings"]
        },
        program: {
          type: "object",
          additionalProperties: false,
          description: "A degree program with a structured requirement tree",
          properties: {
            id: field("string", "Stable uppercase ID, for example PROGRAM-BERKELEY-EECS-BS"),
            name: field("string", "Official program name"),
            credential: field("string", "Credential, for example BS or BA"),
            catalogYear: field("string", "Catalog year the requirements describe"),
            sourceUrl: field("string", "Official program page URL"),
            summary: field("string", "One or two plain sentences about the program"),
            requirements: field("array", "Requirements as {title, rule}. Rules use course, all_of, any_of, choose_n, course_group, minimum_units, minimum_grade, residency, or manual_review.")
          },
          required: ["name", "sourceUrl", "requirements"]
        },
        opportunity: {
          type: "object",
          additionalProperties: false,
          description: "A club, research program, or campus program listing",
          properties: {
            id: field("string", "Stable uppercase ID. Reuse a shipped ID to amend that entry."),
            kind: { type: "string", enum: ["club", "research", "program"], description: "Listing kind" },
            name: field("string", "Official name"),
            summary: field("string", "One or two plain sentences"),
            url: field("string", "Official site when it exists"),
            tags: field("array", "Short topical tags"),
            commitment: field("string", "Typical time commitment"),
            timing: field("string", "Recruiting cycle or application window")
          },
          required: ["name", "summary", "kind"]
        },
        evidence: evidenceField
      }, ["expectedVersion", "idempotencyKey", "evidence"]),
      annotations: annotations(false, true),
      examples: [],
      execute: async (input) => {
        const provided = [input.course, input.program, input.opportunity].filter(Boolean).length
        if (provided !== 1) return { ok: false, code: "COMMAND_INVALID", message: "Pass exactly one of course, program, or opportunity per call." }
        if (input.program) return mutate(input, { type: "add_reference_program", program: input.program, evidence: input.evidence })
        if (input.opportunity) return mutate(input, { type: "extend_reference_opportunity", opportunity: input.opportunity, evidence: input.evidence })
        return mutate(input, { type: "extend_reference", course: input.course, section: input.section, evidence: input.evidence })
      }
    },
    {
      name: "configure_view",
      description: "Create a safe block-based workspace view without arbitrary executable code.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), view: field("object", "Validated block view") }, ["expectedVersion", "idempotencyKey", "view"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "configure_view", view: input.view })
    },
    {
      name: "export_context",
      description: "Export the workspace as paged markdown for your context window. Sections: all, profile, goals, todos, scratchpad, plans, courses, clubs, activities, calendar, history. Follow nextCursor until it is absent; each page stays near five thousand characters. Pull this once at the start of a session instead of many small reads.",
      inputSchema: schema({ section: { type: "string", enum: ["all", "profile", "goals", "todos", "events", "scratchpad", "plans", "courses", "clubs", "activities", "calendar", "history"], description: "Section to export; defaults to all" }, cursor: field("number", "Page cursor returned by the previous call") }),
      annotations: annotations(true),
      examples: [{ section: "all" }],
      execute: async ({ section = "all", cursor = 0 }) => {
        const value = await workspace()
        const merged = mergedCatalogFor(value, repository.catalog)
        const blocks = exportBlocks(value, merged, mergedOpportunities(institutionForWorkspace(value).buildOpportunities(), value.referenceOverlay?.opportunities), section, now())
        const start = Number.isInteger(cursor) && cursor > 0 ? cursor : 0
        const page: string[] = []
        let size = 0
        let index = start
        while (index < blocks.length && size + blocks[index].length <= 5000) {
          page.push(blocks[index])
          size += blocks[index].length + 2
          index += 1
        }
        if (page.length === 0 && index < blocks.length) {
          page.push(blocks[index].slice(0, 5000))
          index += 1
        }
        return { workspaceVersion: value.version, section, markdown: page.join("\n\n"), nextCursor: index < blocks.length ? index : undefined }
      }
    },
    {
      name: "ingest_context",
      description: "Hand over existing context in bulk. Send freeform text or markdown; blank-line separated blocks become visible scratchpad notes, first line as the title. Twenty blocks per call; send the rest in follow-up calls. Use this for context the student gave you elsewhere so it lives where both of you can see it.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), text: field("string", "Freeform text or markdown to file"), tag: field("string", "Optional tag applied to every created note") }, ["expectedVersion", "idempotencyKey", "text"]),
      annotations: annotations(false, true),
      examples: [],
      execute: async (input) => {
        const blocks = String(input.text ?? "").split(/\n\s*\n/).map((block: string) => block.trim()).filter(Boolean)
        if (blocks.length === 0) return { ok: false, code: "COMMAND_INVALID", message: "Send some text to ingest." }
        const items = blocks.slice(0, 20).map((block: string) => {
          const lines = block.split("\n")
          const title = lines[0].replace(/^[#>*-]+\s*/, "").trim().slice(0, 80) || "Note"
          const summary = lines.slice(1).join("\n").trim().slice(0, 600)
          return { title, summary, tags: input.tag ? [String(input.tag)] : undefined }
        })
        const result = await mutate(input, { type: "ingest_context_items", items })
        if (result.ok && blocks.length > 20) return { ...result, note: `Filed 20 of ${blocks.length} blocks. Send the remaining ${blocks.length - 20} in another call with a new idempotency key.` }
        return result
      }
    },
    {
      name: "manage_todo",
      description: "Add, complete, or remove a visible todo. Todos with a due date appear on the calendar. Actions: add with a todo object, toggle or remove with a todoId.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), action: { type: "string", enum: ["add", "toggle", "remove"], description: "What to do" }, todo: { type: "object", additionalProperties: false, description: "For add", properties: { title: field("string", "Short imperative title"), detail: field("string", "Optional context"), due: field("string", "Optional due date, YYYY-MM-DD") }, required: ["title"] }, todoId: field("string", "For toggle and remove") }, ["expectedVersion", "idempotencyKey", "action"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "manage_todo", action: input.action, todo: input.todo, todoId: input.todoId })
    },
    {
      name: "set_interest",
      description: "Mark or unmark a course or a club as interesting. Interested clubs put their deadlines on the calendar; interested courses stay visible in the tracker until they are planned.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), kind: { type: "string", enum: ["course", "club"], description: "What the ID refers to" }, id: field("string", "Course ID or opportunity ID"), interested: field("boolean", "True to mark, false to clear") }, ["expectedVersion", "idempotencyKey", "kind", "id", "interested"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => input.kind === "course" ? mutate(input, { type: "set_course_interest", courseId: input.id, interested: input.interested }) : mutate(input, { type: "set_opportunity_interest", opportunityId: input.id, interested: input.interested })
    },
    {
      name: "annotate_course",
      description: "Attach a visible note to a course: workload impressions, instructor reputation, scheduling conflicts, anything worth remembering. Notes show who wrote them. Pass removeNoteId to delete one of yours.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), courseId: field("string", "Stable course ID"), text: field("string", "The note"), removeNoteId: field("string", "Note ID to remove instead of adding") }, ["expectedVersion", "idempotencyKey", "courseId"]),
      annotations: annotations(false, true),
      examples: [],
      execute: async (input) => mutate(input, { type: "annotate_course", courseId: input.courseId, note: input.text ? { text: input.text } : undefined, removeNoteId: input.removeNoteId })
    },
    {
      name: "manage_event",
      description: "Add, update, or remove a standalone calendar event: an interview, a flight, a review session. Events take a date, optional HH:MM start and end, an optional IANA timezone (campus Pacific time when omitted), and a description. Actions: add or update with an event object, remove with an eventId.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), action: { type: "string", enum: ["add", "update", "remove"], description: "What to do" }, event: { type: "object", additionalProperties: false, description: "For add and update; reuse an ID to update", properties: { id: field("string", "Stable ID; omit to create"), title: field("string", "Short event title"), description: field("string", "What this is and anything worth remembering"), date: field("string", "YYYY-MM-DD"), start: field("string", "24h HH:MM"), end: field("string", "24h HH:MM"), timezone: field("string", "IANA zone such as America/New_York") }, required: ["title", "date"] }, eventId: field("string", "For remove") }, ["expectedVersion", "idempotencyKey", "action"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => mutate(input, { type: "manage_event", action: input.action, event: input.event, eventId: input.eventId })
    },
    {
      name: "manage_activity",
      description: "Create or update an ongoing commitment outside the catalog: research with a professor, a job, athletics. A schedule of days and HH:MM times recurs on the calendar between startDate and endDate; dates lists one-off moments like an application deadline. Pass removeActivityId to delete.",
      inputSchema: schema({ expectedVersion: field("number", "Current workspace version"), idempotencyKey: field("string", "Unique retry-safe operation key"), activity: { type: "object", additionalProperties: false, description: "The activity to create or update; reuse an ID to update", properties: { id: field("string", "Stable ID; omit to create"), name: field("string", "Activity name"), kind: { type: "string", enum: ["research", "job", "volunteering", "athletics", "arts", "other"], description: "Activity kind" }, detail: field("string", "What the work is"), organizer: field("string", "Professor, group, or employer"), sourceUrl: field("string", "Related URL"), schedule: { type: "object", additionalProperties: false, description: "Recurring weekly block", properties: { days: field("array", "Days such as [\"tue\",\"thu\"]"), start: field("string", "HH:MM"), end: field("string", "HH:MM"), location: field("string", "Where") }, required: ["days", "start", "end"] }, startDate: field("string", "YYYY-MM-DD recurrence start"), endDate: field("string", "YYYY-MM-DD recurrence end"), dates: field("array", "One-off dates as {date, label}") }, required: ["name"] }, removeActivityId: field("string", "Activity ID to remove instead") }, ["expectedVersion", "idempotencyKey"]),
      annotations: annotations(false),
      examples: [],
      execute: async (input) => input.removeActivityId ? mutate(input, { type: "remove_activity", activityId: input.removeActivityId }) : input.activity ? mutate(input, { type: "upsert_activity", activity: input.activity }) : { ok: false, code: "COMMAND_INVALID", message: "Pass an activity to save or removeActivityId to delete." }
    }
  ]
}
