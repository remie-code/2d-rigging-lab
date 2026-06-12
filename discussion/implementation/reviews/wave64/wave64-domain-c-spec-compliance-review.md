# Wave64 Domain C Spec Compliance Review

## Verdict

- Verdict: `pass`
- Review lane: `Spec Compliance Review`
- Domain: `wave64-mesh-auto-outline-v3-envelope-sidecar`
- Review loop: 2 final delta check
- Reviewer: independent Review-Sylph
- Date: 2026-06-12

Final delta review found no remaining Domain C spec-compliance issue. The previous blocker is resolved: focused Domain C vitest now passes after sandbox escalation, and root typecheck passes.

## Scope Reviewed

Reviewed Domain C paths supplied by the parent:

- `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md`

Scope caveat: `packages/operation-core/src/payloads/model-edit.ts` also contains parallel Parameter / Keyform changes outside Domain C. This review only uses the V3 method enum addition there as Domain C evidence.

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
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

No open spec-compliance findings.

Resolved loop 1 blocker:

- Previous focused vitest collection blocker in `packages/package-format/src/parameter-presets.ts:30` is no longer present in verification.
- `pnpm.cmd typecheck` now passes.
- Focused Domain C vitest now passes: 2 files, 30 tests.

## Spec Compliance Evidence

| Requirement | Review result | Evidence |
|---|---|---|
| Explicit method `auto-outline-v3-envelope` | Implemented | `MeshGenerationMethod` includes it in `packages/authoring-core/src/mesh-generation.ts:20`; operation payload enum includes it in `packages/operation-core/src/payloads/model-edit.ts:157`. |
| V3 sidecar, not V2/default replacement | Implemented | V3 is routed only when `input.method === "auto-outline-v3-envelope"` in `packages/authoring-core/src/mesh-generation.ts:116`; report records V2 editor default is preserved at `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md:52`. |
| Contour simplification | Implemented | Selected contour is simplified in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:142`; simplification logic is at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:481`. |
| Outward envelope generation | Implemented, conservative | V3 builds an envelope boundary at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:152`; envelope boundary creation is implemented at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:518`. |
| Self-intersection cleanup or conservative fallback | Implemented as cleanup | Envelope generation uses self-intersection detection plus convex-hull cleanup, with cleanup provenance recorded in metrics at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:222`. |
| Envelope resampling | Implemented | `resampleEnvelopeBoundary` is called at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:539` and implemented at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:591`. |
| Optional support ring | Implemented | Support ring sampling is called at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:171` and implemented at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:620`. |
| Coarser deterministic interior sampling | Implemented | Interior sampling is called at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:176`; deterministic seed and jitter are recorded through stable V3 sampling code and covered by deterministic tests at `packages/authoring-core/src/mesh-generation.test.ts:225`. |
| Envelope-based filtering allows transparent pixels inside but rejects envelope-outside triangles | Implemented and tested | Filter call is at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:726`; filter implementation is at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:820`; independent test-side sample check asserts outside `0` and transparent-inside `> 0` at `packages/authoring-core/src/mesh-generation.test.ts:269`. |
| V3 quality metrics / provenance / summary | Implemented | Envelope metrics are built at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:222`; metrics schema includes V3 envelope metrics at `packages/authoring-core/src/mesh-quality-metrics.ts:17`; operation provenance emits envelope metrics at `packages/operation-core/src/operations/generate-mesh.ts:361`. |
| Fallback to V2 / existing fallback with reason | Implemented and tested | V3 failure falls through to V2/V1/grid in `packages/authoring-core/src/mesh-generation.ts:136`; V3-specific failure to V2 success is tested at `packages/authoring-core/src/mesh-generation.test.ts:436` and operation provenance at `packages/operation-core/src/operations/generate-mesh.test.ts:318`; empty-alpha full fallback chain is tested at `packages/operation-core/src/operations/generate-mesh.test.ts:366`. |
| Deterministic output | Implemented and tested | Determinism is asserted by comparing two V3 generations at `packages/authoring-core/src/mesh-generation.test.ts:245`. |
| V3 vertices/triangles <= V2 on representative fixtures unless fallback justified | Implemented and tested | Matrix test covers `notched-tail` and `round-body` at low/medium/high densities in `packages/authoring-core/src/mesh-generation.test.ts:274`; report records the same matrix at `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md:102`. |
| No screenshot/pixel oracle or Cubism reproduction claim | Compliant | Report explicitly records no Cubism reproduction, screenshot test, or pixel oracle at `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md:52`; no app/e2e screenshot oracle was added in Domain C scope. |
| No broad dependency without policy compliance | Compliant | `package.json` / `pnpm-lock.yaml` have no diff; `node scripts/check-dependencies.mjs` passed. |
| Constrained triangulation deferred honestly | Compliant | V3 records `interim-delaunay-envelope-filter` and `constrained-triangulation-deferred` at `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:244`; operation test asserts this provenance at `packages/operation-core/src/operations/generate-mesh.test.ts:283`. |

## Verification Considered / Run

- Static review of basis documents, implementation, tests, report, and relevant diffs.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Sandbox: failed with esbuild `spawn EPERM`.
  - Escalated rerun: passed, 2 files passed, 30 tests passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- <Domain C files plus this review artifact>`
  - Passed with LF/CRLF warnings only.
- `git diff --name-only -- package.json pnpm-lock.yaml`
  - No output; no dependency manifest / lockfile diff observed.

## Residual Risks

- V3 uses conservative convex-hull cleanup, not robust polygon Boolean / offset cleanup. This matches the accepted no-new-dependency sidecar scope but may over-envelope concave silhouettes.
- Full constrained triangulation remains deferred. The implementation labels the interim ordinary Delaunay + envelope filter path honestly.
- Fixture coverage is now sufficient for this spec lane, but real art-direction quality still needs later human visual review without becoming a screenshot/pixel oracle.
- The new V3 implementation file is cohesive but large. Source organization guard passes; future helper extraction may be useful if the algorithm grows.
- Shared `model-edit.ts` has parallel Parameter / Keyform edits outside Domain C; this review did not assess those changes except for the V3 method enum.

## User-Decision Points / Provisional Assumptions

- Provisional assumption: method name remains `auto-outline-v3-envelope`.
- Provisional assumption: no new geometry dependency is allowed in this wave; conservative convex-hull cleanup is acceptable.
- Provisional assumption: editor UI selector/default switch remains deferred; V2 stays editor default.
