# Wave52 Domain E Report: Focused Regression / Guard Integration

> Target: `wave52-focused-regression-and-guard-integration`
> Role: Domain E Orch-Sylph focused regression / guard orchestration
> Verdict: `pass`

## Verdict

`pass`

Domain E focused regression and guard integration passed. The required PSD focused e2e IDs passed, the production `data-testid` guard and fixture guard passed, and the narrow package-script integration was implemented and accepted by clean Review-Sylph.

Mandatory separation basis:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Orch-Sylph did not perform source implementation. The only source-facing change was delegated to Gnome, and the clean review was delegated to Review-Sylph.

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

## Gnome Implementation Summary

Gnome verdict: `pass`

Changed files:

- `package.json`

Implemented:

- Added `check:testids`: `node scripts/check-production-testid-boundary.mjs`.
- Added `check:testids:fixtures`: `node scripts/check-production-testid-boundary-fixtures.mjs`.
- Updated standard `check` to append `pnpm run check:testids`.
- Intentionally did not add `check:testids:fixtures` to standard `check`.

Gnome did not edit lockfiles, scripts, apps, packages, e2e files, or discussion files. No dependency or package manager metadata churn was introduced.

## Package-Script Guard Integration Decision

Decision: completed.

Rationale:

- Domain A explicitly allowed Domain E to add standard package-script integration if the change was narrow, dependency-free, lockfile-free, and accepted by Review-Sylph.
- Domain D handed off the same choice to Domain E as either narrow integration or reviewed deferral.
- The implemented change is limited to `package.json` scripts.
- Standard `check` now runs only the repository production `data-testid` guard, not fixture regressions or focused e2e.
- Fixture regressions remain available through `check:testids:fixtures` for focused guard validation without broadening the standard check path.

Review-Sylph accepted this placement as narrow and safe.

## Review-Sylph Result

Review-Sylph verdict: `pass`

Review path:

- `discussion/implementation/reviews/wave52/wave52-domain-e-focused-regression-and-guard-integration-review.md`

Review summary:

- Blocking findings: none.
- Confirmed package-script integration is narrow.
- Confirmed standard `check` appends only `pnpm run check:testids`.
- Confirmed no dependency, lockfile, script-source, broad e2e aggregation, or product capability churn.
- Confirmed the five focused PSD e2e IDs remain registered and present.
- Confirmed focused e2e diffs preserve assertions and add only the task-opening precondition.
- Confirmed production guard and fixture guard passed.
- Confirmed no forbidden Mesh / Atlas / Parameter / Variant or related product-scope drift.

## Verification Commands / Results

| Command | Result |
|---|---|
| `node scripts/check-production-testid-boundary.mjs` | `pass`; `Production data-testid boundary guard passed.` |
| `node scripts/check-production-testid-boundary-fixtures.mjs` | sandbox run failed with `spawnSync C:\Program Files\nodejs\node.exe EPERM`; approved rerun `pass`, `5` cases |
| `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused` | sandbox run failed with Vite/esbuild `spawn EPERM`; approved rerun `pass`; `byteLength=22406225`, source-order approval preserved, groups `part_hair_front_group_psd_root_group_2_structural` and `part_tie_group_psd_root_group_6_structural`, runtime-hidden `draw_headwear_psd_root_layer_1_structural`, `codex=ok` |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` | approved run `pass`; `candidates=126`, approved `front hair`, `materializedBytes=1537600`, stale context rejected |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | approved run `pass`; `candidates=126`, approved `headwear,eyewear,tie/tie`, `materializedBytes=810360`, `portableBundleBytes=1357158` |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | approved run `pass`; `materializedBytes=810360`, layers `headwear,eyewear,tie/tie` |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | approved run `pass`; `materializedBytes=460800`, `drawable=draw_headwear`, `texture=tex_headwear` |
| `pnpm.cmd run check:testids` | `pass` |
| `pnpm.cmd run check:testids:fixtures` | sandbox run failed with fixture `spawnSync ... EPERM`; approved rerun `pass`, `5` cases |
| `git diff --check -- package.json` | `pass`; LF/CRLF warning only |
| `git diff --check -- discussion/implementation/reviews/wave52/wave52-domain-e-focused-regression-and-guard-integration-review.md` | `pass` |

Review-Sylph additionally reported:

- `node scripts/check-focused-e2e-registry.mjs`: `pass`; `24` entries, `14` aggregate-discoverable, `10` standalone direct.
- `git diff --check` over `package.json`, the five focused PSD e2e files, and the review artifact: `pass` with LF/CRLF warnings only.

## Residual Risks / Deferred Debt

- The production `data-testid` guard remains static text/regex based and can miss dynamic selector construction or unusual indirection.
- `check:testids:fixtures` may require elevated execution in this managed sandbox because it spawns child Node processes.
- Fixture regressions are exposed as a package script but are not part of standard `check`; broader CI placement remains a future quality-gate policy decision.
- Focused PSD e2e still relies on stable DOM hooks and the new task-opening precondition.
- Final Toolbox placement, modal/task-window/dedicated-view policy, and Diagnostics / Evidence View / Codex Automation View placement remain future design decisions.

## Domain F Handoff

Domain F may start.

Domain F should record Wave52 PSD Import Task Migration as done only in the bounded sense established by Domains D/E:

- PSD Import is reachable as a Task Shell task.
- PSD focused e2e preservation passed.
- Production `data-testid` guard passed and is now integrated into standard `check`.
- Fixture guard remains available as `check:testids:fixtures` but is not part of standard `check`.
- Final task placement and broader screen-design separation decisions remain future work.

## User-Decision Points

No immediate user decision is required for Domain E.

Future user-decision points remain:

- whether `check:testids:fixtures` should become part of a broader standard quality gate or CI-only guard path;
- final Toolbox placement for the PSD Import task entry;
- final modal/task-window/dedicated-view policy;
- final Diagnostics / Evidence View and Codex / Automation View placement.
