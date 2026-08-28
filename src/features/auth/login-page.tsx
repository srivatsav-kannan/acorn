"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = ({ initialStatus = "", demoAvailable = false, demoRequested = false, nextPath = "/app" }: { initialStatus?: string, demoAvailable?: boolean, demoRequested?: boolean, nextPath?: string }) => {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState(initialStatus)
  const [linkSentTo, setLinkSentTo] = useState("")
  const [busy, setBusy] = useState(false)
  const configured = isSupabaseConfigured()
  const googleEnabled = configured && process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH_ENABLED === "true"

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
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
    if (error) setStatus(error.message)
    else setLinkSentTo(email)
    setBusy(false)
  }

  const signInToDemo = async () => {
    setBusy(true)
    setStatus("")
    const response = await fetch("/api/auth/demo", { method: "POST" })
    const result = await response.json() as { ok?: boolean, message?: string }
    if (!response.ok || !result.ok) {
      setStatus(result.message ?? "Demo login is unavailable.")
      setBusy(false)
      return
    }
    router.replace("/app")
    router.refresh()
  }

  const demoLogin = demoAvailable && <section className={demoRequested ? "demo-login-card requested" : "demo-login-card"}>
    <div><strong>Shared demo account</strong><span>A filled workspace on shared credentials. Changes save to the server and reset on demand.</span></div>
    <button className={demoRequested ? "primary-button full" : "secondary-button full"} type="button" onClick={signInToDemo} disabled={busy}>{busy ? "Signing in…" : "Sign in with demo credentials"}</button>
  </section>

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/">CourseContext<i aria-hidden="true">.</i></Link>
    <section className="auth-card">
      <header>
        <h1>Sign in</h1>
        <p>One field for both directions: the link signs you in, and the first one creates your account.</p>
      </header>
      {demoRequested && demoLogin}
      {demoRequested && <div className="auth-divider"><span>Personal account</span></div>}
      <div className="auth-form-panel">
        {!configured && <div className="auth-setup-notice"><strong>Account sign-in is unavailable</strong><span>This deployment is missing its account storage configuration, so no one can sign in until it is restored.</span></div>}
        {linkSentTo ? <div className="link-sent" role="status">
          <strong>Check your inbox</strong>
          <p>A one-time sign-in link is on its way to <b>{linkSentTo}</b>. Opening it returns you here, signed in.</p>
          <button className="text-button" type="button" onClick={() => { setLinkSentTo(""); setEmail("") }}>Use a different email</button>
        </div> : <form className="email-login-form" onSubmit={sendEmailLink}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={!configured}/>
          <small>One-time link, no password.</small>
          <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Sending link…" : "Email me a sign-in link"}</button>
        </form>}
        {googleEnabled && !linkSentTo && <><div className="or"><span />or<span /></div><button className="google-button" type="button" onClick={continueWithGoogle} disabled={busy}><span aria-hidden="true">G</span>Continue with Google</button></>}
      </div>
      {!demoRequested && demoLogin}
      {status && <p className="auth-status" role="status">{status}</p>}
    </section>
    <p className="auth-note">CourseContext is a planning aid. It cannot enroll you or submit anything to your university.</p>
  </main>
}
