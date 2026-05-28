# Development Convention Review

## Status

Accepted

## Scope

This review covers the P0/P1 development convention documents created under `discussion/development_convention/` from the authoritative basis set:

- `discussion/development_convention/basis/00_overview.md`
- `discussion/development_convention/basis/01_common_policy_template.md`
- `discussion/development_convention/basis/02_p0_policy_specs.md`
- `discussion/development_convention/basis/03_p1_policy_specs.md`
- `discussion/development_convention/basis/04_required_diagrams_and_tables.md`

It also checks alignment with `discussion/_conventions.md`, `discussion/acceptance-criteria/`, `discussion/scenarios/`, `discussion/design/module-contracts/`, `discussion/tests/`, `discussion/demo/streaming-demo-policy.md`, and `discussion/proposal/live2d-feature-proposal-template.md`.

## Reviewed Documents

| Priority | Policy | Status | Mermaid diagrams | Required table groups | Verdict |
|---|---|---:|---:|---:|---|
| P0 | `source-of-truth-policy.md` | Accepted | 2 | 3 | pass |
| P0 | `repository-structure-policy.md` | Accepted | 3 | 3 | pass |
| P0 | `module-boundary-policy.md` | Accepted | 3 | 4 | pass |
| P0 | `schema-and-id-conventions.md` | Accepted | 2 | 3 | pass |
| P0 | `runtime-and-dynamics-implementation-policy.md` | Accepted | 3 | 4 | pass |
| P0 | `operation-policy.md` | Accepted | 2 | 3 | pass |
| P0 | `testing-and-acceptance-policy.md` | Accepted | 4 | 4 | pass |
| P0 | `diagnostic-policy.md` | Accepted | 2 | 3 | pass |
| P0 | `implementation-orchestration-policy.md` | Accepted | 5 | 7 | pass |
| P1 | `gui-implementation-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `ai-assistant-implementation-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `demo-rights-ip-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `dependency-policy.md` | Accepted | 2 | 4 | pass |
| P1 | `review-and-pr-policy.md` | Accepted | 2 | 4 | pass |
| P1 | `subagent-workflow-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `e2e-test-policy.md` | Accepted | 4 | 4 | pass |

## Findings

### Blocking

None.

### Warnings

| ID | Finding | Impact | Required follow-up |
|---|---|---|---|
| None | No blocking or warning findings remain after review_010 integration. | N/A | N/A |

### Suggestions

| ID | Finding | Suggested action |
|---|---|---|
| SUG-DEVCONV-001 | Several policies still include local Conflict Resolution Log examples for the earlier path mismatch. | The path mismatch is resolved in basis. During a later cleanup, either mark those local entries as resolved in place or consolidate them into `discussion/development_convention/conflicts/conflict-resolution-log.md`. |

## Basis Compliance

| Gate | Result | Evidence |
|---|---|---|
| All P0/P1 policies exist | pass | 16 policy files exist under `discussion/development_convention/`. |
| Common template sections exist | pass | Each policy contains Status, Purpose, Scope, Source Documents, Required Decisions, Required Diagrams, Required Tables, Rules, Forbidden, Required Evidence, Review Checklist, Conflict Handling, Change Process, and Completion Gate. |
| Required Decisions exist | pass | Each policy has numbered `DEC-*` decisions matching its scope. |
| Required diagrams exist | pass | Diagram counts match `04_required_diagrams_and_tables.md`: 45 Mermaid diagrams total across all policies. |
| Required tables exist | pass | Required table groups are present for each policy. |
| Rules / Forbidden / Evidence / Checklist exist | pass | All policies include explicit rules, forbidden actions, required evidence, and review checklist sections. |
| Conflict handling exists | pass | Each policy defines conflict handling and a Conflict Resolution Log format or current log. |
| P0 readiness | pass | P0 policies define source authority, repository structure, module boundaries, schema/ID, runtime/dynamics, operations, tests/acceptance, diagnostics, and implementation orchestration before implementation starts. |
| P1 readiness | pass | P1 policies define GUI, AI, demo/rights/IP, dependencies, review/PR, subagent workflow, and E2E requirements before corresponding module implementation. |

## Guardrail Review

| Guardrail | Result |
|---|---|
| Monorepo is fixed | pass |
| Baseline remains Private 2D Rigging Lab / Prototype | pass |
| Minimum Open Dynamics v1 remains in MVP | pass |
| RuntimeStateDto is explicit input/output and not hidden mutable state | pass |
| RuntimeState artifact and RuntimeState sequence artifact are distinct | pass |
| Operation Core is the mutation boundary | pass |
| AI changes require dry-run and human approval before commit | pass |
| `/goal` as Undine, Wave 0, two-lane review, Integrator review, persistent reports, and early escape are defined | pass |
| Clean Context Review is a review execution mode, not a review lane | pass |
| Candidate diagnostics alone cannot be MVP-blocking oracle | pass |
| Structured evidence, not screenshots alone, is the primary acceptance basis | pass |
| Cubism formats, SDK/Core, Viewer consistency, Physics compatibility, and existing Cubism models are not implementation/test/acceptance oracles | pass |
| Machine-readable IDs must contain no spaces | pass |

## Integrator Decision

The P0/P1 development convention document set is accepted for the requested `discussion/development_convention/` output location.

`implementation-orchestration-policy.md` is now integrated as a P0 policy. The basis path mismatch noted in the previous review has been resolved by treating `discussion/development_convention/` and `discussion/development_convention/basis/` as canonical paths.
