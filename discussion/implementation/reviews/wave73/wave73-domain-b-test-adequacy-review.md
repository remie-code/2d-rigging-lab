# Wave73 Domain B Test Adequacy Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: `wave73-rotation2d-translation-exposure`

## Scope Reviewed

Reviewed Wave73 Domain B from source tests, implementation source, Wave73/Wave72 plans and reports, development policies, screen design docs, the Domain A report/review, and the Domain B implementation report. This review did not rely only on Gnome's summary.

Primary source/test files reviewed include:

- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave73-plan.md`, especially Sections 3, 5, 7.4, 7.5, 7.6, 10, 12, 14, 15, 16.
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`.
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`.
- `discussion/implementation/reviews/wave73/wave73-domain-a-test-adequacy-review.md`.
- `discussion/implementation/orchestration/wave72-plan.md`.
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`.
- `discussion/implementation/waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md`.
- `discussion/development_convention/ux-backed-package-logic-authority.md`.
- `discussion/development_convention/source-file-organization-policy.md`.
- `discussion/development_convention/dependency-policy.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/design/screen-design/components/rig-tool.md`.
- `discussion/design/screen-design/components/parameter-keyform.md`.
- `discussion/design/screen-design/components/canvas-preview.md`.

## Requirement-To-Test Coverage Matrix

| Requirement | Tests / evidence reviewed | Assessment |
|---|---|---|
| Wave73 7.4 / 10: operation `restTranslation` update success, invalid values, wrong-kind rejection, diff behavior, and preservation. | `UpdateRigControlPayloadSchema` includes `restTranslation` and no `restScale` at `packages/operation-core/src/payloads/rig-control.ts:91`; handler passes it into authoring mutation at `packages/operation-core/src/operations/update-rig-control.ts:85` through `packages/operation-core/src/operations/update-rig-control.ts:87`; diff emits `/restTranslation` at `packages/operation-core/src/operations/update-rig-control.ts:179` through `packages/operation-core/src/operations/update-rig-control.ts:182`. Operation test covers dry-run no mutation, commit, preserved child/root/enabled/restScale fields, and diff paths at `packages/operation-core/src/operations/rig-control.test.ts:743` through `packages/operation-core/src/operations/rig-control.test.ts:812`. Invalid NaN request, wrong-kind Warp update, no-op rejection, and no mutation are covered at `packages/operation-core/src/operations/rig-control.test.ts:816` through `packages/operation-core/src/operations/rig-control.test.ts:878`. | Adequate. |
| Wave73 7.4 / 10: authoring finite Vec2 validation and preservation. | Authoring update input and precondition include `restTranslation` at `packages/authoring-core/src/rig-control-mutations.ts:124` through `packages/authoring-core/src/rig-control-mutations.ts:129` and `packages/authoring-core/src/rig-control-mutations.ts:578` through `packages/authoring-core/src/rig-control-mutations.ts:599`; finite Vec2 validation is explicit at `packages/authoring-core/src/rig-control-mutations.ts:834` through `packages/authoring-core/src/rig-control-mutations.ts:845`. Test covers update while preserving parent, child drawable binding, child rig list, `restScale`, enabled state, roots, and keyforms at `packages/authoring-core/src/rig-control-mutations.test.ts:329` through `packages/authoring-core/src/rig-control-mutations.test.ts:382`. Invalid finite validation, wrong-kind, and no-op are covered at `packages/authoring-core/src/rig-control-mutations.test.ts:385` through `packages/authoring-core/src/rig-control-mutations.test.ts:425`. | Adequate. |
| Wave73 7.5 / 10: Rotation keyed `translation` Vec2 add/edit/interpolation behavior, including exact vs interpolated lock behavior. | Operation keyform test adds a rigControl `translation` Vec2 key and asserts target/property/key value at `packages/operation-core/src/operations/edit-keyform-key.test.ts:212` through `packages/operation-core/src/operations/edit-keyform-key.test.ts:307`; invalid non-Vec2 translation shape is rejected without mutation at `packages/operation-core/src/operations/edit-keyform-key.test.ts:421` through `packages/operation-core/src/operations/edit-keyform-key.test.ts:510`. Authoring validator accepts only finite Vec2 patches for `translation` at `packages/authoring-core/src/linear-keyform-editing.ts:396` through `packages/authoring-core/src/linear-keyform-editing.ts:403` and `packages/authoring-core/src/linear-keyform-editing.ts:489` through `packages/authoring-core/src/linear-keyform-editing.ts:501`. Editor state tests assert Rotation bindings include `angleDegrees`, `translation`, and opacity only; interpolated translation is displayed but not editable; exact translation keyform produces an `editKeyformKey` payload; evaluated state uses interpolated Vec2 at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:88` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:242`. Interpolation source supports Vec2 at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:728` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:804`. | Adequate. |
| Wave73 7.5 / 10: existing angle and opacity binding behavior remains available. | Editor state test expects Rotation binding order `angleDegrees`, `translation`, `opacityMultiplier` at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:110` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:115`; the same test still verifies angle and opacity preview/evaluation at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:117` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:191` and `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:238` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:241`. | Adequate. |
| Wave73 7.5 / 10: runtime tests for nonzero rest translation, keyed translation, hierarchy composition, snapshot/diff evidence. | Runtime evidence test sets parent `restTranslation`, child keyed `translation`, checks deterministic snapshot/diff equality, local/world translation, drawable bounds/vertices, keyform sample evidence, and runtime diff paths at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:94` through `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:185`. | Adequate. |
| Wave73 7.4 / 12: Inspector exposes Rest translation X/Y. | Inspector source renders Rest translation X/Y near Pivot and Rest angle at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:759` through `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:820`; payload creation emits `restTranslation` only when changed at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:964` through `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:992`. Inspector test asserts the fields are editable and payload includes `restTranslation` at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:85` through `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:125`. | Adequate. |
| Wave73 7.5 / 12: Parameter Binding supports Vec2 X/Y editing. | ParameterBindingSection renders Vec2 as X/Y numeric inputs at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:163` through `apps/editor/src/workspace/panels/parameter-binding-section.tsx:187`; test asserts Rotation Translation X/Y are enabled at an exact key and Update/Delete are enabled at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:43` through `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:88`. | Adequate. |
| Wave73 7.6 / 10 / 12: Canvas projection and handle/hit-test provide a distinct translation handle. | Handle source defines `"translation"` as a distinct kind and lists pivot/angle/translation positions at `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:8` through `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:89`; hit-test covers translation separately at `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:91` through `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:135`. Test asserts three handles, distinct translation coordinates, and hit-test result at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:69` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:123`. Renderer draws a distinct diamond handle using `translationEditable` state at `apps/editor/src/workspace/canvas/canvas-renderer.ts:442` through `apps/editor/src/workspace/canvas/canvas-renderer.ts:458`. | Adequate. |
| Wave73 7.6 / 12: Canvas evaluates/project rest and keyed translation into overlay and geometry. | Canvas evaluation test covers rest translation, keyed translation, and parent-child composition at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:290` through `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:349`; source applies keyform/rest/preview translation at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:429` through `apps/editor/src/workspace/canvas/canvas-evaluation.ts:457` and applies rotation then translation at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:729` through `apps/editor/src/workspace/canvas/canvas-evaluation.ts:760`. Projection test covers rest/keyed translation overlay and drawable bounds at `apps/editor/src/workspace/canvas/canvas-projection.test.ts:383` through `apps/editor/src/workspace/canvas/canvas-projection.test.ts:430`. | Adequate. |
| Wave73 7.6 / 10 / 12: interaction hook covers preview, single commit, cancel/no-commit, rest vs keyed behavior, ambiguous/interpolated lock, and parented lock. | Gesture test covers one undoable rest-translation commit and undo restoration at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:137` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:210`; exact keyed translation and between-key lock are covered at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:251` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:288`; pointer preview and cancel/no-commit are covered at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:306` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:421`; rest/keyed/locked translation hook paths are covered at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:422` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:584`; parented lock covers pivot/angle/translation disabled with no commit at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:586` through `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:640`. Hook source resolves rest/keyed/locked translation at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:669` through `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:704`. | Adequate. |
| Wave73 7.4 / 7.5 / 12: portable save/load round-trip preserves nonzero `restTranslation` and keyed `translation` using Domain A path. | Authoring portable bundle test exports and imports through Domain A portable bundle path at `packages/authoring-core/src/portable-project-bundle.test.ts:49` through `packages/authoring-core/src/portable-project-bundle.test.ts:56`; fixture includes nonzero `restTranslation` and keyed `translation` at `packages/authoring-core/src/portable-project-bundle.test.ts:406` through `packages/authoring-core/src/portable-project-bundle.test.ts:452`; assertions check imported `restTranslation`, keyed translation patches, and full rigControls/keyformSets equality at `packages/authoring-core/src/portable-project-bundle.test.ts:153` through `packages/authoring-core/src/portable-project-bundle.test.ts:183`. Editor Playwright save/load spec remains broad and verifies restored Rotation/Warp deformer presence but does not add translation-specific UI assertions at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:122` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:133`. | Adequate for translation persistence through lower-level portable bundle coverage. |
| Wave73 12 / 16: scale non-exposure. | `UpdateRigControlPayloadSchema` exposes `restTranslation` but not `restScale` at `packages/operation-core/src/payloads/rig-control.ts:91` through `packages/operation-core/src/payloads/rig-control.ts:119`. Rotation editor bindings are exactly angle, translation, opacity at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:110` through `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:115`. Source search for `restScale` / keyed scale in the changed operation/editor exposure files found only fixtures and internal runtime evaluation use, not Inspector fields, Parameter Binding descriptors, Canvas handles, operation payload fields, or edit-keyform target properties. | Adequate. |
| Wave73 12 / 16: no new save format or browser-local save. | Domain B changed tests use the existing portable bundle path. No package-format change was required by Domain B report, and reviewed Domain B files do not add browser-local save slot, IndexedDB UI, archive/filesystem, File System Access API, directory picker, drag/drop, or cloud persistence. Domain A path remains the save/load foundation per Domain A report and test adequacy review. | Adequate. |

## Browser / E2E Omission Assessment

No focused browser-level Rotation translation drag path was added. This is acceptable for Domain B Test Adequacy because the lower-level tests cover the behavioral layers that a focused browser path would exercise:

- operation payload, validation, wrong-kind, diff, and preservation;
- authoring mutation validation and keyform preservation;
- keyform add/update/projection/interpolation/lock behavior;
- runtime snapshot/diff evidence;
- Inspector static markup and payload generation;
- Parameter Binding Vec2 X/Y rendering;
- Canvas evaluation/projection geometry;
- handle hit-testing and hook-level pointer lifecycle for preview, pointer-up single commit, cancel/no-commit, rest vs keyed edits, ambiguous locks, and parented locks;
- portable bundle round-trip of nonzero `restTranslation` and keyed `translation`.

The existing Playwright portable save/load spec verifies the broad Domain A save/load route and deformer restoration, but it does not specifically author or assert Rotation translation. Given the direct portable bundle assertions and comprehensive hook/model coverage, a new browser path is not required to pass this lane. Residual risk is recorded below.

## Findings

No open findings.

## Validation Rerun

Rerun by reviewer:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
  - First sandbox run failed before config load with esbuild `spawn EPERM`.
  - Escalated rerun passed: 11 files, 86 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/operation-core packages/authoring-core packages/runtime-core apps/editor discussion/implementation/waves/wave73 discussion/implementation/reviews/wave73`: passed with CRLF normalization warnings only.

Reviewed from the Domain B implementation report and corroborated by rerun:

- Gnome's focused Vitest pass for 11 files / 86 tests is consistent with the reviewer rerun.
- Typecheck and source/dependency guards are consistent with the reviewer rerun.

## Residual Test Gaps / Risk

- Low residual risk: there is no browser-level drag path specifically for Rotation translation. Current confidence comes from operation, authoring, runtime, SSR/component, projection/evaluation, hook pointer lifecycle, and portable bundle tests. This is adequate for this wave because parented/interpolated lock semantics and single-commit behavior are better isolated at hook/model level than through the current broad PSD-import Playwright path.
- Low residual risk: keyed translation invalid-shape coverage includes a non-Vec2 rejection through Operation Core, while finite Vec2 validation is explicit in authoring source and rest translation invalid finite coverage is direct. A future targeted test using `{ x: Infinity, y: 0 }` for keyed `translation` would be a useful hardening addition, but the current gap is not blocking because the in-scope success/edit/interpolation/lock behavior is directly tested and source validation is narrow.
- Low residual risk: scale non-exposure is supported by source/diff review and exact binding/payload expectations rather than a dedicated negative UI test named for scale. This is acceptable because the exposed lists are exact and focused grep found no `restScale` or keyed `scale` exposure path in the reviewed UI/operation surfaces.

## Unresolved Questions

None for this review lane.

