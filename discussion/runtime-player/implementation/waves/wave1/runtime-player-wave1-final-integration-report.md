# Runtime Player Wave1 Final Integration Report

- Target: `runtime-player-wave1-final-integration-clean-review`
- Wave: Runtime Player Wave1
- Final verdict: pass
- Date: 2026-06-20
- Integrator: Orch-Sylph

## Summary

Runtime Player Wave1 satisfies the planned scope as an Electron shell plus Control Window / Stage Window placeholder UI wave.

The integrated result provides:

- A runnable `apps/runtime-player` Electron/electron-vite app shell.
- A Control Window with the initial Runtime Player placeholder screen and deterministic no-op placeholder actions.
- A separate Stage Window configured as frameless, transparent-intended, and capture-oriented.
- Clear `main` / `preload` / `control` / `stage` source boundaries.
- Focused static and pure tests for window options, placeholder state, and process-boundary rules.

No real Runtime Export directory loading, Runtime Export parsing, iFacialMocap UDP/TCP receive, network connection, parameter mapping, runtime loop simulation, WebGL model rendering, packaging work, or Editor change was implemented.

## Integrated Artifacts Reviewed

Domain report:

- `discussion/runtime-player/implementation/waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md`

Domain A review lanes:

- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md`

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave1-plan.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Domain A Consistency

Domain A report exists, reports `pass`, and is internally consistent with the three review lanes.

The review lanes all exist and report `pass`:

| Review lane | Verdict | Blocking findings |
|---|---|---|
| Spec Compliance Review | pass | None |
| Design / Development Compliance Review | pass | None |
| Test Adequacy Review | pass | None |

The Domain A report documents the same run command, placeholder-only non-goals, process-boundary evidence, verification results, GUI manual verification gap, residual risks, and future decision points found during this final integration review.

## Source Scope Review

Observed source/config changes are scoped to `apps/runtime-player/**` plus Runtime Player discussion artifacts.

The final integration review found no changed source under:

- `apps/editor/**`
- existing `packages/**`
- `pnpm-lock.yaml`
- `node_modules/**`

Ignored local artifacts exist under `apps/runtime-player/node_modules/` and `apps/runtime-player/out/`; `apps/runtime-player/.gitignore` ignores `out/`.

## Two-Window Evidence

Control Window and Stage Window are separate by source/config:

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts` creates separate `BrowserWindow` instances for `controlWindow` and `stageWindow`.
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts` loads separate renderer entries: `control` and `stage`.
- `apps/runtime-player/electron.vite.config.ts` defines separate renderer inputs for `src/control/index.html` and `src/stage/index.html`.
- `apps/runtime-player/src/control/control-entry.tsx` mounts `ControlWindowApp`.
- `apps/runtime-player/src/stage/stage-entry.tsx` mounts `StageWindowApp`.

Stage Window configuration is capture-oriented for Wave1:

- `frame: false`
- `transparent: true`
- `hasShadow: false`
- transparent background color
- `backgroundThrottling: false`

## Placeholder-Only Evidence

The implementation keeps Runtime Player Wave1 placeholder-only:

- Startup state reports `loaded: false` and `No Runtime Export loaded`.
- Placeholder action feedback uses deterministic no-op results with `handled: false`.
- `open-runtime-export` returns placeholder feedback and does not open a directory picker.
- `connect-input` and `disconnect-input` return placeholder feedback and do not open sockets.
- Stage renderer contains only placeholder display.

Searches over `apps/runtime-player/src` found no production implementation of:

- real Runtime Export load or directory picker
- file reads for runtime artifacts
- UDP/TCP socket receive or network connection
- runtime graph parsing
- parameter mapping
- runtime loop or `requestAnimationFrame` hot path
- WebGL/canvas model rendering
- Editor authoring UI concepts

## Boundary Review

Process boundaries are respected for Wave1:

- Main process owns Electron app lifecycle, IPC handlers, and BrowserWindow creation.
- Preload exposes only a narrow `window.runtimePlayer` API backed by placeholder IPC channels.
- Control renderer uses the typed preload API and does not import raw Electron or Node APIs.
- Stage renderer is display-only and contains no setup controls, debug table, parameter list, or Editor overlay.
- Main process does not import React UI modules.
- No broad catch-all source files or substantial implementation `index.ts` files were introduced.

## User-Facing Run Command

Manual dev command:

```powershell
pnpm --filter @private-2d-rigging-lab/runtime-player dev
```

Expected result:

- Control Window opens with title `Runtime Player`.
- Stage Window opens separately as `Runtime Player Stage`.
- Stage Window shows only the transparent/capture stage placeholder.

## Verification Performed

Commands run from repository root during final integration:

| Command | Result |
|---|---|
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | Passed |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` | Passed: 3 files / 10 tests |
| `node scripts/check-source-organization.mjs` | Passed |
| `node scripts/check-dependencies.mjs` | Passed |
| `git diff --check` | Passed with CRLF replacement warnings only |

`test:unit` was run with elevated execution because Vitest starts child processes and prior review evidence showed sandboxed startup can fail with `spawn EPERM`.

Additional inspection:

- `git status --short -uall`
- `git status --short -uall -- apps/editor packages pnpm-lock.yaml node_modules`
- `git diff --name-only -- apps/editor packages pnpm-lock.yaml node_modules`
- `rg` searches for forbidden Runtime Export load, input/network, runtime loop/rendering, and Editor authoring terms.

## Manual Verification Gap

Electron GUI launch, screenshot inspection, transparent-pixel proof, and OBS capture verification were not run by this final integration lane because they require an interactive desktop session and are environment-sensitive.

Manual smoke steps:

1. Run `pnpm --filter @private-2d-rigging-lab/runtime-player dev`.
2. Confirm the Control Window opens and shows `Runtime Player`.
3. Confirm the Stage Window opens as a separate window.
4. Confirm the Stage Window is frameless/transparent-intended and contains only the placeholder stage.
5. Click placeholder actions and confirm deterministic no-op feedback.
6. Confirm no real Runtime Export picker, file load, input connection, parameter list, model rendering, or Editor authoring UI appears.

## Residual Risks

- Transparent Stage Window behavior still needs confirmation on the target OS/GPU/compositor and OBS-style capture path.
- Stage Window opens immediately as a placeholder. This is allowed by the Wave1 plan, but the exact future open timing remains a UX decision.
- `BrowserWindow` uses `sandbox: false` while keeping `nodeIntegration: false` and `contextIsolation: true`; this should be revisited before loading real Runtime Export content.
- The bridge contract currently lives under `src/preload/` and is imported as a typed app contract by main/control. This is acceptable for Wave1, but a dedicated contract location may be cleaner if the API grows.

## User Decision Points

No user decision blocks Wave1 closeout.

Future waves still need decisions on:

- Stage Window position, size, always-on-top, click-through, and persistence.
- Previous Runtime Export restore behavior.
- Stricter renderer sandbox policy before real Runtime Export loading.
- Real Runtime Export loader, input adapter, runtime loop, and rendering implementation boundaries.
