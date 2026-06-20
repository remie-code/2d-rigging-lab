# Wave92 Domain A Design / Development Compliance Review

Role: Review-Sylph
Lane: Design / Development Compliance Review
Date: 2026-06-20
Target: `wave92-runtime-export-package-contract`
Verdict: `pass`

## Findings

### Blocking

None.

### Needs-Fix

None.

### Warnings / Residual Risks

- `packages/package-format/src/runtime-export.ts` is a large but cohesive Runtime Export contract/schema family. This is acceptable for Domain A because implementation behavior and file-set handling are split into `runtime-export-file-set.ts`, `index.ts` remains barrel-only, and `node scripts/check-source-organization.mjs` passes. If Domain B/C or future schema expansion adds assembly, IO, editor, or runtime-player behavior, split this file further instead of growing it into a mixed-responsibility module.
- `git diff --check` only covers tracked files. I separately checked the new Domain A source/report files for trailing whitespace with `rg -n "[ \t]+$"` and found no matches.

## Evidence

### Contract Ownership / Boundary

- `packages/package-format/src/runtime-export.ts:46` to `packages/package-format/src/runtime-export.ts:53` define Runtime Export path/media constants only; no app, authoring, runtime-core, operation-core, or browser IO behavior is present.
- `packages/package-format/src/runtime-export.ts:201` to `packages/package-format/src/runtime-export.ts:247` define the manifest schema with artifact paths, texture page metadata, canvas/model bounds, capabilities, and render assumptions.
- `packages/package-format/src/runtime-export.ts:506` to `packages/package-format/src/runtime-export.ts:523` define the materialized runtime model DTO with texture pages, parameters, input manifest, drawables, meshes, draw order, masks, rig controls, keyforms, Dynamics, and render assumptions.
- `packages/package-format/src/runtime-export.ts:657` to `packages/package-format/src/runtime-export.ts:663` define the runtime atlas DTO with source signature, settings, pages, and placements.
- `packages/package-format/src/runtime-export.ts:741` to `packages/package-format/src/runtime-export.ts:769` enforce the v0 single-page artifact assertion while the schema keeps `pages[]`.
- `packages/package-format/src/runtime-export-file-set.ts:52` to `packages/package-format/src/runtime-export-file-set.ts:88` provide Runtime Export file path assertions; `packages/package-format/src/runtime-export-file-set.ts:147` to `packages/package-format/src/runtime-export-file-set.ts:170` serialize/parse text artifacts only.
- `packages/package-format/src/index.ts:32` to `packages/package-format/src/index.ts:33` are barrel-only exports for the new Runtime Export modules.

### Path / Binary / Artifact Safety

- `packages/package-format/src/runtime-export.ts:703` to `packages/package-format/src/runtime-export.ts:711` restrict texture page paths to package-relative direct files under `assets/textures/` ending in `.raw-rgba`.
- Existing package path safety rejects empty, backslash, absolute, and traversal paths in `packages/package-format/src/package-file-paths.ts:72` to `packages/package-format/src/package-file-paths.ts:95`; Domain A reuses this guard.
- Raw RGBA metadata validation checks dimensions and byte length in `packages/package-format/src/runtime-export.ts:797` to `packages/package-format/src/runtime-export.ts:821`.
- Digest and byte length schemas come from existing package-format binary contracts in `packages/package-format/src/binary-asset.ts:35` to `packages/package-format/src/binary-asset.ts:44`.

### Forbidden Boundary / Dependency Scope

- No `RuntimeExport` references were found under `packages/runtime-core`, `packages/authoring-core`, `packages/operation-core`, or `apps/editor`; Domain A did not change those layers.
- Scoped git status for `package.json`, `pnpm-lock.yaml`, `packages/package-format/package.json`, `packages/runtime-core`, `packages/authoring-core`, `packages/operation-core`, and `apps/editor` produced no output.
- Search over the Domain A source/test files found no `authoring-core`, `runtime-core`, `operation-core`, editor imports, Browser File System Access types, or browser-only API usage. The only browser-like false match was the existing barrel export path `./package-document.js`.
- Dependency guard passed. No new dependencies, lockfile changes, Cubism/Core/parser/archive dependencies, PNG encoder dependency, or ZIP/archive dependency were added. Test references to `image/png` and `.png` are negative rejection cases in `packages/package-format/src/runtime-export.test.ts:80` and `packages/package-format/src/runtime-export.test.ts:174`, not external oracle usage.

### Texture Atlas / Viewer / Workspace Boundaries

- Domain A references committed atlas metadata schemas from package-format (`TextureAtlasPlacementSchema`, `TextureAtlasLayoutSettingsSchema`, `TextureAtlasSourceSignatureSchema`) but does not change Texture Atlas generation, Apply behavior, Viewer remap behavior, or Workspace Save behavior.
- Runtime Export file paths are separate from Workspace Save and Portable JSON paths: `runtime-export.json`, `runtime/model.json`, `runtime/atlas.json`, and direct `assets/textures/*.raw-rgba` entries are defined in `packages/package-format/src/runtime-export.ts:46` to `packages/package-format/src/runtime-export.ts:50`.
- No workspace save, portable bundle, viewer, atlas task, or operation-core source files were edited.

### Test Scope

- `packages/package-format/src/runtime-export.test.ts:26` to `packages/package-format/src/runtime-export.test.ts:64` cover valid minimal manifest/model/atlas parsing.
- `packages/package-format/src/runtime-export.test.ts:66` to `packages/package-format/src/runtime-export.test.ts:96` cover raw RGBA metadata dimensions, byte length, media type, and digest validation.
- `packages/package-format/src/runtime-export.test.ts:98` to `packages/package-format/src/runtime-export.test.ts:144` cover v0 single-page enforcement while allowing future `pages[]` at schema level.
- `packages/package-format/src/runtime-export.test.ts:146` to `packages/package-format/src/runtime-export.test.ts:166` cover accepted directory file-set paths and text artifact parsing.
- `packages/package-format/src/runtime-export.test.ts:168` to `packages/package-format/src/runtime-export.test.ts:201` cover traversal, absolute, backslash, unsupported, and duplicate path rejection.
- `packages/package-format/src/runtime-export.test.ts:203` to `packages/package-format/src/runtime-export.test.ts:218` cover rejection of explicitly represented editor/workspace-only sections.

## Verification Performed

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`
  - Initial sandboxed run failed with `spawn EPERM` while loading Vitest/esbuild.
  - Re-run with approved escalation passed: 1 test file, 6 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check`
  - Passed for tracked changes; only line-ending warnings were emitted.
- `rg -n "[ \t]+$" packages/package-format/src/runtime-export.ts packages/package-format/src/runtime-export-file-set.ts packages/package-format/src/runtime-export.test.ts discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md`
  - No trailing-whitespace matches.
- `rg -n "RuntimeExport|runtime-export" packages/runtime-core packages/authoring-core packages/operation-core apps/editor`
  - No matches.

## Final Verdict

`pass`

Domain A stays within `package-format` as a pure Runtime Export v0 contract/file-set implementation. It does not leak browser File System Access types into packages, does not make `runtime-core` depend on package/authoring/file IO, does not use `operation-core` for export, does not alter Texture Atlas / Viewer / Workspace Save behavior, and does not add dependencies or forbidden format/oracle usage.
