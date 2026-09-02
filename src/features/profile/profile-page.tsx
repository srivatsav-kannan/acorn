"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { defaultGraduationTerm, parseTermId, termId, termLabel, timelineFor } from "@/domain/timeline"
import { createAcornBrowserClient } from "@/lib/supabase/browser"

// Login details live in Supabase Auth, not in the workspace, so this card
// talks to it directly. The shared demo account is excluded: anyone with the
// judges' credentials could otherwise lock everyone else out.
const AccountCard = ({ userEmail }: { userEmail: string }) => {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordStatus, setPasswordStatus] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [emailStatus, setEmailStatus] = useState("")
  const [busy, setBusy] = useState<"password" | "email" | null>(null)

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword.length < 8) { setPasswordStatus("Use a password of at least eight characters."); return }
    setBusy("password")
    setPasswordStatus("")
    // Auth does not check the current password on its own here, so prove it
    // with a sign-in first. A wrong guess never reaches the update call.
    const client = createAcornBrowserClient()
    const check = await client.auth.signInWithPassword({ email: userEmail, password: currentPassword })
    if (check.error) {
      setPasswordStatus("That current password is not right.")
      setBusy(null)
      return
    }
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordStatus(/same password/i.test(error.message) ? "That is already your password. Pick a different one." : /reauthentication/i.test(error.message) ? "Log out and back in, then try again." : error.message)
    } else {
      setPasswordStatus("Password changed.")
      setCurrentPassword("")
      setNewPassword("")
    }
    setBusy(null)
  }

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault()
    const email = newEmail.trim()
    if (email.toLowerCase() === userEmail.toLowerCase()) { setEmailStatus("That is already your login email."); return }
    setBusy("email")
    setEmailStatus("")
    const { error } = await createAcornBrowserClient().auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/app/profile")}` })
    setEmailStatus(error ? (/already registered|already exists/i.test(error.message) ? "Another account already uses that email." : error.message) : `We sent confirmation links to ${email} and to ${userEmail}. Open both to finish the change.`)
    if (!error) setNewEmail("")
    setBusy(null)
  }

  return <section className="panel-card account-card">
    <div className="section-heading"><h2>Login details</h2><span className="muted">{userEmail}</span></div>
    <div className="account-grid">
      <form className="profile-form stacked" onSubmit={(event) => void changePassword(event)}>
        <h3>Change password</h3>
        <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
        <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <div className="profile-form-actions"><button className="primary-button" type="submit" disabled={busy === "password"}>{busy === "password" ? "Saving…" : "Change password"}</button></div>
        {passwordStatus && <p className="auth-status" role="status">{passwordStatus}</p>}
      </form>
      <form className="profile-form stacked" onSubmit={(event) => void changeEmail(event)}>
        <h3>Change email</h3>
        <label>New email<input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" required /></label>
        <p className="muted account-note">The change takes effect once you open the confirmation links.</p>
        <div className="profile-form-actions"><button className="primary-button" type="submit" disabled={busy === "email"}>{busy === "email" ? "Sending…" : "Send confirmation"}</button></div>
        {emailStatus && <p className="auth-status" role="status">{emailStatus}</p>}
      </form>
    </div>
  </section>
}

// The technical page: who the account belongs to and the two dates the whole
// product derives from. Changing those dates rebuilds the quarter map, the
// standing labels, unit targets, and every calendar quarter, so it asks first.

export const ProfilePage = () => {
  const value = useWorkspace()
  const profile = value.workspace.profile
  const timeline = timelineFor(profile, new Date())
  const entryYear = parseTermId(timeline.entryTermId)?.year ?? 2026
  const gradYear = parseTermId(timeline.expectedGraduationTermId)?.year ?? entryYear + 4
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.recoveryPhone ?? "")
  const [pendingYears, setPendingYears] = useState<{ entry: number, grad: number } | null>(null)
  const [draftEntry, setDraftEntry] = useState(entryYear)
  const [draftGrad, setDraftGrad] = useState(gradYear)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  // The fixture provider hydrates stored state a beat after mount; keep the
  // identity fields in step with what actually loaded.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setName(profile.name)
      setPhone(profile.recoveryPhone ?? "")
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [profile.name, profile.recoveryPhone])

  const saveIdentity = () => value.onCommand({ type: "update_profile", patch: { name: name.trim() || profile.name, recoveryPhone: phone } })

  const requestYears = (entry: number, grad: number) => {
    setDraftEntry(entry)
    setDraftGrad(grad > entry ? grad : entry + 4)
    setPendingYears({ entry, grad: grad > entry ? grad : entry + 4 })
  }
  const applyYears = async () => {
    if (!pendingYears) return
    const entryTermId = termId(pendingYears.entry, "AUTUMN")
    const graduationTermId = pendingYears.grad > pendingYears.entry ? termId(pendingYears.grad, "SPRING") : defaultGraduationTerm(entryTermId, timeline.degree)
    await value.onCommand({ type: "update_academic_history", patch: { timeline: { entryTermId, expectedGraduationTermId: graduationTermId, degree: timeline.degree } } })
    setPendingYears(null)
  }

  const performReset = async () => {
    setResetting(true)
    await value.reset()
  }

  return <div className="page profile-page">
    <header className="page-heading">
      <div><h1>Profile</h1><p>Account facts and the two dates everything derives from.</p></div>
      <div className="heading-actions">
        {value.mode === "account" && <button className="secondary-button" onClick={value.signOut}>Log out</button>}
      </div>
    </header>

    <div className="profile-grid">
      <section className="panel-card">
        <div className="section-heading"><h2>Identity</h2></div>
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void saveIdentity() }}>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
          <label>Email<input value={value.mode === "account" ? value.userEmail : profile.email || "Not connected"} disabled readOnly /></label>
          <label>Recovery phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 650 555 0100" maxLength={24} /></label>
          <div className="profile-form-actions"><button className="primary-button" type="submit">Save</button></div>
        </form>
      </section>

      <section className="panel-card timeline-card">
        <div className="section-heading"><h2>Enrollment and graduation</h2><span className="muted timeline-span">{termLabel(timeline.entryTermId)} to {termLabel(timeline.expectedGraduationTermId)}</span></div>
        <p className="danger-note">Changing these two dates rebuilds the entire schedule: every quarter on the calendar, your standing each year, unit targets, and cross-term checks all shift with them.</p>
        <div className="profile-year-row">
          <label>Entered Stanford in autumn
            <select className="chunky-select" value={pendingYears ? draftEntry : entryYear} onChange={(event) => requestYears(Number(event.target.value), pendingYears ? draftGrad : gradYear)}>
              {Array.from({ length: 10 }, (_, index) => entryYear - 4 + index).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>Graduating in spring
            <select className="chunky-select" value={pendingYears ? draftGrad : gradYear} onChange={(event) => requestYears(pendingYears ? draftEntry : entryYear, Number(event.target.value))}>
              {Array.from({ length: 9 }, (_, index) => (pendingYears ? draftEntry : entryYear) + 1 + index).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
        {pendingYears && <div className="confirm-strip" role="alertdialog" aria-label="Confirm timeline change">
          <p><b>Rebuild the map for {pendingYears.entry} to {pendingYears.grad}?</b> Quarters, standing, unit targets, and the calendar will all be recomputed. This is undoable from the activity ledger.</p>
          <div className="form-row-actions">
            <button className="secondary-button small" type="button" onClick={() => setPendingYears(null)}>Cancel</button>
            <button className="primary-button small" type="button" onClick={() => void applyYears()}>Rebuild the map</button>
          </div>
        </div>}
      </section>
    </div>

    {value.mode === "account" && (value.isDemoAccount
      ? <section className="panel-card account-card"><div className="section-heading"><h2>Login details</h2></div><p className="muted">This is a shared demo account, so its email and password stay as they are.</p></section>
      : <AccountCard userEmail={value.userEmail} />)}

    <section className="panel-card reset-card">
      <div className="reset-row">
        <div>
          <h2>Start over</h2>
          <p className="muted">Resetting clears everything in this workspace and returns to onboarding.</p>
        </div>
        {confirmingReset ? <div className="form-row-actions">
          <button className="secondary-button" type="button" onClick={() => setConfirmingReset(false)} disabled={resetting}>Keep my workspace</button>
          <button className="primary-button" type="button" onClick={() => void performReset()} disabled={resetting}>{resetting ? "Resetting…" : "Yes, reset everything"}</button>
        </div> : <button className="secondary-button" type="button" onClick={() => setConfirmingReset(true)}>Reset workspace</button>}
      </div>
    </section>
  </div>
}
