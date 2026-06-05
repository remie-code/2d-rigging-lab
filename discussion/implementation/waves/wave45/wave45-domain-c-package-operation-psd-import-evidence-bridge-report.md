# Wave45 Domain C Report: Package / Operation PSD Import Evidence Bridge

> Target: `wave45-package-operation-psd-import-evidence-bridge`
> Role: Gnome implementation agent
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

Domain C implemented a focused operation/package bridge for browser-origin, parser-free PSD parse evidence. The package/operation side now accepts browser parser evidence by DTO summary, materializes it into source/package metadata, and exposes it in operation result/log evidence without importing or executing any PSD parser in `packages/**`.

One verification caveat remains outside Domain C scope: full `pnpm.cmd typecheck` currently fails in parallel Domain B Editor files under `apps/editor/src/editor-workflow/**`, which Domain C is forbidden to edit. Root package typecheck passed.

## Files Changed

- `packages/operation-core/src/psd-import-operation-evidence.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `packages/operation-core/src/mesh-topology-uv-contract.test.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `discussion/implementation/waves/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-report.md`

No `apps/editor/src/**`, `packages/validator-core/src/**`, `package.json`, `pnpm-lock.yaml`, dependency registry, parser source, renderer, archive/filesystem, or drag-drop files were edited by Domain C.

## Bridge Summary

- Added `psd-import-operation-evidence-v1` as operation-core structured evidence for PSD imports.
- Added optional `psdImportEvidence` to `OperationResultSchema` and `OperationEvidenceResultSchema`, with lifecycle merge support so provider-generated operation evidence can also be attached.
- `importPsdSourceAsset` now emits `psdImportEvidence` into operation results and operation log entries when parser-free adapter evidence is present.
- Browser-origin evidence is classified as `parseOrigin=browserExplicitFileSelection` when parser evidence records `runtime=browser`.
- The evidence summary carries parser evidence, layer tree evidence, feature-support counts, selected layer materialization summaries, and explicit persistence boundary claims.
- Source manifest diagnostics now include flattened parser/layer-tree/feature/materialization/persistence summaries for package/session observability.
- Package-format compatibility was kept additive: focused tests prove browser-origin parser-free evidence with `runtime=browser` serializes and reloads through the existing PSD source manifest schema.

## Save / Load Boundary Summary

- Parser-private shapes remain excluded through `privateShapePolicy=parser-private-shape-excluded-v1`.
- Raw parser objects are not persisted.
- Raw PSD bytes are not persisted by evidence; they are represented as `metadataOnlyNoRawBytes` unless an existing `binaryAssetRef` is present.
- Selected layer materialization is attached by digest/byte-length/media/provenance summary. The operation summary intentionally omits `binaryAssetRef` and raw materialized bytes.
- Materialized bytes are only claimable through existing byte storage boundaries, recorded as `binaryAssetRefOnlyNoInlineBytes` when such refs exist.
- No Photoshop full compositing, renderer correctness, texture sampling correctness, pixel oracle, public demo asset, or Cubism compatibility claim was added.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/mesh-topology-uv-contract.test.ts`
  - Passed: 3 files, 21 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts`
  - Passed: 1 file, 2 tests.
- `pnpm.cmd run typecheck:root`
  - Passed.
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- Fixed-string parser import scans under `packages/**`
  - No direct `from "@webtoon/psd"`, `from '@webtoon/psd'`, `import("@webtoon/psd")`, `from "ag-psd"`, `from 'ag-psd'`, `import("ag-psd")`, `require("@webtoon/psd")`, or `require("ag-psd")` hits.
  - Broad `@webtoon/psd|ag-psd` scan found evidence strings in tests only, not imports.
- `git diff --check -- packages/operation-core/src/index.ts packages/operation-core/src/lifecycle/evidence.ts packages/operation-core/src/mesh-topology-uv-contract.test.ts packages/operation-core/src/operation-evidence-result.ts packages/operation-core/src/operation-result.ts packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operations/import-psd-source-asset.ts packages/package-format/src/source-manifest.test.ts`
  - Passed; Git reported LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/operation-core/src/psd-import-operation-evidence.ts`
  - No whitespace findings; command exited nonzero as expected for no-index diff against `NUL`, with LF-to-CRLF warning only.

Verification caveat:

- `pnpm.cmd typecheck` was run and root typecheck passed, but the command failed during the Editor package typecheck on parallel Domain B files:
  - `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - Errors included exact-optional-property and implicit `any` issues.
  - Domain C did not edit these forbidden-scope files.

## Remaining Issues

- None in Domain C source.
- Orchestration should route the current full `pnpm typecheck` failure to the Editor/browser parser bridge owner because it is outside Domain C write scope.

## User-Decision Points

None for Domain C.

Future user decisions remain required before public demo material, public visual byte distribution, archive/filesystem/drag-drop expansion, full renderer/pixel oracle, Cubism compatibility, or repo-side repair/LLM/autofix scope.

## Early Escape Status

No Domain C early escape was triggered. No Domain C write-scope collision was observed. The only verification caveat is the out-of-scope parallel Editor typecheck failure noted above.
