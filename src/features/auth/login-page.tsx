"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = ({ initialStatus = "" }: { initialStatus?: string }) => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const configured = isSupabaseConfigured()

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
    <section className="auth-card"><p className="eyebrow">Your academic workspace</p><h1>Sign in or create an account</h1><p>New accounts continue through a short planning setup. Returning students reopen the same private workspace.</p>{!configured && <div className="auth-setup-notice"><strong>Account storage needs setup</strong><span>This local build has no Supabase project connected yet. The resettable demo remains available.</span></div>}<button className="google-button" type="button" onClick={continueWithGoogle} disabled={busy || !configured}><span aria-hidden="true">G</span>Continue with Google</button><div className="or"><span />or<span /></div><form onSubmit={sendEmailLink}><label htmlFor="email">Email address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required disabled={!configured}/><button className="primary-button full" type="submit" disabled={busy || !configured}>{busy ? "Sending…" : "Continue with email"}</button></form><ul className="auth-benefits"><li><span>✓</span>One private workspace per account</li><li><span>✓</span>Changes persist across return visits</li><li><span>✓</span>No Stanford credentials requested</li></ul>{status && <p className="auth-status" role="status">{status}</p>}<a className="demo-link" href="/demo">Use the resettable demo</a></section>
    <p className="auth-note">CourseContext is an independent planning aid. It does not enroll you in courses.</p>
  </main>
}
