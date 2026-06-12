# Wave63 Domain B Design / Development Compliance Review

## Verdict

- Verdict: `pass`
- Fixes required: no
- Domain: `wave63-mesh-auto-outline-v2-algorithm-foundation`
- Review lane: Design / Development Compliance Review
- Reviewer: Review-Sylph Lane 2
- Date: 2026-06-12

Pass rationale:

- Domain B changes stay within allowed authoring-core / operation-core / minimal Editor preview-summary areas.
- `auto-outline-v2` is implemented as a headless authoring-core algorithm, with operation-core handling method/schema/provenance routing and Editor handling preview/default method/summary display only.
- `index.ts` changes are barrel re-exports only, and the source organization guard passed.
- No dependency manifest or lockfile changes were found for this Domain B slice.
- The implementation and report label triangulation as `interim-delaunay-alpha-filter` / ordinary Delaunay fallback and do not claim full constrained triangulation.

## Basis Read

- `discussion/implementation/orchestration/wave63-plan.md`
- `discussion/implementation/waves/wave63/wave63-preplan-mesh-auto-outline-v2-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v2.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/waves/wave63/wave63-domain-b-report.md`
- `discussion/implementation/reviews/wave63/wave63-domain-b-spec-compliance-review.md`
- Direct source diff and current file inspection for the claimed changed files.

## Findings

### Blocking

None.

### Warning / Residual

1. Preview Apply provenance does not persist the v2 preview quality/fallback metadata.
   - Evidence: Editor preview stores `fallbackSteps` and `qualityMetrics` in draft state at `apps/editor/src/features/editor-session/editor-session-context.tsx:315` and `:316`, then applies only `meshDraft.mesh` plus method `auto-outline-v2` at `apps/editor/src/features/editor-session/editor-session-context.tsx:331` to `:334`. The command payload only forwards `previewMesh` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:267` to `:276`. Operation-core marks this path as `meshSource:previewMesh` at `packages/operation-core/src/operations/generate-mesh.ts:103` to `:108`, while `qualityMetrics` are only populated on the no-preview direct generation path at `packages/operation-core/src/operations/generate-mesh.ts:135` to `:150`.
   - Assessment: Not blocking for this lane because metrics are not UI-only overall: direct operation generation records `meshQuality:*` provenance via `packages/operation-core/src/operations/generate-mesh.ts:337` to `:352`, and Mesh Tool preview displays the metrics at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:172` to `:178`. This remains a provenance persistence gap for the main preview-then-apply workflow.

2. `mesh-outline-v2-generation.ts` is large but still cohesive.
   - Evidence: the file is 1271 lines and owns the v2 algorithm pipeline from `createAutoOutlineV2Mesh` at `packages/authoring-core/src/mesh-outline-v2-generation.ts:95`, contour resampling at `:410`, inset sampling at `:483`, jittered interior sampling at `:562`, refinement at `:618`, and ordinary triangulation at `:740`.
   - Assessment: Not blocking. The file name is specific, the responsibility is a single v2 algorithm pipeline, and `node scripts/check-source-organization.mjs` passed. If v2 grows further, splitting contour extraction/resampling, sampling, triangulation/refinement, and DTO mapping into responsibility files would reduce future review cost.

## Scope Compliance Table

| Area | Allowed for Domain B? | Observed changes / evidence | Assessment |
|---|---:|---|---|
| `packages/authoring-core/**` | Yes | New v2 algorithm and metrics are in `packages/authoring-core/src/mesh-outline-v2-generation.ts:95` and `packages/authoring-core/src/mesh-quality-metrics.ts:3`; method/fallback routing is in `packages/authoring-core/src/mesh-generation.ts:16` to `:20` and `:109`. | Compliant. |
| `packages/operation-core/**` | Yes | Payload schema accepts `auto-outline-v2` at `packages/operation-core/src/payloads/model-edit.ts:150` to `:154`; operation routing/provenance formatting is in `packages/operation-core/src/operations/generate-mesh.ts:137` to `:150` and `:337` to `:352`. | Compliant. |
| `apps/editor/**` | Limited | Editor default preview/apply uses `auto-outline-v2` at `apps/editor/src/features/editor-session/editor-session-context.tsx:299` and `:334`; inspector only formats source/fallback/metrics at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:136` to `:178`. | Compliant minimal integration. |
| Deformer / Domain A | No | Claimed Domain B file list does not include Deformer operation/source files. Diff search over claimed files found no added Deformer/Parameter/Keyform scope. Gnome report also records parallel Domain A worktree changes as separate at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:52`. | Compliant for claimed Domain B scope. Parallel worktree changes are not treated as Domain B evidence. |
| Package format / validator / runtime | No for this domain unless needed | No claimed Domain B changes in package-format, validator-core, or runtime-core. | Compliant. |
| Manual mesh editor / multi-drawable batch / semantic inference | No | Report explicitly excludes semantic preset inference, Cubism claim, manual mesh editor expansion, and multi-drawable batch at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:31`. Source diff did not add those features. | Compliant. |

## Source Organization Assessment

- `packages/authoring-core/src/index.ts:23` to `:26` contains re-exports only, including the new v2 and metrics modules. This complies with the barrel-only expectation.
- `packages/authoring-core/src/mesh-outline-v2-generation.ts` has a clear responsibility: headless `auto-outline-v2` mesh generation. It is large but not a broad `types.ts` / `utils.ts` / `helpers.ts` catch-all.
- `packages/authoring-core/src/mesh-quality-metrics.ts:3` to `:13` owns the quality metrics DTO and deterministic metric computation entrypoint. This is a clean responsibility split from the v2 algorithm.
- `packages/operation-core/src/operations/generate-mesh.ts` remains the generate-mesh operation family file; the added provenance formatting is scoped to that operation.
- Automated evidence: `node scripts/check-source-organization.mjs` passed.
- Whitespace evidence: `git diff --check -- <Domain B tracked source paths>` passed with line-ending warnings only; `Select-String` trailing-whitespace check on new v2/metrics/report files returned no matches.

## Architecture / Module Boundary Assessment

- Headless algorithm stays in authoring-core: `createAutoOutlineV2Mesh` is exported from `packages/authoring-core/src/mesh-outline-v2-generation.ts:95` and consumes RGBA bytes, bounds, preset density, and threshold without UI dependencies.
- Quality metrics are computed in authoring-core: `MeshGenerationQualityMetrics` and `computeMeshQualityMetrics` live in `packages/authoring-core/src/mesh-quality-metrics.ts:3` and `:13`.
- Operation-core does not implement geometry. It accepts the new method, validates preview payload compatibility, invokes authoring-core for direct generation, and formats provenance entries at `packages/operation-core/src/operations/generate-mesh.ts:137` to `:150` and `:337` to `:352`.
- Editor changes are limited to method selection, draft metadata retention, and human-readable preview summary at `apps/editor/src/features/editor-session/editor-session-context.tsx:299` to `:316` and `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:172` to `:178`.
- No algorithm logic was embedded in the Editor component. The UI does formatting only.

## Method / Fallback / Provenance Assessment

- Method identity is explicit: `MeshGenerationMethod` includes `auto-outline-v2` at `packages/authoring-core/src/mesh-generation.ts:16` to `:20`, and operation payload schema includes it at `packages/operation-core/src/payloads/model-edit.ts:150` to `:154`.
- Existing methods remain compatible: `auto-outline-v1` and `auto-grid-v1` remain in the method union and schema at the same refs.
- Fallback chain is explicit for generated results: v2 failure records `auto-outline-v2` at `packages/authoring-core/src/mesh-generation.ts:138` to `:151`; v1 failure then records `auto-outline-v1` before grid fallback at `:161` to `:169`.
- Texture-byte absence is observable as fallback reason and v2 fallback step at `packages/authoring-core/src/mesh-generation.ts:236` to `:247`.
- Operation provenance records direct-generation fallback steps and quality metrics through `packages/operation-core/src/operations/generate-mesh.ts:325` to `:352`.
- Residual note: preview Apply provenance does not include preview metrics/fallback steps, as documented in Findings.

## Dependency / Provenance / Claim Assessment

- Dependency status: no `package.json` or `pnpm-lock.yaml` changes were present for the checked root/editor/authoring/operation manifests.
- Import status: v2 and metrics files import only project packages and local modules; no triangulation/Poisson/Delaunay package import was added.
- Dependency policy: no new dependency proposal or license review is required for this slice because no dependency or lockfile churn occurred.
- Constrained triangulation claim: source records `triangulationMode: "interim-delaunay-alpha-filter"` at `packages/authoring-core/src/mesh-outline-v2-generation.ts:183`, and ordinary triangulation is implemented in-repo at `:740`. The report states this is not full constrained triangulation at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:9` and defers full constrained triangulation at `:28`.
- Cubism / pixel-perfect / semantic claims: basis forbids Cubism and semantic inference at `discussion/implementation/orchestration/wave63-plan.md:50` to `:51` and `:360`; the report excludes semantic preset inference and Cubism compatibility at `discussion/implementation/waves/wave63/wave63-domain-b-report.md:31`. I found no changed Domain B source path making those claims.

## Verification Performed

- `git status --short -uall` to identify Domain B files and parallel non-Domain-B worktree changes.
- `git diff --name-status` and targeted `git diff` over the claimed Domain B source paths.
- `node scripts/check-source-organization.mjs` - passed.
- `git diff --check -- <Domain B tracked source paths>` - passed with line-ending warnings only.
- `Select-String -Pattern '[ \t]+$'` on new v2/metrics/report files - no matches.
- Manifest status check for root `package.json`, `pnpm-lock.yaml`, `packages/authoring-core/package.json`, `packages/operation-core/package.json`, and `apps/editor/package.json` - no changes.

I did not rerun focused vitest or Playwright in this lane; test adequacy is covered by the separate Test Adequacy review lane. Existing Domain B and Spec review reports record focused test results, but this review's pass does not depend on Gnome summary alone.

## Residual Risk Classification

- Residual risk: `medium`.

Reasons:

- Full constrained triangulation is intentionally deferred, so complex concave, hole, and multi-island alpha shapes can still have boundary-quality limitations.
- Preview Apply currently drops preview-only fallback/quality metadata from committed operation provenance, even though direct operation generation records metrics.
- `mesh-outline-v2-generation.ts` is cohesive but large enough that future v2 expansion should split responsibilities before it becomes expensive to review.

No fixes are required for Domain B Design / Development Compliance.
