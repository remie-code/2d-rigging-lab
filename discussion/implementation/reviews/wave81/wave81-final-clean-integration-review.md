# Wave81 Final Clean Integration Review

## Verdict

`pass`

Final verdict after Fix Loop 1 re-review: `pass`.

The original `needs_changes` findings are retained below for traceability. Fix Loop 1 resolved the initialized preset parameter authority blocker and updated the root/Wave81 maps to the correct pending re-review state. Orch-Sylph should flip the self-referential pending markers to final pass after this artifact exists.

## Scope Reviewed

- Wave: Wave81 `dynamics-tool-v0-additive-pendulum-contract`.
- Domain: final integration / clean review / map closeout.
- Reviewed from source, focused tests, wave plan, Dynamics Tool spec, Domain A/B reports and review lanes, final integration draft, Wave81 maps, root implementation maps, and development policies.
- No source or test files were edited.
- This review wrote only this artifact.

## Basis Documents Used

- `discussion/implementation/orchestration/wave81-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- Domain A and Domain B implementation reports.
- Domain A and Domain B spec / design-development / test-adequacy review artifacts.
- `discussion/implementation/waves/wave81/wave81-final-integration-report.md`
- `discussion/implementation/waves/wave81/_map.md`
- `discussion/implementation/reviews/wave81/_map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`

## Source And Tests Inspected

- Package/schema: `packages/package-format/src/model-files.ts`, `packages/package-format/src/package-document.test.ts`, `packages/package-format/src/parameter-presets.ts`, `packages/package-format/src/parameter-presets.test.ts`.
- Runtime: `packages/runtime-core/src/dynamics-evaluation.ts`, `packages/runtime-core/src/parameter-resolution.ts`, `packages/runtime-core/src/snapshot.ts`, `packages/runtime-core/src/dynamics-evaluation.test.ts`, `packages/runtime-core/src/parameter-resolution.test.ts`, `packages/runtime-core/src/initial-state.test.ts`, `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`.
- Authoring/operation: `packages/authoring-core/src/dynamics-mutations.ts`, `packages/authoring-core/src/dynamics-mutations.test.ts`, `packages/authoring-core/src/portable-project-bundle.test.ts`, `packages/authoring-core/src/parameter-surface.ts`, `packages/authoring-core/src/parameter-surface.test.ts`, `packages/authoring-core/src/runtime-graph-parameters.ts`, `packages/operation-core/src/operation-registry.ts`, Dynamics operation handlers, and operation lifecycle tests.
- Validator: `packages/validator-core/src/validators/dynamics-semantic.ts`, `packages/validator-core/src/dynamics-semantic.test.ts`, `packages/validator-core/src/check-catalog.ts`.
- Editor: `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`, its test, `editor-session-context.tsx`, history test, `dynamics-tool-inspector.tsx`, Inspector test, `inspector-panel.tsx`, `parameter-bar.tsx`, Parameter Bar test, `canvas-preview-panel.tsx`, Canvas panel test, and `canvas-projection.test.ts`.

## Initial Findings

### F1 - Blocking: Dynamics create/update cannot use initialized preset parameters despite the accepted preset/custom output contract

Wave81 explicitly accepts preset/custom scalar parameters as Dynamics outputs: the plan says "Output parameter can be an existing preset/custom scalar parameter" and "Output parameter may reference an existing preset/custom scalar parameter" (`wave81-plan.md:30`, `:255`). The Dynamics Tool spec gives `Hair Front Sway X` as an existing preset output example and says Parameter Manager should provide existing preset/custom candidates (`dynamics-tool.md:206`, `:464`).

The implementation exposes initialized preset parameters in the Editor and runtime surfaces:

- Empty Editor sessions store no authored parameters (`apps/editor/src/features/editor-session/model/empty-authoring-session.ts:33`).
- `listInitializedParameters` wraps `createInitializedParameterSurface(graph.parameters)`, so preset parameters exist even when `graph.parameters` is empty (`packages/authoring-core/src/parameter-surface.ts:11`-`:14`).
- The authoring parameter-surface test proves `param_face_angle_x` is listed from an empty graph and projected into runtime graphs (`packages/authoring-core/src/parameter-surface.test.ts:15`-`:37`).
- Runtime parameter maps also use `listInitializedParameters` (`packages/authoring-core/src/runtime-graph-parameters.ts:4`-`:10`).

But the committed Dynamics mutation and package validation paths do not use the initialized parameter authority:

- Dynamics Tool drafts and local validation use `listEditorParameters`, which delegates to initialized parameters (`apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:91`; `dynamics-tool-state.ts:145`-`:160`, `:331`-`:338`, `:350`, `:421`).
- `createDynamicsGroup` / `updateDynamicsGroup` validate refs through `getParameterById`, which only searches `graph.parameters` (`packages/authoring-core/src/graph-selectors.ts:8`; `packages/authoring-core/src/dynamics-mutations.ts:175`-`:200`).
- Validator-core Dynamics semantic checks index only `packageDocument.model.parameters.parameters`, not initialized presets (`packages/validator-core/src/validators/dynamics-semantic.ts:58`-`:62`, `:142`, `:149`).
- Domain B explicitly records this residual risk and says focused committed tests use explicit graph parameters (`wave81-domain-b-editor-dynamics-tool-authoring-preview-report.md:166`-`:170`; final report `:154`).

Impact: in a new/empty Editor session, the Dynamics Inspector can build and locally validate a draft using initialized preset parameters, but the Operation Core commit can reject the same draft as missing driver/output parameters. Persisted package validation has the same mismatch for built-in preset references unless those presets are also materialized into `graph.parameters`. This contradicts the accepted preset/custom output contract and leaves the Inspector create/apply proof incomplete for the default parameter surface.

Required fix: align Dynamics mutation and validation reference authority with initialized preset parameters, or explicitly materialize required preset parameter records before commit/save. Add focused tests proving create/update, validator semantics, package/save-load, and Inspector create/apply behavior with initialized preset driver/output parameters, not only explicit custom/persisted `graph.parameters`.

### F2 - Needs change: root implementation maps still describe Wave81 as planned

I did not treat the Wave81-specific final-clean-review pending markers as inconsistencies; they are self-referential and expected until this artifact exists.

Separate from that, the root maps still describe Wave81 as `planned / ready for orchestration` instead of reflecting that Domains A/B/C ran and final clean review returned `needs_changes`:

- `discussion/implementation/_map.md:50`, `:416`
- `discussion/implementation/orchestration/_map.md:90`, `:111`

Required closeout update after the F1 fix/re-review: update these root map entries to the real current status. If the next clean review passes, Orch-Sylph should also flip the Wave81-specific pending markers and final report status to final pass after the passing artifact exists.

## Evidence Summary For Required Wave81 Concerns

- Dynamics v2 schema: credible. `model-files.ts` defines `dynamics-file-v2`, v2 inputs/pendulums/outputs, and normalization ordering; package-format tests accept valid v2 and reject invalid cardinality/normalization.
- Save/load: credible for non-empty custom/persisted parameter groups. Portable bundle tests assert v2 inputs, pendulum, outputs, normalization, output kind/strength/limit/invert. Not credible for initialized preset references until F1 is fixed.
- Additive offset runtime: credible. Runtime resolution computes base first, adds a single output offset, then clamps; tests prove `baseValue: 0.4`, `dynamicsOffset: 0.25`, `effectiveValue: 0.65`.
- Duplicate output ownership: credible for authoring/validator paths using persisted parameters; runtime does not silently choose first duplicate because duplicate outputs are excluded from the enabled map.
- Operation/history: credible for create/update/delete against explicit graph parameters. Incomplete for initialized preset parameter candidates because of F1.
- Validation: v0 cardinality, normalization, missing refs, duplicate output ownership, warnings, and additive evidence checks exist. Incomplete for initialized preset reference authority because validator indexes only persisted package parameters.
- Inspector: controls and local preview are present; `activeTool === "dynamics"` renders `DynamicsToolInspector`. Create/apply is incomplete for default initialized preset candidates because local validation and commit validation disagree.
- Parameter Bar disablement: credible. Component and context guards block value/keyform edits in Dynamics mode and focused tests cover no normal scrub/jump mutation.
- Canvas preview: credible. Dynamics mode feeds `dynamicsToolPreviewEvaluation.parameterValues` into Canvas projection; selection/edit starts are gated, and projection tests prove additive output drives existing keyform evaluation.
- Stale-remnant removal: credible. Final search found no active matches for old v1 solver/schema/operation/evidence strings.
- Forbidden scope/dependencies: no dependency diff found; dependency guard passed; no Viewer v1/time-control/frame-stepping/mixer/multi-pendulum/multi-output implementation was found in the inspected Dynamics paths. Viewer files showed CRLF/index warnings only in `git diff --numstat -- apps/editor/src/workspace/viewer`.

## Verification Performed Or Confirmed

Reran in this review:

- `pnpm.cmd typecheck` - passed.
- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `git diff --check` - passed with CRLF conversion warnings only.
- `rg -n 'scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence|Minimum Open Dynamics v1|scalar dynamics evidence|stateSummary\.position|stateSummary\.velocity' packages apps fixtures` - no matches.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json apps/*/package.json` - no dependency manifest/lockfile diff.

Confirmed from Domain C / Domain A / Domain B reports:

- Domain C focused Vitest batch initially failed in sandbox with esbuild `spawn EPERM`, then escalated rerun passed: 17 test files / 98 tests.
- Domain A and Domain B review lanes are pass-classified.

Not rerun:

- I did not rerun the full focused Vitest batch in this review. The blocking F1 issue is source-proven and the reported focused batch does not cover initialized preset parameter Dynamics commit/validation.

## Map / Report Consistency Result

- Wave81-specific final report and maps consistently say final clean review is pending; this is expected for this delegated review and is not counted as a finding.
- Domain A and Domain B are pass-classified in the Wave81 maps and final report.
- Root implementation maps still describe Wave81 as planned/ready; see F2.
- Final integration report records the preset-parameter authority risk but keeps overall draft closeout posture. Because F1 affects an accepted Wave81 contract, the final closeout should not pass until fixed or explicitly rescoped by the parent/user.

## Residual Risks

- Backward migration or explicit rejection messaging for persisted `dynamics-file-v1` user data remains future work.
- Historical fixture directory names still include `minimum-open-dynamics-v1-evidence`; active contents appear updated, but the path can confuse future searches.
- No browser/manual visual QA was run for the Dynamics Inspector layout.
- Editor Dynamics preview currently duplicates the pendulum stepping formula locally instead of importing runtime-core `stepDynamics`; it matches the current formula but can drift later unless covered or unified.
- Viewer Runtime Controls still have future-scope `computedDynamics` display/editability assumptions; Wave81 does not claim Viewer Dynamics playback or read-only derived-output UX.

## User-Decision Points

- No user decision is required for F1 if the intended Wave81 contract remains preset/custom parameter support; this is an implementation/test alignment fix.
- If the project wants to defer initialized preset-parameter Dynamics authoring, the parent must explicitly rescope the Wave81 contract and update the plan/spec/final report accordingly before a passing review.
- Later decisions remain: whether to add v1 migration/rejection UX, whether to rename historical v1 fixture directories, and how Viewer should present Dynamics-owned output parameters as read-only / derived.

## Fix Loop 1 Re-review

### Verdict

`pass`

### Scope Re-reviewed

- Re-reviewed the prior final clean review findings F1/F2, the Fix Loop 1 changed files, Wave81 final report/map updates, and the relevant source/test evidence.
- No source, test, report, or map files were edited by this re-review except this review artifact.

### F1 Resolution

Resolved.

Source evidence:

- `packages/authoring-core/src/dynamics-mutations.ts:11` now imports `getInitializedParameterById`.
- `packages/authoring-core/src/dynamics-mutations.ts:180` and `:197` validate Dynamics input/output refs through initialized parameter authority instead of persisted-only `graph.parameters`.
- Duplicate output ownership remains enforced by the unchanged ownership scan at `packages/authoring-core/src/dynamics-mutations.ts:206`-`:224`.
- `packages/validator-core/src/validators/dynamics-semantic.ts:2` imports `createInitializedParameterSurface`.
- `packages/validator-core/src/validators/dynamics-semantic.ts:59`-`:63` builds the Dynamics semantic parameter index from the initialized parameter surface, so built-in preset refs are valid even when `model.parameters.parameters` is empty.

Test evidence:

- `packages/authoring-core/src/dynamics-mutations.test.ts:59` proves create/update with initialized preset refs from an empty graph while `session.graph.parameters` remains empty.
- `packages/operation-core/src/operations/create-dynamics-group.test.ts:127` proves operation-core create/update commits initialized preset refs from an empty graph and records target IDs.
- `packages/validator-core/src/dynamics-semantic.test.ts:50` accepts initialized preset driver/output refs without persisted parameters.
- `packages/validator-core/src/dynamics-semantic.test.ts:77` proves initialized preset refs remain semantically valid through portable package export/import.
- `packages/validator-core/src/dynamics-semantic.test.ts:122` still reports truly missing input/output parameters.
- `packages/validator-core/src/dynamics-semantic.test.ts:245` still blocks duplicate additive output ownership.
- `packages/authoring-core/src/portable-project-bundle.test.ts:329` proves authoring portable export/import preserves Dynamics groups with initialized preset refs without materializing parameters, and runtime graph resolution still sees the preset parameters.
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:252` proves the Editor provider create/apply path commits initialized preset parameter candidates from an empty session.

This closes the prior integration gap: Editor-local validation, operation/authoring commit, validator semantics, portable save/load, and runtime parameter projection now share the initialized preset parameter authority.

### F2 Resolution

Resolved enough for final pass.

- `discussion/implementation/_map.md:50` and `:416` now describe Wave81 as final closeout / Fix Loop 1 pending clean re-review, not planned/ready.
- `discussion/implementation/orchestration/_map.md:90` and `:111` likewise describe final closeout with Fix Loop 1 pending re-review.
- Wave81-local maps and final report consistently say Fix Loop 1 is implemented and pending clean re-review. I treat those pending markers as self-referential and expected; Orch-Sylph should flip them after this passing artifact exists.

### Verification Performed

Reran in this re-review:

- `pnpm.cmd typecheck` - passed.
- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `git diff --check -- packages/authoring-core/src/dynamics-mutations.ts packages/authoring-core/src/dynamics-mutations.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/validator-core/src/validators/dynamics-semantic.ts packages/validator-core/src/dynamics-semantic.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts discussion/implementation/waves/wave81 discussion/implementation/reviews/wave81 discussion/implementation/_map.md discussion/implementation/orchestration/_map.md` - passed with CRLF warnings only.
- `rg -n 'scalarDampedFollowV1|dynamics-file-v1|bindDynamicsDriver|bindDynamicsOutput|setDynamicsSettings|resetDynamicsPreviewState|runDynamicsPreviewSequence|Minimum Open Dynamics v1|scalar dynamics evidence|stateSummary\.position|stateSummary\.velocity' packages apps fixtures` - no matches.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json apps/*/package.json` - no dependency manifest/lockfile diff.

Confirmed from Orch-Sylph post-fix verification:

- Focused Wave81 Vitest batch sandboxed run failed with esbuild `spawn EPERM`; exact escalated rerun passed: 17 files / 104 tests.
- `git diff --check` repository-wide passed with CRLF warnings only.

I did not independently rerun the focused Vitest batch because the sandbox failure mode is already known and the source/test evidence directly covers the previous blocker.

### Remaining Issues

No blocking or needs-change issues remain for Wave81 final clean integration.

Residual risks remain non-blocking:

- Backward migration/rejection messaging for persisted `dynamics-file-v1` data is future work.
- Historical fixture directory names still include `minimum-open-dynamics-v1-evidence`.
- Browser/manual visual QA for the Dynamics Inspector layout was not run.
- Editor Dynamics preview still duplicates the current pendulum stepping formula locally, so later solver changes should keep parity covered or share the runtime solver.
- Viewer Runtime Controls Dynamics-owned output UX remains future Viewer scope.

### User-Decision Points

None for this re-review.
