"use client"

import Link from "next/link"
import { AcornMark } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

export const LoginPage = ({ initialStatus = "", nextPath = "/app" }: { initialStatus?: string, nextPath?: string }) => {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const configured = isSupabaseConfigured()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!configured) {
      setStatus("Account sign-in is not configured for this deployment.")
      return
    }
    setBusy(true)
    setStatus("")
    const { error } = await createCourseContextBrowserClient().auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setStatus(/confirm/i.test(error.message) ? "This email has not been confirmed yet. Open the confirmation link we sent, then log in." : /credentials/i.test(error.message) ? "That email and password do not match an account." : error.message)
      setBusy(false)
      return
    }
    router.replace(nextPath)
    router.refresh()
  }

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/"><AcornMark className="wordmark-acorn" />Acorn</Link>
    <section className="auth-card">
      <header>
        <h1>Log in</h1>
        <p>Your workspace and everything in it lives behind your account.</p>
      </header>
      <form className="email-login-form" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={!configured} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={!configured} />
        <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      {!configured && <div className="auth-setup-notice"><strong>Account sign-in is unavailable</strong><span>This deployment is missing its account storage configuration, so no one can log in until it is restored.</span></div>}
      {status && <p className="auth-status" role="status">{status}</p>}
      <p className="auth-switch">New here? <Link href="/signup">Create an account</Link></p>
    </section>
    <p className="auth-note">Acorn helps you plan; enrollment and anything official still go through Stanford&apos;s own systems.</p>
  </main>
}
