# Wave76 Domain D Spec Compliance Review

## Verdict

pass

No blocking or needs-change findings were found for `wave76-mesh-target-simplification-multi-preview-apply`.

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`
  - Mesh batch accepted behavior: lines 79-89.
  - Mesh target simplification and batch preview/apply requirements: lines 262-284.
  - Domain D implementation and evidence scope: lines 432-462.
  - Verification matrix: lines 536-554.
  - Review/subagent contract: lines 588-620.
  - Orchestration/review policy and out-of-scope list: lines 621-683.
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
  - `discussion/development_convention/ux-backed-package-logic-authority.md`.
  - `discussion/development_convention/dependency-policy.md`.
  - `discussion/development_convention/operation-policy.md`.

## Scope Reviewed

Directly inspected required source/test files:

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

Additional negative-scope reads:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- package/dependency manifest diff scope.

Current worktree note: `git status --short -uall` shows dirty files from Wave76 Domains A/B/C/D and review artifacts. This review did not revert or attribute out-of-scope dirty files to Domain D.

## Acceptance Coverage Matrix

| Wave76 3.4 / 7.4 / 12 requirement | Review result |
|---|---|
| Mesh Inspector Target section shows only target Drawable name(s), in new preview and generated/edit states | Implemented. Target renders only `mesh-tool-target-name` list items at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:192` through `:209`; the old diagnostic/stat rows were removed from that Target section. The source branch is shared for single empty, single generated, and single draft states. Component and E2E checks assert the Target section excludes diagnostic text at `mesh-tool-inspector.test.ts:50` and `psd-import.e2e.spec.ts:319`. |
| Existing Target diagnostic/stat rows are removed | Implemented. The diff removes `SummaryRow` and diagnostic formatter usage from `mesh-tool-inspector.tsx`, and a direct `rg` over Domain D files found no remaining `mesh-tool-source`, `mesh-tool-v6-output-kind`, `mesh-tool-vertex-count`, `mesh-tool-triangle-count`, `SummaryRow`, or diagnostic formatter definitions in the Mesh Inspector source. E2E asserts no Source/V6/backend rows at `psd-import.e2e.spec.ts:325` through `:336`. |
| Single-selection Mesh behavior remains usable | Implemented. Single preview still calls `previewMeshDraft` with `commitMode: "single"` at `editor-session-context.tsx:905` through `:915`; single apply keeps the selected Drawable at `:994` through `:999`. Existing browser flow applies, reaches Generated, regenerates a replacement draft, and cancels at `psd-import.e2e.spec.ts:370` through `:377`. |
| Drawable-set Mesh Tool lists selected Drawable names | Implemented. `resolveMeshToolTarget` handles `selection.kind === "drawableSet"` at `mesh-tool-inspector.tsx:350` through `:371`, and Target maps all selected Drawable names at `:177` through `:187` and `:199` through `:209`. Component and E2E assertions cover this at `mesh-tool-inspector.test.ts:69` through `:85` and `psd-import.e2e.spec.ts:202` through `:206`. |
| Eligible = missing mesh or empty scaffold; generated/non-empty meshes excluded by default and warned | Implemented. `isMeshGenerationEligible` returns true only for missing mesh, zero vertices, or zero triangles at `mesh-tool-state.ts:120` through `:132`; `createMeshDrawableBatchTargets` marks generated targets ineligible with `existingGeneratedMesh` at `:134` through `:160`. Model and component tests cover missing/empty/generated classification and warning at `mesh-tool-state.test.ts:55` through `:72` and `mesh-tool-inspector.test.ts:69` through `:85`. Warning UI lists excluded names at `mesh-tool-inspector.tsx:518` through `:543`. |
| `Generate preview` generates previews for all eligible selected Drawables | Implemented. Batch UI sends eligible targets to `previewMeshDrafts` at `mesh-tool-inspector.tsx:153` through `:160`; context recomputes eligibility and creates one `batchEligible` draft per eligible Drawable at `editor-session-context.tsx:920` through `:939`. Context integration test asserts only two eligible drafts are created from eligible + existing input at `editor-session-context-history.test.ts:399` through `:416`. |
| UI disables `Generate preview` while generation is running | Source implemented with residual observability risk. `isGenerating` is set around generation at `mesh-tool-inspector.tsx:151` through `:164`, `canGeneratePreview` gates the button at `:173` through `:175`, and the button is disabled at `:264` through `:280`. Generation remains synchronous, so React may not paint a visible disabled interval; this is recorded as residual risk, but source prevents an enabled async overlap path. |
| `Apply mesh` is enabled only when eligible previews exist | Implemented. `canApplyPreview` is derived from `draftsForTarget.length > 0` at `mesh-tool-inspector.tsx:176` and used for the Apply button at `:282` through `:291`. Batch drafts are created only from eligible targets, and apply rechecks eligibility. |
| `Apply mesh` applies previews to eligible Drawables only | Implemented. Batch drafts carry `commitMode: "batchEligible"` at `editor-session-context.tsx:930` through `:934`; apply rechecks `isMeshGenerationEligible` for each draft before `commitGenerateMesh` at `:956` through `:977`. The context test snapshots the existing generated mesh before apply and asserts it remains unchanged while eligible meshes gain triangles at `editor-session-context-history.test.ts:423` through `:440`. |
| Batch apply cannot overwrite existing generated/non-empty meshes | Implemented. Existing/non-empty meshes are excluded during preview creation and skipped again at apply time via the `batchEligible` recheck at `editor-session-context.tsx:956` through `:961`. No batch overwrite/regenerate route was found in the reviewed Domain D files. |
| `Cancel` discards all current previews | Implemented. `cancelMeshDraft` clears `meshDrafts` at `editor-session-context.tsx:899` through `:900`; context test asserts batch drafts clear at `editor-session-context-history.test.ts:418` through `:421`; E2E asserts mesh overlay status clears after Cancel at `psd-import.e2e.spec.ts:208` through `:211`. |
| Canvas can show multiple mesh previews/overlays for selected eligible Drawables | Implemented. Evaluation accepts multiple `meshDrafts` at `canvas-evaluation.ts:104` through `:114` and indexes them at `:827` through `:835`; projection exposes `meshOverlays` at `canvas-projection.ts:106` through `:109`, resolves selected set draft overlays at `:255` through `:267` and `:398` through `:427`; renderer iterates every overlay at `canvas-renderer.ts:592` through `:636`. Unit tests cover evaluation, projection, and renderer multiplicity at `canvas-evaluation.test.ts:502` through `:528`, `canvas-projection.test.ts:301` through `:369`, and `canvas-renderer.test.ts:426` through `:474`. |
| Domain D required evidence exists | Implemented. Target name-only, selected names, existing warning/exclusion, multi preview/apply/cancel, and Canvas multi overlay evidence are present in the inspected component/model/context/canvas/E2E tests listed above. Domain D report records focused Vitest, typecheck, source organization, dependency guard, and PSD E2E passes at `wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md:75` through `:85`. |
| Domain C dependency consumed consistently | Implemented. Domain C `drawableSet` is defined and helperized at `editor-selection.ts:3` through `:63`; Domain D consumes it in Mesh Inspector, Canvas projection, and context selection filtering. Parts Tree remains the only modifier-aware multi-select entry at `structure-tree-panel.tsx:51` through `:60`; Deformer Tree and Canvas still call `selectDrawable` without modifier options at `deformer-tree-view.tsx:140`, `deformer-tree-view.tsx:289`, and `canvas-preview-panel.tsx:499` through `:503`. |

## Findings

No blocking findings.

No needs-change findings.

## Forbidden-Scope / Negative Proof

- Existing mesh overwrite/regenerate route in batch Mesh mode was not introduced. Batch drafts use `commitMode: "batchEligible"` and apply rechecks eligibility before each commit at `editor-session-context.tsx:956` through `:961`. The only regenerate wording remains the single-selection button label in `mesh-tool-inspector.tsx:276` through `:280`.
- Mesh generation algorithm changes were not found in Domain D. Draft creation still calls the existing `createGeneratedMeshForDrawable` with the existing default method at `editor-session-context.tsx:1450` through `:1492`; no package mesh-generation files are in Domain D's inspected changed scope.
- Manual topology expansion was not found. Domain D only stores generated preview meshes and applies existing `generateMesh` operations.
- Rig batch create was not implemented by Domain D. Reviewed Domain D files contain no `createRotationDeformerForDrawables`, `createWarpDeformerForDrawables`, or batch Rig create route.
- RigControl `partId` schema changes were not introduced by Domain D. Package schema/operation files in the dirty worktree belong to other Wave76 domains and were not used as Domain D evidence.
- Deformer Tree multi-select was not added. `deformer-tree-view.tsx:140` and `:289` still call `selectDrawable(...)` with no modifier options.
- Canvas Shift/Ctrl multi-select was not added. Canvas click selection still calls `selectDrawable(hitDrawableId)` with no event modifier options at `canvas-preview-panel.tsx:499` through `:503`.
- WebGL clipping work was not added by Domain D. The reviewed Domain D source scope is Editor Mesh/Canvas projection-rendering and PSD E2E; `packages/render-webgl2/**` dirt is parallel-domain scope.
- New dependencies were not added. `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` produced no output, and the Domain D report records `node scripts/check-dependencies.mjs` passed.
- Dependency and operation policies are not contradicted. Mesh apply goes through `commitGenerateMesh` at `editor-session-commands.ts:275` through `:292` via `runCommandWithHistory` at `editor-session-context.tsx:488` through `:516`, preserving the existing Operation Core mutation path rather than direct model mutation.

## Verification Reviewed / Performed

Reviewed reported validation from the Domain D implementation report:

| Command | Reported result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts` | Passed after escalation, 6 files / 51 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts --grep "generates an initial mesh draft|multi-selects Drawable rows"` | Passed after escalation; existing script argument shape ran the whole PSD import spec, 11 Playwright tests. |
| `git diff --check -- <Domain D tracked touched files>` | Passed; CRLF normalization warnings only. |

Performed in this review:

| Check | Result |
|---|---|
| `git status --short -uall` | Dirty worktree confirmed; Domain D files, other Wave76 domain files, and review artifacts are present. |
| Direct source/test inspection | Completed for all files in Scope Reviewed. |
| `git diff --name-only HEAD -- <Domain D tracked files>` | Reviewed tracked Domain D diff scope; `mesh-tool-inspector.test.ts` is untracked and inspected directly. |
| `git diff --check -- <Domain D tracked files>` | Exit 0; CRLF normalization warnings only. |
| `rg` for removed Mesh Target diagnostic hooks/formatters | No remaining Mesh Inspector diagnostic/stat target hooks were found. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` | No output; no dependency manifest or lockfile diff found. |
| Negative-scope `rg` over Domain D files | No batch overwrite route, new dependency surface, Rig batch create route, manual topology expansion, or WebGL clipping work found in the reviewed Domain D scope. |

I did not rerun Vitest, Playwright, broad typecheck, source-organization guard, or dependency guard in this review. The verdict is based on direct source/test inspection, lightweight diff/grep checks, and the Domain D report's recorded validation results.

## Residual Risks

- The `Generate preview` disabled state is implemented in source, but generation is synchronous, so the visible disabled/`Generating preview...` interval may not be observable in a stable UI assertion. I treat this as a non-blocking residual risk because no async overlap route is exposed and generation completion returns the button to a valid state.
- Multi-select E2E asserts draft overlay status rather than the exact overlay count. Multiple overlay count and rendering are covered by focused evaluation/projection/renderer unit tests.
- The single generated/edit Target name-only behavior is source-shared with the single preview target branch and covered by the single apply/regenerate browser path, but there is no separate component assertion for already-generated single selection without a draft.
- Shared Wave76 worktree dirt remains a final-integration risk. This Domain D pass is not a pass for Domains A/B/C/E or combined Wave76 integration.

## User-Decision Points

None.
