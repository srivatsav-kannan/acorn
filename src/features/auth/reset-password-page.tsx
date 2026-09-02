"use client"

import Link from "next/link"
import { AcornSquirrelMark } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createAcornBrowserClient } from "@/lib/supabase/browser"

// Reached from the email link once the callback has turned it into a session.
// Without that session there is nothing to update, so the server page renders
// the expired notice instead of this form.
export const ResetPasswordPage = ({ expired = false }: { expired?: boolean }) => {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) { setStatus("Use a password of at least eight characters."); return }
    if (password !== confirm) { setStatus("The two passwords do not match."); return }
    setBusy(true)
    setStatus("")
    const { error } = await createAcornBrowserClient().auth.updateUser({ password })
    if (error) {
      setStatus(/same password/i.test(error.message) ? "That is already your password. Pick a different one." : error.message)
      setBusy(false)
      return
    }
    router.replace("/app")
    router.refresh()
  }

  return <main className="auth-page">
    <Link className="wordmark auth-wordmark" href="/"><AcornSquirrelMark className="wordmark-acorn" />Acorn</Link>
    <section className="auth-card">
      <header>
        <h1>{expired ? "This link has expired" : "Set a new password"}</h1>
        {expired && <p>Reset links work once and for one hour. Request a new one and open it on this device.</p>}
      </header>
      {expired ? <Link className="primary-button full auth-submit" href="/forgot-password">Send a new link</Link> : <form className="email-login-form" onSubmit={submit}>
        <label htmlFor="reset-password">New password</label>
        <input id="reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
        <label htmlFor="reset-confirm">Type it again</label>
        <input id="reset-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required />
        <button className="primary-button full auth-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>}
      {status && <p className="auth-status" role="status">{status}</p>}
      <p className="auth-switch"><Link href="/login">Back to login</Link></p>
    </section>
  </main>
}
