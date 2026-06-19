# Wave85 Domain A Spec Compliance Review

## Verdict

pass

No blocking spec-compliance findings were found for Domain A. The projection covers the required deterministic warning set, keeps the implementation editor-local and read-only, and does not introduce forbidden v0 scope.

## Scope reviewed

- Wave: Wave85 `validation-diagnostics-v0`
- Domain: `wave85-editor-local-diagnostics-projection`
- Lane: Spec Compliance Review
- Reviewed source:
  - `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
  - `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
- Reviewed artifact:
  - `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`

## Basis documents used

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`
- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/parameter-presets.ts`
- `packages/contracts/src/ids.ts`
- `packages/authoring-core/src/parameter-surface.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`

## Findings

No findings.

| Severity | File / line refs | Issue | Recommendation |
|---|---|---|---|
| none | `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts:66`, `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts:53` | Required Domain A projection behavior is present; no forbidden-scope behavior found. | Proceed to the remaining Wave85 lanes/domains. |

## Spec coverage checklist

| Requirement | Status | Evidence |
|---|---|---|
| Mesh missing for Drawable used by Deformer / Keyform target | pass | `createMeshDiagnostics()` checks drawables with missing mesh ids and deformer/keyform use: `editor-diagnostics-state.ts:85`; helpers at `editor-diagnostics-state.ts:456` and `editor-diagnostics-state.ts:469`; test at `editor-diagnostics-state.test.ts:54`. |
| Missing keyform parameter | pass | `createKeyformReferenceDiagnostics()` checks parameter refs: `editor-diagnostics-state.ts:139`; test at `editor-diagnostics-state.test.ts:103`. |
| Missing keyform target Drawable / Deformer | pass | Drawable target check at `editor-diagnostics-state.ts:192`; Deformer target check at `editor-diagnostics-state.ts:218`; test at `editor-diagnostics-state.test.ts:103`. |
| Missing Deformer parent | pass | Parent check at `editor-diagnostics-state.ts:267`; test at `editor-diagnostics-state.test.ts:145`. |
| Missing Deformer child | pass | Drawable/deformer child checks at `editor-diagnostics-state.ts:290` and `editor-diagnostics-state.ts:305`; item helper at `editor-diagnostics-state.ts:574`; test at `editor-diagnostics-state.test.ts:145`. |
| Deformer parent cycle | pass | Cycle projection at `editor-diagnostics-state.ts:506`; test at `editor-diagnostics-state.test.ts:145`. |
| Dynamics missing input parameter | pass | Input parameter check at `editor-diagnostics-state.ts:330`; test at `editor-diagnostics-state.test.ts:179`. |
| Dynamics missing output parameter | pass | Output parameter check at `editor-diagnostics-state.ts:363`; test at `editor-diagnostics-state.test.ts:179`. |
| Duplicate Dynamics output ownership in existing data | pass | Duplicate owner projection at `editor-diagnostics-state.ts:422`; test at `editor-diagnostics-state.test.ts:179`. |
| Dynamics output keyform missing | pass | Missing-keyform item at `editor-diagnostics-state.ts:393`; keyform parameter set at `editor-diagnostics-state.ts:482`; tests at `editor-diagnostics-state.test.ts:179` and `editor-diagnostics-state.test.ts:205`. |
| Stable warning item count | pass | `warningItemCount` projection and helper at `editor-diagnostics-state.ts:57`, `editor-diagnostics-state.ts:76`, and `editor-diagnostics-state.ts:670`; repeated id/count assertions at `editor-diagnostics-state.test.ts:189`. |

## Accepted v0 semantics

| Semantics | Status | Evidence |
|---|---|---|
| Deterministic read-only warnings only | pass | Projection is a pure function over `AuthoringSession` data: `editor-diagnostics-state.ts:66`; clone/no-mutation assertion at `editor-diagnostics-state.test.ts:74`. |
| Not completion score / quality judgement | pass | Only reference, mesh-presence, and Dynamics keyform-presence facts are projected; no score, readiness, naturalness, or quality logic found in the changed source. |
| No Product Preflight wholesale migration | pass | Changed source imports only authoring/contracts and local parameter helpers: `editor-diagnostics-state.ts:1`; no Product Preflight imports or payload projection found. |
| No global mesh failure history | pass | Domain A adds no editor session state or persisted history; mesh diagnostics are recomputed from current graph data in `createMeshDiagnostics()`: `editor-diagnostics-state.ts:85`. |
| No Viewer diagnostics | pass | No Viewer/runtime UI files or imports are touched by Domain A; changed source is confined to `features/editor-session/model`. |
| Output-keyform-missing means no keyformSet exists for the output parameter | pass | Implementation builds a set of keyform parameter refs and checks only set membership: `editor-diagnostics-state.ts:326`, `editor-diagnostics-state.ts:393`, `editor-diagnostics-state.ts:482`; no visible-effect inference is present. |
| No warning when at least one keyformSet exists for the output parameter | pass | Direct negative test at `editor-diagnostics-state.test.ts:205`. |
| Badge count is warning item count | pass | `warningItemCount` counts warning items, not affected targets: `editor-diagnostics-state.ts:57`, `editor-diagnostics-state.ts:76`, `editor-diagnostics-state.ts:670`; test asserts count helper parity at `editor-diagnostics-state.test.ts:198`. |

## Verification reviewed

- Read the plan, screen spec, backlog, Domain A report, changed projection source, and changed tests from source.
- Ran focused projection test:
  - Initial sandbox run failed with esbuild `spawn EPERM`, matching the implementer report.
  - Escalated rerun passed: `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
  - Result: 1 test file passed, 5 tests passed.
- Ran focused whitespace check:
  - `git diff --check -- apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
  - Result: passed.
- Reviewed implementer report evidence that `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, and `node scripts/check-dependencies.mjs` passed. Those broader checks were not rerun in this lane.

## Residual risks / user-decision points

- Validate screen, badge rendering, jump execution, tree icons, Mesh Tool inline diagnostics, Dynamics Tool UI surfacing, and Viewer negative UI coverage are intentionally outside Domain A and remain for later Wave85 domains/reviews.
- Domain A action hints are metadata only. Whether each hint maps to the final safest navigation behavior must be reviewed in Domain B/C.
- No user-decision point is required from this lane.
