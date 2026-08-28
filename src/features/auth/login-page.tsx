"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = ({ initialStatus = "", demoAvailable = false, demoRequested = false, localAvailable = false, nextPath = "/app" }: { initialStatus?: string, demoAvailable?: boolean, demoRequested?: boolean, localAvailable?: boolean, nextPath?: string }) => {
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
    <div><strong>Demo account</strong><span>Sign in with the shared demo credentials. Changes are saved to the server.</span></div>
    <button className={demoRequested ? "primary-button full" : "secondary-button full"} type="button" onClick={signInToDemo} disabled={busy}>{busy ? "Signing in…" : "Sign in with demo credentials"}</button>
  </section>

  return <main className="auth-page auth-simple">
    <Link className="wordmark auth-wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link>
    <section className="auth-card">
      <header>
        <h1>Sign in</h1>
        <p>Use your email, or sign in with the shared demo account.</p>
      </header>
      {demoRequested && demoLogin}
      {demoRequested && <div className="auth-divider"><span>Personal account</span></div>}
      <div className="auth-form-panel">
        {!configured && <div className="auth-setup-notice"><strong>Account sign-in is unavailable</strong><span>This deployment is not connected to account storage.</span></div>}
        {linkSentTo ? <div className="link-sent" role="status">
          <span className="link-sent-mark" aria-hidden="true">✓</span>
          <strong>Check your inbox</strong>
          <p>We sent a one-time sign-in link to <b>{linkSentTo}</b>. Opening it returns you here, signed in.</p>
          <button className="text-button" type="button" onClick={() => { setLinkSentTo(""); setEmail("") }}>Use a different email</button>
        </div> : <form className="email-login-form" onSubmit={sendEmailLink}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={!configured}/>
          <small>We will send a one-time sign-in link. No password needed.</small>
          <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Sending link…" : "Email me a sign-in link"}</button>
        </form>}
        {googleEnabled && !linkSentTo && <><div className="or"><span />or<span /></div><button className="google-button" type="button" onClick={continueWithGoogle} disabled={busy}><span aria-hidden="true">G</span>Continue with Google</button></>}
      </div>
      {!demoRequested && demoLogin}
      {localAvailable && <section className="demo-login-card">
        <div><strong>Local workspace</strong><span>Onboard and plan in this browser. Everything stays on this device.</span></div>
        <a className="secondary-button full" href="/local">Start a local workspace</a>
      </section>}
      {status && <p className="auth-status" role="status">{status}</p>}
    </section>
    <p className="auth-note">Independent planning aid. CourseContext cannot enroll or submit forms for you.</p>
  </main>
}
