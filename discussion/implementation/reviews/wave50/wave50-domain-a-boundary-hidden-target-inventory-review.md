# Wave50 Domain A Review: Boundary / Hidden / Target Inventory

> Target: `wave50-boundary-hidden-target-inventory`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Findings

No blocking findings.

## Compliance Review

- Automation policy: pass. The report keeps Wave50 inside explicit deterministic structural expansion allowed by `discussion/design/codex-friendly-automation-policy.md`, and does not claim semantic recognition, recommendation generation, auto-rigging, repo-side proposal generation, external transport, Photoshop compositing, renderer/pixel oracle, or Cubism compatibility.
- Hidden leaf rule: pass. The report correctly treats hidden positive-size leaves as eligible only when explicitly included and materializable, with `initialRuntimeVisibility: false` at the drawable level. Current code still blocks hidden leaves through `hidden`, `unsupported`, and `hiddenLayerUnsupported`, so the report's taxonomy notes are correctly framed as later Wave50 changes rather than current behavior.
- Group visibility/opacity: pass. The evidence-only rule is justified by the current boundaries: `ModelPart` has `partId`, `displayName`, `parentPartId`, `childPartIds`, and `drawableIds` but no visibility/opacity fields; drawable files carry `defaultOpacity` and `runtimeVisibility`; runtime drawable projection maps those drawable fields to runtime `opacity` and `visible`. The browser PSD adapter records group opacity evidence but currently writes group `visibleInSource: true`, so treating group visibility/opacity as runtime-affecting would overclaim.
- Sample focused targets: pass. A read-only PSD probe confirmed the report's sample facts: source byteLength `22406225`, groups `20`, leaves `126`, visible leaves `121`, hidden leaves `5`, total all-leaf RGBA estimate `49172000`, and focused refs/sourceOrder/byte estimates for `psd:root/layer[0]`, `psd:root/layer[1]`, `psd:root/group[2]/layer[0]`, `psd:root/layer[3]`, and `psd:root/group[6]/layer[0]`.
- Cap/failure policy: pass. The report's conservative caps, whole-operation preflight, no silent truncation, and no partial commit requirements match the current batch-operation safety shape and are appropriate for downstream structural execution.
- Orchestration compliance: pass. Domain A was a boundary/inventory domain with source implementation explicitly N/A. The report records that Orch-Sylph did not implement source; a Gnome source implementation being N/A is acceptable for this domain, and this review is a separate context.

## Test / Verification Adequacy Review

Adequate for Domain A. This domain does not implement source behavior, so source tests are not expected here. The report is grounded by policy/baseline review, current source inspection, existing Wave44/Wave49 evidence, and sample fixture probes. Later Domains B-G still need implementation tests for contracts, operation execution, Editor/Codex surfaces, validator diagnostics, save/load, stale/collision/blocker cases, and focused e2e preservation.

## Files Changed By Review

- `discussion/implementation/reviews/wave50/wave50-domain-a-boundary-hidden-target-inventory-review.md`

## Verification Performed

- Read the Wave50 Domain A report and required basis documents.
- Inspected targeted source/docs for parser group/layer evidence, hidden candidate blocking, import-plan approval digesting, batch preflight/commit behavior, drawable runtime visibility, package schemas, and Wave49 focused e2e evidence.
- Ran read-only Node probes against `test_data/sample_model.psd` to verify the focused target inventory and hidden `headwear` materialization byte availability.
- `git diff --check -- discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`: pass.

## Remaining Risks And User-Decision Points

- No Domain A user decision is required.
- Later domains must keep the Domain A recommendations as implementation requirements, not as already-proven source behavior.
- User decisions remain future-scope only if Wave50 needs group visibility/opacity to affect runtime, higher caps than the focused defaults, initial grid mesh generation, Photoshop compositing/renderer proof, public sample-derived assets, archive/filesystem intake, external transport, or Cubism compatibility.

## Domain B Readiness

Domain B can start.
