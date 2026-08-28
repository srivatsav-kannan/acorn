"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { listInstitutionChoices } from "@/data/institutions/registry"

export const OnboardingPage = () => {
  const router = useRouter()
  const institutionChoices = listInstitutionChoices()
  const [institutionId, setInstitutionId] = useState(institutionChoices.find((choice) => choice.status === "full")?.id ?? "INSTITUTION-STANFORD")
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const finish = async () => {
    if (!name.trim()) { setError("Enter the name you want to use here."); return }
    if (!goal.trim()) { setError("Tell us what you want help figuring out."); return }
    setBusy(true)
    setError("")
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, goal, institutionId })
    })
    const result = await response.json() as { ok?: boolean, message?: string }
    if (!response.ok || !result.ok) {
      setError(result.message ?? "Your workspace could not be created.")
      setBusy(false)
      return
    }
    router.push("/app")
    router.refresh()
  }

  return <main className="onboarding-page onboarding-rebuild">
    <header className="onboarding-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link>
      <span>Your private planning workspace</span>
    </header>
    <div className="onboarding-intro">
      <section>
        <p className="eyebrow">Start with the real question</p>
        <h1>What are you trying to figure out?</h1>
        <p>Give us the situation in your own words. You can add courses, majors, time constraints, and everything else when it becomes relevant.</p>
        <ul>
          <li><span>1</span><strong>You set the goal</strong><small>No major or schedule is assumed for you.</small></li>
          <li><span>2</span><strong>Your workspace grows with the task</strong><small>Plans, sources, and decisions stay organized as you work.</small></li>
          <li><span>3</span><strong>You and your agent share the same view</strong><small>Every agent change is visible, editable, and undoable.</small></li>
        </ul>
      </section>
      <form className="onboarding-simple-card" onSubmit={(event) => { event.preventDefault(); void finish() }}>
        <div>
          <p className="eyebrow">Create your workspace</p>
          <h2>Tell us just enough to begin.</h2>
          <p>Nothing here is sent to your university.</p>
        </div>
        <fieldset className="institution-picker">
          <legend>Where are you studying?</legend>
          <div>
            {institutionChoices.map((choice) => <button
              key={choice.id}
              type="button"
              className={choice.id === institutionId ? "selected" : ""}
              disabled={choice.status !== "full"}
              aria-pressed={choice.id === institutionId}
              onClick={() => setInstitutionId(choice.id)}
            >
              <strong>{choice.shortName}</strong>
              <small>{choice.status === "full" ? "Reference pack included" : "Coming soon"}</small>
            </button>)}
          </div>
          <p>Not on the list yet? Start with the closest match. Your agent can add missing courses and programs with sources once you are in.</p>
        </fieldset>
        <label>
          <span>What should we call you?</span>
          <input autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your preferred name" maxLength={80} />
        </label>
        <label>
          <span>What would you like help with?</span>
          <textarea rows={6} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="I am planning my first quarter and want to explore computer science without overloading myself." maxLength={1200} />
          <small>Write naturally. You can change this later.</small>
        </label>
        {error && <p className="form-error onboarding-error" role="alert">{error}</p>}
        <button className="primary-button onboarding-submit" type="submit" disabled={busy}>{busy ? "Creating your workspace…" : "Create my workspace"}</button>
        <p className="onboarding-privacy">Starts empty. No sample student data is added to your account.</p>
      </form>
    </div>
  </main>
}
