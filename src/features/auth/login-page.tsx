"use client"

import Link from "next/link"
import { AcornSquirrelMark } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createAcornBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = ({ initialStatus = "", nextPath = "/app" }: { initialStatus?: string, nextPath?: string }) => {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const configured = isSupabaseConfigured()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!configured) {
      setStatus("Account sign-in is not configured for this deployment.")
      return
    }
    setBusy(true)
    setStatus("")
    setUnconfirmed(false)
    const { error } = await createAcornBrowserClient().auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const notConfirmed = /confirm/i.test(error.message)
      setUnconfirmed(notConfirmed)
      setStatus(notConfirmed ? "This email has not been confirmed yet. Open the confirmation link we sent, then log in." : /credentials/i.test(error.message) ? "That email and password do not match an account." : error.message)
      setBusy(false)
      return
    }
    router.replace(nextPath)
    router.refresh()
  }

  // The confirmation link is built from this page's origin so it comes back
  // to the deployment the person is actually using.
  const resendConfirmation = async () => {
    setBusy(true)
    const { error } = await createAcornBrowserClient().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` } })
    setStatus(error ? error.message : `A new confirmation link is on its way to ${email.trim()}.`)
    setUnconfirmed(false)
    setBusy(false)
  }

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/"><AcornSquirrelMark className="wordmark-acorn" />Acorn</Link>
    <section className="auth-card">
      <header>
        <h1>Log in</h1>
      </header>
      <form className="email-login-form" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={!configured} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={!configured} />
        <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Logging in…" : "Log in"}</button>
        <div className="auth-links">
          <Link className="text-button" href="/forgot-password">Forgot your password?</Link>
        </div>
      </form>
      {!configured && <div className="auth-setup-notice"><strong>Account sign-in is unavailable</strong><span>This deployment is missing its account storage configuration, so no one can log in until it is restored.</span></div>}
      {status && <p className="auth-status" role="status">{status}</p>}
      {unconfirmed && email.trim() && <div className="auth-links"><button className="text-button" type="button" onClick={() => void resendConfirmation()} disabled={busy}>Send the confirmation link again</button></div>}
      <p className="auth-switch">New here? <Link href="/signup">Create an account</Link></p>
    </section>
  </main>
}
