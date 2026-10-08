# Runtime Player Wave10 Final Integration Review: Broadcast Performance Foundation

## Verdict

pass

## Loop Count

3

## Findings

None.

Loop 1 finding is resolved:

- `discussion/runtime-player/screens/_map.md` now describes Wave10 as the current performance baseline, Browser Source Output as the fixed primary broadcast path, native Stage Window as `Local Preview / Fallback`, native local preview live rendering suspension while Browser Source is connected, sampled diagnostics, Runtime Export resync de-duplication, and the post-Wave10 manual OBS checklist.
- `discussion/runtime-player/research/_map.md` now describes `broadcast-capture-paths.md` as updated through Wave10 source/tests, Browser Source as the fixed primary broadcast path, native Stage Window as local preview/fallback, Wave10 suspension/sampling/resync behavior, and the post-Wave10 manual product-confidence checks.

No source/test behavior findings were found in Loop 1, and Loop 2 did not require reopening that source/test review.

Loop 3 closeout-map status is resolved:

- `discussion/runtime-player/implementation/reviews/wave10/_map.md` now records the final integration review as pass and no longer describes it as pending.
- `discussion/runtime-player/implementation/_map.md` now records Wave10 as completed / final pass, points to the final report and final review, and no longer lists final review as an immediate process next action.
- `discussion/runtime-player/implementation/orchestration/_map.md` now records `player-wave10-plan.md` as completed / final pass.
- `discussion/runtime-player/implementation/waves/wave10/_map.md` now records the final integration report as pass after closeout loop 3.
- The final integration report now has `Loop Count` 3 and records `Closeout Loop 3 Map Status`.

## Scope Reviewed

- Loop 2 docs-map fix:
  - `discussion/runtime-player/screens/_map.md`
  - `discussion/runtime-player/research/_map.md`
- Loop 2 final integration report/map consistency:
  - `discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`
  - `discussion/runtime-player/implementation/waves/wave10/_map.md`
- Loop 3 closeout-map status:
  - `discussion/runtime-player/implementation/reviews/wave10/_map.md`
  - `discussion/runtime-player/implementation/_map.md`
  - `discussion/runtime-player/implementation/orchestration/_map.md`
  - `discussion/runtime-player/implementation/waves/wave10/_map.md`
  - `discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`
- Preserved Loop 1 source/test behavior review:
  - changed Runtime Player source/test files listed in the original assignment.
  - Domain A report/review evidence.
  - changed Domain B docs/maps listed in the original assignment.

## Design / Development Compliance Review

Pass.

The Loop 1 source/test review remains valid:

- Browser Source remains the primary broadcast implementation path. Docs and UI lead with `Browser Source Output`, and native controls remain under `Local Preview / Fallback`.
- Native Stage Window remains usable as local preview/fallback when no Browser Source client is connected.
- Local Stage live render suspension is scoped to native Stage live-frame delivery:
  - `runtime-player-main.ts:125-129` gates Stage Window live-frame delivery with `!localPreviewLiveRenderPolicy.isSuspended()` while still calling `browserSourceServer.publishLiveParameterFrame(frame)`.
  - `live-parameter-bridge-handlers.ts:41-48` keeps the latest live frame while optionally skipping Stage Window delivery.
  - `local-preview-live-render-suspension.ts:55-79` suspends immediately at `connectedClientCount > 0` and resumes only after the zero-client grace period.
- Browser Source rendering and Stage transform sync remain active:
  - `runtime-player-main.ts:70-80` publishes Stage display state from Window State to Browser Source.
  - `browser-source-stage-client.ts:463-473` applies each live frame to the renderer and samples only diagnostics.
  - `static-stage-canvas-renderer.ts:140-164` clears/cancels the native live RAF path while payload/view transform rendering remains available.
- Control status sampling preserves important transitions:
  - `browser-source-session.ts:214-229` samples Control-facing latest live-frame status while broadcasting every live frame.
  - `browser-source-session.ts:403-427` sends renderer diagnostics immediately for important changes and samples repeated unchanged diagnostics.
  - `browser-source-session.ts:470-527` clears pending sampled notifications when an immediate notification is required.
- Browser Source resync de-duplication preserves replacement application:
  - `browser-source-stage-client.ts:411-416` skips identical Runtime Export payload keys.
  - `browser-source-stage-client.ts:448-460` increments apply count only when a payload is actually applied.
  - `browser-source-stage-client.ts:651-667` keys payload identity from schema, package metadata, load timestamp, and texture metadata.
- No raw tracking/debug data crossing into Browser Source was found. Browser Source live-frame parsing sanitizes to `RuntimePlayerLiveParameterFrame.parameterValues`, and existing boundary tests reject raw/debug route exposure.
- Domain B source-edit boundary is respected at the working-tree evidence level: source/test changes remain the Domain A file set already reviewed; Loop 2 changed discussion docs/maps only.

## Test Adequacy / Verification Review

Pass.

Preserved Domain A evidence reviewed in Loop 1:

- Focused Vitest: pass, 6 files / 22 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 64 files / 261 tests.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/runtime-player/src`: pass with LF-to-CRLF warnings only.
- `pnpm install` was not run.

Focused tests inspected in Loop 1 by name and target behavior:

- local preview suspension policy: zero-client active, one-client suspend, grace resume, reconnect during grace.
- live parameter bridge: latest-frame update without native Stage delivery and replay on resume.
- native Stage renderer: pending live-frame RAF cancel and continued payload/view updates.
- Browser Source session: sampled live status, immediate connect/disconnect, immediate render errors.
- Browser Source client: diagnostics sampling without throttling live frame application, Runtime Export de-duplication and replacement.
- Control UI: suspended/active local preview labels, Browser Source primary placement, fallback controls, Copy URL.

I did not rerun Vitest/typecheck/unit suites in Loop 2 because the fix is docs-only and source/test behavior was already reviewed with preserved Domain A evidence.

## Docs / Maps Alignment Review

Pass.

- `screens/_map.md` no longer contains the stale Wave9-only / primary-candidate wording cited in Loop 1.
- `research/_map.md` no longer contains the stale Wave9-only / primary-candidate wording cited in Loop 1.
- Both maps now include the expected Wave10 facts:
  - Browser Source is the fixed primary broadcast path.
  - Native Stage Window remains local preview/fallback.
  - Browser Source client connection suspends only native local preview live rendering.
  - Browser Source rendering, input processing, mapping, body follow, dynamics, Runtime Export state, and Stage transform sync stay active.
  - Control-facing live-frame status and repeated renderer diagnostics are sampled while important server/client/export/render transitions remain immediate.
  - Browser Source Runtime Export resync de-duplicates identical payload application while preserving replacement payload, reload, and reconnect.
  - Manual OBS checks are post-Wave10 product-confidence checks.
- The final integration report now has `Loop Count` 2, includes `screens/_map.md` and `research/_map.md` in `Files Changed`, and records the `Review Loop 2 Fix`.
- `waves/wave10/_map.md` records `Pass after docs-map fix loop 2`.
- Loop 3 closeout maps now reflect completed/final pass status and no longer say final review is pending.
- The final integration report now has `Loop Count` 3 and accurately records `Closeout Loop 3 Map Status`, including the four durable maps updated by Gnome and the fact that the final review report remains Review-Sylph-owned.
- `implementation/_map.md`, `implementation/orchestration/_map.md`, `implementation/waves/wave10/_map.md`, and `implementation/reviews/wave10/_map.md` are consistent with Wave10 being complete at final pass, with manual OBS verification remaining as product-confidence work rather than implementation-review pending work.
- The required final integration sentence remains present in the final report:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

Manual OBS checklist coverage remains complete enough for OBS Browser Source setup, alpha, WebGL2/model rendering, live motion, body follow/dynamics, Stage transform sync, reconnect/resync, local preview resume, performance comparison, and audio.

## Commands Run And Results

- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/screens/_map.md`
  - Result: verified Loop 2 map wording includes Wave10 fixed primary path, suspension, sampling, resync, and post-Wave10 checklist facts.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/research/_map.md`
  - Result: verified Loop 2 research map wording includes Wave10 fixed primary path, suspension, sampling, resync, and post-Wave10 product-confidence checks.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`
  - Result: verified `Loop Count` is 2, `Files Changed` includes the two directory maps, and `Review Loop 2 Fix` records the Loop 1 finding plus Gnome's fix.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/waves/wave10/_map.md`
  - Result: verified Wave10 report map records `Pass after docs-map fix loop 2`.
- `rg -n "primary broadcast candidate|Implemented in Wave9 source/tests|Wave9 primary-path|Wave9のmanual OBS|Direction updated by Wave9|Browser Source-first probe" discussion/runtime-player/screens/_map.md discussion/runtime-player/research/_map.md`
  - Result: no matches; `rg` exit 1.
- `rg -n "fixed primary broadcast path|native local preview live rendering|sample|de-duplicate|post-Wave10 manual OBS|local preview suspension|Stage transform sync" discussion/runtime-player/screens/_map.md discussion/runtime-player/research/_map.md`
  - Result: expected Wave10 fact wording found in both maps.
- `git diff --name-status -- apps/runtime-player/src discussion/runtime-player/screens/_map.md discussion/runtime-player/research/_map.md discussion/runtime-player/implementation/waves/wave10/_map.md discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-final-integration-review.md`
  - Result: source/test changes remain the previously reviewed Domain A set; Loop 2 reviewed tracked docs are `screens/_map.md` and `research/_map.md`; LF-to-CRLF warnings only.
- `git status --short -uall -- apps/runtime-player/src discussion/runtime-player/screens/_map.md discussion/runtime-player/research/_map.md discussion/runtime-player/implementation/waves/wave10/_map.md discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-final-integration-review.md`
  - Result: Domain A source/test files remain modified/untracked as before; Loop 2 docs/reports are under discussion paths; no new unexpected source/test file appeared.
- `git diff --check -- discussion/runtime-player`
  - Result: pass; LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]$|^<<<<<<<|^=======$|^>>>>>>>" discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-final-integration-review.md`
  - Result: no matches; `rg` exit 1.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/reviews/wave10/_map.md`
  - Result: verified final integration review is no longer pending and Wave10 review map status is pass.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/_map.md`
  - Result: verified `player-wave10-plan.md` is completed / final pass, Wave10 final report is pass after closeout loop 3, final review is pass, and next action is manual OBS product-confidence verification rather than final review.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/orchestration/_map.md`
  - Result: verified `player-wave10-plan.md` is completed / final pass and final report/review links point to Wave10 closeout artifacts.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/waves/wave10/_map.md`
  - Result: verified final integration report status is pass after closeout loop 3.
- `Get-Content -Raw -Encoding UTF8 discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`
  - Result: verified `Loop Count` is 3 and `Closeout Loop 3 Map Status` accurately records the closeout-map update.
- Targeted stale closeout-status `rg` under `discussion/runtime-player/implementation`
  - Result: no matches; `rg` exit 1.
- `git diff --name-status -- apps/runtime-player/src discussion/runtime-player/implementation/reviews/wave10/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md discussion/runtime-player/implementation/waves/wave10/_map.md discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-final-integration-review.md`
  - Result: current source/test changes remain the previously reviewed Domain A set; closeout changes are discussion maps/report/review paths; LF-to-CRLF warnings only.
- `git status --short -uall -- apps/runtime-player/src discussion/runtime-player/implementation/reviews/wave10/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md discussion/runtime-player/implementation/waves/wave10/_map.md discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-final-integration-review.md`
  - Result: existing Domain A source/test changes remain present; Loop 3 reviewed changes are discussion closeout files plus this Review-Sylph report; no unexpected source/test file appeared.
- `git diff --check -- discussion/runtime-player`
  - Result: pass; LF-to-CRLF working-copy warnings only.

`pnpm install` was not run.

## Files Reviewed / Report Path

Updated report path:

- `discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-final-integration-review.md`

Files reviewed include the Loop 2 fixed maps, Loop 3 closeout maps/report, the original Wave10 basis/report/review artifacts, and the preserved Loop 1 source/test review evidence.

## Residual Risks And Manual User Verification Checklist

Residual risks:

- Manual OBS Browser Source verification remains required for product confidence.
- Control does not expose a separate resume-grace pending state; the current docs correctly record this as a watch item rather than a blocker.
- Runtime Export de-duplication uses available identity/metadata fields rather than a full payload hash.
- If manual OBS Browser Source performance remains unacceptable, choose between a narrow Browser Source follow-up and Spout2 feasibility.

Manual checklist to preserve:

- Add OBS Browser Source and paste the Runtime Player Browser Source URL.
- Confirm transparent alpha and no black/white fill.
- Confirm WebGL2/model rendering with the real Runtime Export.
- Confirm Control shows connected client, heartbeat, render/WebGL2 status, and local preview suspension.
- Confirm real iFacialMocap face/head motion remains smooth in Browser Source.
- Confirm body follow and dynamics remain visible while native local preview live rendering is suspended.
- Confirm Stage size/pan/zoom match Player Stage settings.
- Hide/show the OBS scene and manually refresh Browser Source; confirm reconnect/resync still works.
- Disconnect/close OBS Browser Source and confirm native Stage local preview resumes after the grace period.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
- Confirm OBS audio meter does not receive unintended audio.
