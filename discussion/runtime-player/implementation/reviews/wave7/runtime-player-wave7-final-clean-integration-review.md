# Runtime Player Wave7 Final Clean Integration Review

verdict: `pass`

Date: 2026-06-23

## Scope

Independent final clean integration review for Runtime Player Wave7 after Domain A, Domain B, and Domain C documentation/report alignment.

Reviewed basis:

- `discussion/runtime-player/implementation/orchestration/player-wave7-plan.md`
- Domain A/B implementation reports and Domain C final integration report under `discussion/runtime-player/implementation/waves/wave7/`
- Domain A/B review reports under `discussion/runtime-player/implementation/reviews/wave7/`
- Runtime Player screen docs, backlog, and maps listed in the task
- Target Runtime Player source areas listed in the task

I did not edit Runtime Player source or feature docs.

## Findings

### Low: Control preload Stage View surface is still broader than the Control UI currently needs

This is not a blocking integration issue for Wave7.

The Control preload still exposes Stage reporter/listener methods such as `reportStatus`, `reportViewTransform`, `onApplyViewTransformRequested`, and the legacy `onResetViewRequested`/`resetStagePosition` aliases (`apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:123`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:145`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:175`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:192`). The Stage preload remains narrower and exposes only Runtime Export, live parameter, and Stage View reporter APIs (`apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:35`).

No raw tracking, diagnostics, or Model Mapping API is exposed through the Stage bridge. The existing boundary test asserts Stage bridge source does not include Control/Input/Model Mapping APIs or raw tracking strings (`apps/runtime-player/src/runtime-player-boundary.test.ts:73`).

Recommendation: keep this as a future cleanup item, not a Wave7 blocker.

## Integration Checks

### Domain A/B coexistence

Pass.

- `runtime-player-main.ts` initializes Window State first, creates windows with the restored state, attaches window-state tracking, then registers Stage View, live parameter, input, and model mapping bridges in one main-process lifecycle (`apps/runtime-player/src/main/runtime-player-main.ts:23`, `apps/runtime-player/src/main/runtime-player-main.ts:31`, `apps/runtime-player/src/main/runtime-player-main.ts:36`, `apps/runtime-player/src/main/runtime-player-main.ts:49`, `apps/runtime-player/src/main/runtime-player-main.ts:66`).
- Runtime Export switch/clear flushes pending Model Mapping Profile saves before clearing mapping/live state (`apps/runtime-player/src/main/runtime-player-main.ts:81`, `apps/runtime-player/src/main/runtime-player-main.ts:95`).
- Quit handling flushes input disconnect, Model Mapping Profile, and Window State together before allowing app quit (`apps/runtime-player/src/main/runtime-player-main.ts:113`, `apps/runtime-player/src/main/runtime-player-main.ts:119`).

### Separate stores and paths

Pass.

- Model Mapping Profile storage roots under `<userData>/model-mapping-profiles` and writes `<safe-package-id>/<fingerprint>.json` (`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:47`, `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:57`).
- Model identity prefers `packageHash`; fallback uses `packageId + packageRevision + parameterSignatureHash` (`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-export-identity.ts:10`, `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-export-identity.ts:19`, `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:161`).
- `parameterSignatureHash` is generated from sorted direct target fields including `parameterId`, `projectPresetAlias`, `displayName`, `min`, `max`, and `default` (`apps/runtime-player/src/main/model-mapping-profiles/model-mapping-export-identity.ts:36`).
- Window State storage writes `<userData>/window-state/runtime-player.json` with schema `runtime-player-window-state-v1` (`apps/runtime-player/src/main/window-state/window-state-store.ts:42`, `apps/runtime-player/src/main/window-state/window-state-document.ts:7`).
- Window State stores windows plus Stage view transform, with reset fallback when transform parsing fails (`apps/runtime-player/src/main/window-state/window-state-document.ts:12`, `apps/runtime-player/src/main/window-state/window-state-document.ts:101`).

### Stage model-only boundary

Pass.

- Stage preload exposes `runtimeExport`, `liveParameters`, and `stageView` only (`apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:34`).
- The live parameter frame contract contains Runtime Export identity/timing metadata and `parameterValues`, not raw tracking payloads (`apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1`).
- Main publishes live parameter frames only to the Stage window through `liveParameterBridgeChannels.frame` (`apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:21`).
- Stage receives live frames through `window.runtimePlayerStage.liveParameters` and applies them to the renderer (`apps/runtime-player/src/stage/stage-window-app.tsx:134`, `apps/runtime-player/src/stage/stage-window-app.tsx:257`).
- Stage renderer passes `liveFrame.parameterValues` into runtime-core evaluation as authored parameter overrides (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:247`).
- Boundary tests assert Stage production files avoid `TrackingFrame`, raw frame, blendshape, and broad Control bridge strings (`apps/runtime-player/src/runtime-player-boundary.test.ts:38`, `apps/runtime-player/src/runtime-player-boundary.test.ts:73`).

### Diagnostics throttle boundary

Pass.

- Input diagnostics throttle still defaults to 100ms (`apps/runtime-player/src/main/input-diagnostics-throttle.ts:26`).
- `input-bridge-handlers.ts` records each received raw frame, invokes `onTrackingFrame` for live parameter publishing, and separately requests throttled Control diagnostics emission (`apps/runtime-player/src/main/input-bridge-handlers.ts:94`).
- Live parameter publishing is owned by model mapping bridge code and converts the latest tracking frame into sanitized `parameterValues` (`apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:89`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:30`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:72`).

## Acceptance Criteria Review

| Wave7 acceptance item | Review result |
|---|---|
| Mapping / Body Follow tuning persists per Runtime Export identity | Source/tests/reports support. Manual restart/reopen verification remains. |
| Matching profile restores slots and Body X/Z controls | Source/tests/reports support. Manual restore verification remains. |
| Reset to Auto Map regenerates mapping, resets lag, and saves | Covered by source and Domain A tests/review (`apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:161`). |
| Profile load/save failure is visible and non-blocking | Covered by source/tests/reviews; manual fault-injection remains useful. |
| Stage page available from Control nav | Source checked (`apps/runtime-player/src/control/control-window-shell.tsx:15`, `apps/runtime-player/src/control/control-window-app.tsx:553`). |
| Focus Stage works | Source/tests support; manual Electron check remains (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:140`). |
| Stage bounds persist | Source/tests support; manual restart check remains. |
| Stage pan/zoom persists | Source/tests support; manual restart check remains. |
| Reset View resets pan/zoom | Source/tests support; manual Stage page check remains (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:66`). |
| Center Model preserves zoom and recenters | Source/tests support; manual Stage page check remains (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:81`). |
| Control Window remains responsive during live tracking | Diagnostics throttling remains separate from live parameter publishing. |
| Stage remains a clean model window | Source and boundary tests support; no debug/setup UI path into Stage found. |
| Docs/maps reflect implemented behavior | Docs/maps align and keep Electron manual verification open. |

## Docs And Maps Alignment

Pass.

- `tracking-setup-live-mapping.md` records Wave7 Model Mapping Profile, separate Window State, and Stage receiving only Runtime Export plus sanitized `parameterValues` (`discussion/runtime-player/screens/tracking-setup-live-mapping.md:481`, `discussion/runtime-player/screens/tracking-setup-live-mapping.md:486`, `discussion/runtime-player/screens/tracking-setup-live-mapping.md:488`).
- `control-window-screen-structure.md` records `Overview / Input / Mapping / Stage`, Stage page v0 responsibilities, and model-only Stage constraints (`discussion/runtime-player/screens/control-window-screen-structure.md:4`, `discussion/runtime-player/screens/control-window-screen-structure.md:477`, `discussion/runtime-player/screens/control-window-screen-structure.md:689`).
- `runtime-player-backlog.md`, `runtime-player/_map.md`, and the Wave7 final integration report keep manual Electron checks open rather than marking them complete (`discussion/runtime-player/backlog/runtime-player-backlog.md:400`, `discussion/runtime-player/_map.md:52`, `discussion/runtime-player/implementation/waves/wave7/runtime-player-wave7-final-integration-report.md:78`).
- The Wave7 reviews map was missing this final clean integration review before this task and is updated by this reviewer.

## Verification Performed

Reviewer-performed:

- Read the required basis documents and maps.
- Inspected target source files with `rg` and direct file reads.
- Checked `git status --short -uall` and Wave7 diff stats.
- Checked source evidence for persistence separation, Stage bridge boundary, diagnostics throttling, mapping profile restore/save behavior, Stage page actions, and docs/map alignment.

Supplied post-Domain-C verification evidence used:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass.
- Focused Wave7 Vitest command covering Domain A/B integration and boundary tests: pass, 17 files / 63 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `git diff --check -- discussion/runtime-player apps/runtime-player`: exit 0, LF/CRLF warnings only.
- Source inspection confirmed separate persistence paths and sanitized Stage live parameter boundary.

I did not rerun `pnpm`, Vitest, typecheck, or Electron manual checks in this review. I did not run `pnpm install`.

## Review Report Path

- `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-final-clean-integration-review.md`

## Files Changed By Reviewer

- `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave7/_map.md`

## Remaining Manual Verification

- Mapping/Body Follow tune -> restart/reopen same Runtime Export -> restore.
- Stage move/resize -> restart -> restore.
- Stage pan/zoom -> restart -> restore.
- Stage page Focus/Reset/Center.
- Real iFacialMocap tracking after profile restore.
- Optional but useful: save failure / Retry fault-injection UX.
- Platform-sensitive: multi-monitor or disconnected-monitor window restore coordinates.

## User-Decision Points

None.
