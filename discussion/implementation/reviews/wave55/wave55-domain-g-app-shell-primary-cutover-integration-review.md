# Wave55 Domain G Review: App Shell Primary Cutover Integration

> Role: independent Review-Sylph / clean-context review  
> Target: `wave55-app-shell-primary-cutover-integration`  
> Verdict: `pass`

## Verdict

`pass`

Domain G integrates the Wave55 B-F outputs into the live App Shell without reintroducing the legacy support region into normal primary flow. Normal startup now uses `createPrimaryHumanShell(...)`, active PSD Import opens through the overlay task shell with clean human content, legacy/debug panels are preserved as individual nodes under the non-primary quarantine surface, and the previously visible `diagnosticsEvidenceView` route id no longer appears in primary PSD task copy.

## Findings

No blocking findings.

## Review Basis

Reviewed the Wave55 plan, Domain A-F reports/reviews, UI reset inventories, Authoring Workspace / PSD Import / Toolbox screen-design docs, and source organization policy directly. I did not rely on the Gnome summary alone.

Target files reviewed:

- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/app-shell/primary-human-shell.ts`
- `apps/editor/src/ui/app-shell/primary-human-shell.test.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`

Support files reviewed:

- `apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.ts`
- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/e2e/task-window-ux-focused-gate.mjs`
- `scripts/focused-e2e-registry.mjs`

## Rubric Checks

1. Normal startup uses `createPrimaryHumanShell(...)` in `app-shell.ts`; `createWorkspaceSupportRegion(...)` remains only as an unused legacy factory in `authoring-workspace-v0-shell.ts` and is not called by the live App Shell.
2. Primary shell preserves App Bar, Toolbox, Parts Tree, Canvas / Preview, Inspector, Parameter Bar, and Diagnostics Strip via slot composition in `primary-human-shell.ts` and live wiring in `app-shell.ts`.
3. Active PSD Import is routed through `createTaskShell(...)` as the active workspace task, with `createExplicitPsdImportTaskContent(...)` providing Domain D clean PSD content.
4. Legacy/debug panels are passed as individual nodes into `createLegacyDebugQuarantineSurface([...])`; the old `authoring-workspace-support` wrapper and `legacy-support` group are absent from the live primary shell.
5. Visible PSD task summaries now use human wording such as `Diagnostics / Evidence`; structured `detailSurface: "diagnosticsEvidenceView"` remains available in the observation state.
6. Existing PSD behavior/evidence coverage is preserved by the rerun focused PSD browser checks listed below.
7. `taskWindowUxFocused` remains strict and passed against production behavior with desktop/mobile geometry, no-scroll, forbidden visible text, and PNG evidence checks.
8. Source organization is acceptable for this integration slice. No `index.ts` implementation logic was added; the automated guard passed. `explicit-psd-import-panel.ts` remains large but was already accepted as a bounded residual risk by Domain D.
9. Orchestration compliance is satisfied: implementation was by Gnome; this review only wrote this review artifact and did not edit source/test files.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/primary-human-shell.test.ts apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - 4 files / 63 tests passed. Initial sandbox run failed with esbuild `spawn EPERM`; approved rerun passed.
- `pnpm.cmd typecheck`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node --check apps/editor/e2e/task-window-ux-focused-gate.mjs`
- `node --check apps/editor/e2e/png-evidence.mjs`
- `git diff --check --` over the reviewed source/test/e2e/registry files; only Git LF/CRLF working-copy warnings were emitted.
- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused`
  - desktop/mobile passed; task root `fixed`, document height delta `0`, center resolves inside active task, PNG evidence included byte length / sha256 / dimensions.
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`

Static searches:

- `rg "createWorkspaceSupportRegion" apps/editor/src` finds only the legacy factory definition.
- `rg "createPrimaryHumanShell" apps/editor/src` confirms the live App Shell import and call.
- `rg "Details: diagnosticsEvidenceView|diagnosticsEvidenceView\\."` over the relevant production PSD/App Shell files found no visible-copy remnants.

## Residual Risks

- The quarantine surface is mounted under a hidden internal host. This is consistent with Wave55's non-primary/internal v0 boundary, but the final route/drawer/dev-only form remains deferred.
- `explicit-psd-import-panel.ts` remains a large responsibility file. Current guardrails pass and the behavior is covered, but later PSD UX polish should consider splitting projection/helpers by responsibility.
- The full final task-window modality policy remains deferred; Wave55 proves the fixed overlay/window v0 behavior, not a final modal framework.

## User-Decision Points

None for Domain G. Deferred decisions remain the Wave55 plan's non-blocking items: final quarantine form, final all-tool task-window policy, Product Preflight final owner, and next authoring workflow promotion order.

## Review Artifact

`discussion/implementation/reviews/wave55/wave55-domain-g-app-shell-primary-cutover-integration-review.md`
