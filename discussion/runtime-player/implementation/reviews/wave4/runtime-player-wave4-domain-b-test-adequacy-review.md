# Runtime Player Wave4 Domain B Test Adequacy Review

> Target: `runtime-player-wave4-udp-receiver-control-diagnostics`
> Lane: Test Adequacy
> Reviewer: Review-Sylph
> Verdict: pass

## Scope Reviewed

- Domain B source and tests listed in the review request.
- Domain A parser/normalizer source and focused tests as the contract basis for Domain B packet processing.
- Wave4 plan, Domain A report, Domain B report, Runtime Player development policy, and source file organization policy.
- Reported verification commands, plus local re-run of focused tests, Runtime Player unit tests, typecheck, dependency guard, source organization guard, and `git diff --check`.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave4-plan.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

No blocking test adequacy findings.

Evidence that the critical Wave4 Domain B risks have credible automated coverage:

- UDP lifecycle has fake socket coverage. `IFacialMocapUdpReceiver` accepts an injected socket factory in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:33`, binds/listens/sends/stops through that socket at `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:59`, and the test fake covers passive bind, optional start request, send failure while continuing to listen, UTF-8 packet forwarding, and socket close in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts:113`.
- State transitions and retained packet diagnostics are covered. `RuntimePlayerInputSessionState` records idle/listening/receiving/stale, latest raw frame, remote endpoint, packet count, FPS, parsed frame, normalized frame, and parser diagnostics in `apps/runtime-player/src/main/input-session-state.ts:54` and `apps/runtime-player/src/main/input-session-state.ts:172`; tests cover idle/listening, receive/FPS/latest copy payload, stale transition, and malformed frame diagnostics in `apps/runtime-player/src/main/input-session-state.test.ts:16`, `apps/runtime-player/src/main/input-session-state.test.ts:51`, `apps/runtime-player/src/main/input-session-state.test.ts:101`, and `apps/runtime-player/src/main/input-session-state.test.ts:120`.
- Malformed packet resilience is tested at both parser and session-state levels. Parser tests preserve valid sibling data while counting malformed segments in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:69`; session-state tests verify malformed input remains `receiving` and exposes parser diagnostics in `apps/runtime-player/src/main/input-session-state.test.ts:120`.
- Optional handshake diagnostics are covered. Passive no-IP diagnostics are tested in `apps/runtime-player/src/main/input-session-state.test.ts:32`; start-request pending/sent/error behavior is implemented in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:126` and tested in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts:139` and `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts:169`.
- The 10Hz diagnostics throttle is isolated and tested. The throttle defaults to 100ms and schedules at most one trailing emission in `apps/runtime-player/src/main/input-diagnostics-throttle.ts:26`; tests verify immediate first emit, 100ms trailing behavior, and cancellation in `apps/runtime-player/src/main/input-diagnostics-throttle.test.ts:12` and `apps/runtime-player/src/main/input-diagnostics-throttle.test.ts:46`. Bridge code processes every packet into main-owned state before requesting throttled renderer notifications in `apps/runtime-player/src/main/input-bridge-handlers.ts:92`.
- Copy diagnostics reads latest retained main state, not just the last rendered snapshot. Main state builds copy payload from current status/diagnostics/latest raw frame in `apps/runtime-player/src/main/input-session-state.ts:88`; IPC exposes that payload in `apps/runtime-player/src/main/input-bridge-handlers.ts:136`; Control writes the returned JSON to the clipboard in `apps/runtime-player/src/control/control-window-app.tsx:209`; the state test asserts `latestRawFrame` after receive in `apps/runtime-player/src/main/input-session-state.test.ts:98`.
- Domain A parser/normalizer coverage is sufficient for Domain B's processing dependency: blendshapes, head, eyes, v2 `&` delimiter, malformed segments, TCP delimiter tolerance, clamping, head position preservation, and parser diagnostics are tested in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:6` and `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:7`.

## Test Coverage Assessment

Coverage is adequate for Wave4 Domain B.

The strongest coverage is at the responsibility boundaries that matter most for this wave: pure parser/normalizer tests, main-owned session state tests, pure throttle tests, and fake UDP socket receiver tests. This matches the Runtime Player policy preference for deterministic tests over broad Electron end-to-end coverage.

Control diagnostics are mostly source-reviewed rather than unit-tested. The panel displays the required status, transport, port, local IP, iPhone IP, handshake, remote, packet count, FPS, last packet age, malformed count, raw sample, parsed head/eye/blendshape fields, normalized frame JSON, parser warnings, and normalization warnings in `apps/runtime-player/src/control/input-diagnostics-panel.tsx:70`. The Domain B report includes a loopback and real-device checklist that covers the UI-visible behavior and copy payload.

Residual non-blocking gaps:

- There is no automated test directly around `registerInputBridgeHandlers` IPC registration, injected receiver lifecycle wiring, or socket error propagation through the bridge. The source is small and direct, and lower-level state/receiver/throttle tests cover the underlying behavior.
- There is no React/UI automated test for the Control diagnostics panel or clipboard fallback. The manual loopback checklist is acceptable for Wave4, where the gate is real receive/debug visibility rather than polished UI behavior.
- Socket error forwarding is source-reviewed but not directly asserted by the current fake UDP receiver tests, even though the fake has `emitError`. This should be a good follow-up if Domain C wants an extra low-cost hardening test.

## Commands And Results Checked

Commands reported by Domain B are appropriate for this scope. The report does not list `pnpm install`, and I did not run `pnpm install`.

Local commands run:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-session-state.test.ts src/main/input-diagnostics-throttle.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`
  - Passed: 5 files / 22 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run test:unit`
  - Passed: 15 files / 65 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main apps/runtime-player/src/preload apps/runtime-player/src/control discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`
  - Exit code 0. Only expected LF/CRLF normalization warnings were printed for tracked Runtime Player files.

## Remaining Risks / Gaps

- Real iFacialMocap device behavior, Windows firewall prompts, multi-NIC selection, iOS network permission behavior, and current app start-request behavior still require manual confirmation.
- Head/eye axis signs and head position units remain real-device evidence items.
- UDP packet loss and lack of an official UDP stop request remain accepted Wave4 limitations.
- Local IP detection is tested only indirectly through injected session-state candidates; automatic NIC choice is not implemented or tested.

## User-Decision Points

None blocking Domain B.

Later wave decisions remain: whether to add explicit NIC selection, whether to persist last iPhone IP/receive port, whether to add TCP transport, and whether to add bridge/UI automated tests before expanding from diagnostics into runtime parameter mapping.
