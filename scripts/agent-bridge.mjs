// Acorn agent bridge. Launches a Chromium that exposes document.modelContext
// before the app loads, signs into the workspace, and then serves every tool
// the page registered over a local HTTP port. That gives any terminal, script,
// or agent a working WebMCP connection to Acorn without waiting on a browser
// that ships the API natively.
//
//   node scripts/agent-bridge.mjs [--url http://127.0.0.1:3000/app] [--control 4571] [--headless]
//
//   GET  /tools                          lists the registered tools
//   POST /call        {"tool": "...", "input": {...}}
//   POST /goto        {"path": "/calendar"}
//   POST /screenshot  {"path": "shot.png"}
//
// Login credentials come from COURSE_CONTEXT_DEMO_EMAIL and
// COURSE_CONTEXT_DEMO_PASSWORD, read from the environment or .env.local, and
// are only used if the app presents its login form.

import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const appUrl = arg("url", "http://127.0.0.1:3000/app")
const controlPort = Number(arg("control", "4571"))
const headless = process.argv.includes("--headless")

const envLocal = (() => {
  try {
    const parsed = {}
    for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match) parsed[match[1]] = match[2].replace(/^"|"$/g, "")
    }
    return parsed
  } catch {
    return {}
  }
})()

const email = process.env.COURSE_CONTEXT_DEMO_EMAIL ?? envLocal.COURSE_CONTEXT_DEMO_EMAIL
const password = process.env.COURSE_CONTEXT_DEMO_PASSWORD ?? envLocal.COURSE_CONTEXT_DEMO_PASSWORD

const launch = async () => {
  try {
    return await chromium.launch({ headless })
  } catch (error) {
    if (headless) throw error
    console.log("Headed launch failed, retrying headless:", error.message)
    return chromium.launch({ headless: true })
  }
}

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

// The app registers its tools during mount only if document.modelContext is
// already present, so the receiver has to exist before any page script runs.
await page.addInitScript(() => {
  window.__acornToolRegistry = new Map()
  document.modelContext = {
    registerTool: (tool) => {
      window.__acornToolRegistry.set(tool.name, tool)
      return { unregister: () => window.__acornToolRegistry.delete(tool.name) }
    }
  }
})

console.log(`Opening ${appUrl}`)
await page.goto(appUrl, { waitUntil: "domcontentloaded" })

if (await page.locator("#email").count()) {
  if (!email || !password) {
    console.error("The app asked for a login and no COURSE_CONTEXT_DEMO_EMAIL or COURSE_CONTEXT_DEMO_PASSWORD is set.")
    await browser.close()
    process.exit(1)
  }
  console.log(`Logging in as ${email}`)
  // The form is React controlled, so a fill that lands before hydration leaves
  // the component state empty and the submit goes nowhere. Waiting for the
  // network to settle and retrying until the URL changes covers cold dev
  // servers that hydrate slowly.
  await page.waitForLoadState("networkidle").catch(() => undefined)
  let signedIn = false
  for (let attempt = 0; attempt < 4 && !signedIn; attempt++) {
    await page.fill("#email", email)
    await page.fill("#password", password)
    await page.click("button[type=submit]")
    signedIn = await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 }).then(() => true).catch(() => false)
    if (!signedIn) console.log(`Login attempt ${attempt + 1} did not leave the login page, retrying`)
  }
  if (!signedIn) {
    console.error(`Login as ${email} failed. Page says: ${(await page.locator("main").innerText().catch(() => "")).slice(0, 300)}`)
    await browser.close()
    process.exit(1)
  }
}

await page.waitForFunction(() => window.__acornToolRegistry && window.__acornToolRegistry.size > 0, undefined, { timeout: 120000 }).catch(async () => {
  console.error(`No tools registered. Current URL: ${page.url()}`)
  console.error(`Page says: ${(await page.locator("body").innerText().catch(() => "")).slice(0, 300)}`)
  await browser.close()
  process.exit(1)
})
const toolNames = await page.evaluate(() => [...window.__acornToolRegistry.keys()])
console.log(`Connected. ${toolNames.length} tools registered on the page:`)
console.log(`  ${toolNames.join(", ")}`)

const listTools = () => page.evaluate(() => [...window.__acornToolRegistry.values()].map((tool) => ({
  name: tool.name,
  readOnly: tool.annotations?.readOnlyHint ?? false,
  description: tool.description
})))

const callTool = (tool, input) => page.evaluate(async ({ tool, input }) => {
  const entry = window.__acornToolRegistry.get(tool)
  if (!entry) return { ok: false, error: `No tool named ${tool} is registered. Call GET /tools for the list.` }
  try {
    const result = await entry.execute(input ?? {})
    return { ok: true, result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}, { tool, input })

const readBody = (request) => new Promise((resolveBody, rejectBody) => {
  let data = ""
  request.on("data", (chunk) => { data += chunk })
  request.on("end", () => {
    try { resolveBody(data ? JSON.parse(data) : {}) } catch (error) { rejectBody(error) }
  })
  request.on("error", rejectBody)
})

const respond = (response, status, payload) => {
  const body = JSON.stringify(payload, null, 2)
  response.writeHead(status, { "content-type": "application/json" })
  response.end(body)
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && (request.url === "/" || request.url === "/tools")) {
      return respond(response, 200, { url: appUrl, tools: await listTools() })
    }
    if (request.method === "POST" && request.url === "/call") {
      const { tool, input } = await readBody(request)
      if (!tool) return respond(response, 400, { ok: false, error: "Send {\"tool\": \"name\", \"input\": {...}}." })
      const started = Date.now()
      const outcome = await Promise.race([
        callTool(tool, input),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tool call timed out after 60 seconds")), 60000))
      ])
      console.log(`${tool} ${outcome.ok ? "ok" : "error"} in ${Date.now() - started}ms`)
      return respond(response, outcome.ok ? 200 : 422, outcome)
    }
    if (request.method === "POST" && request.url === "/goto") {
      const { path = "/app" } = await readBody(request)
      const destination = new URL(path, appUrl).toString()
      await page.goto(destination, { waitUntil: "domcontentloaded" })
      await page.waitForFunction(() => window.__acornToolRegistry && window.__acornToolRegistry.size > 0, undefined, { timeout: 60000 })
      return respond(response, 200, { ok: true, url: page.url() })
    }
    if (request.method === "POST" && request.url === "/screenshot") {
      const { path = "agent-bridge.png" } = await readBody(request)
      const target = resolve(process.cwd(), path)
      await page.screenshot({ path: target, fullPage: false })
      return respond(response, 200, { ok: true, path: target })
    }
    respond(response, 404, { ok: false, error: "Routes: GET /tools, POST /call, POST /screenshot." })
  } catch (error) {
    respond(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(controlPort, "127.0.0.1", () => {
  console.log(`Bridge ready on http://127.0.0.1:${controlPort}`)
  console.log(`  curl http://127.0.0.1:${controlPort}/tools`)
  console.log(`  curl -X POST http://127.0.0.1:${controlPort}/call -d '{"tool": "get_planning_context"}'`)
})

const shutdown = async () => {
  server.close()
  await browser.close()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
