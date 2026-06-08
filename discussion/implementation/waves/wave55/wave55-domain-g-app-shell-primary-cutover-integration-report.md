# Wave55 Domain G Report: App Shell Primary Cutover Integration

> Target: `wave55-app-shell-primary-cutover-integration`  
> Role: Domain G Orch-Sylph  
> Verdict: `pass`  
> Loop count: 0 fix loops / max 2  
> Scope: B-F outputs を live App Shell へ統合し、normal primary flow の cutover と F gate の visible route-id failure を解消した。

## 1. Verdict

`pass`

Domain G completed the live App Shell cutover to the clean Primary Human Shell and removed the legacy `authoring-workspace-support` normal-flow mount. PSD Import now opens through the overlay task shell with clean human task content, legacy/debug panels are preserved only under the non-primary internal quarantine surface, and visible primary PSD task copy no longer exposes the internal `diagnosticsEvidenceView` route id.

Domain H may proceed with full/focused verification.

## 2. Orchestration Compliance

- Source/test implementation was delegated to Gnome (`019ea47b-3c77-7cf1-8475-fb3bdebb2c02`).
- Independent clean-context review was delegated to Review-Sylph (`019ea492-4881-7ac3-a2e0-5832340d6090`).
- Orch-Sylph did not directly implement source/test changes.
- Review-Sylph wrote the persistent review artifact and returned `pass`.
- No user decision was required.

## 3. Basis

Primary basis:

- `discussion/implementation/orchestration/wave55-plan.md`
- Domain A-F reports/reviews under `discussion/implementation/waves/wave55/` and `discussion/implementation/reviews/wave55/`
- `discussion/design/screen-design/inventories/ui-reset-inventory-primary-ui-quarantine.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-state-operation-contracts.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`

## 4. Changed Files

Domain G source/test changes:

- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/app-shell/primary-human-shell.ts`
- `apps/editor/src/ui/app-shell/primary-human-shell.test.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`

Domain G persistent artifacts:

- `discussion/implementation/waves/wave55/wave55-domain-g-app-shell-primary-cutover-integration-report.md`
- `discussion/implementation/reviews/wave55/wave55-domain-g-app-shell-primary-cutover-integration-review.md`

Note: B-F source/test/doc artifacts remain part of the current Wave55 worktree and were consumed, not reverted. E2E execution also left `.tmp-editor-vite.log` and `.tmp-editor-vite.err.log` as untracked verification logs.

## 5. Implementation Summary

Gnome integrated B-E outputs into the live App Shell:

- `createEditorAppShell(...)` now builds the normal shell through `createPrimaryHumanShell(...)`.
- The old `createWorkspaceSupportRegion([...])` normal-flow mount is no longer used by the live App Shell.
- `createPrimaryHumanShell(...)` accepts an optional `taskWindowSurface` slot, so the active task remains scoped to the primary workspace while using Domain C's fixed overlay task shell.
- Legacy/debug/evidence/Codex-heavy panels are passed as individual nodes into `createLegacyDebugQuarantineSurface([...])`, then mounted under a hidden internal surfaces host with non-primary metadata.
- `editor-app.ts` now focuses active task windows with `preventScroll: true`, matching the no-scroll launch UX gate.
- `ExplicitPsdImportTaskObservationState` still preserves `detailSurface: "diagnosticsEvidenceView"` for structured routing, but human-visible summary text now says `Diagnostics / Evidence` instead of exposing the route id.
- PSD task content keeps clean visible copy while restoring raw detail facts as hidden/test-facing state where existing focused coverage needs structured evidence.

## 6. Verification

Gnome and Review-Sylph performed targeted verification. Passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/primary-human-shell.test.ts apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - 4 files / 63 tests passed.
- `pnpm.cmd typecheck`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node --check apps/editor/e2e/task-window-ux-focused-gate.mjs`
- `node --check apps/editor/e2e/png-evidence.mjs`
- `node scripts/run-focused-e2e.mjs --id taskWindowUxFocused`
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`

Review-Sylph also checked that:

- `createWorkspaceSupportRegion` is not called by live `app-shell.ts`.
- `taskWindowUxFocused` passes with desktop/mobile geometry, no-scroll, center stacking, forbidden primary text, and PNG evidence assertions intact.
- Production visible PSD task copy no longer contains `Details: diagnosticsEvidenceView` or equivalent route-id copy.

## 7. Review Result

Review artifact:

- `discussion/implementation/reviews/wave55/wave55-domain-g-app-shell-primary-cutover-integration-review.md`

Review verdict:

- `pass`

Blocking findings:

- None.

## 8. Residual Risks

- Full suite was not run in Domain G. Domain H should continue with the planned full/focused verification set.
- The quarantine surface is a hidden internal host in Wave55 v0. Final route/drawer/dev-only presentation remains deferred.
- `explicit-psd-import-panel.ts` remains large. Source organization guard passes and focused coverage is intact, but later PSD UX polish should consider splitting helper/projection responsibilities.
- Final all-tool task-window modality policy remains deferred; Domain G proves the Wave55 fixed overlay/window v0 integration.

## 9. User-Decision Points

None blocking Domain G. Deferred Wave55 plan items remain non-blocking:

- final quarantine surface form;
- final task-window/dedicated-view policy;
- final Product Preflight owner;
- next authoring workflow promotion order.

## 10. Handoff

Domain H may run full/focused verification. Recommended next checks are the Wave55 plan's regression set, especially:

- `taskWindowUxFocused`
- `taskWindowRoutingFocused`
- the five existing PSD focused IDs
- production testid boundary guard
- source/dependency guards
- desktop/mobile startup first-viewport cleanliness

