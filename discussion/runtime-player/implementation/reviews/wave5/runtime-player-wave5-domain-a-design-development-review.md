# Runtime Player Wave5 Domain A Design / Development Compliance Review

## verdict

pass

Domain A keeps Runtime Player process boundaries intact, adds the Input Profile / Look Forward / Guided Calibration surface inside the allowed Runtime Player scope, and does not introduce Stage, Editor, package, dependency, or install-scope violations.

## Scope Reviewed

- Control Window shell and pages:
  - `apps/runtime-player/src/control/control-window-app.tsx`
  - `apps/runtime-player/src/control/control-window-components.tsx`
  - `apps/runtime-player/src/control/control-window-formatters.ts`
  - `apps/runtime-player/src/control/control-window-shell.tsx`
  - `apps/runtime-player/src/control/input-page.tsx`
  - `apps/runtime-player/src/control/mapping-page.tsx`
  - `apps/runtime-player/src/control/overview-page.tsx`
  - `apps/runtime-player/src/control/input-diagnostics-panel.tsx`
- Main-process input/profile/session implementation:
  - `apps/runtime-player/src/main/input-profiles/**`
  - `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
  - `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`
  - `apps/runtime-player/src/main/input-bridge-handlers.ts`
  - `apps/runtime-player/src/main/input-connect-request-validation.ts`
  - `apps/runtime-player/src/main/input-session-state.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
- Preload bridge additions:
  - `apps/runtime-player/src/preload/input-profile-bridge-channels.ts`
  - `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- Focused tests under `apps/runtime-player/src/main/**`.
- Boundary inventory for forbidden scope:
  - `apps/runtime-player/src/stage/**`
  - `apps/editor/**`
  - `packages/**`
  - dependency manifests / lockfile.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-final-integration-report.md`

## Findings

No blocking or non-blocking design/development compliance findings.

Supporting observations:

- Process boundary is preserved. Main owns input/profile state, filesystem IO, IPC handlers, and Electron `userData` wiring; see `apps/runtime-player/src/main/runtime-player-main.ts:19` and `apps/runtime-player/src/main/runtime-player-main.ts:23`.
- Input Profile persistence uses the required `input-profiles/ifacialmocap/profiles.json` path under supplied `userDataPath`; see `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:41`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:43`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:44`, and `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:45`.
- Profile store creates directories and writes through main-owned filesystem APIs only; see `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:171` and `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:172`.
- Corrupt/read-failed profile state falls back to a safe status path and temporary defaults through main-owned status construction; see `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:132`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:146`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:215`, and `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:216`.
- Look Forward is session-local: latest tracking frame and session neutral are held in `RuntimePlayerInputSessionState`, and capture does not write the profile store; see `apps/runtime-player/src/main/input-session-state.ts:47`, `apps/runtime-player/src/main/input-session-state.ts:48`, `apps/runtime-player/src/main/input-session-state.ts:99`, and `apps/runtime-player/src/main/input-session-state.ts:121`.
- Preload exposes a narrow typed `inputProfile` API rather than raw Electron handles; see `apps/runtime-player/src/preload/runtime-player-bridge.ts:73`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:75`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:103`, and `apps/runtime-player/src/preload/runtime-player-bridge.ts:135`.
- Control navigation exposes only real Wave5 pages: `Overview`, `Input`, and `Mapping`; see `apps/runtime-player/src/control/control-window-shell.tsx:6`, `apps/runtime-player/src/control/control-window-shell.tsx:12`, `apps/runtime-player/src/control/control-window-shell.tsx:13`, and `apps/runtime-player/src/control/control-window-shell.tsx:14`.
- Mapping page is minimal and clearly not configured pending Domain B. It does not add parameter sliders, raw source selection, smoothing, curve, deadzone, or persistent Model Mapping Profile UI.
- Stage source is untouched in this Domain A diff. No Stage raw tracking/debug data path or Stage debug UI was introduced.
- No dependency manifest or lockfile diff was present, and no `pnpm install` was run.
- Source organization is acceptable for Domain A: no new broad `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts`; `index.ts` was not used for implementation; `input-profile-calibration-session.ts` is the largest new responsibility file but remains cohesive calibration-session logic.

## Verification Performed

- Read the basis documents listed above.
- Reviewed source and focused tests directly, not only Gnome's report.
- Ran focused Vitest:
  - Command: `pnpm.cmd exec vitest run src/main/input-connect-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profiles/input-profile-store.test.ts src/main/input-session-state.test.ts`
  - Result: pass, 6 files / 19 tests.
- Ran Runtime Player unit suite:
  - Command: `pnpm.cmd test:unit` in `apps/runtime-player`
  - Result: pass, 20 files / 79 tests.
- Ran Runtime Player typecheck:
  - Command: `pnpm.cmd typecheck` in `apps/runtime-player`
  - Result: pass.
- Ran source organization guard:
  - Command: `node scripts/check-source-organization.mjs`
  - Result: pass.
- Ran dependency guard:
  - Command: `node scripts/check-dependencies.mjs`
  - Result: pass.
- Ran whitespace/diff check:
  - Command: `git diff --check -- apps/runtime-player/src`
  - Result: pass, with LF/CRLF working-copy warnings only.
- Ran boundary inventories:
  - Control/Stage search found no direct `electron`, `node:*`, `ipcRenderer`, `contextBridge`, filesystem, or socket access.
  - Main/preload search found Electron/Node access only in the expected process-boundary locations.
  - Main/preload search found no React/control imports.
  - Stage diff check was empty.
  - Forbidden scope diff checks for `apps/editor/**`, `apps/runtime-player/src/stage/**`, broad `packages/**`, `node_modules/**`, dependency manifests, and lockfile were empty.

## Remaining Issues

- None for Design / Development Compliance.
- Domain B still owns real Auto Mapping, mapped parameter frame production, and Stage live parameter application. Current `Mapping` UI remains intentionally minimal for Domain A and should not be treated as completed live mapping.

## User-Decision Points

None.
