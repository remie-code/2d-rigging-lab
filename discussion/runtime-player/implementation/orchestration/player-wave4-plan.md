# Runtime Player Wave 4 Plan: iFacialMocap Receive + Tracking Debug

> Runtime Player Wave4は、iFacialMocapからUDP frameを受信し、parse / normalizeしてControl WindowのDebug / Diagnosticsで確認できる状態にする。Runtime parameter mapping、Stage motion、モデルアニメーションは対象外。Wave4のgateは「実機からtracking dataを受け取って内容を見られること」であり、「モデルが動くこと」ではない。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Runtime Player Wave4
- Wave name: `runtime-player-ifacialmocap-receive-tracking-debug`
- Primary objective:
  - Control WindowのInput SourceでiFacialMocap UDP receiveを開始/停止できる。
  - Electron main processでUDP `49983` をlistenし、任意でiPhone IPへhandshake/start requestを送れる。
  - raw iFacialMocap frameをparseし、adapter-independent normalized tracking frameへ変換する。
  - Control WindowのDebug / Diagnostics panelで接続状態、raw frame、parsed blendshapes、head rotation/position、eye rotation、normalized tracking frameを確認できる。
  - Copy diagnosticsでユーザーが実機確認結果を共有できる。
  - Stage Windowにはtracking/debugを出さず、モデルはまだtrackingで動かさない。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> ready_to_plan`.

Why planning is now safe:

- Runtime Player Wave3は完了し、Stageはruntime-core evaluated default poseを表示できる。
- ユーザーはWave3の実画面でdefault parameter表示、mouse pan、wheel zoomを確認済み。
- Wave4のscopeは合意済み:
  - iFacialMocap connection/receive/parse/normalized frame/debug displayをgateにする。
  - Runtime parameter mappingやモデルを動かすことはWave5以降に送る。
- Sylph調査により、Control WindowのInput Source placeholder、main/preload IPC pattern、Stage status wiring、existing placeholder input stateが確認済み。
- UDP-firstが最小リスクで、TCPは後続でよい。

Uncertainty:

- factual: medium. 実機frame、Windows firewall、multi-NIC、handshake実挙動は実機確認が必要。
- decision: low. UX/scope方針は合意済み。
- cost of wrong plan: high. input adapter境界を誤るとWave5 mapping/runtime applyで作り直しになる。

Precondition:

- Runtime Player Wave3 source exists and launches.
- User has iFacialMocap installed/configurable on an iOS device for manual verification.
- Implementation agents must not run `pnpm install`.
- No new package dependency is expected for UDP because Node `dgram` is available in Electron main.

## 3. Accepted Decisions / Oracles

### 3.1 Wave4 Gate Is Receive / Parse / Debug, Not Model Motion

Required:

- iFacialMocap UDP frames can be received by Runtime Player.
- Frames can be parsed into source-specific parsed data.
- Parsed data can be normalized into adapter-independent `TrackingFrame`.
- Control Window displays enough diagnostic information for user verification.
- Runtime Export does not have to be loaded before connecting.
- Stage Window remains unchanged by tracking input.

Forbidden:

- Runtime parameter mapping.
- Applying tracking values to `Face Angle X/Y/Z` or any other model parameter.
- Body follow head.
- head position driven Stage scale/translation.
- dynamics time progression.
- manual parameter controls.
- Stage overlay/debug UI.

### 3.2 UDP-Only In Wave4

Required:

- Implement UDP receive first.
- Default receive port is `49983`.
- UDP receive should work by passive listen when iFacialMocap sends to the PC.
- If an iPhone IP is provided, Runtime Player may send the official start/handshake request over UDP.
- TCP receive is not required in Wave4.

Rationale:

- iFacialMocap official protocol describes UDP `49983` as the direct receive path.
- TCP still requires UDP start behavior and TCP frame delimiting with `___iFacialMocap`.
- Adding both transports before parser/debug are proven increases risk.

Parser requirement:

- Parser should be structured so TCP delimiter-stripped samples can be tested later without rewriting blendshape/head/eye parsing.

### 3.3 Control Debug Stream Is Throttled To 10Hz

Required:

- Receiver/parser may process incoming frames at source rate.
- Main process stores latest input status/frame/diagnostics.
- Renderer-facing debug snapshots are emitted to Control Window at most 10Hz.
- 10Hz means no more than one Control debug update every 100ms.
- Packet count, last packet time, FPS estimate, and latest raw frame must still be maintained internally at receive rate.
- Copy diagnostics uses the latest retained main-process state, not the last rendered React update.

Rationale:

- iFacialMocap may send around 60 FPS.
- Debug UI does not need frame-rate visual updates.
- 10Hz is responsive enough for human diagnostics while avoiding unnecessary React churn.

### 3.4 iPhone IP Is Optional

Required:

- User can start listening without entering iPhone IP.
- If iPhone IP is empty, Runtime Player performs passive listen only.
- If iPhone IP is provided, Runtime Player attempts UDP handshake/start request and reports the result in diagnostics.

Accepted limitation:

- Exact handshake behavior may require real device confirmation. Wave4 should expose diagnostic evidence rather than hide uncertainty.

### 3.5 Debug UI Is A Formal Diagnostics Surface

Required:

- Debug / Diagnostics panel lives in Control Window.
- Debug panel is normally collapsible/secondary, not the main Stage experience.
- Stage Window must not show debug text, raw frames, blendshape tables, or overlays.
- Copy diagnostics must be available from Control Window.

Required diagnostic fields:

- connection state: idle, listening, receiving, stale, error.
- transport: UDP.
- receive port.
- local IP candidates.
- optional iPhone IP / remote sender IP and port.
- last packet time / age.
- packet count.
- estimated FPS.
- raw frame sample, truncated for display but full enough in copied diagnostics.
- parsed blendshape count and list.
- head rotation.
- head position raw.
- left/right eye rotation.
- normalized tracking frame.
- parser diagnostics, malformed segment count, last parse error if any.

### 3.6 Normalized TrackingFrame Contract

Required shape concept:

```ts
type TrackingFrame = {
  source: "ifacialmocap";
  timestampMs: number;
  sequence?: number;
  transport: "udp";
  blendshapes: Record<string, number>; // normalized 0..1, original ARKit/iFacialMocap names
  head: {
    rotationEulerDeg?: { x: number; y: number; z: number };
    positionRaw?: { x: number; y: number; z: number };
  };
  eyes?: {
    leftEulerDeg?: { x: number; y: number; z: number };
    rightEulerDeg?: { x: number; y: number; z: number };
  };
  debug?: {
    rawFrameSample?: string;
    malformedSegmentCount?: number;
    parseWarnings?: readonly string[];
  };
};
```

Required:

- Blendshape values normalize from `0..100` to `0..1`.
- Clamping should be explicit and produce diagnostics when values are outside expected range.
- Head and eye rotations remain degrees.
- `head.positionRaw` must be kept even if Wave4 does not use it.
- No runtime parameter values are produced in Wave4.

## 4. Primary Basis

Runtime Player basis:

- [Initial Runtime Player Screen](../../screens/initial-runtime-player-screen.md)
- [Runtime Player Technology Stack Decision](../../architecture/technology-stack-decision.md)
- [Runtime Player Development Policy](../../architecture/runtime-player-development-policy.md)
- [Tracking Input Mapping Baseline](../../architecture/tracking-input-mapping-baseline.md)
- [iFacialMocap Input Adapter Research](../../research/ifacialmocap-input-adapter-research.md)
- [Runtime Player Backlog](../../backlog/runtime-player-backlog.md)
- [Runtime Player Wave3 Final Integration Report](../waves/wave3/runtime-player-wave3-final-integration-report.md)

Current implementation facts:

- Control Window is currently mostly one component in `apps/runtime-player/src/control/control-window-app.tsx`.
- Input Source panel and Connect/Disconnect actions exist as placeholders.
- Debug UI currently exists only as a placeholder strip.
- Main/preload IPC already uses typed contracts and namespaced channels.
- Stage status/report wiring exists and can be used as a pattern, but Stage itself is out of scope.
- Existing placeholder action state includes `connect-input`, `disconnect-input`, `look-forward`, and `open-debug`.

Likely implementation areas:

- `apps/runtime-player/src/main/input-adapters/ifacialmocap/**`
- `apps/runtime-player/src/main/**` input bridge/session/status files
- `apps/runtime-player/src/preload/**` input bridge contract/channels
- `apps/runtime-player/src/control/**` input source/debug diagnostics UI
- focused tests under `apps/runtime-player/**`

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Input Bridge Contract + iFacialMocap Parser/Normalizer

Batch 2:
  Domain B: UDP Receiver + Control Diagnostics UI

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Parallelism summary:

| Domain | Can run in parallel? | Reason |
|---|---:|---|
| A. Input Bridge Contract + Parser/Normalizer | No | Establishes typed input state, normalized frame shape, parser diagnostics, and test fixtures. Receiver/UI should not guess this contract. |
| B. UDP Receiver + Control Diagnostics UI | No | Depends on Domain A's input state and normalized frame contract. |
| C. Final Integration / Clean Review | No | Depends on A and B completion and must review integrated behavior. |

Rationale:

- Parser/normalizer should be pure and well-tested before network lifecycle and UI are connected.
- UDP receiver and Control UI need the same status/diagnostics contract.
- Splitting keeps Wave4 from accidentally expanding into runtime parameter mapping.

## 6. Acceptance Criteria

### 6.1 Input Bridge And State

Required:

- Add typed preload/main bridge for input source status and diagnostics.
- Control Window can subscribe to input status/debug snapshots.
- Main process owns input adapter lifecycle and network sockets.
- Renderer never imports `node:dgram`, `node:net`, raw Electron APIs, or socket handles.
- Input state tracks idle/listening/receiving/stale/error.
- Debug snapshots sent to Control Window are throttled to at most 10Hz.

### 6.2 iFacialMocap Parser / Normalizer

Required:

- Parse blendshape segments.
- Parse `=head#rotX,rotY,rotZ,posX,posY,posZ`.
- Parse `rightEye#rotX,rotY,rotZ`.
- Parse `leftEye#rotX,rotY,rotZ`.
- Support `sendDataVersion=v2` `&` delimiter samples.
- Preserve parse warnings/malformed segment count.
- Normalize blendshape values to `0..1`.
- Preserve head position raw.
- Preserve rotations as degrees.
- Produce a normalized `TrackingFrame`.

### 6.3 UDP Receiver

Required:

- Listen on UDP receive port, default `49983`.
- Start/stop without crashing.
- Passive listen works with no iPhone IP.
- Optional iPhone IP triggers UDP handshake/start request attempt.
- Track remote sender IP/port after packets arrive.
- Track packet count, last packet time/age, estimated FPS.
- Handle malformed packets without crashing the app.
- Surface socket errors in Control diagnostics.

### 6.4 Control Window Diagnostics

Required:

- Replace placeholder Connect/Disconnect behavior with real input receive controls.
- Show connection state, transport, receive port, local IP candidates, remote sender, packet count, FPS, last packet age.
- Provide collapsible Debug / Diagnostics section.
- Show raw frame sample.
- Show parsed blendshape count/list.
- Show head rotation and head position raw.
- Show left/right eye rotation.
- Show normalized tracking frame summary.
- Provide Copy diagnostics.
- Stage remains unchanged and does not move.

### 6.5 Verification Without Real Device

Required:

- Parser fixture tests.
- Normalizer tests.
- Input state tests.
- IPC/bridge contract tests if consistent with existing Runtime Player test style.
- Fake UDP sender or injected receiver tests if feasible.
- Manual real-device checklist in the domain/final report.

### 6.6 Out-Of-Scope Enforcement

Required:

- No runtime parameter mapping.
- No writing to model parameters.
- No Stage frame consumption.
- No body follow.
- No head position driven Stage motion.
- No dynamics playback.
- No parameter slider UI.

## 7. Domain A: `runtime-player-wave4-input-contract-parser-normalizer`

Purpose:

- Establish the input bridge contract, input state DTOs, iFacialMocap parser, normalizer, diagnostics payload, and tests.

Allowed write scope:

- `apps/runtime-player/src/main/input-adapters/ifacialmocap/**`
- `apps/runtime-player/src/main/**` for input state types only if needed
- `apps/runtime-player/src/preload/**`
- focused tests under `apps/runtime-player/**`
- focused reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- `apps/runtime-player/src/stage/**` except tests proving Stage is untouched, if needed
- broad `packages/**` changes
- `node_modules/**`

Required implementation:

- Add typed input bridge contract/channels if not already present.
- Add normalized `TrackingFrame` DTO/type in an appropriate Runtime Player-local location.
- Add pure iFacialMocap frame parser.
- Add pure normalizer.
- Add diagnostics/copy payload shape.
- Add fixture tests for parser/normalizer.

Forbidden implementation:

- UDP socket lifecycle.
- Control UI.
- runtime parameter mapping.
- Stage updates.

Expected report:

- Files changed.
- Contract shape.
- Parser/normalizer coverage.
- Verification performed.
- Known parse limitations.

Early escape triggers:

- Official frame examples are insufficient to write a credible parser fixture.
- Input contract requires a shared package instead of Player-local types.
- Existing preload bridge cannot accept a new namespace without broader refactor.

## 8. Domain B: `runtime-player-wave4-udp-receiver-control-diagnostics`

Purpose:

- Wire UDP receive lifecycle to Control Window diagnostics using Domain A's contract.

Dependencies:

- Domain A input state and normalized frame contract.

Allowed write scope:

- `apps/runtime-player/src/main/**`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/control/**`
- focused tests under `apps/runtime-player/**`
- focused reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- `apps/runtime-player/src/stage/**` except boundary tests if needed
- runtime parameter evaluation/mapping code
- persisted settings implementation

Required implementation:

- Add UDP receiver lifecycle in Electron main process.
- Add passive listen with default port `49983`.
- Add optional handshake/start request when iPhone IP is provided.
- Add status/debug snapshot store in main.
- Emit Control debug snapshots at most 10Hz.
- Replace placeholder Connect/Disconnect behavior.
- Add Control diagnostics panel/drawer.
- Add Copy diagnostics action.
- Add tests for state/lifecycle/throttle/diagnostics where feasible.

Forbidden implementation:

- TCP transport.
- runtime parameter mapping.
- Stage motion or model animation.
- calibration/Look Forward implementation beyond placeholder status.
- persistent input settings.

Expected report:

- Files changed.
- UDP lifecycle summary.
- 10Hz throttling implementation.
- Control diagnostics behavior.
- Copy diagnostics payload.
- Verification performed.
- Manual real-device checklist.
- Known platform/firewall/multi-NIC risks.

Early escape triggers:

- UDP socket lifecycle cannot be tested or isolated without broad main-process restructuring.
- Electron main/preload bridge cannot safely stream status without a user-visible architecture decision.
- iFacialMocap handshake exact message is too uncertain to implement without an explicit fallback.

## 9. Domain C: `runtime-player-wave4-final-integration-clean-review`

Purpose:

- Validate Runtime Player Wave4 as an iFacialMocap receive/parse/debug wave.

Allowed write scope:

- `discussion/runtime-player/implementation/waves/wave4/**`
- `discussion/runtime-player/implementation/reviews/wave4/**`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- narrow source/test fixes only if clean review requires them

Required checks:

- Domain A and Domain B reports exist.
- Review lanes exist and pass or explicitly escalate.
- UDP-only scope is preserved.
- Control diagnostics expose required fields.
- Debug snapshots are throttled to at most 10Hz.
- Runtime parameter mapping/model motion are not implemented.
- Stage Window remains capture-clean and unaffected.
- Manual real-device verification instructions are clear.

Expected final artifacts:

- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave4/_map.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/runtime-player-wave4-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave4/_map.md`

## 10. Review Policy

Each implemented domain requires three review lanes:

1. Spec Compliance Review
   - Check against this plan and iFacialMocap research.
   - Verify UDP-only receive/parse/debug scope.
2. Design / Development Compliance Review
   - Check Runtime Player Development Policy.
   - Check main/preload/control boundaries, file splitting, IPC/preload safety, source organization, dependency scope.
3. Test Adequacy Review
   - Check parser/normalizer fixtures, input state tests, receiver/throttle tests, typecheck, dependency/source checks, and manual verification instructions.

Reviewers must report `pass`, `needs_changes`, or `escalate`.

Blocking findings include:

- Runtime parameter mapping is implemented in Wave4.
- Stage moves or consumes tracking frames.
- UDP receiver lives in renderer instead of main.
- Renderer imports Node/Electron/socket APIs.
- Debug snapshots are unthrottled at packet rate.
- Parser drops head position.
- Copy diagnostics lacks raw/parsed/normalized evidence.
- Connect requires Runtime Export to be loaded.
- Invalid/malformed frames crash the app.
- No credible manual real-device verification path.

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| UDP receive lifecycle exists in main | source + tests/manual |
| parser handles blendshape/head/eyes | parser tests |
| v2 `&` delimiter supported | parser test |
| normalizer clamps 0..100 to 0..1 | normalizer test |
| head position preserved | parser/normalizer test |
| Control diagnostics visible | source/manual |
| Copy diagnostics available | source/test/manual |
| debug stream throttled to 10Hz | state/throttle test |
| Stage unaffected | boundary/source review |
| no runtime parameter mapping | source review |

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this Runtime Player Wave4 plan as source of truth.
- Start with bounded current-state confirmation for Runtime Player Wave3 code, input placeholders, and main/preload IPC patterns.
- Delegate Domain A before Domain B.
- Delegate independent review to Review-Sylphs for each implemented domain.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Keep Wave4 focused on iFacialMocap UDP receive/parse/normalized tracking/debug.
- Do not implement runtime parameter mapping, model motion, body-follow, head-position Stage motion, dynamics playback, or persistence.
- Keep Stage Window free of debug UI and tracking overlays.
- Follow Runtime Player Development Policy and Source File Organization Policy.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking.

## 13. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave4 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 14. Out of Scope

- TCP receiver.
- VMC/OSC adapter.
- runtime parameter mapping.
- applying tracking to `Face Angle X/Y/Z`.
- model animation from tracking.
- body follow head.
- head position driven Stage scale/translation.
- calibration / Look Forward implementation.
- dynamics time progression.
- manual parameter controls.
- Stage overlay/debug UI.
- Stage size/persistence/settings.
- previous Runtime Export auto restore.
- Runtime Export generation or mutation.
- Editor feature changes.
- packaging/distribution.
