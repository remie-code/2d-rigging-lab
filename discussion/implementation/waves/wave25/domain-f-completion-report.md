# Wave25 Domain F Completion Report

> Target: `wave25-rig-control-e2e-and-persistence-smoke`
> Date: 2026-06-01
> Orch-Sylph: current context
> Gnome implementation: `019e80a2-3777-73b2-ae68-df7f5fd015ae` / Gnome the 57th
> Review-Sylph: `019e80b5-65c7-7a02-81dc-b041b54624f5` / Sylph the 58th
> Status: `pass`

## Summary

Domain F is `pass`.

Gnome added a focused browser smoke for the project-defined Rig Controls workflow. The smoke uses the real Domain E UI forms and buttons to create parent and child `rotation2d` rig controls, bind the child rig control to the parent, bind `draw_body` to the child rig control, inspect Preview and Viewer / Runtime semantic evidence, save to browser-local project storage, reload/load, and verify authored rig controls plus child binding persist.

Review-Sylph independently reviewed the required basis documents, actual changed files, current diff/status, Gnome report, and verification commands. The review returned `pass` with no blocking, high, medium, low, or needs-fix findings.

This domain does not implement broad editor, runtime, operation, or validator fixes. It does not add asset I/O, file picker, parser, image decode, external dependency, package manifest/lockfile changes, Cubism SDK/Core, Cubism Viewer compatibility, Cubism Physics compatibility, direct physics, or warp lattice evaluator behavior.

## Changed Files

E2E:

- `apps/editor/e2e/rig-control-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`

Reports:

- `discussion/implementation/waves/wave25/domain-f-gnome-implementation-report.md`
- `discussion/implementation/reviews/wave25/domain-f-review.md`
- `discussion/implementation/waves/wave25/domain-f-completion-report.md`

Shared worktree note:

- Wave25 Domain A-E source/test/report changes were already present in the shared dirty worktree and were not reverted.

## Implemented Evidence

- The new rig-control smoke is integrated into the existing desktop/mobile editor smoke loop in `apps/editor/e2e/smoke-checks.mjs`.
- The smoke creates parent and child `rotation2d` rig controls through `rigControl.create.form` and `rigControl.create`.
- The smoke binds child rig control and drawable targets through `rigControl.bind.form` and `rigControl.bind`.
- The smoke confirms operation status/log, generated runtime/validation evidence, authored rig-control rows, Preview-side affected-target evidence, and Viewer / Runtime rig-control evidence.
- Browser-local save/load is verified by checking persisted `model/rig-controls.json`, operation log JSONL, package revision, target IDs, generated runtime artifacts, generated validation artifacts, and post-load UI restoration.
- Viewer / Runtime is reopened after load and shows evaluated rig-control count, hierarchy order, affected drawable evidence, runtime diff, and no diagnostics.
- Accessibility basics are checked through panel name, form aria labels, submit text, and field labels/control names.
- Horizontal overflow checks continue after the rig-control smoke and after reset.

## Verification

Gnome and Review-Sylph reported the following verification as passing:

| Check | Result |
|---|---|
| `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs` | pass |
| `pnpm.cmd test:e2e` | pass; desktop and mobile smoke passed |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |
| Manifest/lockfile dirty-status check | pass; no output |
| Targeted forbidden-scope scan over Domain F files | pass; no matches |

Gnome also reported one initial `pnpm.cmd test:e2e` failure caused by an over-specific transient load-status assertion. Gnome fixed the assertion to require persisted graph/evidence instead, then reran the full e2e suite successfully.

## Review Result

Review artifact: `discussion/implementation/reviews/wave25/domain-f-review.md`.

Verdict: `pass`.

Findings:

- No blocking findings.
- No high, medium, or low findings.
- No needs-fix findings.
- No Gnome fix loop required.

Review-Sylph confirmed design/development compliance, source organization compliance, dependency policy compliance, forbidden-scope compliance, real-UI e2e workflow coverage, save/load persistence coverage, Viewer / Runtime evidence coverage, desktop/mobile integration, and accessibility/layout basics.

## Residual Risks

- Verification ran in a shared dirty Wave25 workspace, not a fresh checkout replay.
- Browser e2e proves user-visible semantic evidence and persisted package JSON. It intentionally does not prove pixel rendering or exact matrix math.
- Exact rig-control transform determinism remains covered by Domains B/D runtime and fixture tests.
- The focused rig-control smoke is integrated into the full editor e2e runner rather than exposed as a separate package script, to avoid manifest changes in Domain F.

## User Decision Points

None.

No source-document conflict, dependency approval need, forbidden-scope need, or unclear module boundary remains for Domain F.
