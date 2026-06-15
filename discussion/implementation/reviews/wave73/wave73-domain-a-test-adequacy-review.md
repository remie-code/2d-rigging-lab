# Wave73 Domain A Test Adequacy Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: `wave73-save-load-restoration-tree-collapse-policy`

## Scope Reviewed

Reviewed Wave73 Domain A from source, focused tests, browser E2E spec source, the Wave73 plan, Wave72 baseline reports/reviews, development policies, screen specs, and the Domain A implementation report. This review did not rely only on the Gnome summary.

Changed files reviewed:

- `packages/authoring-core/src/package-document-editor-state.ts`
- `packages/authoring-core/src/package-document-manifest.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/to-package-document.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/index.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts`
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave73-plan.md`, especially sections 3, 5, 7.1, 7.2, 7.3, 9, 14, 15, 16.
- `discussion/implementation/orchestration/wave72-plan.md`.
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`.
- `discussion/implementation/reviews/wave72/wave72-final-clean-integration-review.md`.
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`.
- `discussion/development_convention/ux-backed-package-logic-authority.md`.
- `discussion/development_convention/source-file-organization-policy.md`.
- `discussion/development_convention/dependency-policy.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/design/screen-design/screens/project-storage-task.md`.
- `discussion/design/screen-design/screens/authoring-workspace.md`.
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`.

## Requirement-To-Test Coverage

| Requirement | Test / evidence reviewed | Assessment |
|---|---|---|
| Provider/unit: hide Part Container, export portable bundle, load bundle, hidden Part Container restored. | Storage unit coverage exports hidden IDs through `exportEditorProjectBundle` and imports them at `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:55` through `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:83`. Provider load uses a bundle with saved hidden IDs at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:342` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:351` and asserts the imported hidden ID is restored at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:368` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:369`. Browser E2E covers the complete hide-save-reload-open path at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:67` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:93`. | Adequate as combined service/provider/E2E coverage. |
| Stale, duplicate, and invalid editor hidden ID filtering. | Authoring-core filtering uses `PartIdSchema` and current session Part IDs at `packages/authoring-core/src/package-document-editor-state.ts:56` through `packages/authoring-core/src/package-document-editor-state.ts:66`. The portable bundle test mutates saved IDs and asserts only the valid current ID remains at `packages/authoring-core/src/portable-project-bundle.test.ts:192` through `packages/authoring-core/src/portable-project-bundle.test.ts:228`. | Adequate. |
| Browser/E2E: hidden Part Container remains hidden after save/load and Canvas effective visibility follows. | E2E hides `sample_model import`, asserts `Show part container`, asserts no renderable artwork, saves, reloads, opens the bundle, verifies the restored row remains hidden, then shows it and verifies Canvas renderability returns at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:67` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:97`. | Adequate. |
| Drawable visibility and default opacity round-trip. | Portable bundle test asserts `runtimeVisibility: true` and `defaultOpacity: 0.9` at `packages/authoring-core/src/portable-project-bundle.test.ts:98` through `packages/authoring-core/src/portable-project-bundle.test.ts:102`; E2E additionally checks authored opacity keyform restoration at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:115` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:120`. | Adequate. |
| Order and reparenting round-trip. | Portable bundle test asserts imported graph parts equal source parts at `packages/authoring-core/src/portable-project-bundle.test.ts:90` and asserts the drawable remains under the expected Part Container at `packages/authoring-core/src/portable-project-bundle.test.ts:91` through `packages/authoring-core/src/portable-project-bundle.test.ts:96`; draw order is asserted at `packages/authoring-core/src/portable-project-bundle.test.ts:165` through `packages/authoring-core/src/portable-project-bundle.test.ts:170`. | Adequate for current fixture, with residual risk that sibling/mixed-order complexity is thin. |
| Mesh vertices, UVs, triangles, and provenance round-trip. | Portable bundle test asserts vertices, UVs, triangles, and `generationProvenanceId` at `packages/authoring-core/src/portable-project-bundle.test.ts:105` through `packages/authoring-core/src/portable-project-bundle.test.ts:121`, then asserts imported meshes equal source meshes at `packages/authoring-core/src/portable-project-bundle.test.ts:172`. | Adequate. |
| Texture binary bytes round-trip. | Portable bundle test asserts binary payload count, texture binary asset ref, imported file entry bytes, and binary index metadata at `packages/authoring-core/src/portable-project-bundle.test.ts:77`, `packages/authoring-core/src/portable-project-bundle.test.ts:86`, and `packages/authoring-core/src/portable-project-bundle.test.ts:177` through `packages/authoring-core/src/portable-project-bundle.test.ts:187`. Storage service also asserts bytes at `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:32` through `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:50`. | Adequate. |
| Warp numeric state and keyform offsets round-trip. | Portable bundle test asserts Warp parent, domain bounds, lattice size, rest control points, and keyform offsets at `packages/authoring-core/src/portable-project-bundle.test.ts:123` through `packages/authoring-core/src/portable-project-bundle.test.ts:148`. | Adequate. |
| Rotation pivot, rest angle, keyed angle round-trip. | Portable bundle test asserts Rotation pivot, rest angle, child hierarchy, and keyed angle patches at `packages/authoring-core/src/portable-project-bundle.test.ts:150` through `packages/authoring-core/src/portable-project-bundle.test.ts:156`; full rigControls equality is asserted at `packages/authoring-core/src/portable-project-bundle.test.ts:173`. | Adequate for Domain A scope. |
| Parameters and keyform sets round-trip. | Portable bundle test asserts parameter range/default at `packages/authoring-core/src/portable-project-bundle.test.ts:157` through `packages/authoring-core/src/portable-project-bundle.test.ts:163`, then asserts imported parameters and keyform sets equal source data at `packages/authoring-core/src/portable-project-bundle.test.ts:174` through `packages/authoring-core/src/portable-project-bundle.test.ts:175`. | Adequate. |
| Tree initialization: Part Containers default collapsed where expected. | Collapse helper test asserts non-root Part Containers with children initialize collapsed and visible rows omit descendants at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:28` through `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:38`. | Adequate. |
| Tree initialization: deterministic expand path and manual expand/collapse session-only. | Collapse helper test asserts a focused path is expanded while descendants remain collapsed at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:40` through `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:54`; merge test preserves existing manual session state and applies defaults only to newly added parts at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:56` through `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:67`. Provider load test asserts prior manual collapsed state is not restored from the bundle at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:310` and `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:366` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:367`. | Adequate. |
| Tree initialization: no collapsed IDs serialized. | Package editor-state creation writes only `selection`, `lockedIds`, and `editorHiddenIds` at `packages/authoring-core/src/package-document-editor-state.ts:33` through `packages/authoring-core/src/package-document-editor-state.ts:36`; portable test uses exact equality for exported editor state at `packages/authoring-core/src/portable-project-bundle.test.ts:79` through `packages/authoring-core/src/portable-project-bundle.test.ts:85`. | Adequate. |
| Negative assertions: undo history, selection, current parameter values, PSD modal, previous hidden IDs, manual collapse are not persisted. | Provider load test sets selection, parameter value, PSD modal, manual collapse, previous hidden ID, and undo history at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:292` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:319`, then asserts they are cleared/reset while the loaded hidden ID is restored at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:359` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:371`. | Adequate for those editor-local states. |
| Negative assertions: drafts and in-progress gesture state are not persisted. | Fix Loop 1 extends the provider load/reset test to create `meshDraft` and `rigDraft` before load at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:300` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:318`, create provider-owned `rigOperationFeedback` and `parameterOperationFeedback` at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:321` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:340`, and assert all four are cleared after load at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:362` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:365`. The implementation report records a Domain A N/A rationale for direct provider coverage of in-progress gesture preview state at `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md:56` through `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md:60`. | Adequate after Fix Loop 1. |
| Existing tests updated to use explicit expand actions or stable helpers. | The portable save/load E2E calls `expandVisiblePartContainers(page)` after import and after showing the restored container at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:62`, `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:94`, and defines the helper at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:163` through `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:175`. | Adequate. |

## Fix Loop 1 Review

Fix Loop 1 closes TA-001.

Repository facts reviewed:

- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:300` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:318` now creates and asserts provider-owned `meshDraft` and `rigDraft` before load using public context actions.
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:321` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:340` now creates and asserts provider-owned operation feedback before load.
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:362` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:365` asserts `meshDraft`, `rigDraft`, `rigOperationFeedback`, and `parameterOperationFeedback` are `null` after portable bundle load.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:451` through `apps/editor/src/features/editor-session/editor-session-context.tsx:455` clears these provider-owned transient states, and load reset calls that helper at `apps/editor/src/features/editor-session/editor-session-context.tsx:462`.
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md:56` through `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md:60` records an explicit N/A rationale for direct provider testing of in-progress gesture preview state: the provider exposes commit methods, while gesture controller state is closure-local and pointer preview state is owned by canvas hooks outside the provider save/load seam.

Reviewer judgment:

- The added provider test directly covers provider-owned drafts and feedback state.
- The N/A rationale for in-progress gesture preview state is acceptable for Domain A because reviewed source keeps gesture commit controller state in `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts` closure-local, while canvas interaction hooks own pointer preview state outside `EditorSessionProvider`.
- No remaining test adequacy finding blocks Domain A.

## Findings

No open findings.

### TA-001 Medium: Missing negative test or explicit N/A for drafts and in-progress gesture state

Original finding: Wave73 section 9 requires a negative assertion that undo history, drafts, and in-progress gesture state are not persisted. Before Fix Loop 1, the focused provider test adequately covered selection, active parameter values, PSD modal state, manual collapse, old hidden IDs, and undo/redo history, but did not cover provider-owned drafts or operation feedback.

Fix Loop 1 added direct provider assertions for `meshDraft`, `rigDraft`, `rigOperationFeedback`, and `parameterOperationFeedback`, and added an explicit N/A rationale for in-progress gesture preview state in the Domain A report.

Status after Fix Loop 1: `closed`.

## Validation Reviewed / Rerun

Rerun by reviewer:

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
  - First sandbox run failed before config load with esbuild `spawn EPERM`.
  - Escalated rerun passed: 4 files, 19 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Fix-loop reviewer sandbox run failed before config load with esbuild `spawn EPERM`.
  - Escalated rerun passed: 1 file, 9 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
  - Fix-loop reviewer escalated rerun passed: 4 files, 19 tests.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor packages/authoring-core packages/package-format discussion/implementation/waves/wave73`: passed with CRLF normalization warnings only.
- `git diff --check -- apps/editor/src/features/editor-session/editor-session-context-history.test.ts discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`: passed with CRLF normalization warning only.

Reviewed from the implementation report but not rerun in this lane:

- `pnpm.cmd typecheck`: reported pass.
- Focused Playwright portable save/load E2E: reported pass, 1 test.
- Focused collapse-policy and portable-bundle reruns: reported pass.

## Test Gaps Or Residual Risk

- No blocking test adequacy gaps remain for this lane.
- Non-blocking residual risk: order/reparenting round-trip is asserted structurally, but the focused authoring-core fixture has only a minimal single-drawable draw order. A future fixture with mixed sibling ordering would make this oracle stronger.
- Non-blocking residual risk: the Playwright portable save/load test remains broad and can fail from unrelated PSD import, mesh, rig, parameter, or UI selector regressions.

## User-Decision Points

None. TA-001 is closed by test coverage for provider-owned transient state plus an explicit Domain A N/A rationale for in-progress gesture preview state.
