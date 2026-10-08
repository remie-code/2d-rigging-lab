# Runtime Player Wave7 Final Integration Report

verdict: `pass`

Date: 2026-06-23

## Scope

Domain C checked Wave7 Domain A/B integration facts from source, aligned implementation-fact documentation, and added Wave7 report/review maps. No Runtime Player source fix was required.

Domain A and Domain B are treated as already completed with `pass`.

## Source Integration Facts Checked

- Domain A/B shared contracts coexist in `runtime-player-main.ts`, Control shell/app, and preload contracts. Main owns both persistence controllers and flushes input disconnect, Model Mapping Profile, and Window State before quit.
- Model Mapping Profile and Window State use separate stores, schemas, and paths:
  - `<userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`
  - `<userData>/window-state/runtime-player.json`
- Model Mapping Profile identity prefers `manifest.sourcePackage.packageHash`; hashless fallback uses `packageId + packageRevision + parameterSignatureHash`. `loadedAtIso` and directory path are not profile identity.
- Stage preload remains narrower than Control preload. Stage receives Runtime Export payloads and `runtime-player-live-parameter-frame-v1` frames with `parameterValues`; it does not receive raw tracking frames, raw head position diagnostics, or Control `modelMapping` APIs.
- Stage renderer applies `liveFrame.parameterValues` as authored parameter overrides and keeps pan/zoom transform rendering responsibility in Stage.
- Control input diagnostics throttling remains `RuntimePlayerInputDiagnosticsThrottle` with default `100ms`; `input-bridge-handlers.ts` calls it on received tracking frames while live parameter publishing is a separate path.

## Acceptance Criteria Status

| Acceptance item | Status |
|---|---|
| Mapping / Body Follow tuning persists per Runtime Export identity | Code/tests/reports support; Electron restart/reopen manual check remains |
| Matching profile restores slot controls and Body X/Z controls | Code/tests/reports support; manual restore check remains |
| Reset to Auto Map regenerates mapping, resets lag, saves profile | Covered by Domain A tests/review |
| Profile load/save failure is visible and non-blocking | Covered by focused tests/reviews; manual/fault-injection still useful |
| Stage page is available from Control Window nav | Source checked and Domain B reviewed |
| Focus Stage works | Covered by bridge tests; manual Stage window check remains |
| Stage window position/size persists | Store/controller tests support; Electron restart manual check remains |
| Stage pan/zoom persists | Store/transform/bridge tests support; Electron restart manual check remains |
| Reset View resets pan/zoom | Covered by bridge/transform tests; manual Stage page check remains |
| Center Model preserves zoom and recenters | Covered by bridge/transform tests; manual Stage page check remains |
| Control remains responsive during live tracking | Diagnostics throttle source/test checked |
| Stage remains clean model window | Source boundary test and Stage preload/source inspection support |
| Docs/maps reflect implementation | Updated in this Domain C task |

## Changed Files

Domain C documentation/map changes:

- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave7/_map.md`
- `discussion/runtime-player/implementation/reviews/wave7/_map.md`
- `discussion/runtime-player/implementation/waves/wave7/runtime-player-wave7-final-integration-report.md`

Source files were inspected but not edited by Domain C.

## Verification Performed

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Outcome: pass.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/model-mapping-bridge-handlers.test.ts src/main/model-mapping-profiles/model-mapping-profile-store.test.ts src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts src/main/model-mapping-profiles/model-mapping-export-identity.test.ts src/main/model-mapping-profiles/model-mapping-profile-slots.test.ts src/main/live-mapping/live-mapping-state.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/main/window-state/window-state-store.test.ts src/main/window-state/window-state-controller.test.ts src/main/stage-view-bridge-handlers.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/stage/stage-renderer/stage-view-transform.test.ts src/runtime-player-boundary.test.ts`
  - Outcome: pass, 14 files / 54 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/input-diagnostics-throttle.test.ts`
  - Outcome: pass, 1 file / 2 tests.
- `node scripts/check-source-organization.mjs`
  - Outcome: pass.
- `git diff --check -- discussion/runtime-player apps/runtime-player`
  - Outcome: exit 0. Output contained LF/CRLF working-copy warnings only; no whitespace errors.
- `rg -n "[ \t]$" <Domain C docs/maps/report paths>`
  - Outcome: no matches, covering new untracked Wave7 map/report files as well as edited docs.
- `rg` source inspection over `apps/runtime-player/src` for model mapping persistence, window-state persistence, Stage live parameter frames, raw tracking boundaries, and diagnostics throttling.
  - Outcome: required integration facts confirmed.

`pnpm install` was not run.

## Manual Verification Remaining

- Mapping/Body Follow tune -> restart/reopen same Runtime Export -> restore.
- Stage move/resize -> restart -> restore.
- Stage pan/zoom -> restart -> restore.
- Stage page Focus/Reset/Center.
- Real iFacialMocap tracking after profile restore.

## Residual Risks

- Manual Electron restart/reopen behavior is not evidenced in this report.
- Multi-monitor or disconnected-monitor restore behavior remains platform-sensitive; current source restores persisted `x/y` with minimum sizes but does not clamp to active display work areas.
- Save failure and `Retry` UX has focused source/test coverage, but manual fault-injection would still improve confidence.

## User Decision Points

None.
