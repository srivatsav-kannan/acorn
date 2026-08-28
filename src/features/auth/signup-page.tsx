"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

// Signing up collects the account and the two facts the whole quarter map
// derives from. Stanford is the assumed base context for now; the timeline,
// WAYS, and language requirements come preloaded from it.
export const SignupPage = () => {
  const router = useRouter()
  const thisYear = useMemo(() => new Date().getFullYear(), [])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [entryYear, setEntryYear] = useState(thisYear)
  const [gradYear, setGradYear] = useState(thisYear + 4)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [confirmationNeeded, setConfirmationNeeded] = useState(false)
  const configured = isSupabaseConfigured()
  const entryYears = Array.from({ length: 8 }, (_, index) => thisYear + 1 - index)
  const gradYears = Array.from({ length: 8 }, (_, index) => entryYear + 1 + index)

  const changeEntryYear = (year: number) => {
    const length = gradYear - entryYear
    setEntryYear(year)
    setGradYear(year + (length > 0 && length <= 8 ? length : 4))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!configured) {
      setStatus("Account storage is not configured for this deployment.")
      return
    }
    if (name.trim().length < 1) { setStatus("Enter your name."); return }
    if (password.length < 8) { setStatus("Use a password of at least eight characters."); return }
    setBusy(true)
    setStatus("")
    const client = createCourseContextBrowserClient()
    const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } })
    if (error) {
      setStatus(error.message)
      setBusy(false)
      return
    }
    if (data.user && data.user.identities?.length === 0) {
      setStatus("An account with this email already exists. Log in instead.")
      setBusy(false)
      return
    }
    if (!data.session) {
      setConfirmationNeeded(true)
      setBusy(false)
      return
    }
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), institutionId: "INSTITUTION-STANFORD", entryYear, gradYear })
    })
    const result = await response.json() as { ok?: boolean, message?: string }
    if (!response.ok || !result.ok) {
      setStatus(result.message ?? "Your workspace could not be created. Log in to finish setup.")
      setBusy(false)
      return
    }
    router.push("/app")
    router.refresh()
  }

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/">Acorn<i aria-hidden="true">.</i></Link>
    <section className="auth-card">
      <header>
        <h1>Create your account</h1>
        <p>Your name and two dates set up the whole quarter map. Everything else gets added inside, by you or by your agent.</p>
      </header>
      {confirmationNeeded ? <div className="link-sent" role="status">
        <strong>Confirm your email</strong>
        <p>We sent a confirmation link to <b>{email}</b>. Open it, then log in to land in your workspace.</p>
        <Link className="text-button" href="/login">Go to login</Link>
      </div> : <form className="email-login-form" onSubmit={submit}>
        <label htmlFor="signup-name">Name</label>
        <input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required disabled={!configured} />
        <label htmlFor="signup-email">Email</label>
        <input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={!configured} />
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required disabled={!configured} />
        <div className="auth-year-row">
          <label htmlFor="signup-entry">Entered Stanford in autumn
            <select id="signup-entry" value={entryYear} onChange={(event) => changeEntryYear(Number(event.target.value))} disabled={!configured}>
              {entryYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label htmlFor="signup-grad">Graduating in spring
            <select id="signup-grad" value={gradYear} onChange={(event) => setGradYear(Number(event.target.value))} disabled={!configured}>
              {gradYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
        <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Creating your workspace…" : "Create account"}</button>
      </form>}
      {!configured && <div className="auth-setup-notice"><strong>Sign-up is unavailable</strong><span>This deployment is missing its account storage configuration.</span></div>}
      {status && <p className="auth-status" role="status">{status}</p>}
      <p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p>
    </section>
    <p className="auth-note">Acorn helps you plan; enrollment and anything official still go through Stanford&apos;s own systems.</p>
  </main>
}
