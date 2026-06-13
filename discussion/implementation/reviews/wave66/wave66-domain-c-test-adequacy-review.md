# Wave66 Domain C Test Adequacy Review

verdict: `pass`

## Evidence Reviewed

- Basis:
  - `discussion/implementation/orchestration/wave66-plan.md` lines 91-103, 225-244, 362-405, 442-507, 509-520.
  - `discussion/implementation/waves/wave66/wave66-preplan-mesh-v2-6-sidecar-inventory.md`.
  - `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md` lines 5-24, 59-78, 93-156, 158-224, 236-247.
  - `discussion/design/mesh-generation/auto-outline-v2-5-soft-boundary.md` lines 155-223 and 247-275.
  - `discussion/design/screen-design/components/mesh-tool.md` lines 258-301.
  - `discussion/development_convention/operation-policy.md` lines 79-142 and 348-403.
  - `discussion/development_convention/schema-and-id-conventions.md` lines 124-151 and 487-607.
- Domain C report:
  - `discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`.
- Source and tests:
  - `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts`.
  - `packages/authoring-core/src/mesh-generation.ts`.
  - `packages/authoring-core/src/mesh-quality-metrics.ts`.
  - `packages/authoring-core/src/index.ts`.
  - `packages/operation-core/src/payloads/model-edit.ts`.
  - `packages/operation-core/src/operations/generate-mesh.ts`.
  - `packages/authoring-core/src/mesh-generation.test.ts`.
  - `packages/operation-core/src/operations/generate-mesh.test.ts`.
- Diff reproduction:
  - Reviewed `git diff -- packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts packages/authoring-core/src/mesh-generation.ts packages/operation-core/src/operations/generate-mesh.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/operation-core/src/payloads/model-edit.ts`.
  - Read the new V2.6 file directly, per review instruction.
  - Also checked `packages/authoring-core/src/index.ts` because the Domain C report listed the barrel export.

## Requirement-to-Test Coverage

| Requirement | Basis | Observed coverage | Assessment |
|---|---|---|---|
| Deterministic V2.6 output | Wave plan lines 388-390; V2.6 design lines 206-208 | `mesh-generation.test.ts` lines 383-388 generate V2.6 twice from the same input and compare the full result with `toEqual`. | tested |
| Explicit method/source/metrics visibility | Wave plan lines 236, 391; preplan sections 3-5 | Method/source types include V2.6 at `mesh-generation.ts` lines 28-40. Payload schema accepts it at `model-edit.ts` lines 150-158. Routing test asserts source and soft-apron summary at `mesh-generation.test.ts` lines 885-920. | tested |
| V2.5-like sparse interior density | Wave plan lines 237, 382; V2.6 design lines 158-166 | V2.6 is built from V2.5 at `mesh-outline-v2-6-soft-apron-generation.ts` lines 92-105. Tests compare V2.6 `baseInteriorPointCount` to separately generated V2.5 metrics at `mesh-generation.test.ts` lines 383-399 and 468-479. | tested |
| Ratio-based apron padding / 1-2 ring bounded strip | Wave plan lines 238, 380-381; V2.6 design lines 102-156 | Implementation config derives preset ratios and 1-ring apron at `mesh-outline-v2-6-soft-apron-generation.ts` lines 222-269, with bounded retry/area checks at lines 274-305. Test asserts ring count 1-2 and positive apron vertices/triangles at `mesh-generation.test.ts` lines 397-427 and 920. | tested |
| Boundary/apron coverage increase over V2.5 | Wave plan lines 392; V2.6 design lines 206-211 | Test separately generates V2.5 and V2.6, then asserts V2.6 apron area ratio exceeds V2.5 soft-boundary area ratio at `mesh-generation.test.ts` lines 383-405. It also asserts added V2.6 vertices/triangles over V2.5 at lines 399-401. | partially tested |
| Non-V3-like boundedness / no broad envelope | Wave plan lines 241, 392; V2.6 design lines 119-124, 217-224 | Automated checks assert area-ratio ceilings at `mesh-generation.test.ts` lines 405 and 481. Implementation also clamps apron offset attempts to drawable bounds and rejects excessive apron area at `mesh-outline-v2-6-soft-apron-generation.ts` lines 274-305. | partially tested |
| Bounded triangle-count increase | Wave plan lines 393; V2.6 design lines 214 | Tests assert `triangleCountIncreaseRatio <= 4` on medium and high density fixtures at `mesh-generation.test.ts` lines 406 and 480, plus the relation between V2.5 triangle count and V2.6 apron triangle count at line 401. | partially tested |
| Boundary-to-interior long edges, fan concentration, skinny apron triangles | Wave plan lines 240, 383-394; V2.6 design lines 140-147 and 181-186 | Tests assert apron triangles only use inner-boundary or apron-ring vertices at `mesh-generation.test.ts` lines 413-424, which is a meaningful guard against new apron-to-interior spokes. Long-edge, skinny, and fan thresholds are asserted at lines 407-410 and 482-483. | partially tested |
| Fallback chain `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid` | Wave plan lines 242, 386; preplan section 5 | Authoring test asserts empty-alpha fallback source/reason/steps at `mesh-generation.test.ts` lines 697-713. Operation provenance test asserts the same chain at `generate-mesh.test.ts` lines 489-505. Routing implementation follows the chain at `mesh-generation.ts` lines 135-265. | tested |
| Operation provenance includes V2.6 source and soft-apron metrics | Wave plan lines 243, 385; operation policy lines 167-190, 348-403 | Operation test asserts committed V2.6 provenance entries at `generate-mesh.test.ts` lines 319-355. Formatter emits soft-apron metric entries at `generate-mesh.ts` lines 416-445. | tested |
| Existing V2.5 tests remain passing | Wave plan lines 395; preplan section 4 | Existing V2.5 authoring assertions remain in `mesh-generation.test.ts` lines 227-337 and 849-883. Existing V2.5 operation provenance/fallback assertions remain in `generate-mesh.test.ts` lines 283-318 and 471-487. Orch-Sylph rerun evidence reports the full focused files passed. | tested |
| Editor default remains V2.5 | Wave plan lines 244, 396; V2.6 design lines 236-247 | Editor command default is still V2.5 at `editor-session-commands.ts` line 279. Existing editor default test asserts V2.5 provenance at `editor-session-commands.test.ts` lines 609-680. Editor context preview/apply paths still pass V2.5 explicitly at `editor-session-context.tsx` lines 648-654 and 684-690. | tested |
| Bounded local gap refill | Wave plan line 384; V2.6 design lines 188-203 | Implementation records `local-gap-refill-deferred` in V2.6 metrics provenance at `mesh-outline-v2-6-soft-apron-generation.ts` lines 176-185. This item is only required "if included" by the wave plan. | untested but acceptable with rationale |

## Test Meaningfulness Assessment

- The V2.6 tests are not merely string snapshots. They compare full deterministic output, generate a separate V2.5 result for density and coverage comparison, assert V2.6 adds exactly the reported apron vertices/triangles over V2.5, and inspect apron triangle stable IDs to verify no new apron triangle connects to interior vertices.
- Some boundedness assertions still rely on V2.6's emitted metrics rather than independently recomputing geometry from mesh vertices. This affects apron area ratio, triangle increase ratio, long-edge counts, skinny counts, and fan counts. For a headless sidecar this is acceptable because the tests combine those metrics with independent mesh-structure checks and the implementation derives the metrics from generated geometry.
- Before any editor default switch, add independent geometry helper assertions for all apron vertices within bounds, recomputed apron area ratio, recomputed max apron edge, and recomputed fan valence. That is a future default-switch hardening item, not a blocker for this sidecar.

## Verification Commands / Results Assessment

- Orch-Sylph reported `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts` passed after a sandbox `spawn EPERM` and escalated rerun: 1 file / 24 tests.
- Orch-Sylph reported `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts` passed after the same sandbox issue and escalated rerun: 1 file / 19 tests.
- Orch-Sylph reported `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, and `node scripts/check-dependencies.mjs` passed.
- Orch-Sylph reported `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md` exited 0 with LF-to-CRLF warnings only.
- Review-Sylph did not rerun the commands; this lane is based on direct source/test/diff inspection plus the supplied rerun evidence.

## Findings

No blocking test adequacy findings.

Low residual observations:

- Boundary/apron boundedness is test-covered, but some assertions depend on implementation-owned metrics. This is acceptable for the sidecar and should be strengthened with independent geometry recomputation before any V2.6 default switch.
- Fixture coverage is representative rather than exhaustive: notched-tail and round-body cases cover basic concavity and round shape behavior, but complex real artwork still needs human visual review as required by the V2.6 design.
- There is no V2.6-specific dry-run operation test. Existing operation tests cover generic dry-run clone/model-diff behavior, while V2.6 commit/provenance/fallback is covered. This is acceptable because Domain C's unique operation requirement is provenance visibility, not a new dry-run boundary.

## Residual Risks

- Human visual review remains required before switching Editor default from V2.5 to V2.6. This is explicitly consistent with the V2.6 design and is not a blocker for headless sidecar acceptance.
- Centroid-radial apron offset may be conservative or uneven for complex concave shapes. The current tests bound the representative cases but do not prove all real artwork cases.
- Local gap refill is deferred and only recorded in provenance. This is acceptable under the wave plan because bounded local gap refill was conditional on inclusion.

needs_user_input: none

needs_design_decision: none
