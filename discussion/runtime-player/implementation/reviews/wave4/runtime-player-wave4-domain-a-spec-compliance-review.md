# Runtime Player Wave4 Domain A Spec Compliance Review

> Target: `runtime-player-wave4-input-contract-parser-normalizer`
> Review lane: Spec Compliance
> Reviewer: Review-Sylph
> Verdict: `pass`

## 1. Basis

Source-of-truth documents reviewed:

- `discussion/runtime-player/implementation/orchestration/player-wave4-plan.md`
- `discussion/runtime-player/research/ifacialmocap-input-adapter-research.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`

Changed implementation/report files inspected directly:

- `apps/runtime-player/src/preload/input-tracking-frame-contract.ts`
- `apps/runtime-player/src/preload/input-bridge-contract.ts`
- `apps/runtime-player/src/preload/input-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-parsed-frame.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts`
- `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`

## 2. Findings

No blocking or non-blocking spec compliance findings.

## 3. Compliance Notes

- Typed input bridge contract/channels exist for Domain B handoff. `RuntimePlayerInputStatus`, diagnostics snapshot, diagnostics copy payload, and `RuntimePlayerInputApi` are defined in `apps/runtime-player/src/preload/input-bridge-contract.ts:56`, `apps/runtime-player/src/preload/input-bridge-contract.ts:74`, and `apps/runtime-player/src/preload/input-bridge-contract.ts:80`; channel constants are namespaced under `runtime-player:input:*` in `apps/runtime-player/src/preload/input-bridge-channels.ts:1`.
- `window.runtimePlayer.input` is exposed through preload and wired to the input channels in `apps/runtime-player/src/preload/runtime-player-bridge.ts:54`.
- The normalized `TrackingFrame` DTO matches the Wave4 intent: iFacialMocap source, UDP transport, normalized blendshapes, optional head rotation/position, optional eye rotation, and debug diagnostics in `apps/runtime-player/src/preload/input-tracking-frame-contract.ts:19`.
- The pure parser covers blendshapes, head rotation/position, right/left eyes, `sendDataVersion=v2` ampersand blendshape delimiter, malformed diagnostics, and TCP delimiter-stripped/suffixed samples. Main parser entry and relevant segment handlers are in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts:33`, `:142`, `:172`, `:202`, `:352`, and `:373`.
- The pure normalizer converts `0..100` blendshape values to `0..1`, clamps out-of-range values with diagnostics, preserves missing head/eyes as absent, preserves head position raw values, and keeps rotations in degrees. Relevant code is in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts:19`, `:71`, `:88`, `:101`, and `:123`.
- Parser and normalizer fixture tests cover the required Domain A cases in `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts:6`, `:26`, `:38`, `:54`, `:69`, `:85`, and `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts:7`, `:22`, `:39`, `:48`, `:68`.
- No runtime parameter mapping, model motion, UDP socket lifecycle, TCP receiver lifecycle, Control UI, Stage debug overlay, persistence, body-follow, head-position Stage motion, or dynamics playback was found in the Domain A changed source. `git status --short -uall` showed no Stage Window source changes.

## 4. Verification

Commands run by this reviewer:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.test.ts src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.test.ts`
  - Passed: 2 files / 11 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player run test:unit`
  - Passed: 12 files / 54 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/preload/runtime-player-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - Passed with Git CRLF normalization warnings only.
- `rg -n "[\\t ]$" apps/runtime-player/src/main/input-adapters/ifacialmocap apps/runtime-player/src/preload/input-bridge-channels.ts apps/runtime-player/src/preload/input-bridge-contract.ts apps/runtime-player/src/preload/input-tracking-frame-contract.ts discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md`
  - No trailing whitespace matches; `rg` exited 1 because there were no matches.

## 5. Remaining Risks / Gaps

- Real iFacialMocap device frames may contain additional metadata or segment forms not represented in the current official-shape fixtures. Domain B/final integration should retain raw diagnostics so these can be captured.
- `TrackingFrame.transport` is intentionally fixed to `"udp"` for Wave4; parser tolerance for TCP delimiters does not mean TCP receive is implemented.
- Input channel handlers, UDP lifecycle, 10Hz throttled debug snapshots, and Control Window diagnostics remain Domain B responsibilities.
- Head/eye axis signs, head position units, and current handshake behavior remain manual real-device verification items.

## 6. User-Decision Points

None.
