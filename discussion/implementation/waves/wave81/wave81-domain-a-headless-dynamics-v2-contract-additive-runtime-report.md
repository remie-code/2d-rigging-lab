# Wave81 Domain A Headless Dynamics v2 Contract Additive Runtime Report

## Status

- Verdict: done.
- Domain: `wave81-headless-dynamics-v2-contract-additive-runtime`.
- Scope outcome: Dynamics v2 persisted contract, additive pendulum runtime semantics, operation/authoring/validation/persistence updates, and active stale Dynamics v1 contract remnants were replaced where safe.
- No dependency approval was needed. No external dependencies were added.

## Fix Loop 1 summary

- Addressed spec review F1 and test adequacy gap for non-empty Dynamics v2 portable preservation by adding a portable export/import roundtrip assertion in `packages/authoring-core/src/portable-project-bundle.test.ts`. The roundtrip now preserves one v2 Dynamics Group and explicitly checks `inputs`, `pendulums`, `outputs`, input normalization, and output `kind`/`strength`/`limit`/`invert`.
- Addressed spec review F2 and test adequacy gap for active preview/viewer equivalence remnants by updating `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json` to `inputs`/`pendulums`/`outputs`, replacing stale `driverValues`/`outputValue`/`stateSummary.position` summary fields with additive `inputValues`/`outputOffset`/`effectiveOutputValue`/`angle` evidence, and making `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` runnable without the missing Editor preview import.
- Addressed stale tutorial/check catalog wording by replacing active `Minimum Open Dynamics v1` and `scalar dynamics evidence` text with Dynamics v2 additive pendulum terminology.
- Addressed validator test adequacy gaps by adding focused `dynamics.inputMissing`, `dynamics.invalidPendulumCardinality`, `dynamics.invalidOutputCardinality`, and `dynamics.normalizationInvalid` assertions in `packages/validator-core/src/dynamics-semantic.test.ts`.
- Updated the historical fixture content strings under `fixtures/contracts/minimum-open-dynamics-v1-evidence/` to v2 terminology while leaving the directory name unchanged to avoid fixture path churn.

## Basis coverage self-report

Read and applied:

- `discussion/implementation/orchestration/wave81-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/design/screen-design/components/_map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Applied accepted decisions:

- Persisted Dynamics schema is now `dynamics-file-v2`.
- v0 shape is `inputs.length >= 1`, `pendulums.length === 1`, `outputs.length === 1`.
- Input, pendulum, and output fields match the accepted Dynamics Tool component spec.
- Runtime output semantics are additive: `effective output = base parameter value + one Dynamics Group offset`.
- `replace` mode and v1 `scalarDampedFollowV1` semantics were removed from active contract paths.
- Output parameter ownership by multiple enabled Dynamics Groups is blocking invalid.
- Output parameter can be authored/custom/preset scalar and no longer requires `valueSource === "computedDynamics"`.

## Deferred basis items

- Viewer v1, Viewer time progression UI, frame stepping UI, mixer, multi-pendulum, multi-output, collision, cloth, IK, export, and Cubism compatibility remain out of scope.
- Backward migration from existing `dynamics-file-v1` user data was not implemented because the accepted decision for this wave is the canonical v2 schema.
- Historical fixture directory renaming was deferred where content is now v2 but path names still carry `v1`.

## Files changed

Core schema, contracts, and runtime:

- `packages/package-format/src/model-files.ts`
- `packages/contracts/src/runtime-state.ts`
- `packages/contracts/src/runtime-diff.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/runtime-core/src/state-compatibility.ts`
- `packages/runtime-core/src/runtime-options.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.ts`
- `packages/runtime-core/src/tutorial-evidence-summary-schema.ts`

Authoring and package document paths:

- `packages/authoring-core/src/dynamics-mutations.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/parameter-mutations.ts`
- `packages/authoring-core/src/runtime-graph-dynamics.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/tutorial-mini-model-seed.ts`

Operation and AI operation catalog paths:

- `packages/operation-core/src/payloads/dynamics.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operations/create-dynamics-group.ts`
- `packages/operation-core/src/operations/update-dynamics-group.ts`
- `packages/operation-core/src/operations/delete-dynamics-group.ts`
- `packages/operation-core/src/tutorial-mini-model-recipe.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`

Validation:

- `packages/validator-core/src/validators/dynamics-semantic.ts`
- `packages/validator-core/src/check-catalog.ts`

Conditional Editor fallout only:

- `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts`
- Editor tests that instantiate Dynamics fixtures were updated to the v2 shape:
  `apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts`,
  `apps/editor/src/features/editor-session/model/parameter-definition-commands.test.ts`,
  `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`.
- No Editor UI implementation behavior was changed.

Tests and fixtures:

- Focused Dynamics tests were updated under `packages/package-format`, `packages/authoring-core`, `packages/operation-core`, `packages/runtime-core`, and `packages/validator-core`.
- Contract/e2e fixture JSON that encoded old Dynamics schema/evaluator assumptions was updated under `fixtures/contracts/**` and `fixtures/e2e/wave22-asset-io-boundary/package-document.json`.
- Unrelated test helpers that construct empty package documents were updated only from `dynamics-file-v1` to `dynamics-file-v2` so package parsing remains valid.

Known upstream/user changes not owned by this Domain A implementation:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave81-plan.md`

## Additive offset contract trace

- `packages/package-format/src/model-files.ts` defines v2 Dynamics groups with `inputs`, `pendulums`, and `outputs`, and validates normalization ordering with `min < center < max`.
- `packages/authoring-core/src/runtime-graph-dynamics.ts` maps persisted v2 groups into `NormalizedDynamicsGroup`.
- `packages/runtime-core/src/dynamics-evaluation.ts` computes the normalized input source, advances the single additive pendulum state, and returns per-output offsets.
- Output offset is derived from pendulum `angle`, output `strength`, `invert`, and output `limit`.
- `packages/runtime-core/src/parameter-resolution.ts` computes the base parameter value first, then applies the single Dynamics Group offset, then clamps to the target parameter range.
- Runtime snapshot/diff evidence now uses `outputOffset`, `effectiveOutputValue`, `angle`, and `angularVelocity` fields instead of v1 replacement position/value fields.

## Effective parameter injection trace

- Dynamics offset injection now applies regardless of output parameter `valueSource`.
- The old `computedDynamics` output gate was removed from runtime and authoring mutation checks.
- Duplicate output ownership is excluded from deterministic runtime offset application and is reported as blocking invalid by validator semantics.
- Effective parameter values therefore enter keyform/deformer evaluation as base authored/preset/custom scalar values plus Dynamics additive offset.

## Save/load trace

- Package schema accepts `dynamics-file-v2` and rejects old/invalid cardinality and normalization.
- Authoring package document creation emits v2 model files.
- Runtime graph creation reads v2 `inputs`/`pendulums`/`outputs`.
- Portable export/import now has non-empty v2 Dynamics proof in `packages/authoring-core/src/portable-project-bundle.test.ts`; the imported session preserves `inputs`, `pendulums`, `outputs`, output `kind`/`strength`/`limit`/`invert`, and input normalization values.
- Verification covered `packages/package-format/src/package-document.test.ts`, `packages/authoring-core/src/dynamics-mutations.test.ts`, `packages/authoring-core/src/portable-project-bundle.test.ts`, and `packages/validator-core/src/portable-bundle-integrity.test.ts`.

## Operation/history proof

- Operation payloads now expose v2 create/update/delete Dynamics Group operations.
- Stale v1 operations were removed from operation payload/type surfaces:
  `bindDynamicsDriver`, `bindDynamicsOutput`, `setDynamicsSettings`, `resetDynamicsPreviewState`, `runDynamicsPreviewSequence`.
- `deleteDynamicsGroup` was added to operation registry and implemented with a reversible model diff.
- Create/update operations now emit v2 model diff paths for inputs, pendulums, and outputs.
- Operation lifecycle tests pass with create/update/delete Dynamics flows.

## Validation proof

- `packages/validator-core/src/validators/dynamics-semantic.ts` validates v2 group shape, missing input/output parameter refs, invalid cardinality, invalid normalization, duplicate output ownership, and runtime evidence mismatch.
- Duplicate output ownership is a blocking invalid diagnostic.
- Output parameter `computedDynamics` producer requirements were removed.
- Runtime evidence checks now compare v2 additive output evidence, not v1 replacement output evidence.

## Stale Dynamics remnant removal report

Removed/replaced from active contract paths:

- `dynamics-file-v1` persisted schema assumptions.
- `scalarDampedFollowV1` evaluator option in active runtime/fixture paths.
- v1 `drivers`, single `output`, `settings`, and `resetPolicy` assumptions in schema, authoring, operation, runtime, validator, and focused fixtures.
- v1 operation catalog/payload entries for bind/settings/reset/preview sequence.
- Runtime replacement-style output/state evidence fields.
- Validator requirements that Dynamics output parameters must be `computedDynamics`.

Search confirmation:

- `rg -n 'scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence' apps packages fixtures` returned no matches.
- Fix Loop 1 search for stale v1 wording/evidence (`Minimum Open Dynamics v1`, `Dynamics v1`, `v1 evidence`, `scalar dynamics`, `damped follow`, `driverValues`, `stateSummary.position`, `stateSummary.velocity`) found no active Dynamics v1 remnants. Remaining matches are false positives such as `outputValueSource` test helper names and unrelated Warp Deformer "division settings" wording.

Remaining stale-looking remnants retained with reason:

- `fixtures/contracts/minimum-open-dynamics-v1-evidence/` path name still contains `v1`; file contents and display strings were updated to v2. Renaming a historical contract fixture directory was not necessary for the runtime/contract change and would broaden fixture path churn.
- `computedDynamics` remains in the general parameter `valueSource` enum and some tests use it as a value-source variant. That is retained intentionally; Dynamics v2 no longer requires it for output ownership.

## Forbidden-scope compliance

- No Viewer UI, mesh generation, deformer editing, Parameter Bar UI, Canvas interaction, Cubism compatibility, or import/export implementation work was added.
- Conditional Editor edits were limited to parameter manager projection/type fallout and test fixtures that must construct v2 Dynamics Groups.
- `git status` still listed some Viewer files due line-ending/index noise, but `git diff --name-only -- packages apps fixtures` did not include the Viewer implementation files after normalization.

## Source organization and dependency notes

- No new dependency was added.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.

## Verification performed

Passed:

- `pnpm.cmd typecheck`
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/parameter-resolution.test.ts packages/runtime-core/src/initial-state.test.ts apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts apps/editor/src/features/editor-session/model/parameter-definition-commands.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`
  - Result: 11 files, 61 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/operation-core/src/operation-schemas.test.ts`
  - Result: 6 files, 19 tests passed.
- `pnpm.cmd exec vitest run packages/validator-core/src/portable-bundle-integrity.test.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/package-format/src/package-document.test.ts`
  - Result: 3 files, 19 tests passed.
- Fix Loop 1: `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - Result: 3 files, 10 tests passed.
- Fix Loop 1 representative gate: `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/parameter-resolution.test.ts packages/runtime-core/src/initial-state.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
  - Result: 10 files, 51 tests passed.
- Fix Loop 1 contract fixture confirmation: `pnpm.cmd exec vitest run packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts`
  - Result: 3 files, 7 tests passed.
- Fix Loop 1 tutorial confirmation: `pnpm.cmd exec vitest run packages/validator-core/src/tutorial-readiness-validator.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts`
  - Result: 2 files, 9 tests passed.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check -- packages apps fixtures discussion/implementation/waves/wave81`
  - Result: passed. Windows line-ending warnings were printed, but no whitespace errors were reported.

Notes:

- The first sandboxed Vitest attempt failed with `spawn EPERM` while starting esbuild. The same focused commands passed when rerun with approved escalation.
- A broad `pnpm test:unit` run was not used as the final gate. An earlier broad run before final cleanup showed unrelated failures outside this Dynamics v2 scope, including tutorial mini-model duplicate parameter setup and unrelated warp/rig-control diagnostics. Focused Domain A verification passes.

## Residual risks

- Existing user data with persisted `dynamics-file-v1` is not migrated by this wave.
- Historical fixture directory names may still imply v1 even where file contents are v2.
- `git status --short -uall` may show line-ending/index noise for files with no content diff; review should prefer `git diff --name-only` for content changes.

## User-decision points

- Decide whether to add an explicit `dynamics-file-v1` migration/rejection message for user-facing import/load workflows in a later wave.
- Decide whether to rename historical `minimum-open-dynamics-v1-evidence` fixture directories after downstream references are checked.
