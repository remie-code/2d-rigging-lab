# Runtime Player Wave11 Final Integration Report

- verdict: pass
- domain: runtime-player-wave11-final-integration-stage-motion
- loop count: 1 documentation implementation loop, pending clean review
- implementation agent: Gnome
- scope: documentation alignment and final integration reporting only

## Scope

Domain D aligned Runtime Player discussion docs/maps with Wave11 implementation facts and wrote this final integration report.

実装事実に合わせて関連ドキュメントを更新する。

No source under `apps/**` or `packages/**` was edited in this pass. Source implementation and review evidence is preserved from Domain A/B/C reports and reviews.

## Files Changed By This Pass

- `discussion/runtime-player/screens/stage-motion-head-position-follow.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave11/_map.md`
- `discussion/runtime-player/implementation/reviews/wave11/_map.md`
- `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-final-integration-report.md`

## Preserved Domain Evidence

Domain A: Input Profile near/far calibration

- Report: [runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md](runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md)
- Review: [../../reviews/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-review.md](../../reviews/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-review.md)
- Verdict: pass.
- Evidence preserved:
  - explicit `head-position-left-right` and `head-position-near-far` readiness.
  - guided `Move closer` / `Move farther` prompts.
  - existing profiles without near/far still load.
  - missing-only calibration can guide near/far when left/right is already ready.
  - deterministic `normalizeInputProfileHeadPositionDepth`.
  - focused Vitest 6 files / 31 tests passed, typecheck passed, source organization guard passed, final unit suite 65 files / 270 tests passed.
  - Review-Sylph found no blocking or major findings.

Domain B: Stage Motion core / persistence / transport

- Report: [runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md](runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md)
- Review: [../../reviews/wave11/runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-review.md](../../reviews/wave11/runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-review.md)
- Verdict: pass.
- Evidence preserved:
  - Stage Motion settings persisted in Window State with backward-compatible defaults.
  - main-owned computation uses saved base Stage view transform, active Input Profile, session neutral, tracking frame, settings, and elapsed time.
  - dead zone, invert, strength, limit, reaction/smoothing, and base transform composition covered by focused tests.
  - Browser Source receives sanitized composed `stageDisplayState.stageView.transform`.
  - native preview display override is separate from saved manual Stage view transform.
  - Browser Source publication continues while native local preview is suspended.
  - focused Vitest 12 files / 49 tests passed, typecheck passed, source organization guard passed, unit suite 68 files / 285 tests passed.
  - Review-Sylph found no blocking or major findings.

Domain C: Stage Motion UI

- Report: [runtime-player-wave11-domain-c-stage-motion-ui-report.md](runtime-player-wave11-domain-c-stage-motion-ui-report.md)
- Review: [../../reviews/wave11/runtime-player-wave11-domain-c-stage-motion-ui-review.md](../../reviews/wave11/runtime-player-wave11-domain-c-stage-motion-ui-review.md)
- Verdict: pass.
- Evidence preserved:
  - compact Stage Motion panel renders on the `Stage` page.
  - controls update `stageView.updateStageMotionSettings(partialUpdate)`.
  - auto-save state remains visible through existing Stage persistence status.
  - missing near/far readiness is visible and recoverable through `Calibrate in Input`.
  - Browser Source Output remains before Local Preview / Fallback.
  - focused UI tests assert no mapping/editor/runtime parameter controls were introduced.
  - focused Vitest 2 files / 9 tests passed, typecheck passed, source organization guard passed.
  - Review-Sylph found no blocking or major findings.

## Final Integration Check Trace

1. Near/far calibration is explicit and production-grade enough for depth scale.
   - Domain A added separate near/far readiness, guided near/far prompts, backward-compatible profile parsing, missing-only recovery, and a deterministic depth normalization helper.
   - Docs now state that Depth Scale relies on explicit near/far calibration and must not use incidental Z values from left/right calibration as production depth.

2. Stage Motion belongs to Stage page and not Mapping page.
   - Domain C implemented the panel on `Stage`.
   - Docs now identify Stage Motion as Stage-level display transform, not Model Mapping, Runtime Export mutation, rigging, or parameter mapping.

3. Settings auto-save/restore via Window State/local display setting.
   - Domain B persists `stageMotion.settings` in Window State with defaults and does not persist live offsets.
   - Docs now state Stage Motion settings auto-save through Window State / local display settings.

4. Browser Source receives composed transform and no raw tracking/debug data.
   - Domain B review confirmed Browser Source receives sanitized Stage display transform only.
   - Docs now state Browser Source receives composed Stage transform and no raw tracking frames, raw head position, calibration internals, debug diagnostics, private paths, or Control-only status fields.

5. Wave10 native local preview suspension remains effective.
   - Domain B review confirmed Browser Source publication happens independently of native preview delivery and continues during suspension.
   - Docs now preserve the Wave10 boundary: only native local preview live rendering is suspended.

6. Manual Stage pan/zoom remains the base transform.
   - Domain B review confirmed saved `stageView.transform` remains unchanged and native display override is separate.
   - Docs now describe manual pan/zoom as the saved base transform, with Stage Motion adding transient offsets only.

7. Stage page UI is compact and does not introduce editor/mapping controls.
   - Domain C review confirmed Stage Motion panel is compact and focused UI tests assert absence of mapping/editor/runtime parameter controls.
   - Docs now list only Stage Motion settings, near/far readiness, and auto-save status on Stage.

8. Implementation facts are reflected in docs/maps.
   - Updated screen docs, backlog, runtime-player maps, orchestration map, and Wave11 wave/review maps.
   - Stage Motion is no longer described as a deferred future item in the updated Wave11-owned docs/maps.

9. Final integration docs alignment sentence is included.
   - This report includes: `実装事実に合わせて関連ドキュメントを更新する。`

## Documentation Alignment Summary

- `stage-motion-head-position-follow.md` now records Wave11 implemented facts, Window State auto-save, Browser Source transform boundary, and remaining manual checks.
- `broadcast-stage-setup-v0.md` now includes Stage Motion as part of Stage page broadcast setup and Browser Source parity checks.
- `control-window-screen-structure.md` now lists near/far calibration on Input and Stage Motion / Browser Source responsibilities on Stage.
- `tracking-setup-live-mapping.md` now separates Stage Motion from Model Mapping and records explicit near/far Input Profile calibration.
- `runtime-player-backlog.md` now marks head-position Stage Motion as done at source/test/review level and leaves OBS/Spout automation plus manual OBS checks as remaining backlog.
- Runtime Player maps now point future agents to Wave11 reports/reviews and current Stage Motion facts.

## Commands Run

- `Get-Content -Raw -Encoding UTF8 ...` for required basis docs, Domain A/B/C reports, and Domain A/B/C reviews: read successfully.
- `git status --short -uall`: observed pre-existing Domain A/B/C source/report/review changes plus docs already touched by prior planning; no unrelated changes were reverted.
- `git status --short -uall discussion/runtime-player`: confirmed Domain D docs changes and untracked Wave11 plan/report/review artifacts in discussion scope.
- `git diff --name-only -- discussion/runtime-player`: used before edits to identify existing docs delta; command completed.
- `rg -n "Stage Motion.*future|future.*Stage Motion|next proposed|nextwave|next wave|near/far distance response|head-position Stage Motion" discussion/runtime-player/screens discussion/runtime-player/backlog/runtime-player-backlog.md discussion/runtime-player/_map.md discussion/runtime-player/screens/_map.md`: found historical Wave6 references in `initial-runtime-player-screen.md` outside the allowed write scope and old backlog references that this pass updated or marked as completed later by Wave11.
- `git diff --check -- discussion/runtime-player`: passed; Git printed LF-to-CRLF normalization warnings only.
- `rg -n "[ \t]+$" <Domain D touched docs>`: no trailing whitespace matches. `rg` returned exit 1 because there were no matches.

No source tests/typecheck were run by Domain D because this pass only touched discussion docs. Domain A/B/C source verification evidence is preserved above.

## Manual User Verification Checklist

- Recalibrate or run missing-only calibration for near/far in Input Profile with real iFacialMocap input.
- Enable Stage Motion on the Stage page.
- Move head left/right and confirm horizontal Stage offset direction, strength, and limit.
- Move closer/farther and confirm depth scale direction, strength, and limit.
- Adjust invert, dead zone, and reaction while watching native Stage and OBS Browser Source.
- Confirm manual Stage pan/zoom remains the base position/scale.
- Confirm OBS Browser Source shows the same composed Stage Motion result as native preview when native preview is active.
- Confirm Browser Source continues Stage Motion while native local preview live rendering is suspended.
- Restart Runtime Player and confirm Stage Motion settings restore.
- Confirm Wave10 suspension/resume behavior: Browser Source connect suspends native live rendering, disconnect resumes after the grace period, reconnect during grace avoids preview bounce.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
- Confirm OBS audio meter does not receive unintended audio.

## Unresolved Risks / User Decision Points

- Real-device tuning for Stage Motion defaults remains pending: horizontal strength/limit, scale strength/limit, invert direction, dead zone, and reaction.
- Manual OBS Browser Source verification remains pending for URL load, alpha preservation, WebGL2/model rendering, connected/heartbeat diagnostics, Stage Motion parity, hide/show/manual refresh reconnect/resync, performance, and unintended audio.
- Native Stage Window local preview/fallback Electron checks remain pending: close-hide/reopen, explicit quit, startup restore valid/invalid paths, Arrange Stage drag, click-through tray recovery, always-on-top persistence, and fallback controls.
- `initial-runtime-player-screen.md` still contains historical Wave6 wording that Stage Motion was not implemented in Wave6. It was not edited because it was outside this Domain D allowed write scope; updated maps now route current Stage Motion facts through the Wave11 docs.
- Domain A/B/C reviews noted only non-blocking test gaps:
  - left/right recalibration preserving an already-calibrated near/far section.
  - direct `startRuntimePlayerMain` orchestration test coverage.
  - direct `control-window-app.tsx` route branch test for near/far calibration mode.
- Spout2 sender, obs-websocket, automatic OBS source creation, and automatic OBS capture verification remain future/deferred.
