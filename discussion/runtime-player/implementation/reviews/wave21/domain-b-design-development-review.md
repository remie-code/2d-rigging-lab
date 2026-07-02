# Review: Wave21 Domain B Design / Development Compliance

- Verdict: needs_changes
- Reviewer: Review-Sylph
- Mode: source read-only; wrote only this delegated review artifact

## Findings

### Medium: Dynamics Tune renders raw dynamics group IDs in the Control Window

- File: `apps/runtime-player/src/control/dynamics-tune-page.tsx:232`
- Evidence: `DynamicsTuneGroupCard` renders `{group.groupId}` directly under the user-facing group display name.
- Why this matters: Wave21 Domain B explicitly requires the Control UI to avoid raw tracking data, private paths, and debug-only internal data. The accepted UX asks for the group name plus compact input/output summaries, not raw `dynamicsGroupId` values. The ID is still appropriate as the React key and bridge command payload, but rendering it in the compact Control Window exposes implementation/package identity that is not needed for tuning.
- Recommended change: remove the visible group id subtitle, or replace it with non-sensitive user-facing context such as input/output counts. Keep `group.groupId` internal to event payloads and keys.

## Basis Docs Used

- `discussion/runtime-player/implementation/orchestration/player-wave21-plan.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md`
- `discussion/runtime-player/implementation/reviews/wave21/domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Files Reviewed

- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.test.ts`
- `apps/runtime-player/src/control/live-controller-page.test.ts`
- `apps/runtime-player/src/preload/dynamics-tuning-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.ts`
- `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-groups.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/live-controller-page.tsx`
- `apps/runtime-player/src/control/control-window-components.tsx`

## Compliance Notes

- Navigation order matches the Wave21 plan: Overview, Live Controller, Input, Mapping, Dynamics Tune, Stage, Performance Diagnostics.
- The new page uses existing Control Window primitives (`Panel`, `StatusRow`, `StatusPill`, `IconTextButton`, `ErrorNotice`) and compact row/card styling.
- The page exposes tuning-only controls: enabled, strength, limit, length, sway, reaction, convergence, and per-group reset. I did not find structural dynamics editing controls.
- Save handling follows the Mapping Profile pattern: automatic persistence with a retry action only when profile status is `save-failed`; no manual Save button was added.
- Control renderer bridge usage is narrow: update/reset/retry commands go through `window.runtimePlayer.dynamicsTuning`; the page does not directly import runtime-core or backend internals.
- `shouldRenderInputDiagnosticsPanel` now hides raw input diagnostics on `dynamics-tune`, preserving the no-raw-tracking-data posture for that page.
- Source organization guard passed. No implementation logic was added to `index.ts`, and the new `dynamics-tune-page.tsx` owns one cohesive Control Window page responsibility.
- No `package.json`, `pnpm-lock.yaml`, `packages/**`, or `apps/editor/**` changes were present in `git diff --name-only -- apps/editor packages package.json pnpm-lock.yaml`.
- Domain B reviewed files do not alter Browser Source transport. Browser Source files are changed in the worktree, but those align with Domain A scope and were covered by the Domain A report/review basis.

## Verification Performed

- `node scripts/check-source-organization.mjs`: pass.
- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/live-controller-page.test.ts`: pass, 2 files / 10 tests. This required escalation because the sandbox blocked esbuild service spawn with `EPERM`.
- `git diff --check -- apps/runtime-player/src/control/control-window-shell.tsx apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/control/dynamics-tune-page.tsx apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/live-controller-page.test.ts`: pass, CRLF warnings only.
- `git diff --name-only -- apps/editor packages package.json pnpm-lock.yaml`: no output.

## Verification Notes

- A first `pnpm.cmd exec vitest ...` attempt was aborted by pnpm before tests because this environment tried an internal install/deps-status path and hit `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. `pnpm install` was not run intentionally and did not complete. The generated `.pnpm-store/v11/index.db` side-effect was removed.

## Remaining Manual Checks

- After the raw group id display is removed, manually inspect the Control Window at narrow and desktop widths with long Dynamics Group display names.
- Open a real Runtime Export with dynamics and confirm slider changes visibly affect Native Stage immediately.
- Confirm Browser Source output follows the same effective tuning during final integration.
- Confirm profile save failure surfaces a retry path without adding manual save semantics.

## User Decision Points

- None. The finding is a design/development compliance cleanup within the accepted Wave21 scope.
