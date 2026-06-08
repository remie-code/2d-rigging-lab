# Wave55 Domain F Review: UX-focused E2E / Review Gate v0

> Role: independent Review-Sylph / clean context  
> Target: `wave55-ux-focused-e2e-review-gate-v0`  
> Verdict: `pass`

## Verdict

`pass`

Domain F の変更は、production source を変更せず、`taskWindowUxFocused` を standalone direct focused e2e gate として追加している。Gate は `role="dialog"` / `data-task-window-*` を補助 marker として待機・記録するが、それだけでは pass せず、desktop/mobile の scroll、viewport containment、overlay/static-flow、center stacking、affordance visibility、horizontal overflow、legacy/support first-viewport absence、visible forbidden primary text、PNG byte/sha/IHDR dimensions を assertion にしている。

既知の full run failure は F gate の false positive ではなく、現 production projection が `diagnosticsEvidenceView` route id を visible PSD task summary に出している Wave55 残として扱うべきである。Domain G はこの gate を消費し、visible `diagnosticsEvidenceView` を primary human UI から除去する必要がある。

## Scope Reviewed

Basis docs:

- `discussion/implementation/orchestration/wave55-plan.md`
- Domain A-E reports/reviews under `discussion/implementation/waves/wave55/` and `discussion/implementation/reviews/wave55/`
- `discussion/design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md`

Target files:

- `apps/editor/e2e/task-window-ux-focused-gate.mjs`
- `apps/editor/e2e/png-evidence.mjs`
- `scripts/focused-e2e-registry.mjs`

Narrow source reads for failure classification:

- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`

Existing PSD focused e2e scripts and `taskWindowRoutingFocused` were checked for diffs; no modifications were found in those existing e2e scripts.

## Blocking Findings

None.

## Review Checks

### 1. Design / Development Compliance

`pass`

- F target implementation is limited to new e2e/helper files plus `scripts/focused-e2e-registry.mjs`; no production source was changed by F.
- `taskWindowUxFocused` is registered as standalone direct verification in `scripts/focused-e2e-registry.mjs:157`-`scripts/focused-e2e-registry.mjs:162` and resolves to `node apps/editor/e2e/task-window-ux-focused-gate.mjs` in `scripts/focused-e2e-registry.mjs:215`-`scripts/focused-e2e-registry.mjs:218`.
- `taskWindowRoutingFocused` remains a separate semantic smoke entry at `scripts/focused-e2e-registry.mjs:151`-`scripts/focused-e2e-registry.mjs:156`.
- Existing PSD focused scripts (`psdImportFocused`, `psdImportPlanFocused`, `psdImportPlanCodexFocused`, `psdStructuralInitialStateFocused`, `psdMultiLayerBatchFocused`) have no e2e script diff, so Domain F did not weaken their existing behavior/evidence coverage.

### 2. Role / Data Marker Boundary

`pass`

The gate waits for supplementary task markers in `waitForActivePsdImportTask()` (`apps/editor/e2e/task-window-ux-focused-gate.mjs:184`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:203`), but pass/fail is decided later by runtime UX assertions:

- no scroll jump: `apps/editor/e2e/task-window-ux-focused-gate.mjs:131`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:142`, `apps/editor/e2e/task-window-ux-focused-gate.mjs:687`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:701`
- geometry / viewport / overlay / stacking / affordances / overflow: `apps/editor/e2e/task-window-ux-focused-gate.mjs:703`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:767`
- visible forbidden primary text: `apps/editor/e2e/task-window-ux-focused-gate.mjs:163`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:170`, `apps/editor/e2e/task-window-ux-focused-gate.mjs:777`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:798`
- PNG evidence: `apps/editor/e2e/task-window-ux-focused-gate.mjs:149`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:154`, `apps/editor/e2e/task-window-ux-focused-gate.mjs:800`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:832`

This satisfies the Wave55 rule that `role="dialog"` and `data-task-window-*` are not sufficient UX proof.

### 3. Test Adequacy

`pass`

The gate covers the required v0 UX areas:

- desktop/mobile loop: `apps/editor/e2e/task-window-ux-focused-gate.mjs:19`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:32`
- startup first-viewport legacy/support absence: `apps/editor/e2e/task-window-ux-focused-gate.mjs:103`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:117`
- PSD Toolbox launch no-scroll: `apps/editor/e2e/task-window-ux-focused-gate.mjs:119`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:142`
- active task metrics and center stacking: `apps/editor/e2e/task-window-ux-focused-gate.mjs:228`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:409`
- legacy/support first-viewport absence with task open: `apps/editor/e2e/task-window-ux-focused-gate.mjs:156`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:170`
- hidden form values are not treated as visible human text, because text scanning skips `input`, `textarea`, `select`, `option`, hidden, `aria-hidden`, and invisible elements in `apps/editor/e2e/task-window-ux-focused-gate.mjs:585`-`apps/editor/e2e/task-window-ux-focused-gate.mjs:620`
- `png-evidence.mjs` validates real PNG bytes and IHDR dimensions, not only base64 length (`apps/editor/e2e/png-evidence.mjs:5`-`apps/editor/e2e/png-evidence.mjs:25`, `apps/editor/e2e/png-evidence.mjs:28`-`apps/editor/e2e/png-evidence.mjs:41`)

The e2e uses `data-testid` only as test-facing selectors and evidence labels. F did not modify production source to make behavior depend on test ids.

### 4. Full Run Failure Classification

`pass`

The reported full command failure on both desktop and mobile with `[forbidden-primary-text]` is a meaningful oracle failure.

Static source trace confirms the route id is production visible text, not a hidden test value:

- `projectHumanSummaryText()` appends `"Details: diagnosticsEvidenceView."` in `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts:246`-`apps/editor/src/editor-state/explicit-psd-import-task-observation.ts:258`.
- The same observation summary can expose `diagnosticsEvidenceView` through `evidenceBoundary.summary` in `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts:201`-`apps/editor/src/editor-state/explicit-psd-import-task-observation.ts:216`.
- App Shell passes `observation.humanSummary.text` as the PSD task shell status and appends both human/evidence summary paragraphs in `apps/editor/src/ui/app-shell/app-shell.ts:552`-`apps/editor/src/ui/app-shell/app-shell.ts:571` and `apps/editor/src/ui/app-shell/app-shell.ts:646`-`apps/editor/src/ui/app-shell/app-shell.ts:663`.

Therefore the current failure should be consumed by Domain G as a real Wave55 residual: visible primary PSD task copy must use human wording rather than exposing `diagnosticsEvidenceView`.

## Verification Considered

Performed in this review:

- `node --check apps/editor/e2e/task-window-ux-focused-gate.mjs`: pass.
- `node --check apps/editor/e2e/png-evidence.mjs`: pass.
- `node scripts/check-focused-e2e-registry.mjs`: pass, 26 entries, 14 aggregate-discoverable, 12 standalone direct.
- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused --dry-run`: pass; resolves to `node apps/editor/e2e/task-window-ux-focused-gate.mjs`.
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused --dry-run`: pass.
- `node scripts/check-wave42-quality-gate-boundary.mjs`: pass; output remains 25 focused e2e entries because this guard checks Wave42 boundary policy, not the post-Wave42 overlay count.
- `git diff --check -- apps/editor/e2e scripts/focused-e2e-registry.mjs scripts/check-focused-e2e-registry.mjs discussion/tests/traceability/test-traceability-matrix.md`: pass with only the known LF/CRLF warning on `scripts/focused-e2e-registry.mjs`.
- `git diff --` over existing PSD focused e2e scripts, `task-window-routing-focused-smoke.mjs`, `selector-scopes.mjs`, `test-ids.mjs`, and `smoke-checks.mjs`: no diff.

Accepted from Gnome / Orch-Sylph evidence:

- Full `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused` was rerun outside sandbox after Chrome spawn EPERM and currently exits 1 on both desktop and mobile with `[forbidden-primary-text]` for visible `diagnosticsEvidenceView`.

I did not rerun the full browser command in this review because the provided failure evidence plus source trace is sufficient to classify the failure, and rerunning would require the same Chrome spawn path.

## Residual Risks / Handoffs

Domain G:

- Consume `taskWindowUxFocused` as the integration gate.
- Fix visible PSD task summary/status copy so `diagnosticsEvidenceView` and similar route ids do not appear in primary human UI.
- Keep hidden/structured evidence routing intact, but present it with human wording in primary UI.
- Do not reintroduce legacy/support panels into normal primary flow to make the gate pass.

Domain H:

- Rerun the full focused gate after G integration.
- Rerun the five existing PSD focused IDs to confirm semantic/evidence coverage was preserved.
- Keep `taskWindowRoutingFocused` as semantic smoke; do not use it as UX proof.

Residual review note:

- `png-evidence.mjs` returns machine evidence (`byteLength`, `sha256`, IHDR dimensions) rather than saving screenshot files. This is enough for Domain F's "beyond base64Length" v0 gate when combined with geometry assertions, but a later human visual audit may still choose to persist screenshots as artifacts.

## User-Decision Points

None blocking.

## Fix Loop Required

No F fix loop is required. The next fix loop belongs to Domain G if it consumes this gate and addresses the visible `diagnosticsEvidenceView` failure.
