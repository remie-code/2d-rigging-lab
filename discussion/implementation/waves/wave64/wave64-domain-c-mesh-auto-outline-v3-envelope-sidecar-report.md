# Wave64 Domain C Report: Mesh auto-outline-v3-envelope Headless Sidecar

## Verdict

- Verdict: `pass`
- Domain: `wave64-mesh-auto-outline-v3-envelope-sidecar`
- Implementation status: source implementation and review-loop 1 test adequacy fixes are present.
- Review status: Spec Compliance, Design / Development, and Test Adequacy review lanes all pass.
- Verification status: focused Domain C vitest passed after sandbox escalation; root typecheck passed.

## Basis Coverage Self-Report

| Basis item | Coverage |
|---|---|
| `discussion/implementation/orchestration/wave64-plan.md` | Implemented Domain C as independent headless sidecar; did not touch Parameter / Keyform, Camera Capture, Cubism reproduction, or editor default switching. |
| `discussion/implementation/waves/wave64/wave64-preplan-mesh-v3-envelope-inventory.md` | Followed recommended headless + explicit operation method scope; avoided new geometry dependency and editor default change. |
| `discussion/design/mesh-generation/auto-outline-v3-envelope.md` | Added `auto-outline-v3-envelope`, contour simplification, outward envelope, conservative self-intersection cleanup via convex-hull envelope, envelope resampling, optional support ring, coarse deterministic interior sampling, envelope triangle filtering, V3 metrics/provenance, and V2/V1/grid fallback. |
| `discussion/design/mesh-generation/auto-outline-v2.md` | Preserved V2 and used it as fallback; V2 ordinary Delaunay + alpha filter remains unchanged. |
| `discussion/design/mesh-generation/_map.md` | Kept V3 as the next candidate without Cubism / pixel-perfect claims. |
| `discussion/design/screen-design/components/mesh-tool.md` | Preserved preview/apply model assumptions; did not make V3 the Mesh Tool default. Explicit method is available headlessly / through operation payload. |
| `discussion/implementation/waves/wave63/wave63-domain-b-report.md` | Preserved V2 interim triangulation note and fallback chain pattern; V3 honestly records `interim-delaunay-envelope-filter`. |
| `.github/skills/implementation-orchestration/SKILL.md` and `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md` | Followed Gnome implementation role and left independent Review-Sylph review for parent orchestration. |
| `discussion/development_convention/source-file-organization-policy.md` | Added a separate V3 responsibility file and barrel-only export. `node scripts/check-source-organization.mjs` passed. |
| `discussion/development_convention/dependency-policy.md` | Added no dependencies or lockfile changes. `node scripts/check-dependencies.mjs` passed. |

## Intentionally Deferred Basis Items

- Full constrained triangulation is not implemented. V3 records `interim-delaunay-envelope-filter` and provenance includes `constrained-triangulation-deferred`.
- Robust polygon Boolean / offset dependency is not introduced. Cleanup uses deterministic radial padding plus convex-hull conservative envelope.
- Editor UI method selector / Mesh Tool default switch is deferred to avoid shared editor conflicts. V2 remains the editor default.
- Hole handling and multi-island envelope policy remain conservative; V3 selects the largest contour.
- No screenshot or pixel oracle was added. Human visual review remains future manual review.

## User Workflow Trace

```text
Headless / operation path
  -> generateMesh payload method: auto-outline-v3-envelope
  -> authoring-core createGeneratedMeshForDrawable
  -> createAutoOutlineV3EnvelopeMesh
  -> source: outline-v3-envelope-rgba
  -> quality metrics include envelope/provenance summary
  -> operation provenance records meshQuality:envelope* entries

Fallback path
  -> V3 failure
  -> auto-outline-v2
  -> auto-outline-v1
  -> bounds-grid
  -> fallback steps recorded with reasons
```

## Must-not Compliance Evidence

- No Parameter / Keyform implementation was intentionally edited by Domain C.
- No Camera Capture / external facade work was added.
- No Cubism reproduction claim, Cubism SDK/Core dependency, model parser, screenshot test, or pixel oracle was introduced.
- No new package dependency, lockfile change, or broad geometry library was added.
- V3 is not the editor default; existing V2 preview/apply default remains untouched.
- App/editor files were not modified by Domain C.

## Implementation Summary

- Added `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`.
- Extended `MeshGenerationMethod` with `auto-outline-v3-envelope`.
- Added generated source `outline-v3-envelope-rgba`.
- Added V3 fallback step support: `auto-outline-v3-envelope -> auto-outline-v2 -> auto-outline-v1 -> bounds-grid`.
- Extended quality metrics with optional `envelopeMetrics`.
- Extended operation payload schema to accept the explicit method.
- Extended operation provenance with V3 envelope metrics.
- Added focused authoring-core and operation-core tests for deterministic V3, V3/V2 counts, transparent-inside-envelope allowance, envelope-outside rejection, method routing, provenance, and fallback chain.
- Review loop 1 added:
  - V3-specific envelope failure falling back to V2 success.
  - independent test-side envelope sample checks derived from V3 boundary stable IDs, not only V3 summary fields.
  - V3 <= V2 count coverage across notched-tail and round-body fixtures at low / medium / high density.

## Fallback / Provenance / Metrics Summary

Representative notched fixture smoke check, density `medium`, 40 x 36:

| Metric | V2 | V3 |
|---|---:|---:|
| status | generated | generated |
| vertices | 44 | 30 |
| triangles | 51 | 42 |

V3 envelope summary from the same smoke check:

- `padding`: `2.94`
- `alphaArea`: `317`
- `envelopeArea`: `601.492472`
- `envelopeAreaRatio`: `1.897453`
- `selectedContourVertexCount`: `98`
- `simplifiedContourVertexCount`: `18`
- `envelopeBoundaryVertexCount`: `16`
- `supportRingCount`: `1`
- `interiorPointCount`: `1`
- `transparentSampleCount`: `184`
- `outsideTriangleSampleCount`: `0`
- `cleanupMode`: `convex-hull-envelope`
- `provenance`: `rgba-alpha-threshold > largest-alpha-contour > distance-curvature-simplification > centroid-radial-padding > convex-hull-cleanup > ordinary-delaunay-envelope-filter > constrained-triangulation-deferred`

Review loop 1 representative count matrix:

| Fixture | Density | V2 vertices / triangles | V3 vertices / triangles |
|---|---|---:|---:|
| notched-tail | low | 22 / 19 | 12 / 11 |
| notched-tail | medium | 44 / 51 | 30 / 42 |
| notched-tail | high | 73 / 102 | 33 / 48 |
| round-body | low | 33 / 28 | 17 / 16 |
| round-body | medium | 65 / 85 | 37 / 51 |
| round-body | high | 108 / 169 | 58 / 82 |

V3-specific fallback fixture:

- Input: tiny 3 x 4 opaque alpha block in 20 x 20 texture, density `high`.
- Direct V3 result: `failed`, reason `envelope-generation-failed`.
- Direct V2 result: `generated`.
- Routed result for `auto-outline-v3-envelope`: source `outline-v2-rgba`, fallback step `auto-outline-v3-envelope: envelope-generation-failed`, no V2 failure step.

Fallback chain logic for empty alpha:

```text
auto-outline-v3-envelope: alpha-empty
  -> auto-outline-v2: alpha-empty
  -> auto-outline-v1: alpha-empty
  -> bounds-grid
```

## Verification Commands and Results

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Sandbox result: failed to load config due `spawn EPERM`.
  - Escalated final result after review loop 1: passed, 2 files passed, 30 tests passed.
- `pnpm.cmd typecheck`
  - Passed.
- Local esbuild smoke check for V2/V3 algorithm only
  - Sandbox result: `spawn EPERM`; escalated rerun passed.
  - Result: V2 `44 vertices / 51 triangles`; V3 `30 vertices / 42 triangles`; V3 transparent samples `184`; outside envelope samples `0`.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- <Domain C tracked files>`
  - Passed with LF/CRLF warnings only.
- `Select-String -Path packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts,discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md -Pattern '[ \t]+$'`
  - No matches.

## Changed File List

Domain C changes:

- `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md`

Observed parallel / out-of-scope dirty worktree files not owned by Domain C include:

- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/authoring-core/src/parameter-mutations.ts`
- `packages/authoring-core/src/parameter-surface.ts`
- `packages/operation-core/src/operations/edit-keyform-key.ts`
- `packages/operation-core/src/operations/parameter-definition.ts`
- `packages/package-format/src/parameter-presets.ts`
- `packages/package-format/src/parameter-metadata.ts`

## Residual Risk Classification

- Residual risk: `medium`.
- Algorithm risk: `medium`, because the V3 envelope is a conservative convex-hull cleanup path, not robust polygon offset / Boolean cleanup or constrained triangulation.
- Verification risk: `low for focused Domain C coverage`, because focused vitest and root typecheck now pass. Broader integration still depends on independent Review-Sylph and final wave integration.

## User Decision Points / Provisional Assumptions

- Assumption: method name remains `auto-outline-v3-envelope`.
- Assumption: no new geometry dependency is allowed in this wave; conservative cleanup is acceptable.
- Decision needed later: whether and where to expose explicit V3 method selection in Mesh Tool UI.
- Decision needed later: whether V3 should ever become default after visual review and full tests pass.
- Review-Sylph still needs to review this implementation from source/diff once the parent session starts the independent review lane.
