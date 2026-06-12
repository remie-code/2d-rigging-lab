# Wave64 Domain C Test Adequacy Review

## Verdict

- Verdict: `pass`
- Domain: `wave64-mesh-auto-outline-v3-envelope-sidecar`
- Review lane: Test Adequacy Review
- Loop: 2 final delta check
- Summary: Previous test adequacy findings are resolved. Domain C now has targeted coverage for deterministic V3 output, V3 <= V2 counts across representative fixtures/densities, transparent-inside-envelope allowance, envelope-outside sample rejection through an independent test-side oracle, V3 summary/provenance, operation method/schema/provenance, V3-specific fallback to V2 success, full fallback chain, and preserved V2 behavior. Verification passes after the expected Vitest sandbox escalation.

## Scope Reviewed

Reviewed Domain C changed files:

- `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md`

## Basis Documents Used

- `discussion/implementation/orchestration/wave64-plan.md`
- `discussion/implementation/waves/wave64/wave64-preplan-mesh-v3-envelope-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v3-envelope.md`
- `discussion/design/mesh-generation/auto-outline-v2.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/implementation/waves/wave63/wave63-domain-b-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`

## Test Cases Inspected And Coverage Matrix

| Acceptance / risk | Evidence inspected | Adequacy |
|---|---|---|
| Deterministic V3 output | `packages/authoring-core/src/mesh-generation.test.ts:225` creates two V3 meshes from identical input and asserts structural equality. | Adequate. |
| V3 vertex/triangle counts <= V2 | Original V3/V2 comparison remains at `packages/authoring-core/src/mesh-generation.test.ts:225`; broadened fixture/density matrix is at `:274` and covers `notched-tail` plus `round-body` across low / medium / high. | Adequate. |
| Transparent pixels allowed inside envelope | V3 summary assertion remains in `packages/authoring-core/src/mesh-generation.test.ts:225`; independent sample assertion is at `:269` and helper logic starts at `:841`. | Adequate. |
| Envelope-outside triangles/samples rejected | Independent test-side envelope reconstruction derives boundary vertices from V3 stable IDs at `packages/authoring-core/src/mesh-generation.test.ts:841`, rebuilds an envelope hull at `:848`, and asserts zero outside samples at `:269`. | Adequate for this interim convex-hull-envelope algorithm. |
| V3 summary records envelope/provenance | Authoring summary assertions are in `packages/authoring-core/src/mesh-generation.test.ts:225` and routing summary assertions in `:508`; operation provenance assertions are in `packages/operation-core/src/operations/generate-mesh.test.ts:283`. | Adequate. |
| V3 operation method/schema/provenance | Payload schema includes method at `packages/operation-core/src/payloads/model-edit.ts:150` and `:157`; operation tests parse via `OperationRequestSchema.parse` at `packages/operation-core/src/operations/generate-mesh.test.ts:396`; provenance is asserted at `:283`, `:318`, and `:366`. | Adequate. |
| V3-specific fallback -> V2 success | Authoring test at `packages/authoring-core/src/mesh-generation.test.ts:436` forces `envelope-generation-failed` while V2 generates; operation provenance test is at `packages/operation-core/src/operations/generate-mesh.test.ts:318`. | Adequate. Previous F1 resolved. |
| Full fallback chain V3 -> V2 -> V1/grid | Empty-alpha authoring fallback remains covered in `packages/authoring-core/src/mesh-generation.test.ts:414`; operation fallback chain is asserted at `packages/operation-core/src/operations/generate-mesh.test.ts:366`. | Adequate. |
| Existing V2 behavior preserved | Existing V2 tests remain at `packages/authoring-core/src/mesh-generation.test.ts:96`, `:133`, `:168`, `:193`, and `:480`; operation V2 tests remain at `packages/operation-core/src/operations/generate-mesh.test.ts:259` and `:349`. | Adequate. |
| No screenshot/pixel oracle introduced | `rg -n -e "screenshot" -e "pixel oracle" -e "pixel-oracle" -e "toMatchImageSnapshot" -e "image snapshot" -e "snapshot" ...` returned no matches for the two Domain C test files. | Adequate. |

## Verification Considered / Run

- `pnpm.cmd typecheck`
  - Result: passed.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Sandbox result: failed to load Vitest config due `esbuild` `spawn EPERM`.
  - Escalated result: passed, 2 test files / 30 tests.
  - Breakdown observed: `packages/authoring-core/src/mesh-generation.test.ts` 16 tests passed; `packages/operation-core/src/operations/generate-mesh.test.ts` 14 tests passed.
- `git diff --check -- <Domain C tracked files and this review artifact>`
  - Result: passed with LF/CRLF warnings only.
- `Select-String -Path packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts -Pattern '[ \t]+$'`
  - Result: no matches.

## Findings

No remaining test adequacy findings.

Previous findings resolved:

- F1 resolved: V3-specific envelope failure -> generated V2 fallback is now covered in authoring and operation tests.
- F2 resolved: transparent-inside-envelope and envelope-outside rejection now have an independent test-side sample check derived from V3 boundary stable IDs.
- F3 resolved: V3 <= V2 count checks now cover two representative fixture families across low / medium / high density.

## Residual Risks

- Residual algorithm risk remains normal for the accepted interim approach: V3 still records `interim-delaunay-envelope-filter` rather than claiming constrained triangulation.
- Manual visual review remains a future product-quality check, but no automated screenshot/pixel oracle is required or introduced here.

## User-Decision Points / Provisional Assumptions

- Provisional assumption: `auto-outline-v3-envelope` remains explicit and does not become the Mesh Tool default in Wave64.
- No user-decision point blocks this test adequacy lane.
