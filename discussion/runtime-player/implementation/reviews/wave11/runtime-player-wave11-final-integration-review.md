# Runtime Player Wave11 Final Integration Review

- verdict: pass
- reviewer: Review-Sylph
- target/domain: runtime-player-wave11-final-integration-stage-motion

## Findings

- Blocking/Major: none.
- Source escalation: none required. Current worktree still contains Domain A/B/C source changes, but Domain D's documented pass is discussion/docs alignment only, and this review did not find a docs/source mismatch requiring source edits.

## Scope Reviewed

Reviewed the Wave11 plan section 8, Runtime Player wave planning convention, changed screen docs/maps/backlog, Domain A/B/C reports and reviews, the Domain D final integration report, targeted source/test evidence for Stage Motion transport and Browser Source sanitization, and working-tree/diff checks.

Changed docs reviewed:

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

## Required Check Trace

1. Near/far calibration is explicit and production-grade enough for Stage Motion depth scale.
   - Pass. Domain A records explicit `head-position-near-far` readiness and `Move closer` / `Move farther` prompts in `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md:19` and `:21`.
   - The updated docs state explicit near/far calibration and do not rely on incidental Z from left/right calibration. See `discussion/runtime-player/screens/control-window-screen-structure.md:315`, `discussion/runtime-player/screens/tracking-setup-live-mapping.md:143`, and `discussion/runtime-player/screens/tracking-setup-live-mapping.md:544`.

2. Stage Motion belongs to Stage page and not Mapping page.
   - Pass. `discussion/runtime-player/screens/stage-motion-head-position-follow.md:38` states the page boundary, and `:55` through `:56` state Stage-only controls and Mapping non-ownership.
   - `discussion/runtime-player/screens/tracking-setup-live-mapping.md:255` and `:518` record that Stage Motion is not a Model Mapping slot and is on Stage.

3. Settings auto-save/restore is Window State/local display setting; live offsets are not saved.
   - Pass. `discussion/runtime-player/screens/stage-motion-head-position-follow.md:178`, `:180`, and `:209` through `:212` document Window State auto-save and in-memory runtime state only.
   - `discussion/runtime-player/screens/tracking-setup-live-mapping.md:519` through `:520` confirms Window State/local display settings and transient live offsets.
   - Source persistence evidence matches: settings update only under `stageMotion.settings` in `apps/runtime-player/src/main/window-state/window-state-controller.ts:136` through `:147`, and tests assert no saved `stageMotion.liveOffset` at `apps/runtime-player/src/main/window-state/window-state-controller.test.ts:245`.

4. Browser Source receives only sanitized composed transform, not raw tracking/debug/calibration data.
   - Pass. Docs state this in `discussion/runtime-player/screens/stage-motion-head-position-follow.md:57` through `:58`, `discussion/runtime-player/screens/broadcast-stage-setup-v0.md:67` and `:73`, and `discussion/runtime-player/screens/control-window-screen-structure.md:746`.
   - Source contract only exposes `stageWindow.bounds` and `stageView.transform` in `apps/runtime-player/src/preload/browser-source-status-contract.ts:46` through `:51`.
   - Stage Motion transport builds only that display state in `apps/runtime-player/src/main/stage-motion/stage-motion-transport.ts:28` through `:51`.
   - Tests assert Browser Source Stage messages do not contain `headPosition` or `debug` in `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:137`, `:177`, and `:178`.

5. Wave10 native local preview suspension remains effective; docs do not imply Browser Source is suspended.
   - Pass. `discussion/runtime-player/screens/stage-motion-head-position-follow.md:224` through `:229` preserves the boundary: native preview may be suspended, Browser Source remains active and receives sanitized display state.
   - `discussion/runtime-player/screens/broadcast-stage-setup-v0.md:137` states only native local preview rendering is suspended while Browser Source rendering, input, mapping, body follow, dynamics, Stage transform sync, and Stage Motion remain active.
   - Transport test coverage directly asserts Browser Source updates while native preview is suspended in `apps/runtime-player/src/main/stage-motion/stage-motion-transport.test.ts:9`, with native delivery not called at `:35`.

6. Manual Stage pan/zoom remains the saved base transform.
   - Pass. `discussion/runtime-player/screens/stage-motion-head-position-follow.md:85` through `:96` defines saved base transform plus transient offsets, and `:287` records the implemented acceptance fact.
   - `discussion/runtime-player/screens/broadcast-stage-setup-v0.md:80` through `:82` and `:213` through `:218` repeat that manual pan/zoom is the saved base and live offsets are transient.
   - Source composition uses `baseTransform` and adds only smoothed offset/scale in `apps/runtime-player/src/main/stage-motion/stage-motion-transform.ts:36` through `:42` and `:93` through `:99`.

7. Stage page UI remains compact and does not introduce editor/mapping/runtime parameter controls.
   - Pass. Domain C evidence in the final report records compact panel and no mapping/editor/runtime parameter controls at `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-final-integration-report.md:68` and `:73`.
   - Docs keep Stage page responsibilities focused in `discussion/runtime-player/screens/control-window-screen-structure.md:490` through `:492`, list allowed Stage items at `:547` through `:548`, and exclude runtime parameter sliders/raw diagnostics at `:567` through `:569`.
   - UI tests assert the absence of `Mapping Profile` and `Runtime Parameter` in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:135` through `:136`.

8. Docs/maps/backlog are aligned with Wave11 implementation facts and do not route current Stage Motion as future/deferred, except labeled historical/out-of-scope notes.
   - Pass. Runtime map now routes Wave11 facts through the final report and Stage Motion doc in `discussion/runtime-player/_map.md:69` through `:72` and `:79`.
   - Screens map records Stage Motion as implemented and Stage-level, not Mapping, in `discussion/runtime-player/screens/_map.md:30`, `:35`, and `:36`.
   - Backlog marks Head-Position Stage Motion as Done at source/test/review level in `discussion/runtime-player/backlog/runtime-player-backlog.md:225` and `:227`, with implemented outcome at `:240` through `:251`.
   - My future/deferred search returned only backlog historical items explicitly marked completed later by Wave11, `initial-runtime-player-screen.md` historical Wave6 wording, and a `tracking-setup-live-mapping.md` top summary where the future items are mapping deadzone/curve and Spout/OBS automation, not Stage Motion.

9. Final integration report includes the required sentence, preserves A/B/C evidence, lists commands/results, files changed, manual verification checklist, and unresolved risks.
   - Pass. Exact required sentence appears in `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-final-integration-report.md:13` and again in the check trace at `:112`.
   - Files changed are listed at `:15` through `:27`.
   - A/B/C evidence is preserved at `:31` through `:73`.
   - Commands are listed at `:123` through `:132`.
   - Manual checklist is present at `:135` through `:147`.
   - Unresolved risks/user decision points are present at `:150` through `:161`.

10. Domain D did not edit source; source changes needing escalation should be reported.
   - Pass for Domain D review. The Domain D final report states no source under `apps/**` or `packages/**` was edited in `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-final-integration-report.md:14`.
   - `git status --short -uall` shows A/B/C source work still in the worktree, plus Domain D discussion artifacts. I did not edit source in this review.
   - Targeted `git diff --name-only -- apps/runtime-player/src/main/model-mapping-profiles apps/runtime-player/src/main/model-mapping-bridge-handlers.ts apps/runtime-player/src/main/live-mapping apps/runtime-player/src/main/runtime-export apps/runtime-player/src/preload/runtime-export-bridge-contract.ts` returned no files.
   - No source escalation is required.

## Commands Run

- `Get-Content -Raw -Encoding UTF8` for the Wave11 plan, wave planning convention, Runtime Player maps, changed docs, backlog, Domain A/B/C reports, Domain A/B/C reviews, and Domain D final report: read successfully.
- `git status --short -uall`: current worktree contains Domain A/B/C source changes and Wave11 discussion/report/review artifacts; nothing was reverted.
- `git diff --check -- discussion/runtime-player`: exit 0; Git printed LF-to-CRLF normalization warnings only.
- `git diff --name-only -- discussion/runtime-player`: listed the tracked discussion docs already modified; as expected, untracked Wave11 report/review artifacts are visible through `git status`, not this diff command.
- `git diff --name-only -- apps/runtime-player/src/main/model-mapping-profiles apps/runtime-player/src/main/model-mapping-bridge-handlers.ts apps/runtime-player/src/main/live-mapping apps/runtime-player/src/main/runtime-export apps/runtime-player/src/preload/runtime-export-bridge-contract.ts`: no files.
- `rg -n "[ \t]+$" <Domain D changed docs and Wave11 maps/report>`: no trailing whitespace matches; `rg` exited 1 because no matches were found.
- `rg -n "Stage Motion.*future|future.*Stage Motion|next proposed|next candidate|Stage Motionを次wave|Stage Motion、near/far distance response|head-position Stage Motion|near/far distance response" ...`: only historical/completed-later/out-of-scope hits, as described above.
- Targeted `rg -n` source/doc searches for near/far calibration, Stage page placement, Window State persistence, Browser Source sanitization, Wave10 suspension, manual base transform, compact UI, final report sections, and source transport tests: evidence recorded in this review.

No `pnpm install` was run. I did not rerun source test suites for Domain D because the requested final review is documentation alignment; A/B/C source verification evidence is preserved in their reports/reviews.

## Remaining Manual Verification / Unresolved Risks

- Real iFacialMocap near/far calibration and Stage Motion tuning remain pending: direction, strength, limit, invert, dead zone, and reaction.
- Manual OBS Browser Source verification remains pending: URL load, alpha preservation, WebGL2/model rendering, client/heartbeat diagnostics, Stage Motion parity, reconnect/resync, performance, and unintended audio.
- Native Stage Window local preview/fallback Electron checks remain pending: close-hide/reopen, explicit quit, startup restore, Arrange Stage, click-through recovery, always-on-top persistence, and fallback controls.
- Historical Wave6 wording remains in `discussion/runtime-player/screens/initial-runtime-player-screen.md`; this is acceptable because it is explicitly historical and outside Domain D's allowed write scope.
- Preserved A/B/C non-blocking test gaps remain: left/right recalibration preserving near/far, direct `startRuntimePlayerMain` orchestration coverage, and direct `control-window-app.tsx` near/far route branch coverage.

## User-Decision Points

- No blocking user decision is required for this final integration review.
- Later product decisions should use manual verification results to tune Stage Motion defaults and decide whether Browser Source follow-up or Spout/OBS automation work is needed.
