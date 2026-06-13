# Wave67 Domain C Spec Compliance Review

> Review-Sylph independent review for `wave67-mesh-auto-outline-v4-contour-band-sidecar`.

## Verdict

pass

Domain C meets the Wave67 Mesh V4 contour-band sidecar requirements. No blocking spec-compliance issue was found in the reviewed Domain C implementation.

External verification note: full `pnpm typecheck` currently fails in `packages/render-webgl2/src/webgl2-renderer.test.ts:257`, outside the Domain C review target. Focused Domain C tests pass.

## Basis Read

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-mesh-v4-sidecar-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v4-contour-band.md`
- `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
- `discussion/design/screen-design/components/mesh-tool.md`

## Source And Diff Read

- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- Editor default check, because the rubric requires it:
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| V4 is explicit and non-default sidecar | implemented | `MeshGenerationMethod` includes `auto-outline-v4-contour-band` only as explicit method in `mesh-generation.ts:32-40`; editor command default remains V2.6 in `editor-session-commands.ts:274-280`; editor preview/apply still passes V2.6 in `editor-session-context.tsx:646-654` and `676-690`. |
| Explicit method id `auto-outline-v4-contour-band` | implemented | `mesh-generation.ts:32-40`, V4 metric `algorithmId` in `mesh-quality-metrics.ts:95-124`, tests in `mesh-generation.test.ts:625-627`. |
| Explicit source id `outline-v4-contour-band-rgba` | implemented | `mesh-generation.ts:42-50` and generated return path in `mesh-generation.ts:154-160`; test assertion in `mesh-generation.test.ts:1056`. |
| Fallback chain `V4 -> V2.6 -> V2.5 -> V2 -> V1 -> bounds-grid` | implemented | V4 branch in `mesh-generation.ts:143-307`; texture-missing chain includes V4/V2.6/V2.5/V2/V1 in `mesh-generation.ts:774-839`; tests assert empty-alpha chain in `mesh-generation.test.ts:805-822` and operation provenance in `generate-mesh.test.ts:546-563`. |
| Contour-band algorithm exists | implemented | New generator creates alpha mask, contour, outer/inner rings, interior points, band strip, and interior triangulation in `mesh-outline-v4-contour-band-generation.ts:120-270`, `539-592`, and `754-873`. |
| Contour-band-specific metrics/provenance | implemented | Metrics type in `mesh-quality-metrics.ts:95-124`; generator fills metrics/provenance in `mesh-outline-v4-contour-band-generation.ts:898-959`; operation transform history formats contour-band metrics in `generate-mesh.ts:451-482`. |
| V4 output deterministic | implemented | Stable sorting/IDs and deterministic jitter are in `mesh-outline-v4-contour-band-generation.ts:786-797`, `1031-1050`, `1568-1617`; test asserts two results are equal in `mesh-generation.test.ts:616-620`. |
| Representative nonzero contour-band metrics | implemented | Tests require nonzero contour, band triangles, interior points, and interior triangles in `mesh-generation.test.ts:625-631` and route-level metrics in `1032-1067`. |
| V4 avoids V3-like huge envelope behavior | implemented | Config caps outer area ratio in `mesh-outline-v4-contour-band-generation.ts:274-347`; ring creation rejects excessive outer area ratio in `539-592`; representative test asserts area ratio `< 1.58` in `mesh-generation.test.ts:632-633`. |
| Transparent-only triangle ratio bounded | implemented | Config threshold and quality rejection in `mesh-outline-v4-contour-band-generation.ts:94`, `243-255`; metric calculation in `1175-1210`; tests assert `<= 0.08` in `mesh-generation.test.ts:637-639`, `677-680`, and `1064-1066`. |
| High valence bounded | implemented | Config threshold and quality rejection in `mesh-outline-v4-contour-band-generation.ts:95`, `243-255`; metric calculation in `1148-1173`; tests assert `<= 12` in `mesh-generation.test.ts:637` and `677-680`. |
| Long boundary-to-interior spokes bounded | implemented | Config threshold and triangle filtering in `mesh-outline-v4-contour-band-generation.ts:92`, `842-873`, `962-1002`; final quality rejection in `243-255`; test asserts against target edge length in `mesh-generation.test.ts:634-636`. |
| Excessive vertex count bounded | implemented | Config caps in `mesh-outline-v4-contour-band-generation.ts:96-98`, `274-347`; quality rejection in `243-255`; tests assert cap adherence in `mesh-generation.test.ts:637-639` and `677-680`. |
| Operation payload/generation allowlist accepts explicit V4 | implemented | Payload enum includes V4 in `model-edit.ts:150-161`; preview commit allowlist includes V4 in `generate-mesh.ts:211-219`; operation test commits V4 in `generate-mesh.test.ts:357-393`. |
| Operation provenance records V4 source/metrics/fallback | implemented | Provenance history includes source/fallback/metrics in `generate-mesh.ts:326-360` and `451-482`; tests cover V4 metrics in `generate-mesh.test.ts:378-392` and fallback in `546-563`. |
| Authoring-core export includes V4 generator | implemented | `index.ts:31`. |
| Existing V2.6 default remains default | implemented | Editor command default is `"auto-outline-v2.6-soft-apron"` in `editor-session-commands.ts:274-280`; preview and apply explicitly use V2.6 in `editor-session-context.tsx:646-654` and `676-690`; editor test asserts V2.6 default in `editor-session-commands.test.ts:609-680`. |
| Optional UI exposure, if included, must keep V2.6 selected | not relevant | No V4 UI exposure was found. Current editor paths still use V2.6. |
| Side-by-side comparison UI not required | explicit non-goal | Wave67 Domain C marks side-by-side comparison as not mandatory; implementation is headless/package-level only. |
| Human visual confirmation before default switch | deferred by plan | Wave67 requires V4 to remain sidecar and not become default without later human visual confirmation. No default switch occurred. |
| Mesh rendering seam fixes must not be claimed | implemented | No target-file matches for `seam`, `renderer`, or rendering-fix claims in reviewed implementation/tests. Mesh rendering basis separates generation from rendering. |
| Cubism reproduction/compatibility must not be claimed | implemented | No target-file matches for `Cubism`, compatibility/reproduction, SDK, `.moc3`, `.cmo3`, or `.model3` claims in reviewed implementation/tests. |
| New broad geometry dependency requires escalation | not relevant | No new Domain C dependency was added; V4 uses local helper code. |

## Findings

No blocking Domain C spec-compliance findings.

Non-blocking observations:

- V4 uses a centroid-based contour offset (`centroid-normal-contour-band-offset` provenance) rather than a full constrained triangulation/normal-offset implementation. This is acceptable for the Wave67 sidecar because constrained triangulation is explicitly marked deferred in the provenance and the implementation bounds self-intersection, area ratio, transparent-only triangles, valence, spokes, and vertex count.
- Full `pnpm typecheck` is not clean because of an unrelated Domain A/WebGL2 test typing error at `packages/render-webgl2/src/webgl2-renderer.test.ts:257`. Domain C focused tests pass.

## Verification Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - Result: pass, 3 test files, 61 tests.
- `pnpm.cmd typecheck`
  - Result: fail outside Domain C: `packages/render-webgl2/src/webgl2-renderer.test.ts(257,5): Type 'string' is not assignable to type 'object'.`
- `git diff --check -- <Domain C target files>`
  - Result: no whitespace errors; Git reported LF-to-CRLF working-copy warnings only.
- Forbidden-claim search over Domain C target files and editor default files:
  - Result: no matches for Cubism reproduction/compatibility, SDK/model format compatibility, renderer seam fixes, or similar forbidden claims.

## Open Issues

- Resolve the unrelated `render-webgl2` typecheck failure before final Wave67 integration can claim a clean repository-wide typecheck.
- Manual visual comparison remains deferred by plan and is required before any future decision to make V4 the default.
