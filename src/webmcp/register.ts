type Registration = { unregister?: () => void }
type BrowserDocument = { modelContext?: { registerTool: (tool: unknown) => Registration | void } }

export const registerWebMcpTools = (documentLike: BrowserDocument, tools: unknown[]) => {
  const registrations: Registration[] = []
  if (documentLike.modelContext?.registerTool) {
    for (const tool of tools) {
      const registration = documentLike.modelContext.registerTool(tool)
      if (registration) registrations.push(registration)
    }
  }
  return () => registrations.forEach((registration) => registration.unregister?.())
}
