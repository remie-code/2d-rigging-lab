# Wave48 Final Blocker Fix Report

> Verdict: `pass` for H-F1/H-F2 follow-up fix only

## Summary

H-F1 and H-F2 are addressed in the current worktree. This does not mark Wave48 final `pass` or make Wave48 the latest implementation-proven baseline; Domain H must rerun final verification and clean review before that decision.

The Gnome implementation pass returned `escalate` because directly moving `psdImportPlanFocused` into `wave42FocusedE2eRegistryBoundary.entries` would duplicate the same id/path already present in `scripts/focused-e2e-registry.mjs` post-Wave42 overlay. Editing that registry implementation is outside this fix scope and was forbidden. The final fix keeps that file untouched and records the new focused smoke as intentionally registered Wave42 boundary data.

## Changes

- `scripts/wave42-focused-e2e-boundary.mjs`: adds `postWave42FocusedE2eRegistryEntries` with `psdImportPlanFocused`, path `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`, command `node apps/editor/e2e/psd-import-plan-focused-smoke.mjs`, and category `assetIoBoundary`.
- `scripts/check-wave42-quality-gate-boundary.mjs`: validates base Wave42 focused entries plus post-Wave42 boundary entries as one registered set, including required keys, lower-camel ids, duplicate ids, duplicate paths, root containment, `*-smoke.mjs` shape, helper/aggregate exclusions, exact `node <path>` command, and file existence.
- `discussion/_map.md`: replaces stale Domain A-only / Domain B/C continuation wording with A-G pass evidence plus Domain H `needs_fix` rerun pending status.

## Verification

| Command / check | Result |
|---|---|
| `node scripts/check-wave42-quality-gate-boundary.mjs` | pass: `Wave42 quality gate boundary guard passed: 5 categories, 22 focused e2e entries, 9 explicit non-goals.` |
| `node scripts/check-wave42-quality-gate-boundary.mjs --json` | pass: `verdict` is `pass`, `summary.focusedE2eEntryCount` is `22`, and `findings` is empty. |
| `node scripts/check-focused-e2e-registry.mjs` | pass: `Focused e2e registry check passed: 22 entries, 14 aggregate-discoverable, 8 standalone direct.` |
| `git diff --check -- scripts discussion/_map.md discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48` | pass with Git LF-to-CRLF working-copy warnings only. |
| `rg -n "Domain A pass証跡\|Domain B/C\|Domain A report/review\|Domain A passはcurrent-worktree evidence\|Domain A-only\|only Domain A" discussion/_map.md` | pass by absence: exit 1, no matches. |

## Scope Notes

- `scripts/focused-e2e-registry.mjs` was already modified before this follow-up task started; this fix did not edit it.
- No app/product source, package source, e2e implementation, dependency manifests, lockfiles, generated assets, fixtures, or test data were edited by this follow-up fix.
- Wave48 remains `needs_fix` until Domain H reruns and returns `pass`.
