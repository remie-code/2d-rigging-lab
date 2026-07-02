# Runtime Player Wave21 Final Design/Development/Regression Review

- Verdict: pass
- Reviewer: Review-Sylph
- Mode: read-only source/docs review; wrote only this report artifact

## Scope Reviewed

- Wave21 plan, wave planning conventions, Runtime Player development policy, Runtime Player maps/screens/architecture/backlog docs, and Wave21 Domain A/B reports/reviews.
- Runtime Player source diffs under `apps/runtime-player/src/control`, `apps/runtime-player/src/main`, `apps/runtime-player/src/preload`, and `apps/runtime-player/src/stage`.
- Forbidden-scope guards for Editor source, shared packages/package-format schema surface, dependencies, lockfile, and workspace package metadata.
- Regression-sensitive paths: Mapping/Profile boundaries, Stage Motion display transform, Variant switching, Browser Source transport, local preview suspension, Performance Diagnostics metrics posture, and Wave20 Control-close / Stage-reopen lifecycle documentation.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave21-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/dynamics-tune-profile.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/browser-source-output-probe-v0.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/implementation/waves/wave21/_map.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-b-dynamics-tune-control-page-report.md`
- `discussion/runtime-player/implementation/reviews/wave21/_map.md`
- Domain A/B spec, design/development, and test adequacy review artifacts under `discussion/runtime-player/implementation/reviews/wave21/`

## Findings

None.

Informational scope note: the worktree also contains `.gitignore:4` adding `ref/` and an untracked `undine-handoff.md`. They are outside the reviewed Wave21 Runtime Player implementation/docs surface and are not Editor/package-format/schema/dependency/lockfile changes.

## Regression/Compliance Checklist

- Pass: Runtime Player process boundaries remain intact. Main owns profile IO/state, preload exposes narrow typed bridge APIs, Control renders UI only, and Stage/Browser Source own renderer application (`apps/runtime-player/src/main/runtime-player-main.ts:272`, `apps/runtime-player/src/main/runtime-player-main.ts:324`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:158`, `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts:43`).
- Pass: `Dynamics Tune` is placed after `Mapping` and before `Stage`, exposes only runtime tuning/reset/retry controls, and hides raw input diagnostics on this page (`apps/runtime-player/src/control/control-window-shell.tsx:19`, `apps/runtime-player/src/control/control-window-shell.tsx:23`, `apps/runtime-player/src/control/dynamics-tune-page.tsx:236`, `apps/runtime-player/src/control/dynamics-tune-page.tsx:251`, `apps/runtime-player/src/control/control-window-app.tsx:631`).
- Pass: Runtime Export DTOs/artifacts are layered over, not mutated. Effective dynamics groups are cloned before override application, and the focused test asserts the source model remains unchanged (`apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.ts:11`, `apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.ts:43`, `apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.test.ts:16`).
- Pass: Runtime Evaluation Cache keying includes effective tuning revision/fingerprint/signature, and renderer tuning changes clear evaluation and runtime-instance caches (`apps/runtime-player/src/stage/runtime-evaluation/effective-dynamics-tuning.ts:26`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:154`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:188`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:288`).
- Pass: Browser Source receives effective dynamics tuning through payload/resync and `dynamics-tuning-changed`, without Control-only profile status or profile file paths (`apps/runtime-player/src/preload/browser-source-transport-contract.ts:39`, `apps/runtime-player/src/preload/browser-source-transport-contract.ts:88`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:252`, `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts:369`).
- Pass: Runtime Dynamics Tune Profile persistence is main-process owned under `userData/dynamics-tuning-profiles/<safe-package-id>/<fingerprint>.json`; renderer/Browser Source do not receive the local profile path (`apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-store.ts:49`, `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-store.ts:59`).
- Pass: Native Stage and Browser Source share the same `StaticStageCanvasRenderer#setDynamicsTuning` path (`apps/runtime-player/src/stage/stage-window-app.tsx:145`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:538`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts:85`).
- Pass: Runtime Export switching/clearing/quit paths flush pending dynamics profile saves and clear/publish effective tuning state (`apps/runtime-player/src/main/runtime-player-main.ts:335`, `apps/runtime-player/src/main/runtime-player-main.ts:362`, `apps/runtime-player/src/main/runtime-player-main.ts:374`).
- Pass: Mapping, Stage Motion, Variant switching, Browser Source, local preview suspension, and lightweight Performance Diagnostics boundaries are not obviously regressed by the Wave21 changes. Relevant source paths still keep local preview suspension and Stage Motion transport outside Browser Source client count suspension (`apps/runtime-player/src/main/runtime-player-main.ts:209`, `apps/runtime-player/src/main/runtime-player-main.ts:242`), Variant selection remains part of cache semantics (`apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:185`), and existing tests cover the related page/order/status boundaries.
- Pass: Wave20 close-hide wording is updated in current Runtime Player docs/maps: Control close now exits through normal app quit, while direct Stage close is recoverable with `Focus Stage` (`discussion/runtime-player/screens/broadcast-stage-setup-v0.md:40`, `discussion/runtime-player/screens/broadcast-stage-setup-v0.md:242`, `discussion/runtime-player/backlog/runtime-player-backlog.md:454`, `discussion/runtime-player/backlog/runtime-player-backlog.md:483`).
- Pass: No Editor source, package-format/shared package files, dependency metadata, or lockfile changes were present in the guarded diff/status checks.

## Verification Performed

- Read and cross-checked Wave21 Domain A/B reports and all Wave21 review lanes; Domain A/B final domain verdicts are `pass`.
- `.\node_modules\.bin\tsc.cmd --noEmit -p apps/runtime-player/tsconfig.json`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `git diff --check -- apps/runtime-player discussion/runtime-player`: pass, CRLF normalization warnings only.
- `git diff --name-only -- apps/editor packages package.json pnpm-lock.yaml pnpm-workspace.yaml`: no output.
- `git status --short -uall -- apps/editor packages package.json pnpm-lock.yaml pnpm-workspace.yaml`: no output.
- Focused Vitest rerun was attempted with existing `node_modules` and without `pnpm install`, but sandboxed config loading failed with esbuild `spawn EPERM`. The required escalated rerun was rejected by the environment usage limit, so I did not attempt an alternate workaround. Prior Domain A/B reports record focused Vitest suites passing.
- `pnpm install`: not run.

## Remaining Manual Checks

- Open a real Runtime Export with visible authored dynamics, connect iFacialMocap, adjust `Strength`, `Reaction`, `Convergence`, and `Sway`, and confirm Native Stage motion changes immediately.
- Restart Runtime Player and confirm the Runtime Dynamics Tune Profile restores for the same Runtime Export.
- Switch to a different Runtime Export and confirm stale tuning does not apply.
- Open OBS Browser Source and confirm it uses the same effective tuning as Native Stage.
- Reset a tuned group and confirm both Native Stage and Browser Source return to exported defaults.
- Confirm Runtime Export artifact files remain unmodified on disk during tuning, reset, restart, and Runtime Export switch.
- Run the pending Electron/OBS-adjacent smoke for Wave20/Wave21: Control close process exit, Stage direct close recovery through `Focus Stage`, local preview suspension/resume, Stage Motion parity, Variant switching parity, and lightweight Performance Diagnostics capture.

## Unresolved Decisions / Risks

- No user decision is required for source acceptance.
- Real-device Electron/OBS parity remains manual product verification.
- This final review could not independently rerun Vitest because the sandbox blocked esbuild spawn and the environment rejected escalation; use the recorded Domain A/B passing test evidence plus the successful typecheck/source-organization/diff checks above.
