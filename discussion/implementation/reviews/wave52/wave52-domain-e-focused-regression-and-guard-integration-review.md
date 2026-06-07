# Wave52 Domain E Review: Focused Regression / Guard Integration

Target: `wave52-focused-regression-and-guard-integration`
Reviewer role: independent clean Review-Sylph

## verdict

`pass`

Blocking findings: none.

The Domain E package-script integration is narrow and acceptable. `package.json` adds script names for the production `data-testid` guard and its fixture regression guard, and standard `check` appends only `pnpm run check:testids`. The fixture guard is intentionally exposed but not included in standard `check`, and no dependency, lockfile, source, script, broad e2e aggregate, or product capability churn was introduced by the Domain E package change.

## Scope Reviewed

- `package.json`
- Focused PSD e2e diffs already changed by Domain D and re-run by Domain E:
  - `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`
  - `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs`
  - `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
  - `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
  - `apps/editor/e2e/psd-import-focused-smoke.mjs`
- Existing guard scripts:
  - `scripts/check-production-testid-boundary.mjs`
  - `scripts/check-production-testid-boundary-fixtures.mjs`
- Focused e2e registry references for required PSD focused IDs.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/waves/wave52/wave52-domain-a-boundary-component-contract-inventory-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-a-boundary-component-contract-inventory-review.md`
- `discussion/implementation/waves/wave52/wave52-domain-b-generic-task-shell-task-chrome-component-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-b-generic-task-shell-task-chrome-component-review.md`
- `discussion/implementation/waves/wave52/wave52-domain-c-psd-import-task-human-ui-component-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-c-psd-import-task-human-ui-component-review.md`
- `discussion/implementation/waves/wave52/wave52-domain-d-psd-import-task-integration-observation-bridge-report.md`
- `discussion/implementation/reviews/wave52/wave52-domain-d-psd-import-task-integration-observation-bridge-review.md`
- `discussion/implementation/waves/wave51/wave51-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

Blocking findings: none.

No `needs_changes` or `escalate` finding was identified.

### Package-script guard integration

Pass.

- `package.json` adds `check:testids` as `node scripts/check-production-testid-boundary.mjs`.
- `package.json` adds `check:testids:fixtures` as `node scripts/check-production-testid-boundary-fixtures.mjs`.
- Standard `check` now ends with `pnpm run check:testids` only.
- Standard `check` does not include `check:testids:fixtures`.
- Standard `check` does not add focused e2e, aggregate e2e, or broad quality-gate aggregation.
- `devDependencies` are unchanged.
- Diff inspection found no lockfile churn; the relevant changed-file list for `package.json` and lockfiles showed only `package.json`.

This matches Domain A's conditional allowance for narrow package-script integration and Domain E's purpose.

### Focused PSD regressions

Pass.

The five required focused PSD e2e IDs remain registered and present:

- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`

The focused e2e diffs do not remove the existing workflow assertions. They replace the initial direct wait for `explicitPsdImportPanel` with `openExplicitPsdImportTask(page)`, and add the same reopen step after project load where the task panel is hidden by the new task-shell routing. The helper first checks whether the legacy `explicitPsdImportPanel` hook is already mounted; if not, it waits for and clicks `psdImportTaskOpen`, then waits for `explicitPsdImportPanel`. This is a task-migration precondition update, not a weakening of the PSD assertions.

Domain E Orch-Sylph supplied approved run evidence for all required focused PSD IDs:

- `psdStructuralInitialStateFocused`: passed; key evidence included `byteLength=22406225`, source-order approval preserved, structural groups, runtime-hidden drawable, and `codex=ok`.
- `psdImportPlanCodexFocused`: passed; key evidence included `candidates=126`, approved `front hair`, `materializedBytes=1537600`, and stale context rejected.
- `psdImportPlanFocused`: passed; key evidence included `candidates=126`, approved `headwear,eyewear,tie/tie`, `materializedBytes=810360`, and `portableBundleBytes=1357158`.
- `psdMultiLayerBatchFocused`: passed; key evidence included `materializedBytes=810360` and layers `headwear,eyewear,tie/tie`.
- `psdImportFocused`: passed; key evidence included `materializedBytes=460800`, `drawable=draw_headwear`, and `texture=tex_headwear`.

### Production `data-testid` guard

Pass.

- `pnpm.cmd run check:testids` passed in this review with `Production data-testid boundary guard passed.`
- `pnpm.cmd run check:testids:fixtures` failed in sandbox because fixture execution spawns child Node processes and hit `spawnSync C:\Program Files\nodejs\node.exe EPERM`.
- The same fixture command passed after approved escalated rerun with `Production data-testid boundary fixture regressions passed: 5 cases.`
- The supplied Domain E Orch-Sylph evidence also reported both direct Node guard commands passing, with the same sandbox EPERM pattern for the fixture guard and approved rerun success.

The production guard remains static and scoped to production source under `apps/editor/src`, excluding tests and e2e. That is consistent with the Wave51/52 guard boundary.

### Source organization and scope constraints

Pass.

Domain E's source-facing implementation change is package-only. It does not edit `apps/**`, `packages/**`, `scripts/**`, `index.ts`, or catch-all source files. The five focused e2e changes were Domain D migration preconditions and remain within the focused regression scope. The source organization policy is not put at risk by adding package scripts.

No new Mesh, Atlas, Parameter, Variant, semantic recognition, proposal generation, auto-rigging, auto-fix, external transport, renderer/pixel oracle, Cubism, public demo asset, persisted source PSD bytes, or raw parser object capability was introduced. A zero-context added-line scan of the reviewed diff found no forbidden-scope hits.

## Verification Assessed / Run

Assessed Domain E Orch-Sylph evidence:

- `node scripts/check-production-testid-boundary.mjs`: pass.
- `node scripts/check-production-testid-boundary-fixtures.mjs`: sandbox EPERM, approved rerun pass with 5 cases.
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`: approved rerun pass.
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`: approved rerun pass.
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`: approved rerun pass.
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`: approved rerun pass.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`: approved rerun pass.
- `pnpm.cmd run check:testids`: pass.
- `pnpm.cmd run check:testids:fixtures`: sandbox EPERM, approved rerun pass with 5 cases.
- `git diff --check -- package.json`: pass with LF/CRLF warning only.

Additionally run during this review:

- `pnpm.cmd run check:testids`: pass.
- `pnpm.cmd run check:testids:fixtures`: sandbox EPERM; approved rerun pass with 5 cases.
- `git diff --check -- package.json` plus the five focused PSD e2e files: pass with LF/CRLF warnings only.
- `node scripts/check-focused-e2e-registry.mjs`: pass; 24 entries, 14 aggregate-discoverable, 10 standalone direct.
- Diff/file checks confirmed the relevant package/lockfile set changed only `package.json`.
- Reviewed `git diff -- package.json` and `git diff --` for the five focused PSD e2e files.
- Reviewed `scripts/check-production-testid-boundary.mjs` and `scripts/check-production-testid-boundary-fixtures.mjs`.

The full focused PSD e2e commands were not re-run a second time by this reviewer because Domain E provided approved pass evidence for all required IDs, and the reviewer independently confirmed the e2e diffs did not weaken the existing assertions.

## Residual Risks / Deferred Debt

- The production `data-testid` guard is still static text/regex based. It can miss dynamic selector construction or unusual indirection and should not be treated as a semantic behavior proof.
- Fixture guard execution spawns child Node processes, so it may require elevated execution in this managed sandbox. Keeping fixture guard out of standard `check` is reasonable for now.
- Standard `check` now includes the production guard but not fixture regressions. Broader fixture placement in routine CI remains a future quality-gate policy decision.
- Focused PSD e2e still depends on stable DOM hooks and task-opening preconditions. This is acceptable for Wave52 but remains debt until later screen-design waves reduce DOM/text oracle dependence.
- Final toolbox placement, modal/task-window/dedicated-view policy, and Diagnostics / Evidence View placement remain future design decisions.

## User-Decision Points

No immediate user decision is required for Domain E.

Future user-decision points remain:

- whether `check:testids:fixtures` should become part of a broader standard quality gate or CI-only guard path;
- final Toolbox placement for the PSD Import task entry;
- final modal/task-window/dedicated-view policy;
- final Diagnostics / Evidence View and Codex / Automation View placement.
