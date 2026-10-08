# Wave87 Domain A Test Adequacy Review

## Verdict

pass

Domain A の Texture Atlas core/schema/apply mutation scope は、必須テスト項目を満たしている。Gnome 報告だけではなく、指定された plan/design/policy、対象 test/source、portable bundle 経路の実装参照から確認した。

## Basis

- Plan: `discussion/implementation/orchestration/wave87-plan.md`
- Screen spec: `discussion/design/screen-design/screens/texture-atlas-task.md`
- Domain A report: `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- Policies: `discussion/development_convention/source-file-organization-policy.md`, `discussion/development_convention/dependency-policy.md`, `discussion/development_convention/schema-and-id-conventions.md`
- Tests/source reviewed:
  - `packages/package-format/src/package-document.test.ts`
  - `packages/package-format/src/portable-package-bundle.test.ts`
  - `packages/authoring-core/src/portable-project-bundle.test.ts`
  - `packages/authoring-core/src/texture-atlas-mutations.test.ts`
  - `packages/package-format/src/texture-atlas.ts`
  - `packages/authoring-core/src/texture-atlas-targets.ts`
  - `packages/authoring-core/src/texture-atlas-packing.ts`
  - `packages/authoring-core/src/texture-atlas-binary.ts`
  - `packages/authoring-core/src/texture-atlas-mutations.ts`

## Required Coverage Review

| Requirement | Adequacy | Evidence |
|---|---|---|
| Bound hidden drawables included; unbound Drawable Pool excluded | Adequate | Plan defines current Drawable Pool membership as not referenced by `rigControls[].childDrawableIds` (`wave87-plan.md:66-69`). Source builds bound set from `rigControl.childDrawableIds` and excludes others as `unboundDrawablePool` (`texture-atlas-targets.ts:159-170`, `texture-atlas-targets.ts:119-127`). Test fixture has body/hidden bound and pool unbound (`texture-atlas-mutations.test.ts:357-363`) and asserts included hidden plus excluded pool (`texture-atlas-mutations.test.ts:58-75`). |
| Deterministic warnings for missing texture/mesh/binary/invalid UV | Adequate | Source warning DTO has stable `code`, `severity`, `targetPath`, optional IDs, and `details` (`texture-atlas-targets.ts:34-43`, `texture-atlas-targets.ts:440-461`). Test covers missing texture entry, missing mesh, missing binary ref, missing loaded bytes, and invalid UV cardinality by code/path/drawable (`texture-atlas-mutations.test.ts:78-125`). Source also implements empty UV, invalid bounds, and invalid RGBA byte-length warnings (`texture-atlas-targets.ts:290-327`, `texture-atlas-targets.ts:371-385`). |
| Deterministic single-page packing | Adequate | Packing uses fixed `single-page-shelf-v1` settings and draw-order/stable-order sorting (`texture-atlas-packing.ts:58-107`, `texture-atlas-targets.ts:173-208`). Test generates two previews and asserts identical layout plus expected rects for both included drawables (`texture-atlas-mutations.test.ts:127-166`). |
| Cannot-fit target fails preview safely | Adequate | Source returns failed preview with `atlas.pack.cannotFit` on oversized or overflowing target (`texture-atlas-packing.ts:152-172`, `texture-atlas-packing.ts:249-268`). Test asserts failed status and warning code for a too-small page (`texture-atlas-mutations.test.ts:168-175`). |
| Generated atlas asset bytes and texture entry registered | Adequate | Apply creates atlas bytes, generated binary ref, texture entry, layout summary, provenance/rights, and registers bytes (`texture-atlas-mutations.ts:100-165`). Test asserts generated texture metadata, atlas byte length and sample pixels, registered generated binary path, and layout placements (`texture-atlas-mutations.test.ts:196-227`). Round-trip test confirms generated texture ref and generated binary file entry survive export/import (`texture-atlas-mutations.test.ts:250-260`). |
| Apply updates `Drawable.textureId` and rewrites `Mesh.uvs` while preserving vertices/triangles | Adequate | Source iterates placements, updates drawable texture id, rewrites UVs, and increments topology revision without changing vertices/triangles (`texture-atlas-mutations.ts:170-183`). Test asserts visible and hidden drawable texture refs move to generated atlas, pool drawable remains unchanged, and the body mesh preserves vertices/triangles while UVs change to expected atlas coordinates (`texture-atlas-mutations.test.ts:209-223`). |
| Save/load or portable bundle round-trip preserves atlas metadata and generated binary asset | Adequate | Package schema owns optional `layoutSummary`, one page, placements, settings, dimensions, and binary refs (`texture-atlas.ts:63-160`). Package bundle collects `assets.textureAtlas.textures[*].binaryAssetRef` (`portable-package-bundle.ts:271-280`), and authoring import registers texture atlas refs as `texture-raster-v1` (`portable-project-bundle.ts:155-165`). Tests parse layout metadata (`package-document.test.ts:262-354`) and prove applied atlas metadata plus generated binary path/length survive authoring portable bundle round-trip (`texture-atlas-mutations.test.ts:230-260`). |
| Re-applying/generating from an already atlas-applied state guarded or supported | Adequate | Source emits `atlas.target.alreadyAtlasApplied` when `layoutSummary` already exists (`texture-atlas-targets.ts:105-117`), and preview generation fails on error warnings (`texture-atlas-packing.ts:68-77`). Test applies once, regenerates preview from the applied state, and asserts failed status plus guard code (`texture-atlas-mutations.test.ts:263-283`). |

## Verification Considered

Accepted Orch-Sylph verification is sufficient for this review lane:

- Focused atlas tests passed after escalated rerun: `packages/package-format/src/package-document.test.ts` and `packages/authoring-core/src/texture-atlas-mutations.test.ts` -> 2 files / 16 tests.
- Portable bundle tests passed after escalated rerun: `packages/package-format/src/portable-package-bundle.test.ts` and `packages/authoring-core/src/portable-project-bundle.test.ts` -> 2 files / 9 tests.
- `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, `node scripts/check-dependencies.mjs`, and `git diff --check` passed, with only LF/CRLF warnings on diff check.

I did not rerun Vitest in this review because the known sandbox failure is esbuild `spawn EPERM`; the review objective was adequacy from source/test evidence.

## Residual Risks

- Registered generated binary content is proven by source using the same `atlasBytes` variable for registration, and tests check returned atlas pixels plus registered path/round-trip length. A stronger future assertion would compare the imported generated binary bytes byte-for-byte with `applied.atlasBytes`; this is not blocking because generated asset presence and persistence are currently covered.
- Hidden drawable inclusion is directly tested, and hidden drawable texture ref update is tested. The exact hidden mesh UV rewrite is covered by source iteration over all placements, but not asserted separately for the hidden mesh. This is acceptable for Domain A but worth strengthening if hidden-drawable visual parity becomes a final integration failure mode.
- Warning tests assert stable identifying fields, not full warning message/detail payloads. This is acceptable for Domain A; if Domain B renders `message` or `details` as UI contract, add exact-object or snapshot-style coverage there.
- Canvas / Viewer visual parity is intentionally not proven in Domain A. The plan assigns Canvas/Viewer resolution to later UI/final integration evidence (`wave87-plan.md:525-526`), and Domain A source does not touch renderer files.

## User-Decision Points

- No blocking user decision is needed for Domain A test adequacy.
- Domain B/final integration still needs a product decision on whether generated atlas pages require a separate human preview asset record, or whether binary/layout-only remains the v0 contract.
- Multi-page handling remains future scope; current single-page cannot-fit behavior is adequately guarded for Domain A.
