"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { CUSTOM_INSTITUTION_ID, listInstitutionChoices } from "@/data/institutions/registry"

export const OnboardingPage = () => {
  const router = useRouter()
  const institutionChoices = listInstitutionChoices()
  const thisYear = useMemo(() => new Date().getFullYear(), [])
  const [institutionId, setInstitutionId] = useState(institutionChoices.find((choice) => choice.status === "full")?.id ?? "INSTITUTION-STANFORD")
  const [customInstitution, setCustomInstitution] = useState("")
  const [entryYear, setEntryYear] = useState(thisYear)
  const [gradYear, setGradYear] = useState(thisYear + 4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const isCustom = institutionId === CUSTOM_INSTITUTION_ID
  const entryYears = Array.from({ length: 8 }, (_, index) => thisYear + 1 - index)
  const gradYears = Array.from({ length: 8 }, (_, index) => entryYear + 1 + index)

  const changeEntryYear = (year: number) => {
    const length = gradYear - entryYear
    setEntryYear(year)
    setGradYear(year + (length > 0 && length <= 8 ? length : 4))
  }

  const finish = async () => {
    if (isCustom && customInstitution.trim().length < 2) { setError("Enter your university's name."); return }
    setBusy(true)
    setError("")
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ institutionId, customInstitution: isCustom ? customInstitution : undefined, entryYear, gradYear })
    })
    const result = await response.json() as { ok?: boolean, message?: string, workspace?: unknown }
    if (!response.ok || !result.ok) {
      setError(result.message ?? "Your workspace could not be created.")
      setBusy(false)
      return
    }
    if (result.workspace) localStorage.setItem("course-context-local-v1", JSON.stringify(result.workspace))
    router.push("/app")
    router.refresh()
  }

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST", redirect: "follow" })
    router.push("/login")
    router.refresh()
  }

  return <main className="onboarding-page onboarding-rebuild">
    <header className="onboarding-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link>
      <button className="text-button" type="button" onClick={signOut}>Sign out</button>
    </header>
    <div className="onboarding-center">
      <form className="onboarding-facts-card" onSubmit={(event) => { event.preventDefault(); void finish() }}>
        <h1>Three facts, then you are in.</h1>
        <p>Everything else, from your name to your course history, can be added inside at any time.</p>
        <label>
          <span>University</span>
          <select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}>
            {institutionChoices.map((choice) => <option key={choice.id} value={choice.id} disabled={choice.status === "planned"}>
              {choice.status === "custom" ? "Another university" : choice.name}{choice.status === "planned" ? " (coming soon)" : ""}
            </option>)}
          </select>
        </label>
        {isCustom && <div className="onboarding-custom-name">
          <label>
            <span>University name</span>
            <input value={customInstitution} onChange={(event) => setCustomInstitution(event.target.value)} maxLength={80} autoFocus />
          </label>
          <small>No reference pack ships for this school yet. Your agent can research it and build one inside.</small>
        </div>}
        <div className="onboarding-fact-row">
          <label>
            <span>Entered in autumn</span>
            <select value={entryYear} onChange={(event) => changeEntryYear(Number(event.target.value))}>
              {entryYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            <span>Graduating in spring</span>
            <select value={gradYear} onChange={(event) => setGradYear(Number(event.target.value))}>
              {gradYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="form-error onboarding-error" role="alert">{error}</p>}
        <button className="primary-button onboarding-submit" type="submit" disabled={busy}>{busy ? "Setting up…" : "Enter my workspace"}</button>
        <p className="onboarding-privacy">Nothing is sent to your university. No sample student data.</p>
      </form>
    </div>
  </main>
}
