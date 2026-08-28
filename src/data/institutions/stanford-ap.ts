// Stanford's AP credit chart as deterministic form options. Exams, accepted
// scores, default units, and course equivalencies are picked from lists, never
// typed. Defaults follow the published chart; the units stay editable because
// credit reports occasionally differ. Exams Stanford grants nothing for are
// still listed so a student can record them honestly.
export type ApGrant = { score: number, units: number, satisfiesCodes: string[] }
export type ApExamPreset = { exam: string, grants: ApGrant[] }

const language = (exam: string): ApExamPreset => ({
  exam,
  grants: [
    { score: 5, units: 10, satisfiesCodes: [] },
    { score: 4, units: 10, satisfiesCodes: [] }
  ]
})

export const apExamPresets: ApExamPreset[] = [
  {
    exam: "AP Calculus AB",
    grants: [
      { score: 5, units: 10, satisfiesCodes: ["MATH 19", "MATH 20"] },
      { score: 4, units: 10, satisfiesCodes: ["MATH 19", "MATH 20"] }
    ]
  },
  {
    exam: "AP Calculus BC",
    grants: [
      { score: 5, units: 10, satisfiesCodes: ["MATH 19", "MATH 20", "MATH 21"] },
      { score: 4, units: 10, satisfiesCodes: ["MATH 19", "MATH 20"] }
    ]
  },
  {
    exam: "AP Chemistry",
    grants: [{ score: 5, units: 10, satisfiesCodes: ["CHEM 31A", "CHEM 31B"] }]
  },
  {
    exam: "AP Physics C: Mechanics",
    grants: [
      { score: 5, units: 4, satisfiesCodes: ["PHYSICS 41"] },
      { score: 4, units: 4, satisfiesCodes: ["PHYSICS 41"] }
    ]
  },
  {
    exam: "AP Physics C: Electricity and Magnetism",
    grants: [
      { score: 5, units: 4, satisfiesCodes: ["PHYSICS 43"] },
      { score: 4, units: 4, satisfiesCodes: ["PHYSICS 43"] }
    ]
  },
  {
    exam: "AP Biology",
    grants: [{ score: 5, units: 10, satisfiesCodes: [] }]
  },
  language("AP Chinese Language and Culture"),
  language("AP French Language and Culture"),
  language("AP German Language and Culture"),
  language("AP Italian Language and Culture"),
  language("AP Japanese Language and Culture"),
  language("AP Spanish Language and Culture"),
  language("AP Latin"),
  { exam: "AP Computer Science A", grants: [] },
  { exam: "AP Physics 1", grants: [] },
  { exam: "AP Physics 2", grants: [] },
  { exam: "AP Statistics", grants: [] },
  { exam: "AP English Language and Composition", grants: [] },
  { exam: "AP English Literature and Composition", grants: [] },
  { exam: "AP United States History", grants: [] },
  { exam: "AP World History", grants: [] },
  { exam: "AP Macroeconomics", grants: [] },
  { exam: "AP Microeconomics", grants: [] },
  { exam: "AP Psychology", grants: [] },
  { exam: "AP Environmental Science", grants: [] }
]

export const apPresetFor = (exam: string): ApExamPreset | undefined => apExamPresets.find((preset) => preset.exam === exam)

export const apGrantFor = (exam: string, score: number): ApGrant | null =>
  apPresetFor(exam)?.grants.find((grant) => grant.score === score) ?? null

export const apScoreChoices = [5, 4, 3, 2, 1]

export const apUnitChoices = [0, 2, 3, 4, 5, 8, 10]
