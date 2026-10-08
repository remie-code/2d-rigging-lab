# Wave81 Domain A Design / Development Compliance Review

## Verdict

pass

## Scope reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`
- Domain A: `wave81-headless-dynamics-v2-contract-additive-runtime`
- Lane: Design / Development Compliance Review
- Reviewed source, tests, Gnome report, basis docs, changed-file list, and selected diffs under `packages`, `apps`, `fixtures`, and `discussion`.
- Changed implementation was concentrated in package-format schema, contracts runtime state/diff, runtime-core Dynamics/effective parameter resolution, authoring-core mutations/save-load materialization, operation-core payloads/handlers/catalog, validator-core checks, AI operation catalog projection, focused fixtures/tests, and the conditional Editor parameter-manager projection fallout.

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

No blocking or needs-change findings.

## Policy compliance notes

- Scope compliance: Domain A stayed in headless package/runtime/operation/authoring/validator/persistence surfaces. The only Editor production change reviewed was `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts:223`, which now projects v2 `inputs` / `outputs` usage labels and does not implement UI behavior.
- Forbidden UI / Viewer scope: no Viewer UI, Canvas interaction, Parameter Bar UI, mesh generation, deformer editing, Cubism, import/export, or new dependency work was found in the content diff. `git diff` for Viewer files emitted only LF/CRLF warnings and no content diff.
- Operation policy: `createDynamicsGroup`, `updateDynamicsGroup`, and `deleteDynamicsGroup` remain operation-core handlers and call authoring-core mutations (`packages/operation-core/src/operations/create-dynamics-group.ts:84`, `packages/operation-core/src/operations/update-dynamics-group.ts:69`, `packages/operation-core/src/operations/delete-dynamics-group.ts:65`). Authoring mutation logic owns the graph writes and revision/dirty updates (`packages/authoring-core/src/dynamics-mutations.ts:42`, `packages/authoring-core/src/dynamics-mutations.ts:67`, `packages/authoring-core/src/dynamics-mutations.ts:123`).
- Stale operation surfaces: active operation type/payload catalogs expose only create/update/delete Dynamics operations (`packages/operation-core/src/operation-type.ts:30`, `packages/operation-core/src/operation-payload.ts:90`). AI catalog text now describes v2 additive pendulum create/update/delete (`packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:263`, `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:541`).
- Schema/ID compliance: persisted Dynamics schema is `dynamics-file-v2` with `inputs`, one `pendulums` item, one `outputs` item, and normalization validation (`packages/package-format/src/model-files.ts:172`, `packages/package-format/src/model-files.ts:225`, `packages/package-format/src/model-files.ts:374`). No machine-readable ID spacing issue was found in reviewed additions.
- Additive runtime proof: effective parameter resolution computes base value first, finds the owning enabled Dynamics group by output parameter, adds the offset, then clamps (`packages/runtime-core/src/parameter-resolution.ts:42`). The focused additive test proves `baseValue: 0.4`, `dynamicsOffset: 0.25`, `effectiveValue: 0.65` without requiring `computedDynamics` (`packages/runtime-core/src/parameter-resolution.test.ts:16`).
- Injection boundary: `createRuntimeSnapshot` resolves effective parameter values before keyform sampling and deformer/rig evaluation (`packages/runtime-core/src/snapshot.ts:174`), matching the required runtime parameter-map injection point without broad snapshot redesign.
- Save/load proof: package document creation and model-file materialization emit `dynamics-file-v2` (`packages/authoring-core/src/package-document-from-authoring-session.ts:97`, `packages/authoring-core/src/package-document-model-files.ts:43`). Schema tests accept v2 and reject invalid cardinality/normalization (`packages/package-format/src/package-document.test.ts:128`, `packages/package-format/src/package-document.test.ts:169`). Portable bundle fixture construction uses v2 Dynamics (`packages/validator-core/src/portable-bundle-integrity.test.ts:339`).
- Validation policy: validator checks missing input/output refs, v0 cardinality, invalid normalization, duplicate output ownership, warnings, and runtime evidence mismatch (`packages/validator-core/src/validators/dynamics-semantic.ts:88`, `packages/validator-core/src/validators/dynamics-semantic.ts:222`, `packages/validator-core/src/validators/dynamics-semantic.ts:229`). The check catalog uses additive/v2 wording and no longer advertises old computed-output diagnostics (`packages/validator-core/src/check-catalog.ts:1617`).
- Source organization: no substantial implementation logic was added to an `index.ts`. New `delete-dynamics-group.ts` is a single-operation handler. `model-files.ts` remains an existing schema responsibility file, not a barrel. `node scripts/check-source-organization.mjs` passed.
- Dependency policy: no `package.json` or `pnpm-lock.yaml` content diff was present; `node scripts/check-dependencies.mjs` passed.

## Stale remnant review

- `rg -n "bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence|scalarDampedFollowV1|dynamics-file-v1" packages apps fixtures` returned no matches.
- `computedDynamics` remains as a general parameter `valueSource` enum value and in unrelated/historical tests. That is not a Domain A blocker because Dynamics v2 runtime application no longer gates on it; `parameter-resolution.ts` applies offsets by Dynamics output ownership.
- Historical fixture path names such as `fixtures/contracts/minimum-open-dynamics-v1-evidence/` still contain `v1`, but reviewed file contents now use v2 schema/evidence. This is naming debt, not active v1 behavior.
- Some preview/viewer equivalence fixture labels still look v1-like, as the Gnome report states. They are outside Domain A's forbidden Viewer/UI scope and were not used as the Domain A gate.

## Verification commands performed

- `git diff --name-only -- packages apps fixtures discussion | Sort-Object`
- `git diff --stat -- packages apps fixtures discussion`
- `git diff --check -- packages apps fixtures discussion/implementation/waves/wave81` - passed with LF/CRLF warnings only.
- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `pnpm.cmd typecheck` - passed.
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/parameter-resolution.test.ts packages/runtime-core/src/initial-state.test.ts apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts` - sandbox attempt failed with esbuild `spawn EPERM`; approved escalated rerun passed, 9 files / 51 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/operation-core/src/operation-schemas.test.ts packages/validator-core/src/portable-bundle-integrity.test.ts` - approved escalated run passed, 7 files / 25 tests.

## Remaining risks

- Backward migration from persisted `dynamics-file-v1` user data is not implemented; this is consistent with the Wave81 accepted v2 contract, but user-facing rejection/migration messaging remains future work.
- Historical fixture directory names still mention v1 and can confuse future source searches even though active content was updated.
- Viewer Runtime Controls still have unchanged `computedDynamics` editability assumptions in Viewer scope. Domain A was explicitly forbidden from implementing Viewer/UI changes; runtime-core itself no longer depends on that valueSource for Dynamics output application.
- Broad `pnpm test:unit` was not rerun in this review; focused Domain A tests, typecheck, source guard, dependency guard, and diff whitespace check passed.

## User-decision points

- No user decision is required to accept Domain A for this review lane.
- Later decision candidates: whether to add explicit v1 migration/rejection UX, whether to rename historical v1 fixture directories, and whether Viewer/equivalence fixtures should be cleaned in Domain B or a separate Viewer/equivalence wave.

## Fix Loop 1 Delta Re-review

Verdict: pass

Scope reviewed:

- Re-read the Wave81 plan, source organization policy, dependency policy, operation policy, this review artifact, and the updated Domain A report.
- Reviewed Fix Loop 1 deltas in portable bundle preservation, preview-viewer equivalence runtime fixture/test, tutorial readiness wording, validator Dynamics tests, fixture/report content, and conditional Editor parameter-manager projection fallout.
- Reviewed source and diffs directly; this delta re-review is not based only on the Gnome report.

Evidence:

- Forbidden scope remains respected. `git diff --name-only` shows no content diff in Viewer UI, Canvas, Parameter Bar, or panel implementation files. `git diff --numstat -- apps/editor/src/workspace/viewer apps/editor/src/workspace/panels apps/editor/src/workspace/canvas ...` reported content changes only for `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts` and its Parameter Manager tests; Viewer file status entries are line-ending/index noise with no content diff.
- The conditional Editor production change remains projection-only. `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts:223` maps v2 Dynamics `inputs` and `outputs` into usage labels; it does not add Inspector, Canvas, Viewer, or Parameter Bar behavior.
- Preview-viewer equivalence cleanup is test/fixture/runtime evidence only. `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json` now uses `inputs` / `pendulums` / `outputs` and additive output fields. `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:88` defines a small test-local `EditorPreviewProjectionDto`, and `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts:301` defines a test-local `projectEditorPreview` summary helper. The previous direct import from `apps/editor/src/editor-preview` was removed.
- The test-local projection replacement reduces inappropriate package coupling instead of adding it. `rg -n '((\.\./){3,}apps/editor|apps/editor|@private-2d-rigging-lab/editor|editor-preview|projectEditorPreview)' packages/runtime-core packages/validator-core packages/authoring-core packages/operation-core ...` found only the local `projectEditorPreview` symbol inside `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`.
- Portable bundle evidence now covers non-empty Dynamics v2 preservation. `packages/authoring-core/src/portable-project-bundle.test.ts:93` asserts exported `dynamics-file-v2` model data, and `packages/authoring-core/src/portable-project-bundle.test.ts:199` asserts imported v2 group shape including `inputs`, `pendulums`, and `outputs`.
- Validator delta coverage was added without broad architecture changes. `packages/validator-core/src/dynamics-semantic.test.ts:90`, `:132`, `:165`, and `:192` cover invalid v0 cardinality, invalid normalization, duplicate additive output ownership, and additive warning/runtime mismatch cases.
- Tutorial readiness wording changed from stale v1/scalar language to Dynamics v2 additive pendulum language in `packages/validator-core/src/validators/tutorial-readiness.ts:437` and `packages/validator-core/src/check-catalog.ts:1809`.
- Mesh/deformer-looking diffs are fixture/schema follow-up only. Sampled diffs in `packages/operation-core/src/operations/mesh-topology.test.ts`, `packages/operation-core/src/operations/move-mesh-vertex.test.ts`, `packages/validator-core/src/mesh-topology-diagnostics.test.ts`, and `fixtures/contracts/wave29-mesh-edit-contract-fixtures/baseline-package.json` only update empty Dynamics model files from `dynamics-file-v1` to `dynamics-file-v2`.
- No dependency or lockfile change was found. `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json apps/*/package.json` was empty, and `node scripts/check-dependencies.mjs` passed.
- Source organization remains acceptable. No `index.ts` implementation logic or new catch-all/god file was introduced in the Fix Loop 1 delta, and `node scripts/check-source-organization.mjs` passed.
- Stale active v1 evidence search did not find active remnants: `rg -n 'scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence|driverValues|stateSummary\.position|stateSummary\.velocity|Minimum Open Dynamics v1|scalar dynamics' packages apps fixtures` returned no matches.

Verification performed:

- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `git diff --check -- packages/authoring-core/src/portable-project-bundle.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/validator-core/src/validators/tutorial-readiness.ts packages/validator-core/src/check-catalog.ts fixtures/contracts/preview-viewer-equivalence-keyform-dynamics` - passed with LF/CRLF warnings only.
- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts` - sandbox attempt failed with esbuild `spawn EPERM`; approved escalated rerun passed, 5 files / 19 tests.

Remaining risks:

- Historical fixture directory names still include `minimum-open-dynamics-v1-evidence`; Fix Loop 1 updated file contents and active strings but deferred path churn.
- Existing user data migration/rejection UX for persisted `dynamics-file-v1` remains future work, consistent with the accepted Wave81 Domain A scope.
- The workspace still contains broad Domain A line-ending warnings and untracked Wave81 artifacts; no reviewed Fix Loop 1 delta required a design/development change.
