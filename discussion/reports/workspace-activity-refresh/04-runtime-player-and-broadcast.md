# Workspace Activity Refresh — Runtime Player / Broadcast

## Scope / inspected entry points

This report is a read-only activity refresh for Runtime Player and its broadcast path. The required contract was read first: [audit-contract.md](audit-contract.md), then `discussion/_conventions.md`, `discussion/_map.md`, and all seven Runtime Player topic maps. The inspected map inventory is **53 `_map.md` files** (7 parent/topic maps plus 46 W1–W23 wave/review maps).

Source/package entry points inspected:

- [runtime-player-main.ts](../../../apps/runtime-player/src/main/runtime-player-main.ts) — Electron composition root, profile-slot launch, Runtime Export lifecycle, Native Stage/Browser Source fan-out, quit handling, role composition, and Control Channel.
- [runtime-export-directory-loader.ts](../../../apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts) and [runtime-export-load-workflow.ts](../../../apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts) — Runtime Export v0 manifest/capability/single-page/artifact validation and load/clear status propagation.
- [browser-source-server.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-server.ts), [browser-source-session.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-session.ts), [browser-source-config-store.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-config-store.ts), and [browser-source-stage-client.ts](../../../apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts) — loopback HTTP/WS server, token gate, payload/frame protocol, diagnostics, resync, and reconnect.
- [ifacialmocap-udp-receiver.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts), [ifacialmocap-frame-parser.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts), and [ifacialmocap-normalizer.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts) — UDP receive/start request, parser, and normalized tracking-frame boundary.
- [runtime-parameter-frame.ts](../../../apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts) and [vowel-lipsync-estimator.ts](../../../apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts) — sanitized live parameter output and W22/W23 mouth/vowel behavior.
- [stage-view-bridge-handlers.ts](../../../apps/runtime-player/src/main/stage-view-bridge-handlers.ts), [control-window-recovery.ts](../../../apps/runtime-player/src/main/window-management/control-window-recovery.ts), and role-composition sources — Native Stage lifecycle, persistence/recovery, Tracking Host versus Autonomous Host composition.
- [apps/runtime-player/package.json](../../../apps/runtime-player/package.json), Runtime Player tests, tracked diagnostics logs, wave/review reports, and Git history.

## Executive summary

1. Runtime Player is an Electron desktop app with separate Control and transparent model-only Stage windows. Runtime Export is loaded from a validated directory; tracking is consumed in the main process and only sanitized parameter frames cross renderer/broadcast boundaries.
2. Browser Source is the accepted primary broadcast path after W10. It is a loopback (`127.0.0.1`) HTTP/WebSocket server with a persisted token and preferred port; Native Stage remains local preview/fallback. Browser Source clients receive Runtime Export payload, sanitized live frames, active Variant, effective Dynamics, and composed Stage transform—not raw tracking or private diagnostics.
3. The source implementation covers iFacialMocap UDP receive, optional iPhone start-request send, parser/normalizer diagnostics, mapping, Stage Motion, Variant, Dynamics Tune, renderer caches/compiled render-frame path, lightweight Performance Diagnostics, and W22/W23 vowel mapping.
4. Current deterministic verification is green: Runtime Player typecheck exits 0; package Vitest reports **140 files / 925 tests passed**. This is stronger than the historical W23 snapshot (479/2 pre-existing Browser Source expectation failures); commit `d9801d0` records the expectation repair and three consecutive 925/925 runs.
5. Wave/review evidence through W20 is a source/review pass; W21 Domains A/B pass but Domain C human checks are pending; W22 and W23 source/test/review passes remain separate from real iFacialMocap and real vowel-rig observation.
6. Existing performance logs are objective captures only. Native Stage recorded 60.1 live-message FPS and 50.4 applied/render FPS; Browser Source captures recorded 57.2/40.1 and 59.9/56.7, with Chrome rAF probe 83.7. They do not prove subjective smoothness, OBS/CEF provenance, alpha/WebGL2/model parity, or a universal 60 FPS guarantee.
7. Real Runtime Export + iFacialMocap + OBS checks, packaged/dev Electron lifecycle, W21 persistence/reset/isolation/artifact checks, and W22/W23 vowel-rig checks remain explicit product/device gates.
8. AI-cohost C7 is an accepted human visual-closure boundary, not a measured two-instance performance gate; no automatic deep-profile/optimization reopening is implied.

## What was built / investigated

### Runtime Export and render/broadcast data flow

`loadRuntimeExportDirectory()` resolves the selected directory, parses `runtime-export.json`, asserts required capabilities (`directory-runtime-export-v0`, raw RGBA8 texture pages, materialized atlas UVs, transparent background), enforces one texture page, parses model/atlas artifacts, checks cross-artifact consistency, hashes/checks texture bytes, and returns a payload. The load workflow broadcasts loading/loaded/error status to Control and Stage and invokes changing/loaded/cleared callbacks ([loader](../../../apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:28), [workflow](../../../apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:44)).

At the composition root, changing/cleared lifecycle flushes profile saves, resets body/vowel state, clears mapping/dynamics/physiology/Variant/live frames, drops Control Channel overlays/slots, and clears Browser Source Runtime Export state. Loaded lifecycle applies the same payload to input/mapping/dynamics/physiology/Variant, derives writable auto-mapping slots, publishes sanitized payload/effective tuning/Variant, and republishes the latest parameter frame ([runtime-player-main.ts](../../../apps/runtime-player/src/main/runtime-player-main.ts:542)).

Native Stage delivery is conditional on the local-preview suspension policy; every live frame continues to update Browser Source and Stage Motion while Native Stage frame delivery is suppressed when Browser Source clients are connected. Browser Source receives the model-only protocol state through the server session, which keeps latest frame, stage display state, Variant, Dynamics, and Runtime Export resync state ([runtime-player-main.ts](../../../apps/runtime-player/src/main/runtime-player-main.ts:430), [browser-source-session.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:205)).

### Browser Source / OBS path

The server binds loopback, prefers its persisted port, and falls back to an ephemeral loopback port if the preferred port is in use ([browser-source-server.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:141)). HTTP `/stage`, runtime-export status/payload routes, static/dev asset routes, and `/ws` require the token query. WebSocket upgrades reject missing/invalid tokens and missing keys; accepted clients receive hello/resync and are tracked with connect/disconnect/heartbeat/renderer diagnostics ([browser-source-server.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:257), [browser-source-server.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:495), [browser-source-session.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:402)). Diagnostic strings redact the token and cap length ([browser-source-server.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:624)).

The config store persists a schema-versioned token and preferred port under Electron `userData/browser-source/browser-source-config.json`; malformed documents are discarded and regenerated ([browser-source-config-store.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-config-store.ts:35)). The browser client connects, resyncs on open/reconnect, loads the current payload over HTTP, applies Stage transform/Variant/Dynamics, feeds live frames to the renderer, and emits sampled diagnostics ([browser-source-stage-client.ts](../../../apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:231), [browser-source-stage-client.ts](../../../apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:284), [browser-source-stage-client.ts](../../../apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:545)). This is the transport OBS consumes through its Browser Source URL; no OBS automation or OBS API integration is present.

### Native Stage / lifecycle

Stage bridge state reports window availability, capture/click-through/always-on-top state, view transform, render metrics, and Stage Motion; a closed Stage clears ready/model-visible status and `Focus Stage` can recreate/focus it ([stage-view-bridge-handlers.ts](../../../apps/runtime-player/src/main/stage-view-bridge-handlers.ts:87)). Control close requests normal quit and closes Stage; Stage close alone is recoverable. Before quit, input disconnect, mapping/dynamics/physiology save flushes, and window-state flush run via `Promise.allSettled` before the actual quit ([control-window-recovery.ts](../../../apps/runtime-player/src/main/window-management/control-window-recovery.ts:25)). Packaged/dev process-exit behavior is source-inspected/unit-tested but not a completed OS-level smoke gate.

### iFacialMocap input boundary

The receiver binds UDP4 (default iFacialMocap port), reports listening/error/message callbacks, and optionally sends the versioned start request to a configured iPhone host; the send result is recorded as sent/error, not as an application-level acknowledgement ([ifacialmocap-udp-receiver.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:41), [ifacialmocap-udp-receiver.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:126)). The parser accepts TCP delimiter stripping, head/eye transforms, blendshape segments, malformed-segment warnings, and sequence/timestamp metadata ([ifacialmocap-frame-parser.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts:33)). The normalizer converts percent blendshapes to clamped 0..1 values, emits `source: "ifacialmocap"`/`transport: "udp"`, and preserves bounded debug diagnostics ([ifacialmocap-normalizer.ts](../../../apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts:19)).

### W22/W23 lipsync

With vowel lipsync disabled or unsupported, mouth-vowel parameters are not emitted and mouth-open retains jawOpen fallback. With W22/W23 enabled, the estimator is shared once per frame; W22 couples mouth-open to winner intensity, and W23 emits five normalized convex vowel strengths summing to `s` with `mouth_open = s` ([runtime-parameter-frame.ts](../../../apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:45), [runtime-parameter-frame.ts](../../../apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:171), [vowel-lipsync-estimator.ts](../../../apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts:48)). Source and focused tests pass; real speech/iFacialMocap and real vowel-rig observation are intentionally outside automated evidence.

### Tracking Host / Autonomous Host boundary

Role is resolved once at the composition root and selects a data-driven subsystem. Tracking Host wires input/profile/mapping registrars and UDP input; Autonomous Host is inert with no UDP/input registrars and instead starts a 60 Hz frame heart on Runtime Export load. The shared live-parameter and renderer/broadcast seams remain unchanged ([runtime-player-main.ts](../../../apps/runtime-player/src/main/runtime-player-main.ts:107), [runtime-player-main.ts](../../../apps/runtime-player/src/main/runtime-player-main.ts:458), [input-subsystem.ts](../../../apps/runtime-player/src/main/role-composition/input-subsystem.ts:120), [autonomous-frame-heart.ts](../../../apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts:19)). Autonomous-only physiology/control-channel state is represented as composition data, not runtime role branches.

## Current repository state

- `HEAD`: `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`, 2026-08-08 22:18 JST). Runtime implementation commits are ancestors; the map refresh is documentation-only.
- `apps/runtime-player/package.json` is private Electron package `@private-2d-rigging-lab/runtime-player`, scripts include `dev`, `build` (typecheck + electron-vite), `pack`, `dist:win`, `typecheck`, and `test:unit`; Windows portable x64 packaging is configured ([package.json](../../../apps/runtime-player/package.json:1)).
- Source inventory: `rg --files apps/runtime-player/src` counted **371** files; test inventory matched **140** Runtime Player test files.
- Current verification: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` → exit 0; `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` → **140 passed / 925 tests passed**. The first sandboxed Vitest launch hit esbuild `spawn EPERM`; the same command succeeded on the approved escalated rerun. No current build/pack/OBS/Electron GUI run was performed for this refresh.
- Working tree contains unrelated pre-existing agent files and an untracked report directory; this refresh owns only this report and did not alter source, tests, maps, logs, stage, or commit state.

## Accepted decisions / boundaries

- Electron desktop Runtime Player, split Control + transparent model-only Stage.
- Runtime Export directory v0, single raw RGBA8 page, no Cubism SDK/Core or Editor authoring in this app.
- Browser Source over loopback HTTP/WebSocket with tokenized URL is the fixed primary broadcast path; Native Stage is local preview/fallback.
- Browser Source transport is model-only/sanitized: no raw tracking frames, raw iFacialMocap diagnostics, calibration internals, private paths, or Control-only status.
- Browser Source client suspension affects only Native local-preview live rendering; input, mapping, body follow, dynamics, Runtime Export state, Stage transform, and Browser Source remain active.
- Runtime Player Performance Diagnostics is lightweight live-health/FPS/connection/fast-path proof. Deep runtime-core profiling is developer/test-only and is not product-reachable through Control, Stage IPC, or Browser Source.
- W21 Dynamics Tune is runtime-only and persisted separately from Runtime Export artifacts; Native Stage and Browser Source use the same effective profile.
- W22/W23 vowel output is source/test-complete but manual iFacialMocap/vowel-rig acceptance remains separate.
- AI-cohost C7 human visual closure is accepted as a product boundary, not a two-instance benchmark or automatic optimization trigger; current control-channel truth is in [ai-cohost runtime control channel](../../ai-cohost/architecture/runtime-player-control-channel.md).

## Verification / experiment evidence

### Automated source evidence

- Current Runtime Player typecheck: exit 0 (command above).
- Current Runtime Player unit suite: 140 files / 925 tests passed. This supersedes historical W23 full-suite evidence of 479 passed / 2 pre-existing Browser Source expectation failures; `d9801d0` corrected stale `effectiveDynamicsTuning` expectations and records 925/925 three times.
- W18 focused diagnostics evidence: 3 files / 49 tests and 15 files / 128 tests for the two domains, typecheck pass; product deep-profile transport removed ([W18 final](../../runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:52)).
- W19 focused cadence evidence: 5 files / 77 tests and typecheck pass; metrics are sampled/counter summaries, not raw traces ([W19 final](../../runtime-player/implementation/waves/wave19/wave19-final-integration-report.md:35)).
- W20 focused lifecycle evidence: 3 files / 38 tests, Runtime Player typecheck and build pass in the wave report; OS-level process exit remained manual ([W20 final](../../runtime-player/implementation/waves/wave20/runtime-player-wave20-final-report.md:97)).
- W21 Domain A/B focused tests and typecheck pass after review fix loops; the report retains manual Native/OBS/persistence/reset/isolation/artifact checks ([W21 Domain A](../../runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md:77), [W21 Domain B](../../runtime-player/implementation/waves/wave21/domain-b-dynamics-tune-control-page-report.md:53)).
- W22 focused live-mapping tests: 4 files / 34 tests and typecheck pass; W23 focused live-mapping tests: 4 files / 38 tests and typecheck pass. Both clean reviews explicitly leave real iFacialMocap/vowel-rig checks to the user ([W22 review](../../runtime-player/implementation/reviews/wave22/wave22-final-clean-integration-review.md:10), [W23 review](../../runtime-player/implementation/reviews/wave23/wave23-final-clean-integration-review.md:14)).

### Tracked objective captures

- [`tmp/native-stage.log`](../../../tmp/native-stage.log:1): 10.001 s capture, input 59.9 FPS, live-message 60.1, applied/render 50.4, render p95 0.8 ms, one Native Stage client, coalesced frames 96.
- [`tmp/report.log`](../../../tmp/report.log:1): 10 s Browser Source capture, source timestamp 47.6, live messages 57.2, applied/render 40.1, Browser rAF 40.1, one client, coalesced frames 171.
- [`tmp/chrome-report.log`](../../../tmp/chrome-report.log:1): 10.006 s Browser Source capture, source timestamp 55.6, live messages 59.9, applied/render 56.7, Browser rAF probe 83.7, one client, coalesced frames 31.
- All three logs state comparison notes for Native-only, Browser Source/OBS, Stage Motion off/on, and OBS custom FPS, but the captures themselves do not include platform/URL provenance or subjective visual assessment. They exclude tokens, raw tracking, private paths, full Runtime Export payload, textures, and mesh data.

## Historical progression / turning points (W1–W23)

The wave maps and implementation/review reports record the following progression; the corresponding source history is visible in `git log -- apps/runtime-player`:

- **W1–W4 (2026-06-20–22):** Electron Runtime Player shell, Runtime Export loading/validation, iFacialMocap UDP parser/normalizer/receiver and diagnostics.
- **W5–W7 (2026-06-22–23):** Input Profile/calibration, sanitized mapping/live parameter frames, Stage runtime evaluation, Body Follow, profile/window persistence, Guided Calibration and Auto Mapping. W5 real-device observation confirmed face/eyes/mouth motion but surfaced a static-body gap; W7 user check confirmed restart/reopen/profile/Stage transform restore.
- **W8–W10 (2026-06-23):** Broadcast Stage setup/lifecycle, click-through/always-on-top/capture affordances, Browser Source loopback/token transport, and the decision that Browser Source is primary while Native Stage is local fallback. Browser Source connection suspends only Native local-preview live rendering.
- **W11–W12 (2026-06-23–25):** Near/far calibration, Stage Motion/Head Position Follow, and session-only Runtime Export Variant switching with Native/Browser parity in source/tests. Real iFacialMocap/Stage Motion/OBS calibration remained separate gates.
- **W13–W15 (2026-06-26):** Shared frame pacing, lightweight Performance Diagnostics, renderer evaluation cache, and validation/profiling boundaries. Historical deep-capture language is superseded by W18.
- **W16–W17 (2026-06-26):** Compiled runtime evaluator and render-frame fast path; renderer-target-local mutable instances avoid per-frame public snapshot materialization while preserving Runtime Export/public DTO contracts.
- **W18–W20 (2026-06-26–27):** Product deep profiling transport removal, Browser Source rAF cadence counters, then Control/Stage quit/reopen lifecycle and packaged/dev smoke boundary. Objective captures and deterministic implementation pass are complete; product confidence remains manual.
- **W21 (2026-07-02–05):** Runtime-only Dynamics Tune profile/state/UI, effective tuning shared by Native Stage and Browser Source, profile persistence and reset/isolation contracts. Domains A/B pass; Domain C human checks pending.
- **W22–W23 (2026-07-06–08):** W22 mouth-open follows winner intensity `w`; W23 replaces single winner output with normalized convex five-vowel blend and `mouth_open = s`. Source/tests/reviews pass; real speech/vowel-rig gate remains.
- **Post-wave C1–C7 (2026-07-10–12):** AI-cohost role/profile composition, Autonomous 60 Hz physiology frame heart, Stage Presence, control-channel overlay/timeline/speech/articulation integration, and baseline test expectation repair. These extend the same sanitized frame/broadcast seam; C7’s human visual closure does not establish a two-instance performance benchmark.

## Open gates / debts / uncertainties

### Manual, device, and product gates (not source failures)

- **Real Runtime Export + iFacialMocap:** verify UDP start-request/stream behavior on the target phone/host, near/far calibration, head/eye/mouth motion, and model-specific mapping.
- **Stage Motion / Dynamics / Variant parity:** in a real model, confirm Native Stage immediately reflects settings, restart/reopen restores profiles and Stage state, switching Runtime Exports does not leak tuning, reset returns exported defaults, and Browser Source matches Native output.
- **W21 Domain C:** complete persistence, reset, different-export isolation, restart/reopen, and Runtime Export artifact immutability checks, including save-failure/retry behavior where applicable.
- **OBS/Browser Source:** connect OBS with the real Browser Source URL and model, exercise 30/60/custom FPS and Stage Motion off/on, and observe alpha/background, WebGL2 availability, model parity, renderer cadence, and subjective smoothness. No OBS automation or automatic source creation exists.
- **Packaged/dev Electron:** run actual portable/dev launch, close/reopen Control and Stage through OS/taskbar paths, verify quit flush and recovery, and confirm slot/profile userData behavior.
- **W22/W23 vowel-rig:** with real iFacialMocap and a real mapped model, inspect closed-vowel opening, transition smoothness, `え` parasitism, `う` jitter, and acceptability of unsmoothed step changes before deciding whether to add smoothing/temperature controls/jawOpen shaping.

### Bounded technical debt / future scope

- iFacialMocap currently has UDP4 receive and optional start-request send, but no application-level acknowledgement or TCP transport; real network/firewall/device behavior is unverified.
- Existing logs lack capture provenance and cannot identify OBS/CEF/Chrome/Edge/Native platform cause by themselves; no universal 60 FPS contract is accepted.
- Spout2, obs-websocket automation, automatic OBS source creation, advanced mapping editor, dedicated Model/raw-input diagnostics pages, and TCP transport remain future/out-of-scope items.
- AI-cohost two-instance CPU/GPU/OBS benchmark is unmeasured and must not be inferred from C7 visual closure without a separate decision.

## Candidate next work (facts-derived; no recommendation)

1. Execute the pending W21 Dynamics Tune manual checklist with a real Runtime Export, iFacialMocap, Native Stage, Browser Source/OBS, restart/reopen, reset, second-export isolation, save-failure/retry, and artifact hash/immutability checks.
2. Execute the W22/W23 real vowel-rig checklist and record observations separately from deterministic tests; only then decide whether smoothing, blend-temperature control, or jawOpen shaping is warranted.
3. Run packaged and dev Electron lifecycle smoke, including OS close/taskbar routes, slot lock/userData isolation, Stage recreation, quit flush, and Browser Source reconnect/resync.
4. Capture a provenance-complete Native/Browser/OBS comparison (platform/browser/OBS version, URL mode, custom FPS, model, alpha/WebGL2 status) using the existing lightweight diagnostics format.
5. If a real Browser Source failure is reproduced after the above, evaluate the bounded future alternatives already recorded in the backlog (renderer/OBS settings first; Spout2 only after a critical Browser Source failure). Do not reopen deep product profiling automatically.

## Evidence index

| Evidence | Path / command | Result or claim supported |
|---|---|---|
| Contract | [audit-contract.md](audit-contract.md) | Required scope, section order, evidence categories, no source/map edits, apply_patch-only report rule. |
| Current maps | [Runtime Player map](../../runtime-player/_map.md), [implementation map](../../runtime-player/implementation/_map.md), [research map](../../runtime-player/research/_map.md), [screens map](../../runtime-player/screens/_map.md), [backlog map](../../runtime-player/backlog/_map.md) | W1–W23 status, fixed Browser Source boundary, W21 C pending, W22/23 human gates, stale follow-ups. |
| Runtime source | [runtime-player-main.ts](../../../apps/runtime-player/src/main/runtime-player-main.ts:101), `:542`, `:610`, `:675`; loader/workflow links above | Electron composition, lifecycle, clear/load fan-out, quit flush. |
| Broadcast source | [browser-source-server.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:141), `:257`, `:495`; [browser-source-session.ts](../../../apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:267), `:402` | Loopback/token HTTP/WS, resync/latest-wins frame broadcast, diagnostics/client lifecycle. |
| Tracking source | iFacial receiver/parser/normalizer links above | UDP receive/start-request, parse warnings, clamped normalized TrackingFrame. |
| Lipsync source | [runtime-parameter-frame.ts](../../../apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:45), `:171`; [vowel-lipsync-estimator.ts](../../../apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts:48) | W22 winner coupling, W23 normalized convex blend, disabled fallback. |
| Package state | [package.json](../../../apps/runtime-player/package.json:7) | Scripts, Electron/electron-builder, portable Windows x64 target. |
| Automated verification | `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`; `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` | Typecheck exit 0; 140 test files / 925 tests passed (second command required escalated rerun after initial sandbox EPERM). |
| Historical wave reports | [W18](../../runtime-player/implementation/waves/wave18/wave18-final-integration-report.md), [W19](../../runtime-player/implementation/waves/wave19/wave19-final-integration-report.md), [W20](../../runtime-player/implementation/waves/wave20/runtime-player-wave20-final-report.md), [W22](../../runtime-player/implementation/waves/wave22/wave22-final-integration-report.md), [W23](../../runtime-player/implementation/waves/wave23/wave23-final-integration-report.md) | Source/review pass and explicit manual gates. W21 Domain A/B reports linked in Verification section. |
| Objective logs | [native-stage.log](../../../tmp/native-stage.log), [report.log](../../../tmp/report.log), [chrome-report.log](../../../tmp/chrome-report.log) | Objective cadence/render counters and privacy exclusions; no subjective/product acceptance. |
| Git | `git rev-parse HEAD`; `git log --date=short --format='%h %ad %s' -- apps/runtime-player` | HEAD `af58394` map-refresh docs commit; W1–W23 and C1–C7 implementation history; `d9801d0` current 925/925 baseline repair. |

## Limitations

- No GUI, OBS, iPhone/iFacialMocap device, real Runtime Export/vowel-rig, or packaged Electron process was run during this refresh.
- No external web revalidation was performed; this report records repository evidence and already accepted research boundaries.
- Source/test pass is deterministic evidence, not product acceptance. Manual/device/product gates above must remain visibly separate from implementation/review status.
- The initial sandboxed Vitest attempt failed before test execution with esbuild `spawn EPERM`; the approved escalated rerun passed all 925 tests. This environmental detail does not change source status but is retained for reproducibility.
