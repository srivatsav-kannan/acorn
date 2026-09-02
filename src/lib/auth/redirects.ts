// A next= value may only name a path on this origin. Browsers read a
// backslash as a slash, so "/\\evil.com" would leave the site, and control
// characters can hide the same trick. Anything doubtful falls back to /app.
export const safeNextPath = (value: string | null) => {
  if (!value || !/^\/[^/\\]/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return "/app"
  try { return new URL(value, "https://acorn.invalid").origin === "https://acorn.invalid" ? value : "/app" }
  catch { return "/app" }
}
