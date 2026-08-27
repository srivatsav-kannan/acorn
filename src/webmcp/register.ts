type Registration = { unregister?: () => void }
type BrowserDocument = { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => Registration | Promise<Registration | void> | void } }

export const registerWebMcpTools = (documentLike: BrowserDocument, tools: unknown[]) => {
  const registrations: Registration[] = []
  const controller = new AbortController()
  if (documentLike.modelContext?.registerTool) {
    for (const tool of tools) {
      const registration = documentLike.modelContext.registerTool(tool, { signal: controller.signal })
      if (registration && "then" in registration) {
        void registration.then((resolved) => {
          if (resolved) registrations.push(resolved)
        }).catch((error: unknown) => {
          if (!controller.signal.aborted) console.error("WebMCP tool registration failed", error)
        })
      } else if (registration) registrations.push(registration)
    }
  }
  return () => {
    controller.abort()
    registrations.forEach((registration) => registration.unregister?.())
  }
}
