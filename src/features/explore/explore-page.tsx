"use client"

import { useMemo, useState } from "react"
import { CloseIcon, ExternalIcon, SearchIcon } from "@/components/icons"
import { institutionForWorkspace, isCustomInstitution } from "@/data/institutions/registry"
import { planForTerm } from "@/domain/degree-plan"
import { isOverlayCourse, mergedOpportunities, referenceChanges } from "@/domain/reference"
import { searchCourses } from "@/domain/search"
import type { Catalog, Course, Opportunity, Section, WorkspaceState } from "@/domain/types"

const dayLabel = (days: string[]) => days.map((day) => day[0].toUpperCase() + day.slice(1, 3)).join(" ")
const opportunityKinds = [["all", "Everything"], ["club", "Clubs"], ["research", "Research"], ["program", "Programs"]] as const

export const ExplorePage = ({ workspace, catalog, onCommand }: { workspace: WorkspaceState, catalog: Catalog, onCommand: (command: Record<string, unknown>) => void }) => {
  const [tab, setTab] = useState<"courses" | "opportunities">("courses")
  const [query, setQuery] = useState("")
  const [subject, setSubject] = useState("All")
  const [level, setLevel] = useState("All")
  const [respectProtectedDays, setRespectProtectedDays] = useState(workspace.profile.excludedDays.length > 0)
  const [afterEarliest, setAfterEarliest] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [openCourseId, setOpenCourseId] = useState<string | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)
  const [opportunityQuery, setOpportunityQuery] = useState("")
  const [opportunityKind, setOpportunityKind] = useState<(typeof opportunityKinds)[number][0]>("all")
  const [addingOpportunity, setAddingOpportunity] = useState(false)
  const [newOpportunity, setNewOpportunity] = useState({ kind: "club", name: "", summary: "", url: "", commitment: "", timing: "" })
  const institution = institutionForWorkspace(workspace)
  const custom = isCustomInstitution(workspace)
  const catalogResource = institution.resources[0]
  const buildPrompt = `My school is ${workspace.institution}. Research its official catalog. In this open CourseContext workspace, use the extend_reference tool to add the courses I am considering, with their current sections and meeting times, and my program with its requirement tree. Cite an official source for every addition and mark anything uncertain.`
  const subjects = useMemo(() => [...new Set(catalog.courses.map((course) => course.subject))].sort(), [catalog.courses])
  const plan = planForTerm(workspace, workspace.currentTermId) ?? workspace.plans[0]
  const scenario = plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]
  const plannedIds = new Set(scenario.courses.map((item) => item.courseId))
  const levels = ["All", "Introductory", "100 level", "200 level and above"]
  const results = useMemo(() => {
    const levelFilter = (course: Course) => level === "All" || (level === "Introductory" ? course.level < 100 : level === "100 level" ? course.level >= 100 && course.level < 200 : course.level >= 200)
    return searchCourses(catalog, { query, termId: workspace.currentTermId, subjects: subject === "All" ? undefined : [subject], excludedDays: respectProtectedDays ? workspace.profile.excludedDays : undefined, earliestStart: afterEarliest ? workspace.profile.earliestStart : undefined }).filter(({ course }) => levelFilter(course)).slice(0, 16)
  }, [afterEarliest, catalog, level, query, respectProtectedDays, subject, workspace.currentTermId, workspace.profile.earliestStart, workspace.profile.excludedDays])
  const protectedDays = workspace.profile.excludedDays.map((day) => day[0].toUpperCase() + day.slice(1)).join(", ")
  const add = (courseId: string, sectionId: string | undefined, units: number, code: string) => onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "add_course", planCourse: { id: `PLANCOURSE-${code.replaceAll(" ", "-")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, courseId, sectionId: sectionId ?? null, units, status: "active" } }] })
  const clearFilters = () => { setRespectProtectedDays(false); setAfterEarliest(false); setSubject("All"); setLevel("All") }

  const baseCourseById = useMemo(() => new Map(institution.buildCatalog().courses.map((course) => [course.id, course])), [workspace.institutionId, workspace.institution]) // eslint-disable-line react-hooks/exhaustive-deps
  const baseOpportunities = useMemo(() => institution.buildOpportunities(), [workspace.institutionId, workspace.institution]) // eslint-disable-line react-hooks/exhaustive-deps
  const baseOpportunityById = useMemo(() => new Map(baseOpportunities.map((item) => [item.id, item])), [baseOpportunities])
  const overlayOpportunityIds = new Set((workspace.referenceOverlay?.opportunities ?? []).map((item) => item.id))
  const opportunities = useMemo(() => {
    const merged = mergedOpportunities(baseOpportunities, workspace.referenceOverlay?.opportunities)
    const lowered = opportunityQuery.toLowerCase()
    return merged
      .filter((item) => opportunityKind === "all" || item.kind === opportunityKind)
      .filter((item) => !lowered || `${item.name} ${item.summary} ${item.tags.join(" ")}`.toLowerCase().includes(lowered))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [baseOpportunities, workspace.referenceOverlay?.opportunities, opportunityKind, opportunityQuery])

  const saveOpportunityToLibrary = (item: Opportunity) => onCommand({ type: "create_context_item", item: { id: `ITEM-${crypto.randomUUID().toUpperCase()}`, type: item.kind === "club" ? "club" : "organization", title: item.name, summary: item.summary, content: { text: [item.commitment, item.timing].filter(Boolean).join(" · "), sourceUrl: item.url }, collectionId: item.kind === "club" ? "COLLECTION-CLUBS" : "COLLECTION-RESEARCH" } })
  const submitOpportunity = () => {
    const url = newOpportunity.url.trim()
    onCommand({
      type: "extend_reference_opportunity",
      opportunity: { kind: newOpportunity.kind, name: newOpportunity.name.trim(), summary: newOpportunity.summary.trim(), url: url || undefined, commitment: newOpportunity.commitment.trim() || undefined, timing: newOpportunity.timing.trim() || undefined },
      evidence: { id: `EVIDENCE-OPP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, title: `${newOpportunity.name.trim()} listing`, claim: `${newOpportunity.name.trim()} is a ${newOpportunity.kind} at ${workspace.institution}.`, sourceUrl: url || "https://studentaffairs.stanford.edu/", sourceTitle: newOpportunity.name.trim(), retrievedAt: new Date().toISOString(), classification: "student", confidence: 0.7, status: "current", addedBy: "human", untrustedExternalContent: false }
    })
    setNewOpportunity({ kind: "club", name: "", summary: "", url: "", commitment: "", timing: "" })
    setAddingOpportunity(false)
  }

  const openCourse = openCourseId ? catalog.courses.find((course) => course.id === openCourseId) : null
  const openSections = openCourse ? catalog.sections.filter((section) => section.courseId === openCourse.id && section.termId === workspace.currentTermId) : []
  const openCourseBase = openCourse ? baseCourseById.get(openCourse.id) : undefined
  const openCourseChanges = openCourse && isOverlayCourse(workspace, openCourse.id) ? referenceChanges(openCourseBase as unknown as Record<string, unknown> | undefined, openCourse as unknown as Record<string, unknown>, ["title", "description", "minUnits", "maxUnits"]) : []
  const prerequisiteCourses = (course: Course) => (course.prerequisites ?? []).map((id) => catalog.courses.find((candidate) => candidate.id === id)).filter((item): item is Course => Boolean(item))
  const sectionEvidence = (section: Section) => workspace.evidence.filter((item) => section.evidenceIds.includes(item.id))

  return <div className="page explore-page explore-rebuild"><header className="page-heading"><div><h1>{institution.shortName}{custom ? " · Beta" : ""}</h1></div>{catalogResource && <a className="secondary-button" href={catalogResource.url} target="_blank" rel="noreferrer">Open {catalogResource.title} ↗</a>}</header>
    <div className="explore-tabs" role="tablist" aria-label="Reference sections">
      <button role="tab" aria-selected={tab === "courses"} className={tab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>Courses</button>
      <button role="tab" aria-selected={tab === "opportunities"} className={tab === "opportunities" ? "active" : ""} onClick={() => setTab("opportunities")}>Clubs and research</button>
    </div>
    {tab === "courses" ? <>
    <section className="explore-search"><label><SearchIcon width={16} height={16} /><input aria-label="Search courses" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course code, topic, or keyword" /></label><select aria-label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)}><option>All</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>{levels.map((item) => <option key={item}>{item}</option>)}</select><button className="filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>Filters <span>{[respectProtectedDays && workspace.profile.excludedDays.length > 0, afterEarliest].filter(Boolean).length}</span></button></section>
    <div className={`explore-body ${filtersOpen ? "filters-open" : ""}`}><aside className="filter-rail"><p className="nav-label">Planning filters</p>{workspace.profile.excludedDays.length > 0 ? <label><input type="checkbox" checked={respectProtectedDays} onChange={(event) => setRespectProtectedDays(event.target.checked)} /> Avoid {protectedDays}</label> : <p className="filter-empty">No protected days saved.</p>}<label><input type="checkbox" checked={afterEarliest} onChange={(event) => setAfterEarliest(event.target.checked)} /> Starts after {workspace.profile.earliestStart}</label><button className="text-button" type="button" onClick={clearFilters}>Clear filters</button><div className="source-status"><span>i</span><p><b>Catalog</b><small>{custom ? "Agent-built, source-backed" : `${institution.shortName} 2026-27 sources`}</small></p></div></aside><section className="result-section"><div className="section-heading"><div><h2>{query ? "Matching courses" : "Courses"}</h2><span className="count-badge">{results.length}</span></div><span className="muted">Best match</span></div>{results.length === 0 ? (catalog.courses.length === 0 ? <div className="agent-build-card"><div><h2>The catalog starts empty. Your agent fills it.</h2><p>{workspace.institution} has no shipped reference pack yet. Keep this workspace open and hand your agent the instruction below. Everything it adds shows up here with its source.</p></div><blockquote>{buildPrompt}</blockquote><button className="secondary-button" type="button" onClick={async () => { await navigator.clipboard.writeText(buildPrompt); setPromptCopied(true); window.setTimeout(() => setPromptCopied(false), 1800) }}>{promptCopied ? "Copied" : "Copy instruction"}</button></div> : <div className="library-empty"><span>⌕</span><h3>No courses match every filter</h3><p>Remove a constraint or search a broader topic.</p><button className="secondary-button" onClick={clearFilters}>Clear filters</button></div>) : <div className="result-list">{results.map(({ course, sections }) => { const added = plannedIds.has(course.id); const agentAdded = isOverlayCourse(workspace, course.id); const amended = agentAdded && baseCourseById.has(course.id); return <article className="course-result" key={course.id}><button className="result-code" type="button" onClick={() => setOpenCourseId(course.id)} aria-label={`Open ${course.code} details`}><span>{course.subject}</span><strong>{course.code.replace(`${course.subject} `, "")}</strong></button><div className="result-main"><div><h3><button type="button" className="course-title-link" onClick={() => setOpenCourseId(course.id)}>{course.code} · {course.title}</button></h3><p>{course.description}</p></div><div className="tag-row">{agentAdded && <span className="agent-added-tag">{amended ? "Updated by your agent" : "Added by your agent"}</span>}{course.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><dl><div><dt>Units</dt><dd>{course.minUnits === course.maxUnits ? course.minUnits : `${course.minUnits}–${course.maxUnits}`}</dd></div><div><dt>Sections</dt><dd>{sections.length || "Not stored"}</dd></div><div><dt>Meeting</dt><dd>{sections[0] ? `${dayLabel(sections[0].meetings[0].days)} ${sections[0].meetings[0].start}` : "Verify current term"}</dd></div></dl></div><div className="result-action"><span className={sections.length ? "evidence-current" : "evidence-gap"}>{sections.length ? "Times stored" : "Offering unknown"}</span><button className={added ? "secondary-button small" : "primary-button small"} type="button" disabled={added} onClick={() => add(course.id, sections[0]?.id, course.maxUnits, course.code)} aria-label={`${added ? "Added" : "Add"} ${course.code} to plan`}>{added ? "Added" : sections.length ? "Add to plan" : "Add and verify"}</button><button className="text-button" type="button" onClick={() => setOpenCourseId(course.id)}>Details</button></div></article> })}</div>}</section></div>
    </> : <div className="opportunity-section">
      <section className="explore-search"><label><SearchIcon width={16} height={16} /><input aria-label="Search clubs and research" value={opportunityQuery} onChange={(event) => setOpportunityQuery(event.target.value)} placeholder="Club, lab, program, or topic" /></label><div className="kind-chips" role="tablist" aria-label="Kinds">{opportunityKinds.map(([kind, label]) => <button key={kind} role="tab" aria-selected={opportunityKind === kind} className={opportunityKind === kind ? "active" : ""} onClick={() => setOpportunityKind(kind)}>{label}</button>)}</div><button className="secondary-button" type="button" onClick={() => setAddingOpportunity((value) => !value)}>{addingOpportunity ? "Cancel" : "Add a listing"}</button></section>
      {addingOpportunity && <form className="opportunity-form" onSubmit={(event) => { event.preventDefault(); submitOpportunity() }}>
        <div className="opportunity-form-row">
          <label>Kind<select value={newOpportunity.kind} onChange={(event) => setNewOpportunity((current) => ({ ...current, kind: event.target.value }))}><option value="club">Club</option><option value="research">Research</option><option value="program">Program</option></select></label>
          <label>Name<input required maxLength={100} value={newOpportunity.name} onChange={(event) => setNewOpportunity((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Link<input type="url" placeholder="https://" value={newOpportunity.url} onChange={(event) => setNewOpportunity((current) => ({ ...current, url: event.target.value }))} /></label>
        </div>
        <label>What is it?<input required maxLength={300} value={newOpportunity.summary} onChange={(event) => setNewOpportunity((current) => ({ ...current, summary: event.target.value }))}  /></label>
        <div className="opportunity-form-row">
          <label>Time commitment<input maxLength={80} value={newOpportunity.commitment} onChange={(event) => setNewOpportunity((current) => ({ ...current, commitment: event.target.value }))}  /></label>
          <label>When to apply<input maxLength={120} value={newOpportunity.timing} onChange={(event) => setNewOpportunity((current) => ({ ...current, timing: event.target.value }))}  /></label>
        </div>
        <div className="modal-actions"><button className="primary-button" type="submit">Add to the directory</button></div>
      </form>}
      {opportunities.length === 0 ? <div className="agent-build-card"><div><h2>No listings here yet.</h2><p>Add clubs and research programs yourself, or hand your agent the instruction below and let it research {workspace.institution}.</p></div><blockquote>{`Research clubs, research programs, and campus opportunities at ${workspace.institution} that fit my goals. Add the strong matches to this workspace with extend_reference, one listing at a time, each with a source.`}</blockquote></div> : <div className="opportunity-grid">
        {opportunities.map((item) => {
          const overlayEntry = overlayOpportunityIds.has(item.id)
          const base = baseOpportunityById.get(item.id)
          const changes = overlayEntry ? referenceChanges(base as unknown as Record<string, unknown> | undefined, item as unknown as Record<string, unknown>, ["name", "summary", "url", "commitment", "timing"]) : []
          return <article className="opportunity-card" key={item.id}>
            <div className="opportunity-card-top"><span className={`kind-pill ${item.kind}`}>{item.kind === "club" ? "Club" : item.kind === "research" ? "Research" : "Program"}</span>{overlayEntry && <span className="agent-added-tag">{base ? (item.addedBy?.type === "human" ? "Updated by you" : "Updated by your agent") : (item.addedBy?.type === "human" ? "Added by you" : "Added by your agent")}</span>}</div>
            <h3>{item.name}</h3>
            <p>{item.summary}</p>
            <dl>{item.commitment && <div><dt>Commitment</dt><dd>{item.commitment}</dd></div>}{item.timing && <div><dt>Timing</dt><dd>{item.timing}</dd></div>}</dl>
            {changes.length > 0 && <div className="reference-diff"><b>Changed from the shipped listing</b><ul>{changes.map((change) => <li key={change.field}><span>{change.label}</span><em>{change.was}</em><strong>{change.now}</strong></li>)}</ul></div>}
            <div className="opportunity-card-actions">
              {item.url && <a href={item.url} target="_blank" rel="noreferrer"><ExternalIcon width={13} height={13} /> Site</a>}
              <button className="text-button" type="button" onClick={() => saveOpportunityToLibrary(item)}>Save to Library</button>
              {overlayEntry && <button className="text-button" type="button" onClick={() => onCommand({ type: "remove_reference_opportunity", opportunityId: item.id })}>{base ? "Restore original" : "Remove"}</button>}
            </div>
          </article>
        })}
      </div>}
      <p className="opportunity-coverage">A starting directory, not the whole campus. Listings added here stay clearly separated from the shipped set.</p>
    </div>}
    {openCourse && <div className="drawer-backdrop" role="presentation" onMouseDown={() => setOpenCourseId(null)}>
      <aside className="course-drawer" aria-label={`${openCourse.code} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading"><div><p className="eyebrow">{openCourse.subject} · {openCourse.minUnits === openCourse.maxUnits ? `${openCourse.minUnits} units` : `${openCourse.minUnits} to ${openCourse.maxUnits} units`}</p><h2>{openCourse.code}</h2><p className="course-drawer-title">{openCourse.title}</p></div><button className="icon-button" type="button" onClick={() => setOpenCourseId(null)} aria-label="Close course details"><CloseIcon width={16} height={16} /></button></div>
        {isOverlayCourse(workspace, openCourse.id) && <div className="drawer-agent-note"><span>{openCourseBase ? "Updated in your workspace" : "Added in your workspace"}</span>{openCourseChanges.length > 0 && <div className="reference-diff"><ul>{openCourseChanges.map((change) => <li key={change.field}><span>{change.label}</span><em>{change.was}</em><strong>{change.now}</strong></li>)}</ul></div>}<button className="text-button" type="button" onClick={() => { onCommand({ type: "remove_reference_course", courseId: openCourse.id }); setOpenCourseId(null) }}>{openCourseBase ? "Restore the shipped entry" : "Remove from my reference"}</button></div>}
        <p className="course-drawer-description">{openCourse.description}</p>
        {prerequisiteCourses(openCourse).length > 0 && <section className="drawer-section"><h3>Prerequisites</h3><ul className="prerequisite-list">{prerequisiteCourses(openCourse).map((item) => { const done = workspace.profile.completedCourseIds.includes(item.id); return <li key={item.id}><span className={done ? "prerequisite-state done" : "prerequisite-state"}>{done ? "✓" : "○"}</span><b>{item.code}</b><small>{item.title}</small><em>{done ? "Completed" : "Not completed"}</em></li> })}</ul></section>}
        {openCourse.prerequisiteUncertain && <p className="drawer-uncertain">The prerequisite reading for this course needs review. Check the official listing before relying on it.</p>}
        <section className="drawer-section"><h3>{openSections.length ? "Sections" : "No stored section this term"}</h3>
          {openSections.length === 0 && <p className="drawer-empty-note">No current term meeting data is stored for this course. Verify the live schedule before counting on it.</p>}
          {openSections.map((section) => { const stale = sectionEvidence(section).some((item) => item.status === "stale"); return <div className="drawer-section-row" key={section.id}><div><b>Section {section.sectionNumber}</b><small>{section.meetings.map((meeting) => `${dayLabel(meeting.days)} ${meeting.start}–${meeting.end}`).join(", ")}{section.meetings[0]?.location ? ` · ${section.meetings[0].location}` : ""}</small><small className="muted">{section.instructor}</small></div><div className="drawer-section-actions"><span className={stale ? "evidence-gap" : "evidence-current"}>{stale ? "Stale evidence" : "Times stored"}</span><button className="secondary-button small" type="button" disabled={plannedIds.has(openCourse.id)} onClick={() => { add(openCourse.id, section.id, section.units, openCourse.code); setOpenCourseId(null) }}>{plannedIds.has(openCourse.id) ? "In plan" : "Add with this section"}</button></div></div> })}
        </section>
        {openCourse.sourceUrl && <a className="drawer-source-link" href={openCourse.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a>}
      </aside>
    </div>}
  </div>
}
