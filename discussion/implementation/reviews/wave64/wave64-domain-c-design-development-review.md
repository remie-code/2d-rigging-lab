# Wave64 Domain C Design / Development Compliance Review

## Verdict

`pass`

Design / Development compliance passes for Domain C. No blocking or needs-change finding was found in the V3 mesh sidecar implementation.

Review loop 2 final delta verdict remains `pass`. The added tiny-alpha V3 envelope failure path is conservative, deterministic, covered by focused tests, and uses the existing V3 -> V2 fallback routing without adding dependencies or changing editor defaults.

## Scope Reviewed

Domain:

- Wave: 64
- Domain C id: `wave64-mesh-auto-outline-v3-envelope-sidecar`
- Objective: Mesh `auto-outline-v3-envelope` Headless Sidecar

Files reviewed:

- `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md`

Shared-file note:

- Parallel Parameter / Keyform changes are present in shared files, especially `packages/authoring-core/src/index.ts:10`, `packages/authoring-core/src/index.ts:15`, `packages/authoring-core/src/index.ts:40`, and `packages/operation-core/src/payloads/model-edit.ts:205`.
- Per review instruction, these were treated as parallel Domain A/B/D diffs and were not used as Domain C scope-violation evidence.

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

No blocking or needs-change findings.

## Review Loop 2 Final Delta Check

Reviewed updated files:

- `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md`

Pass evidence:

- Tiny-alpha handling is a V3-only conservative guard: `minEnvelopeAlphaArea` is part of the V3 config in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:80` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:92`, and alpha areas below that threshold return `envelope-generation-failed` with `alphaBounds` in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:118` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:127`.
- The threshold is fixed and deterministic across density configs in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:263` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:326`.
- No new operation routing was needed. The existing explicit-method V3 path tries V2 after any V3 failure, records only the V3 failure step when V2 succeeds, and returns V2 quality metrics with `fallbackReason` in `packages/authoring-core/src/mesh-generation.ts:136` to `packages/authoring-core/src/mesh-generation.ts:163`.
- Authoring-core tests now prove the tiny-alpha case directly: V3 fails with `envelope-generation-failed`, V2 succeeds, and routed `auto-outline-v3-envelope` returns `outline-v2-rgba` with one V3 fallback step in `packages/authoring-core/src/mesh-generation.test.ts:436` to `packages/authoring-core/src/mesh-generation.test.ts:478`.
- Operation-core tests now prove provenance for the same case: the operation records `generateMesh:auto-outline-v3-envelope`, `meshSource:outline-v2-rgba`, `fallback:auto-outline-v3-envelope:envelope-generation-failed`, and no `fallback:auto-outline-v2:*` entry in `packages/operation-core/src/operations/generate-mesh.test.ts:318` to `packages/operation-core/src/operations/generate-mesh.test.ts:346`.
- The Domain C report records the same tiny-alpha fixture and updated verification evidence in `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md:113` to `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md:145`.

## Pass Evidence

### Source Organization

- V3 production logic is in a named responsibility file, `mesh-outline-v3-envelope-generation.ts`, rather than `index.ts` or a catch-all helper file.
- `packages/authoring-core/src/index.ts:25` to `packages/authoring-core/src/index.ts:29` remains barrel-only for the mesh exports, including the V3 export at line 28.
- The V3 file is large, but it is cohesive: one headless algorithm owns alpha mask extraction, contour simplification, envelope construction, sampling, triangulation/filtering, metrics, and mesh DTO creation. This matches the Wave64 inventory recommendation to prefer an isolated V3-owned file over broad V2 refactoring during the sidecar wave.
- `node scripts/check-source-organization.mjs` passed.

### Dependency Policy

- No `package.json` or `pnpm-lock.yaml` changes were present for this review scope.
- V3 imports only existing workspace contracts/package types and local mesh modules in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:1` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:10`.
- No new geometry, polygon offset, triangulation, Cubism SDK/Core, parser, binary, or asset dependency was introduced.
- `node scripts/check-dependencies.mjs` passed.

### Scope Discipline

- No app/editor file is changed by Domain C. Existing editor preview/apply defaults remain `auto-outline-v2` in `apps/editor/src/features/editor-session/editor-session-context.tsx:363` and `apps/editor/src/features/editor-session/editor-session-context.tsx:398`, and the command default remains `auto-outline-v2` in `apps/editor/src/features/editor-session/model/editor-session-commands.ts:269`.
- The V3 implementation adds no Camera Capture, external transport/facade, Cubism reproduction claim, screenshot/pixel oracle, semantic auto-selection, or editor default switch.
- A forbidden-scope grep over V3-relevant files found no Cubism/model-format/Camera/external/pixel-oracle/default-V3 matches. The only `semantic` match was unrelated parallel Parameter schema text in `packages/operation-core/src/payloads/model-edit.ts:188`.

### Operation / Payload Alignment

- `GenerateMeshPayloadSchema` accepts the explicit method `auto-outline-v3-envelope` in `packages/operation-core/src/payloads/model-edit.ts:150` to `packages/operation-core/src/payloads/model-edit.ts:161`.
- Operation preview validation recognizes the method in `packages/operation-core/src/operations/generate-mesh.ts:211` to `packages/operation-core/src/operations/generate-mesh.ts:216`.
- Direct operation execution passes the payload method into `createGeneratedMeshForDrawable` in `packages/operation-core/src/operations/generate-mesh.ts:110` to `packages/operation-core/src/operations/generate-mesh.ts:116`.
- Operation provenance includes method/source/fallback/quality history through `createMeshProvenanceRecord` and `formatEnvelopeMetricsForTransformHistory` in `packages/operation-core/src/operations/generate-mesh.ts:323` to `packages/operation-core/src/operations/generate-mesh.ts:381`.

### Public Exports / Module Boundaries

- Authoring-core exposes V3 through the package barrel only at `packages/authoring-core/src/index.ts:28`.
- The V3 algorithm is called from mesh generation routing, not from operation-core or editor UI directly: `packages/authoring-core/src/mesh-generation.ts:116` to `packages/authoring-core/src/mesh-generation.ts:134`.
- Operation-core remains responsible for operation preconditions, commit/dry-run mutation, and provenance formatting; it does not embed V3 geometry logic.

### Determinism / Stable Ordering

- V3 uses deterministic config by density hint in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:263` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:326`.
- Sampling seed is derived from drawable id, texture dimensions, density hint, and threshold in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:940` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:947`.
- Point, edge, contour, and triangle ordering are explicitly sorted in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:1246` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:1275`.
- Stable IDs include the V3 algorithm identity and point kind in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:900` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:929`.

### Fallback / Provenance / Metrics Shape

- V3 success returns source `outline-v3-envelope-rgba` and quality metrics in `packages/authoring-core/src/mesh-generation.ts:127` to `packages/authoring-core/src/mesh-generation.ts:134`.
- V3 failure falls back through V2, V1, then bounds grid with ordered fallback steps in `packages/authoring-core/src/mesh-generation.ts:136` to `packages/authoring-core/src/mesh-generation.ts:214`.
- Texture-byte-unavailable fallback includes V3 and V2 fallback steps when the explicit V3 method was requested in `packages/authoring-core/src/mesh-generation.ts:344` to `packages/authoring-core/src/mesh-generation.ts:369`.
- V3 metrics include algorithm id, preset, alpha/envelope area, boundary/support/interior counts, transparent-inside-envelope samples, outside-envelope samples, cleanup mode, and provenance in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:222` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:250`.
- The shared quality metrics type was extended with optional `envelopeMetrics`, keeping V2/V1 consumers compatible in `packages/authoring-core/src/mesh-quality-metrics.ts:3` to `packages/authoring-core/src/mesh-quality-metrics.ts:37`.

### Conservative Geometry Implementation

- Envelope creation uses deterministic centroid-radial padding with reduced-padding attempts and convex-hull cleanup, not a new unapproved polygon dependency, in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:506` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:554`.
- Support ring sampling is optional by config and constrained inside the envelope in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:608` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:652`.
- Ordinary Delaunay plus envelope filtering is explicitly used as an interim path in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:708` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:715`.
- Triangle filtering rejects outside-envelope samples while allowing transparent samples inside the envelope through separate counters in `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:808` to `packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:881`.

### Test / Summary Shape

- Authoring tests assert deterministic V3 output, V3 counts not greater than V2 on the representative fixture, independent transparent/outside-envelope sampling checks, support ring presence, stable ID identity, and envelope metrics shape in `packages/authoring-core/src/mesh-generation.test.ts:225` to `packages/authoring-core/src/mesh-generation.test.ts:272`.
- Expanded authoring tests cover V3/V2 count ordering across representative fixtures and all densities in `packages/authoring-core/src/mesh-generation.test.ts:274` to `packages/authoring-core/src/mesh-generation.test.ts:330`.
- Authoring routing tests cover V3 explicit method, empty-alpha fallback chain, and the V3-specific tiny-alpha fallback-to-V2 path in `packages/authoring-core/src/mesh-generation.test.ts:418` to `packages/authoring-core/src/mesh-generation.test.ts:478`.
- Operation tests cover V3 provenance metrics, V3-specific fallback-to-V2 provenance, and empty-alpha fallback chain in `packages/operation-core/src/operations/generate-mesh.test.ts:283` to `packages/operation-core/src/operations/generate-mesh.test.ts:379`.

## Verification Considered / Run

Run:

- `node scripts/check-source-organization.mjs`
  - Result: passed.
- `node scripts/check-dependencies.mjs`
  - Result: passed.
- `git diff --check -- <tracked Domain C files>`
  - Result: no whitespace errors; Git emitted LF-to-CRLF working-copy warnings only.
- `Select-String -Path packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts,discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md -Pattern '[ \t]+$'`
  - Result: no matches.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Sandbox result: failed before config load with `spawn EPERM`.
  - Escalated rerun result after review loop 2: passed, 2 files passed, 30 tests passed.
- `pnpm.cmd typecheck`
  - Result after review loop 2: passed.

## Residual Risks

- Algorithm risk remains medium: V3 uses convex-hull cleanup and ordinary Delaunay plus envelope filtering, not robust polygon Boolean offset or constrained triangulation. This is aligned with the sidecar scope but should not be overclaimed.
- The tiny-alpha V3 guard is intentionally conservative and may send very small opaque regions to V2 even when V3 could theoretically produce an envelope. This is acceptable for Domain C because it preserves successful mesh generation and records the V3 fallback reason.
- The V3 implementation file is sizeable. It is acceptable for this isolated sidecar, but future waves should consider extracting shared mesh geometry helpers only after V3 behavior stabilizes.
- Focused Domain C tests and root typecheck now pass after review loop 2.
- Shared files contain parallel Domain A/B/D changes. This review separated the V3 deltas from those changes, but final integration should re-review the combined state.

## User-Decision Points / Provisional Assumptions

- Assumption: `auto-outline-v3-envelope` remains the accepted machine-readable method name.
- Assumption: no new geometry dependency is allowed in this wave; conservative fallback/cleanup is acceptable.
- Decision deferred outside Domain C: whether V3 should be exposed in Mesh Tool UI as a selectable method.
- Decision deferred outside Domain C: whether V3 should ever replace V2 as the editor default after visual review and full validation.
