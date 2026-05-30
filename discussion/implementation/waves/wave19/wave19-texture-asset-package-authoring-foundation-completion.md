# Wave19 Domain A Completion: Texture Asset Package / Authoring Foundation

## Verdict

`pass`

Domain A の source implementation は Gnome 別コンテキストへ委譲し、Review-Sylph 別コンテキストの clean review で一度 `needs_changes` を受けた後、blocking finding を修正して `pass` になった。

## Scope

- Domain: `wave19-texture-asset-package-authoring-foundation`
- Implementation agent: `019e7924-017e-7b70-bae2-1367ee86de6c` (`Gnome the 40th`)
- Review agent: `019e792e-f321-7d23-8cb8-75ad3da0a689` (`Sylph the 41st`)
- Review artifact: `discussion/implementation/reviews/wave19/wave19-texture-asset-package-authoring-foundation-review.md`
- Review verdict: `pass`
- Date: 2026-05-30
- Orch-Sylph source implementation: none. Orch-Sylph only coordinated, verified, and wrote discussion artifacts.

## Changed Files

Package format:

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/package-format/src/package-document.test.ts`
- `packages/package-format/src/package-file-set.test.ts`

Authoring core:

- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/package-document-assets.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts`
- `packages/authoring-core/src/package-document-adapter.test.ts`
- `packages/authoring-core/src/index.ts`

Reports:

- `discussion/implementation/reviews/wave19/wave19-texture-asset-package-authoring-foundation-review.md`
- `discussion/implementation/waves/wave19/wave19-texture-asset-package-authoring-foundation-completion.md`

## Implementation Summary

- `texture-atlas-v1` now has schema-grounded preview asset metadata via `TexturePreviewReferenceSchema` and `TexturePreviewAssetSchema`.
- Texture preview references are text metadata only: package-local asset references under allowed asset folders, or deterministic image data URLs. External URLs are rejected.
- Texture atlas entry `filePath` is constrained to package-relative paths under `assets/textures/`, resolving the Review-Sylph blocking finding.
- Package file set serialization / parse preserves optional `assets/textures/texture-atlas.json` and deterministic preview references when texture metadata exists.
- `AuthoringGraph` can carry optional `textureAtlas` state from a package document.
- `upsertTexturePreviewAssetMetadata` adds source-layer-derived texture preview metadata to the authoring session and checks texture/source layer/provenance/rights linkage before mutating.
- `buildPackageDocumentAssets` emits session texture atlas metadata back into package assets.
- `index.ts` change is barrel-only: `export * from "./texture-asset-mutations.js";`.

No binary asset IO, PNG decoding, archive writing, atlas packing, editor UI, runtime projection, or operation-core implementation was added.

## Needs-Fix Loop

Initial Review-Sylph verdict was `needs_changes`.

Blocking finding:

- `TextureAtlasEntrySchema.filePath` accepted arbitrary strings, including external URLs or unsafe paths.

Fix applied by Gnome:

- Added package-local `assets/textures/` path constraint for texture atlas entries.
- Added negative schema tests rejecting external URLs, non-texture asset paths, and traversal paths.

Follow-up Review-Sylph verdict: `pass`.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/package-file-set.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/source-asset-mutations.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts` | pass | Post-fix rerun: 5 files / 24 tests. Sandbox run hit `EPERM` reading `node_modules`; escalated rerun passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- packages/package-format/src packages/authoring-core/src` | pass | LF/CRLF warnings only; no whitespace errors. |
| `pnpm.cmd typecheck` | pass | Sandbox run hit `EPERM` reading TypeScript under `node_modules`; escalated rerun passed root and editor typecheck. |

## Pass Evidence

- Texture atlas / preview asset metadata parses through `PackageDocumentSchema`.
- Package file set serialize / parse roundtrip preserves texture preview references.
- Authoring session -> package document projection keeps source asset, source layer, provenance, rights, texture entry, and preview asset linkage.
- Review-Sylph confirmed no blocking findings after the atlas entry path fix.
- `index.ts` remains re-export only.

## Remaining Risks

- `getAuthoredPackageFilePaths()` now includes `assets/textures/texture-atlas.json` even though serialization omits the file when no atlas metadata exists. Current parse/serialize behavior remains optional and tests pass; later validator domains should avoid treating this helper as a mandatory-file oracle without clarifying optional atlas semantics.
- Domain A is metadata-only. Real texture bytes, PNG decode, materialization workflow, runtime projection, editor visual rendering, and validator policy hardening remain later Wave19 domain responsibilities.
- The authoring helper verifies provenance/rights presence and linkage, but final stricter product policy for whether preview rights attach to source asset, texture asset, or generated preview asset is left for validator/product policy domains.

## User Decision Points

None.
