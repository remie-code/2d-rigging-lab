# Wave81 Domain A Spec Compliance Review

## Verdict

needs_changes

## Scope reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`
- Domain A: `wave81-headless-dynamics-v2-contract-additive-runtime`
- Review lane: Spec Compliance Review
- Reviewed actual source/test diffs under `packages`, `apps`, `fixtures`, and `discussion`, including untracked Domain A report/plan and `packages/operation-core/src/operations/delete-dynamics-group.ts`.
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
- Gnome report: `discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md`

## Findings

### F1 - Blocking: non-empty Dynamics v2 save/load and portable bundle preservation proof is missing

Wave81 requires Dynamics v2 save/load/portable bundle preservation (`discussion/implementation/orchestration/wave81-plan.md:257`, `discussion/implementation/orchestration/wave81-plan.md:469`, `discussion/implementation/orchestration/wave81-plan.md:599`). The Gnome report claims save/load coverage (`discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md:125`-`129`) and reports focused tests passed (`discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md:184`-`190`), but the inspected tests do not prove a non-empty Dynamics v2 group survives an actual save/load or portable bundle round trip.

Observed evidence:

- `packages/authoring-core/src/dynamics-mutations.test.ts:21`-`39` proves a non-empty v2 group can be materialized into a package document, but it does not reload or import that document.
- `packages/package-format/src/package-document.test.ts:128`-`167` proves schema acceptance for a v2 group, not save/load preservation.
- `packages/authoring-core/src/portable-project-bundle.test.ts:42` round-trips other authored data, but the fixture has `dynamicsGroups: []` at `packages/authoring-core/src/portable-project-bundle.test.ts:509`.
- `packages/validator-core/src/portable-bundle-integrity.test.ts:339`-`342` also uses an empty `dynamics-file-v2`.

Required fix: add focused proof that a package/session containing a non-empty `dynamics-file-v2` group with inputs, one pendulum, and one output round-trips through the relevant save/load and portable bundle path with the full v2 data preserved.

### F2 - Blocking: active stale v1 Dynamics catalog/evidence remnants remain

Domain A is required to remove or replace stale v1 Dynamics behavior and active catalog entries unless explicitly justified. The broad stale search in the Gnome report only covered `scalarDampedFollowV1`, `dynamics-file-v1`, and removed operation IDs (`discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md:158`-`160`), but active validator/catalog code still exposes old v1 Dynamics wording and scalar evidence semantics:

- `packages/validator-core/src/check-catalog.ts:1804`-`1809` describes `tutorial.requiredDynamicsMissing` as missing "Minimum Open Dynamics v1 evidence".
- `packages/validator-core/src/validators/tutorial-readiness.ts:419`-`443` emits "Minimum Open Dynamics v1 group" and says the tutorial cannot prove dynamics without "scalar dynamics evidence".

There is also an acknowledged active runtime fixture/test remnant: `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:266`-`274` still projects `driverValues`, `outputValue`, `stateSummary.position`, and `stateSummary.velocity`; the report defers it as Viewer/equivalence-owned (`discussion/implementation/waves/wave81/wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md:162`-`165`). Because this is still active source/test evidence for runtime snapshots, it should either be updated to v2 additive evidence fields or carried as an explicit recorded blocker/accepted deferral before Domain A can pass spec compliance.

Required fix: replace active tutorial/check catalog wording and evidence semantics with Dynamics v2/additive pendulum terminology, and update or formally block/defer the active preview-viewer equivalence v1 evidence projection.

## Requirement coverage

| Requirement | Review result | Evidence |
|---|---|---|
| Persisted schema is `dynamics-file-v2` | pass | `packages/package-format/src/model-files.ts:375`; schema tests at `packages/package-format/src/package-document.test.ts:128` |
| v0 shape: inputs >= 1, one pendulum, one output | pass | `packages/package-format/src/model-files.ts:230`-`232`; operation guard at `packages/operation-core/src/operations/create-dynamics-group.ts:122`-`149` |
| Input fields and normalization `min < center < max` | pass | `packages/package-format/src/model-files.ts:177`-`204`; operation payload at `packages/operation-core/src/payloads/dynamics.ts:10`-`40` |
| Pendulum/output fields | pass | `packages/package-format/src/model-files.ts:208`-`222` |
| Runtime additive base + one offset | pass | `packages/runtime-core/src/parameter-resolution.ts:43`-`56`; proof at `packages/runtime-core/src/parameter-resolution.test.ts:16`-`60` |
| Output may be authored/custom scalar; no computedDynamics ownership requirement | pass | `packages/authoring-core/src/dynamics-mutations.test.ts:42`-`52`; authoring validation only checks parameter existence at `packages/authoring-core/src/dynamics-mutations.ts:197`-`203` |
| Duplicate output ownership is invalid | pass | `packages/authoring-core/src/dynamics-mutations.ts:206`-`227`; `packages/validator-core/src/validators/dynamics-semantic.ts:361`-`376` |
| Runtime reset deterministic | pass | `packages/runtime-core/src/initial-state.test.ts:106`-`123`; deterministic sequence test at `packages/runtime-core/src/dynamics-evaluation.test.ts:16`-`56` |
| Effective values feed keyform/deformer evaluation | pass | `packages/runtime-core/src/snapshot.ts:174`-`182` resolves effective values before keyform sampling |
| Save/load/portable bundle preserves v2 data | needs_changes | See F1 |
| Stale v1 operations/catalog entries removed or replaced | needs_changes | Removed operation IDs pass; active stale tutorial/evidence remnants remain, see F2 |
| Forbidden UI/Viewer implementation in Domain A | pass | No content diff in Viewer UI files; Editor changes are limited to parameter manager projection/test fallout per Gnome report lines 86-93 |

## Verification commands performed

- `git diff --name-only -- packages apps fixtures discussion | Sort-Object`
- `git diff --stat -- packages apps fixtures discussion`
- `git status --short -uall`
- `rg -n "scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence" apps packages fixtures` returned no matches.
- `rg -n "Minimum Open Dynamics v1|dynamics v1|Dynamics v1|v1 evidence|scalar damped|damped follow|driverValues|outputValue|stateSummary\\.position|stateSummary\\.velocity" packages apps fixtures` found the stale remnants cited in F2.
- I did not rerun Vitest in this review; I inspected the tests/source and the Gnome-reported focused pass results.

## Remaining risks

- Historical fixture path/name `fixtures/contracts/minimum-open-dynamics-v1-evidence/` remains; content appears mostly v2, but naming may continue to confuse future agents.
- `computedDynamics` remains a general parameter `valueSource` and Viewer read-only policy concept. This is not blocking for Domain A because output ownership no longer depends on it, but future Viewer work should avoid reinterpreting it as Dynamics v2 ownership.
- Broad unit tests were not rerun here. The active preview-viewer equivalence remnant in F2 is likely to remain a broad-test risk until updated or explicitly excluded with a recorded blocker.

## User-decision points

None for this review. The required changes are implementation/test evidence cleanup within the accepted Wave81 Domain A contract.

## Fix Loop 1 Re-review

## Verdict

pass

## Scope re-reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`
- Domain A: `wave81-headless-dynamics-v2-contract-additive-runtime`
- Review lane: Spec Compliance Re-review after Fix Loop 1
- Re-reviewed from the Wave81 plan, Dynamics Tool component spec, prior review artifact, Domain A report Fix Loop 1 summary, actual source/test diffs, focused searches, and focused Vitest execution.
- No implementation files were edited by this re-review.

## Evidence

### F1 - Resolved: non-empty Dynamics v2 portable preservation proof is now present

`packages/authoring-core/src/portable-project-bundle.test.ts` now builds a non-empty v2 Dynamics Group in the portable bundle fixture and verifies it on both export and import:

- Export proof parses the portable package document and asserts `model.dynamics.schemaVersion === "dynamics-file-v2"` with the session Dynamics Groups preserved at `packages/authoring-core/src/portable-project-bundle.test.ts:63`-`96`.
- Import proof finds `dyn_hair_sway` in `imported.session.graph.dynamicsGroups` and asserts the full v2 shape at `packages/authoring-core/src/portable-project-bundle.test.ts:88`-`230`.
- The asserted group includes one input with normalization, one pendulum, and one output with `kind`, `strength`, `invert`, and `limit` at `packages/authoring-core/src/portable-project-bundle.test.ts:199`-`230`.
- The fixture source now includes `dynamicsGroups: [ ... ]` rather than an empty list at `packages/authoring-core/src/portable-project-bundle.test.ts:574`-`604`.

This satisfies the original F1 requirement for non-empty `dynamics-file-v2` portable save/load preservation evidence.

### F2 - Resolved: active stale v1 catalog/evidence remnants were replaced

The active validator/catalog wording cited in the initial review has been replaced with v2 additive pendulum wording:

- `packages/validator-core/src/check-catalog.ts:1620`-`1681` now catalogs v2 shape checks such as `dynamics.inputMissing`, `dynamics.invalidPendulumCardinality`, `dynamics.invalidOutputCardinality`, and `dynamics.normalizationInvalid`.
- `packages/validator-core/src/check-catalog.ts:1809` now describes missing "Dynamics v2 additive pendulum evidence".
- `packages/validator-core/src/validators/tutorial-readiness.ts:437` and `packages/validator-core/src/validators/tutorial-readiness.ts:442` now use "Dynamics v2 additive pendulum group" and "additive pendulum evidence".

The active preview-viewer equivalence fixture/test cited in the initial review has also been updated:

- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json:32`-`58` now uses v2 `inputs`, `pendulums`, and `outputs`; `param_hair_sway` is `authoredInput`, not `computedDynamics`.
- `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:286`-`294` now projects `solverKind`, `inputValues`, `outputOffset`, `effectiveOutputValue`, `angle`, and `angularVelocity` instead of the stale `driverValues`, replacement `outputValue`, `stateSummary.position`, and `stateSummary.velocity` fields.
- `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:425`-`433` now reads v2 `inputs`, `pendulums`, and `outputs` from the fixture.
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json:134`-`140` and `:261`-`:267` now expect `additivePendulumV0`, `inputValues`, `outputOffset`, and `effectiveOutputValue`.

Focused stale searches returned no active matches for the requested old contract symbols:

- `dynamics-file-v1`
- `scalarDampedFollowV1`
- `bindDynamicsDriver`
- `bindDynamicsOutput`
- `setDynamicsSettings`
- `resetDynamicsPreviewState`
- `runDynamicsPreviewSequence`
- `Minimum Open Dynamics v1`
- `scalar dynamics evidence`
- `driverValues`
- `stateSummary.position`
- `stateSummary.velocity`

One remaining old check ID string, `dynamics.runtimeEvidenceMissing`, appears only in a negative assertion at `packages/validator-core/src/dynamics-semantic.test.ts:39` to prove that static package validation no longer emits it. I do not treat that as active stale behavior.

## Remaining Issues

None blocking for this re-review.

Non-blocking residuals remain as already documented in the Domain A report:

- The historical fixture directory `fixtures/contracts/minimum-open-dynamics-v1-evidence/` still contains `v1` in its path, but active file contents and display strings were updated to v2 terminology.
- `computedDynamics` remains as a general parameter `valueSource` and Viewer read-only policy concept. It is no longer required for Dynamics v2 output ownership in the inspected Domain A source/tests.

## Commands Run

- `git diff -- packages/authoring-core/src/portable-project-bundle.test.ts`
- `git diff -- packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`
- `git diff -- packages/validator-core/src/check-catalog.ts packages/validator-core/src/validators/tutorial-readiness.ts`
- `rg -n "dynamics-file-v1|scalarDampedFollowV1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence|Minimum Open Dynamics v1|scalar dynamics evidence|driverValues|stateSummary\\.position|stateSummary\\.velocity" packages apps fixtures -g "*.ts" -g "*.tsx" -g "*.json"`; result: no matches.
- `rg -n "\\boutputValue\\b|\\bdriverValues\\b|stateSummary\\.position|stateSummary\\.velocity" packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics -g "*.ts" -g "*.json"`; result: no matches.
- `rg -n "dynamics\\.requiredGroupMissing|dynamics\\.outputMustBeComputedParameter|dynamics\\.computedParameterProducerMissing|dynamics\\.driverMustBeAuthoredInput|dynamics\\.runtimeEvidenceMissing|computed output|computedDynamics parameter|Minimum Open Dynamics v1|scalar dynamics" packages/validator-core/src packages/authoring-core/src packages/operation-core/src packages/runtime-core/src -g "*.ts"`; only the negative assertion for `dynamics.runtimeEvidenceMissing` remained.
- `git diff --check -- packages/authoring-core/src/portable-project-bundle.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json packages/validator-core/src/check-catalog.ts packages/validator-core/src/validators/tutorial-readiness.ts discussion/implementation/reviews/wave81/wave81-domain-a-spec-compliance-review.md`; result: no whitespace errors, only Windows line-ending warnings.
- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/validator-core/src/dynamics-semantic.test.ts`; sandboxed attempt failed with `spawn EPERM`, escalated rerun passed 5 files / 19 tests.
