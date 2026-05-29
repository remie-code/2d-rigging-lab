# Wave 12 Domain F Completion: Runtime Keyform Fixture

> Wave: `runtime-keyform-evaluation-foundation`
> Domain: `wave12-runtime-keyform-fixture`
> Orchestrator: Orch-Sylph
> Verdict: `pass`

## Scope Changed

- Added a compact runtime keyform evaluation contract fixture.
- Added fixture expected output for a runtime-visible 1D mesh vertices keyform case.
- Added a runtime-core fixture regression test.
- Recorded why Grid2D is kept in Domain B unit coverage instead of this compact fixture.
- Added persistent Domain F review and completion reports.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/implementation/waves/wave12/wave12-runtime-snapshot-keyform-integration-completion.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-sampling-foundation-completion.md`
- `discussion/implementation/reviews/wave12/wave12-runtime-keyform-sampling-foundation-review.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Implementation Summary

- Added `fixtures/contracts/runtime-keyform-evaluation-foundation/`.
- The fixture contains a compact `NormalizedRuntimeGraph`-style runtime graph with one authored input parameter, one drawable/mesh, and one `linear-1d-v1` keyform binding targeting mesh `vertices`.
- Added baseline and evaluated frame requests. The evaluated frame samples the keyform at `param_fixture_yaw = 1`.
- Added expected output that fixes:
  - baseline and evaluated `keyformSamples`,
  - evaluated drawable bounds, vertex hash, vertices, draw list, and diagnostics,
  - runtime comparison output showing non-equivalence and a drawable vertex/bounds change.
- Added `runtime/grid2d-coverage-note.json` and referenced it from `fixture-manifest.json` to record that `parameter-grid-2d-v1` stays in Domain B runtime-core unit coverage for this compact fixture scope.
- Added `packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts` to load fixture JSON, parse it, build a runtime graph, evaluate baseline/evaluated snapshots, and compare expected snapshot/diff output.

## Orchestration

- Implementation was delegated to Gnome with a bounded write scope.
- Clean review was delegated to Review-Sylph with basis documents, changed files, and a Design / Development Compliance plus Test Adequacy rubric.
- Initial review returned `needs_changes` for missing Grid2D omission rationale.
- Orch-Sylph applied the focused fix and strengthened baseline assertions.
- Follow-up Review-Sylph verification returned `pass`.

## Review Findings and Resolution

| Finding | Resolution |
|---|---|
| Blocking: Grid2D omission rationale missing. | Added `runtime/grid2d-coverage-note.json`, referenced it from `fixture-manifest.json`, and asserted it in the fixture test. |
| Non-blocking: baseline `keyformSamples`, `drawList`, and `diagnostics` not directly asserted. | Added baseline expected values and direct test assertions. |

Persistent review report:

- `discussion/implementation/reviews/wave12/wave12-runtime-keyform-fixture-review.md`

## Files Changed

- `fixtures/contracts/runtime-keyform-evaluation-foundation/fixture-manifest.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/runtime/runtime-graph.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/runtime/grid2d-coverage-note.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/request/evaluation-options.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/request/evaluation-context.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/request/baseline-frame.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/request/evaluated-frame.json`
- `fixtures/contracts/runtime-keyform-evaluation-foundation/expected/runtime-keyform-effect-summary.json`
- `packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts`
- `discussion/implementation/reviews/wave12/wave12-runtime-keyform-fixture-review.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-fixture-completion.md`

## Verification Performed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts` | Initial sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`; escalated final rerun passed, 1 file / 1 test |
| `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/snapshot-keyform-integration.test.ts packages/runtime-core/src/keyform-sampling.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | Escalated final rerun passed, 5 files / 16 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Escalated final rerun passed, 16 files / 40 tests |
| `pnpm.cmd typecheck` | Escalated final rerun passed |
| `git diff --check -- fixtures/contracts/runtime-keyform-evaluation-foundation packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts discussion/implementation/waves/wave12/wave12-runtime-keyform-fixture-completion.md discussion/implementation/reviews/wave12/wave12-runtime-keyform-fixture-review.md` | Passed for tracked diff content |
| PowerShell wrapper invoking `git diff --check --no-index -- NUL <file>` for every touched untracked fixture/test/report file, filtering CRLF-only warnings | Passed; no whitespace errors |

## Remaining Issues

- None blocking.
- Domain F did not edit Domain E runtime evidence, editor, or AI regression tests.
- Grid2D fixture expansion is deferred because the compact fixture records the omission rationale and Domain B owns Grid2D unit coverage.

## User-Decision Points

- None.

## Provisional Assumptions

- Runtime-core graph fixture format is acceptable because this domain fixes runtime keyform evaluation behavior rather than package-format roundtrip coverage.
- Adding a fixture-local coverage note as an input artifact is acceptable for recording an explicit omission rationale without inflating the runtime oracle.
