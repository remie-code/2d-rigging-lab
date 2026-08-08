# Map Update Semantic Review

> Review-only semantic audit of the map-update batch at `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08.  This report is the only file written by this review; no map, source, test, configuration, stage, or commit was changed.

## Verdict

**Final verdict: pass (0 blocking, 0 non-blocking remaining).** The initial pass found 0 blocking and 3 non-blocking wording findings; all three were corrected and re-verified below.

The updated maps preserve the accepted Private baseline, four-track split, Wave102 Editor-mainline stop, and the specialized post-102 boundary.  No human/device/external/legal/product gate was found falsely completed.  The findings below are reader-safety qualifications: each map has nearby evidence that prevents a false implementation claim, but the current wording can still be read as a current semantic or product-quality oracle.

## Review basis and information-type separation

- Contract: `map-update-contract.md` (leaf-first order, parent-lightweight rule, historical-map rule, and gate separation).
- Durable evidence: audits/integration reports `10`, `11`, `40`–`43`, `50`, `51`, `60`–`62`, `90`; updater reports `110`–`123`.
- Repository facts were checked against the changed product/AC/scenario, design/UI, mesh/render/performance, model-authoring, Electron, AI, Expo/archive, implementation, and Runtime Player maps.  Root `discussion/_map.md` was intentionally excluded because it is a later owner stage.
- **Decisions preserved:** Private Authoring-to-Viewer Prototype, four tracks, Wave102 stop, `worldFrameChainV1` / `dynamics-file-v3` as the current dynamics owner, v6d default + v7 comparison hold, WebGL2 primary + Canvas2D fallback, Skyline default, `apps/soul` exception, and Wave103–109 specialized scope.
- **Repository facts kept distinct from gates:** implementation/review passes are not device or product acceptance; Wave21 Domain C remains pending; Wave22/23 real iFacialMocap/vowel-rig checks remain open; S8 kill/restore, brain-swap, and stream-memory human gates remain open; Electron PSD E2E/typecheck/unit/metadata debts remain open; Expo acceptance/proof-print/rights gates remain open; Cubism archives remain historical/private.

## Findings

### N-01 — v6d technical route can read as quality acceptance

- **Location:** `discussion/design/mesh-generation/_map.md:24`.
- **Observation:** The v6d row says `Accepted current mainline / implementation-proven by visual check and focused tests`, while the same map at `:36-39` records the v6/v7 round-2 result as “one long, one short,” leaves quality unresolved, and keeps the v6 deletion/Wave 2 decision unapproved.  Audit `41-mesh-and-rendering.md` §2–§3 and updater `112-mesh-render-perf-map-update.md` §3 treat the implementation/default route and the product-quality/toggle decision as separate.
- **Risk:** A reader may treat “visual check” or “Accepted” as a product-quality/user gate, despite the explicit hold immediately below.
- **Correction owner:** `112-mesh-render-perf-map-update.md` (mesh/render/performance map owner).  Qualify the row as a technical/default route and link the still-open v6/v7 quality and toggle-lifetime gate.
- **Severity:** Non-blocking; surrounding lines already preserve the hold and no gate is marked complete.

### N-02 — Wave107 design entry is not explicitly historical/superseded

- **Location:** `discussion/design/_map.md:24`.
- **Observation:** The entry describes nearest-reference/argmax vowel mapping as `Implemented` (Wave107) and only says the real-device gate is waiting.  The following entries at `:25-26` carry Wave22 and Wave23, but the Wave107 row does not say it is historical or that current live semantics are owned by Wave22/23.  Audits `40-model-authoring.md` §4, `60-editor-integration.md`, and `62-cross-topic-integration.md` §2/§7 explicitly state that Wave107 is runtime-player-only historical evidence and that Wave22/23 supersede it (`w -> s`, normalized five-vowel blend).
- **Risk:** A current design reader can select the Wave107 nearest-reference/single-winner behavior instead of the Wave22/23 current runtime behavior.  The linked design document header and the adjacent rows provide the corrective context, so this is a clarity issue rather than a missing implementation fact.
- **Correction owner:** `120-design-parent-update.md` (design parent map owner).  Mark the Wave107 entry historical/specialized and point current live semantics to the Wave22/23 maps.
- **Severity:** Non-blocking; the current Wave22/23 rows and open real-device gate are already present.

### N-03 — Wave81 dynamics v2 wording is unqualified in implementation parent maps

- **Locations:** `discussion/implementation/_map.md:50` and `discussion/implementation/orchestration/_map.md:139`.
- **Observation:** Both parent maps’ `Current Decision` prose says Wave81 delivered `dynamics-file-v2`, additive semantics, one-output ownership, and multi-output out of scope.  Those are accurate Wave81 closeout facts, but the rows lack the historical/superseded qualifier that appears in the Wave81 leaf (`discussion/implementation/waves/wave81/_map.md:5`) and in current design/module maps.  Audits `60-editor-integration.md` C01/C02 and `62-cross-topic-integration.md` §2/§7, plus Wave106 evidence, establish `worldFrameChainV1` / `dynamics-file-v3` as the current replacement.
- **Risk:** Because the section is titled `Current Decision`, a reader may use the old scalar/one-output contract as current implementation guidance.  The parent’s later Wave102/specialized boundary text and the v3 design owner prevent a factual contradiction, but the hierarchy is unnecessarily ambiguous.
- **Correction owner:** `121-implementation-parent-update.md` (implementation parent/orchestration owner).  Label these rows as Wave81-era historical evidence or collapse them to a child-map pointer with the Wave106 current-owner route.
- **Severity:** Non-blocking; no current owner map or AC/scenario map promotes v2, and Wave106 is already indexed as the replacement.

## Positive semantic checks

- Product, AC, and scenario maps now keep requirement-oracle duties separate from dynamics implementation semantics, preserve unresolved v3 traceability, and do not reintroduce the old one-output/scalar oracle.
- Mesh/render maps separate v6/v7 quality hold from Wave67/108/109 renderer/data-contract implementation; Atlas Runtime, GPU/readPixels parity, Canvas2D sunset, and `original` inset checks remain open.
- Runtime W21–23 maps separate Domain A/B or source/review pass from Domain C and real-device/OBS/iFacialMocap gates; no universal 60 FPS or deep-profiler claim was introduced.
- Electron maps say WS1–WS4/packaging are complete while retaining PSD E2E, typecheck/unit, portable dead-branch, and metadata debts.
- AI maps preserve C1–C7 closure, S1–S7 implementation, S8 kill/restore gate, brain-swap/stream-memory human gates, and the `apps/soul`-only LLM/perception exception.  Reading/interjection’s 887/887 + 1h40 evidence is the one explicitly recorded human pass.
- Model-authoring maps keep equipment completion distinct from post-`45d2734` PNG re-certification and Wave107→22/23 real-device gates; closed-problem scope remains a user decision.
- Expo/archive maps report six HTML + six A2 PDFs as repository artifacts while leaving acceptance, proof-print, publication rights, and Cubism permission/legal/scope gates unresolved.  Historical report maps route to current owners and do not rewrite archive truth.
- Parent maps remain child-first routing indexes; Wave103–109 are explicitly specialized and do not silently reopen the Wave102 Editor mainline.

## Initial follow-up ownership (fulfilled in correction pass)

The three owners above should apply wording-only corrections and append a short correction note to their owner reports.  No product decision, user gate, device run, external verification, legal decision, or source/test change is implied by this review.

## Re-review (correction pass)

The three initial findings were re-checked against the corrected maps and owner reports:

- **N-01 closed.** `discussion/design/mesh-generation/_map.md:24` now says `Technical/default route; implementation evidence ... only` and explicitly keeps the v6/v7 product-quality and toggle-lifetime hold open.  This matches the correction note in `112-mesh-render-perf-map-update.md:76-78`; no human/product quality gate is implied.
- **N-02 closed.** `discussion/design/_map.md:24` now labels Wave107 as `Historical specialized evidence / superseded for live mapping`, routes current live semantics to Wave22/23, and keeps the real-device speech/vowel gate open.  `120-design-parent-update.md:66-70` records the wording-only correction and verification.
- **N-03 closed.** `discussion/implementation/_map.md:50` and `discussion/implementation/orchestration/_map.md:139` now label Wave81 as historical and route current dynamics guidance to Wave106 `dynamics-file-v3` / `worldFrameChainV1`.  `121-implementation-parent-update.md:67-74` records the correction and link verification.

No semantic blocker or non-blocking wording issue remains from this review.  The preserved open gates and information-type boundaries remain unchanged; the final verdict is **pass (0 blocking, 0 non-blocking)**.
