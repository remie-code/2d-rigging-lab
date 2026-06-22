# Runtime Player Wave4 Domain A Report: Input Contract + iFacialMocap Parser/Normalizer

> Target: `runtime-player-wave4-input-contract-parser-normalizer`
> Status: Done
> Scope: typed input bridge contract/channels, normalized `TrackingFrame` DTO, pure iFacialMocap parser, pure normalizer, focused parser/normalizer tests.

## 1. Files Changed

Input bridge contract:

- `apps/runtime-player/src/preload/input-tracking-frame-contract.ts`
- `apps/runtime-player/src/preload/input-bridge-contract.ts`
- `apps/runtime-player/src/preload/input-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`

iFacialMocap parser/normalizer:

- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-parsed-frame.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts`

Focused tests:

- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`

No Control Window UI, Stage Window, runtime parameter mapping, UDP socket lifecycle, persistence, or package dependency changes were made.

## 2. Contract Shape

Added a Player-local normalized tracking DTO:

- `TrackingFrame.source`: currently `"ifacialmocap"`.
- `TrackingFrame.transport`: currently `"udp"`.
- `TrackingFrame.blendshapes`: ARKit/iFacialMocap names preserved with normalized `0..1` values.
- `TrackingFrame.head.rotationEulerDeg`: optional degrees.
- `TrackingFrame.head.positionRaw`: optional raw iFacialMocap position values.
- `TrackingFrame.eyes.leftEulerDeg` / `rightEulerDeg`: optional degrees.
- `TrackingFrame.debug`: raw sample, malformed segment count, parse warnings, last parse error, and normalization warnings.

Added input bridge DTO/API shapes:

- `RuntimePlayerInputStatus`
- `RuntimePlayerInputDiagnosticsSnapshot`
- `RuntimePlayerInputDiagnosticsCopyPayload`
- `RuntimePlayerInputConnectRequest`
- `RuntimePlayerInputApi`

Added namespaced input IPC channel constants under `runtime-player:input:*`.

Status/diagnostics payloads include receive port, optional iPhone host, local IP candidates, remote sender endpoint, packet count, last packet time/age, estimated FPS, raw sample, parsed frame snapshot, normalized tracking frame, parser diagnostics, and normalization warnings.

`window.runtimePlayer.input` now exposes typed renderer-facing methods for Domain B to wire:

- `getStatus`
- `connect`
- `disconnect`
- `getDiagnostics`
- `copyDiagnostics`
- `onStatusChanged`
- `onDiagnosticsChanged`

The bridge still hides raw Electron APIs, `ipcRenderer`, raw channel strings, Node handles, sockets, and filesystem handles from renderers.

Compatibility note:

- Existing Wave1/Wave3 startup placeholder input snapshot was preserved. `RuntimePlayerStartupStatus.input.connectionState` still reports `"not-connected"` so the current Control Window placeholder UI remains compatible until Domain B replaces it with real input diagnostics.

## 3. Parser Coverage

The pure parser accepts raw frame strings and returns `IFacialMocapParsedFrame` without Electron or socket dependencies.

Covered by tests:

- Dash-delimited blendshape segments, for example `jawOpen-55.5`.
- `=head#rotX,rotY,rotZ,posX,posY,posZ`.
- `rightEye#rotX,rotY,rotZ`.
- `leftEye#rotX,rotY,rotZ`.
- `sendDataVersion=v2` plus ampersand-delimited blendshape segments, for example `jawOpen&100`.
- Malformed segments with preserved `malformedSegmentCount`, `parseWarnings`, and `lastParseError`.
- TCP delimiter-stripped samples and samples ending in `___iFacialMocap`.

Parser behavior:

- Empty trailing `|` segments are ignored.
- Malformed individual segments do not throw and do not prevent valid sibling segments from being parsed.
- Unsupported `#` transform segments are recorded as malformed.

## 4. Normalizer Coverage

The pure normalizer converts `IFacialMocapParsedFrame` to `TrackingFrame` without producing runtime parameter values.

Covered by tests:

- Blendshape values normalize from `0..100` to `0..1`.
- Out-of-range blendshape values clamp explicitly to `0..1`.
- Clamp diagnostics are exposed in the normalizer result and `TrackingFrame.debug.normalizationWarnings`.
- Missing head and eyes remain absent instead of being invented.
- `head.positionRaw` is preserved.
- Head and eye rotations remain degrees.
- Parser diagnostics are carried into `TrackingFrame.debug`.

## 5. Verification

Commands run:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`
  - Sandbox attempt failed with `spawn EPERM` while Vite/esbuild loaded.
  - Re-run with approval passed: 2 files / 11 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run test:unit`
  - Passed: 12 files / 54 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/preload apps/runtime-player/src/main/input-adapters/ifacialmocap discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
  - Passed for tracked diff; Git reported expected CRLF normalization warnings on pre-existing tracked preload files.
- `rg -n "[\\t ]$" apps/runtime-player/src/main/input-adapters/ifacialmocap apps/runtime-player/src/preload/input-bridge-channels.ts apps/runtime-player/src/preload/input-bridge-contract.ts apps/runtime-player/src/preload/input-tracking-frame-contract.ts discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
  - Passed: no trailing whitespace in new files.

## 6. Known Limitations / Remaining Gaps

- No UDP socket lifecycle is implemented in Domain A.
- No Control Window diagnostics UI is implemented in Domain A.
- No runtime parameter mapping or Stage motion is implemented.
- `TrackingFrame.transport` is fixed to `"udp"` for Wave4. Parser fixtures tolerate TCP delimiter-stripped strings so the parser can be reused later, but TCP receive is not implemented.
- Parser coverage is based on the official documented frame shape and local fixtures. Real-device frames may reveal additional segment forms or metadata keys that Domain B/final integration should capture in diagnostics.
- iFacialMocap axis signs, head position units, and current app handshake behavior remain real-device verification items.
