# Runtime Player Wave10 Final Integration Report: Broadcast Performance Foundation

## Verdict

pass

## Loop Count

3

## Scope

Domain B final integration and documentation alignment for `discussion/runtime-player/implementation/orchestration/player-wave10-plan.md` section 6.

Required alignment sentence:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

This pass updated Runtime Player discussion docs/maps to match the Wave10 Domain A implementation facts. It did not edit source/test files.

## Basis

- Domain A verdict: pass.
- Domain A loop count: 1.
- Domain A report: [runtime-player-wave10-domain-a-broadcast-performance-foundation-report.md](runtime-player-wave10-domain-a-broadcast-performance-foundation-report.md)
- Domain A review: [../../reviews/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-review.md](../../reviews/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-review.md)
- Wave10 plan: [../../orchestration/player-wave10-plan.md](../../orchestration/player-wave10-plan.md)
- Wave planning convention: [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Final Integration Checks

| Check | Result | Evidence |
|---|---|---|
| Browser Source remains the primary broadcast path | pass | Docs/maps now state Browser Source remains the fixed primary broadcast path after Wave10. |
| Native Stage Window remains usable as local preview/fallback when no Browser Source client is connected | pass | Docs/maps retain `Local Preview / Fallback` and record native preview resume after the zero-client grace period. |
| Local Stage live render suspension scope is narrow | pass | Domain A review confirms only native Stage local live rendering is suspended; Browser Source rendering, input processing, mapping, body follow, dynamics, Runtime Export state, and Stage transform sync remain active. |
| Control status is understandable and sampled diagnostics cannot hide important transitions | pass | Domain A tests/review cover sampled live-frame/repeated renderer diagnostics and immediate server/client/export/render transitions; docs now record the distinction. |
| Browser Source resync de-duplication does not break reload/reconnect | pass at source/test level | Domain A tests/review cover identical Runtime Export de-duplication and replacement payload application. Manual OBS refresh/reconnect remains on the user checklist. |
| No raw tracking/debug data crosses into Browser Source | pass | Existing Wave9 data boundary remains preserved; Wave10 docs explicitly state no raw tracking/debug/calibration/private-path data was added to Browser Source. |
| Implementation facts are reflected in docs/maps | pass | Updated Browser Source, broadcast path, Stage setup, backlog, root map, implementation map, orchestration map, and Wave10 maps. |

## Files Changed

- `discussion/runtime-player/screens/browser-source-output-probe-v0.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/research/_map.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave10/_map.md`
- `discussion/runtime-player/implementation/reviews/wave10/_map.md`
- `discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`

No source files were edited in this Domain B pass.

## Review Loop 2 Fix

Review-Sylph loop 1 returned `needs_changes` because:

- `discussion/runtime-player/screens/_map.md` still used Wave9-only Browser Source wording and did not include Wave10 suspension/sampling/resync facts.
- `discussion/runtime-player/research/_map.md` still described Browser Source as a primary candidate rather than the Wave10 fixed primary broadcast path with manual product-confidence checks pending.

Loop 2 fixed both maps and updated this final integration report. The final review report remains owned by Review-Sylph and was not edited in this pass.

## Closeout Loop 3 Map Status

Review-Sylph loop 2 returned `pass`.

Loop 3 updated durable completion maps that still carried pending-review status:

- `discussion/runtime-player/implementation/reviews/wave10/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave10/_map.md`

The final review report remains owned by Review-Sylph and was not edited in this closeout pass.

## Preserved Domain A Test Evidence

Domain A report/review recorded:

- Focused Vitest: pass, 6 files / 22 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 64 files / 261 tests.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/runtime-player/src`: pass, LF-to-CRLF working-copy warnings only.
- `pnpm install` was not run.

## Commands Run In This Pass

- `git status --short -uall`: observed pre-existing Domain A runtime-player source/test changes and documentation changes; Domain B did not edit source files.
- `rg --files discussion/runtime-player/implementation/waves/wave10 discussion/runtime-player/implementation/reviews/wave10`: confirmed Wave10 report/review directories initially had Domain A report/review only.
- `Get-Content -Encoding UTF8 ...`: read all required basis docs before editing.
- `rg -n ... discussion/runtime-player/...`: inspected Browser Source/manual OBS/local preview/resync references for targeted docs alignment.
- `git diff --stat -- discussion/runtime-player`: reviewed tracked discussion diff summary. New untracked Wave10 files are visible in `git status`.
- `git status --short -uall discussion/runtime-player`: confirmed changed docs/maps and untracked Wave10 plan/report/review artifacts.
- Whitespace/conflict-marker `rg` check on new Wave10 final report/map files: no matches.
- `git diff --check -- discussion/runtime-player`: pass, LF-to-CRLF working-copy warnings only.

Loop 2 fix pass:

- `Get-Content -Encoding UTF8 discussion/runtime-player/screens/_map.md`: confirmed stale Wave9-only map wording before editing.
- `Get-Content -Encoding UTF8 discussion/runtime-player/research/_map.md`: confirmed stale primary-candidate research map wording before editing.
- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`: confirmed loop count/files/commands needed update.
- `git status --short -uall discussion/runtime-player`: confirmed existing docs changes and Review-Sylph-owned final review artifact; source files were not touched.
- Targeted stale wording `rg` on `screens/_map.md` and `research/_map.md`: after the fix, no stale `primary candidate` / Wave9-only current-decision phrasing remains.
- Wave10 fact `rg` on `screens/_map.md` and `research/_map.md`: confirmed fixed primary path, native local preview suspension scope, diagnostic sampling, resync de-duplication, and post-Wave10 manual checklist wording.
- Whitespace/conflict-marker `rg` check on the two map files plus Wave10 final report/map: no matches.
- `git diff --check -- discussion/runtime-player`: pass, LF-to-CRLF working-copy warnings only.

Loop 3 closeout pass:

- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/reviews/wave10/_map.md`: confirmed stale review-completion status before editing.
- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/_map.md`: confirmed stale Wave10 pending review and review-next-action wording before editing.
- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/orchestration/_map.md`: confirmed stale Wave10 review-completion status before editing.
- `Get-Content -Encoding UTF8 discussion/runtime-player/implementation/waves/wave10/runtime-player-wave10-final-integration-report.md`: confirmed loop count and closeout status needed update.
- Targeted review-completion `rg` under `discussion/runtime-player/implementation`: after the fix, no stale Wave10 incomplete-review wording remains.
- Whitespace/conflict-marker `rg` check on touched closeout files: no matches.
- `git diff --check -- discussion/runtime-player`: pass, LF-to-CRLF working-copy warnings only.

`pnpm install` was not run.

## Manual User Verification Checklist

- Add OBS Browser Source and paste the Runtime Player Browser Source URL.
- Confirm transparent alpha and no black/white fill in OBS.
- Confirm WebGL2/model rendering with the real Runtime Export.
- Confirm Control shows connected client, heartbeat, render/WebGL2 status, and local preview suspension while OBS Browser Source is connected.
- Confirm real iFacialMocap face/head motion remains smooth in Browser Source.
- Confirm body follow and dynamics remain visible in Browser Source while native local preview live rendering is suspended.
- Confirm Stage size/pan/zoom match the Player Stage settings.
- Hide/show the OBS scene and manually refresh Browser Source; confirm reconnect/resync still works.
- Disconnect/close OBS Browser Source and confirm native Stage local preview resumes after the grace period.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
- Confirm OBS audio meter does not receive unintended audio.

## Residual Risks / User Decision Points

- Manual OBS Browser Source verification remains required for alpha preservation, CEF/WebGL2 behavior, live iFacialMocap smoothness, body follow/dynamics, Stage transform sync, refresh/reconnect lifecycle, native preview resume, and perceived CPU/GPU improvement.
- Control does not expose a separate resume-grace pending state; it derives the local preview status from connected Browser Source client count.
- Runtime Export de-duplication uses available identity/metadata fields rather than a full payload hash.
- If manual OBS Browser Source performance remains unacceptable after Wave10, decide between a narrow Browser Source follow-up and Spout2 feasibility.

## Source Change Decision

No source changes were needed for Domain B. No files under `apps/runtime-player/**` were edited in this pass.
