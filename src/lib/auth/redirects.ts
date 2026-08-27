export const safeNextPath = (value: string | null) => value?.startsWith("/") && !value.startsWith("//") ? value : "/app"
