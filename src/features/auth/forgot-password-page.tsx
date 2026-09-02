"use client"

import Link from "next/link"
import { AcornSquirrelMark } from "@/components/icons"
import { useState, type FormEvent } from "react"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

// The reset link has to land back on this deployment, not on whatever Site
// URL the auth project was configured with, so the redirect is always built
// from the page's own origin.
export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const configured = isSupabaseConfigured()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!configured) {
      setStatus("Account sign-in is not configured for this deployment.")
      return
    }
    setBusy(true)
    setStatus("")
    const { error } = await createCourseContextBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`
    })
    if (error) {
      setStatus(/rate limit/i.test(error.message) ? "Too many requests. Wait a minute and try again." : /invalid/i.test(error.message) ? "That address cannot receive mail. Check it and try again." : error.message)
      setBusy(false)
      return
    }
    setSent(true)
    setBusy(false)
  }

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/"><AcornSquirrelMark className="wordmark-acorn" />Acorn</Link>
    <section className="auth-card">
      <header>
        <h1>Reset your password</h1>
        {!sent && <p>Enter the email you log in with and we will send a link to set a new one.</p>}
      </header>
      {sent ? <div className="link-sent" role="status">
        <strong>Check your email</strong>
        <p>If an account exists for <b>{email.trim()}</b>, a reset link is on its way. It works for one hour.</p>
        <Link className="text-button" href="/login">Back to login</Link>
      </div> : <form className="email-login-form" onSubmit={submit}>
        <label htmlFor="forgot-email">Email</label>
        <input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required disabled={!configured} />
        <button className="primary-button full auth-submit" type="submit" disabled={busy || !configured}>{busy ? "Sending…" : "Send reset link"}</button>
      </form>}
      {status && <p className="auth-status" role="status">{status}</p>}
      <p className="auth-switch">Remembered it? <Link href="/login">Log in</Link></p>
    </section>
  </main>
}
