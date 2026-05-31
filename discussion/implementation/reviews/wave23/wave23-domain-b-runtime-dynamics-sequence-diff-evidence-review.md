# Wave 23 Domain B Review: Runtime Dynamics Sequence / Diff / Evidence

## Verdict

`pass`

Review-Sylph independent review found no blocking, high, medium, or low findings.

Domain B can pass. Domain D/E can proceed after Domain C also passes, with the note that editor/fixture work should add at least one end-to-end fixture or UI smoke proving a dynamics-computed output parameter drives a normal keyform/rig-control projection.

## Scope Reviewed

Target: `wave23-runtime-dynamics-sequence-diff-evidence`

Domain B runtime-core files reviewed:

- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/dynamics-evaluation.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/runtime-core/src/state-compatibility.ts`
- `packages/runtime-core/src/index.ts`

Workspace status also contains Domain A authoring/operation-core changes and parallel Domain C validator-core changes. Those were treated as dependency/context changes, not Domain B implementation, except where operation evidence integration tests were useful.

## Basis Checked

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave23-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/implementation/waves/wave22/wave22-final-report.md`
- `discussion/implementation/waves/wave23/wave23-domain-a-dynamics-authoring-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave23/wave23-domain-a-dynamics-authoring-operation-foundation-review.md`

## Findings

None.

## Design / Development Compliance

Result: `pass`

- Deterministic runtime semantics are implemented without randomness, wall-clock time, browser frame timing, timers, or renderer dependency. The solver uses explicit `deltaTimeMs`, prior `RuntimeStateDto.fixedStepMs`, accumulator/substep calculation, and bounded `maxSubSteps` (`packages/runtime-core/src/runtime-core.ts:120`, `packages/runtime-core/src/runtime-core.ts:126`, `packages/runtime-core/src/runtime-core.ts:128`, `packages/runtime-core/src/dynamics-evaluation.ts:127`).
- Minimal Open Dynamics v1 remains parameter-driven. Target computation uses authored driver parameter values, weighted sum, output scale/offset, amplitude limit, and output clamp; it does not read mesh, rig control, drawable, mask, renderer, or browser state (`packages/runtime-core/src/dynamics-evaluation.ts:39`, `packages/runtime-core/src/dynamics-evaluation.ts:51`, `packages/runtime-core/src/dynamics-evaluation.ts:163`).
- Runtime sequence integration advances explicit state and returns snapshots/final state through existing APIs (`packages/runtime-core/src/runtime-core.ts:49`, `packages/runtime-core/src/runtime-core.ts:77`, `packages/runtime-core/src/runtime-core.ts:149`).
- Reset and initial state handling are explicit. Initial group state starts at current target with zero velocity, tick 0, resetCounter 1; frame reset reasons reinitialize group state and increment/reset counters through the evaluator path (`packages/runtime-core/src/initial-state.ts:11`, `packages/runtime-core/src/initial-state.ts:23`, `packages/runtime-core/src/dynamics-evaluation.ts:68`, `packages/runtime-core/src/dynamics-evaluation.ts:72`).
- State compatibility keeps missing/unknown dynamics state visible via structured diagnostics and initializes missing active groups from current target (`packages/runtime-core/src/state-compatibility.ts:45`, `packages/runtime-core/src/state-compatibility.ts:49`, `packages/runtime-core/src/state-compatibility.ts:69`, `packages/runtime-core/src/state-compatibility.ts:73`).
- Snapshot/evidence includes dynamics state, driver input relation, output parameter, computed output, fixed step, tick/reset counters, and targeted/full debug target values without requiring viewer app code (`packages/runtime-core/src/snapshot.ts:75`, `packages/runtime-core/src/snapshot.ts:79`, `packages/runtime-core/src/snapshot.ts:81`, `packages/runtime-core/src/snapshot.ts:87`, `packages/runtime-core/src/snapshot.ts:247`, `packages/runtime-core/src/snapshot.ts:264`).
- Computed dynamics values are merged into effective parameter values before keyform sampling, so the runtime projection is usable by existing keyform evaluation (`packages/runtime-core/src/parameter-resolution.ts:39`, `packages/runtime-core/src/parameter-resolution.ts:45`, `packages/runtime-core/src/snapshot.ts:159`, `packages/runtime-core/src/snapshot.ts:164`).
- Runtime diff now exposes dynamics additions/removals and state/output changes with before/after position, velocity, tick, and resetCounter where available (`packages/runtime-core/src/snapshot-comparison.ts:24`, `packages/runtime-core/src/snapshot-comparison.ts:40`, `packages/runtime-core/src/snapshot-comparison.ts:79`).
- Existing keyform runtime behavior remains compatible; existing keyform/snapshot/diff focused tests passed unchanged.
- Non-goals are respected. No editor, validator, parser, asset I/O, file picker, external dependency, direct vertex physics, or Cubism Physics compatibility implementation was added by Domain B. A forbidden-scope scan over runtime-core found no matches.
- Source organization complies with policy: `dynamics-evaluation.ts` owns the new solver responsibility, existing runtime files keep their focused roles, and `index.ts` only adds a barrel export (`packages/runtime-core/src/index.ts:6`).

## Test Adequacy

Result: `pass`

Coverage is adequate for Domain B risk:

- Deterministic sequence replay is directly tested with identical input sequence producing identical output and final state tick/reset counter assertions (`packages/runtime-core/src/dynamics-evaluation.test.ts:16`, `packages/runtime-core/src/dynamics-evaluation.test.ts:51`).
- Snapshot projection verifies dynamics driver values, computed output parameter, effective value, fixed step, reset debug fields, and output state relation (`packages/runtime-core/src/dynamics-evaluation.test.ts:58`, `packages/runtime-core/src/dynamics-evaluation.test.ts:99`, `packages/runtime-core/src/dynamics-evaluation.test.ts:104`).
- Runtime diff/evidence verifies added dynamics groups, computed output parameter diff, final runtime state, and candidate snapshot evidence (`packages/runtime-core/src/dynamics-evaluation.test.ts:117`, `packages/runtime-core/src/dynamics-evaluation.test.ts:155`, `packages/runtime-core/src/dynamics-evaluation.test.ts:170`).
- Existing runtime-core tests continue to cover keyform sampling/application, snapshot diff behavior, parameter resolution, state sequence artifacts, texture projection, and dependency boundary.

Residual test risk is non-blocking:

- The code path merges `computedDynamics` into effective parameter values before keyform sampling, but the new Domain B test does not include a drawable/keyform whose parameter is the dynamics output. Domain D/E should add an editor or fixture-level proof for the full dynamics output -> keyform/rig-control projection once their scopes introduce concrete UI/fixture evidence.

## Verification

Commands run independently:

| Command / check | Result |
|---|---|
| `git status --short -uall` | Shows expected Domain B runtime-core changes, Domain A foundation changes, and parallel Domain C validator-core changes. |
| `git diff -- packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/snapshot-comparison.ts packages/runtime-core/src/initial-state.ts packages/runtime-core/src/state-compatibility.ts packages/runtime-core/src/index.ts` | Reviewed. Changes are runtime-core scoped. |
| Read `packages/runtime-core/src/dynamics-evaluation.ts` and `packages/runtime-core/src/dynamics-evaluation.test.ts` directly | Reviewed untracked Domain B files. |
| `pnpm.cmd exec vitest run packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | pass; 5 files / 18 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | pass; 19 files / 59 tests |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts` | pass; 2 files / 21 tests |
| `pnpm.cmd typecheck` | pass; root and editor typecheck completed |
| `pnpm.cmd run check:source` | pass; source organization guard passed |
| `pnpm.cmd run check:deps` | pass; dependency guard passed |
| `git diff --check -- packages/runtime-core packages/operation-core discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; CRLF working-copy warnings only |
| Manifest diff scan for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor/package.json`, `packages/*/package.json` | pass; no output |
| Runtime-core forbidden-scope scan for Cubism/proprietary parser/file-picker/decode/timer/random/browser-frame APIs | pass; no matches |

## Escalation / User Decision Points

None.

## Residual Risks

- Domain C validator changes were present in the same workspace but were not reviewed as Domain B implementation. They must pass their own review before Domain D/E proceed.
- Runtime evidence can represent dynamics state/output and sequence artifacts now, but fixture/acceptance evidence for `minimal-dynamics-hairSway` remains Domain E scope.
- Editor preview controls and reset/run UX remain Domain D scope.
- The solver is intentionally Minimum Open Dynamics v1 only. It is not direct vertex physics, cloth/collision/IK, Cubism Physics compatibility, or a `.physics3.json` runtime.
