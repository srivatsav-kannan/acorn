// Creates a fresh Acorn account through the real signup form, for test
// personas and demo preparation. Reports whether the account landed straight
// in the workspace or is waiting on an email confirmation.
//
//   node scripts/accounts/create-account.mjs --url http://127.0.0.1:3000 \
//     --name "Maya Torres" --email maya@example.com --password S3cret!pass \
//     --entry 2026 --grad 2030

import { chromium } from "@playwright/test"

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const base = arg("url", "http://127.0.0.1:3000")
const name = arg("name")
const email = arg("email")
const password = arg("password")
const entry = arg("entry", "2026")
const grad = arg("grad", "2030")
if (!name || !email || !password) {
  console.error("Required: --name, --email, --password")
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`${base}/signup`, { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => undefined)

let outcome = "unknown"
for (let attempt = 0; attempt < 3 && outcome === "unknown"; attempt++) {
  await page.fill("#signup-name", name)
  await page.fill("#signup-email", email)
  await page.fill("#signup-password", password)
  await page.selectOption("#signup-entry", entry)
  await page.selectOption("#signup-grad", grad)
  await page.click("button[type=submit]")
  const inApp = page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 20000 }).then(() => "in-app").catch(() => null)
  const confirm = page.waitForSelector("text=/confirm|check your email|verification/i", { timeout: 20000 }).then(() => "confirmation-required").catch(() => null)
  outcome = (await Promise.race([inApp, confirm])) ?? "unknown"
}

// A confirmation notice does not block password login on this project, but
// the signup page never reaches onboarding in that branch, so finish the
// workspace setup through the real login and onboarding forms.
if (outcome !== "in-app") {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle").catch(() => undefined)
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.fill("#email", email)
    await page.fill("#password", password)
    await page.click("button[type=submit]")
    const landed = await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 }).then(() => true).catch(() => false)
    if (landed) break
  }
  // Navigate to /onboarding explicitly: a client-side push to /app can flash
  // in the URL before the server bounces a workspace-less account back, so
  // the URL alone cannot be trusted here.
  await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle").catch(() => undefined)
  for (let attempt = 0; attempt < 3 && page.url().includes("/onboarding"); attempt++) {
    await page.fill(".onboarding-facts-card input[autocomplete=name]", name).catch(() => undefined)
    const selects = page.locator(".onboarding-facts-card select")
    await selects.nth(1).selectOption(entry).catch(() => undefined)
    await selects.nth(2).selectOption(grad).catch(() => undefined)
    await page.click(".onboarding-submit").catch(() => undefined)
    await page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 20000 }).catch(() => undefined)
  }
  // Server-verified: a fresh /app load only stays on /app with the shell
  // rendered when the workspace row truly persisted.
  await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle").catch(() => undefined)
  const shellVisible = await page.locator(".app-frame").first().isVisible().catch(() => false)
  outcome = page.url().includes("/app") && shellVisible ? "in-app" : outcome
}

if (outcome !== "in-app") {
  const text = await page.locator("main").innerText().catch(() => "")
  console.log(`RESULT: ${outcome}. Page says: ${text.slice(0, 300).replaceAll("\n", " ")}`)
} else {
  console.log(`RESULT: in-app for ${email}`)
}
await browser.close()
process.exit(outcome === "in-app" ? 0 : 1)
