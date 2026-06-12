# Wave63 Pre-plan Spec Review Improvement Inventory

## Status

- Status: pass
- Role: Wave63 pre-plan inventory / Sylph C.
- Scope: Review-process inventory only. This report does not change product scope, implementation scope, maps, source code, tests, or wave plans.
- Write scope used: this report only, under `discussion/implementation/waves/wave63/`.
- Main conclusion: Wave62 reviews were not obviously invalid, but they mostly proved compliance to the wave plan and local implementation/test expectations. They did not consistently force an explicit trace from every relevant primary design-doc requirement to one of: implemented, explicitly out of Wave62 scope, deferred, unclear, or Undine decision needed.

## Basis read

Primary requested basis:

- `discussion/implementation/orchestration/wave62-plan.md`
- `discussion/implementation/waves/wave62/wave62-domain-a-mesh-auto-outline-v1-report.md`
- `discussion/implementation/reviews/wave62/wave62-domain-a-mesh-auto-outline-v1-review.md`
- `discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md`
- `discussion/implementation/reviews/wave62/wave62-domain-b-warp-deformer-package-foundation-review.md`
- `discussion/implementation/waves/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-report.md`
- `discussion/implementation/reviews/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-review.md`
- `discussion/implementation/reviews/wave62/wave62-final-clean-integration-review.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/design/mesh-generation/auto-outline-v2.md`
- `.github/skills/implementation-orchestration/SKILL.md`

Additional placement/process basis:

- `discussion/_conventions.md`
- `discussion/_map.md`
- `C:/Users/remie/.codex/skills/discussion-management/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`

Important basis note:

- `discussion/design/mesh-generation/auto-outline-v2.md` appears to be post-Wave62 or at least updated after Wave62, because it explicitly describes what Wave62 `auto-outline-v1` implemented and what quality problems remain. I treat it as next-wave basis, not as evidence that Wave62 Domain A should have implemented v2.

## Observed review-process facts

Facts from Wave62 plan and orchestration policy:

- `wave62-plan.md` named broad primary basis docs, but the domain AC sections narrowed the actual Wave62 commitments.
- Wave62 Domain A/B/C each had explicit domain scope, required items, non-goals, forbidden areas, expected reports, and verification expectations.
- `.github/skills/implementation-orchestration/SKILL.md` requires Review-Sylph to review from artifacts/source and cover two lanes: Design / Development Compliance Review and Test Adequacy Review. It does not require a separate Spec Compliance lane or a primary-basis coverage matrix.

Facts from Domain A review:

- Domain A review listed consulted basis docs and included an Acceptance Trace.
- It checked the main Wave62 Mesh `auto-outline-v1` AC: presets, alpha-derived contour, density order, determinism, preview/apply/regenerate/cancel, fallback or blocked behavior.
- It recorded residual quality risks for holes, multiple islands, thin shapes, and fallback metadata preservation.
- It did not consult `auto-outline-v2.md`, which is reasonable if that doc was not a Wave62 basis at the time.

Facts from Domain B review:

- Domain B review listed basis docs, including `rig-tool.md`, policies, and the orchestration skill.
- It performed a strong package/operation/validator/test review and caught a validator coverage gap for incompatible keyform/control-point cardinality before final pass.
- It documented the Bezier edit surface as stored/validated but not runtime evaluated.
- It did not create a full trace table from every relevant Rig Tool design item to implementation/defer status.

Facts from Domain C review:

- Domain C review read source, tests, Domain B contract artifacts, and the Domain C report.
- It verified the Wave62 plan's Rig Tool v0 AC: Parts/Deformers toggle, Deformer Tree rows/reference rows, draft inspector fields, draft/committed overlay distinction, Domain B operation use, and E2E state reflection.
- It recorded non-blocking residuals for read-only committed settings, Bezier non-evaluation, local read-projection duplication, and limited nested-deformer E2E coverage.
- It did not explicitly list a basis-doc coverage table for broader `rig-tool.md` items such as Drawable Pool, Rotation Deformer creation entry, committed Deformer Inspector edit policy, or opacity multiplier.

Facts from final clean integration review:

- Final review directly read the wave plan, all domain reports/reviews, closeout, maps, `mesh-tool.md`, `rig-tool.md`, policy docs, and source/test files.
- It verified cross-domain integration and reran focused tests/E2E.
- It listed residual risks, but did not include a Plan-vs-Primary-Basis delta table.

Process observation:

- Wave62 review quality was strongest where the wave plan had concrete checklist-like AC.
- Review strictness became weaker where primary design docs were broader than the wave plan. Those broader items were sometimes silently treated as future scope instead of being explicitly classified.

## Potential misses / not actually misses table

| Topic | Primary basis signal | Wave62 plan signal | What Wave62 review captured | Inventory classification | Wave63 review-instruction impact |
|---|---|---|---|---|---|
| Deformer Inspector committed editing / opacity multiplier | `rig-tool.md` separates Warp Deformer Inspector fields, includes `opacity multiplier`, and says name/parent/bounds/divisions/opacity can be edited later (`rig-tool.md:334`, `:355`, `:381`, `:383`). | Domain C required initial draft fields, Apply/Cancel, and v0 create flow. Domain B explicitly had no update-settings operation. | Domain C review confirmed draft fields and noted committed settings are read-only. It did not mention opacity multiplier or the broader committed edit policy. | Review-process miss as trace, not a clear Wave62 implementation blocker. The review should have said: broader design item deferred because v0 lacks update operation. | Require "Inspector Field Coverage" rows: basis field, draft support, committed support, deferred reason, test evidence. |
| Drawable Pool and Deformer Tree binding DnD | `rig-tool.md` defines `Drawable Pool`, unbound drawable references, collapsed default, and DnD binding/reparent behavior (`rig-tool.md:148`, `:161`, `:168`, `:172`). | Domain C required Deformer hierarchy and bound Drawable reference rows; did not require Drawable Pool or DnD. | Domain C review confirmed reference rows and no Parts Tree membership damage. It did not call out omitted Drawable Pool/DnD. | Review-process miss as scope-delta trace. Not automatically a Wave62 blocker because plan narrowed v0. | Add "Plan-vs-Basis Scope Delta" table. If a design-doc UI region is omitted from plan, reviewer must classify as deferred or ask Undine. |
| Rotation Deformer create entry | `rig-tool.md` says Drawable selection should show both `Create Rotation Deformer` and `Create Warp Deformer`, and has a Rotation UX section (`rig-tool.md:192`, `:234`). | Wave62 accepted UX was Warp Deformer creation; non-goals include Rotation Tool redesign. | Domain C review did not mention Rotation creation. | Not an implementation miss for Wave62 if plan intentionally narrowed to Warp Deformer. It is a trace miss because the basis conflict/narrowing was not recorded. | Reviewer must check broad Active Tool primitives and record excluded primitives with the plan clause that excludes them. |
| Deformer insertion semantics | `rig-tool.md` describes inserting a new deformer between an existing parent deformer and selected drawable rather than creating sibling duplicate behavior (`rig-tool.md:192` onward). | Domain C accepted path covered creating a Warp Deformer from a selected Drawable; no explicit insertion semantics. | Review noted parent/child hierarchy source support and limited E2E coverage. It did not tie this to insertion semantics. | Partial trace miss. Likely future/deferred unless Wave63 scopes binding/reparent/insertion. | Add hierarchy semantics rows: root create, create under parent, insert between parent and bound child, invalid cycle/drop behavior. |
| Transform divisions wording: control point count vs cell count | `rig-tool.md` warns not to make columns/rows ambiguous (`rig-tool.md:305`). | Domain B handoff said transform columns/rows are control point counts; Domain C must label carefully. | Domain C review explicitly verified wording as control point counts. | Not a miss. Good example of spec compliance when the risk was concrete. | Preserve as required item in future deformer reviews. |
| Mesh `auto-outline-v2` quality problems | `auto-outline-v2.md` says Wave62 v1 improved outline following but still has fan concentration, large triangles, grid feel, and density cliffs (`auto-outline-v2.md:9` onward). | Wave62 planned `auto-outline-v1`, explicitly rejected pixel-level aesthetic oracle, and allowed residual quality tuning. | Domain A and final review recorded holes/multiple islands/thin-shape/quality risks. | Not a Wave62 miss. This is next-wave/newly refined basis. | If Wave63 touches mesh quality, `auto-outline-v2.md` must become primary basis with metric and human visual-check rows. |
| Mesh quality summary / warning | Current `mesh-tool.md` says algorithm should return fallback conditions and quality summary (`mesh-tool.md:260`, `:276`); `auto-outline-v2.md` also defines quality metrics summary. | Wave62 Domain A focused on v1 fallback and deterministic contour behavior. | Domain A reviewed fallback display and test coverage, not full quality-summary metrics. | Uncertain timing. If this requirement existed before Domain A, review should have recorded it as deferred; if it was updated post-Wave62, not a miss. | Next mesh review must require generation summary rows: fallback, quality metrics, warning display, operation provenance. |
| Parent/child deformer E2E coverage | Rig Tool design includes hierarchy and parent relationships. | Domain C v0 required Deformer Tree and parent/child display, but E2E was allowed to be state-reflection focused. | Domain C review explicitly called nested hierarchy E2E coverage a non-blocking gap. | Not a miss; good residual classification. | Carry forward as required if Wave63 scopes parent/reparent/binding workflows. |
| Raw evidence / internal payload visibility | Rig and Mesh docs list raw operation/evidence/validator payloads as not displayed. | Wave62 plan also avoided internal/debug UX expansion. | Reviews generally checked no forbidden Cubism claims or pixel oracle, but raw-evidence UI was not consistently traced. | Minor trace gap, no evidence of violation in reviewed docs. | Include Negative Spec Compliance rows for "must not display" items. |

Strict split requested by inventory question:

- Wave62 implementation blockers found from this inventory: none.
- Wave62 review-process items that should have been easier to catch: missing explicit trace/defer rows for Deformer Inspector breadth, Drawable Pool/DnD, Rotation Deformer creation entry, deformer insertion semantics, and raw/internal UI non-display checks.
- Wave62 review items already handled acceptably: Transform division wording, Domain B validator cardinality coverage after fix loop, Mesh v1 residual quality risk classification, read-only committed settings residual.
- Likely Wave62-after/newly refined items: `auto-outline-v2` quality targets, mesh v2 metric thresholds, human visual quality check, and any decision to prioritize Deformer Inspector / Drawable Pool / Rotation creation in Wave63.

## Spec Compliance checklist proposal

Add the following mandatory checklist to every Wave63 Review-Sylph assignment. This should be reviewed independently from the implementer's summary.

1. Primary basis coverage
   - For each assigned primary basis doc, extract only the sections named by the wave plan or Orch-Sylph.
   - Each requirement must be classified as `in-scope`, `explicit non-goal`, `deferred by plan`, `unclear/conflict`, or `not relevant to this domain`.
   - `unclear/conflict` requires `escalate` or `Undine decision needed`; it must not be silently treated as future scope.

2. Plan-vs-basis delta
   - Compare the wave plan AC against the broader design docs.
   - If the plan narrows a design-doc requirement, record the exact narrowed behavior and whether the omitted part is a non-blocking future item.
   - If the plan omits a design-doc item that appears essential to the user workflow, do not pass without a residual/deferred row or Undine decision.

3. User workflow trace
   - Trace each accepted user path step from UI state to operation/schema/package mutation to visible state reflection.
   - Mark whether project state changes only on Apply, whether Cancel preserves state, and whether draft/committed states are visually/data-distinct.

4. Inspector and panel field completeness
   - For each inspector/panel specified in basis docs, list fields/actions as `present`, `read-only`, `draft-only`, `committed-edit supported`, `deferred`, or `N/A`.
   - Include hidden/internal fields that must not be shown.

5. Hierarchy and binding semantics
   - For deformer/parts/mesh work, check that UI references do not alter Parts Tree membership/draw order unless explicitly scoped.
   - If parent/child, binding, insertion, pool, or DnD behavior is in the basis doc but not in the wave plan, record it as a scope delta.

6. Package / operation / validator / UI vertical slice
   - For every user-visible behavior that requires package support, confirm package shape, operation dry-run/commit, validator diagnostics, runtime/evaluation boundary, editor integration, and tests.
   - GUI-only workarounds are not compliant when the accepted UX requires package support.

7. Negative spec compliance
   - Confirm forbidden claims and hidden internals: no Cubism compatibility claim, no semantic auto-rig/preset inference unless explicitly scoped, no raw evidence/operation IDs/validator payloads in normal UI, no pixel oracle where the E2E oracle forbids it.

8. Algorithm/spec quality
   - For mesh or geometry algorithms, require deterministic output, fallback/blocked result, quality summary, and metric rows if the basis doc defines them.
   - Separate automated metric checks from human visual checks. Do not substitute "tests pass" for visual-quality acceptance when a basis doc calls for human review.

9. Test adequacy mapped to spec
   - Each in-scope spec row must have one of: unit test, integration test, E2E state-reflection test, manual/human visual check, or explicit test N/A rationale.
   - E2E should not carry package invariant coverage alone.

10. Residual classification
    - Every residual must be classified as `quality tuning`, `future scope`, `test gap`, `unsupported boundary`, `implementation risk`, or `Undine decision needed`.
    - Residuals that affect an in-scope required behavior are `needs_fix`, not pass-with-risk.

## Review report template additions

Add these sections before or inside the current Design / Development Compliance Review. The first two should be mandatory.

### Spec Compliance Coverage Matrix

| Basis doc | Section / requirement | Requirement type | Wave scope status | Implementation evidence | Test / verification evidence | Verdict | Notes |
|---|---|---|---|---|---|---|---|
| `...` | `...` | must / should / must-not / open | in-scope / non-goal / deferred / unclear | file/function/UI path | test/manual check | pass / partial / missing / N/A | ... |

### Plan-vs-Primary-Basis Delta

| Basis item broader than plan | Included in wave plan? | Reviewer disposition | Blocking? | Follow-up owner |
|---|---|---|---|---|
| `...` | yes / no / ambiguous | implemented / deferred / conflict / Undine decision needed | yes / no | Undine / future wave / none |

### User Workflow Trace

| Step | UI evidence | Operation/package evidence | State/reflection evidence | Test evidence | Verdict |
|---|---|---|---|---|---|
| Select target | ... | ... | ... | ... | ... |
| Draft | ... | ... | ... | ... | ... |
| Apply | ... | ... | ... | ... | ... |
| Cancel / reset | ... | ... | ... | ... | ... |

### Inspector Field Coverage

| Field/action | Basis status | Draft support | Committed support | Mutation support | Test evidence | Deferred reason |
|---|---|---|---|---|---|---|
| name | ... | ... | ... | ... | ... | ... |

### Negative Compliance Check

| Must-not item | Evidence checked | Verdict | Notes |
|---|---|---|---|
| No semantic auto-rig/preset inference | ... | pass / fail | ... |
| No raw operation/evidence payload in normal UI | ... | pass / fail | ... |
| No Cubism compatibility claim | ... | pass / fail | ... |

### Residual Risk Classification

| Residual | Source basis | Affects in-scope required behavior? | Classification | Required action |
|---|---|---|---|---|
| ... | ... | yes / no | quality tuning / future scope / test gap / decision | fix / record / ask Undine |

## Orch-Sylph/Gnome instruction additions

Add these to Orch-Sylph assignments:

- Provide a domain-specific primary basis pack, not a broad list. Include exact sections or bullets to trace.
- State which document wins if the wave plan intentionally narrows a broader design doc. If this is not known, mark `Undine decision needed` before implementation.
- Require Gnome to include a "Basis Coverage Self-Report" and "Intentionally Deferred Basis Items" table in its completion report.
- Require Review-Sylph to verify the self-report independently; the self-report is input, not evidence by itself.
- If Gnome finds a basis item that is broader than the wave plan, it must not implement extra product scope by default. It should report the delta to Orch-Sylph.
- If package support is needed for accepted UX, Orch-Sylph must not allow editor-only workarounds unless the wave plan explicitly says so.

Add these to Gnome assignments:

- Do not claim "spec complete" without citing the basis sections covered.
- Report implemented requirements, omitted requirements, and assumptions separately.
- For each omitted requirement, state one of: out of wave plan, explicit non-goal, blocked by missing contract, needs Undine decision, or future quality tuning.
- Include a vertical trace for user-facing behavior: UI state, operation/package mutation, validator/runtime boundary if relevant, and test.
- Include "must-not compliance" evidence for semantic automation, compatibility claims, raw debug payload display, and forbidden scope.
- Include residual risks with blocker/non-blocker classification. Do not bury product-scope uncertainty under "residual risk".

## Recommended Wave63 review policy

Recommendation, not a product decision:

- Add `Spec Compliance Review` as a separate required lane, before Design / Development Compliance Review and Test Adequacy Review.
- Keep the existing two lanes. Spec Compliance should answer "did we build the accepted primary-basis behavior and correctly classify omissions?" Design / Development should answer "was it built in the right architecture and boundaries?" Test Adequacy should answer "is the proof sufficient?"
- A domain may pass only if every `in-scope` spec row is `pass`, or if each partial/missing row has an explicit non-blocking disposition approved by the wave plan or marked for Undine.
- If a primary basis doc is too broad, Undine/Orch-Sylph should pass only named sections to Review-Sylph. Review-Sylph should not be expected to audit the entire design corpus.
- For final clean integration review, require a cross-domain Plan-vs-Basis Delta summary. This is where broad design omissions such as Drawable Pool or Rotation creation should remain visible even if not blocking.

Recommended primary-basis reading limit:

- Start with the wave plan. Treat it as the scope and gate document.
- Then read only the domain-relevant sections of design docs:
  - Mesh work: `mesh-tool.md` basic flow, overlay, Preset Preview, Initial Mesh Generation, algorithm reference, acceptance criteria; `auto-outline-v2.md` only if the wave scopes v2 quality.
  - Package deformer work: `rig-tool.md` Warp Deformer UX, Transform/Bezier division semantics, Inspector field model; package/operation/schema policies.
  - Editor deformer work: `rig-tool.md` Workspace placement, Canvas Overlay, Deformer Tree / Drawable Pool, Deformer Creation / Insertion, Tool State, Warp Deformer Inspector, display / non-display rules, unresolved items.
- Read policy docs as constraints, not feature backlogs.
- Do not require Review-Sylph to re-read every map or unrelated design doc. If a map points to a relevant newer basis doc, Orch-Sylph should explicitly add that doc/section to the basis pack.
- When a design doc section is marked `未決事項`, Review-Sylph should not convert it into a requirement. It should record whether the current wave plan made a decision or left it unresolved.

## Undine decision needed

- Decide whether Wave63 will add `Spec Compliance Review` as a separate required lane or as a mandatory section inside Design / Development Compliance. Recommendation: separate lane.
- Decide whether every Wave63 plan must include a "Primary Basis Scope / Deferred Basis Items" table before implementation starts. Recommendation: yes.
- Decide Wave63 product scope for the known candidates:
  - Deformer Inspector committed editing and opacity multiplier.
  - Drawable Pool and binding/reparent DnD.
  - Rotation Deformer creation entry from Drawable selection.
  - Mesh `auto-outline-v2` quality pass, metrics, and human visual check.
- Decide whether `auto-outline-v2.md` is now the canonical basis for the next mesh quality wave. Recommendation: yes for mesh v2 work, no for unrelated deformer work.
- Decide whether a Review-Sylph pass may be accepted when primary-basis items are untraced but plausibly future scope. Recommendation: no; require a deferred/decision row.
