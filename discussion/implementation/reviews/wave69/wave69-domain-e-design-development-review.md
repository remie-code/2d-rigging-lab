# Wave69 Domain E Design / Development Compliance Review

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-editor-v6d-v6e-v6f-selector-final-integration`
- Review lane: Design / Development Compliance
- Reviewer: Review-Sylph
- Date: 2026-06-14

## Scope Reviewed

Reviewed directly:

- Basis:
  - `discussion/implementation/orchestration/wave69-plan.md`
  - `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
  - `discussion/design/screen-design/components/mesh-tool.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
  - `discussion/development_convention/schema-and-id-conventions.md`
  - `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md`
- Source and tests:
  - `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
  - `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
  - `packages/authoring-core/src/mesh-generation-contract.ts`
  - `packages/authoring-core/src/mesh-generation.ts`
  - `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
  - `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
  - `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts`
  - `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts`
  - `packages/authoring-core/src/mesh-generation.test.ts`
  - `packages/operation-core/src/operations/generate-mesh.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/operations/generate-mesh.test.ts`
- Diffs:
  - Relevant `git diff` for the files above.
  - `packages/render-webgl2/**` diff checked only to confirm no Domain E rendering expansion/revert.

## Findings

No blocking or required-change findings.

### Low / Residual: v6E backend file still contains a same-value local status override

`packages/authoring-core/src/mesh-generation-contract.ts:97` records canonical v6E `backendImplementationStatus: "implemented"`, and `packages/authoring-core/src/mesh-generation.ts:1180` routes through `getV6MeshGenerationCandidate("auto-outline-v6e-contour-poly2tri")`. This satisfies the Domain E requirement to remove route-level status split.

Residual note: `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts:284` still spreads the canonical candidate and restates `backendImplementationStatus: "implemented"` at `:286`. This is same-value and not route-level, so it is not blocking for Domain E, but a later cleanup should remove the duplication to keep status purely canonical.

## Compliance Matrix

| Requirement | Result | Evidence |
|---|---|---|
| Selector state remains isolated/temporary, not permanent product UX | Pass | Selector option type is local Mesh Tool state in `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:15`; visible options are v2.6 + v6D/E/F at `:79`. Inspector labels the section `Experimental backend` and `Temporary` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:289`. |
| v6A/v6B/v6C removed from visible current choices | Pass | `MeshGenerationBackendOptionId` only includes v6D/E/F plus default at `mesh-tool-state.ts:16`; options are v6D/E/F at `:87`, `:93`, `:99`. Unit test excludes v6A/B/C at `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:25`. E2E excludes visible v6A/B/C at `apps/editor/e2e/psd-import.e2e.spec.ts:263`. |
| Default behavior and command default remain v2.6 | Pass | `DEFAULT_MESH_GENERATION_METHOD` is `auto-outline-v2.6-soft-apron` at `mesh-tool-state.ts:73`; `commitGenerateMesh` default method is the same at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274`. Tests assert the defaults at `mesh-tool-state.test.ts:11` and `editor-session-commands.test.ts:612`. |
| Preview does not mutate committed mesh before Apply | Pass | Preview computes a generated draft and stores it only in `meshDraft` at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` and `:674`. Apply is the only path that calls `commitGenerateMesh` at `:690`. |
| Apply uses previewed method/source/provenance | Pass | Apply passes `meshDraft.mesh`, `meshDraft.method`, `source`, `fallbackReason`, `fallbackSteps`, and `qualityMetrics` into `commitGenerateMesh` at `editor-session-context.tsx:698`. Operation Core commits `previewMesh` by cloning it and records preview source/fallback/quality at `packages/operation-core/src/operations/generate-mesh.ts:105`. Editor command test verifies committed geometry equals preview geometry and records preview source/backend output for v6D/E/F at `editor-session-commands.test.ts:686`. |
| Mutation path remains Operation Core | Pass | `commitGenerateMesh` creates a `generateMesh` operation payload at `editor-session-commands.ts:282`; Operation Core owns dry-run/commit handlers at `packages/operation-core/src/operations/generate-mesh.ts:34`. |
| Operation payload/provenance schema covers v6D/E/F | Pass | Preview v6 metrics schema uses canonical v6 method/backend/source arrays at `packages/operation-core/src/payloads/model-edit.ts:227`; `previewProvenance` requires `previewMesh` at `:284`. Transform history emits v6 method/backend/source/output and contour/custom diagnostics at `generate-mesh.ts:487`. |
| v6E registry/routing consistency is canonical | Pass with residual note | v6E canonical registry is implemented at `mesh-generation-contract.ts:97`; public route retrieves that candidate at `mesh-generation.ts:1180`. No route-level override remains. Same-value backend-local override remains at `mesh-generation-v6e-contour-poly2tri.ts:284`. |
| v6D/E/F status/provenance surfaces consistent across authoring-core and operation-core | Pass | Registry entries for v6D/E/F are implemented at `mesh-generation-contract.ts:89`, `:97`, `:105`. Operation tests assert backend output and diagnostics for v6D/E/F at `packages/operation-core/src/operations/generate-mesh.test.ts:475`, `:512`, `:532`. Blocked/fallback metadata is tested at `:597` and `:645`. |
| v6A/v6B/v6C remain headless/backward but not visible choices | Pass | Contract still includes legacy v6A/B/C IDs at `mesh-generation-contract.ts:7`; routing still supports headless paths at `mesh-generation.ts:137`, `:147`, `:157`. Visible selector excludes them as above. Historical formatter cases remain display-only at `mesh-tool-inspector.tsx:533`. |
| v6D/E/F use shared contour pipeline and avoid discarded v6A triangulation | Pass | Shared contour candidate input is defined at `mesh-generation-v6-contour-pipeline.ts:113`; v6D/E/F each call it at `mesh-generation-v6d-contour-constrainautor.ts:129`, `mesh-generation-v6e-contour-poly2tri.ts:148`, and `mesh-generation-v6f-custom-cdt.ts:126`. Direct search found no `earClip` / `splitTrianglesWithInteriorPoints` use in v6D/E/F files. |
| Dependency policy | Pass | No `package.json` / `pnpm-lock.yaml` diff. Dependency guard passed in this review session. v6D/E use existing `delaunator`, `@kninnug/constrainautor`, and `poly2tri` surfaces recorded in `mesh-generation-contract.ts:34`. |
| Forbidden Cubism / compatibility scope | Pass | In-scope source search found no `.moc3`, `.cmo3`, `.model3.json`, Cubism SDK/Core, or Live2D compatibility implementation references in Domain E source/artifacts. |
| Rendering scope | Pass | Render diff is limited to accepted NEAREST texture filtering (`packages/render-webgl2/src/webgl2-textures.ts:39`); no Domain E rendering expansion or revert found. |
| Source organization | Pass with residual note | `packages/authoring-core/src/index.ts:25` remains barrel-only and only adds a re-export at `:27`. Source organization guard passed. Residual broad files remain (`packages/authoring-core/src/mesh-generation.ts` ~2144 lines, `apps/editor/src/features/editor-session/editor-session-context.tsx` ~1133 lines), but Domain E did not create a new catch-all file and the touched changes are scoped. |
| Schema and machine-readable IDs | Pass | New IDs are lowercase/kebab/dot-free method/source/backend identifiers with no spaces, e.g. `mesh-generation-contract.ts:89`, `:97`, `:105`; operation payload schema consumes canonical arrays at `model-edit.ts:227`. |

## Validation Reviewed

- Reviewed Orch-Sylph validation summary:
  - Focused Vitest outside sandbox passed: 4 files / 99 tests.
  - Additional authoring-core focused run passed: 3 files / 62 tests.
  - `pnpm.cmd typecheck` passed.
  - Focused Playwright PSD import semantic test outside sandbox passed: 1 test.
  - `git diff --check -- apps/editor packages/authoring-core packages/operation-core packages/render-webgl2 discussion` passed with CRLF warnings only.
- Reviewer spot checks run:
  - `node scripts/check-source-organization.mjs` passed.
  - `node scripts/check-dependencies.mjs` passed.
  - Manifest/lockfile diff check found no dependency manifest changes.

## Residual Risks

- Visual-quality risk remains intentionally outside Domain E and Wave69 final selection. The selector enables v6D/E/F comparison but does not decide a winner.
- `mesh-generation.ts` and `editor-session-context.tsx` remain large responsibility files. This is an existing architecture pressure, not a Domain E blocker, but future mesh waves should prefer extracting responsibility-specific helpers when touching those areas.
- The v6E same-value backend-local implementation-status override should be removed later to eliminate duplicate status expression, even though routing is now canonical.
- Legacy v6A/v6B/v6C formatters and headless routes remain intentionally available for historical/backward provenance and tests; reviewers should continue checking they do not reappear as current visible choices.

## Required Fixes

None.

## User-Decision Points

- Choose whether v6D, v6E, v6F, or none should become a future default after human visual comparison.
- Decide whether v6E's current hole-like fallback behavior is acceptable before any promotion.
- Decide when the temporary experimental backend selector should be hidden or removed after final backend selection.
