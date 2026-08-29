"use client"

import Link from "next/link"
import { AcornSquirrelMark } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { CUSTOM_INSTITUTION_ID, listInstitutionChoices } from "@/data/institutions/registry"

export const OnboardingPage = ({ browserWorkspace = false }: { browserWorkspace?: boolean }) => {
  const router = useRouter()
  const institutionChoices = listInstitutionChoices()
  const thisYear = useMemo(() => new Date().getFullYear(), [])
  const [name, setName] = useState("")
  const [institutionId, setInstitutionId] = useState(institutionChoices.find((choice) => choice.status === "full")?.id ?? "INSTITUTION-STANFORD")
  const [customInstitution, setCustomInstitution] = useState("")
  const [entryYear, setEntryYear] = useState(thisYear)
  const [gradYear, setGradYear] = useState(thisYear + 4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [existingWorkspace, setExistingWorkspace] = useState(false)
  const isCustom = institutionId === CUSTOM_INSTITUTION_ID
  const entryYears = Array.from({ length: 8 }, (_, index) => thisYear + 1 - index)
  const gradYears = Array.from({ length: 8 }, (_, index) => entryYear + 1 + index)

  useEffect(() => {
    if (!browserWorkspace) return
    const timeout = window.setTimeout(() => {
      try {
        setExistingWorkspace(localStorage.getItem("course-context-local-v1") !== null)
      } catch {
        setExistingWorkspace(false)
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [browserWorkspace])

  const changeEntryYear = (year: number) => {
    const length = gradYear - entryYear
    setEntryYear(year)
    setGradYear(year + (length > 0 && length <= 8 ? length : 4))
  }

  const finish = async () => {
    if (name.trim().length < 1) { setError("Enter your name."); return }
    if (isCustom && customInstitution.trim().length < 2) { setError("Enter your university's name."); return }
    setBusy(true)
    setError("")
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), institutionId, customInstitution: isCustom ? customInstitution : undefined, entryYear, gradYear })
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

  const leave = async () => {
    await fetch("/api/auth/signout", { method: "POST", redirect: "follow" })
    router.push("/")
    router.refresh()
  }

  return <main className="onboarding-page">
    <header className="onboarding-header">
      <Link className="wordmark" href="/"><AcornSquirrelMark className="wordmark-acorn" />Acorn</Link>
      <button className="text-button" type="button" onClick={leave}>{browserWorkspace ? "Back to the front page" : "Sign out"}</button>
    </header>
    <div className="onboarding-center">
      <form className="onboarding-facts-card" onSubmit={(event) => { event.preventDefault(); void finish() }}>
        <h1>Set up your workspace</h1>
        <p>Your name and three timeline facts get you started. Everything else, from AP credit to course history, can be added inside at any time by you or by your agent.</p>
        {existingWorkspace && <p className="onboarding-existing" role="status">This browser already holds a workspace. <Link href="/app">Open it</Link> instead, or continue below to replace it.</p>}
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" autoFocus required />
        </label>
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
            <input value={customInstitution} onChange={(event) => setCustomInstitution(event.target.value)} maxLength={80} />
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
        <p className="onboarding-privacy">Nothing here is sent to your university, and no sample data is preloaded.</p>
      </form>
    </div>
  </main>
}
