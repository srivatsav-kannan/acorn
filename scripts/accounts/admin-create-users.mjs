// Creates already-confirmed auth users straight through the Supabase admin
// API, so test personas never trigger a confirmation email. Reads the
// service role key from .env.local and never prints it.
//
//   node scripts/accounts/admin-create-users.mjs user@example.com Password123 [more pairs...]

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const env = (() => {
  const parsed = {}
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) parsed[match[1]] = match[2].replace(/^"|"$/g, "")
  }
  return parsed
})()

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

const pairs = []
for (let i = 2; i + 1 < process.argv.length; i += 2) pairs.push([process.argv[i], process.argv[i + 1]])
if (!pairs.length) {
  console.error("Usage: node scripts/accounts/admin-create-users.mjs email password [email password ...]")
  process.exit(1)
}

const findByEmail = async (email) => {
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=50`, { headers })
    if (!res.ok) return null
    const body = await res.json()
    const hit = (body.users ?? []).find((u) => u.email === email)
    if (hit) return hit
    if ((body.users ?? []).length < 50) return null
  }
  return null
}

let failed = false
for (const [email, password] of pairs) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (res.ok) {
    const user = await res.json()
    console.log(`CREATED ${email} id=${user.id} confirmed=${Boolean(user.email_confirmed_at)}`)
    continue
  }
  const detail = await res.text()
  if (res.status === 422 || detail.includes("already")) {
    const existing = await findByEmail(email)
    if (!existing) {
      console.error(`EXISTS but not found by listing: ${email}`)
      failed = true
      continue
    }
    const put = await fetch(`${url}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password, email_confirm: true }),
    })
    if (put.ok) {
      const user = await put.json()
      console.log(`UPDATED ${email} id=${user.id} confirmed=${Boolean(user.email_confirmed_at)}`)
    } else {
      console.error(`UPDATE FAILED ${email}: ${put.status} ${(await put.text()).slice(0, 200)}`)
      failed = true
    }
    continue
  }
  console.error(`CREATE FAILED ${email}: ${res.status} ${detail.slice(0, 200)}`)
  failed = true
}
process.exit(failed ? 1 : 0)
