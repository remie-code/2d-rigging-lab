# Wave76 Domain D Test Adequacy Review

- Verdict: `pass`
- Lane: Test Adequacy
- Domain: `wave76-mesh-target-simplification-multi-preview-apply`
- Date: 2026-06-16
- Reviewer: Review-Sylph

## Findings

No blocking findings.

No needs-change findings.

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.4, 7.4, 12, 15, 17, 18, and 19.
- `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`.
- Domain C dependency evidence:
  - `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`.
  - `discussion/implementation/reviews/wave76/wave76-domain-c-spec-compliance-review.md`.
  - `discussion/implementation/reviews/wave76/wave76-domain-c-design-development-review.md`.
  - `discussion/implementation/reviews/wave76/wave76-domain-c-test-adequacy-review.md`.
- Wave75 baseline:
  - `discussion/implementation/orchestration/wave75-plan.md`.
  - `discussion/implementation/waves/wave75/wave75-final-integration-report.md`.
  - `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`.
- Policies:
  - `discussion/development_convention/source-file-organization-policy.md`.
  - `discussion/development_convention/dependency-policy.md`.

## Scope Reviewed

Directly inspected source/test files:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`

Current worktree note: `git status --short -uall` shows dirty files from other Wave76 domains and review artifacts. This review did not revert or attribute out-of-scope dirty files to Domain D.

## Test Coverage Matrix

| Requirement / edge | Evidence | Status |
|---|---|---|
| Target section is name-only for a single preview target | Component assertion removes target diagnostics at `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:50`; browser path asserts the Mesh target section excludes Status/Preset/Vertices/Triangles/Source/Max edge/Min angle after preview at `apps/editor/e2e/psd-import.e2e.spec.ts:318`. Source renders only `mesh-tool-target-name` entries in Target at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:192`. | Covered |
| Single-selection generated/edit regression remains usable | Existing browser path applies a mesh, reaches Generated status, regenerates a replacement draft, then cancels back to committed status at `apps/editor/e2e/psd-import.e2e.spec.ts:370`. Single-draft compatibility is preserved by `createMeshToolDraftCompatValue` at `apps/editor/src/features/editor-session/editor-session-context.tsx:1495`. | Covered |
| Multi-select Mesh Tool lists selected Drawable names | Component assertion at `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:69`; browser assertion after Parts Tree multi-select and Mesh Tool activation at `apps/editor/e2e/psd-import.e2e.spec.ts:202`. | Covered |
| Existing generated/non-empty mesh warning and exclusion | Eligibility model test covers empty scaffold, generated mesh exclusion, and missing mesh eligibility at `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:55`; warning component assertion at `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:69`; warning source lists excluded names at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:524`. | Covered |
| Generate preview for multiple eligible Drawables | Context integration test calls `previewMeshDrafts` over eligible + excluded ids and asserts only the two eligible drafts are created at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:389`; implementation filters eligible targets before draft creation at `apps/editor/src/features/editor-session/editor-session-context.tsx:920`. | Covered |
| Apply commits generated previews only for eligible Drawables | Context integration test snapshots the existing generated mesh, applies batch drafts, and asserts the existing mesh is unchanged while eligible meshes gain triangles at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:423`; apply code rechecks `batchEligible` with `isMeshGenerationEligible` before commit at `apps/editor/src/features/editor-session/editor-session-context.tsx:944`. | Covered |
| Cancel discards all previews | Context integration test asserts `cancelMeshDraft` clears all batch drafts at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:418`; browser multi-select path generates a preview and cancels back to no overlay status at `apps/editor/e2e/psd-import.e2e.spec.ts:208`; source clears `meshDrafts` at `apps/editor/src/features/editor-session/editor-session-context.tsx:899`. | Covered |
| Canvas evaluation can represent multiple previews | `createCanvasEvaluatedScene` multiple-draft test asserts both selected Drawables use draft evaluated meshes at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:502`; evaluation indexes `options.meshDrafts` by Drawable id at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:829`. | Covered |
| Canvas projection can represent multiple overlays | Projection test asserts two draft `meshOverlays` for a `drawableSet` at `apps/editor/src/workspace/canvas/canvas-projection.test.ts:301`; projection resolves selected set ids and returns `meshOverlays` at `apps/editor/src/workspace/canvas/canvas-projection.ts:255`. | Covered |
| Canvas renderer draws multiple overlays | Renderer test asserts two draft overlay dash/vertex marker passes at `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:426`; renderer iterates `projection.meshOverlays` at `apps/editor/src/workspace/canvas/canvas-renderer.ts:590`. | Covered |
| Focused E2E path for batch Mesh UX | PSD import path covers Parts Tree multi-select into Mesh Tool target names, preview generation, overlay draft status, and cancel at `apps/editor/e2e/psd-import.e2e.spec.ts:162`. Domain D report records the focused command passed, but the script argument shape ran the full PSD import spec. | Covered |
| Batch no-overwrite negative case | Model eligibility excludes generated meshes; context apply rechecks eligibility and test asserts the existing mesh is unchanged. | Covered |
| Single-selection regression | Existing PSD mesh authoring E2E remains in the same spec at `apps/editor/e2e/psd-import.e2e.spec.ts:300`; component/context compatibility keeps `meshDraft` as the single-draft public value. | Covered |
| Generate Preview disabled while generating | Source sets `isGenerating`, disables the button via `canGeneratePreview`, and renders `Generating preview...` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:151` and `:272`. No stable automated assertion directly observes this transient synchronous state. | Source-covered residual risk |

## Verification Reviewed / Performed

Reviewed reported validation from the Domain D implementation report:

| Command | Reported result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts` | Passed after escalation, 6 files / 51 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts --grep "generates an initial mesh draft|multi-selects Drawable rows"` | Passed after escalation; existing script argument shape ran the full PSD import spec, 11 Playwright tests. |
| `git diff --check -- <Domain D tracked touched files>` | Passed; CRLF normalization warnings only. |

Performed in this review:

| Check | Result |
|---|---|
| `git status --short -uall` | Dirty worktree reviewed; includes Domain D files plus other Wave76 domain dirt. |
| `git diff --name-status HEAD -- <Domain D files>` | Reviewed Domain D tracked source/test scope; `mesh-tool-inspector.test.ts` is untracked and inspected directly. |
| `rg` over Domain D files for test names, target names, warning/exclusion, batch, preview/apply/cancel, `meshDrafts`, and `meshOverlays` | Source/test evidence inspected directly. |
| `git diff --check -- <Domain D files and report>` | Exit 0; CRLF normalization warnings only. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` | No output; no manifest or lockfile diff found. |

I did not rerun Vitest, Playwright, or broad typecheck in this review. The adequacy decision is based on direct source/test inspection plus the reported focused validation results, with lightweight guards rerun locally.

## Residual Risks

- The `Generate preview` disabled state is implemented but not directly asserted in an automated test. Because preview generation remains synchronous, the visible disabled interval may be too short for a stable UI test; this is non-blocking.
- The single generated/edit Target name-only behavior is covered by the shared unbranched Target rendering source and by the existing single apply/regenerate E2E path, but there is no separate component assertion that rerenders the Target section after an already-generated mesh is selected. This is acceptable source-evidence coverage, not a blocker.
- The multi-select E2E asserts draft overlay status rather than overlay count. Overlay multiplicity is covered at evaluation/projection/renderer unit levels, which is adequate for this lane.
- Shared worktree dirt from other Wave76 domains remains a final-integration risk. This Domain D test adequacy pass should not be read as a pass for combined Wave76 behavior.

## User Decision Points

None.
