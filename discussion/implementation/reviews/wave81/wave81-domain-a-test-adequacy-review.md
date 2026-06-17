# Wave81 Domain A Test Adequacy Review

## Verdict

`pass`

Post-fix verdict after Fix Loop 1. The initial pre-fix `needs_changes` review is retained below for traceability.

## Scope reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`
- Domain A: `wave81-headless-dynamics-v2-contract-additive-runtime`
- Review lane: Test Adequacy Review
- Reviewed source, tests, fixtures, Gnome report, and actual working tree diff under `packages`, `apps`, `fixtures`, and `discussion`.
- No implementation files were edited by this review.

## Basis documents used

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
- `discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md`

## Findings

### Blocking: Non-empty Dynamics v2 portable save/load preservation is not proven

Wave81 requires portable project save/load to preserve Dynamics v2 data, and the review contract treats missing save/load proof for v2 as blocking unless explicitly deferred. The current focused proof shows package serialization and empty portable bundle schema compatibility, but not a non-empty Dynamics Group surviving export/import.

- `packages/authoring-core/src/dynamics-mutations.test.ts:21` proves create plus `toPackageDocument`, and `:38-39` assert the non-empty group and `dynamics-file-v2` schema.
- `packages/authoring-core/src/portable-project-bundle.test.ts:509` still builds the portable bundle fixture with `dynamicsGroups: []`.
- `packages/validator-core/src/portable-bundle-integrity.test.ts:339-341` also uses an empty `dynamics-file-v2` document.
- `packages/authoring-core/src/portable-project-bundle.ts:60-94` is the export/import path that should be covered with non-empty v2 Dynamics data.

Required change: add a focused portable export/import roundtrip test with at least one v2 Dynamics Group and assert the imported session/package document preserves `inputs`, `pendulums`, `outputs`, output `kind/strength/limit/invert`, and normalization values.

### Blocking: An active runtime fixture/test still depends on stale v1 Dynamics shape

This is not just a historical label. `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json` still encodes the old `drivers`/single `output`/`settings`/`resetPolicy` graph shape at `:27-56`, while the active runtime graph type now requires `inputs`, `pendulums`, and `outputs` at `packages/runtime-core/src/normalized-runtime-graph.ts:53-61`.

The active test loader still maps that old shape into `NormalizedDynamicsGroup`:

- `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:370-400` reads `solverKind`, `drivers`, `output`, `settings`, and `resetPolicy`.
- The same test is an active Vitest file and loads the fixture at `:504-516`.
- Running it failed before assertion collection because `:21` imports a missing editor-preview module. Command: `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`.

Required change: either update this active fixture/test to v2 `inputs`/`pendulums`/`outputs` and current snapshot evidence, or remove/quarantine it with an explicit recorded blocker. Leaving it active but outside the focused gate weakens the stale-remnant removal proof.

### Needs change: Validator-core tests miss invalid cardinality and invalid normalization cases

Validator source and catalog define these diagnostics:

- `packages/validator-core/src/validators/dynamics-semantic.ts:88-130`
- `packages/validator-core/src/check-catalog.ts:1620-1673`

But `packages/validator-core/src/dynamics-semantic.test.ts:41-154` covers missing refs, duplicate output ownership, warnings, and runtime mismatch only. I found no validator-core test assertion for `dynamics.inputMissing`, `dynamics.invalidPendulumCardinality`, `dynamics.invalidOutputCardinality`, or `dynamics.normalizationInvalid`.

Package-format schema tests do cover parse rejection at `packages/package-format/src/package-document.test.ts:169-201`, but the review checklist separately calls for validator-core coverage. Add direct validator tests, or explicitly document that schema rejection is the only intended oracle and remove/avoid untested validator diagnostics.

## Coverage matrix

| Requirement | Evidence reviewed | Adequacy |
|---|---|---|
| Package-format v2 schema success | `packages/package-format/src/package-document.test.ts:128-167` | Sufficient |
| Package-format invalid cardinality/normalization rejection | `packages/package-format/src/package-document.test.ts:169-201` | Sufficient |
| Authoring create/update/delete | `packages/authoring-core/src/dynamics-mutations.test.ts:21-97` | Sufficient |
| Output not requiring `computedDynamics` | `packages/authoring-core/src/dynamics-mutations.test.ts:42-52`, `packages/operation-core/src/operations/create-dynamics-group.test.ts:112-120` | Sufficient |
| Duplicate output ownership | `packages/authoring-core/src/dynamics-mutations.test.ts:54-67`, `packages/validator-core/src/dynamics-semantic.test.ts:89-114` | Sufficient |
| Operation create/update/delete and registry | `packages/operation-core/src/operation-lifecycle.test.ts:339-407`, `packages/operation-core/src/operation-type.ts:30-32`, `packages/operation-core/src/operation-registry.ts:108-110` | Sufficient |
| Stale v1 operation removal | `packages/operation-core/src/operation-payload.ts:90-92`; no matches for old operation names in `apps packages fixtures` | Sufficient for operation surface |
| Validator missing refs, duplicate, warnings | `packages/validator-core/src/dynamics-semantic.test.ts:41-154` | Sufficient |
| Validator invalid cardinality/normalization | Source exists, but no focused test assertion found | Gap |
| Runtime additive `base + offset` | `packages/runtime-core/src/parameter-resolution.test.ts:16-61`, `packages/runtime-core/src/parameter-resolution.ts:37-79` | Sufficient |
| Output limit and parameter clamp | `packages/runtime-core/src/dynamics-evaluation.ts:158-174`, `packages/runtime-core/src/parameter-resolution.test.ts:38-60` | Sufficient |
| Effective map before keyform/deformer evaluation | `packages/runtime-core/src/snapshot.ts:174-199` | Sufficient by source plus runtime tests |
| Deterministic reset/state | `packages/runtime-core/src/dynamics-evaluation.test.ts:16-56`, `packages/runtime-core/src/initial-state.test.ts:33-124` | Sufficient |
| No `computedDynamics` runtime gate | `packages/runtime-core/src/parameter-resolution.ts:42-72`; tests use authored output at `packages/runtime-core/src/parameter-resolution.test.ts:129-137` | Sufficient |
| Persistence/portable bundle v2 preservation | Non-empty package document proof exists; portable bundle proof is empty-only | Blocking gap |
| Forbidden UI/Viewer implementation in Domain A | No content diff found for Viewer UI files; Editor changes are parameter-manager projection/test fallout | Sufficient |
| Remaining stale fixture/test labels | Historical names exist; active preview/viewer fixture still uses old shape | Blocking gap |

## Verification commands performed

- `git diff --name-only -- packages apps fixtures discussion | Sort-Object`
- `git diff --stat -- packages apps fixtures discussion`
- `rg -n "scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence" apps packages fixtures`
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/parameter-resolution.test.ts packages/runtime-core/src/initial-state.test.ts`
  - Sandbox run failed with `spawn EPERM`; escalated rerun passed: 8 files, 46 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/operation-core/src/operation-schemas.test.ts packages/validator-core/src/portable-bundle-integrity.test.ts`
  - Sandbox run failed with `spawn EPERM`; escalated rerun passed: 7 files, 25 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - Sandbox run failed with `spawn EPERM`; escalated rerun failed before tests with missing `../../../apps/editor/src/editor-preview/preview-projection.js`.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- `git diff --check -- packages apps fixtures discussion/implementation/waves/wave81 discussion/implementation/reviews/wave81` passed with LF/CRLF warnings only.

## Remaining test gaps/risks

- Broad `pnpm test:unit`, `pnpm test:standard`, or `pnpm test:full` was not run in this review.
- AI catalog source was updated for Dynamics v2 create/update/delete, but focused Domain A verification did not include `packages/ai-interface` catalog tests.
- The active preview/viewer equivalence fixture appears outside the Domain A focused pass set; until it is updated or explicitly quarantined, stale Dynamics fixture behavior can survive despite focused package/runtime tests passing.

## User-decision points

- None for this review lane. The required follow-up is implementation/test cleanup, not a product decision.

## Fix Loop 1 Re-review

### Verdict

`pass`

### Evidence reviewed

- Re-read the Wave81 plan, Dynamics Tool component spec, initial test adequacy review, and Domain A implementation report Fix Loop 1 summary.
- Inspected the focused diffs requested for:
  - `packages/authoring-core/src/portable-project-bundle.test.ts`
  - `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json`
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`
  - `packages/validator-core/src/dynamics-semantic.test.ts`
- Verified that the previous blocking portable save/load gap is closed:
  - `packages/authoring-core/src/portable-project-bundle.test.ts:88` finds the imported Dynamics Group.
  - `packages/authoring-core/src/portable-project-bundle.test.ts:93` asserts exported `dynamics-file-v2` model data.
  - `packages/authoring-core/src/portable-project-bundle.test.ts:199` asserts the imported non-empty group, including `inputs`, `pendulums`, `outputs`, input normalization, and output `kind` / `strength` / `limit` / `invert`.
  - `packages/authoring-core/src/portable-project-bundle.test.ts:572` constructs the portable roundtrip fixture with a non-empty v2 Dynamics Group instead of `dynamicsGroups: []`.
- Verified that the previous active preview/viewer fixture blocker is closed:
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json:32` now uses `inputs`, `:45` uses `pendulums`, and `:53` uses `outputs`.
  - `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json:134` expects `additivePendulumV0`, and `:139-140` assert additive `outputOffset` and `effectiveOutputValue`.
  - `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:88` defines a local projection DTO, avoiding the previous missing Editor preview import.
  - `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:287-290` compares `inputValues`, `outputOffset`, and `effectiveOutputValue`.
  - `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:425-433` loads fixture Dynamics Groups from v2 `inputs` / `pendulums` / `outputs`.
  - `rg -n "scalarDampedFollowV1|drivers|driverValues|computedDynamics|outputValue|stateSummary\\.position|stateSummary\\.velocity" packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json` returned no matches.
- Verified that the validator-core test gap is closed:
  - `packages/validator-core/src/dynamics-semantic.test.ts:90` adds direct invalid v0 cardinality coverage.
  - `packages/validator-core/src/dynamics-semantic.test.ts:103`, `:112`, and `:121` assert `dynamics.inputMissing`, `dynamics.invalidPendulumCardinality`, and `dynamics.invalidOutputCardinality`.
  - `packages/validator-core/src/dynamics-semantic.test.ts:132` adds invalid normalization coverage.
  - `packages/validator-core/src/dynamics-semantic.test.ts:151` asserts `dynamics.normalizationInvalid`.
  - Source/catalog checks exist at `packages/validator-core/src/validators/dynamics-semantic.ts:94`, `:105`, `:116`, `:332` and `packages/validator-core/src/check-catalog.ts:1620`, `:1628`, `:1636`, `:1668`.

### Commands run

- `git diff -- packages/authoring-core/src/portable-project-bundle.test.ts`
- `git diff -- packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`
- `git diff -- packages/validator-core/src/dynamics-semantic.test.ts`
- `rg -n "importedDynamicsGroup|dynamics-file-v2|PARAM_HAIR_SWAY|DYN_HAIR_SWAY|dynamicsGroups" packages/authoring-core/src/portable-project-bundle.test.ts`
- `rg -n "EditorPreviewProjectionDto|projectEditorPreview|inputValues|outputOffset|effectiveOutputValue|createDynamicsGroupEntry|inputs: group.inputs|pendulums: group.pendulums|outputs: group.outputs" packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
- `rg -n "scalarDampedFollowV1|drivers|driverValues|computedDynamics|outputValue|stateSummary\\.position|stateSummary\\.velocity" packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`
  - Result: no matches.
- `rg -n "dynamics\\.inputMissing|dynamics\\.invalidPendulumCardinality|dynamics\\.invalidOutputCardinality|dynamics\\.normalizationInvalid" packages/validator-core/src/check-catalog.ts packages/validator-core/src/validators/dynamics-semantic.ts packages/validator-core/src/dynamics-semantic.test.ts`
- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - Sandbox result: failed before loading tests with `spawn EPERM` while starting esbuild.
  - Escalated rerun result: passed, 3 files / 10 tests.

### Remaining test gaps / residual risk

- Broad `pnpm test:unit`, `pnpm test:standard`, or `pnpm test:full` was not rerun in this re-review.
- The preview/viewer equivalence fixture is now runnable and v2/additive-shaped, but it uses a local projection helper in `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` rather than importing the Editor preview projection. For Domain A's headless contract re-review, this is acceptable and no longer blocks stale-remnant or runnable-test adequacy.
