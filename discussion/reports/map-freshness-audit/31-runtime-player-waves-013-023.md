# Runtime Player Map Freshness Audit — Waves 13–23

> Owner slice: Runtime Player Waves 13–23. Audit basis: `audit-contract.md`, `discussion/_map.md`, and repository state at HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` (2026-08-08, Asia/Tokyo).

## Verdict

The implementation evidence for Waves 13–20 and 22–23 is present and supports source/test/review `pass` within each wave's stated scope. Wave21 is only Domain A/B complete: its Domain C final integration report is absent and the current maps correctly leave the parent gate pending. The current parent maps are **partially stale**, not because the implementation evidence is missing, but because several status/index layers were not closed after later waves.

Recommended current parent verdict: **Runtime Player implementation is pass through Wave20, Wave22, and Wave23 at the deterministic source/test/review level; Wave21 remains `Domain C pending`; all real-device/Electron/OBS gates remain explicit human gates.** Do not promote the human gates to pass from map prose alone.

## Exact checked map set

Checked existing maps (21):

- Parent maps: `discussion/runtime-player/_map.md`, `discussion/runtime-player/implementation/_map.md`, `discussion/runtime-player/implementation/orchestration/_map.md`.
- Wave report maps: `discussion/runtime-player/implementation/waves/wave13/_map.md` through `wave21/_map.md` (9 files).
- Wave review maps: `discussion/runtime-player/implementation/reviews/wave13/_map.md` through `wave21/_map.md` (9 files).

Expected but absent child maps (4):

- `discussion/runtime-player/implementation/waves/wave22/_map.md`
- `discussion/runtime-player/implementation/reviews/wave22/_map.md`
- `discussion/runtime-player/implementation/waves/wave23/_map.md`
- `discussion/runtime-player/implementation/reviews/wave23/_map.md`

Also checked the 11 orchestration plans `player-wave13-plan.md` … `player-wave23-plan.md`, all wave reports/reviews in those directories, the Runtime Player source anchors listed below, and the design records for vowel lipsync.

## Wave-by-wave status

| Wave | Evidence/status | Freshness verdict | Current gate / note |
|---|---|---|---|
| 13 | Report map and final integration report are `Pass` (`waves/wave13/_map.md:9-24`, `waves/wave13/wave13-final-integration-report.md:4-31`); final clean review is `Pass` (`reviews/wave13/wave13-final-clean-integration-review.md:3-30`). | Current | Native Stage/OBS visual and captured-report checks remain pending (`implementation/waves/wave13/wave13-final-integration-report.md:84-101`). |
| 14 | Domain A/B and Domain C/final clean review are `Pass` (`waves/wave14/_map.md:9-20`, `reviews/wave14/_map.md:9-19`). | Current | Real-model Electron/OBS diagnostics remain user confirmation (`waves/wave14/_map.md:20`, `reviews/wave14/_map.md:19`). |
| 15 | Domain A/B/C and final review are `Pass` (`waves/wave15/_map.md:9-20`, `reviews/wave15/_map.md:9-19`). | Current with historical wording | `waves/wave15/_map.md:19` still describes product capture requesting deep profiling; Wave18 explicitly supersedes that product behavior (`runtime-player/implementation/_map.md:313-314`, `waves/wave18/_map.md:17-27`). |
| 16 | Domains A–D and follow-up review are `Pass` (`reviews/wave16/_map.md:9-24`); final clean review is `Pass` (`reviews/wave16/wave16-final-clean-integration-review.md:3-12`). | **Parent/map stale** | Wave16 report/map still say “pending final clean review” and follow-up “In progress” (`waves/wave16/_map.md:13-25`; `implementation/_map.md:38,101,106`; `implementation/orchestration/_map.md:24`; `runtime-player/_map.md:93`). These must be read as superseded by the existing final clean review and follow-up clean review. Real OBS deep-capture remains a human gate (`reviews/wave16/_map.md:24`). |
| 17 | All A–D lanes and three final lanes are `Pass` (`reviews/wave17/_map.md:9-43`); report map is complete. | Current | Real OBS Browser Source performance remains manually unverified in the wave evidence (`waves/wave17/_map.md:21-31`). |
| 18 | Domain A/B, Domain C report, and all final lanes are `Pass` (`waves/wave18/_map.md:15-27`, `reviews/wave18/_map.md:19-32`). | Current, with stale manual wording | Wave18 map keeps real OBS smoothness pending (`waves/wave18/_map.md:28`), while the parent implementation map later says user smoothness was confirmed (`implementation/_map.md:332`). Tracked captures now exist (`tmp/report.log`, `tmp/native-stage.log`, `tmp/chrome-report.log`, commit `233db42`), but they prove metrics, not subjective smoothness. Link the captures and keep the visual-confidence gate explicit. |
| 19 | Domain A and all final review lanes are `Pass` (`waves/wave19/_map.md:9-29`, `reviews/wave19/_map.md:9-35`). | **Partially stale; objective evidence exists** | Wave/review maps and final report still require manual OBS/CEF cadence capture (`waves/wave19/_map.md:28-39`, `reviews/wave19/_map.md:27-35`, `implementation/waves/wave19/wave19-final-integration-report.md:150-177`), but parent maps say an OBS/Chrome comparison closed the investigation (`implementation/_map.md:41,117,222,338`; `implementation/orchestration/_map.md:27`). Tracked logs support the comparison: `tmp/report.log` shows Browser Source `liveFrameMessageFps=57.2`, `applied/render/browserRafProbe=40.1`; `tmp/chrome-report.log` shows `59.9/56.7/83.7`. The logs do not encode platform/URL metadata, so link them from the maps and retain a bounded caveat rather than leaving both pending and closed claims. |
| 20 | Domain A/B closeout and post-doc reviews are `Pass` (`waves/wave20/_map.md:9-31`, `reviews/wave20/_map.md:9-36`). | Current | Packaged/dev Electron process-exit, direct Stage close/reopen, and regression smoke remain pending (`waves/wave20/_map.md:24-32`; `implementation/_map.md:42,342,359`). Stale Wave8 close-hide prose is intentionally outside the Wave20 implementation write scope (`implementation/_map.md:343`). |
| 21 | Domain A/B reports and review lanes are `Pass` after fix cycles (`waves/wave21/_map.md:7-20`, `reviews/wave21/_map.md:7-28`). Final design/development, spec/completion, and test/docs review artifacts are each `Pass` (`reviews/wave21/wave21-final-design-development-regression-review.md:3`, `reviews/wave21/wave21-final-spec-completion-review.md:3`, `reviews/wave21/wave21-final-test-docs-manual-check-review.md:3`), but they explicitly defer product checks. | **Current parent gate: Domain C pending** | No `wave21-final-integration-report.md` exists. Review map itself says its final review files were not indexed (`reviews/wave21/wave21-final-test-docs-manual-check-review.md:78-79`). Keep parent/orchestration status `Domain A/B pass; Domain C pending` (`implementation/_map.md:43`, `implementation/orchestration/_map.md:29`). |
| 22 | Domain A report, 3-lane review, final integration, and clean review are present and `pass` (`waves/wave22/wave22-final-integration-report.md:3-14`, `reviews/wave22/wave22-final-clean-integration-review.md:4-15`). | Current source/test/review pass; index incomplete | No wave/review `_map.md`. Real iFacialMocap + real vowel-rigged model gate remains pending for mouth-open discontinuity and unsmoothed `w` acceptability (`waves/wave22/wave22-final-integration-report.md:61`). |
| 23 | Domain A report, 3-lane review, final integration, and clean review are present and `pass` (`waves/wave23/wave23-final-integration-report.md:4-13`, `reviews/wave23/wave23-final-clean-integration-review.md:8-20`). | Current source/test/review pass; index incomplete | No wave/review `_map.md`. Focused tests/typecheck pass; full unit is `479 passed / 2 failed`, with the two failures attributed to pre-existing browser-source strict-equality expectations (`reviews/wave23/wave23-final-clean-integration-review.md:18-27`). Real-device vowel transition/“e” parasitism/“u” jitter gate remains pending (`waves/wave23/wave23-final-integration-report.md:72-74`). |

## Parent-map findings and recommended current state

### `discussion/runtime-player/_map.md`

- **Partially stale living-current-state map.** It ends its detailed current-edge facts at Wave21 (`:75-77`) and has no Wave22/23 navigation or facts.
- Wave16 still says final clean review is pending (`:93`), contradicted by `implementation/reviews/wave16/_map.md:13-24` and the final clean review.
- The broad manual-OBS statement (`:106`) is stale/incomplete: tracked captures exist (`tmp/report.log`, `tmp/native-stage.log`, `tmp/chrome-report.log`), and the implementation map later records Wave18/Wave19 observations (`implementation/_map.md:332,338`). The sentence still says the capture is pending and omits Waves22/23. Reconcile by linking the logs and separating objective capture evidence from subjective visual gates.
- Native Electron lifecycle checks at `:107` remain valid pending gates and should be extended with Wave22/23 real-device lipsync gates rather than silently folded into the old list.

### `discussion/runtime-player/implementation/_map.md`

- **Partially stale.** Wave16 rows/current-state still say “pending final clean review” (`:38,101,106,317`) although the final clean review and follow-up clean review are present and pass (`reviews/wave16/_map.md:13-24`).
- Wave19 rows claim OBS/Chrome environment-limit closure (`:41,117,222,338`), and tracked logs provide objective comparison data, but the wave/review maps and final report still require a manual capture. Link `tmp/report.log` and `tmp/chrome-report.log` (and identify platform/URL provenance) before removing the pending wording.
- Wave21 correctly remains Domain C pending (`:43`); Wave22/23 rows and current-state facts (`:123-126,345-355`) are the latest deterministic implementation evidence.

### `discussion/runtime-player/implementation/orchestration/_map.md`

- **Stale living index:** it stops at Wave21 (`:29`) and has no Wave22/23 plan/report/review rows.
- Wave16 status (`:24`) is stale for the same final-review reason above.
- Wave20 and Wave21 manual status is appropriately pending (`:28-29`).

### Child-map/index gaps

- Wave22 and Wave23 have no `_map.md` in either `waves/` or `reviews/`, despite parent implementation rows linking their reports/reviews. This is a living-index gap, not missing implementation evidence.
- Wave21 final review files are also not indexed in `reviews/wave21/_map.md`; the review explicitly records that omission (`reviews/wave21/wave21-final-test-docs-manual-check-review.md:78-79`).

## Source/Git anchors

The implementation source is tracked and clean relative to the audit HEAD (`git status --short -- apps/runtime-player packages/runtime-core` and `git diff --name-only HEAD -- apps/runtime-player packages/runtime-core` produced no output). Representative current source anchors:

- Frame pacing, cache invalidation, dynamics tuning, and fast-path counters: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:121-153,288-304,349,443-485,554`.
- Browser Source rAF probe and cadence fields: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:168-178,699-766`.
- Render-frame evaluator defaults to `snapshotValidation: "skip"` and records compiled/public-snapshot counters: `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:104,137-180`.
- Runtime-core render-frame API: `packages/runtime-core/src/runtime-model.ts:43,190`.
- Control-close quit and `window-all-closed` fallback: `apps/runtime-player/src/main/runtime-player-main.ts:610-625,689-693`.
- Stage close publishes `Stage unavailable`; `Focus Stage` recreates a destroyed Stage: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:103-116,347-401`.
- Vowel blend estimator and mapping (`VowelEstimate = {s, weightByVowel}`, one-time strength bias, `mouth_open=s`): `apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts:51-60,312-328,381-427`; `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:50-76,105-106,171-181,256-270`.

Recorded verification evidence (not reclassified as human/manual proof): Wave13 focused Vitest/typecheck/source guards pass (`waves/wave13/wave13-final-integration-report.md:52-64`); Wave21 Domain A 8 files/35 tests + `tsc` (`waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md:77-87`) and Domain B Control 8 files/35 tests + `tsc` (`waves/wave21/domain-b-dynamics-tune-control-page-report.md:53-63`); Wave22 independent typecheck + 34 focused tests (`reviews/wave22/wave22-final-clean-integration-review.md:10-15`); Wave23 independent typecheck + 38 focused tests and 479/2 full-unit result (`reviews/wave23/wave23-final-clean-integration-review.md:14-27`). Tracked capture evidence at HEAD commit `233db42` is objective-only: `tmp/report.log` Browser Source 57.2 live / 40.1 applied-render / 40.1 rAF, `tmp/chrome-report.log` Browser Source 59.9 live / 56.7 applied-render / 83.7 rAF probe, and `tmp/native-stage.log` Native Stage 60.1 live / 50.4 applied-render; platform/URL provenance is not encoded in the logs.

## Outstanding gates and unknowns

1. Tracked performance captures are present: `tmp/report.log` (Browser Source), `tmp/chrome-report.log` (Browser Source comparison), and `tmp/native-stage.log` (Native Stage), all introduced at commit `233db42`. They provide objective metrics and privacy output, but do not by themselves prove subjective smoothness, exact platform/URL identity, lipsync behavior, or packaged Electron lifecycle; retain those as human gates.
2. Wave21 has no final integration report; its parent gate remains Domain C pending even though final review lanes exist.
3. Wave22/23 report/review `_map.md` files are absent; add index artifacts or explicitly document why parent maps are the sole index.
4. Wave18 smoothness and Wave19 OBS/Chrome closure are partially conflicting map claims. The repository contains tracked objective captures (`tmp/report.log`, `tmp/native-stage.log`, `tmp/chrome-report.log`, all in commit `233db42`), but no platform/URL provenance or subjective smoothness record is embedded; maps should link the logs and keep the remaining human interpretation explicit.
5. Wave23’s two full-unit browser-source failures are classified as pre-existing in the review; maintain that classification until a current baseline rerun or linked issue proves it.
6. All 11 plan headers still say `Status: Ready to launch` (`player-wave13-plan.md:7` … `player-wave23-plan.md:7`). Treat these as historical planning headers; do not use them as current status over the implementation maps. If plans are intended as living records, update them in a separately authorized docs pass.

## Recommendation to parent maps

Keep the deterministic verdict **pass** for Waves 13–20, 22, and 23; keep Wave21 at **Domain A/B pass; Domain C pending**. Mark the parent maps `Partially stale` until Wave16 status, Wave19 external-evidence wording, Wave22/23 index entries, and Wave21 review indexing are reconciled. Preserve the explicit human gates (real Runtime Export + iFacialMocap + OBS/Electron), and do not infer their completion from source tests or clean reviews.
