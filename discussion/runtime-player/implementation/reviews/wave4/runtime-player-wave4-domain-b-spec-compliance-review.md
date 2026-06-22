# Runtime Player Wave4 Domain B Spec Compliance Review

> Target: `runtime-player-wave4-udp-receiver-control-diagnostics`
> Review lane: Spec Compliance
> Reviewer: Review-Sylph
> Verdict: pass

## Scope Reviewed

- Reviewed Domain B source and focused tests directly, including UDP receiver lifecycle, main-process input state, IPC handlers, preload bridge, Control Window connection controls, diagnostics panel, and Copy diagnostics path.
- Checked Domain A parser/normalizer and input bridge contracts as dependency basis.
- Searched Runtime Player main/preload/control/stage areas for forbidden scope signals: TCP receiver, runtime parameter mapping, Stage tracking consumption, persistence, and Look Forward/calibration implementation.
- Did not rerun test commands in this spec-compliance lane; test files were inspected as source evidence.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave4-plan.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/research/ifacialmocap-input-adapter-research.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`

## Findings

No blocking spec-compliance findings.

Compliance evidence:

- UDP receive lifecycle is implemented in Electron main, not renderer. The receiver imports `node:dgram`, defaults to UDP port `49983`, binds the socket, forwards UTF-8 datagrams with remote endpoint data, handles socket errors, and closes on stop: `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-start-request.ts:1`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:1`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:51`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:73`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:83`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:90`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:122`.
- Passive listen and optional iPhone handshake/start request are both covered. Empty `iphoneHost` skips the start request; configured `iphoneHost` sends the v2 UDP start request to port `49983` and records `pending` / `sent` / `error` diagnostics: `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:126`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:135`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:143`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:150`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts:113`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts:139`, `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.test.ts:169`.
- Main owns the latest status/debug store and copy payload. It tracks state, local IP candidates, remote endpoint, packet count, packet age, FPS, latest full raw frame for copied diagnostics, parsed frame, normalized tracking frame, parser diagnostics, normalization warnings, and handshake diagnostics: `apps/runtime-player/src/main/input-session-state.ts:54`, `apps/runtime-player/src/main/input-session-state.ts:88`, `apps/runtime-player/src/main/input-session-state.ts:106`, `apps/runtime-player/src/main/input-session-state.ts:172`, `apps/runtime-player/src/main/input-session-state.ts:188`, `apps/runtime-player/src/main/input-session-state.ts:196`, `apps/runtime-player/src/main/input-session-state.ts:240`, `apps/runtime-player/src/main/input-session-state.ts:241`, `apps/runtime-player/src/main/input-session-state.ts:242`, `apps/runtime-player/src/main/input-session-state.ts:243`, `apps/runtime-player/src/main/input-session-state.ts:245`, `apps/runtime-player/src/main/input-session-state.ts:272`.
- Renderer-facing packet diagnostics are throttled through a 100ms minimum interval, while main packet processing remains source-rate. Packet events call `state.recordReceivedFrame` and then `throttle.request`; lifecycle/error/handshake events broadcast immediately: `apps/runtime-player/src/main/input-bridge-handlers.ts:63`, `apps/runtime-player/src/main/input-bridge-handlers.ts:90`, `apps/runtime-player/src/main/input-bridge-handlers.ts:93`, `apps/runtime-player/src/main/input-bridge-handlers.ts:94`, `apps/runtime-player/src/main/input-diagnostics-throttle.ts:27`, `apps/runtime-player/src/main/input-diagnostics-throttle.ts:36`, `apps/runtime-player/src/main/input-diagnostics-throttle.ts:51`, `apps/runtime-player/src/main/input-diagnostics-throttle.test.ts:12`.
- Input bridge contract exposes the required status, diagnostics, copy, and subscription APIs without exposing sockets or raw Electron APIs to the renderer: `apps/runtime-player/src/preload/input-bridge-contract.ts:8`, `apps/runtime-player/src/preload/input-bridge-contract.ts:64`, `apps/runtime-player/src/preload/input-bridge-contract.ts:74`, `apps/runtime-player/src/preload/input-bridge-contract.ts:92`, `apps/runtime-player/src/preload/input-bridge-contract.ts:100`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:56`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:61`.
- Control Window Connect/Disconnect now calls the input bridge rather than placeholder actions, and Copy diagnostics reads the main-process copy payload before writing to the clipboard: `apps/runtime-player/src/control/control-window-app.tsx:152`, `apps/runtime-player/src/control/control-window-app.tsx:167`, `apps/runtime-player/src/control/control-window-app.tsx:187`, `apps/runtime-player/src/control/control-window-app.tsx:192`, `apps/runtime-player/src/control/control-window-app.tsx:209`, `apps/runtime-player/src/control/control-window-app.tsx:211`, `apps/runtime-player/src/control/control-window-app.tsx:414`, `apps/runtime-player/src/control/control-window-app.tsx:421`.
- Control-only diagnostics panel exposes the Wave4 diagnostic surface: state, transport, port, local IPs, iPhone IP, handshake, remote endpoint, packets, FPS, last packet age, malformed count, raw frame sample, parsed blendshape count/list, head rotation, head position, eye rotations, normalized tracking frame, parser warnings, and normalization warnings: `apps/runtime-player/src/control/input-diagnostics-panel.tsx:52`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:74`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:77`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:79`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:83`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:87`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:91`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:94`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:96`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:99`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:101`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:105`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:114`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:120`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:123`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:127`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:131`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:135`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:139`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:146`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:155`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:160`.
- Scope boundaries are preserved. Search found no Domain B implementation of runtime parameter mapping, Stage motion/debug overlay, model animation, TCP receiver, persistence, or Look Forward/calibration beyond the existing placeholder Control action. `node:dgram` appears only in main receiver code; `tcp` appears only in Domain A parser delimiter tolerance, which the Wave4 plan explicitly allowed for later reuse.

## Non-Blocking Observations

- Stale state and packet age are computed by main `getStatus`, so Copy diagnostics and fresh status reads are accurate. The renderer does not appear to have an autonomous timer to refresh the displayed state exactly when a receiving stream becomes stale; final integration/manual verification should confirm whether event-driven freshness is sufficient for Wave4: `apps/runtime-player/src/main/input-session-state.ts:207`, `apps/runtime-player/src/control/control-window-app.tsx:81`, `apps/runtime-player/src/control/control-window-app.tsx:108`.
- The 10Hz throttle applies to packet-derived diagnostics. Connect/listen/error/handshake broadcasts are immediate, which is consistent with responsive lifecycle status but should remain documented if later reviewers interpret "all diagnostics snapshots" as strictly rate-limited: `apps/runtime-player/src/main/input-bridge-handlers.ts:90`, `apps/runtime-player/src/main/input-bridge-handlers.ts:98`, `apps/runtime-player/src/main/input-bridge-handlers.ts:102`.
- The diagnostics UI summarizes handshake result/target, while full request label/message/timestamps are retained in the main diagnostics/copy payload. This is sufficient for Wave4, but a later support-focused pass may choose to show attempted/completed timestamps in the panel.

## Remaining Risks / Gaps

- Real-device iFacialMocap behavior, Windows firewall prompts, iOS local network permission, multi-NIC selection, and passive-vs-handshake behavior remain manual verification items.
- Head/eye axis signs and head position units remain intentionally unresolved Wave4 evidence items.
- UDP packet loss and recovery behavior are inherent to the Wave4 UDP-only scope.
- No explicit UDP stop request is implemented; disconnect closes the PC receiver socket only, matching the current report's stated limitation.

## User-Decision Points

- None blocking Domain B spec compliance.
- Later wave decisions remain: explicit NIC selection, persistence of receive port/iPhone IP, richer stale-state UI behavior, and whether/when to add TCP transport.
