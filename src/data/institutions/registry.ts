import { stanfordInstitution } from "@/data/institutions/stanford"
import type { InstitutionPlaceholder, InstitutionReference } from "@/data/institutions/types"

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

export const listInstitutionChoices = () => [
  ...institutions.map((item) => ({ id: item.id, name: item.name, shortName: item.shortName, status: item.status as string, coverageNote: item.coverageNote })),
  ...plannedInstitutions.map((item) => ({ id: item.id, name: item.name, shortName: item.shortName, status: item.status as string, coverageNote: item.coverageNote }))
]
