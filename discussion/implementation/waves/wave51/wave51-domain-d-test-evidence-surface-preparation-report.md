# Wave51 Domain D Test / Evidence Surface Preparation Report

- Domain: `wave51-test-evidence-surface-preparation`
- Verdict: `pass`
- Scope: minimal PSD Import Task structured observation surface
- Orchestration: source implementation was delegated to Gnome; clean review was delegated to Review-Sylph

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/waves/wave51/wave51-domain-a-boundary-coupling-target-inventory-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-a-boundary-coupling-target-inventory-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-b-psd-import-production-coupling-removal-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-b-psd-import-production-coupling-removal-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-c-task-view-shell-foundation-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-c-task-view-shell-foundation-review.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Gnome Implementation Summary

Gnome changed:

- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts`
- `apps/editor/src/editor-state/index.ts`

Summary:

- Added `projectExplicitPsdImportTaskObservation(state)` as a pure editor-state projector for a minimal PSD Import Task observation surface.
- Exposed source loaded state, parse status, selected scope refs, import-plan preview/approval/readiness/warning status, structural scaffold preview/approval/readiness/warning status, and evidence detail availability/counts.
- Kept concise human summary separate from machine-only details. Operation IDs, approval IDs, digests, generated refs, evidence paths, raw parser payloads, command payloads, and parser-private shapes are not copied into the concise summaries.
- Routed detailed evidence/debug availability to `diagnosticsEvidenceView` without implementing a full Diagnostics / Evidence View.
- Kept existing UI text, `data-testid` hooks, e2e DOM oracles, command host, and `packages/ai-interface` schemas untouched.
- Follow-up Gnome fix tightened structural scaffold approval status from an open string to an explicit local union and added blocked-status coverage.

## Review-Sylph Result

- Review verdict: `pass`
- Review path: `discussion/implementation/reviews/wave51/wave51-domain-d-test-evidence-surface-preparation-review.md`
- Findings: none

Review confirmed:

- Domain D stayed inside minimal structured state/status/evidence preparation.
- Human summary and evidence boundary do not leak machine-only refs or raw/debug payloads.
- Existing UI/test/Codex-facing compatibility was not weakened.
- No forbidden Product Preflight redesign, full Diagnostics / Evidence implementation, external transport, repo-side proposal/repair generation, ai-interface churn, or Mesh / Atlas / Parameter / Variant capability was introduced.
- Source organization remains acceptable; `index.ts` remains barrel-only.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts`
  - Sandbox run failed with `spawn EPERM`.
  - Approved rerun passed: 1 file, 5 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/editor/src/editor-state discussion/implementation/waves/wave51 discussion/implementation/reviews/wave51`
  - Passed with only the existing LF/CRLF warning on `apps/editor/src/editor-state/index.ts`.

Review-Sylph also performed:

- Direct review of the untracked new source/test files.
- `git diff --check -- apps/editor/src/editor-state discussion/implementation/waves/wave51 discussion/implementation/reviews/wave51`
  - Passed with only the LF/CRLF warning.
- `node scripts/check-source-organization.mjs`
  - Passed.
- Focused static searches for projector usage, forbidden-scope terms, UI/test-id/command-surface churn, and machine-only ref leakage in the source projection.

## Residual Risks / Deferred Debt

- The structured observation surface is prepared but not yet consumed by UI, e2e, or Codex-facing read APIs.
- Existing DOM/text oracles remain in place intentionally. Broad migration from visible DOM/debug text to structured test helpers remains deferred.
- Domain D did not add the production `data-testid` behavior dependency guard; that remains a Domain E target.
- Product Preflight current-state read, final Diagnostics / Evidence View presentation, Codex / Automation placement, and structural-specific Codex execute/stale parity remain deferred.
- Tests cover one blocked structural approval status (`preflightBlocked`) but do not exhaust every structural approval status. This is acceptable for the narrow Domain D surface.

## Domain E Start

Domain E may start.

Reason:

- Domain A, B, and C are `pass`.
- Domain D implementation is complete.
- Clean Review-Sylph review is `pass`.
- Focused unit test, typecheck, source organization guard, and diff whitespace checks passed.

## User-Decision Points

None.
