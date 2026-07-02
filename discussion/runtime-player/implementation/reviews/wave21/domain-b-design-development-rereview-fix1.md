# Review: Wave21 Domain B Design / Development Compliance Rereview Fix 1

- Verdict: pass
- Reviewer: Review-Sylph
- Mode: source read-only; wrote only this delegated review artifact

## Findings

None.

## Fix Verification Notes

- Previous finding is fixed. `apps/runtime-player/src/control/dynamics-tune-page.tsx` no longer visibly renders `group.groupId` in the group card header; the visible subtitle is now the compact count from `formatGroupParameterCounts(group)` at `apps/runtime-player/src/control/dynamics-tune-page.tsx:233`.
- `group.groupId` remains only in appropriate internal paths: React key at `apps/runtime-player/src/control/dynamics-tune-page.tsx:193`, update payloads at `apps/runtime-player/src/control/dynamics-tune-page.tsx:243` and `apps/runtime-player/src/control/dynamics-tune-page.tsx:340`, and reset payload at `apps/runtime-player/src/control/dynamics-tune-page.tsx:254`.
- Replacement context is compact and non-sensitive for Control Window use: the card shows input/output counts at `apps/runtime-player/src/control/dynamics-tune-page.tsx:431`, plus read-only input/output summaries at `apps/runtime-player/src/control/dynamics-tune-page.tsx:260` and `apps/runtime-player/src/control/dynamics-tune-page.tsx:297`. The summary formatter caps visible refs to three entries plus a count at `apps/runtime-player/src/control/dynamics-tune-page.tsx:415`.
- The regression is covered by `apps/runtime-player/src/control/dynamics-tune-page.test.ts:51` and `apps/runtime-player/src/control/dynamics-tune-page.test.ts:60`, which assert the compact count is rendered and the raw `grp_hair` id is not.
- The new exported helpers in `apps/runtime-player/src/control/control-window-app.tsx` are narrow testable seams: input diagnostics visibility policy at `apps/runtime-player/src/control/control-window-app.tsx:631`, dynamics status bridge wiring at `apps/runtime-player/src/control/control-window-app.tsx:641`, and Dynamics Tune route action wiring at `apps/runtime-player/src/control/control-window-app.tsx:659`. I did not find catch-all API expansion or source organization issues.
- Dynamics Tune remains in the accepted navigation order after Mapping and before Stage at `apps/runtime-player/src/control/control-window-shell.tsx:19` through `apps/runtime-player/src/control/control-window-shell.tsx:25`, with test coverage at `apps/runtime-player/src/control/live-controller-page.test.ts:123`.
- Raw input diagnostics remain hidden on the Dynamics Tune page by `shouldRenderInputDiagnosticsPanel` at `apps/runtime-player/src/control/control-window-app.tsx:631`, with coverage at `apps/runtime-player/src/control/live-controller-page.test.ts:165`.

## Basis Docs Used

- `discussion/runtime-player/implementation/orchestration/player-wave21-plan.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md`
- `discussion/runtime-player/implementation/reviews/wave21/domain-b-design-development-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Files Reviewed

- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.test.ts`
- `apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts`
- `apps/runtime-player/src/control/live-controller-page.test.ts`

## Verification Performed

- `node scripts/check-source-organization.mjs`: pass.
- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts apps/runtime-player/src/control/live-controller-page.test.ts`: pass after escalation, 3 files / 13 tests. The first sandboxed attempt failed before tests with `spawn EPERM` while Vitest/esbuild loaded config.
- `git diff --check -- apps/runtime-player/src/control/control-window-shell.tsx apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/control/dynamics-tune-page.tsx apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts apps/runtime-player/src/control/live-controller-page.test.ts`: pass, CRLF warnings only.
- `git diff --name-only -- apps/editor packages package.json pnpm-lock.yaml`: no output.
- `pnpm install`: not run.

## Remaining Manual Checks

- Manually inspect Control Window at narrow and desktop widths with long Dynamics Group display names and long input/output display names.
- Open a real Runtime Export with visible dynamics and confirm Dynamics Tune slider changes affect Native Stage immediately.
- Confirm Browser Source follows the same effective tuning during final integration.
- Confirm profile save failure surfaces Retry without adding manual Save semantics.
- Confirm Runtime Export artifacts remain unmodified on disk during end-to-end use.

## User Decision Points

None.
