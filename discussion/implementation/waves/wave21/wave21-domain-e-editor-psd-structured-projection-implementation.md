# Wave 21 Domain E Implementation: Editor PSD Structured Projection

## Status

done / ready for Review-Sylph

## Scope

Domain E updated editor-only projection surfaces for the Wave 21 structured PSD profile contract.

Changed files:

- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts`
- `apps/editor/src/ai-command-host/editor-ai-inspection-projector.test.ts`
- `discussion/implementation/waves/wave21/wave21-domain-e-editor-psd-structured-projection-implementation.md`

## Behavior

- Imported source summaries now read `sourceAsset.psdProfile` when present and project adapter evidence, canvas, source groups, structured source layers, unsupported feature details, adapter diagnostics, and compatibility policy.
- PSD projection wording stays metadata-scoped: the UI and AI inspection explicitly say the editor did not parse PSD bytes, decode images, or extract rasters.
- Flattened PSD summaries remain compatible when `psdProfile` is absent.
- Split PNG source intake remains on the existing source-manifest projection path.
- Imported source UI rows now expose structured PSD profile details with aria labels and `overflow-wrap:anywhere` on long diagnostics/features.
- Editor evidence collection adds structured PSD profile-derived target IDs from the committed candidate session when `psdProfile` is available.
- AI `inspectTarget` now supports `sourceAsset` targets and returns structured PSD profile details. `inspectModel` editable target behavior remains parameter-only to avoid changing existing AI read fixture summaries.
- Workflow save/load coverage now verifies that a manually entered PSD adapter/profile import persists `psdProfile` and projects it after reload.

## Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ai-command-host/editor-ai-inspection-projector.test.ts`
  - pass, 4 files / 47 tests
- `pnpm.cmd typecheck`
  - pass

- `git diff --check -- apps/editor discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- dependency manifest diff check
  - pass; no output for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/*/package.json`, or `packages/*/package.json`
- forbidden/other-domain scope diff check
  - observed existing or parallel Wave 21 diffs under `fixtures/contracts/**`, `packages/operation-core/**`, and `packages/validator-core/**`; no Domain E edits were made there
- parser/file-picker/decode/raster scan over Domain E production files
  - pass; the only match is a truthful non-claim in AI source asset inspection projection

## Forbidden Scope Check

Domain E did not edit:

- `fixtures/contracts/**`
- `packages/operation-core/**`
- `packages/validator-core/**`
- `packages/runtime-core/**`
- dependency manifests or lockfiles
- OS file picker, PSD parser, image decode, or raster extraction code

Parallel workspace diffs may exist in fixture/operation/validator paths from other Wave 21 domains; they are not Domain E changes.

## Residual Risks

- The UI summarizes structured PSD profile metadata but does not provide a full layer tree editor. This matches Domain E scope.
- Evidence provider target IDs include structured metadata identifiers for traceability, but runtime snapshots remain runtime-focused and do not render PSD-specific evidence bodies.
