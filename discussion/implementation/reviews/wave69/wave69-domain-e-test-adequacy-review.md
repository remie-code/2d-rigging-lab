# Wave69 Domain E Test Adequacy Review

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-editor-v6d-v6e-v6f-selector-final-integration`
- Review lane: Test Adequacy
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Basis and artifacts reviewed directly:

- `discussion/implementation/orchestration/wave69-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- Domain A-D reports under `discussion/implementation/waves/wave69/`
- Domain A-D review artifacts under `discussion/implementation/reviews/wave69/`
- `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md`

Tests and source reviewed directly:

- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts`
- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- Relevant production source in `mesh-tool-state.ts`, `editor-session-context.tsx`, `mesh-tool-inspector.tsx`, `mesh-generation-contract.ts`, `mesh-generation.ts`, and `generate-mesh.ts`.

## Basis Used

- Domain E must keep the default method on `auto-outline-v2.6-soft-apron`, expose visible v6D/v6E/v6F comparison choices, remove v6A/v6B/v6C from current visible choices, preserve preview to Apply provenance, and keep the selector temporary.
- Backend tests must show v6D/v6E/v6F route/status/provenance, distinguish backend output from fallback/blocked output, and avoid exact triangle-layout overfit.
- Operation provenance must carry method/source/backend/output metadata for backend output and blocked/fallback paths.
- Browser validation should be semantic, not screenshot or pixel-oracle based.
- Final backend selection and visual-quality judgment remain deferred by Wave69.

## Coverage Matrix

| Requirement / risk | Coverage status | Evidence |
|---|---|---|
| Default remains v2.6 | Covered | `DEFAULT_MESH_GENERATION_METHOD` remains `auto-outline-v2.6-soft-apron` in `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73`; command default remains v2.6 in `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274`. Unit test asserts default option and resolver behavior in `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:11`. |
| Visible selector is default + v6D/v6E/v6F only | Covered | Production options are default, v6D, v6E, v6F in `mesh-tool-state.ts:79`; test asserts exact methods and excludes v6A/B/C in `mesh-tool-state.test.ts:22`. Inspector renders from `MESH_GENERATION_BACKEND_OPTIONS` in `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:289`. |
| Legacy v6A/B/C are not current visible choices | Covered | Selector test excludes v6A/B/C at `mesh-tool-state.test.ts:31`. The inspector still formats legacy provenance strings at `mesh-tool-inspector.tsx:533` and `mesh-tool-inspector.tsx:556`, but those are not selector options. |
| Preview to Apply preserves v6D/v6E/v6F mesh and provenance | Covered | Editor command test loops over v6D/v6E/v6F methods/sources/backends at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:686`, creates previews with each method at `:721`, asserts backend-output metrics at `:729`, commits the preview mesh at `:736`, checks committed geometry equals preview geometry at `:752`, and checks transform history for method/source/backend/output at `:758`. Context code passes draft source/fallback/quality metrics into Apply at `apps/editor/src/features/editor-session/editor-session-context.tsx:690`. |
| Preview does not rely on committed mutation before Apply | Covered by semantic flow | Context stores draft mesh separately at `editor-session-context.tsx:674`; Apply commits through `commitGenerateMesh` only at `:696`. E2E observes draft status before Apply and committed status after Apply in `apps/editor/e2e/psd-import.e2e.spec.ts:254` and `:308`. |
| Inspector distinguishes backend output, fallback, counts, regions, and backend diagnostics | Covered | Inspector renders source/fallback at `mesh-tool-inspector.tsx:189`, v6 backend/output kind at `:205`, v6 counts/fallback steps/regions/rejected counts at `:212`, v6D/v6E/v6F diagnostics at `:227`, `:239`, and `:251`. |
| Authoring registry/status reconciles v6D/v6E/v6F to implemented | Covered | Canonical candidate registry marks v6D, v6E, and v6F implemented in `packages/authoring-core/src/mesh-generation-contract.ts:88`, `:96`, and `:104`; test asserts the full registry in `packages/authoring-core/src/mesh-generation.test.ts:1097`. |
| Authoring public route dispatches v6D/v6E/v6F | Covered | `createGeneratedMeshForDrawable` dispatches v6D/v6E/v6F before generic fallback in `packages/authoring-core/src/mesh-generation.ts:167`, `:177`, and `:187`. v6E route reads canonical candidate status via `getV6MeshGenerationCandidate` at `:1173`. |
| v6D backend output route/provenance | Covered | Public test covers deterministic v6D output for representative fixtures, source, DTO validity, implemented/backend-output metrics, shared contour provenance, no old earclip/fan/split provenance, and constraint diagnostics in `packages/authoring-core/src/mesh-generation.test.ts:1832`. |
| v6D blocked and filter risks | Covered enough for Wave69 | v6D outside/crossing filter probe asserts removed invalid triangles and no remaining outside/crossing triangles in `mesh-generation.test.ts:1921`. Empty/missing input blocked metadata is covered in `mesh-generation.test.ts:2670`. |
| v6E backend output and fallback route/provenance | Covered | Dedicated v6E test covers deterministic backend output, source, implemented/backend-output metrics, Poly2Tri diagnostics, Steiner counts, provenance, and no v6A triangulation provenance in `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts:21`. Public route test covers v6E backend output in `mesh-generation.test.ts:2356`; hole-like visible fallback-output metadata is covered in `mesh-generation.test.ts:2437`; empty/missing blocked metadata is covered in `mesh-generation.test.ts:2498`. |
| v6E failure branches | Covered | Dedicated v6E probes cover invalid polygon, triangulation throw, boundary-missing blocked output, winding normalization, quantization, and dedupe in `mesh-generation-v6e-contour-poly2tri.test.ts:127`, `:201`, and `:266`. |
| v6F backend output route/provenance | Covered | Dedicated v6F test covers deterministic backend output over rectangle, curved, thin tapered, and hole-like fixtures, source, implemented/backend-output metrics, point participation, boundary preservation, and custom diagnostics in `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts:24`. Public blocked metadata is also asserted in `mesh-generation.test.ts:2891`. |
| v6F custom quality diagnostics | Covered enough for Wave69 | Long-spoke candidate count and no final long boundary chords on the rectangle fixture are asserted in `mesh-generation-v6f-custom-cdt.test.ts:109`. This is a property check, not an exact triangle layout oracle. |
| Operation Core backend-output provenance for v6D/v6E/v6F | Covered | Operation test iterates v6 candidates and, for implemented candidates, asserts common v6 provenance in `packages/operation-core/src/operations/generate-mesh.test.ts:405`. v6D, v6E, and v6F backend-specific provenance is asserted at `:475`, `:512`, and `:532`. Formatting source writes method/backend/status/source/output/fallback fields in `packages/operation-core/src/operations/generate-mesh.ts:487`. |
| Operation Core blocked metadata for v6D/v6E/v6F | Covered | Empty-alpha blocked provenance for all three new contour candidates is covered in `generate-mesh.test.ts:597`; missing-texture blocked provenance is covered at `:645`; backend-specific zero diagnostics are checked by `expectBlockedBackendProvenance` at `:1080`. |
| Operation Core fallback-output paths | Acceptable residual | Authoring-core covers v6E hole-like fallback-output at `mesh-generation.test.ts:2437`. Operation-core does not separately force a v6E hole-like commit or custom v6D/v6F backend failure fallback-output. This is acceptable before final backend selection because operation formatting is data-driven from v6 metrics, and operation tests cover all three backend-output and blocked propagation paths. |
| Playwright PSD import to mesh preview/apply is semantic, not visual-pixel based | Covered | E2E uses locators, text, ARIA buttons, and data attributes for preview/apply state. It checks selector content at `apps/editor/e2e/psd-import.e2e.spec.ts:259`, clicks v6D at `:269`, returns to default at `:273`, checks overlay status/count attributes at `:275`, and applies/cancels/regenerates through `:308`. No screenshot or pixel comparison oracle is used. |
| E2E stability for v6E/v6F selector choices | Covered by visibility plus unit/model tests | E2E asserts v6E/v6F labels are visible and v6A/B/C labels are absent at `psd-import.e2e.spec.ts:263`. It only clicks v6D as the browser sidecar smoke; v6E/v6F preview/apply provenance is covered by the editor command test at `editor-session-commands.test.ts:686`. |
| Avoid exact triangle-layout overfit | Covered | The v6 tests primarily assert determinism, DTO validity, counts, source/method/backend/output metadata, provenance, and property checks. The exact triangle expectation in the v6D filter probe at `mesh-generation.test.ts:1956` is scoped to a test-only filter probe, not a production route layout oracle. |

## Findings

No blocking or required-change findings.

Informational residuals:

| ID | Severity | Finding | Evidence | Disposition |
|---|---|---|---|---|
| E-TA-I-001 | informational | Operation-core coverage proves v6D/v6E/v6F backend-output and blocked provenance, but does not force every backend-specific fallback-output branch, such as v6E hole-like fallback-output or v6D/v6F algorithmic non-success fallback-output. | Operation backend-output: `packages/operation-core/src/operations/generate-mesh.test.ts:475`, `:512`, `:532`; operation blocked paths: `:597`, `:645`; authoring v6E fallback-output: `packages/authoring-core/src/mesh-generation.test.ts:2437`. | Acceptable for Domain E. Add operation-level fallback-output fixtures before promoting a final backend if operation provenance becomes a release gate. |
| E-TA-I-002 | informational | Browser E2E clicks v6D as the only v6 sidecar preview, while v6E/v6F are asserted visible but not browser-clicked. | E2E selector visibility and v6D click: `apps/editor/e2e/psd-import.e2e.spec.ts:263`, `:269`; editor command all-candidate preview/apply loop: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:686`. | Acceptable. Unit/model tests cover v6E/v6F preview/apply semantics, and the E2E remains a stable semantic smoke rather than a broad browser matrix. |

## Residual Test Gaps

- No blocker: operation-core does not directly exercise v6E hole-like fallback-output or forced v6D/v6F algorithmic fallback-output commits. Authoring-core covers backend-specific fallback semantics, and operation-core covers all three candidates for backend-output plus blocked propagation.
- No blocker: the Playwright test does not click v6E and v6F. It verifies visible choices and absence of v6A/B/C, while editor command tests cover all three candidate preview to Apply paths.
- Accepted before final backend selection: automated tests do not replace human visual comparison of v6D/v6E/v6F. This matches Wave69 scope.
- Accepted before final backend selection: v6F custom triangulation still lacks a forced custom non-success fixture for selected-point-unused or constraint-recovery failure; Domain D test adequacy already recorded this as a promotion-time risk, not a Domain E blocker.

## Validation Evidence

Required validation is recorded as run and passing, with sandbox failures explicitly rerun outside sandbox where needed:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Sandbox failed with esbuild `spawn EPERM`; outside-sandbox rerun passed: 4 files / 99 tests. Also recorded in Domain E report at `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md:81`. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts --reporter=dot` | Outside-sandbox rerun passed: 3 files / 62 tests, per Orch-Sylph validation summary. |
| `pnpm.cmd typecheck` | Passed; Domain E report records this at `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md:82`. |
| `pnpm.cmd test:e2e:psd-import --grep "generates an initial mesh draft"` from `apps/editor` | Sandbox failed with EPERM unlink; outside-sandbox rerun passed: 1 semantic Playwright test, per Orch-Sylph validation summary. Domain E report records the passed focused E2E at `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md:83`. |
| `node scripts/check-source-organization.mjs` | Passed; recorded in Domain E report at `:84`. |
| `node scripts/check-dependencies.mjs` | Passed; recorded in Domain E report at `:85`. |
| `git diff --check -- apps/editor packages/authoring-core packages/operation-core packages/render-webgl2 discussion` | Passed with CRLF working-copy warnings only, per Orch-Sylph validation summary. Domain E report records scoped diff check pass at `:86`. |

I did not rerun the validation commands in this review lane. I inspected the tests/source/artifacts directly and used the provided Orch-Sylph validation summary plus Domain E report validation records as run evidence.

## Required Fixes

None.

## User-Decision Points

None blocking Domain E test adequacy.

Future user decisions remain outside this review lane:

- Choose whether v6D, v6E, v6F, or none should become the future default after visual comparison.
- Decide whether v6E's visible hole-like fallback is acceptable before any promotion.
- Decide whether v6F's custom v0 triangulation quality is sufficient despite the recorded geometry risk.
- Decide when to remove or hide the temporary backend selector after final backend selection.

## Verdict

`pass`

Domain E has adequate test and validation coverage for selector integration, default preservation, preview to Apply provenance, v6D/v6E/v6F route/status/provenance, semantic PSD import preview/apply stability, and the known integration risks. Remaining gaps are acceptable for Wave69 comparison-candidate status and should be revisited before selecting or promoting a final backend.
