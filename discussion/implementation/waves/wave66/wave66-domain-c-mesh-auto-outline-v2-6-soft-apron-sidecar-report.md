# Wave66 Domain C Report: Mesh auto-outline-v2.6-soft-apron Sidecar

- Verdict candidate: pass
- Domain: `wave66-mesh-auto-outline-v2-6-soft-apron-sidecar`
- Scope: headless mesh generation sidecar in `packages/authoring-core` / `packages/operation-core`
- Report path: `discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`

## Changed Files

- `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts`
  - New V2.6 generator.
  - Uses V2.5 soft-boundary output as the base mesh, preserves V2.5 interior sampling, and adds a bounded 1-ring soft apron strip outside the ordered V2.5 boundary.
- `packages/authoring-core/src/mesh-generation.ts`
  - Adds explicit method/source/fallback routing for `auto-outline-v2.6-soft-apron`.
  - V2.6 fallback chain is `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid`.
- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - Adds `MeshGenerationSoftApronMetrics` and `interim-delaunay-soft-apron-strip`.
- `packages/authoring-core/src/index.ts`
  - Barrel export only for the new V2.6 generator.
- `packages/operation-core/src/payloads/model-edit.ts`
  - Adds `auto-outline-v2.6-soft-apron` to `GenerateMeshPayloadSchema`.
- `packages/operation-core/src/operations/generate-mesh.ts`
  - Allows V2.6 previewMesh commit method and records soft-apron metrics in provenance transform history.
- `packages/authoring-core/src/mesh-generation.test.ts`
  - Adds V2.6 determinism, coverage, boundedness, fallback, and routing tests while retaining V2.5 coverage.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Adds V2.6 operation provenance and fallback chain tests.
- This report file.

## Basis Coverage Self-Report

| Basis item | Status | Evidence |
|---|---|---|
| Explicit method `auto-outline-v2.6-soft-apron` | Implemented | `MeshGenerationMethod`, operation payload enum, routing tests, operation tests. |
| Reuse / preserve V2.5 behavior | Implemented | V2.6 calls `createAutoOutlineV25SoftBoundaryMesh` and preserves base interior point count in tests. |
| Ratio-based apron padding | Implemented | V2.6 config derives apron padding from alpha bounds min dimension by density preset. |
| 1-2 apron ring sampling / bounded strip | Implemented | Initial V2.6 uses a deterministic 1-ring bounded apron strip. Metrics expose `apronRingCount`. |
| V2.5-like sparse interior sampling | Implemented | V2.6 does not resample interior; tests assert base interior point count equals V2.5. |
| Apron-aware long-edge / fan / skinny filtering | Implemented | V2.6 classifies/rejects degenerate/long/skinny apron triangles and records fan/edge/skinny metrics. Tests assert bounded counts and that apron strip triangles do not connect to interior vertices. |
| Bounded local gap refill | Deferred by design | Not implemented in this first sidecar; provenance records `local-gap-refill-deferred`. No V3-style envelope is introduced. |
| Quality metrics / provenance | Implemented | `softApronMetrics` plus operation `meshQuality:softApron...` transform history entries. |
| Fallback chain | Implemented | Authoring and operation tests assert `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid` on alpha-empty fallback. |
| Deterministic output | Implemented | Direct V2.6 test compares repeated generation output. |
| Boundary/apron coverage over V2.5 | Implemented | Tests assert V2.6 apron boundary area ratio exceeds V2.5 soft-boundary area ratio. |
| Triangle count bounded | Implemented | Tests assert V2.6 triangle count increase ratio remains bounded on representative fixtures. |
| Editor default remains V2.5 | Confirmed | `rg` shows editor command default and context still use `auto-outline-v2.5-soft-boundary`; no `apps/editor/**` files were changed by Domain C. |

## Intentionally Deferred Basis Items

- Local boundary gap refill is not included. The current implementation adds only a bounded apron strip and records `local-gap-refill-deferred`; this avoids accidentally creating a V3-style global envelope.
- Constrained triangulation is not introduced. The apron strip is explicit and bounded; no new geometry dependency was added.
- Editor method selector/default visibility was not changed. V2.6 is headless/operation-addressable only in this domain.
- Human visual validation is still required before any default switch.

## User Workflow Trace

```text
Headless / operation request method auto-outline-v2.6-soft-apron
  -> V2.5 soft-boundary base mesh is generated
  -> ordered V2.5 boundary vertices become the apron inner boundary
  -> ratio-based outward apron ring is clamped to drawable bounds
  -> bounded apron strip triangles are added
  -> softApronMetrics and meshQuality provenance are emitted
  -> if V2.6 fails, route to V2.5, then V2, V1, bounds-grid
```

## Must-not Compliance Evidence

- No Canvas Evaluation / Renderer files were changed by Domain C.
- No `apps/editor/**` source was changed by Domain C; Editor default remains `auto-outline-v2.5-soft-boundary`.
- No Cubism SDK/Core/parser/runtime dependency, format, or oracle was used.
- No new dependency was added; dependency guard passed.
- No Parameter / Keyform / Deformer UX changes were made.
- No V3-style envelope implementation was added to V2.6; the implementation is a bounded local apron strip.
- `packages/authoring-core/src/index.ts` remains barrel-only.

## Verification Commands / Results

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`
  - First sandboxed attempt failed before tests with Windows `spawn EPERM` while loading Vitest config.
  - Escalated rerun: pass, 24 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`
  - Escalated run: pass, 19 tests passed.
- `pnpm.cmd typecheck`
  - pass.
- `node scripts\check-source-organization.mjs`
  - pass.
- `node scripts\check-dependencies.mjs`
  - pass.
- `git diff --check`
  - pass. Git emitted LF-to-CRLF working-copy warnings only.
- `Select-String -Path packages\authoring-core\src\mesh-outline-v2-6-soft-apron-generation.ts,discussion\implementation\waves\wave66\wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md -Pattern '[ \t]+$'`
  - pass, no trailing whitespace matches.
- `rg -n "auto-outline-v2\.6-soft-apron|auto-outline-v2\.5-soft-boundary" apps\editor\src\features\editor-session`
  - confirms editor command/context references remain V2.5 and no V2.6 editor default reference exists.

## Residual Risks

- V2.6 currently treats V2.5 soft boundary as the inner boundary for the apron strip rather than re-extracting a separate raw alpha contour. This is intentional to preserve V2.5 behavior and avoid a broad refactor, but visual review should confirm the apron is not too conservative.
- The apron offset is centroid-radial with self-intersection retries and drawable-bounds clamp. Very complex concave shapes may need a later local refill or more contour-local normal handling.
- Triangle increase is bounded by tests on representative fixtures, but future real artwork may justify tighter preset-specific caps after visual review.
