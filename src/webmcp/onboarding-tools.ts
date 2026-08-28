/* eslint-disable @typescript-eslint/no-explicit-any */
import { CUSTOM_INSTITUTION_ID, listInstitutionChoices } from "@/data/institutions/registry"

// The onboarding page registers its own small tool surface so a student who
// already keeps their context with an agent never types it twice. The agent
// reads the form contract, submits the same fields the visible form submits,
// and the server applies identical validation for both paths.

type OnboardingSubmission = {
  name: string
  goal: string
  institutionId?: string
  customInstitution?: string
  academicHistory?: Record<string, unknown>
}

type SubmitResult = { ok: boolean, message?: string, workspaceId?: string }

type Setup = {
  submit: (input: OnboardingSubmission) => Promise<SubmitResult>
}

const field = (type: string, description: string) => ({ type, description })

export const createOnboardingTools = ({ submit }: Setup) => [
  {
    name: "get_onboarding_form",
    description: "Start here on the onboarding page. Returns supported institutions, the custom-institution beta path, and the exact fields create_workspace accepts.",
    inputSchema: { type: "object" as const, additionalProperties: false as const, properties: {}, required: [] as string[] },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    examples: [{}],
    execute: async () => ({
      institutions: listInstitutionChoices().map((choice) => ({ id: choice.id, name: choice.name, status: choice.status })),
      customPath: `Pass institutionId ${CUSTOM_INSTITUTION_ID} with customInstitution set to the school's name. The workspace then starts from a neutral template and you build its reference with extend_reference after creation. This path is a beta.`,
      fields: {
        name: "Preferred name, required, up to 80 characters",
        goal: "What the student wants help figuring out, required, in their own words, up to 1200 characters",
        institutionId: "One of the institution IDs above. Defaults to Stanford.",
        customInstitution: `University name, required only with ${CUSTOM_INSTITUTION_ID}`,
        academicHistory: "Optional. { classYear, completedCourses: [{courseId, grade?}], apCredits: [{exam, score?, unitsGranted?, satisfiesCourseIds?}] }"
      },
      afterCreation: "The page navigates into the workspace, where the full planning tool surface registers."
    })
  },
  {
    name: "create_workspace",
    description: "Create the student's workspace from onboarding. Ask the student for anything you do not already know rather than inventing it. Submits the same fields and validation as the visible form.",
    inputSchema: {
      type: "object" as const,
      additionalProperties: false as const,
      properties: {
        name: field("string", "The student's preferred name"),
        goal: field("string", "What the student wants help figuring out, in their own words"),
        institutionId: field("string", "Institution ID from get_onboarding_form"),
        customInstitution: field("string", "University name when using the custom institution ID"),
        academicHistory: {
          type: "object",
          additionalProperties: false,
          description: "Structured history the student already shared with you",
          properties: {
            classYear: field("string", "Class standing or expected graduation year"),
            completedCourses: field("array", "Completed courses as {courseId, grade?}. Use catalog IDs like COURSE-CS-106A."),
            apCredits: field("array", "AP or transfer credits as {exam, score?, unitsGranted?, satisfiesCourseIds?}")
          }
        }
      },
      required: ["name", "goal"]
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    examples: [],
    execute: async (input: any): Promise<SubmitResult> => {
      try {
        return await submit({ name: String(input.name ?? ""), goal: String(input.goal ?? ""), institutionId: input.institutionId, customInstitution: input.customInstitution, academicHistory: input.academicHistory })
      } catch (error) {
        return { ok: false, message: (error as Error).message }
      }
    }
  }
]
