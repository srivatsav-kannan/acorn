// Finishes workspace setup for an auth user that already exists (for example
// one minted through the admin API): password login, then the onboarding
// form. Never visits the signup page, so no auth email can ever fire.
//
//   node scripts/accounts/onboard-account.mjs --url http://127.0.0.1:3000 \
//     --name "Dev Shah" --email dev@example.com --password S3cret!pass \
//     --entry 2024 --grad 2028

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

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => undefined)
let landed = false
for (let attempt = 0; attempt < 4 && !landed; attempt++) {
  await page.fill("#email", email).catch(() => undefined)
  await page.fill("#password", password).catch(() => undefined)
  await page.click("button[type=submit]").catch(() => undefined)
  landed = await page
    .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 })
    .then(() => true)
    .catch(() => false)
}
if (!landed) {
  const text = await page.locator("main").innerText().catch(() => "")
  console.log(`RESULT: login-failed for ${email}. Page says: ${text.slice(0, 240).replaceAll("\n", " ")}`)
  await browser.close()
  process.exit(1)
}

// A client-side push to /app can flash in the URL before the server bounces
// a workspace-less account back to /onboarding, so navigate there directly
// and let the server route us: it lands on /onboarding until the workspace
// truly exists.
await page.goto(`${base}/onboarding`, { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => undefined)
for (let attempt = 0; attempt < 3 && page.url().includes("/onboarding"); attempt++) {
  await page.fill(".onboarding-facts-card input[autocomplete=name]", name).catch(() => undefined)
  const selects = page.locator(".onboarding-facts-card select")
  await selects.nth(1).selectOption(entry).catch(() => undefined)
  await selects.nth(2).selectOption(grad).catch(() => undefined)
  await page.click(".onboarding-submit").catch(() => undefined)
  await page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 20000 }).catch(() => undefined)
  const error = await page.locator(".onboarding-error").innerText().catch(() => "")
  if (error) console.log(`onboarding error (attempt ${attempt + 1}): ${error}`)
}

// Server-verified check: a fresh full load of /app only stays on /app when
// the workspace row is actually persisted.
await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" })
await page.waitForLoadState("networkidle").catch(() => undefined)
const shellVisible = await page.locator(".app-frame").first().isVisible().catch(() => false)
const outcome = page.url().includes("/app") && shellVisible ? "in-app" : `stuck at ${new URL(page.url()).pathname}`
console.log(`RESULT: ${outcome} for ${email}`)
await browser.close()
process.exit(outcome === "in-app" ? 0 : 1)
