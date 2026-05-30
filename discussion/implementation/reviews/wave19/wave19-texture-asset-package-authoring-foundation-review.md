# Wave19 Domain A Review: Texture Asset Package / Authoring Foundation

- Verdict: pass
- Review-Sylph context id: `019e792e-f321-7d23-8cb8-75ad3da0a689` (`Sylph the 41st`)
- Target: `wave19-texture-asset-package-authoring-foundation`
- Implementation agent: `019e7924-017e-7b70-bae2-1367ee86de6c` (`Gnome the 40th`)
- Review date: 2026-05-30

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- Actual repository diff and file reads for the Domain A changed files.

## Scope Reviewed

Reviewed diff and source state for:

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/package-format/src/package-document.test.ts`
- `packages/package-format/src/package-file-set.test.ts`
- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/package-document-assets.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts`
- `packages/authoring-core/src/package-document-adapter.test.ts`
- `packages/authoring-core/src/index.ts`

Workspace contains concurrent Wave19 changes in `apps/editor/**` and `packages/runtime-core/**`. Per assignment, I ignored them except for confirming Domain A did not depend on forbidden edits.

## Findings

No blocking findings.

The earlier blocking finding against `TextureAtlasEntrySchema.filePath` is resolved. Texture atlas entry paths now use a package-local schema constrained to `assets/textures/`, and tests reject external URLs, non-texture asset paths, and traversal paths.

## Pass Evidence

- Texture atlas schema now keeps atlas entries package-local: `TextureAtlasEntrySchema.filePath` uses `PackageLocalTextureAssetPathSchema`, which combines `isPackageRelativePath` with an `assets/textures/` prefix requirement (`packages/package-format/src/texture-atlas.ts:24-27`, `packages/package-format/src/texture-atlas.ts:58-65`).
- Texture preview references remain text-only and bounded to package-local preview paths or deterministic image data URLs, with external URLs rejected by schema tests (`packages/package-format/src/texture-atlas.ts:17-43`, `packages/package-format/src/package-document.test.ts:173-203`).
- Texture preview asset metadata carries `textureId`, `sourceAssetId`, `sourceLayerId`, `provenanceId`, and `rightsAssetId` as explicit text metadata (`packages/package-format/src/texture-atlas.ts:46-55`).
- Package document parsing covers texture atlas entries plus preview asset metadata and keeps those fields schema-grounded (`packages/package-format/src/package-document.test.ts:127-170`).
- Package file set serialization writes optional `assets/textures/texture-atlas.json` when texture metadata exists and parse/serialize roundtrip preserves deterministic data URL preview references (`packages/package-format/src/package-file-set.test.ts:51-58`, `packages/package-format/src/package-file-set.test.ts:195-229`).
- Authoring graph import now clones package texture atlas metadata into the session graph when present, and `toPackageDocument` emits the session texture atlas back to package assets (`packages/authoring-core/src/authoring-graph.ts:39-61`, `packages/authoring-core/src/package-document-assets.ts:5-28`).
- `upsertTexturePreviewAssetMetadata` normalizes missing atlas entry source/provenance fields from the preview asset, requires texture/source layer/provenance consistency, verifies source asset/layer existence, verifies provenance and rights records, and rejects blocked rights (`packages/authoring-core/src/texture-asset-mutations.ts:21-149`).
- The authoring adapter test proves source-layer-derived texture preview metadata survives conversion back to a package document without dropping source manifest, provenance, or rights records (`packages/authoring-core/src/package-document-adapter.test.ts:87-140`).
- `packages/authoring-core/src/index.ts` remains barrel-only; the Domain A change is a single re-export of `texture-asset-mutations.js`.

## Verification Considered

- Inspected updated `git diff --` for all Domain A changed files.
- Inspected `texture-atlas.ts`, `package-document.test.ts`, and `texture-asset-mutations.ts` directly after the fix.
- Considered Orch-Sylph post-fix verification evidence:
  - `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/package-file-set.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/source-asset-mutations.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts`: pass after sandbox EPERM rerun, 5 files / 24 tests.
  - `pnpm.cmd run check:source`: pass.
  - `git diff --check -- packages/package-format/src packages/authoring-core/src`: pass, LF/CRLF warnings only.
  - `pnpm.cmd typecheck`: pass after sandbox EPERM rerun, root and editor typecheck.

I did not rerun the commands in this review context.

## Test Adequacy

Focused test coverage is adequate for Domain A. It covers:

- package document schema parse for texture preview metadata,
- rejection of external preview references,
- rejection of unsafe or non-texture atlas entry paths,
- package file set serialization / parse roundtrip for texture preview references,
- authoring session to package document projection of source-layer-derived texture preview metadata,
- existing source asset rights/provenance fixture compatibility.

## Source Organization

Pass.

- New authoring logic lives in a named, cohesive `texture-asset-mutations.ts`.
- Package-format schema expansion stays in the existing texture atlas schema responsibility file.
- Tests are focused on package-format and authoring-core risks.
- `index.ts` changes are barrel-only.
- No Domain A source changes were made under forbidden `apps/editor/**`, `packages/runtime-core/**`, or `packages/operation-core/**`.

## Remaining Risks / Open Items

- `getAuthoredPackageFilePaths()` now always includes `assets/textures/texture-atlas.json`, while serialization still writes that file only when `assets.textureAtlas` exists. Current package parsing does not require the file and tests pass, but the helper name can read as mandatory authored paths. This is non-blocking and should be clarified if a later validator domain uses the helper as a required-file oracle.
- Domain A records metadata only. Real PNG bytes, archive/binary IO, full atlas packing, texture materialization workflow, runtime projection, and editor visual rendering remain later-domain responsibilities.
- The helper deliberately verifies presence and linkage of provenance/rights records without deciding final product policy for whether texture preview rights must attach to the source asset, texture asset, or a generated preview asset. Validator Domain E should harden any stricter product policy if needed.

## User-Decision Points

None.
