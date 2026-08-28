import { buildStanfordEvidence, buildStanfordPrograms } from "@/data/fixture"
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
  id?: () => string
  now?: () => Date
}

export const buildPersonalWorkspace = ({ userId, email, name, goal, id = () => crypto.randomUUID(), now = () => new Date() }: NewWorkspaceInput): WorkspaceState => {
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
    institution: "Stanford University",
    currentTermId: "TERM-2026-AUTUMN",
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
      id: `PLAN-AUT26-${suffix}`,
      title: "Autumn 2026",
      termId: "TERM-2026-AUTUMN",
      activeScenarioId: `SCENARIO-START-${suffix}`,
      scenarios: [{
        id: `SCENARIO-START-${suffix}`,
        name: "My first plan",
        unitLimit: 20,
        courses: [],
        commitments: []
      }]
    }],
    programs: buildStanfordPrograms(),
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
    evidence: buildStanfordEvidence().filter((item) => item.addedBy === "system"),
    uncertainties: [],
    savedViews: [],
    activity: [],
    receipts: [],
    undoSnapshots: {}
  }
}
