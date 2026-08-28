const demoEmail = "demo@coursecontext.app"

export const getDemoAccountConfig = () => ({
  email: process.env.COURSE_CONTEXT_DEMO_EMAIL?.trim() ?? "",
  password: process.env.COURSE_CONTEXT_DEMO_PASSWORD ?? ""
})

export const isDemoAccountConfigured = () => {
  const config = getDemoAccountConfig()
  return config.email.toLowerCase() === demoEmail && config.password.length >= 8
}

export const isDemoAccountEmail = (email: string | null | undefined) => email?.toLowerCase() === demoEmail

export const demoAccountEmail = demoEmail
