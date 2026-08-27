export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export type Actor = { type: "human" | "agent" | "system", id: string }

export type Meeting = {
  days: Day[]
  start: string
  end: string
  timezone: string
  type: "lecture" | "section" | "lab" | "seminar" | "commitment"
  location?: string
}

export type Course = {
  id: string
  code: string
  title: string
  description: string
  subject: string
  level: number
  minUnits: number
  maxUnits: number
  prerequisites?: string[]
  prerequisiteUncertain?: boolean
  tags: string[]
}

export type Section = {
  id: string
  courseId: string
  termId: string
  sectionNumber: string
  instructor: string
  units: number
  meetings: Meeting[]
  final?: { start: string, end: string }
  evidenceIds: string[]
}

export type Catalog = { courses: Course[], sections: Section[] }

export type Evidence = {
  id: string
  title?: string
  classification: "official" | "experiential" | "student" | "derived"
  claim: string
  sourceUrl: string
  sourceTitle: string
  retrievedAt: string
  expiresAt?: string
  confidence: number
  status: "current" | "stale" | "superseded"
  addedBy: "human" | "agent" | "system"
  untrustedExternalContent: boolean
  authority?: "catalog" | "term_schedule" | "program_requirements" | "experiential"
}

export type Preference = {
  id: string
  label: string
  strength: "hard" | "soft"
  value: unknown
}

export type StudentProfile = {
  id: string
  name: string
  email: string
  isFictional: boolean
  summary: string
  catalogYear: string
  declaredProgramId: string | null
  completedCourseIds: string[]
  courseGrades: Record<string, string>
  residentCourseIds: string[]
  preferences: Preference[]
  excludedDays: Day[]
  earliestStart: string
  latestEnd: string
  transitionBufferMinutes: number
}

export type PlanCourse = {
  id: string
  courseId: string
  sectionId: string | null
  units: number
  status: "active" | "backup"
}

export type Commitment = {
  id: string
  title: string
  meetings: Meeting[]
}

export type PlanScenario = {
  id: string
  name: string
  unitLimit: number
  courses: PlanCourse[]
  commitments: Commitment[]
}

export type Plan = {
  id: string
  title: string
  termId: string
  scenarios: PlanScenario[]
  activeScenarioId: string
}

type RuleBase = { id?: string, title?: string }

export type RequirementRule = RuleBase & (
  | { type: "course", courseId: string }
  | { type: "any_of", rules: RequirementRule[] }
  | { type: "all_of", rules: RequirementRule[] }
  | { type: "choose_n", count: number, rules: RequirementRule[] }
  | { type: "course_group", courseIds: string[], count: number }
  | { type: "minimum_units", units: number, courseIds: string[] }
  | { type: "minimum_grade", courseId: string, grade: string }
  | { type: "residency", count: number, courseIds: string[] }
  | { type: "manual_review", reason: string }
)

export type ProgramRequirement = {
  id: string
  title: string
  rule: RequirementRule
  evidenceIds: string[]
}

export type Program = {
  id: string
  name: string
  credential: string
  catalogYear: string
  sourceUrl: string
  requirements: ProgramRequirement[]
}

export type ContextType = "note" | "document" | "idea" | "question" | "task" | "link" | "source" | "claim" | "decision" | "person" | "organization" | "club" | "commitment" | "preference" | "goal" | "constraint" | "uncertainty" | "scratch_document"

export type ContextItem = {
  id: string
  type: ContextType
  title: string
  summary: string
  content: Record<string, unknown>
  collectionId: string
  sourceEvidenceIds?: string[]
  addedBy?: Actor
  createdAt?: string
  updatedAt?: string
  archived?: boolean
}

export type Collection = { id: string, name: string, description: string }

export type Uncertainty = {
  id: string
  title: string
  question: string
  status: "open" | "resolved"
  relatedIds: string[]
}

export type SavedViewBlock = {
  id?: string
  type: "plan_summary" | "weekly_schedule" | "course_list" | "course_comparison" | "requirement_progress" | "checklist" | "task_list" | "source_list" | "decision_table" | "document" | "collection" | "recent_activity" | "open_questions"
  title?: string
  query?: { workspaceId?: string, collectionId?: string, termId?: string }
  content?: string
}

export type SavedView = {
  id: string
  workspaceId?: string
  title: string
  layout: "one_column" | "two_column"
  blocks: SavedViewBlock[]
}

export type ChangedEntity = { type: string, id: string }

export type ActionReceipt = {
  ok: boolean
  receiptId: string
  workspaceVersion: number
  changed: ChangedEntity[]
  undoAvailable: boolean
  actor: Actor
  code?: string
  message?: string
  visibleChange?: boolean
  primaryVisibleId?: string
}

export type ActivityEntry = {
  id: string
  receiptId: string
  actor: Actor
  summary: string
  changed: ChangedEntity[]
  createdAt: string
  undoAvailable: boolean
  undoneAt?: string
}

export type WorkspaceState = {
  id: string
  ownerUserId: string
  version: number
  title: string
  institution: string
  currentTermId: string
  profile: StudentProfile
  plans: Plan[]
  programs: Program[]
  collections: Collection[]
  contextItems: ContextItem[]
  evidence: Evidence[]
  uncertainties: Uncertainty[]
  savedViews: SavedView[]
  activity: ActivityEntry[]
  receipts: ActionReceipt[]
  undoSnapshots: Record<string, WorkspaceState>
}

export type Fixture = { workspace: WorkspaceState, catalog: Catalog }
