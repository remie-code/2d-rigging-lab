# Wave92 Domain A Runtime Export Package Contract Report

## Verdict Candidate

pass

## Files Changed

- `packages/package-format/src/runtime-export.ts`
  - Runtime Export v0 manifest/model/atlas DTO schemas.
  - raw RGBA texture page metadata contract.
  - runtime materialized graph DTO with atlas UVs, texture page refs, drawables, meshes, draw order, masks, rig controls, keyforms, Dynamics groups, and solver/render assumptions.
  - parse helpers and v0 single-page artifact assertion.
- `packages/package-format/src/runtime-export-file-set.ts`
  - Runtime Export directory file-set entries and path guards for `runtime-export.json`, `runtime/model.json`, `runtime/atlas.json`, and direct `assets/textures/*.raw-rgba` pages.
  - text artifact serialize/parse helpers and duplicate path checks.
- `packages/package-format/src/runtime-export.test.ts`
  - focused Domain A schema/file-set tests.
- `packages/package-format/src/index.ts`
  - barrel-only exports for the new Runtime Export modules.

## Verification Run

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`
  - pass: 1 file, 6 tests.
  - note: the first sandboxed run failed with `spawn EPERM` while loading Vitest/esbuild; rerun with approved escalation passed.
- `pnpm.cmd typecheck`
  - pass.
- `node scripts/check-source-organization.mjs`
  - pass.
- `node scripts/check-dependencies.mjs`
  - pass.

## Implementation Summary

- Added pure `package-format` Runtime Export v0 schemas without importing `runtime-core`, `authoring-core`, `operation-core`, editor code, browser APIs, or File System Access types.
- Added manifest contract with source package identity, artifact paths, canvas/model bounds, raw RGBA page metadata, required runtime capabilities, and render assumptions.
- Added materialized runtime model contract with JSON arrays instead of Maps, atlas-applied `atlasUvs`, texture page references, input/output parameter role metadata, included drawables, draw order, mask/clipping relations, rig/deformer hierarchy, keyforms, Dynamics groups, and solver defaults.
- Added runtime atlas metadata with `pages[]`, placements, source signature, layout settings, source/content/padded rects, and UV rects.
- Added raw RGBA metadata validation for dimensions, byte length, media type, digest, and direct texture page paths.
- Added file-set helpers and guards for the v0 directory shape.
- Kept schema future-compatible for multiple `pages[]`; v0 helper enforces exactly one page for current artifacts.
- Added strict top-level DTO rejection for editor/workspace-only sections represented in manifest/model/atlas inputs.

## Basis Coverage Self-Report

- `discussion/implementation/orchestration/wave92-plan.md`
  - Covered Domain A required implementation, tests, allowed scope, forbidden scope, and non-goals.
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
  - Covered package-format ownership, directory shape, manifest/model/atlas/raw RGBA contracts, include/exclude DTO boundary, render assumption fields, and runtime input parameter metadata.
- `discussion/design/screen-design/screens/runtime-export-task.md`
  - Covered output shape and contract fields needed by the later task UI; UI and directory write behavior deferred.
- `discussion/design/screen-design/screens/texture-atlas-task.md`
  - Preserved atlas artifact separation and treated committed atlas metadata as source material; atlas generation/preview behavior untouched.
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
  - Preserved Viewer Atlas Runtime boundary; no viewer/runtime-core/editor changes.
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
  - Preserved Workspace Save and Portable JSON behavior; no workspace file-set or save behavior changes.
- `discussion/development_convention/source-file-organization-policy.md`
  - Covered by new responsibility files and barrel-only `index.ts`; guard passed.
- `discussion/development_convention/dependency-policy.md`
  - Covered by no dependency or lockfile changes; dependency guard passed.
- `discussion/development_convention/operation-policy.md`
  - Covered by pure export contract only; no model mutation path or operation-core changes.

## Deferred Basis Items

- Domain B:
  - AuthoringSession assembly, current committed atlas requirement, stale atlas detection, target filtering, atlas-applied UV generation, raw RGBA byte collection, digest/media type/byte checks against actual bytes, and hard-block preflight.
  - Drawable Pool exclusion implementation and mask relation handling when mask sources are not exportable.
- Domain C:
  - Runtime Export Toolbox entry, task UI, readiness/blocked/ready states, Validate warning display, directory picker/write flow, and browser capability handling.
- Future/out of scope:
  - runtime/player app, camera/tracker mapping, OBS integration, PNG, ZIP/archive, single-file/base64 export, bundle reload, external pixel parity proof, and multi-page export implementation beyond schema allowance.

## Policy Notes

- Source organization:
  - `index.ts` remains barrel-only.
  - Runtime Export DTOs and file-set helpers are split by responsibility.
- Dependency:
  - No package dependencies, lockfile changes, binary dependencies, Cubism SDK/Core, parser, or archive/image dependencies added.
- Operation:
  - Export contract is non-mutating package-format schema work. Operation Core was not changed or imported.

## Remaining Issues / Escalation Points

- No blocking issue found.
- Renderer assumptions are explicit contract fields. Domain B/C should pass values matching the actual assembler/runtime behavior if later implementation chooses a different alpha mode, color space, or filtering value.
