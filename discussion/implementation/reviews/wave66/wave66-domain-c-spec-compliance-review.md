# Wave66 Domain C Spec Compliance Review

- Verdict: pass
- Review lane: Spec Compliance Review
- Target: `wave66-mesh-auto-outline-v2-6-soft-apron-sidecar`
- Reviewed implementation report: `discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`
- Reviewer: Review-Sylph

## Findings

No blocking spec-compliance findings.

Non-blocking observation: V2.6 uses ordered V2.5 soft-boundary vertices as the apron inner boundary rather than re-extracting a separate raw simplified alpha contour. This is acceptable for Wave66 because the plan explicitly asks to reuse/extract V2.5 helpers where appropriate and preserve V2.5 interior density, but it remains a visual-review risk before any future default switch.

Non-blocking observation: fan handling is achieved by explicit strip topology plus metrics/tests, not by a separate fan-rejection pass. The implementation avoids connecting apron triangles to far interior vertices and records bounded fan metrics, so this satisfies the Wave66 acceptance surface.

## Evidence Inspected

- Wave66 plan requires explicit V2.6 method and no default switch: `discussion/implementation/orchestration/wave66-plan.md:56` and `discussion/implementation/orchestration/wave66-plan.md:57`.
- Wave66 Domain C required capabilities and acceptance were reviewed: `discussion/implementation/orchestration/wave66-plan.md:376` through `discussion/implementation/orchestration/wave66-plan.md:396`.
- V2.6 design requires V2.5-like density, ratio apron, no far fan, and no V3-like envelope: `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md:15` through `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md:24`.
- V2.6 design describes 1-2 apron rings, explicit strip option, and bounded fan/edge goals: `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md:126` through `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md:184`.
- Preplan confirms sidecar scope, default V2.5, no Canvas renderer/evaluation changes, and focused package tests: `discussion/implementation/waves/wave66/wave66-preplan-mesh-v2-6-sidecar-inventory.md:24` through `discussion/implementation/waves/wave66/wave66-preplan-mesh-v2-6-sidecar-inventory.md:44`.
- Source evidence was inspected from `git diff -- packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`.
- The untracked V2.6 generator was read directly: `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts`.

## Requirement Classification

| Requirement | Classification | Source evidence | Review note |
|---|---|---|---|
| Explicit method `auto-outline-v2.6-soft-apron` | implemented | `packages/authoring-core/src/mesh-generation.ts:28`, `packages/authoring-core/src/mesh-generation.ts:34`, `packages/operation-core/src/payloads/model-edit.ts:150`, `packages/operation-core/src/payloads/model-edit.ts:158` | Method is exposed in authoring routing and operation payload schema. |
| V2.5 default must not be replaced | implemented | `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279`; no `auto-outline-v2.6-soft-apron` matches in `apps/editor/src` | Editor command default remains `auto-outline-v2.5-soft-boundary`. |
| Headless sidecar in package layers | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:92`, `packages/operation-core/src/operations/generate-mesh.ts:211` | Implementation is in `authoring-core` and `operation-core`; no Editor source change is required. |
| Reuse/extract V2.5 helpers where appropriate | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:95` | V2.6 starts from `createAutoOutlineV25SoftBoundaryMesh`. |
| Preserve V2.5-like sparse interior sampling | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:321` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:329`; test at `packages/authoring-core/src/mesh-generation.test.ts:399` | Base mesh vertices/triangles are copied and tests assert V2.5 interior point count is preserved. |
| Ratio-based apron padding | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:227` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:267` | Preset ratios are clamped from alpha bounds size. |
| 1-2 apron ring sampling or bounded strip | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:238`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:285` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:289` | Current implementation uses a deterministic 1-ring strip, which is inside the allowed 1-2 ring range. |
| Apron strip triangulation avoids long boundary-to-interior fans | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:386` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:405`; test at `packages/authoring-core/src/mesh-generation.test.ts:413` through `packages/authoring-core/src/mesh-generation.test.ts:423` | Apron triangles connect inner boundary/ring vertices, not arbitrary interior vertices. |
| Apron-aware long-edge / skinny filtering | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:360` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:372`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:481` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:491` | Degenerate, too-long, and too-skinny apron triangles are rejected; accepted near-threshold cases are counted. |
| Fan concentration bounded | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:350` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:353`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:409`; tests at `packages/authoring-core/src/mesh-generation.test.ts:409` and `packages/authoring-core/src/mesh-generation.test.ts:482` | Fan is bounded by construction and tested via metrics. |
| Bounded local gap refill if included | deferred by plan | `discussion/implementation/orchestration/wave66-plan.md:384`; `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:184` | Not included in this sidecar. Provenance records `local-gap-refill-deferred`; no global envelope fallback is introduced. |
| Quality metrics for V2.6 | implemented | `packages/authoring-core/src/mesh-quality-metrics.ts:64` through `packages/authoring-core/src/mesh-quality-metrics.ts:90`, `packages/authoring-core/src/mesh-quality-metrics.ts:165` | `MeshGenerationSoftApronMetrics` is attached to quality metrics. |
| Provenance for V2.6 | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:176` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:185`; operation formatting at `packages/operation-core/src/operations/generate-mesh.ts:416` through `packages/operation-core/src/operations/generate-mesh.ts:442` | Algorithm, base algorithm, ratios, counts, fan/edge metrics, and provenance are emitted to transform history. |
| Fallback chain `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid` | implemented | `packages/authoring-core/src/mesh-generation.ts:135` through `packages/authoring-core/src/mesh-generation.ts:266`; tests at `packages/authoring-core/src/mesh-generation.test.ts:705` through `packages/authoring-core/src/mesh-generation.test.ts:712` and `packages/operation-core/src/operations/generate-mesh.test.ts:497` through `packages/operation-core/src/operations/generate-mesh.test.ts:504` | Chain is present and recorded when fallback reaches bounds-grid. |
| Deterministic output | implemented | `packages/authoring-core/src/mesh-generation.test.ts:383` through `packages/authoring-core/src/mesh-generation.test.ts:388` | Test compares repeated V2.6 generation output for equality. |
| Headless visible source / algorithm / metrics | implemented | `packages/authoring-core/src/mesh-generation.test.ts:909` through `packages/authoring-core/src/mesh-generation.test.ts:920` | Headless wrapper exposes V2.6 source and `softApronMetrics`. |
| Coverage increase over V2.5 | implemented | `packages/authoring-core/src/mesh-generation.test.ts:402` through `packages/authoring-core/src/mesh-generation.test.ts:405` | Test asserts apron boundary area ratio exceeds V2.5 soft boundary ratio while staying bounded. |
| Non-V3-like boundedness | implemented | `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:296` through `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:300`; tests at `packages/authoring-core/src/mesh-generation.test.ts:405` and `packages/authoring-core/src/mesh-generation.test.ts:481` | Area ratio caps keep the apron local/bounded. |
| Bounded triangle increase | implemented | `packages/authoring-core/src/mesh-generation.test.ts:406`, `packages/authoring-core/src/mesh-generation.test.ts:480` | Tests cap triangle count increase ratio. |
| V2.5 tests remain passing | implemented | Orch-Sylph rerun evidence: `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts` passed, 24 tests | Existing focused file still passes with V2.6 additions. |
| Operation Core mutation boundary | implemented | `packages/operation-core/src/operations/generate-mesh.ts:211` through `packages/operation-core/src/operations/generate-mesh.ts:218`; operation policy basis `discussion/development_convention/operation-policy.md:87` | Generate mesh remains routed through Operation Core. |
| Operation provenance evidence | implemented | `packages/operation-core/src/operations/generate-mesh.test.ts:340` through `packages/operation-core/src/operations/generate-mesh.test.ts:354` | Operation test asserts transform history entries for source, algorithm, and metrics. |
| Schema / ID convention: no spaces in machine-readable method ID | implemented | `packages/operation-core/src/payloads/model-edit.ts:152` through `packages/operation-core/src/payloads/model-edit.ts:160`; policy `discussion/development_convention/schema-and-id-conventions.md:502` through `discussion/development_convention/schema-and-id-conventions.md:504` | New method ID uses no spaces and follows existing enum pattern. |
| Mesh Tool UI responsibilities | not relevant | `discussion/design/screen-design/components/mesh-tool.md:260` through `discussion/design/screen-design/components/mesh-tool.md:268`; no Editor selector was added | Domain C is headless/operation-addressable only. |

## Forbidden Scope Check

| Forbidden item | Classification | Evidence |
|---|---|---|
| Canvas Evaluation / Renderer changes by Domain C | implemented | `git diff --name-only -- packages/authoring-core packages/operation-core apps/editor` shows no Domain C Editor source changes; only unrelated `apps/editor/.dev-server.out.log` is tracked dirty. Untracked Canvas files are known unrelated Domain A work. |
| Editor default switch to V2.6 | implemented | Editor default remains V2.5 at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279`; `rg "auto-outline-v2\\.6-soft-apron" apps/editor/src` returned no matches. |
| Cubism reproduction claim / Cubism schema target | explicit non-goal | V2.6 design forbids Cubism reproduction at `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md:25` through `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md:32`; schema policy forbids Cubism schema targets at `discussion/development_convention/schema-and-id-conventions.md:567` through `discussion/development_convention/schema-and-id-conventions.md:590`. Changed Domain C mesh files contain no Cubism format/SDK references. |
| Broad geometry dependency | implemented | No dependency file change was part of the Domain C diff; Orch-Sylph rerun evidence says `node scripts/check-dependencies.mjs` passed. |
| Parameter / Keyform / Deformer UX changes | not relevant | The only `model-edit.ts` change is adding the V2.6 value to `GenerateMeshPayloadSchema`; no Parameter/Keyform/Deformer diff was present in the inspected patch. |

## Verification Evidence

I did not rerun the full test suite in this review lane. I used the Orch-Sylph rerun evidence supplied with the task:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`: passed, 1 file / 24 tests after escalated rerun.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`: passed, 1 file / 19 tests after escalated rerun.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`: exit 0, LF-to-CRLF warnings only.

## Residual Risks

- V2.6 is structurally conservative: it uses V2.5 soft-boundary output as the inner apron boundary. This reduces implementation blast radius and preserves V2.5 interior density, but human visual review should confirm it fixes the intended boundary gaps on real artwork.
- The current sidecar always uses one ring. The type and design allow 1-2 rings, but a later visual pass may need preset-specific two-ring behavior for wider aprons.
- Local gap refill is deliberately deferred. That is compliant with the conditional requirement, but future cases with localized protrusions may need a bounded refill pass before considering V2.6 as a default.

## Decision

Pass. Domain C satisfies the Wave66 V2.6 soft-apron sidecar requirements without switching Editor default, touching Canvas/renderer scope, adding dependencies, or making Cubism/format compatibility claims.
