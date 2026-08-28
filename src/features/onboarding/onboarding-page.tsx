"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CUSTOM_INSTITUTION_ID, listInstitutionChoices } from "@/data/institutions/registry"
import { registerWebMcpTools } from "@/webmcp/register"
import { createOnboardingTools } from "@/webmcp/onboarding-tools"

const agentFillPrompt = "I am creating my CourseContext workspace and this onboarding page is open in the browser. It registers WebMCP tools. Call get_onboarding_form first. Then, from the context you already have about me, call create_workspace with my preferred name, what I want help with, my school, and my academic history, including AP credit and courses I have already taken. Ask me for anything you are missing instead of guessing. If my school is not listed, use the custom institution path with my university's name. After my workspace opens, research my university and build its missing reference with the extend_reference tool, citing official sources."

type ApRow = { exam: string, score: string }

export const OnboardingPage = () => {
  const router = useRouter()
  const institutionChoices = listInstitutionChoices()
  const [institutionId, setInstitutionId] = useState(institutionChoices.find((choice) => choice.status === "full")?.id ?? "INSTITUTION-STANFORD")
  const [customInstitution, setCustomInstitution] = useState("")
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [classYear, setClassYear] = useState("")
  const [apRows, setApRows] = useState<ApRow[]>([])
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const isCustom = institutionId === CUSTOM_INSTITUTION_ID

  const submitOnboarding = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
    const result = await response.json() as { ok?: boolean, message?: string, workspaceId?: string }
    if (response.ok && result.ok) {
      router.push("/app")
      router.refresh()
      return { ok: true, workspaceId: result.workspaceId }
    }
    return { ok: false, message: result.message ?? "Your workspace could not be created." }
  }

  useEffect(() => {
    const markedDocument = document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => { unregister?: () => void } | void } }
    return registerWebMcpTools(markedDocument, createOnboardingTools({ submit: (input) => submitOnboarding(input as unknown as Record<string, unknown>) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = async () => {
    if (!name.trim()) { setError("Enter the name you want to use here."); return }
    if (!goal.trim()) { setError("Tell us what you want help figuring out."); return }
    if (isCustom && customInstitution.trim().length < 2) { setError("Enter your university's name."); return }
    setBusy(true)
    setError("")
    const apCredits = apRows.filter((row) => row.exam.trim()).map((row) => ({ exam: row.exam.trim(), score: row.score ? Number(row.score) : undefined }))
    const academicHistory = classYear.trim() || apCredits.length ? { classYear: classYear.trim() || undefined, apCredits: apCredits.length ? apCredits : undefined } : undefined
    const result = await submitOnboarding({ name, goal, institutionId, customInstitution: isCustom ? customInstitution : undefined, academicHistory })
    if (!result.ok) {
      setError(result.message ?? "Your workspace could not be created.")
      setBusy(false)
    }
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(agentFillPrompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
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
        <aside className="agent-fill-card">
          <p className="eyebrow">Already keep your context with an agent?</p>
          <h2>Let it fill this in for you.</h2>
          <p>This page registers setup tools through WebMCP. Keep it open, paste this to your agent, and it can create the workspace from what it already knows about you.</p>
          <blockquote>{agentFillPrompt}</blockquote>
          <button className="secondary-button" type="button" onClick={copyPrompt}>{copied ? "Copied" : "Copy agent instruction"}</button>
        </aside>
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
              disabled={choice.status === "planned"}
              aria-pressed={choice.id === institutionId}
              onClick={() => setInstitutionId(choice.id)}
            >
              <strong>{choice.shortName}</strong>
              <small>{choice.status === "full" ? "Reference pack included" : choice.status === "custom" ? "Beta · agent-built" : "Coming soon"}</small>
            </button>)}
          </div>
          {isCustom ? <label className="custom-institution-field">
            <span>Your university&apos;s name</span>
            <input value={customInstitution} onChange={(event) => setCustomInstitution(event.target.value)} placeholder="University of Wherever" maxLength={80} />
            <small>Beta. Your workspace starts from a neutral template. Your agent researches your university and builds its catalog and program reference with sources.</small>
          </label> : <p>Not on the list yet? Choose Other. Your agent can research your school and build its reference once you are in.</p>}
        </fieldset>
        <label>
          <span>What should we call you?</span>
          <input autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your preferred name" maxLength={80} />
        </label>
        <label>
          <span>What would you like help with?</span>
          <textarea rows={5} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="I am planning my first quarter and want to explore computer science without overloading myself." maxLength={1200} />
          <small>Write naturally. You can change this later.</small>
        </label>
        <section className="history-section">
          <button type="button" className="history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)}>
            <span>Add academic history now</span>
            <small>Optional. Class standing and AP or transfer credit. You can also add these later, or let your agent do it.</small>
          </button>
          {historyOpen && <div className="history-fields">
            <label>
              <span>Class standing</span>
              <input value={classYear} onChange={(event) => setClassYear(event.target.value)} placeholder="Incoming frosh, Class of 2030" maxLength={30} />
            </label>
            <div className="ap-rows">
              <span className="ap-rows-label">AP and transfer credit</span>
              {apRows.map((row, index) => <div className="ap-row" key={index}>
                <input aria-label={`Credit ${index + 1} name`} value={row.exam} onChange={(event) => setApRows((rows) => rows.map((item, i) => i === index ? { ...item, exam: event.target.value } : item))} placeholder="AP Calculus BC" maxLength={80} />
                <input aria-label={`Credit ${index + 1} score`} value={row.score} onChange={(event) => setApRows((rows) => rows.map((item, i) => i === index ? { ...item, score: event.target.value } : item))} placeholder="Score" inputMode="numeric" maxLength={1} />
                <button type="button" className="more-button" aria-label={`Remove credit ${index + 1}`} onClick={() => setApRows((rows) => rows.filter((_, i) => i !== index))}>×</button>
              </div>)}
              <button type="button" className="text-button" onClick={() => setApRows((rows) => [...rows, { exam: "", score: "" }])}>+ Add a credit</button>
            </div>
          </div>}
        </section>
        {error && <p className="form-error onboarding-error" role="alert">{error}</p>}
        <button className="primary-button onboarding-submit" type="submit" disabled={busy}>{busy ? "Creating your workspace…" : "Create my workspace"}</button>
        <p className="onboarding-privacy">Starts empty apart from what you add here. No sample student data.</p>
      </form>
    </div>
  </main>
}
