# Wave61 Domain B UX / PSD Import / Source Structure Review

Verdict: `pass`

## Scope Reviewed

- Domain: `wave61-psd-import-preview-hidden-group-semantics`
- Lane: UX / PSD Import / source-structure review
- Primary Domain B files:
  - `apps/editor/src/features/psd-import/components/psd-import-modal.tsx`
  - `apps/editor/src/features/psd-import/model/psd-import-preview.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-preview.test.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-planner.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-commit.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-types.ts`
  - `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`, focused on hidden part initialization
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
- Focused dependent files:
  - `apps/editor/src/features/editor-session/model/session-tree.ts`
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
  - `apps/editor/src/workspace/panels/inspector-panel.tsx`
  - `packages/authoring-core/src/structure-order-mutations.ts`
  - `packages/operation-core/src/operations/import-psd-structural-scaffold.ts`
  - focused PSD structural evidence / validator tests used by Domain B behavior

## Basis Documents

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- `discussion/implementation/reviews/wave61/domain-a-ux-source-structure-review.md`
- `discussion/implementation/reviews/wave61/domain-a-package-data-contract-review.md`
- `discussion/implementation/reviews/wave61/domain-a-test-e2e-review.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/components/part-container-inspector.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave61/domain-b-gnome-report.md`

## Findings

No blocking, high, or medium findings for this lane.

## Evidence Checked

- Selected-PSD-only preview is source-local: `psd-import-modal.tsx:260` creates the preview from the current `PsdImportPlan`, and `psd-import-preview.ts:49` derives preview state only from `plan.adapterResult` and `plan.materializedLayerBytes`. It does not read the active workspace model or destination composition.
- Preview filters effective-visible layers: `browser-psd-parser-adapter.ts:219` and `:249` compute effective visibility from local visibility plus parent visibility, and `psd-import-preview.ts:86` excludes non-effective-visible layers from descriptors.
- Layer opacity is represented where practical: `psd-import-preview.ts:126` starts from layer opacity, `:141` multiplies parent group opacity, and `psd-import-modal.tsx:338` / `:345` expose and apply the resolved opacity.
- Review rows preserve local/effective distinction: `psd-import-planner.ts:413` / `:449` populate row metadata, `:495` creates concise visibility labels, and `psd-import-modal.tsx:363` exposes local visibility as structured row state.
- Hidden group import maps to editor-only Part Container hidden state: `psd-import-planner.ts:577` collects locally hidden groups as `editorHiddenPartIds`, `psd-import-commit.ts:73` returns them, and `editor-session-context.tsx:165` unions them into editor session UI state after import.
- Parent hidden does not rewrite child Drawable runtime visibility: `psd-import-planner.ts:347` uses local layer visibility for `initialRuntimeVisibility`, and `import-psd-structural-scaffold.ts:183` only emits a runtime hidden child operation when that initial runtime visibility is false.
- Parts Tree / Canvas / Inspector coherence uses the editor hidden gate separately from Drawable runtime visibility: `session-tree.ts:125` / `:175` compute part effective hidden and drawable effective hidden separately, `canvas-projection.ts:133` / `:158` hides descendants by part gate without changing Drawable runtime state, and `inspector-panel.tsx:101` / `:115` shows Part Container effective visibility.
- Domain A order authority is consumed: `import-psd-structural-scaffold.ts:11` imports `reorderChildrenBySourceOrder`, `:219` applies it, and `:1942` creates mixed Part Container / Drawable source-order entries instead of reverting to `childPartIds` then `drawableIds`.
- E2E remains non-pixel: `psd-import.e2e.spec.ts:26`-`:29` checks stable preview readiness/count hooks. A focused search found no `screenshot` / `toHaveScreenshot` assertion in PSD Import E2E or PSD Import source.

## Verification

- Ran focused PSD preview / hidden group suite:
  - `pnpm.cmd exec vitest run apps/editor/src/features/psd-import/model/psd-import-preview.test.ts packages/package-format/src/psd-structural-scaffold-evidence.test.ts packages/operation-core/src/psd-structural-scaffold-contracts.test.ts packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts`
  - Result: pass, 5 files / 32 tests.
  - Note: initial sandbox Vitest attempt hit Vite/esbuild `spawn EPERM`; escalated rerun passed.
- Ran `git diff --check --` over Domain B app files and focused PSD structural bridge files.
  - Result: exit 0; LF/CRLF warnings only.
- Ran `node scripts/check-source-organization.mjs`.
  - Result: pass.
- Reviewed Domain B Gnome report for broader verification already recorded there: app typecheck/build, root typecheck/unit/check, focused Playwright PSD import E2E, and full diff check passed.

## Remaining Risks / User-Decision Points

- No user/design decision is required.
- Clipping and Photoshop pixel parity remain intentionally out of scope for Import Review preview.
- `data-preview-ready` is currently `false` when a PSD has zero effective-visible layers even though the preview surface can validly show `No visible layers`; future tests should not treat that flag alone as parse/review readiness for that edge case.
- `apps/editor/src/features/editor-session/editor-session-context.tsx` also contains unrelated Domain A/C changes in the dirty worktree; this review only judged the Domain B hidden part initialization path.
