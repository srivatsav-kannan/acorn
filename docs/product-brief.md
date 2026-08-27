# Product brief

## Problem

Students make course decisions from fragmented institutional and personal context. Search tools surface classes, degree systems report progress, and department pages explain policies, but no single workspace maintains the evidence and reasoning behind a student's evolving plan.

The result is repetitive research, missed prerequisites, weak backup plans, forgotten constraints, and schedules that are technically valid but personally unsuitable.

## Product

CourseContext is a shared decision workspace for a student and an AI agent. The student works through a visual schedule, preferences, and plan comparisons. The agent works through semantic WebMCP tools that query and mutate the same application state.

The system stores four connected models:

1. **Student context** — goals, completed courses, programs, interests, time constraints, and workload preferences.
2. **Evidence** — sourced academic facts, experiential information, inference, and user-provided claims.
3. **Plan scenarios** — courses, sections, units, schedule, requirement coverage, backups, and checks.
4. **Decision ledger** — rationale, tradeoffs, risks, alternatives, and unresolved questions.

## Primary job

When planning an upcoming quarter, help a student turn an underspecified goal into two defensible schedule options without manually reconstructing information across many sites.

## Demo persona

The initial demo should use a fictional Stanford student whose goal contains multiple interacting constraints, such as:

- make progress toward a declared or prospective program;
- explore one adjacent interest;
- remain below a unit ceiling;
- avoid a day or time window;
- preserve time for research or another commitment;
- include a backup for a course with uncertain availability.

No real transcript or private student record should be used.

## Human-agent collaboration loop

1. The human states or edits goals in the visible workspace.
2. The agent retrieves only the relevant student and institutional context.
3. The agent records missing evidence and builds candidate plans.
4. Deterministic checks identify conflicts and violations.
5. The UI presents schedules, rationale, evidence, and uncertainty side by side.
6. The human changes a course or priority directly.
7. The agent sees the new state and revalidates only affected decisions.
8. The human accepts a plan as a personal planning artifact, not an official enrollment action.

## Initial success criteria

- A model can complete the demo through WebMCP without operating low-level page controls.
- The human can understand why every course was recommended.
- A direct UI change is visible to the agent on its next read.
- At least one constraint violation is detected deterministically.
- At least one uncertain claim is displayed as uncertain rather than asserted as fact.
- The same task requires materially more interaction through a UI-only baseline.

## Expansion path

After the challenge, separate institution adapters can normalize public catalogs and requirements into a common evidence model. Expansion is conditional on proving the Stanford workflow first.
