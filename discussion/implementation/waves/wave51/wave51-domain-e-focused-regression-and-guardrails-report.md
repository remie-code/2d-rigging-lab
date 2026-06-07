# Wave51 Domain E Focused Regression / Guardrails Report

- Domain: `wave51-focused-regression-and-guardrails`
- Verdict: `pass`
- Scope: focused PSD regression verification and production `data-testid` boundary guard
- Orchestration: guard implementation was delegated to Gnome; clean review was delegated to Review-Sylph

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
- `discussion/implementation/waves/wave51/wave51-domain-d-test-evidence-surface-preparation-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-d-test-evidence-surface-preparation-review.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Gnome Implementation Summary

Gnome changed:

- `scripts/check-production-testid-boundary.mjs`
- `scripts/check-production-testid-boundary-fixtures.mjs`
- `scripts/production-testid-boundary-fixtures/valid-assignments/apps/editor/src/valid-testid-assignment.ts`
- `scripts/production-testid-boundary-fixtures/valid-excluded-tests-and-e2e/apps/editor/src/component.test.ts`
- `scripts/production-testid-boundary-fixtures/valid-excluded-tests-and-e2e/apps/editor/e2e/smoke.ts`
- `scripts/production-testid-boundary-fixtures/invalid-selector-string/apps/editor/src/behavior.ts`
- `scripts/production-testid-boundary-fixtures/invalid-attribute-readback/apps/editor/src/behavior.ts`
- `scripts/production-testid-boundary-fixtures/invalid-dataset-read/apps/editor/src/behavior.ts`

Summary:

- Added `node scripts/check-production-testid-boundary.mjs` as a standalone production source guard.
- The guard scans `apps/editor/src` `.ts` / `.tsx` files by default and supports `--root` plus repeatable `--source-root` options.
- The guard excludes test/e2e paths and allows stable test-facing observation hooks via `dataset.testid = ...`, `dataset["testid"] = ...`, and `setAttribute("data-testid", ...)`.
- The guard fails on production `[data-testid...]` selector strings, `data-testid` attribute readbacks, and non-assignment `dataset.testid` / `dataset["testid"]` reads.
- Added fixture regression coverage for valid assignments, valid test/e2e exclusions, invalid selector strings, invalid attribute readbacks, and invalid dataset reads.
- Did not edit `package.json`; Domain E write scope did not include package script wiring.

## Review-Sylph Result

- Review verdict: `pass`
- Review path: `discussion/implementation/reviews/wave51/wave51-domain-e-focused-regression-and-guardrails-review.md`
- Findings: none

Review confirmed:

- Domain E guardrail requirement is satisfied without product implementation or broad e2e expansion.
- `data-testid` remains allowed as a test-facing observation hook while production behavior dependency patterns are blocked.
- Exclusions and fixtures are appropriate and do not hide production behavior coupling.
- Source organization is acceptable for implementation-owned tooling.
- No forbidden Mesh / Atlas / Parameter / Variant capability, semantic recognition, proposal generation, auto-fix, external transport, renderer/pixel oracle, Cubism, or public demo asset work was introduced.

## Verification

- `node scripts/run-focused-e2e.mjs --check`
  - Passed: 24 entries.
- `node scripts/check-production-testid-boundary.mjs`
  - Passed.
- `node scripts/check-production-testid-boundary-fixtures.mjs`
  - Initial sandbox run failed with child-process `EPERM`.
  - Approved rerun passed: 5 fixture cases.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- scripts`
  - Passed.

Focused PSD regressions:

- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`
  - Initial sandbox run failed while loading Vite config with `spawn EPERM`.
  - Approved rerun passed: `codex=ok`, `runtimeHidden=draw_headwear_psd_root_layer_1_structural`.
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
  - Approved run passed: `approved=front hair`, stale context rejected.
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
  - Approved run passed: `candidates=126`, `approved=headwear,eyewear,tie/tie`, `materializedBytes=810360`.
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
  - Approved run passed: `layers=headwear,eyewear,tie/tie`, `materializedBytes=810360`.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
  - Approved run passed: `drawable=draw_headwear`, `texture=tex_headwear`, `materializedBytes=460800`.

Review-Sylph also verified:

- `node scripts/check-production-testid-boundary.mjs`: passed.
- `node scripts/check-production-testid-boundary-fixtures.mjs`: sandbox `EPERM`, approved rerun passed 5 cases.
- `node scripts/run-focused-e2e.mjs --check`: passed, 24 entries.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- scripts`: passed.
- Review artifact whitespace check: passed.

## Residual Risks / Deferred Debt

- The production `data-testid` guard is a focused static text/regex guard, not a TypeScript AST or runtime behavior analyzer. Dynamic selector construction or indirect aliases could evade it.
- The guard is standalone and is not wired into `package.json` because package script changes were outside Domain E's allowed write scope.
- The default scan root is `apps/editor/src`. Future production code outside that root needs an explicit `--source-root` invocation or a broadened default.
- The new guard files and fixtures are currently untracked and must be included by final integration.
- Existing DOM/text e2e oracles remain intentionally in place. Broad migration to structured test-facing surfaces remains deferred.

## Domain F Start

Domain F may start.

Reason:

- Domains A-D are `pass`.
- Gnome implementation for Domain E is complete.
- Clean Review-Sylph review is `pass`.
- Required focused PSD regressions passed.
- Production `data-testid` behavior dependency guard and fixture regressions passed.

## User-Decision Points

None.
