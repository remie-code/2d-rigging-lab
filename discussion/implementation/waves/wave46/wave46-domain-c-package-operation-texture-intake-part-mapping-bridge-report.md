# Wave46 Domain C Report: Package / Operation Texture Intake And Part Mapping Bridge

> Target: `wave46-package-operation-texture-intake-part-mapping-bridge`
> Date: 2026-06-05
> Orchestrator: Orch-Sylph
> Implementation: Gnome in a separate context
> Review: Review-Sylph in separate clean contexts

## Verdict

`pass`

Domain C added a parser-free package/operation bridge that connects selected PSD layer materialization evidence to source layer, texture, drawable, and destination part mapping evidence. The implementation stayed inside package/operation scope, did not import a PSD parser in `packages/**`, and preserved the existing texture-backed preview and part mapping foundations.

Two Review-Sylph `needs_fix` loops were completed. The final clean Review-Sylph review returned `pass`.

## Files Changed

- `packages/package-format/src/binary-asset.ts`
- `packages/package-format/src/psd-source-evidence.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/psd-import-operation-evidence.ts`
- `packages/operation-core/src/psd-layer-materialization-operation-evidence.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-result.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/index.ts`

No `apps/editor/src/**`, `packages/validator-core/src/**`, dependency manifest, lockfile, renderer, parser implementation, or public demo asset scope was edited by Domain C. Parallel Domain B Editor changes were present in the worktree and were not touched by Domain C.

## Package / Operation Bridge Summary

- Added parser-free `importPsdLayerMaterialization` operation support.
- Added `psd-layer-materialization-operation-evidence-v1` result/log evidence.
- Added operation plumbing so the new operation can be typed, registered, executed, logged, and merged into lifecycle evidence.
- Extended package-format evidence support narrowly for Wave46 selected layer raw RGBA materialization.
- Kept public `index.ts` barrel-only.
- Kept evidence metadata-only and raw-byte-free in operation evidence. Materialized bytes are referenced through existing package-local binary asset refs.

## Part / Texture / Drawable Mapping Evidence

The operation can connect:

- source PSD digest/hash and byteLength
- source PSD source asset ref
- selected source layer ref, original name, and source layer path
- parser name/version
- canonical selected-layer extraction options
- raw RGBA media type: `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`
- materialized digest/hash, byteLength, width, and height
- package-local materialized binary asset ref
- texture atlas evidence
- drawable creation evidence
- mesh selection evidence
- existing destination part membership, or new destination part creation
- private/local provenance with `publicDemoAsset=false`

The bridge intentionally does not claim Photoshop-equivalent compositing, renderer/pixel correctness, texture sampling correctness, all-layer import, recursive group import, atlas packing, Cubism compatibility, public demo asset status, or source PSD byte persistence.

## Stale / Missing Handling

The operation rejects before mutation when package/operation-owned identity or availability checks fail, including:

- missing source PSD digest or byteLength
- source PSD digest/byteLength mismatch, including `contentHash=sha256:<hex>` fallback when there is no source binary ref
- parser name/version mismatch
- missing or non-canonical extraction options
- wrong extraction kind or extraction option mismatch
- source layer name/path mismatch, including wrong group path with the same final layer name
- raw RGBA byteLength/dimension mismatch
- missing materialized binary ref
- binary ref digest/byteLength/mediaType mismatch
- unavailable materialized bytes
- duplicate texture/drawable/mesh ids
- missing or duplicate destination parts

These cases require re-materialization, reupload, or re-selection rather than silently treating stale materialized bytes as current.

## Fix Loop Summary

Review loop 1 found two blocking issues:

- extraction evidence accepted non-selected-layer or option-mismatched materialization
- source PSD digest mismatch could pass when the source asset had `contentHash` but no source binary ref

Gnome fix loop 1 tightened extraction validation and added `contentHash=sha256:<hex>` digest fallback validation, with focused negative tests.

Review loop 2 found one blocking issue:

- `sourceLayerPath` accepted a different group path when the final layer name matched

Gnome fix loop 2 tightened path comparison to exact expected path or prefixed full expected tail only, with a focused negative test.

Final Review-Sylph review returned `pass`.

## Verification Performed

Gnome reported:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`: passed, 6 tests
- related parser-free/schema tests: passed, 5 files / 24 tests
- direct parser import scan under `packages/**`: no direct parser imports
- `pnpm.cmd typecheck`: passed
- `pnpm.cmd run check:source`: passed
- `git diff --check -- packages/package-format/src packages/operation-core/src`: passed with LF/CRLF warnings only
- no-index whitespace checks for new untracked Domain C files: no whitespace findings

Final Review-Sylph independently reported:

- focused verification: 4 files / 22 tests passed
- `pnpm.cmd typecheck`: passed
- `pnpm.cmd run check:source`: passed
- fixed-string parser import scan under `packages/**`: no direct `@webtoon/psd` or `ag-psd` imports/requires
- `git diff --check -- packages/package-format/src packages/operation-core/src`: passed with LF/CRLF warnings only
- no-index whitespace checks for new untracked Domain C files: no whitespace findings

## Remaining Issues / User-Decision Points

None for Domain C.

Future product decisions remain outside this domain: public/demo asset policy, all-layer PSD import, drag-drop/archive/filesystem workflows, renderer/pixel oracle, advanced topology/UV/atlas work, and Cubism policy reconsideration.

## Orchestration Separation

Separation was preserved:

- Orch-Sylph did not implement source changes.
- Gnome implemented source changes in a separate context.
- Review-Sylph reviewed in separate clean contexts and remained read-only.
- Review findings were routed back to Gnome through bounded fix loops.
