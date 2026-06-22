# Runtime Player Wave4 Domain B Design / Development Compliance Review

> Target: `runtime-player-wave4-udp-receiver-control-diagnostics`
> Lane: Design / Development Compliance
> Reviewer: Review-Sylph
> Date: 2026-06-22

## verdict: pass

No blocking design/development compliance findings were found.

## Scope Reviewed

- Domain B main-process UDP receiver, lifecycle/state, diagnostics throttle, bridge handlers, local IP candidates, and app quit disconnect wiring.
- Domain B preload bridge contract/API exposure.
- Domain B Control Window input controls and diagnostics panel.
- Domain B focused receiver/state/throttle tests.
- Stage boundary by source review and diff check.
- Dependency/source-organization guard results.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave4-plan.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

- No blocking findings.

Supporting evidence:

- Electron process boundaries are preserved. UDP socket ownership is in main under `IFacialMocapUdpReceiver`, which imports `node:dgram` and creates/binds/closes the socket in main-only code (`apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:1`, `:41`, `:59`, `:90`). Control code calls only `window.runtimePlayer.input.*` bridge methods (`apps/runtime-player/src/control/control-window-app.tsx:81`, `:167`, `:192`, `:211`).
- Preload exposes a typed app API and does not expose raw `ipcRenderer`, socket handles, or channel strings to renderers. The input API is limited to status/connect/disconnect/diagnostics/copy/subscribe methods (`apps/runtime-player/src/preload/input-bridge-contract.ts:100`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:54`, `:95`).
- Main-owned state and packet processing are cohesive. Incoming packets are parsed/normalized in `RuntimePlayerInputSessionState.recordReceivedFrame`, and retained state includes packet count, remote endpoint, raw frame, parsed snapshot, normalized frame, parser diagnostics, and normalization warnings (`apps/runtime-player/src/main/input-session-state.ts:172`, `:188`, `:195`).
- Renderer diagnostics broadcasts are throttled for packet-rate updates. The bridge handler routes packet updates through `RuntimePlayerInputDiagnosticsThrottle` (`apps/runtime-player/src/main/input-bridge-handlers.ts:63`, `:92`), and the throttle schedules at most one trailing emit inside the 100ms interval (`apps/runtime-player/src/main/input-diagnostics-throttle.ts:36`, `:51`).
- Broadcasts guard destroyed windows before sending events (`apps/runtime-player/src/main/input-bridge-handlers.ts:246`). Runtime Player also initiates input disconnect on app quit (`apps/runtime-player/src/main/runtime-player-main.ts:30`).
- Malformed frames are retained as diagnostics rather than crashing the session. Parser malformed paths record diagnostics (`apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts:49`, `:210`, `:231`), and the session test covers malformed input without throw (`apps/runtime-player/src/main/input-session-state.test.ts:120`).
- Control diagnostics remain Control-only and include long-text containment. Raw and normalized frame blocks use `overflow-auto`, `whitespace-pre-wrap`, and `break-words`; row values use `min-w-0`/`break-words`; blendshape lists are scrollable and truncate names (`apps/runtime-player/src/control/input-diagnostics-panel.tsx:115`, `:147`, `:190`, `:256`).
- Stage source was not changed for Domain B. `git diff -- apps/runtime-player/src/stage` was empty, and Stage search found no new `runtime-player:input` or tracking-frame consumption.
- Source organization is acceptable for this wave. New main responsibilities are split into named files for receiver, session state, throttle, local IP candidates, and start request. No new broad `types.ts`/`utils.ts`/`helpers.ts`/implementation `index.ts` pattern was found, and `node scripts/check-source-organization.mjs` passed.
- No new dependency or forbidden scope change was found. `package.json`, `apps/runtime-player/package.json`, and `pnpm-lock.yaml` had no Domain B dependency diff, and `node scripts/check-dependencies.mjs` passed.

## Non-Blocking Observations

- `apps/runtime-player/src/control/control-window-app.tsx` grew from 546 lines to 848 lines and still owns several Control panels plus input action wiring. Domain B did split the detailed diagnostics panel into `input-diagnostics-panel.tsx`, and the Wave4 plan already noted the existing Control component shape, so this is not blocking. Before adding more Control Window features, split the Input Source panel and input command helpers into owned files.
- `before-quit` starts `inputBridge.disconnect()` without awaiting its returned promise. The current async path invokes `socket.close()` before the first unresolved await, so it does initiate socket shutdown, but future ordered teardown should make shutdown completion explicit if more cleanup is added.
- `setIdle()` intentionally retains last packet/remote/fps evidence in status after disconnect for copy diagnostics. This is useful for Wave4 diagnostics but may need a clearer UI label later so idle state is not confused with active remote state.

## Verification Performed

- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck` - passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-session-state.test.ts src/main/input-diagnostics-throttle.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts` - initial sandbox run failed with `spawn EPERM`; escalated rerun passed 3 files / 11 tests.

## Remaining Risks / Gaps

- Real iFacialMocap device behavior, Windows firewall prompts, multi-NIC choice, and iOS network permission state remain manual verification items.
- UDP stop is local socket close only; no source-device stop request is implemented by scope.
- TCP transport, persisted input settings, NIC selection, calibration, runtime parameter mapping, and Stage motion remain out of scope.

## User-Decision Points

- None blocking Domain B.
- Later wave decision candidates: explicit NIC selection, persisted iPhone IP/receive port, and Control Window component split timing.
