import { stanfordInstitution } from "@/data/institutions/stanford"
import type { InstitutionPlaceholder, InstitutionReference } from "@/data/institutions/types"
import type { WorkspaceState } from "@/domain/types"

export const CUSTOM_INSTITUTION_ID = "INSTITUTION-CUSTOM"

export const institutions: InstitutionReference[] = [stanfordInstitution]

// Universities the reference layer is designed to hold next. Each ships as an
// adapter that maps public catalog data into the same course, section, program,
// and evidence model Stanford uses. Until an adapter lands, a student at one of
// these schools can still work here: their agent supplies missing reference
// through the extend_reference tool, visibly and with sources.
export const plannedInstitutions: InstitutionPlaceholder[] = [
  { id: "INSTITUTION-BERKELEY", slug: "berkeley", name: "University of California, Berkeley", shortName: "UC Berkeley", termSystem: "semester", status: "planned", coverageNote: "Adapter planned. The Berkeley Academic Guide and class schedule are public and map cleanly onto this reference model." },
  { id: "INSTITUTION-MIT", slug: "mit", name: "Massachusetts Institute of Technology", shortName: "MIT", termSystem: "semester", status: "planned", coverageNote: "Adapter planned. The MIT subject listing and degree charts are public and map cleanly onto this reference model." },
  { id: "INSTITUTION-WASHINGTON", slug: "washington", name: "University of Washington", shortName: "UW", termSystem: "quarter", status: "planned", coverageNote: "Adapter planned. UW shares Stanford's quarter calendar shape, so the planning engine applies without change." },
  { id: "INSTITUTION-MICHIGAN", slug: "michigan", name: "University of Michigan", shortName: "Michigan", termSystem: "semester", status: "planned", coverageNote: "Adapter planned. The public LSA course guide and program requirement pages provide the needed source material." }
]

export const getInstitution = (idOrSlug: string | null | undefined): InstitutionReference =>
  institutions.find((item) => item.id === idOrSlug || item.slug === idOrSlug) ?? stanfordInstitution

// A custom institution is a neutral template for schools without a shipped
// adapter. It starts with no catalog, programs, or resources. The student's
// agent constructs the reference through extend_reference, course by course
// and program by program, always with sources. This path is a beta.
export const customInstitution = (name: string): InstitutionReference => ({
  id: CUSTOM_INSTITUTION_ID,
  slug: "custom",
  name,
  shortName: name,
  timezone: "America/Los_Angeles",
  termSystem: "semester",
  status: "full",
  coverageNote: `No shipped reference pack for ${name} yet. Your agent builds the catalog and program reference with official sources, and everything it adds stays visible and removable.`,
  currentTermId: "TERM-CURRENT",
  terms: [{ id: "TERM-CURRENT", name: "Current term", startsOn: "", endsOn: "" }],
  buildCatalog: () => ({ courses: [], sections: [] }),
  buildPrograms: () => [],
  buildEvidence: () => [],
  buildOpportunities: () => [],
  resources: []
})

export const isCustomInstitution = (workspace: Pick<WorkspaceState, "institutionId">) => workspace.institutionId === CUSTOM_INSTITUTION_ID

export const institutionForWorkspace = (workspace: Pick<WorkspaceState, "institutionId" | "institution">): InstitutionReference =>
  isCustomInstitution(workspace) ? customInstitution(workspace.institution) : getInstitution(workspace.institutionId)

export const listInstitutionChoices = () => [
  ...institutions.map((item) => ({ id: item.id, name: item.name, shortName: item.shortName, status: item.status as string, coverageNote: item.coverageNote })),
  ...plannedInstitutions.map((item) => ({ id: item.id, name: item.name, shortName: item.shortName, status: item.status as string, coverageNote: item.coverageNote })),
  { id: CUSTOM_INSTITUTION_ID, name: "Another university", shortName: "Other", status: "custom", coverageNote: "Beta. Name your school and let your agent research and build its reference pack with sources." }
]
