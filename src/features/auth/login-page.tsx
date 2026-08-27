"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = () => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  const redirectTo = () => `${window.location.origin}/auth/callback?next=/app`
  const requireConfiguration = () => {
    if (isSupabaseConfigured()) return true
    setStatus("Authentication is not configured in this local demo. Use the demo instead.")
    return false
  }
  const continueWithGoogle = async () => {
    if (!requireConfiguration()) return
    setBusy(true)
    const { error } = await createCourseContextBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } })
    if (error) setStatus(error.message)
    setBusy(false)
  }
  const sendEmailLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!requireConfiguration()) return
    setBusy(true)
    const { error } = await createCourseContextBrowserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
    setStatus(error ? error.message : "Check your email for a secure sign-in link.")
    setBusy(false)
  }

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link>
    <section className="auth-card"><p className="eyebrow">Welcome</p><h1>Build your academic workspace</h1><p>Sign in to keep plans, research, sources, and agent changes together.</p><button className="google-button" type="button" onClick={continueWithGoogle} disabled={busy}><span aria-hidden="true">G</span>Continue with Google</button><div className="or"><span />or<span /></div><form onSubmit={sendEmailLink}><label htmlFor="email">Email address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required/><button className="primary-button full" type="submit" disabled={busy}>Send email link</button></form>{status && <p className="auth-status" role="status">{status}</p>}<a className="demo-link" href="/demo">Use the demo instead</a></section>
    <p className="auth-note">Use your own email or open the resettable demo.</p>
  </main>
}
