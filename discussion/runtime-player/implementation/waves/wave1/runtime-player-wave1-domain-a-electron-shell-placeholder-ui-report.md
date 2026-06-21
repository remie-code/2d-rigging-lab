# Runtime Player Wave1 Domain A Report: Electron Shell + Placeholder UI

- Target: `runtime-player-wave1-electron-shell-placeholder-ui`
- Wave: Runtime Player Wave1
- Domain verdict: pass
- Date: 2026-06-20
- Orchestrator: Orch-Sylph

## Summary

Domain A implemented the first Runtime Player Electron app shell under `apps/runtime-player`.

The app now has:

- Electron/electron-vite configuration.
- Control Window renderer with the initial Runtime Player placeholder UI.
- Stage Window renderer with a separate transparent/capture-oriented placeholder.
- Main/preload/control/stage source boundaries.
- Narrow typed preload bridge for deterministic Wave1 placeholder actions.
- Focused tests for BrowserWindow options, placeholder action state, and process-boundary guards.

No real Runtime Export loading, file reading, input networking, parameter mapping, runtime loop, WebGL model rendering, persistence, packaging, or Editor feature changes were implemented.

## Files Changed

Runtime Player app:

- `apps/runtime-player/.gitignore`
- `apps/runtime-player/package.json`
- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/tsconfig.json`
- `apps/runtime-player/vitest.config.ts`
- `apps/runtime-player/src/control/control-entry.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/index.html`
- `apps/runtime-player/src/main/main.ts`
- `apps/runtime-player/src/main/placeholder-action-state.ts`
- `apps/runtime-player/src/main/placeholder-action-state.test.ts`
- `apps/runtime-player/src/main/placeholder-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/browser-window-options.ts`
- `apps/runtime-player/src/main/window-management/browser-window-options.test.ts`
- `apps/runtime-player/src/main/window-management/renderer-entry-url.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/preload/placeholder-bridge-channels.ts`
- `apps/runtime-player/src/preload/preload.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/runtime-player-boundary.test.ts`
- `apps/runtime-player/src/stage/index.html`
- `apps/runtime-player/src/stage/stage-entry.tsx`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/styles/global.css`

Reports and maps:

- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md`
- `discussion/runtime-player/implementation/waves/wave1/_map.md`
- `discussion/runtime-player/implementation/reviews/wave1/_map.md`
- `discussion/runtime-player/implementation/_map.md`

Build output under `apps/runtime-player/out/` was generated during verification and is ignored by `apps/runtime-player/.gitignore`.

## Runtime Behavior

Manual dev command:

```powershell
pnpm --filter @private-2d-rigging-lab/runtime-player dev
```

Expected windows:

- Control Window: titled `Runtime Player`.
- Stage Window: titled `Runtime Player Stage`, separate from Control, frameless, transparent-configured, capture-oriented placeholder.

Control Window placeholder affordances:

- `Open Runtime Export`
- Settings
- Runtime Export status
- Input Source section
- Connect / Disconnect
- Calibration / Look Forward
- Stage controls
- Debug affordance

All placeholder actions return deterministic no-op feedback. They do not open a directory picker, read files, bind sockets, connect to iFacialMocap, map parameters, render a model, or persist settings.

## Boundary Evidence

- Main process owns Electron app lifecycle and BrowserWindow creation under `apps/runtime-player/src/main/**`.
- Preload exposes only `window.runtimePlayer` typed placeholder methods.
- Control and Stage renderers do not import raw Electron APIs, `node:*`, filesystem APIs, socket APIs, or main process modules.
- Stage renderer contains no setup controls, debug panel, parameter list, or Editor authoring UI.
- No new dependencies were added, and `pnpm-lock.yaml` was not changed.
- No changes were made under `apps/editor/**` or existing `packages/**` source.
- No broad catch-all files or substantial implementation `index.ts` files were introduced.

## Child Agents

| Role | Agent id | Status | Closed | Output |
|---|---|---|---:|---|
| Gnome implementation | `019ee545-a28a-7473-a4db-4c72d66ee1b0` | done | yes | Source/config/tests implemented |
| Review-Sylph Spec Compliance | `019ee55f-1c82-7390-9d95-c5bb8a471265` | pass | yes | `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md` |
| Review-Sylph Design / Development Compliance | `019ee55f-6cf1-7083-8158-8c24afb869bc` | pass | yes | `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md` |
| Review-Sylph Test Adequacy | `019ee55f-b700-7650-abed-acf91edd1456` | pass | yes | `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md` |

## Review Results

| Review lane | Verdict | Findings |
|---|---|---|
| Spec Compliance Review | pass | No findings |
| Design / Development Compliance Review | pass | No findings |
| Test Adequacy Review | pass | No findings |

Fix loop: not run because all review lanes passed.

## Verification

Orch-Sylph final verification:

| Command | Result |
|---|---|
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | Passed |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` | Passed: 3 files / 10 tests |
| `node scripts/check-source-organization.mjs` | Passed |
| `node scripts/check-dependencies.mjs` | Passed |
| `git diff --check` | Passed with CRLF replacement warnings only |

Gnome implementation verification also ran:

| Command | Result |
|---|---|
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player build` | Passed |
| trailing-whitespace check over `apps/runtime-player` excluding generated/vendor output | Passed |

Review lanes independently reran or inspected the focused verification. Vitest required elevated execution in review because sandboxed startup hit `spawn EPERM`; the elevated reruns passed.

## Manual Verification

Electron GUI launch was not run by Orch-Sylph because it opens persistent desktop windows in the agent environment. Use this manual smoke check:

```powershell
pnpm --filter @private-2d-rigging-lab/runtime-player dev
```

Check:

- Control Window opens and shows `Runtime Player`.
- Stage Window opens as a separate window.
- Stage Window is frameless/transparent-intended and contains only the placeholder stage.
- Control placeholder actions show deterministic no-op feedback.
- No Runtime Export picker, file loading, network connection, parameter list, model rendering, or Editor authoring UI appears.

## Residual Risks

- No automated Electron GUI launch or screenshot smoke was completed in this orchestration lane.
- Transparent Stage behavior still needs platform/GPU/compositor confirmation and OBS-style capture verification in a real desktop session.
- `BrowserWindow` options use `sandbox: false` with `nodeIntegration: false` and `contextIsolation: true`; this is acceptable for Wave1 placeholder scope, but should be revisited before loading real Runtime Export content.
- The bridge contract currently lives under `src/preload/` and is imported by main/control as a typed app contract. This is acceptable for Wave1, but a dedicated contract location may be cleaner if the API grows.

## User Decision Points

None blocking for Domain A.

Future waves still need decisions on Stage Window always-on-top/click-through/position persistence, previous Runtime Export restore, stricter renderer sandbox policy, and real input/runtime behavior.
