# Product brief

## Problem

Students make course decisions from fragmented institutional and personal context. Search tools surface classes, degree systems report progress, and department pages explain policies, but no single workspace maintains the evidence and reasoning behind a student's evolving plan.

The result is repetitive research, missed prerequisites, weak backup plans, forgotten constraints, and schedules that are technically valid but personally unsuitable.

## Product

Acorn is a planning workspace for a Stanford student and an AI agent. The student works through a calendar, the plan for every quarter to graduation, clubs and commitments, and a scratchpad. The agent works through twenty-two semantic WebMCP tools that read and edit the same workspace state.

One workspace snapshot holds everything both participants touch:

1. **Student context**: name, the two timeline dates, preferences, protected hours, and structured academic history including AP, IB, and transfer credit.
2. **Plans**: one per quarter, with courses, chosen sections, units, scenarios, backups, and commitments.
3. **Goals and todos**: the current goal with its milestones, and dated todos.
4. **Events and activities**: standalone timed events and recurring commitments such as clubs, work, and research.
5. **Context items and research**: notes, people, decisions, questions, links, and sourced research, all on the scratchpad.
6. **Reference overlay**: courses, sections, programs, and directory entries the agent adds or corrects, labeled and removable.
7. **The ledger**: every change with its actor, human or agent, and the receipt that undoes it.

Every change an agent makes lands in the same state the interface renders, through the same validated command as a click.

## Primary job

Turn a student's underspecified goal into a defensible schedule for the coming quarter, and keep the plan for later quarters honest as facts change, without the student reconstructing information across many sites.

## Judging persona

The shared workspace belongs to Julia Reyes, a fictional first-year interested in public policy, political science, and ballet, with a work-study block on Fridays. Her workspace carries both her own edits and her agent's, so the ledger shows the collaboration. Details are in `submission/demo-profile.md`. No real transcript or private student record is used anywhere.

## Human-agent collaboration loop

1. The student states or edits a goal on the scratchpad.
2. The agent reads the workspace before researching anything external.
3. When context is missing, the agent researches a public source and saves the result as a visible source card with provenance.
4. The agent builds the quarter from real catalog sections and checks it deterministically.
5. The interface shows the schedule, the conflicts, and the reasoning side by side.
6. The student changes a course, a note, or a commitment directly.
7. The agent sees the new state on its next read and repairs only what the change affected.
8. Enrollment stays with the university's own system.

## Success criteria, as shipped

- An agent completes the whole flow through the tools without operating low-level page controls.
- A direct interface change is visible to the agent on its next read, and the reverse.
- Conflicts, prerequisite gaps, and unit overloads are detected deterministically, never inferred by a model.
- Every agent change is attributed, visible, and undoable from the ledger.
- The student can create the same kinds of context objects as the agent.

## Expansion path

After the challenge, other universities arrive as agent-built adapters: a student names their school, and their agent constructs its reference layer through `extend_reference` from official sources, labeled and removable until curated.
