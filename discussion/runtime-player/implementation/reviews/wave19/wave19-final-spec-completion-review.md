# Runtime Player Wave19 Final Spec Completion Review

- Verdict: pass
- Review lane: final spec / completion review
- Reviewer: Review-Sylph
- Date: 2026-06-26

## Scope Reviewed

Reviewed Runtime Player Wave19 after Domain A pass, focusing on final integration and documentation alignment for Browser Source rAF cadence diagnostics.

Inspected implementation and tests:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Inspected documentation and maps:

- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave19/_map.md`
- `discussion/runtime-player/implementation/reviews/wave19/_map.md`

This reviewer wrote only this report file.

## Basis Documents Used

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave19-plan.md`
- `discussion/runtime-player/implementation/waves/wave19/domain-a-browser-source-raf-cadence-metrics-report.md`
- `discussion/runtime-player/implementation/reviews/wave19/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave19/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave19/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave19/_map.md`
- `discussion/runtime-player/implementation/reviews/wave19/_map.md`

## Findings

No blocking or non-blocking findings.

Supporting evidence:

- Browser Source rAF probing is independent of live frame arrival and renderer scheduling. It is started on `start()`, cancelled on `stop()`, and stores only scalar counters / latest delta values: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:165`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:676`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:691`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:718`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:739`.
- Copied reports include Browser Source-only `browserRafProbeFps` / `browserRafProbeDeltaMs`, shared `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, and live/coalesced-per-applied ratios: `apps/runtime-player/src/control/performance-diagnostics-report.ts:466`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:469`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:479`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:560`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:576`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:947`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:955`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1019`.
- New diagnostics contract fields are optional numeric aggregate fields only, and main-process validation keeps them finite / non-negative / counter-shaped where required: `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:15`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:84`.
- Tests cover rAF probe reporting without live frames, probe cancellation, validation of optional probe fields, malformed value rejection, copied report fields, missing metric `unknown` output, and privacy exclusions: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:380`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:409`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:31`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:124`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:414`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:601`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:666`.
- Performance Diagnostics documentation states Wave19 metrics are lightweight sampled/counter summaries, not raw rAF traces, raw live frame dumps, or runtime-core deep profiling, and documents latest-wins coalescing as intentional: `discussion/runtime-player/screens/performance-diagnostics.md:134`.
- Documentation avoids overclaiming a forced 60fps Browser Source requirement. It says `browserRafProbeFps` around 30 can indicate OBS / CEF rAF half-rate and explicitly states this is a valid diagnostic result rather than an automatic Runtime Player bug: `discussion/runtime-player/screens/performance-diagnostics.md:151`, `discussion/runtime-player/screens/performance-diagnostics.md:158`.
- The final-integration documentation policy text `実装事実に合わせて関連ドキュメントを更新する。` is present in the Wave19 plan, active planning convention, implementation map, Wave19 wave map, and Wave19 review map: `discussion/runtime-player/implementation/orchestration/player-wave19-plan.md:201`, `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md:10`, `discussion/runtime-player/implementation/_map.md:307`, `discussion/runtime-player/implementation/waves/wave19/_map.md:21`, `discussion/runtime-player/implementation/reviews/wave19/_map.md:21`.

## Acceptance Criteria Status

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Performance Diagnostics can identify whether Browser Source half-rate behavior is caused by Browser Source rAF cadence or render/scheduler backlog. | Pass for product report capability; manual OBS interpretation pending. | Report includes independent `browserRafProbeFps`, rAF delta, render duration, scheduled frame duration, live/apply/render FPS, coalescing count, and live/coalesced-per-applied ratios. |
| Browser Source copied report includes lightweight rAF cadence metrics. | Pass. | `browserRafProbeFps` and `browserRafProbeDeltaMs` are formatted only for Browser Source reports. |
| Browser Source copied report includes render/coalescing metrics needed to interpret one-frame-for-two-input behavior. | Pass. | `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `coalescedLiveFrameCount`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame` are present. |
| Missing metrics are handled gracefully. | Pass. | Report tests assert unknown output for missing rAF/duration/ratio fields. |
| Existing Native Stage / Browser Source render behavior is preserved. | Pass by source review and Domain A verification; final real OBS run remains manual-pending. | The diff adds probe/reporting logic, does not touch renderer scheduler source files, and retains latest-wins coalescing semantics. |
| Runtime Player does not restore deep runtime-core profiling as a product path. | Pass. | No product profiling transport changes found; copied report tests continue to omit deep runtime-core timing names and `deep-runtime-core-profile`. |
| Browser Source diagnostics remain sanitized and do not expose raw tracking, tokens, private paths, Runtime Export payloads, textures, or mesh data. | Pass. | Sanitizer/report tests cover token/private/raw/calibration exclusions; new fields are aggregate numeric fields. |
| Focused tests and typecheck pass, or failures are classified. | Pass by Domain A evidence. | Domain A reviews record focused Vitest passing and `pnpm.cmd typecheck` passing. This final review did not rerun tests because no new source/type-facing changes beyond Domain A were found. |
| No `pnpm install` is run by agents. | Pass for this review; Domain A reports the same. | This reviewer did not run `pnpm install`. |
| No Runtime Export format, Editor, package-format schema, dependency, or lockfile changes. | Pass. | `git diff --name-only` / forbidden-scope checks found no such changes. |

## Verification Performed

Commands run from `C:\workspace\remie\code\ai-native-live2d-editor`:

- `Get-Content -Encoding UTF8 C:\Users\remie\.codex\skills\discussion-management\SKILL.md`
  - Result: read successfully; followed discussion entry point and information-separation rules.
- `Get-Content -Encoding UTF8 discussion/_conventions.md`
  - Result: read successfully.
- `Get-Content -Encoding UTF8 discussion/_map.md`
  - Result: read successfully.
- `git status --short -uall`
  - Result before writing this report: only the Wave19 target Runtime Player source/test files, runtime-player docs/maps, and Wave19 discussion artifacts were modified/untracked.
- `git diff --stat -- <assigned changed implementation/docs>`
  - Result: tracked diff was limited to eight Runtime Player source/test files and three runtime-player docs/maps; no package/lockfile/Editor/package-format paths.
- `Get-Content -Encoding UTF8 <basis documents and Wave19 maps>`
  - Result: all assigned basis documents and maps were read.
- `rg -n "browserRafProbe|scheduledRafDeltaMs|renderDurationMs|scheduledFrameDurationMs|liveFramesPerAppliedFrame|coalescedLiveFramesPerAppliedFrame|latest-wins|60fps|deep profiling|runtime-core deep|Runtime Export|token|private path|raw tracking|requestAnimationFrame|coalescedLiveFrameCount" <assigned files>`
  - Result: found expected implementation, report, test, and documentation references.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core apps/runtime-player/package.json packages/shared/package.json`
  - Result: no output.
- `git diff --name-only`
  - Result: only the eight assigned Runtime Player source/test files and three tracked runtime-player docs/maps were listed.
- `git ls-files --others --exclude-standard`
  - Result: listed Wave19 plan/report/review/map artifacts only before this report was added.
- `git diff --unified=80 -- apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
  - Result: inspected rAF probe lifecycle and bounded metric merge.
- `git diff --unified=80 -- apps/runtime-player/src/control/performance-diagnostics-report.ts`
  - Result: inspected report aggregation, missing-value handling, and copied report formatting.
- `git diff --unified=80 -- apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
  - Result: inspected optional contract fields and validation.
- `git diff --unified=60 -- <assigned test files>`
  - Result: inspected Browser Source client, validation, sanitizer, and report tests.
- `git diff --unified=60 -- discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md`
  - Result: inspected documentation alignment and map status updates.
- `rg -n "実装事実に合わせて関連ドキュメントを更新する" <Wave19 plan/convention/maps>`
  - Result: policy text found in the Wave19 plan, planning convention, implementation map, Wave19 wave map, and Wave19 review map.
- `git diff -G "profil|runtimeCore|runtimeModelCompile|raw tracking|token|privatePath|Runtime Export payload|texture|mesh" -- <assigned source/test files>`
  - Result: no matching source diff output beyond Git LF/CRLF working-copy warnings.
- `rg -n "profiling|deep-runtime-core-profile|runtimeCore.*Duration|runtimeModelCompileDurationMs|rawFrame|raw tracking|calibration|token_fixture|privatePath|Runtime Export payload|Runtime Export textures|Runtime Export mesh" <assigned source/test files>`
  - Result: matches were privacy exclusions and tests asserting omission; no product deep profiling transport restoration found.
- `git diff --check -- <assigned source/test/docs/map files>`
  - Result: no whitespace errors; Git reported LF/CRLF working-copy warnings only.

No `pnpm.cmd typecheck` or Vitest command was run by this final reviewer. Reason: Domain B review found no source/type-facing changes beyond Domain A, and Domain A already recorded focused Vitest and typecheck pass evidence.

## Remaining Manual Checks

Manual real OBS / CEF confirmation remains pending and must not be recorded as passed until executed:

1. Open Runtime Player with a real Runtime Export.
2. Connect iFacialMocap.
3. Connect OBS Browser Source.
4. Set OBS video FPS to 60 and Browser Source custom FPS to 60.
5. Run Browser Source Performance Diagnostics.
6. Save the copied report to `tmp/report.log`.
7. Compare:
   - Browser Source rAF probe FPS: `browserRafProbeFps`;
   - Browser Source rAF delta p50 / p95 / max: `browserRafProbeDeltaMs`;
   - scheduled rAF delta p50 / p95 / max: `scheduledRafDeltaMs`;
   - render duration p50 / p95 / max: `renderDurationMs`;
   - scheduled frame duration p50 / p95 / max: `scheduledFrameDurationMs`;
   - `liveFrameMessageFps`;
   - `appliedLiveFrameFps`;
   - `renderFps`;
   - `coalescedLiveFrameCount`;
   - `liveFramesPerAppliedFrame`;
   - `coalescedLiveFramesPerAppliedFrame`;
   - sequence/counter gap if present in the copied report.

Interpretation remains:

- `browserRafProbeFps` around 30 with short render duration points to OBS / CEF Browser Source rAF half-rate.
- `browserRafProbeFps` around 60 with apply/render around 30 points to render/scheduler backlog or pending-render gating.
- Coalesced count close to live messages minus applied frames, or live/coalesced-per-applied ratios near the observed live-to-applied ratio, supports intentional latest-wins coalescing.

## Forbidden-Scope Confirmation

- No Runtime Export format changes were found.
- No Editor changes were found.
- No package-format schema changes were found.
- No dependency or lockfile changes were found.
- No `pnpm install` was run.
- No runtime-core deep profiling product transport was restored.
- No raw tracking frames, raw head position, calibration internals, Browser Source tokens, private paths, Runtime Export payloads, textures, or mesh data were exposed by the new Wave19 diagnostics fields.
- No forced 60fps Browser Source requirement was introduced.
- No scheduler rewrite or stale live-frame queueing was found; Browser Source latest-wins coalescing remains intentional.
