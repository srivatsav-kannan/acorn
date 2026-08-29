import { buildStanfordCatalog, buildStanfordEvidence, buildStanfordPrograms, stanfordInstitution } from "@/data/institutions/stanford"
import { defaultSystemTodos } from "@/domain/evidence"
import type { Fixture, Meeting, WorkspaceState } from "@/domain/types"

export { buildStanfordCatalog, buildStanfordEvidence, buildStanfordPrograms }

const meeting = (days: Meeting["days"], start: string, end: string, type: Meeting["type"] = "lecture", location = "Main Quad"): Meeting => ({
  days,
  start,
  end,
  timezone: "America/Los_Angeles",
  type,
  location
})

export const buildFixture = (): Fixture => {
  const catalog = buildStanfordCatalog()
  const workspace: WorkspaceState = {
    id: "WORKSPACE-DEMO",
    ownerUserId: "USER-DEMO",
    version: 1,
    title: "Alex's academic workspace",
    institution: stanfordInstitution.name,
    institutionId: stanfordInstitution.id,
    currentTermId: "TERM-2026-AUTUMN",
    profile: {
      id: "PROFILE-DEMO",
      name: "Alex Chen",
      email: "alex@example.edu",
      isFictional: true,
      summary: "CS-first, design-aware planning with room for research and community.",
      catalogYear: "2026-27",
      classYear: "Sophomore",
      timeline: { entryTermId: "TERM-2025-AUTUMN", expectedGraduationTermId: "TERM-2029-SPRING", degree: "BS" },
      declaredProgramId: "PROGRAM-CS-BS",
      completedCourseIds: ["COURSE-CS-106A"],
      courseGrades: { "COURSE-CS-106A": "A" },
      residentCourseIds: ["COURSE-CS-106A"],
      preferences: [
        { id: "PREFERENCE-NO-FRIDAY", label: "Protect Friday research time", strength: "soft", value: true },
        { id: "PREFERENCE-DESIGN", label: "Include hands-on design", strength: "soft", value: true },
        { id: "PREFERENCE-RESEARCH", label: "Protect a research block", strength: "soft", value: true }
      ],
      excludedDays: ["sat"],
      earliestStart: "08:30",
      latestEnd: "18:00",
      transitionBufferMinutes: 15
    },
    plans: [{
      id: "PLAN-AUT26",
      title: "Autumn plan",
      termId: "TERM-2026-AUTUMN",
      activeScenarioId: "SCENARIO-PRIMARY",
      scenarios: [{
        id: "SCENARIO-PRIMARY",
        name: "Primary",
        unitLimit: 20,
        courses: [
          { id: "PLANCOURSE-CS-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" },
          { id: "PLANCOURSE-COMM-1", courseId: "COURSE-COMM-1", sectionId: "SECTION-COMM-1-01", units: 3, status: "active" },
          { id: "PLANCOURSE-DESIGN-60", courseId: "COURSE-DESIGN-60", sectionId: "SECTION-DESIGN-60-01", units: 2, status: "backup" },
          { id: "PLANCOURSE-MATH-51", courseId: "COURSE-MATH-51", sectionId: "SECTION-MATH-51-01", units: 5, status: "active" },
          { id: "PLANCOURSE-BACKUP-CS-147", courseId: "COURSE-CS-147", sectionId: "SECTION-CS-147-01", units: 4, status: "backup" }
        ],
        commitments: [{ id: "COMMITMENT-RESEARCH", title: "Research block", meetings: [meeting(["fri"], "14:00", "16:00", "commitment", "Research lab")] }]
      }, {
        id: "SCENARIO-LIGHTER",
        name: "Lighter option",
        unitLimit: 18,
        courses: [
          { id: "PLANCOURSE-LIGHT-CS-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" },
          { id: "PLANCOURSE-LIGHT-COMM-1", courseId: "COURSE-COMM-1", sectionId: "SECTION-COMM-1-01", units: 3, status: "active" },
          { id: "PLANCOURSE-LIGHT-MATH-51", courseId: "COURSE-MATH-51", sectionId: "SECTION-MATH-51-01", units: 5, status: "active" },
          { id: "PLANCOURSE-LIGHT-DESIGN-60", courseId: "COURSE-DESIGN-60", sectionId: "SECTION-DESIGN-60-01", units: 2, status: "backup" }
        ],
        commitments: [{ id: "COMMITMENT-LIGHT-RESEARCH", title: "Research block", meetings: [meeting(["fri"], "14:00", "16:00", "commitment", "Research lab")] }]
      }]
    }],
    programs: buildStanfordPrograms(),
    collections: [
      ["COLLECTION-INBOX", "Inbox"], ["COLLECTION-COURSES", "Courses"], ["COLLECTION-PROGRAMS", "Programs"],
      ["COLLECTION-PEOPLE", "People"], ["COLLECTION-CLUBS", "Clubs"], ["COLLECTION-RESEARCH", "Research"], ["COLLECTION-DECISIONS", "Decisions"]
    ].map(([id, name]) => ({ id, name, description: `${name} context` })),
    contextItems: [
      {
        id: "NOTE-001",
        type: "person",
        title: "Professor conversation",
        summary: "Ask a professor about research directions that connect HCI and health.",
        content: { text: "Prepare two specific questions before office hours." },
        collectionId: "COLLECTION-PEOPLE",
        sourceEvidenceIds: ["EVIDENCE-PROFESSOR-NOTE"],
        addedBy: { type: "agent", id: "AGENT-DEMO" },
        createdAt: "2026-08-25T12:00:00Z",
        updatedAt: "2026-08-25T12:00:00Z"
      },
      {
        id: "NOTE-002",
        type: "idea",
        title: "Health and HCI project",
        summary: "Explore a small project at the intersection of design and health.",
        content: { text: "Connect this idea to CS 147 and potential research groups." },
        collectionId: "COLLECTION-RESEARCH",
        addedBy: { type: "human", id: "USER-DEMO" },
        createdAt: "2026-08-24T12:00:00Z",
        updatedAt: "2026-08-24T12:00:00Z"
      }
    ],
    evidence: buildStanfordEvidence(),
    uncertainties: [{
      id: "UNCERTAINTY-LIVE-OFFERING",
      title: "Verify a live course offering",
      question: "Is the desired advanced interaction course still offered this term?",
      status: "open",
      relatedIds: ["COURSE-CS-147B"]
    }],
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
  return { workspace: structuredClone(workspace), catalog }
}

export const fixtureHash = (fixture: Fixture): string => {
  const input = JSON.stringify(fixture)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `FIXTURE-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
}
