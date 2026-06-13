# Wave67 Domain C Test Adequacy Review

> Review-Sylph independent test adequacy review for `wave67-mesh-auto-outline-v4-contour-band-sidecar`.

## Verdict

pass

Domain C has adequate focused headless unit/integration coverage for the Wave67 sidecar scope. The tests cover V4 determinism, explicit method/source routing, fallback chain/provenance, contour-band metrics, preset density behavior, V3-like envelope avoidance through bounded metrics, and preservation of V2.6/default behavior.

No source or test edits were made.

## Evidence Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-mesh-v4-sidecar-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v4-contour-band.md`
- `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/screen-design/components/mesh-tool.md`

Target source/tests:

- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/payloads/model-edit.ts`

Additional default check:

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`

## Verification Performed

Focused command requested by the review:

```powershell
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts
```

First sandboxed run failed during Vitest config load with `Error: spawn EPERM` from `esbuild`. I reran the same focused command with approved escalation.

Escalated focused result:

- `packages/authoring-core/src/mesh-generation.test.ts`: 27 tests passed.
- `packages/operation-core/src/operations/generate-mesh.test.ts`: 21 tests passed.
- Total: 2 files, 48 tests passed.

I did not run broader `pnpm typecheck` or full repository tests for this lane.

## Rubric Coverage

| Review point | Assessment | Evidence |
|---|---|---|
| Deterministic V4 output | Covered | `mesh-generation.test.ts:595` compares two `createAutoOutlineV4ContourBandMesh` results with `expect(first).toEqual(second)`. |
| Representative fixtures produce nonzero contour-band metrics | Covered | `mesh-generation.test.ts:595` uses an ellipse/top/tail/notch fixture and asserts nonzero contour points, band triangles, interior points, and interior triangles. `mesh-generation.test.ts:1032` also checks routed generation metrics. |
| Fallback chain/source ids/operation provenance | Covered | Authoring fallback chain for V4 to bounds-grid is asserted at `mesh-generation.test.ts:805`. Operation provenance success and fallback histories are asserted at `generate-mesh.test.ts:357` and `generate-mesh.test.ts:546`. Payload allowlist includes V4 at `model-edit.ts:150`. |
| Density/preset behavior | Covered | `mesh-generation.test.ts:646` asserts high > medium > low vertices/triangles and checks caps/ratio/valence for all three presets. |
| V4 avoids V3-like huge envelope behavior | Covered through metrics | V4 source caps outer contour area ratio per preset in `mesh-outline-v4-contour-band-generation.ts:281`, and tests assert representative `outerContourAreaRatio < 1.58` at `mesh-generation.test.ts:632`. This is metric-based rather than visual. |
| Transparent-only triangle ratio | Covered | Source quality gate at `mesh-outline-v4-contour-band-generation.ts:243`; test assertion at `mesh-generation.test.ts:638` and operation route assertion at `mesh-generation.test.ts:1066`. |
| High valence | Covered | Source quality gate at `mesh-outline-v4-contour-band-generation.ts:246`; tests assert `<= 12` at `mesh-generation.test.ts:637` and `mesh-generation.test.ts:680`. |
| Long boundary-to-interior spokes | Covered | Source quality gate at `mesh-outline-v4-contour-band-generation.ts:245`; test assertion at `mesh-generation.test.ts:634`. Metrics compute max boundary-to-interior edge at `mesh-outline-v4-contour-band-generation.ts:910`. |
| Excessive vertex count | Covered | Source quality gate at `mesh-outline-v4-contour-band-generation.ts:247`; tests assert vertex count <= cap at `mesh-generation.test.ts:639` and `mesh-generation.test.ts:678`. |
| Existing V2.6 behavior remains tested | Covered | V2.6 determinism/apron metrics remain asserted at `mesh-generation.test.ts:363`; bounded large-motion V2.6 behavior at `mesh-generation.test.ts:431`; operation provenance at `generate-mesh.test.ts:319`. |
| Editor default remains V2.6 | Covered | `commitGenerateMesh` still defaults to `"auto-outline-v2.6-soft-apron"` at `editor-session-commands.ts:274`, and `editor-session-commands.test.ts:609` asserts Mesh Tool generation defaults to V2.6. Search found no editor-side V4 UI selection. |
| Unit/integration/browser/e2e/manual visual coverage | Adequate for headless scope | Package unit/integration tests are required and present. Browser/e2e/manual visual are N/A for this Domain C sidecar because no UI selector is included and V4 is explicitly non-default. Manual visual remains required before any future default switch. |

## Findings

1. The focused tests adequately pin the V4 sidecar contract. The authoring-core tests verify deterministic output, explicit contour-band metrics, bounded quality risks, stable V4 id fragments, and density ordering.

2. The operation-core tests adequately verify explicit method acceptance and provenance for the headless operation path. They assert `generateMesh:auto-outline-v4-contour-band`, `meshSource:outline-v4-contour-band-rgba`, contour-band metric provenance, and the full empty-alpha fallback chain through V2.6, V2.5, V2, V1, then bounds-grid.

3. Existing V2.6 tests are still meaningful and focused. They cover deterministic soft-apron generation, bounded apron coverage, bounded count increase over V2.5, and operation provenance. This supports the requirement that V4 is additive and does not displace V2.6.

4. Editor default coverage is present outside the specified target set and is sufficient for this lane. The implementation default is V2.6, and the test checks the emitted operation history rather than relying only on the function signature.

## Residual Risk / Test Gaps

- There is no focused test for a non-empty V4-specific failure where V4 fails but V2.6 succeeds. The empty-alpha tests prove the full fallback ordering to bounds-grid; they do not separately exercise the intermediate-success path `V4 failed -> V2.6 generated`. This is a useful future hardening test but not blocking for the current sidecar test adequacy.
- Operation provenance tests assert representative contour-band provenance fields, not every formatted contour-band metric. Authoring tests directly assert the key bounds, and `generate-mesh.ts` formats the full metric set, so this is acceptable residual risk.
- No browser/e2e/manual visual verification was run. For the current headless, non-default sidecar scope this is N/A; it should become required before any default switch or UI comparison claim.

## Recommendation

Accept Domain C test adequacy as `pass`. Add the intermediate-success V4 fallback test in a future hardening pass if V4 fallback behavior becomes operationally important beyond alpha-empty/full-chain proof.
