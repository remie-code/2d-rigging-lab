---
name: planning-gate
description: Use before planning the next unit of a large, long-running, context-heavy task with a user, especially after context compaction or resumes, several implementation waves, unclear current implementation/AC/scenarios/tests, competing next-step options, or possible product/UX/API/scope/value-decision misalignment. Decide whether to plan directly, inventory first through bounded delegated research, discuss first with the user, or inventory then discuss; protect root context and shared understanding before implementation.
---

# Planning Gate

## Purpose

Use this skill before cutting the next work unit in a large task that cannot fully fit in one context window. The goal is to decide whether Codex is ready to plan, needs factual inventory, needs user discussion, or needs both.

Core principles:

- Do not confuse momentum with readiness.
- Do not confuse a plausible assumption with shared understanding.
- Do not let the root context become the inventory workspace.

## Gate Decision

Assess three risks before writing the next plan or starting implementation:

- Factual uncertainty: whether current implementation, acceptance criteria, scenarios, tests, docs, or backlog state must be rechecked.
- Decision uncertainty: whether user/product/UX/API/scope/value choices are needed and cannot be resolved from the repository.
- Cost of wrong planning: how much downstream work would be distorted by a wrong assumption.

Choose one mode:

| Mode | Use when |
| --- | --- |
| `Plan directly` | Facts and direction are fresh enough, the next unit is a local continuation, and wrong-plan cost is low. |
| `Inventory first` | Direction is mostly clear, but repository facts must be rebuilt before planning. |
| `Discuss first` | A user decision or shared-understanding check is needed before facts would meaningfully help. |
| `Inventory then discuss` | A user decision is likely needed, but the discussion would be vague until current facts are inventoried. |

## Inventory

When inventory is needed, root Codex owns the investigation design and integration. Delegate the actual investigation to Sylph or equivalent research subagents when available, especially if source/docs/tests would consume meaningful context.

Root Codex owns:

- Decide what must be learned before safe planning.
- Split inventory into bounded research questions.
- Specify each subagent's inputs, outputs, evidence expectations, and non-goals.
- Instruct subagents not to ask the user or make product/scope decisions.
- Integrate reports into a compact planning basis.
- Re-run this gate after inventory if readiness is still unclear.

Research subagents own:

- Read assigned source, docs, tests, reports, and scenarios.
- Report facts with paths, commands, uncertainty, risks, and gaps.
- Keep conclusions within the assigned question.
- Avoid product decisions, user-scope decisions, and implementation unless explicitly assigned.

Avoid:

- Asking a subagent to "survey everything" without bounded questions.
- Loading broad source/docs into root when a delegated inventory would protect context.
- Treating a subagent report as a user decision.
- Passing full conversation history unless it is truly necessary.

## Shared-Understanding Checks

Prefer asking when shared understanding may be misaligned. Do not hide assumptions inside a plan.

Ask or record shared-understanding checks when:

- Codex is relying on an inferred user preference.
- The choice affects product philosophy, UX meaning, scope, responsibility boundaries, public API, data model, naming, or acceptance criteria.
- Terms such as "automatic", "smart", "simple", "friendly", "safe", or "done" could reasonably mean different things.
- Several technical options are viable and the deciding factor is user value or product direction.
- A wrong assumption would distort multiple future work units.

Recommendations are allowed, but present them as recommendations, not decisions. Include the current assumption and why it matters. If the question can be answered by reading the repository or running tests, investigate instead of asking the user.

Plan files may include shared-understanding checks because they are user-readable artifacts. Mark which checks are blocking before implementation and which can be monitored during execution.

## Output Format

When this skill triggers, produce a compact gate result before the next plan:

```md
Planning Gate: Inventory then discuss

Why:
- ...

Uncertainty:
- factual: low | medium | high
- decision: low | medium | high
- cost of wrong plan: low | medium | high

Context needed:
- ...

Delegation plan:
- Sylph A: ...
- Sylph B: ...

Shared-understanding checks:
- I am assuming X. Is that correct?
- I recommend A over B because ..., but this should be a user decision.

Minimum next action:
- ...

Do not proceed with:
- ...
```

Omit irrelevant sections only when they are genuinely empty. If no user decision is needed, say so explicitly.

## After The Gate

- For `Plan directly`, write the next plan and proceed according to the user's autonomy instructions.
- For `Inventory first`, delegate or perform only the minimum needed inventory, integrate the result, then decide whether to plan or discuss.
- For `Discuss first`, ask the user before writing an implementation plan that depends on the answer.
- For `Inventory then discuss`, inventory first, then present the relevant facts and shared-understanding checks to the user.
