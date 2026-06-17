# Wave81 Final Integration Report

## Status

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`.
- Domain: `wave81-final-integration-clean-review-map-closeout`.
- Status: final complete / pass.
- Domain A: pass-classified after Fix Loop 1 re-review.
- Domain B: pass-classified.
- Final clean review: initial result `needs_changes`; blocker F1 was addressed in Fix Loop 1; clean re-review verdict is `pass` at `discussion/implementation/reviews/wave81/wave81-final-clean-integration-review.md`.
- Domain C source implementation was limited to Fix Loop 1 for initialized preset parameter Dynamics reference authority.

## Basis

- `discussion/implementation/orchestration/wave81-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- Domain A implementation report and three review lanes.
- Domain B implementation report and three review lanes.
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`

## Domain Gate Confirmation

Domain A is accepted as pass-classified because:

- Domain A Spec Compliance Review initially found two blockers, then records Fix Loop 1 re-review verdict `pass`.
- Domain A Design / Development Compliance Review records `pass`, including Fix Loop 1 delta re-review `pass`.
- Domain A Test Adequacy Review records post-fix verdict `pass`.

Domain B is accepted as pass-classified because:

- Domain B Spec Compliance Review records `pass`.
- Domain B Design / Development Compliance Review records `pass`.
- Domain B Test Adequacy Review records `pass`.

## Integrated Evidence

### Dynamics v2 schema and stale removal result

- `packages/package-format/src/model-files.ts` defines `dynamics-file-v2`, v2 `inputs`, exactly one `pendulums` entry, exactly one `outputs` entry, and normalization ordering checks.
- `packages/package-format/src/package-document.test.ts` accepts a non-empty v2 additive pendulum group and rejects invalid v0 cardinality / normalization.
- Active old operation IDs and solver symbols were removed from active source: final Domain C search over `packages`, `apps`, and `fixtures` found no active matches for `scalarDampedFollowV1`, `dynamics-file-v1`, `bindDynamicsDriver`, `bindDynamicsOutput`, `setDynamicsSettings`, `resetDynamicsPreviewState`, `runDynamicsPreviewSequence`, `Minimum Open Dynamics v1`, `scalar dynamics evidence`, `stateSummary.position`, or `stateSummary.velocity`.
- `computedDynamics` remains only as a general parameter `valueSource` variant and historical/test value-source case. Dynamics v2 output ownership and runtime application no longer require it.

### Additive offset runtime contract

- `packages/runtime-core/src/dynamics-evaluation.ts` exposes `stepDynamics(...)` and returns `outputOffsets`.
- `packages/runtime-core/src/parameter-resolution.ts` computes `baseValue`, adds the Dynamics output offset, then clamps the `effectiveValue`.
- `packages/runtime-core/src/parameter-resolution.test.ts` proves `baseValue: 0.4`, `dynamicsOffset: 0.25`, and `effectiveValue: 0.65`.
- `packages/runtime-core/src/snapshot.ts` records `additivePendulumV0` runtime evidence fields rather than replacement-style v1 output.

### Effective parameter injection boundary

- `packages/runtime-core/src/snapshot.ts` calls `resolveEffectiveParameterValues(...)` before keyform/deformer evaluation and uses the resulting effective parameter map for snapshot evaluation.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` switches Canvas evaluation to `dynamicsToolPreviewEvaluation.parameterValues` when `activeTool === "dynamics"`.
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts` proves a Dynamics additive output value drives existing rotation keyform evaluation.

### Save/load proof

- `packages/authoring-core/src/dynamics-mutations.test.ts` proves a created Dynamics Group materializes into a package-valid `dynamics-file-v2` model file.
- `packages/authoring-core/src/portable-project-bundle.test.ts` now uses a non-empty v2 Dynamics Group and asserts export/import preservation of `inputs`, `pendulums`, `outputs`, input normalization, and output `kind` / `strength` / `limit` / `invert`.
- Fix Loop 1 adds portable proof that a Dynamics Group referencing initialized preset parameters round-trips while `model.parameters.parameters` remains empty and import/runtime graph resolution still sees the preset refs.
- Domain B did not alter the package save/load schema. Editor preview state stays local and is not part of portable project export.

### Operation/history proof

- `packages/operation-core/src/operation-registry.ts` registers `createDynamicsGroup`, `updateDynamicsGroup`, and `deleteDynamicsGroup`.
- `packages/operation-core/src/operations/create-dynamics-group.ts` validates v0 cardinality and writes v2 `inputs` / `pendulums` / `outputs`.
- `packages/operation-core/src/operations/update-dynamics-group.ts` updates v2 input, pendulum, and output fields.
- `packages/operation-core/src/operations/delete-dynamics-group.ts` deletes the group through authoring-core mutation.
- `packages/operation-core/src/operation-lifecycle.test.ts` proves create/delete registry commits and operation log entries.
- `apps/editor/src/features/editor-session/editor-session-context.tsx` routes committed create/update/delete commands through `runCommandWithHistory`, while preview group selection, driver scrub, and reset update local React state only.
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts` proves preview selection/driver/reset do not add history entries.
- Fix Loop 1 proves authoring-core and operation-core create/update commits accept initialized preset driver/output refs from otherwise empty graphs, and the Editor provider create/apply path is not rejected for those candidates.

### Validation proof

- `packages/validator-core/src/validators/dynamics-semantic.ts` emits blocking diagnostics for missing input, invalid pendulum cardinality, invalid output cardinality, invalid normalization, missing refs, and duplicate output ownership.
- `packages/validator-core/src/check-catalog.ts` catalogs the v2 diagnostics with additive pendulum wording.
- `packages/validator-core/src/dynamics-semantic.test.ts` directly covers missing input, invalid pendulum/output cardinality, invalid normalization, duplicate additive output ownership, warnings, and runtime evidence mismatch.
- Fix Loop 1 aligns Dynamics semantic parameter reference checks with the initialized parameter surface and proves initialized preset refs pass while truly missing refs still fail, including after portable package export/import.

### Editor Dynamics Inspector behavior

- `apps/editor/src/workspace/panels/inspector-panel.tsx` renders `DynamicsToolInspector` for `activeTool === "dynamics"` instead of falling through to selection inspectors.
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx` provides group list/select, create/apply/delete, name/enabled/preset controls, input rows, Advanced normalization, pendulum/output controls, validation, and session-local preview controls.
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts` derives normalization defaults from parameter min/default/max, supports multiple driver inputs, defaults output kind to `angle`, validates duplicate ownership, and computes preview evaluation from parameter defaults plus Inspector-local driver values.

### Parameter Bar disablement

- `apps/editor/src/workspace/panels/parameter-bar.tsx` sets `disabledForDynamics` when `activeTool === "dynamics"` and disables value controls, keyform actions, marker/scrub handling, and reset/edit affordances.
- `apps/editor/src/features/editor-session/editor-session-context.tsx` also guards parameter value/reset/keyform mutations in Dynamics mode.
- `apps/editor/src/workspace/panels/parameter-bar.test.ts` proves Dynamics mode cannot scrub or jump normal Parameter Bar values.

### Canvas Dynamics preview behavior

- Dynamics preview starts from parameter defaults, overlays only Inspector-local driver values, steps the selected Dynamics Group preview simulation, and writes the additive output effective value.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` passes that effective map to Canvas projection only in Dynamics mode.
- `isCanvasAuthoringSelectionEnabled("dynamics")` returns false. Left-click selection and Rig/Mesh edit starts are gated while pan/zoom navigation remains available.
- `apps/editor/src/workspace/panels/canvas-preview-panel.test.ts` covers the exported selection gate.

## Forbidden Scope Compliance

No Domain C source edits were made.

Across Domain A/B evidence and the final source scan:

- No dependency changes were introduced.
- Viewer v1, Viewer playback/time controls, frame stepping, mixer / same-output blending, multi-pendulum authoring, multi-output authoring, collision, cloth, IK, export, Cubism compatibility, unrelated mesh/deformer/keyform feature work, and new dependencies remain out of scope.
- `git diff --numstat -- apps/editor/src/workspace/viewer/...` printed only CRLF conversion warnings and no content numstat rows, confirming the status-listed Viewer files have no content diff.

## Verification Performed

Passed:

- `pnpm.cmd typecheck`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Focused Dynamics test batch:

- Command:
  - `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/parameter-resolution.test.ts packages/runtime-core/src/initial-state.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts apps/editor/src/workspace/panels/inspector-panel.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/canvas-preview-panel.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- Sandboxed run failed while loading `vitest.config.ts` with esbuild `spawn EPERM`.
- Pre-fix escalated rerun passed: 17 test files, 98 tests.
- Post-Fix Loop 1 escalated rerun passed: 17 test files, 104 tests.

Coverage of required checks:

| Required check | Final result |
|---|---|
| `pnpm typecheck` | Passed |
| Focused package-format Dynamics schema tests | Passed in post-fix focused batch |
| Focused authoring-core Dynamics mutation/save-load tests | Passed in post-fix focused batch |
| Focused operation-core Dynamics operation tests | Passed in post-fix focused batch |
| Focused validator-core Dynamics semantic tests | Passed in post-fix focused batch |
| Focused runtime-core Dynamics additive offset tests | Passed in post-fix focused batch |
| Focused Editor Dynamics Tool tests | Passed in post-fix focused batch |
| Focused Canvas/Parameter Bar gating tests | Passed in post-fix focused batch |
| `node scripts/check-source-organization.mjs` | Passed |
| `node scripts/check-dependencies.mjs` | Passed |
| `git diff --check` | Passed with CRLF conversion warnings only |

## Fix Loop Summary

- Domain A had one fix loop before Domain C. It resolved non-empty v2 portable preservation proof, active stale v1 tutorial/evidence remnants, preview-viewer equivalence fixture shape, and validator invalid cardinality/normalization test gaps.
- Domain B required no fix loop.
- Domain C Fix Loop 1 addressed final clean review blocker F1 by aligning Dynamics mutation and validator reference authority with initialized preset parameters and adding focused authoring, operation, validator, portable, and Editor provider tests.

## Residual Risks

- Backward migration from persisted `dynamics-file-v1` user data is not implemented. This is consistent with the accepted Wave81 v2 contract but remains future import/load UX work.
- Historical fixture directory names still include `minimum-open-dynamics-v1-evidence`; contents and active evidence were updated to v2, but the path name may confuse future searches.
- Domain B did not run browser/manual visual QA for Inspector layout. Verification is by source inspection, SSR/component tests, model/provider history tests, Canvas projection tests, and final focused Vitest.
- Existing Viewer Runtime Controls still contain unrelated `computedDynamics` value-source display/editability assumptions from pre-Wave81 Viewer scope. Wave81 does not claim Viewer Dynamics v1 playback or Runtime Controls Dynamics ownership UX.
- The former preset-parameter authority risk from Domain B was addressed in Fix Loop 1 and independently re-reviewed as `pass`.

## User-Decision Points

- Decide in a later wave whether to add explicit `dynamics-file-v1` migration or rejection messaging for user-facing import/load workflows.
- Decide in a later cleanup whether to rename historical `minimum-open-dynamics-v1-evidence` fixture directories.
- Decide in later Viewer work how Dynamics-owned output parameters should be presented as read-only / derived in Runtime Controls.

## Files Changed By Domain C

- `discussion/implementation/waves/wave81/wave81-final-integration-report.md`
- `discussion/implementation/waves/wave81/_map.md`
- `discussion/implementation/reviews/wave81/_map.md`
- `discussion/implementation/reviews/wave81/wave81-final-clean-integration-review.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `packages/authoring-core/src/dynamics-mutations.ts`
- `packages/authoring-core/src/dynamics-mutations.test.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/operation-core/src/operations/create-dynamics-group.test.ts`
- `packages/validator-core/src/validators/dynamics-semantic.ts`
- `packages/validator-core/src/dynamics-semantic.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
