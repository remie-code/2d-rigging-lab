# Wave87 Domain A Report: Atlas Core / Schema / Apply Mutation

## Verdict Recommendation

pass

Domain A implemented the package-format and authoring-core foundation for Texture Atlas v0: persistent layout summary schema, deterministic target selection, single-page packing preview, generated raw RGBA atlas bytes, Apply mutation, and portable bundle round-trip evidence.

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/waves/wave86/wave86-final-integration-report.md`
- `discussion/implementation/reviews/wave86/wave86-final-clean-integration-review.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Deferred Basis Items:

- No additional Wave85 baseline documents were read in this Gnome run because the delegated Domain A primary basis list and Wave86 final baseline covered the requested implementation boundary.
- No UI/browser visual basis was exercised because Domain A intentionally stopped at package/authoring-core.

## Current-State Confirmation

- Existing `texture-atlas-v1` had texture entries and optional preview assets, but no persistent layout/page/placement/settings summary.
- Existing portable package bundle export already collected `assets.textureAtlas.textures[*].binaryAssetRef`.
- Existing authoring portable import already hydrates texture atlas binary refs as `texture-raster-v1`.
- Existing texture-byte convention infers source texture dimensions from mesh bounds and expects raw RGBA byte length `width * height * 4`.
- Existing dirty discussion design/orchestration files were left untouched.

## Target Selection Trace

- Added `selectTextureAtlasTargets()` in `packages/authoring-core/src/texture-atlas-targets.ts`.
- Include oracle: Drawables referenced by any `rigControls[].childDrawableIds`.
- Exclude oracle: unbound Drawables are returned as `reason: "unboundDrawablePool"`.
- Hidden policy: bound Drawables with `runtimeVisibility === false` or under provided editor-hidden Parts remain included and are marked with `hiddenReasons`.
- Warning objects are deterministic and include `code`, `severity`, `targetPath`, optional ids, message, and `details`.
- Covered warning codes include missing texture entry, missing binary ref, missing loaded bytes, missing mesh, empty UVs, invalid UV cardinality, invalid bounds/byte length, cannot-fit, stale preview, and already-applied guard.

## Packing / Apply Trace

- Added `createTextureAtlasPreview()` in `texture-atlas-packing.ts`.
- v0 packing uses deterministic `single-page-shelf-v1` ordering from draw order/stable order and stable ids.
- v0 persists one page only: `atlas_page_0`.
- Padding is part of padded placement rect; UVs target the content rect.
- Edge extrusion is implemented as clamped edge pixel copy up to configured extrusion pixels.
- Added `createTextureAtlasPageRgbaBytes()` and generated binary ref helpers in `texture-atlas-binary.ts`.
- Added `applyTextureAtlasPreview()` in `texture-atlas-mutations.ts`.
- Apply registers generated atlas texture `tex_generated_atlas_page_0`, generated binary bytes, provenance/rights records, layout summary, included Drawable texture refs, and rewritten Mesh UVs.
- Apply preserves vertices, triangles, draw order, visibility, rig controls, deformer/keyform/dynamics data, source texture entries, and unbound Drawable Pool drawables.
- Re-generation from an already applied state is guarded by `atlas.target.alreadyAtlasApplied`.

## Persistence Trace

- Extended `packages/package-format/src/texture-atlas.ts` with optional:
  - `TextureAtlasEntry.dimensions`
  - `TextureAtlasLayoutSummary`
  - page/settings/placement/rect/UV schemas
- Kept `schemaVersion: "texture-atlas-v1"` for compatibility.
- Existing package document serialization includes `textureAtlas` unchanged except for the new optional fields.
- Existing portable bundle export/import preserved generated atlas texture binary refs without code changes.
- New authoring test proves export/import retains layout metadata and generated atlas raw RGBA bytes.

## Canvas / Viewer Parity Trace

Domain A provides core evidence only:

- Canvas / Viewer rendering files were not changed.
- The same Drawable/Mesh projection path should observe the mutation because included Drawables now point at the generated atlas texture and Mesh UVs are rewritten into atlas page normalized coordinates.
- Tests prove mesh vertices and triangles are unchanged while UVs and texture refs update.
- No visual browser or pixel renderer check was run in this domain; Domain B or final integration should verify UI/Canvas/Viewer behavior after routing is connected.

## Must-not Compliance Evidence

- No workspace directory export, ZIP/archive, File System Access API, image export UI, camera capture/tracking, Viewer control, manual UV editor, mesh generation algorithm, deformer/keyform/dynamics behavior, Cubism compatibility, or new dependency was added.
- No `apps/**`, runtime, or validator files were changed.
- Source texture entries are retained.
- Unbound Drawable Pool entries remain unmutated.

## Changed Files

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-document.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-binary.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`

## Tests / Checks

- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts`
  - sandbox run failed with known esbuild `spawn EPERM`
  - escalated rerun passed: 2 files, 16 tests
- `pnpm.cmd exec vitest run packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
  - escalated run passed: 2 files, 9 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `node scripts/check-dependencies.mjs`: passed
- `git diff --check`: passed with LF/CRLF working-copy warnings only

## Orch-Sylph Closeout

Final Domain A verdict: `pass`.

Orch-Sylph independently reran the focused validation after the Gnome implementation:

- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts`
  - sandbox run failed with known esbuild `spawn EPERM`
  - escalated rerun passed: 2 files, 16 tests
- `pnpm.cmd exec vitest run packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
  - sandbox run failed with known esbuild `spawn EPERM`
  - escalated rerun passed: 2 files, 9 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `node scripts/check-dependencies.mjs`: passed
- `git diff --check`: passed with LF/CRLF working-copy warnings only

Review lanes:

| Review lane | Verdict | Artifact |
|---|---|---|
| Spec Compliance Review | `pass` | `discussion/implementation/reviews/wave87/wave87-domain-a-spec-compliance-review.md` |
| Design / Development Compliance Review | `pass` | `discussion/implementation/reviews/wave87/wave87-domain-a-design-development-review.md` |
| Test Adequacy Review | `pass` | `discussion/implementation/reviews/wave87/wave87-domain-a-test-adequacy-review.md` |

No fix loop was required because all review lanes returned `pass` with no blocking findings.

## Residual Risks

- Source texture dimensions still follow the existing raw RGBA inference convention from mesh bounds; no broad texture dimension migration was attempted.
- Generated atlas texture has authoritative binary/layout metadata, but no separate preview asset image is generated. If a future UI or validator requires preview-asset evidence for generated atlas textures, that should be handled as a narrow Domain B/final integration decision.
- Packing is intentionally simple shelf packing; no rotation, optimization, or multi-page support.
- Canvas / Viewer visual parity is inferred from shared texture/UV projection behavior and core tests, not directly browser-verified in Domain A.
- The future user-facing Apply path still needs a Domain B/final integration decision on whether it is Operation Core-wrapped or explicitly accepted as an authoring-core direct mutation exception.

## User-Decision Points

- Whether generated atlas pages should get a human preview asset record or remain binary/layout-only for v0.
- Final default page-size UX (`Auto` vs fixed choices) remains Domain B/UI policy.
- Multi-page handling remains future scope; v0 cannot-fit returns deterministic warning/failure.
- Workspace Directory Export remains deferred outside Wave87 Domain A.

## Domain B Readiness

Domain B can start from this perspective.

Recommended Domain B integration points:

- Use `selectTextureAtlasTargets()` for Included/Excluded/Warnings lists.
- Use `createTextureAtlasPreview()` for Generate Preview.
- Disable Apply unless preview `status === "ready"`.
- Use `applyTextureAtlasPreview()` for Apply and surface returned warnings.
- Do not duplicate target selection or packing logic in UI.
