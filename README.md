# CourseContext

CourseContext is an agent-native academic planning workspace. It helps a student and an AI agent build a course plan together from personal goals, institutional requirements, live course information, and source-backed research.

The first vertical is Stanford next-quarter planning for the [WebMCP Challenge](https://openai.com/webmcp-challenge/). The product is designed to generalize to other colleges after the Stanford workflow is proven.

## Product thesis

Course planning is not primarily a calendar problem. It is a context problem.

The facts needed for one decision are scattered across course catalogs, degree-audit systems, department pages, advising guidance, syllabi, enrollment tools, and student experience. Existing planners help students search or arrange classes, but students still have to assemble the reasoning themselves.

CourseContext gives that reasoning a shared home:

- a student profile with goals, constraints, completed work, and preferences;
- an evidence library with sources, retrieval dates, confidence, and provenance;
- visual schedule scenarios that humans can directly manipulate;
- a decision ledger explaining inclusions, risks, alternatives, and open questions;
- WebMCP tools through which an agent can retrieve only the context it needs and update the same workspace the student sees.

## Why WebMCP

Without WebMCP, an agent must repeatedly inspect pages, operate filters, click cards, and reconstruct application state. CourseContext instead exposes meaningful academic-planning operations from the web app itself.

Proposed read tools:

```text
get_student_context
get_current_plan
search_courses
get_course
get_requirement_status
get_source_evidence
check_plan
compare_plans
list_uncertainties
```

Proposed mutation tools:

```text
create_plan
add_course
remove_course
record_preference
record_evidence
explain_recommendation
```

The visible interface and WebMCP tools must use the same domain logic and persistent state. Tool results must be structured, concise, provenance-aware, and sufficient to verify what changed.

## Challenge demo

A student asks:

> Build an Autumn schedule under 15 units that advances me toward CS, lets me explore product design, avoids Friday classes, and leaves time for research.

The agent should be able to:

1. inspect the student's current context;
2. identify missing information;
3. query relevant courses and requirements;
4. build two evidence-backed schedule scenarios;
5. check time, units, prerequisites, finals, workload balance, and uncertainty;
6. explain every recommendation and provide backups;
7. react to a human moving or removing a course without rebuilding unrelated work.

The student remains in control. The challenge version does not enroll in courses or represent itself as an official academic advisor.

## Evidence model

Every consequential claim is classified as one of:

- `official`: supported by a current institutional source;
- `experiential`: based on student-reported or community information;
- `inferred`: derived from incomplete facts or historical patterns;
- `user-provided`: supplied directly by the student.

Evidence records include the source URL or document, retrieval time, quoted or normalized claim, and confidence. Uncertainty is shown rather than silently converted into fact.

## Seven-day scope

The competition build focuses on one excellent next-quarter planning loop:

- a seeded Stanford demo profile;
- public, attributable Stanford information;
- course search and evidence inspection;
- a visual weekly schedule;
- two comparable plan scenarios;
- automated structural checks;
- human edits followed by agent revalidation;
- a non-trivial WebMCP tool surface;
- a public deployment and an under-three-minute demo video.

It does not attempt multi-university ingestion, official enrollment, a complete four-year optimizer, or authenticated Stanford data integration.

## Status

Product definition and challenge scope are being established. The application scaffold and technology choices have not yet been committed.

## Repository documents

- [AGENTS.md](AGENTS.md) — repository operating rules
- [CONTEXT.md](CONTEXT.md) — current product intent and durable requirements
- [Product brief](docs/product-brief.md) — audience, problem, workflow, and success criteria
- [Challenge plan](docs/challenge-plan.md) — submission requirements and seven-day schedule

## License

[MIT](LICENSE)
