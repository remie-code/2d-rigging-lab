# Wave38 Clean Integration Review

## Verdict

pass

Review artifact path:

- `discussion/implementation/reviews/wave38/wave38-clean-integration-review.md`

## Scope Reviewed

- Wave: `wave38`
- Target: `wave38-integration-review-and-final-report`
- Role: Review-Sylph clean integration review
- Write performed by this reviewer: this review artifact only

This review inspected basis documents, Wave38 reports/reviews, current source, fixture JSON, registration docs, targeted diffs, and verification commands directly. It did not rely only on Gnome or Orch-Sylph summaries.

## Findings By Severity

### Blocking

None.

### Medium

None.

### Low / Residual

- `lockedTargetIds` in new topology payloads still uses the existing generic `z.string().min(1)` pattern. This was already recorded by Domain A Review-Sylph as non-blocking because the new topology-owned IDs use `MeshIdSchema`, `VertexIdSchema`, and `TriangleIdSchema`; treat broader locked-target ID hardening as future cleanup.
- The final e2e note includes one parallel-run sensitivity: topology/UV mobile timed out when reusing a server concurrently with the canvas smoke, while the single-script rerun passed desktop/mobile. This is an e2e orchestration/port-reuse risk, not a Wave38 source correctness blocker.

## Integration Assessment

- Domain A integrates coherently: `packages/contracts/src/mesh-topology.ts`, `ids.ts`, `target-ref.ts`, `packages/package-format/src/model-files.ts`, and operation payload/evidence files add bounded topology/UV contract surfaces without package-version churn. Public `index.ts` changes are barrel-only.
- Domain B integrates coherently: `packages/authoring-core/src/mesh-topology-mutations.ts` rejects stale revisions, invalid insert indexes, referenced vertex removal, duplicate/degenerate triangle inputs, and UV no-ops without corrupting mesh state. Operation handlers route through authoring mutations and emit model diff plus `meshTopologyEvidence` with renderer and texture-sampling claims set to `"none"`.
- Package/runtime propagation is coherent: package materialization clones mesh state, runtime graph drawables carry `uvs`, `triangles`, `vertexStableIds`, optional `triangleStableIds`, and optional `topologyRevision`, and runtime/viewer mesh evidence exposes topology summaries plus full-detail UV/triangle refs when requested.
- Domain C integrates coherently: `packages/validator-core/src/validators/mesh-semantics.ts` now checks UV count, UV bounds, triangle stable ID count, orphaned vertices, runtime/viewer mesh evidence presence, stable triangle counts, `hasStableTriangleIds`, and mesh-local `topologyRevision` mismatch.
- Domain D integrates coherently: Editor command/session/workflow/state/UI adds only bounded actions: add vertex, remove unreferenced selected vertex, add triangle from exactly three selected vertices, remove stable-ID triangle, and UV nudge. Existing canvas vertex move workflow remains present and covered.
- Domain E integrates coherently: `apps/editor/e2e/topology-uv-persistence-smoke.mjs` proves add vertex, stale add rejection, referenced vertex removal block, add triangle, UV nudge, Preview/Viewer/Validator evidence, browser-local save/load, and desktop/mobile execution. Fixture and traceability registration is narrow and points to the Wave38 fixture only.
- Domain F Gnome fix is coherent: the narrow final-unit fix updates stale legacy runtime/viewer fixture construction and expected JSON so strengthened mesh evidence validation has complete `uvs`, `triangles`, stable IDs, and expected topology fields. No production source change was part of that final fix.

## Non-Goal Containment

Pass. I found no Wave38 implementation path for automatic triangulation, atlas packing, real texture decode, full renderer, pixel oracle, Cubism compatibility, or external dependencies.

The changed-line scan found only explicit negative/non-claim contexts, including `rendererCorrectnessClaim: "none"`, `textureSamplingCorrectnessClaim: "none"`, fixture flags such as `pixelOracle: false`, and UI tests forbidding unsupported wording.

## Source / Dependency Compliance

- Public `index.ts` files inspected under `packages/contracts`, `packages/operation-core`, `packages/authoring-core`, `apps/editor/src/editor-session`, `apps/editor/src/editor-state`, and `apps/editor/src/editor-workflow` are barrel-only.
- `pnpm.cmd run check:source` passed.
- `pnpm.cmd run check:deps` passed.
- Dependency manifest / lockfile diff check produced no output for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor/package.json`, and `packages/*/package.json`.

## Verification Reviewed / Performed

Reviewed final verification reported by Orch-Sylph after the Domain F Gnome fix:

- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd test:unit`: passed, 193 files / 994 tests.
- `pnpm.cmd test:e2e`: passed, editor desktop/mobile smoke.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: passed with CRLF normalization warnings only.
- `node apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`: passed desktop/mobile.
- `node apps/editor/e2e/topology-uv-persistence-smoke.mjs`: passed desktop/mobile on the single-script rerun.

Independently performed in this clean review:

- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: passed with CRLF normalization warnings only.
- Dependency manifest / lockfile diff check: no output.
- `node --check apps/editor/e2e/topology-uv-persistence-smoke.mjs`: passed.
- `node --check apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`: passed.
- Parsed all 7 JSON files under `fixtures/contracts/wave38-topology-uv-fixture-e2e`.
- Inspected Domain F final-fix diff and confirmed it is limited to stale legacy fixture/test expectation updates.

## Residual Risks

- Wave38 proves semantic topology/UV evidence, operation/package/runtime/viewer/validator consistency, and editor persistence. It does not prove renderer pixels, real texture sampling, real image bytes, image decode, atlas packing, or automatic triangulation.
- E2E concurrent server reuse can be timing-sensitive; single-script desktop/mobile reruns passed, so this is a runner robustness risk rather than a source defect.
- `lockedTargetIds` no-space hardening remains a future shared operation payload cleanup.

## User-Decision Points

None for accepting Wave38 as scoped.

Future expansion into automatic triangulation, atlas packing, real texture decode/sampling, full renderer/pixel oracle, Cubism compatibility, archive/filesystem transport, or new dependencies still requires explicit user/project decision.

## Orchestration Separation

Pass based on available artifacts. Domains A-E record Gnome implementation and separate Review-Sylph review. Domain B and C needs-fix loops were delegated back to Gnome and re-reviewed to pass. The Domain F final unit failure fix report identifies a Gnome fix context, not a review context. Orch-Sylph final verification is reported separately, and this Review-Sylph wrote only this clean integration review artifact.
