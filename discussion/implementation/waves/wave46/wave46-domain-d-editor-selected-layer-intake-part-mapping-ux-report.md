# Wave46 Domain D Report: Editor Selected Layer Intake / Part Mapping UX

> Target: `wave46-editor-selected-layer-intake-part-mapping-ux`
> Date: 2026-06-05
> Orchestrator: Orch-Sylph
> Implementation: Gnome
> Review: Review-Sylph pass

## Verdict

`pass`

Domain D is implemented in the Editor scope. The implementation adds an explicit selected PSD layer intake workflow from the Wave45 parsed PSD tree, through the Domain B selected-layer materialization service, into the Domain C parser-free `importPsdLayerMaterialization` operation bridge.

No package-format, operation-core, validator-core, dependency, drag/drop/archive/filesystem, all-layer import, renderer, export, public demo ingestion, or AI inference/repair scope was edited by this Domain D run.

Separate Review-Sylph review completed with `pass` and no blocking findings:

- `discussion/implementation/reviews/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-review.md`

## Files Changed

Domain D source/workflow/UI files:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/psd-layer-materialization-command.ts`
- `apps/editor/src/editor-session/selected-psd-layer-binary-registration-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-workflow.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`

Focused tests updated/added:

- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`

Persistent report:

- `discussion/implementation/waves/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-report.md`

Pre-existing/parallel Domain B/C package and materialization-service worktree changes were treated as prerequisites and not reverted.

## Implementation Summary

- Extended explicit PSD import state/view projection with `selectedLayerIntake` status, concise summary facts, diagnostics, and layer-row `kind`.
- Added PSD import panel controls for explicit parsed-layer selection, existing destination part selection, new destination part creation where the operation contract allows it, optional drawable display name, Add/Intake action, result facts, and diagnostics.
- Retained the current-session PSD `File` and parser-free bridge result in the workflow controller after parse, and clears that retained source on project/package-changing flows so stale bytes require re-parse.
- Added `commitEditorSelectedPsdLayerIntakeWorkflow` to validate selected layer/current source freshness, call Domain B materialization, import source metadata when missing, commit Domain C layer materialization, and store materialized texture bytes through the existing browser-local project byte store.
- Added Editor session helpers for materialized raw RGBA binary asset registration and Domain C operation request construction.
- Added session adapter/evidence-provider support for committing `importPsdLayerMaterialization` with package-local materialized bytes.

## Result Summary Behavior

Committed intake state exposes concise facts for:

- materialized digest
- materialized byte length
- media type
- dimensions
- texture mapping evidence
- drawable-to-part mapping evidence
- source PSD/source layer evidence
- private/local provenance
- `publicDemoAsset=false`
- package-local/browser-local persistence result

Domain B materialization failures and Domain C operation rejections are surfaced into `selectedLayerIntake.diagnostics` instead of being hidden. Operation `blocking` diagnostics are mapped to Editor UI `error` severity because the Editor diagnostic state supports `info`, `warning`, and `error`.

## Persistence / Provenance Boundary

- Source PSD bytes are retained only as current-session browser `File` input and are not persisted as project binary bytes by Domain D.
- Source asset import is metadata-only when needed; the source asset has no PSD `binaryAssetRef`.
- Raw parser objects are not persisted in Editor semantic state or project state.
- Materialized selected-layer bytes are registered as a private/local project texture binary asset under `assets/textures/psd/...`.
- Materialized media type remains `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`.
- Provenance remains private/local and not publicly distributable with `publicDemoAsset=false`.

## Verification Performed

Gnome verification passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm.cmd typecheck`
- `pnpm.cmd run check:source`
- `pnpm.cmd run check:deps`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave46`

Notes:

- `git diff --check` exited successfully. It printed existing Git line-ending normalization warnings for several Editor files.
- Shell commands required sandbox escalation because this environment rejected normal process launch under the managed sandbox.

Review-Sylph independent verification passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm.cmd typecheck`
- `pnpm.cmd run check:source`
- `pnpm.cmd run check:deps`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave46 discussion/implementation/reviews/wave46`
- no-index whitespace checks for new Domain D files

## Review Findings / Fix Loops

Review-Sylph found no blocking findings, so no fix loop was required.

Non-blocking review notes:

- Domain D workflow-level new-part commit coverage is indirect through UI command coverage and Domain C operation tests.
- Direct `missingCurrentSource` / `staleCurrentSource` workflow tests were not added, although validation exists and representative Domain B/C error surfacing is covered.
- The worktree is mixed with package/operation/validator changes from other Wave46 domains; Domain D review scoped attribution to Editor files and the Domain D report/review artifacts.

## Remaining Issues / User-Decision Points

No user decision point is currently known.

Residual risks for review:

- The workflow derives stable Editor ids from PSD file/layer/drawable display names; Review-Sylph should inspect collision behavior and whether existing operation preconditions are sufficient for duplicates.
- Browser-local persistent byte storage is best-effort after the package operation commit; package-local session bytes remain the committed operation boundary even if browser-local storage is unavailable.
- No manual browser/e2e run was performed; this domain was verified with focused component/workflow tests and repository checks.

## Suggested Review Focus

- Confirm source PSD bytes and raw parser objects stay out of persisted project state.
- Confirm stale current-source clearing covers package/project-changing controller paths.
- Confirm Domain B failure and Domain C rejection diagnostics remain visible in the panel.
- Confirm existing-part and new-part destination commands match Domain C contracts.
- Confirm materialized binary asset refs, rights asset id, texture/drawable/part ids, and provenance facts match Domain A/C boundary expectations.
