# Wave92 Domain A Spec Compliance Review

- Role / lane: Review-Sylph / Spec Compliance Review
- Date: 2026-06-20
- Target: `wave92-runtime-export-package-contract`
- Verdict: `pass`

## Findings

### Blocking

- None.

### Needs-fix

- None.

### Warnings / Residual Risks

- Cross-document and byte-level verification is intentionally limited in Domain A. `assertRuntimeExportV0SinglePageArtifacts` checks the v0 single-page contract and page identity consistency across manifest/model/atlas for page id, path, dimensions, and pixel format, but it does not verify actual raw RGBA bytes or recompute digest values. That remains acceptable for Domain A because Wave92 assigns current atlas checks, byte availability, digest/media type mismatch checks, and hard-block preflight to Domain B. Evidence: `packages/package-format/src/runtime-export.ts:741`, `packages/package-format/src/runtime-export.ts:779`, `discussion/implementation/orchestration/wave92-plan.md` Domain B hard-block list.

## Evidence

- Runtime Export manifest schema exists and covers schema/version, source package identity, artifact paths, canvas/model bounds, texture page metadata with byte length/digest/media type, required capabilities, and render assumptions. Evidence: `packages/package-format/src/runtime-export.ts:101`, `packages/package-format/src/runtime-export.ts:132`, `packages/package-format/src/runtime-export.ts:166`, `packages/package-format/src/runtime-export.ts:201`.
- Materialized runtime model schema covers canvas/model metadata, parameter role/input metadata, texture page refs, included drawables, meshes with `atlasUvs`, draw order, masks/clipping, rig controls/deformer hierarchy, keyforms, Dynamics solver contract, and Dynamics groups. Evidence: `packages/package-format/src/runtime-export.ts:250`, `packages/package-format/src/runtime-export.ts:303`, `packages/package-format/src/runtime-export.ts:321`, `packages/package-format/src/runtime-export.ts:337`, `packages/package-format/src/runtime-export.ts:387`, `packages/package-format/src/runtime-export.ts:398`, `packages/package-format/src/runtime-export.ts:452`, `packages/package-format/src/runtime-export.ts:501`, `packages/package-format/src/runtime-export.ts:506`.
- Runtime atlas metadata schema covers `pages[]`, placements, atlas source signature, settings, and placement path refs. The placement schema extends the existing texture atlas placement contract, which contains source/content/padded rects and UV rects. Evidence: `packages/package-format/src/runtime-export.ts:645`, `packages/package-format/src/runtime-export.ts:650`, `packages/package-format/src/runtime-export.ts:657`, `packages/package-format/src/texture-atlas.ts:99`.
- File-set contract covers `runtime-export.json`, `runtime/model.json`, `runtime/atlas.json`, and direct `assets/textures/*.raw-rgba` texture page entries. Evidence: `packages/package-format/src/runtime-export.ts:46`, `packages/package-format/src/runtime-export-file-set.ts:21`, `packages/package-format/src/runtime-export-file-set.ts:26`, `packages/package-format/src/runtime-export-file-set.ts:147`.
- Path guards reject traversal, absolute paths, backslashes, unsupported paths, nested texture paths, and duplicate paths. Evidence: `packages/package-format/src/runtime-export.ts:62`, `packages/package-format/src/runtime-export.ts:71`, `packages/package-format/src/runtime-export.ts:703`, `packages/package-format/src/runtime-export-file-set.ts:52`, `packages/package-format/src/runtime-export-file-set.ts:121`, `packages/package-format/src/runtime-export.test.ts:168`.
- Raw RGBA metadata validates dimensions, byte length, media type, and digest fields. Evidence: `packages/package-format/src/runtime-export.ts:94`, `packages/package-format/src/runtime-export.ts:166`, `packages/package-format/src/runtime-export.ts:797`, `packages/package-format/src/binary-asset.ts:35`, `packages/package-format/src/runtime-export.test.ts:66`.
- v0 single-page artifacts are enforced by helper while the atlas schema still allows future `pages[]`. Evidence: `packages/package-format/src/runtime-export.ts:657`, `packages/package-format/src/runtime-export.ts:741`, `packages/package-format/src/runtime-export.test.ts:98`.
- DTOs reject explicitly represented editor/workspace-only top-level sections through strict schemas, with tests covering `workspaceMetadata`, `editorState`, and `sourceManifest`. Evidence: `packages/package-format/src/runtime-export.ts:201`, `packages/package-format/src/runtime-export.ts:506`, `packages/package-format/src/runtime-export.ts:657`, `packages/package-format/src/runtime-export.test.ts:203`.
- Directory-only/raw RGBA/runtime graph separation is preserved. No source changes add runtime/player, camera, OBS, PNG encoding, ZIP/archive, base64, Workspace Save mutation, or Portable JSON reuse. Evidence: changed source scope is limited to `packages/package-format/src/runtime-export.ts`, `packages/package-format/src/runtime-export-file-set.ts`, `packages/package-format/src/runtime-export.test.ts`, and barrel exports in `packages/package-format/src/index.ts`; `rg` hits for PNG are rejection tests only.

## Verification Performed

- Read basis documents:
  - `discussion/implementation/orchestration/wave92-plan.md`
  - `discussion/design/module-contracts/runtime-export-v0-contract.md`
  - `discussion/design/screen-design/screens/runtime-export-task.md`
  - `discussion/design/screen-design/screens/texture-atlas-task.md`
  - `discussion/design/screen-design/screens/viewer-runtime-view.md`
  - `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- Inspected implementation and tests directly:
  - `packages/package-format/src/runtime-export.ts`
  - `packages/package-format/src/runtime-export-file-set.ts`
  - `packages/package-format/src/runtime-export.test.ts`
  - `packages/package-format/src/index.ts`
  - `packages/package-format/src/package-file-paths.ts`
  - `packages/package-format/src/binary-asset.ts`
  - `packages/package-format/src/texture-atlas.ts`
- Read `discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md` as secondary context only.
- Ran `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`.
  - First sandboxed run failed with `spawn EPERM` while loading Vitest/esbuild.
  - Reran with approved escalation; result: 1 test file passed, 6 tests passed.
- Ran `git status --short -uall`, `git diff --name-only`, and targeted `rg` searches to confirm source scope and non-goal absence.

## Final Verdict

`pass`

Domain A satisfies the Runtime Export v0 package-format contract requirements for schemas, DTOs, path/file-set guards, raw RGBA metadata, v0 single-page validation, and separation from Workspace Save / Portable JSON / runtime-player concerns. Remaining byte availability, atlas freshness, actual digest verification, export assembly, and editor directory write behavior are Domain B/C responsibilities and are not blocking for this review lane.
