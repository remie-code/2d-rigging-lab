# Wave55 Domain F Report: UX-focused E2E / Review Gate v0

> Target: `wave55-ux-focused-e2e-review-gate-v0`  
> Role: Domain F Orch-Sylph  
> Verdict: `pass`  
> Scope: UX-focused e2e gate definition / registry / review only. Production source was not changed.

## 1. Verdict

`pass`

Domain F added the standalone focused gate `taskWindowUxFocused` and independent review passed. The gate is intentionally stricter than Wave54's route/dialog proof: it verifies desktop and mobile no-scroll launch, viewport-contained overlay/window geometry, fixed/non-static positioning, center stacking, Back/Close visibility, horizontal overflow, legacy/support first-viewport absence, visible forbidden primary text, and PNG evidence beyond `base64Length`.

The current full browser run exits nonzero because the live PSD task summary still exposes the internal route id `diagnosticsEvidenceView` in visible primary task text. This is a meaningful gate failure and a Domain G handoff, not a Domain F test false positive. Domain G may consume this gate, but must remove that visible route id from primary human UI before claiming `taskWindowUxFocused` pass.

## 2. Orchestration Compliance

- Implementation was delegated to Gnome (`Gnome the 42nd`).
- Review was delegated to independent Review-Sylph (`Sylph the 43rd`).
- Orch-Sylph did not directly implement source/test changes.
- Fix loops used: 0 / 2.
- Review verdict: `pass`.
- Review artifact: `discussion/implementation/reviews/wave55/wave55-domain-f-ux-focused-e2e-review-gate-v0-review.md`.

## 3. Basis

Primary basis documents:

- `discussion/implementation/orchestration/wave55-plan.md`
- Domain A-E reports/reviews under `discussion/implementation/waves/wave55/` and `discussion/implementation/reviews/wave55/`
- `discussion/design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md`
- Existing focused e2e / registry files under `apps/editor/e2e/**` and `scripts/focused-e2e-registry.mjs`

## 4. Changed Files

Domain F implementation changes:

- `apps/editor/e2e/task-window-ux-focused-gate.mjs`
- `apps/editor/e2e/png-evidence.mjs`
- `scripts/focused-e2e-registry.mjs`

Persistent artifacts:

- `discussion/implementation/reviews/wave55/wave55-domain-f-ux-focused-e2e-review-gate-v0-review.md`
- `discussion/implementation/waves/wave55/wave55-domain-f-ux-focused-e2e-review-gate-v0-report.md`

No production source, existing PSD focused e2e script, check script, traceability matrix, package metadata, lockfile, fixture, or generated asset was changed by Domain F.

## 5. Gate Summary

`taskWindowUxFocused` is registered as standalone direct verification and resolves to:

```text
node apps/editor/e2e/task-window-ux-focused-gate.mjs
```

The gate runs:

- desktop viewport: `1280x900`
- mobile viewport: `390x844`

Required assertions implemented:

- PSD Import opens from Toolbox without document scroll jump.
- Active task window has runtime geometry evidence, not just DOM metadata.
- Task root/frame are viewport-contained.
- Root or frame is non-static/fixed-like.
- Document height is not inflated as a normal below-flow section.
- `elementFromPoint()` at the window center resolves inside the active task.
- Back and Close affordances are visible and enabled.
- No document horizontal overflow is introduced.
- Legacy/support panels are not visible in the primary first viewport.
- Visible primary text excludes raw refs, operation/command IDs, diagnostics IDs, evidence paths, command/parser payloads, `Task Summary`, `data-testid`, and internal route IDs such as `diagnosticsEvidenceView`.
- Screenshot evidence records PNG `byteLength`, SHA-256, and IHDR dimensions through `apps/editor/e2e/png-evidence.mjs`.

`role="dialog"` and `data-task-window-*` are used only as supplementary markers. They cannot satisfy the gate without runtime geometry and visible-text assertions.

## 6. Verification

Passed:

- `node --check apps/editor/e2e/task-window-ux-focused-gate.mjs`
- `node --check apps/editor/e2e/png-evidence.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
  - output: 26 entries, 14 aggregate-discoverable, 12 standalone direct
- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused --dry-run`
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused --dry-run`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `git diff --check -- apps/editor/e2e scripts/focused-e2e-registry.mjs scripts/check-focused-e2e-registry.mjs discussion/tests/traceability/test-traceability-matrix.md`
  - passed with only the known LF/CRLF warning on `scripts/focused-e2e-registry.mjs`

Full focused run:

- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused`
  - sandbox attempt failed with Chrome `spawn EPERM`.
  - approved outside-sandbox rerun executed browser e2e and exited 1 on both desktop and mobile.
  - failure category: `[forbidden-primary-text]`
  - visible match: `Details: diagnosticsEvidenceView...`

Review-Sylph traced the visible text to production PSD task observation/status projection, not hidden input values. This validates that the new gate is fail-capable and catches the intended class of primary human UI pollution.

## 7. Review Result

Review artifact:

- `discussion/implementation/reviews/wave55/wave55-domain-f-ux-focused-e2e-review-gate-v0-review.md`

Review verdict:

- `pass`

Blocking findings:

- none

Review residual handoff:

- Domain G must remove visible `diagnosticsEvidenceView` from primary PSD task text while preserving structured/evidence routing outside primary human copy.
- Domain H must rerun `taskWindowUxFocused` after G integration and preserve the five existing PSD focused IDs.

## 8. Residual Risks / Handoffs

For Domain G:

- Consume `taskWindowUxFocused` as the integration gate.
- Fix visible PSD task summary/status copy so internal route IDs do not appear in primary human UI.
- Keep hidden/structured evidence or Diagnostics/Evidence routing available without exposing route ids in primary copy.
- Do not reintroduce legacy/support panels into normal primary flow.

For Domain H:

- Rerun full `taskWindowUxFocused` after G.
- Rerun `taskWindowRoutingFocused`.
- Rerun existing PSD focused IDs:
  - `psdStructuralInitialStateFocused`
  - `psdImportPlanCodexFocused`
  - `psdImportPlanFocused`
  - `psdMultiLayerBatchFocused`
  - `psdImportFocused`

Residual note:

- PNG evidence is machine-verifiable (`byteLength`, SHA-256, IHDR dimensions) rather than persisted screenshot files. This satisfies Domain F v0's "beyond base64Length" requirement when combined with geometry assertions, while later human visual audit may still choose persisted screenshot artifacts.

## 9. User-Decision Points

Blocking user decision: none.

## 10. Consumption Status

Domain G may consume this output.

Consumption condition: the gate is currently expected to fail until G removes the visible `diagnosticsEvidenceView` primary text and completes live primary cutover.
