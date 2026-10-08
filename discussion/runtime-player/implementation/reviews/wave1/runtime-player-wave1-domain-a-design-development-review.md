# Runtime Player Wave1 Domain A Design / Development Compliance Review

Review lane: Design / Development Compliance Review  
Target: `runtime-player-wave1-electron-shell-placeholder-ui`  
Reviewer: Review-Sylph  
Verdict: pass

## Scope Reviewed

Implementation source/config reviewed:

- `apps/runtime-player/package.json`
- `apps/runtime-player/.gitignore`
- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/tsconfig.json`
- `apps/runtime-player/vitest.config.ts`
- `apps/runtime-player/src/**`

Explicitly not reviewed as implementation source:

- `apps/runtime-player/out/**`
- `apps/runtime-player/node_modules/**`
- unrelated dirty discussion maps/plans outside the stated basis/review artifact path

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave1-plan.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

No findings.

No blocking or warning findings were identified for this review lane. The implementation preserves the expected Runtime Player Wave1 process boundaries, dependency scope, source organization, preload safety shape, and placeholder-only policy.

## Compliance Evidence

- Main process ownership is kept in `apps/runtime-player/src/main/**`.
  - `src/main/main.ts` is a minimal entrypoint.
  - `src/main/runtime-player-main.ts` owns Electron app lifecycle wiring.
  - `src/main/window-management/runtime-player-windows.ts` owns `BrowserWindow` creation/loading.
  - Main process source does not import React UI modules.
- Preload exposes a narrow app-specific API.
  - `src/preload/preload.ts` only installs the bridge.
  - `src/preload/runtime-player-bridge.ts` exposes `window.runtimePlayer` with placeholder methods.
  - Raw `ipcRenderer`, Electron objects, filesystem handles, and socket handles are not exposed to renderer code.
- Renderer boundary is respected.
  - `src/control/**` and `src/stage/**` do not import `node:*`, raw Electron APIs, filesystem APIs, socket APIs, or main internals.
  - Control renderer imports only the typed bridge contract for app-level API types/actions.
  - Stage renderer is a placeholder bootstrap only and does not establish a React-driven runtime hot path.
- Stage window policy is respected.
  - `createStageWindowOptions` configures a separate frameless transparent Stage Window with `backgroundThrottling: false`.
  - Stage UI contains no setup controls, parameter lists, debug panel, or Editor overlays.
- Dependency scope is stable.
  - `package.json` diff changes the `main` path and adds scripts only.
  - Existing dependency/devDependency declarations were not expanded.
  - `pnpm-lock.yaml` was not modified.
- Forbidden scope was not touched by this implementation.
  - No source changes were detected under `apps/editor/**`, existing `packages/**`, `pnpm-lock.yaml`, `node_modules/**`, or `discussion/implementation/**`.
- Source organization is acceptable.
  - No substantial implementation is placed in `index.ts`.
  - No broad catch-all `types.ts`, `utils.ts`, `helpers.ts`, `common.ts`, or `ipc.ts` files were introduced.
  - The largest source file observed was `src/control/control-window-app.tsx` at 277 lines, cohesive as the Wave1 placeholder Control Window component.

## Checks Performed

- `git status --short -uall`
- `git diff -- apps/runtime-player/package.json`
- `git diff --name-only -- apps/editor packages pnpm-lock.yaml node_modules discussion/implementation`
- `git status --short -uall -- apps/editor packages pnpm-lock.yaml node_modules discussion/implementation`
- `rg --files apps/runtime-player`
- Static import and content review for Node/Electron/raw IPC/Runtime Export/input/network/runtime-loop scope.
- Source file name and line-count review for source organization risks.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` -> passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` -> sandboxed run failed with `spawn EPERM` while starting esbuild; rerun with elevated execution passed, 3 test files / 10 tests.
- `node scripts/check-source-organization.mjs --source-root apps/runtime-player` -> passed.
- `node scripts/check-dependencies.mjs` -> passed.
- `git diff --check -- apps/runtime-player` -> passed.

## Residual Risks

- Electron GUI launch/screenshot smoke was not run in this review lane. The review verified source/config/tests, not actual desktop window rendering.
- `BrowserWindow` options explicitly set `sandbox: false` for both windows while keeping `nodeIntegration: false` and `contextIsolation: true`. This is not a current basis-document violation, but should be revisited before Runtime Player loads external or user-provided content.
- The bridge contract currently lives under `src/preload/` and is imported by main/control as a typed app contract. This is acceptable for Wave1, but if the API grows, moving contracts into a dedicated shared contract area may make ownership clearer.

## User-Decision Points

No blocking user decision is required for this lane.

Future decisions already called out by the basis documents remain open:

- Whether Stage Window should become always-on-top, click-through, or user-position-persistent.
- Whether a stricter sandbox policy should be required before real Runtime Export loading or tracking input is introduced.
