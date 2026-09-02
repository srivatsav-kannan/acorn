import { CUSTOM_INSTITUTION_ID, customInstitution, getInstitution } from "@/data/institutions/registry"
import { defaultSystemTodos } from "@/domain/workspace/evidence"
import { validateAcademicHistoryPatch, applyAcademicHistory } from "@/domain/workspace/history"
import { defaultTimeline, termId } from "@/domain/planning/timeline"
import type { Collection, WorkspaceState } from "@/domain/workspace/types"

const personalCollections = (): Collection[] => [
  ["COLLECTION-INBOX", "Inbox", "Things to sort later"],
  ["COLLECTION-COURSES", "Courses", "Courses you want to remember"],
  ["COLLECTION-PROGRAMS", "Programs", "Major and minor research"],
  ["COLLECTION-PEOPLE", "People", "Professors, advisors, and people to contact"],
  ["COLLECTION-CLUBS", "Clubs", "Student groups and communities"],
  ["COLLECTION-RESEARCH", "Research", "Sources and findings saved for later"],
  ["COLLECTION-DECISIONS", "Decisions", "Choices, alternatives, and reasons"]
].map(([id, name, description]) => ({ id, name, description }))

type NewWorkspaceInput = {
  userId: string
  email: string
  name?: string
  goal?: string
  institutionId?: string
  customInstitutionName?: string
  entryYear?: number
  gradYear?: number
  academicHistory?: Record<string, unknown>
  id?: () => string
  now?: () => Date
}

export const buildPersonalWorkspace = ({ userId, email, name, goal, institutionId, customInstitutionName, entryYear, gradYear, id = () => crypto.randomUUID(), now = () => new Date() }: NewWorkspaceInput): WorkspaceState => {
  const customName = customInstitutionName?.trim()
  const institution = institutionId === CUSTOM_INSTITUTION_ID && customName ? customInstitution(customName) : getInstitution(institutionId)
  const cleanName = (name ?? "").trim()
  const firstName = cleanName.split(/\s+/)[0]
  const cleanGoal = (goal ?? "").trim()
  const timeline = entryYear
    ? { entryTermId: termId(entryYear, "AUTUMN"), expectedGraduationTermId: termId(gradYear && gradYear > entryYear ? gradYear : entryYear + 4, "SPRING"), degree: gradYear && gradYear - entryYear >= 5 ? "BS-MS" : "BS" }
    : defaultTimeline(now())
  const suffix = id().replaceAll("-", "").toUpperCase()

  return {
    id: `WORKSPACE-${suffix}`,
    ownerUserId: userId,
    version: 1,
    title: firstName ? `${firstName}'s ${institution.shortName} Workspace` : `${institution.shortName} Workspace`,
    institution: institution.name,
    institutionId: institution.id,
    currentTermId: institution.currentTermId,
    profile: {
      id: `PROFILE-${suffix}`,
      name: cleanName,
      email,
      isFictional: false,
      summary: cleanGoal,
      catalogYear: institution.slug === "custom" ? "Current" : "2026-27",
      timeline,
      declaredProgramId: null,
      completedCourseIds: [],
      courseGrades: {},
      residentCourseIds: [],
      preferences: [],
      excludedDays: [],
      earliestStart: "08:00",
      latestEnd: "19:00",
      transitionBufferMinutes: 0
    },
    plans: [{
      id: `PLAN-${suffix}`,
      title: institution.terms.find((term) => term.id === institution.currentTermId)?.name ?? "This term",
      termId: institution.currentTermId,
      activeScenarioId: `SCENARIO-START-${suffix}`,
      scenarios: [{
        id: `SCENARIO-START-${suffix}`,
        name: "My first plan",
        unitLimit: 20,
        courses: [],
        commitments: []
      }]
    }],
    programs: institution.buildPrograms(),
    collections: personalCollections(),
    // The goal lives once, in the profile summary the goals card renders.
    // Seeding it again as a scratchpad item made the same text appear twice,
    // once as a bare goal card with no milestone structure.
    contextItems: [],
    evidence: institution.buildEvidence().filter((item) => item.addedBy === "system"),
    uncertainties: [],
    savedViews: [],
    activity: [],
    receipts: [],
    undoSnapshots: {},
    referenceOverlay: { courses: [], sections: [] },
    todos: defaultSystemTodos(),
    events: [],
    interestedCourseIds: [],
    interestedOpportunityIds: [],
    courseNotes: {},
    activities: []
  }
}

export const buildPersonalWorkspaceWithHistory = (input: NewWorkspaceInput): WorkspaceState => {
  const workspace = buildPersonalWorkspace(input)
  if (input.academicHistory) {
    const patch = validateAcademicHistoryPatch(input.academicHistory)
    applyAcademicHistory(workspace.profile, patch)
  }
  return workspace
}
