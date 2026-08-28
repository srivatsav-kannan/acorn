import type { Catalog, Evidence, Program } from "@/domain/types"

export type InstitutionStatus = "full" | "planned"

export type InstitutionResource = {
  id: string
  title: string
  url: string
  note: string
  kind: "official" | "community"
}

export type InstitutionTerm = {
  id: string
  name: string
  startsOn: string
  endsOn: string
}

export type InstitutionReference = {
  id: string
  slug: string
  name: string
  shortName: string
  timezone: string
  termSystem: "quarter" | "semester"
  status: InstitutionStatus
  coverageNote: string
  currentTermId: string
  terms: InstitutionTerm[]
  buildCatalog: () => Catalog
  buildPrograms: () => Program[]
  buildEvidence: () => Evidence[]
  resources: InstitutionResource[]
}

export type InstitutionPlaceholder = {
  id: string
  slug: string
  name: string
  shortName: string
  termSystem: "quarter" | "semester"
  status: "planned"
  coverageNote: string
}
