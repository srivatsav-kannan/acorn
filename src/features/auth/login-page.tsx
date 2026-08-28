"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = ({ initialStatus = "" }: { initialStatus?: string }) => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const configured = isSupabaseConfigured()
  const googleEnabled = configured && process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH_ENABLED === "true"

  const redirectTo = () => `${window.location.origin}/auth/callback?next=/app`
  const requireConfiguration = () => {
    if (configured) return true
    setStatus("Account sign-in is not configured for this deployment.")
    return false
  }
  const continueWithGoogle = async () => {
    if (!requireConfiguration()) return
    setBusy(true)
    setStatus("")
    const { error } = await createCourseContextBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } })
    if (error) setStatus(error.message)
    setBusy(false)
  }
  const sendEmailLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!requireConfiguration()) return
    setBusy(true)
    setStatus("")
    const { error } = await createCourseContextBrowserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
    setStatus(error ? error.message : "Check your inbox. We sent a secure sign-in link that returns you to CourseContext.")
    setBusy(false)
  }

  return <main className="auth-page auth-rebuild">
    <Link className="wordmark auth-wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link>
    <section className="auth-shell">
      <aside className="auth-intro-panel">
        <p className="eyebrow">A workspace that remembers</p>
        <h1>Plan Stanford without rebuilding your context every time.</h1>
        <p>Your courses, questions, sources, and decisions stay together. You and your agent work from the same information.</p>
        <ul>
          <li><span>01</span><div><strong>Begin with your goal</strong><small>No major, schedule, or preferences are assumed.</small></div></li>
          <li><span>02</span><div><strong>Build at your pace</strong><small>Add only the details that become useful.</small></div></li>
          <li><span>03</span><div><strong>Keep control</strong><small>Every change is visible, editable, and recoverable.</small></div></li>
        </ul>
      </aside>
      <div className="auth-form-panel">
        <p className="eyebrow">Sign in or create an account</p>
        <h2>Continue with your email</h2>
        <p className="auth-form-intro">No password is needed. We will send a one-time link to your inbox.</p>
        {!configured && <div className="auth-setup-notice"><strong>Account sign-in is unavailable</strong><span>This deployment is not connected to account storage. You can still explore the resettable demo.</span></div>}
        <form className="email-login-form" onSubmit={sendEmailLink}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={!configured}/>
          <small>Use an inbox you can open on this device.</small>
          <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Sending link…" : "Email me a sign-in link"}</button>
        </form>
        {googleEnabled && <><div className="or"><span />or<span /></div><button className="google-button" type="button" onClick={continueWithGoogle} disabled={busy}><span aria-hidden="true">G</span>Continue with Google</button></>}
        {status && <p className="auth-status" role="status">{status}</p>}
        <div className="auth-demo-option"><span>Want to look around first?</span><a className="demo-link" href="/demo">Open the resettable demo</a></div>
      </div>
    </section>
    <p className="auth-note">Independent planning aid. CourseContext cannot enroll or submit forms for you.</p>
  </main>
}
