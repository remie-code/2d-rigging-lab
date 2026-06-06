# Wave50 Domain G Report: Focused E2E Structural Initial State Regression

> Target: `wave50-focused-e2e-structural-initial-state-regression`
> Role: Orch-Sylph completion report
> Verdict: `pass`
> Date: 2026-06-07

## Verdict

`pass`

Domain G adds and verifies `psdStructuralInitialStateFocused` while preserving the existing PSD focused IDs: `psdImportPlanCodexFocused`, `psdImportPlanFocused`, `psdMultiLayerBatchFocused`, and `psdImportFocused`.

Loop count: 1 implementation pass with one Gnome continuation before clean Review-Sylph pass.

## Current-State Investigation

I read the orchestration skill, Wave50 plan, automation policy, Domain A-F completion reports/reviews, fixture manifest, traceability matrix, and source organization policy before implementation delegation.

Findings before Gnome delegation:

- Domain A-F reports and reviews were present and recorded `pass`.
- Domain D/E/F reports contained root recovery notes, so I did not treat any root-authored work as Domain G evidence.
- Existing Domain G work was present as untracked `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs` plus registry/fixture/traceability draft edits. I treated it as untrusted draft state.
- The draft was inside Domain G allowed scope and therefore safe for Gnome to independently validate and reuse, but it was not sufficient as-is: it covered only 2 leaves and lacked adequate sourceOrder/stale evidence.
- No contamination outside Domain G allowed scope was required to resolve this domain, so no escalation was needed.

Prior untrusted draft handling: reused after independent Gnome validation and substantial replacement of the draft assumptions. The 2-leaf proof was expanded to 4 leaves / 2 groups and actual generated IDs from the running focused e2e.

## Separation

- Gnome implementation: separated. Implementation was delegated to Gnome `019e9e37-5f75-7c20-bf2d-2a2161df407b`; Orch-Sylph did not implement source/test changes.
- Review-Sylph review: separated. Clean review was delegated to Review-Sylph `019e9e51-7d28-7c11-b604-6499d07bcaf0`.
- Review report: `discussion/implementation/reviews/wave50/wave50-domain-g-focused-e2e-structural-initial-state-regression-review.md`

## Changes

Changed by Domain G:

- `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/reviews/wave50/wave50-domain-g-focused-e2e-structural-initial-state-regression-review.md`
- `discussion/implementation/waves/wave50/wave50-domain-g-focused-e2e-structural-initial-state-regression-report.md`

## Coverage Proven

- Structural preview and execution for private/local `test_data/sample_model.psd`.
- Explicit approved leaf set:
  - hidden `headwear` / `psd:root/layer[1]`
  - `front hair` / `psd:root/group[2]/layer[0]`
  - `eyewear` / `psd:root/layer[3]`
  - `tie / tie` / `psd:root/group[6]/layer[0]`
- Generated group part containers only:
  - `part_hair_front_group_psd_root_group_2_structural`
  - `part_tie_group_psd_root_group_6_structural`
- SourceOrder-derived order is asserted despite deliberately out-of-order approval input.
- Visible leaves restore as `Runtime visible` Layer Tree rows.
- Hidden `headwear` restores as a `Runtime hidden` Layer Tree row.
- Save/load restores four persistent private/local materialized byte refs and generated graph/texture refs.
- Codex-facing `getPsdImportPlanState` projection exposes structural refs, group refs, leaf refs, generated IDs, sourceOrder, and runtime-hidden state.
- Existing leaf import-plan stale rejection remains proven by `psdImportPlanCodexFocused` with `staleContext=rejected`.
- Registry metadata keeps the new structural e2e as standalone direct verification and does not broaden the editor aggregate e2e runtime.

## Verification

Gnome and clean Review-Sylph both reported the required verification. Review-Sylph independently reran the focused e2e set and recorded the results in the review report.

| Command | Result |
|---|---|
| `node --check apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs` | pass |
| `node scripts/check-focused-e2e-registry.mjs` | pass; 24 entries, 14 aggregate-discoverable, 10 standalone direct |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass |
| `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused` | pass after sandbox `spawn EPERM` required approved local rerun |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` | pass; `staleContext=rejected` |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | pass |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | pass |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | pass |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass |
| `git diff --check -- apps/editor/e2e scripts discussion/tests discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50` | pass with LF/CRLF working-copy warnings only |

Escalation note: browser focused e2e execution hit sandbox `spawn EPERM`; the approved local reruns passed.

## Review Result

Clean Review-Sylph verdict: `pass`.

Blocking findings: none.

Non-blocking note from review: Wave50 has no structural-specific stale execute/rejection command. Domain G records this truthfully and preserves stale rejection through the existing `psdImportPlanCodexFocused` leaf import-plan path.

## Residual Risks

- Structural-specific Codex execute/stale rejection remains outside Wave50's current in-process command surface. This is documented as a limitation, not hidden by the e2e.
- The JSON mirrors for fixture/traceability remain intentionally unchanged; the Wave50 registration is Markdown warning-gated evidence only.
- LF/CRLF working-copy warnings were emitted by Git during diff checks but did not produce whitespace errors.

## User-Decision Points

None.
