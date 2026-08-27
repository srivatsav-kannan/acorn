"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const steps = ["About you", "Academic context", "Planning priorities", "Ready"]
const completedOptions = [
  ["COURSE-CS-106A", "CS 106A", "Programming Methodology"],
  ["COURSE-CS-106B", "CS 106B", "Programming Abstractions"],
  ["COURSE-MATH-51", "MATH 51", "Linear Algebra and Multivariable Calculus"]
]

export const OnboardingPage = () => {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [program, setProgram] = useState("PROGRAM-CS-BS")
  const [completed, setCompleted] = useState<string[]>([])
  const [goals, setGoals] = useState("")
  const [keepFridayOpen, setKeepFridayOpen] = useState(true)
  const [earliestStart, setEarliestStart] = useState("08:30")
  const [unitLimit, setUnitLimit] = useState(15)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const toggleCompleted = (id: string) => setCompleted((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])
  const finish = async () => {
    setBusy(true)
    setError("")
    const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, program, completedCourseIds: completed, goals, keepFridayOpen, earliestStart, unitLimit }) })
    const result = await response.json() as { ok?: boolean, message?: string }
    if (!response.ok || !result.ok) {
      setError(result.message ?? "Your workspace could not be created.")
      setBusy(false)
      return
    }
    router.push("/app")
    router.refresh()
  }
  const next = () => {
    if (step === 0 && !name.trim()) { setError("Enter your name to continue."); return }
    setError("")
    setStep((value) => Math.min(value + 1, steps.length - 1))
  }

  return <main className="onboarding-page">
    <header className="onboarding-header"><Link className="wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link><span>Your workspace is private to your account</span></header>
    <div className="onboarding-shell">
      <aside><p className="eyebrow">Set up your workspace</p><h1>A useful plan starts with your real constraints.</h1><p>Four short steps give you and your agent the same starting context. You can change everything later.</p><ol>{steps.map((label, index) => <li key={label} className={index === step ? "active" : index < step ? "complete" : ""}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}</ol></aside>
      <section className="onboarding-card" aria-live="polite">
        <div className="onboarding-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        {step === 0 && <div className="onboarding-step"><p className="eyebrow">Step 1 of 4</p><h2>What should we call you?</h2><p>This appears in your workspace. It is not shared with Stanford.</p><label>Preferred name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label><label>Current or prospective program<select value={program} onChange={(event) => setProgram(event.target.value)}><option value="PROGRAM-CS-BS">Computer Science</option><option value="UNDECIDED">Still exploring</option></select></label></div>}
        {step === 1 && <div className="onboarding-step"><p className="eyebrow">Step 2 of 4</p><h2>What have you already completed?</h2><p>Select what applies. This prevents recommendations that repeat prior coursework.</p><div className="onboarding-options">{completedOptions.map(([id, code, title]) => <button type="button" className={completed.includes(id) ? "selected" : ""} onClick={() => toggleCompleted(id)} key={id}><span>{completed.includes(id) ? "✓" : "+"}</span><strong>{code}</strong><small>{title}</small></button>)}</div></div>}
        {step === 2 && <div className="onboarding-step"><p className="eyebrow">Step 3 of 4</p><h2>What should this quarter protect?</h2><p>Use ordinary language. These priorities remain visible to both you and your agent.</p><label>Goals and considerations<textarea rows={5} value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="Explore health-focused HCI, keep time for research, and make steady progress toward CS" /></label><div className="onboarding-inline"><label>Earliest class<input type="time" value={earliestStart} onChange={(event) => setEarliestStart(event.target.value)} /></label><label>Maximum units<input type="number" min="8" max="20" value={unitLimit} onChange={(event) => setUnitLimit(Number(event.target.value))} /></label></div><label className="check-row"><input type="checkbox" checked={keepFridayOpen} onChange={(event) => setKeepFridayOpen(event.target.checked)} /><span><strong>Keep Fridays open</strong><small>Treat Friday meetings as a hard conflict.</small></span></label></div>}
        {step === 3 && <div className="onboarding-step ready-step"><span className="ready-mark">✓</span><p className="eyebrow">Ready to begin</p><h2>Your workspace has a clear starting point.</h2><p>We will create an editable Autumn plan, source library, requirement map, and agent connection guide. Nothing is submitted to Stanford.</p><dl><div><dt>Profile</dt><dd>{name}</dd></div><div><dt>Program</dt><dd>{program === "PROGRAM-CS-BS" ? "Computer Science" : "Exploring"}</dd></div><div><dt>Completed</dt><dd>{completed.length} selected</dd></div><div><dt>Quarter limit</dt><dd>{unitLimit} units</dd></div></dl></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><button className="text-button" type="button" disabled={step === 0 || busy} onClick={() => setStep((value) => value - 1)}>Back</button>{step < 3 ? <button className="primary-button" type="button" onClick={next}>Continue</button> : <button className="primary-button" type="button" disabled={busy} onClick={finish}>{busy ? "Creating workspace…" : "Create my workspace"}</button>}</footer>
      </section>
    </div>
  </main>
}
