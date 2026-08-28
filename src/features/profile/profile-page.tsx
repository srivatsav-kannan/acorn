"use client"

import { useEffect, useState } from "react"
import { useWorkspace } from "@/components/workspace-provider"
import { defaultGraduationTerm, parseTermId, termId, termLabel, timelineFor } from "@/domain/timeline"

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
  // The fixture provider hydrates stored state a beat after mount; keep the
  // identity fields in step with what actually loaded.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setName(profile.name)
      setPhone(profile.recoveryPhone ?? "")
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [profile.name, profile.recoveryPhone])
  const [pendingYears, setPendingYears] = useState<{ entry: number, grad: number } | null>(null)
  const [draftEntry, setDraftEntry] = useState(entryYear)
  const [draftGrad, setDraftGrad] = useState(gradYear)

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

  return <div className="page profile-page">
    <header className="page-heading"><div><h1>Profile</h1><p>Account facts and the two dates everything derives from.</p></div>
      <div className="heading-actions">
        {value.isDemoAccount || value.mode === "fixture" ? <button className="secondary-button" onClick={value.reset}>{value.localAccount ? "Reset workspace" : "Reset demo"}</button> : null}
        {value.mode === "account" && <button className="secondary-button" onClick={value.signOut}>Log out</button>}
      </div>
    </header>

    <section className="panel-card">
      <div className="section-heading"><h2>Identity</h2></div>
      <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void saveIdentity() }}>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
        <label>Email<input value={value.mode === "account" ? value.userEmail : profile.email || "Not connected"} disabled readOnly /></label>
        <label>Recovery phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 650 555 0100" maxLength={24} /></label>
        <button className="primary-button" type="submit">Save</button>
      </form>
    </section>

    <section className="panel-card timeline-card">
      <div className="section-heading"><h2>Enrollment and graduation</h2><span className="muted">{termLabel(timeline.entryTermId)} to {termLabel(timeline.expectedGraduationTermId)}</span></div>
      <p className="danger-note">Changing these two dates rebuilds the entire schedule: every quarter on the calendar, your standing each year, unit targets, and cross-term checks all shift with them.</p>
      <div className="add-form-row">
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

    <section className="panel-card">
      <div className="section-heading"><h2>Account</h2></div>
      <dl className="profile-facts">
        <div><dt>Kind</dt><dd>{value.isDemoAccount ? "Shared demo account" : value.mode === "account" ? "Personal account" : "Test fixture"}</dd></div>
        <div><dt>Storage</dt><dd>{value.mode === "account" ? "Saved to the server on every change" : "Test-run storage in this browser"}</dd></div>
        <div><dt>Degree objective</dt><dd>{timeline.degree}, set on the scratchpad</dd></div>
      </dl>
    </section>
  </div>
}
