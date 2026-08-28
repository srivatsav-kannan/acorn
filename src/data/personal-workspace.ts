import { getInstitution } from "@/data/institutions/registry"
import type { Collection, WorkspaceState } from "@/domain/types"

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
  name: string
  goal: string
  institutionId?: string
  id?: () => string
  now?: () => Date
}

export const buildPersonalWorkspace = ({ userId, email, name, goal, institutionId, id = () => crypto.randomUUID(), now = () => new Date() }: NewWorkspaceInput): WorkspaceState => {
  const institution = getInstitution(institutionId)
  const cleanName = name.trim()
  const cleanGoal = goal.trim()
  const suffix = id().replaceAll("-", "").toUpperCase()
  const createdAt = now().toISOString()
  const goalId = `GOAL-${suffix}`

  return {
    id: `WORKSPACE-${suffix}`,
    ownerUserId: userId,
    version: 1,
    title: `${cleanName}'s workspace`,
    institution: institution.name,
    institutionId: institution.id,
    currentTermId: institution.currentTermId,
    profile: {
      id: `PROFILE-${suffix}`,
      name: cleanName,
      email,
      isFictional: false,
      summary: cleanGoal,
      catalogYear: "2026-27",
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
    contextItems: [{
      id: goalId,
      type: "goal",
      title: "What I want help with",
      summary: cleanGoal,
      content: { text: cleanGoal },
      collectionId: "COLLECTION-INBOX",
      addedBy: { type: "human", id: userId },
      createdAt,
      updatedAt: createdAt
    }],
    evidence: institution.buildEvidence().filter((item) => item.addedBy === "system"),
    uncertainties: [],
    savedViews: [],
    activity: [],
    receipts: [],
    undoSnapshots: {},
    referenceOverlay: { courses: [], sections: [] }
  }
}
