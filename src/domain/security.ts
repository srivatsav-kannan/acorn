const blockedHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0", "169.254.169.254", "::1"])

export const assertSafeExternalUrl = (value: string) => {
  let url: URL
  try { url = new URL(value) } catch { throw new Error("Invalid external URL") }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Unsafe external URL protocol")
  if (blockedHosts.has(url.hostname) || url.hostname.endsWith(".localhost")) throw new Error("Unsafe external URL host")
  return value
}
