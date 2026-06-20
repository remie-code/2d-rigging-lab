# Wave92 Domain A Test Adequacy Review

- Role: Review-Sylph
- Lane: Test Adequacy Review
- Date: 2026-06-20
- Target: `wave92-runtime-export-package-contract`
- Verdict: `pass`

## Findings

### Blocking

None.

### Needs-Fix

None.

### Warnings / Residual Risks

- The materialized graph omission oracle is mostly covered by a strict valid fixture rather than explicit missing-field negative cases. The schema requires atlas texture references on drawables and meshes, and requires `atlasUvs`/`uvSpace` on meshes (`packages/package-format/src/runtime-export.ts:312`, `packages/package-format/src/runtime-export.ts:337`). The test fixture includes those fields and the parse assertion checks `uvSpace` (`packages/package-format/src/runtime-export.test.ts:40`, `packages/package-format/src/runtime-export.test.ts:308`, `packages/package-format/src/runtime-export.test.ts:324`, `packages/package-format/src/runtime-export.test.ts:338`). This is adequate for Domain A because the positive fixture plus strict schemas would catch removal of the declared fields, but future hardening could add explicit negative tests for missing `atlasUvs`, drawable `texture`, and mesh `texture`.

## Coverage Matrix

| Required / additional oracle | Coverage | Evidence |
|---|---|---|
| Valid minimal runtime export manifest/model/atlas parses. | Covered. | `parseRuntimeExportManifest`, `parseRuntimeExportModel`, and `parseRuntimeExportAtlas` are exercised against a minimal artifact in `packages/package-format/src/runtime-export.test.ts:26`; parse helpers are defined in `packages/package-format/src/runtime-export.ts:717`. |
| Directory file-set paths accept v0 shape. | Covered. | The test serializes the three text artifacts, adds `assets/textures/atlas_page_0.raw-rgba`, creates a file set, checks the exact v0 paths, and parses text artifacts in `packages/package-format/src/runtime-export.test.ts:146`. File-set helpers are in `packages/package-format/src/runtime-export-file-set.ts:90` and `packages/package-format/src/runtime-export-file-set.ts:147`. |
| Path traversal / absolute / backslash / duplicate paths are rejected. | Covered. | Invalid traversal, absolute, Windows-style, unsupported extension, nested texture, and extra path cases are rejected in `packages/package-format/src/runtime-export.test.ts:168`; duplicate text and binary paths are rejected in `packages/package-format/src/runtime-export.test.ts:186`. Guards are implemented in `packages/package-format/src/runtime-export-file-set.ts:52` and `packages/package-format/src/runtime-export-file-set.ts:121`. |
| Raw RGBA page metadata validates dimensions, byte length, media type, and digest fields. | Covered. | Valid metadata plus invalid width, byte length, media type, digest case, and digest algorithm are tested in `packages/package-format/src/runtime-export.test.ts:66`. The metadata schema and byte-length refinement are in `packages/package-format/src/runtime-export.ts:166` and `packages/package-format/src/runtime-export.ts:797`. |
| v0 single-page artifact validates while schema allows future `pages[]`. | Covered. | The v0 helper accepts the single-page artifact, `RuntimeExportAtlasSchema` accepts two pages, and the v0 helper rejects multi-page artifacts in `packages/package-format/src/runtime-export.test.ts:98`. The schema uses `pages: z.array(...).min(1)` in `packages/package-format/src/runtime-export.ts:657`, and the v0 assertion enforces exactly one page in `packages/package-format/src/runtime-export.ts:741`. |
| DTO rejects editor/workspace-only sections if explicitly represented as forbidden. | Covered. | Top-level `workspaceMetadata`, `editorState`, and `sourceManifest` sections are rejected in `packages/package-format/src/runtime-export.test.ts:203`; the manifest/model/atlas schemas are strict in `packages/package-format/src/runtime-export.ts:201`, `packages/package-format/src/runtime-export.ts:506`, and `packages/package-format/src/runtime-export.ts:657`. |
| Materialized graph contract includes atlas-applied UVs and texture page refs. | Covered with residual risk noted above. | The model schema requires drawable texture refs, mesh `atlasUvs`, `uvSpace`, and mesh texture refs in `packages/package-format/src/runtime-export.ts:321` and `packages/package-format/src/runtime-export.ts:337`; the minimal fixture includes them in `packages/package-format/src/runtime-export.test.ts:292` and `packages/package-format/src/runtime-export.test.ts:315`. |
| Tests exercise parse/serialize/file-set helpers, not only direct schema parse. | Covered. | Parse helpers are exercised in `packages/package-format/src/runtime-export.test.ts:29`; serialize/file-set/parse-from-file-set helpers are exercised in `packages/package-format/src/runtime-export.test.ts:146`. |
| Tests are focused, deterministic, and do not require dependencies/network/forbidden oracle. | Covered. | `packages/package-format/src/runtime-export.test.ts` uses local DTO fixtures only; no dependency install, network call, Cubism artifact, runtime player, PNG, or ZIP oracle is involved. |

## Evidence Reviewed

- Basis documents:
  - `discussion/implementation/orchestration/wave92-plan.md`
  - `discussion/design/module-contracts/runtime-export-v0-contract.md`
  - `discussion/design/screen-design/screens/runtime-export-task.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
- Source and tests:
  - `packages/package-format/src/runtime-export.ts`
  - `packages/package-format/src/runtime-export-file-set.ts`
  - `packages/package-format/src/runtime-export.test.ts`
  - `packages/package-format/src/index.ts`
- Secondary context only:
  - `discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md`

## Verification Performed

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`
  - First sandboxed run failed while loading Vitest/esbuild with `spawn EPERM`.
  - Rerun outside the sandbox passed: 1 test file, 6 tests.

## Final Verdict

`pass`

Domain A tests adequately cover the requested package-format contract for this wave. The only residual risk is that materialized graph field omission is guarded mostly through the strict positive fixture; it is not blocking for this Domain A oracle.
