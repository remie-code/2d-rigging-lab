# Wave71 Domain A Spec Compliance Review

- Verdict: `pass`
- Target: `wave71-adaptive-staggered-band-backend-default-route`
- Reviewer lane: Spec Compliance Review
- Scope note: Source, tests, and local diff were inspected directly. I did not modify source or tests. I did not independently rerun the recorded validation commands; the implementation report's validation section was used only as supporting evidence.
- Fix Loop 1 re-review note: I re-checked the current workspace after Gnome Fix Loop 1, including removal of the unused local-strip fallback reason, added density/strip probes, and the implementation report's scope note for pre-existing parent/Domain-B preparation diffs. The final verdict remains `pass`.

## Basis Documents Used

- `discussion/implementation/orchestration/wave71-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md`
- `discussion/design/mesh-generation/auto-outline-v6d-staggered-inner-strip.md`
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`
- `discussion/implementation/waves/wave70/wave70-final-integration-report.md`
- `discussion/implementation/reviews/wave70/wave70-final-clean-integration-review.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md`

## Compliance Matrix

| Requirement | Classification | Evidence |
|---|---|---|
| Add new method/source/backend IDs: `auto-outline-v6d-adaptive-staggered-band`, `outline-v6d-adaptive-staggered-band-rgba`, `v6d-adaptive-staggered-band`. | implemented | `packages/authoring-core/src/mesh-generation-contract.ts:13`, `:24`, `:35`, candidate at `:111`-`:113`. |
| Add new implementation file rather than rewriting Wave70 backend. | implemented | New file exports the backend at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:177`; Wave70 backend file is not in current modified file list. |
| Preserve Wave70 support-ring method/source/backend. | implemented | Wave70 IDs remain in contract at `packages/authoring-core/src/mesh-generation-contract.ts:12`, `:23`, `:34`, candidate at `:103`-`:105`; dispatch remains at `packages/authoring-core/src/mesh-generation.ts:179`. |
| Route new method through authoring dispatch. | implemented | Import and dispatch at `packages/authoring-core/src/mesh-generation.ts:28`, `:189`-`:190`; result wrapper at `:1456` and backend call at `:1475`. |
| Preserve current tuned density baselines. | implemented | Shared pipeline table remains high/medium/low at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:844`-`:864`; adaptive baseline table mirrors those values at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:145`-`:163`. |
| Resolve density deterministically from part size, using component area first and alpha-bounds area only as fallback. | implemented | Production resolver uses selected component pixels from the preliminary contour result at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:207`-`:211`; resolver chooses component area when positive and otherwise alpha-bounds area at `:524`-`:531`. |
| Avoid part-name, drawable-name, semantic image-recognition density rules. | implemented | Targeted search found no semantic/name/image density logic in the adaptive backend; only Editor candidate display uses drawable display names in `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:144`. |
| Keep Wave70 soft alpha contour/constrained triangulation lineage. | implemented | Adaptive backend reuses `createV6ContourCandidateInput` and Constrainautor recovery at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:186`, `:214`, `:263`-`:264`. |
| Build staggered inner points from alpha edge midpoints, not alpha vertices. | implemented | `findSafeStaggeredInnerPoint` computes `midpoint` from adjacent alpha points at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:1226`-`:1236`, then offsets from that midpoint at `:1276`-`:1277`; success provenance records the edge-midpoint ring at `:1160`. |
| Emit explicit alpha-to-inner strip triangles. | implemented | `createExplicitAlphaInnerStripTriangles` emits two triangles per alpha edge at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:1046`-`:1072`; tests assert explicit strip count at `packages/authoring-core/src/mesh-generation.test.ts:2627`-`:2631`. |
| Use staggered inner ring as ordinary interior-fill boundary and filter ordinary interior points inside it. | implemented | Interior points are filtered against `staggeredInnerPoints` at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:648`-`:650`; recovery input uses the staggered inner loop as the boundary at `:692`-`:713`. |
| Active strip diagnostics must show no direct alpha-to-ordinary-interior edges. | implemented | Final geometry counts direct alpha-to-ordinary-interior edges at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:834` and falls back if positive at `:312`-`:332`; operation tests assert `meshQuality:v6AdaptiveDirectAlphaToInteriorEdges=0` at `packages/operation-core/src/operations/generate-mesh.test.ts:522`-`:533`. |
| Fallback to Wave70 support-ring v6D before structured coarse fallback. | implemented | Adaptive failure calls `createWave70SupportRingFallback` at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:250`, `:278`, `:332`; that function calls Wave70 at `:927`-`:939` and appends Wave70 fallback steps only if Wave70 itself falls back at `:956`-`:961`. Fix Loop 1 fallback test coverage at `packages/authoring-core/src/mesh-generation.test.ts:2654`-`:2681`. |
| Public `v6d-adaptive-staggered-band-local-strip-omitted` fallback reason. | not relevant | Wave71 requires local reduced-offset/omission handling or Wave70 fallback, but does not require a public local-omission reason. Fix Loop 1 removed the unused public reason from the contract; current public adaptive reasons are only geometry-invalid and constraint-recovery-failed at `packages/authoring-core/src/mesh-generation-contract.ts:199`-`:200`, and Inspector only formats those at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:631`-`:633`. |
| Editor Mesh Tool preview/apply default route becomes new method. | implemented | `DEFAULT_MESH_GENERATION_METHOD` is the new method at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:62`-`:63`; preview passes it at `apps/editor/src/features/editor-session/editor-session-context.tsx:696`-`:724`; command default uses it at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:275`-`:281`. |
| Algorithm selector remains absent. | implemented | Visible selector negative assertions at `apps/editor/e2e/psd-import.e2e.spec.ts:261`-`:262`; state negative assertions at `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:39`-`:42`. Targeted source search found no selector implementation. |
| Preview/apply semantics remain unchanged: apply commits preview mesh and provenance. | implemented | Apply passes draft mesh and preview provenance at `apps/editor/src/features/editor-session/editor-session-context.tsx:744`-`:754`; Operation Core commits preview geometry without regeneration at `packages/operation-core/src/operations/generate-mesh.ts:105`-`:114`; tests cover geometry identity and provenance at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639`-`:730`. |
| Historical Wave70 / old v6D / v6E / v6F provenance remains display-safe. | implemented | Inspector maps old and new source/method/backend IDs at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:512`-`:518`, `:558`-`:564`, `:663`-`:665`; legacy preview cases are tested at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639`-`:730`. |
| Operation payload/provenance schema accepts new diagnostics. | implemented | Payload schema includes adaptive diagnostics at `packages/operation-core/src/payloads/model-edit.ts:208`-`:229` and wires it into v6 metrics at `:297`; transform history formatter emits adaptive fields at `packages/operation-core/src/operations/generate-mesh.ts:600`-`:631`. |
| Schema/ID convention: machine-readable IDs contain no spaces. | implemented | Added method/source/backend/fallback IDs are kebab-case in `packages/authoring-core/src/mesh-generation-contract.ts:13`, `:24`, `:35`, `:199`-`:201`, consistent with no-space policy in `discussion/development_convention/schema-and-id-conventions.md:123`-`:139`. |
| Do not introduce public v6G IDs. | implemented | Targeted source search over `packages/authoring-core/src`, `packages/operation-core/src`, `apps/editor/src`, and `apps/editor/e2e` found no production `auto-outline-v6g` or `outline-v6g`; only negative test assertions mention `v6g`. |
| Do not restore algorithm selector UI. | explicit non-goal | Wave71 plan marks selector restoration out of scope; implementation keeps only product-facing presets at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:40`-`:58`. |
| Side-by-side visual diff UI and broader visual tuning. | explicit non-goal | Wave71 plan lists visual diff UI out of scope; implementation report carries visual quality as residual risk, not pass evidence. |
| Pre-existing map/design/orchestration prep diffs. | not relevant | Implementation report records these as pre-existing parent/Domain-B-owned preparation diffs excluded from Domain A changed files at `discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md:8`-`:11` and `:30`-`:31`. That scope note is acceptable for this spec lane because those docs do not change the Domain A backend/default-route implementation semantics under review. |
| Focused validation commands from implementation report. | implemented | Report records focused authoring-core, operation-core, editor unit, typecheck, source-organization, dependency, and diff-check results at `discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md:87`-`:101`; this review did not rerun them. |

## Fix Loop 1 Re-Review

- Removal of `v6d-adaptive-staggered-band-local-strip-omitted` does not violate Wave71 spec. The design permits local reduced-offset attempts and fallback when the full strip is not safe; it does not require a stable public fallback reason for partial local omission. Current behavior remains reduced-offset attempts, then Wave70 support-ring fallback before coarse fallback.
- The implementation report's scope note for pre-existing `discussion/design/mesh-generation/_map.md`, `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, and untracked Wave71 prep docs is acceptable for Domain A spec compliance. Those changes are parent/Domain-B preparation artifacts and do not alter the reviewed source/test behavior.
- Added tests/probes strengthen the previous pass conclusion: high/medium/low density baselines and alpha-bounds fallback are asserted at `packages/authoring-core/src/mesh-generation.test.ts:2443`-`:2518`; coordinate/topology-level staggered strip probing is asserted at `:2521`-`:2567`; preview provenance diagnostics are covered at `packages/operation-core/src/operations/generate-mesh.test.ts:946`-`:990`.

## Findings

No blocking or required-change findings.

## User-Decision Points

None for Wave71 Domain A spec compliance.

## Residual Risks

- Visual quality remains a residual risk. The implementation proves deterministic routing, adaptive density, explicit strip topology, direct-edge diagnostics, and fallback ordering, but not final quality on broad real artwork.
- Alpha-bounds density fallback is now both source-inspected at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:524`-`:531` and covered by Fix Loop 1 tests at `packages/authoring-core/src/mesh-generation.test.ts:2456`-`:2516`.
- The implementation uses local reduced-offset attempts for staggered inner points and falls back to Wave70 if the full staggered ring remains invalid. Partial local strip omission as a generated output mode remains a possible future product/design decision, not a Domain A spec blocker.
