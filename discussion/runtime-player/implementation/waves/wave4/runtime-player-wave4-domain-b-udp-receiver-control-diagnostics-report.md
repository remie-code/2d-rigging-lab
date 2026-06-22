# Runtime Player Wave4 Domain B Report: UDP Receiver + Control Diagnostics

> Target: `runtime-player-wave4-udp-receiver-control-diagnostics`
> Verdict: done
> Scope: Electron main UDP receive lifecycle, optional iFacialMocap UDP start request, main-owned status/diagnostics store, 10Hz renderer diagnostics throttle, Control Window input controls and diagnostics panel.

## Files Changed

Main input receiver and lifecycle:

- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-start-request.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/input-diagnostics-throttle.ts`
- `apps/runtime-player/src/main/input-local-ip-candidates.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/placeholder-action-state.ts`

Preload contract extension:

- `apps/runtime-player/src/preload/input-bridge-contract.ts`

Control Window:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/input-diagnostics-panel.tsx`

Focused tests:

- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts`
- `apps/runtime-player/src/main/input-session-state.test.ts`
- `apps/runtime-player/src/main/input-diagnostics-throttle.test.ts`

Report:

- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`

## UDP Lifecycle Summary

- Main process registers `runtime-player:input:*` handlers in `runtime-player-main.ts`.
- `connect` stops any existing receiver, validates Wave4 scope (`ifacialmocap` + `udp`), binds UDP on the requested receive port, defaulting to `49983`.
- Passive listen works without iPhone IP.
- If iPhone IP is provided, the bound UDP socket sends the official iFacialMocap UDP start request with `sendDataVersion=v2` to iOS port `49983`.
  Source: <https://www.ifacialmocap.com/for-developer/>
- Start request diagnostics are recorded as `pending`, `sent`, or `error`.
- Start request send failure does not stop passive listening.
- Incoming UDP packets are parsed and normalized through Domain A code in main process.
- Socket errors move input state to `error` and are surfaced through Control diagnostics.
- `disconnect` closes the socket and returns the state to `idle` while retaining latest diagnostics for copy.

## 10Hz Throttling Implementation

- Packet processing remains source-rate in main.
- `RuntimePlayerInputSessionState` retains packet count, last packet timestamp, remote sender, FPS estimate, latest raw frame, parsed frame, normalized `TrackingFrame`, parser diagnostics, and normalization warnings on every packet.
- Renderer-facing packet-derived status/diagnostics events pass through `RuntimePlayerInputDiagnosticsThrottle`.
- The throttle emits immediately for the first packet update, then schedules at most one trailing update per 100ms.
- Lifecycle events such as connect, disconnect, socket error, and handshake result are immediate because they are not packet-rate debug stream updates.
- Copy diagnostics reads latest retained main-process state and is not limited by the throttled React snapshot.

## Control Diagnostics Behavior

- Control Window no longer calls placeholder Connect/Disconnect actions.
- Input Source panel calls `window.runtimePlayer.input.connect` and `disconnect`.
- Receive port is editable before connect.
- iPhone IP is optional; empty input starts passive listen only.
- Control displays connection state, local IP candidates, remote sender, FPS, last packet age, packet count, and current receiver activity.
- Debug / Diagnostics is collapsible and Control-only.
- Diagnostics shows raw frame sample, parsed blendshape list, head rotation, head position raw, left/right eye rotation, normalized tracking frame JSON, parser warnings, normalization warnings, and handshake status.
- Stage Window source was not changed.

## Copy Diagnostics Payload

`copyDiagnostics` returns JSON-ready data from main:

- `copiedAtIso`
- current input `status`
- latest `diagnostics`
- `latestRawFrame`
- `latestRawFrameLength`

Control Window writes that JSON to the clipboard with browser clipboard APIs. The copied payload includes the latest retained raw frame from main, not merely the last throttled renderer update.

## Tests / Commands Run

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-session-state.test.ts src/main/input-diagnostics-throttle.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`
  - Passed: 5 files / 22 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run test:unit`
  - Passed: 15 files / 65 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main apps/runtime-player/src/preload apps/runtime-player/src/control discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`
  - Passed; Git reported expected CRLF normalization warnings for tracked Runtime Player files.
- `rg -n "[\\t ]$" ...`
  - Passed: no trailing whitespace in the new/changed Domain B files.

## Manual Loopback / Real-Device Checklist

Loopback without iPhone:

1. Launch Runtime Player.
2. Leave iPhone IP empty.
3. Connect with receive port `49983`.
4. Send a UDP datagram to `127.0.0.1:49983`, for example:
   `jawOpen-50|=head#1,2,3,4,5,6|rightEye#7,8,9|leftEye#10,11,12|`.
5. Confirm Control shows `receiving`, packet count increments, raw/parsed/normalized diagnostics update, and Stage remains unchanged.
6. Confirm Copy diagnostics includes `latestRawFrame`.

Real device:

1. Ensure PC and iPhone are on the same network and Windows firewall allows UDP `49983`.
2. Note a Local IP candidate shown in Control.
3. In iFacialMocap, target the PC Local IP if manual destination is required.
4. Connect without iPhone IP first to test passive listen.
5. If no packets arrive, enter the iPhone IP and Connect again to send the UDP start request.
6. Confirm remote sender address/port, FPS, packet count, raw frame, parsed blendshapes, head position, eye rotations, and normalized tracking frame.
7. Copy diagnostics and verify handshake result, local IPs, remote endpoint, parser diagnostics, and latest raw frame are present.

## Remaining Risks / Gaps

- Real-device behavior still needs confirmation for current iFacialMocap versions, firewall prompts, multi-NIC selection, and iOS network permission state.
- UDP has expected packet loss risk; TCP transport is intentionally out of scope for Wave4.
- There is no official UDP stop request implemented. Disconnect closes the PC receiver socket only.
- Local IP detection lists non-internal IPv4 candidates but does not choose the correct NIC automatically.
- Head/eye axis signs and head position units remain Wave4 real-device evidence items.
- Look Forward/calibration is still placeholder by scope.

## User-Decision Points

- None blocking Domain B.
- Later wave decision: whether to add explicit NIC selection or persist the last iPhone IP/receive port.
