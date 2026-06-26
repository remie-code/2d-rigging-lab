# Runtime Player Wave19 Final Integration Report

- Verdict: pass
- Domain: Domain B / final integration, docs alignment, and clean review
- Orchestrator: Orch-Sylph
- Documentation implementation agent: Gnome
- Review lanes: Review-Sylph final spec/completion, final design/development, final test/docs
- Loop count: 1 docs-alignment/review loop, 1 post-report map closeout pass, 0 fix loops
- Date: 2026-06-26

## Scope

Runtime Player Wave19 closes with lightweight Browser Source rAF cadence diagnostics documented and reviewed.

Final integration scope included:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

Orch-Sylph did not implement source changes directly. Domain A source implementation was delegated to Gnome and passed three Review-Sylph lanes. Domain B documentation/map alignment was delegated to Gnome, then reviewed by three separate Review-Sylph lanes.

## Basis

- [../../orchestration/player-wave19-plan.md](../../orchestration/player-wave19-plan.md)
- [domain-a-browser-source-raf-cadence-metrics-report.md](domain-a-browser-source-raf-cadence-metrics-report.md)
- [../../reviews/wave19/domain-a-spec-compliance-review.md](../../reviews/wave19/domain-a-spec-compliance-review.md)
- [../../reviews/wave19/domain-a-design-development-compliance-review.md](../../reviews/wave19/domain-a-design-development-compliance-review.md)
- [../../reviews/wave19/domain-a-test-adequacy-review.md](../../reviews/wave19/domain-a-test-adequacy-review.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../_map.md](../../_map.md)
- [../../orchestration/_map.md](../../orchestration/_map.md)

## Integration Summary

Domain A added lightweight Browser Source cadence diagnostics to copied Performance Diagnostics reports:

- `browserRafProbeFps`
- `browserRafProbeDeltaMs`
- `scheduledRafDeltaMs`
- `renderDurationMs`
- `scheduledFrameDurationMs`
- `liveFrameMessageFps`
- `appliedLiveFrameFps`
- `renderFps`
- `coalescedLiveFrameCount`
- `liveFramesPerAppliedFrame`
- `coalescedLiveFramesPerAppliedFrame`

Domain B aligned documentation and maps so future agents can interpret those fields:

- `browserRafProbeFps` near 30 with short render duration points to OBS / CEF Browser Source rAF half-rate.
- `browserRafProbeFps` near 60 while apply/render stays near 30 points to render/scheduler backlog or pending-render gating.
- `renderDurationMs` p95 above about 16ms means Browser Source cannot reliably keep 60fps on that path.
- Coalesced count near live messages minus applied frames, or live/coalesced-per-applied ratios near the observed live-to-applied ratio, supports intentional latest-wins coalescing.

The diagnostics remain coarse sampled/counter summaries. They are not raw rAF traces, raw live-frame dumps, or runtime-core deep profiling.

## Files Changed

Domain A source/test files:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Domain B docs/maps/reports:

- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave19/_map.md`
- `discussion/runtime-player/implementation/reviews/wave19/_map.md`
- `discussion/runtime-player/implementation/waves/wave19/wave19-final-integration-report.md`
- `discussion/runtime-player/implementation/reviews/wave19/wave19-final-spec-completion-review.md`
- `discussion/runtime-player/implementation/reviews/wave19/wave19-final-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave19/wave19-final-test-docs-review.md`

Existing Wave19 plan, Domain A report, Domain A reviews, and Wave19 maps were already present in the working tree before Domain B closeout and were not reverted.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Final spec / completion | [wave19-final-spec-completion-review.md](../../reviews/wave19/wave19-final-spec-completion-review.md) | pass |
| Final design / development | [wave19-final-design-development-review.md](../../reviews/wave19/wave19-final-design-development-review.md) | pass |
| Final test / docs | [wave19-final-test-docs-review.md](../../reviews/wave19/wave19-final-test-docs-review.md) | pass |

No review lane required a fix loop.

## Verification

Reused Domain A verification evidence:

- Focused Vitest: 5 files / 77 tests passed.
- `pnpm.cmd typecheck`: passed.
- Domain A spec compliance review: pass.
- Domain A design/development review: pass.
- Domain A test adequacy review: pass.

Domain B verification:

- Gnome docs/maps alignment check: `git diff --check -- discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md discussion/runtime-player/implementation/waves/wave19/_map.md discussion/runtime-player/implementation/reviews/wave19/_map.md` passed with LF/CRLF working-copy warnings only.
- Orch-Sylph repeated the focused docs/maps `git diff --check`; no whitespace errors, LF/CRLF warnings only.
- Orch-Sylph checked required field names and manual-check wording with `rg`.
- Review-Sylph final spec/completion: pass; reused Domain A test/typecheck evidence because no Domain B source/type-facing changes were found.
- Review-Sylph final design/development: pass; focused file/diff/rg review, no additional tests required.
- Review-Sylph final test/docs: pass; focused doc/map diff checks, untracked artifact whitespace checks, field-name checks, and forbidden-scope checks.
- Post-report Gnome map closeout updated `performance-diagnostics.md`, implementation maps, Wave19 wave map, and Wave19 review map to final pass status with links to this report and the three final reviews. Its `git diff --check` passed with LF/CRLF warnings only, and stale `Domain B final integration/docs/review closeout pending` wording was removed.
- Orch-Sylph final checks found no stale Wave19 `pending` / `Ready to launch` wording in the closeout docs/maps and confirmed the final report/review links and manual `tmp/report.log` check wording are present.

`pnpm install` was not run. `pnpm.cmd typecheck` was not rerun in Domain B because Domain B touched docs/maps/review artifacts only.

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Performance Diagnostics can identify whether Browser Source half-rate behavior is caused by Browser Source rAF cadence or render/scheduler backlog. | Pass for copied-report capability; real OBS interpretation remains manual-pending. |
| Browser Source copied report includes lightweight rAF cadence metrics. | Pass. |
| Browser Source copied report includes render/coalescing metrics needed to interpret one-frame-for-two-input behavior. | Pass. |
| Missing metrics are handled gracefully. | Pass. |
| Existing Native Stage / Browser Source render behavior is preserved. | Pass by source review and focused tests; final real OBS check remains manual-pending. |
| Runtime Player does not restore deep runtime-core profiling as a product path. | Pass. |
| Browser Source diagnostics remain sanitized and do not expose raw tracking, tokens, private paths, Runtime Export payloads, textures, or mesh data. | Pass. |
| Focused tests and typecheck pass, or failures are classified with concrete evidence. | Pass by Domain A evidence. |
| No `pnpm install` is run by agents. | Pass. |
| No Runtime Export format changes. | Pass. |
| No Editor changes. | Pass. |
| No package-format schema changes. | Pass. |
| No new dependencies or lockfile edits. | Pass. |

## Forbidden-Scope Confirmation

- No Runtime Export format changes were found.
- No Editor changes were found.
- No package-format schema changes were found.
- No dependency or lockfile changes were found.
- No `pnpm install` was run.
- No runtime-core deep product profiling path or transport was restored.
- No raw tracking/debug/calibration data, Browser Source tokens, private paths, full Runtime Export payload, textures, or mesh data were exposed.
- No scheduler rewrite, stale live-frame queueing, or forced Browser Source 60fps behavior was introduced.
- Browser Source latest-wins coalescing remains intentional.

## Remaining Manual Checks

Manual real OBS / CEF Browser Source confirmation remains pending and must not be recorded as passed until executed:

1. Open Runtime Player with the real Runtime Export.
2. Connect iFacialMocap.
3. Connect OBS Browser Source.
4. Set OBS video FPS and Browser Source custom FPS to 60.
5. Run Performance Diagnostics for Browser Source.
6. Save copied report to `tmp/report.log`.
7. Compare:
   - Browser Source rAF probe FPS: `browserRafProbeFps`;
   - rAF delta p50 / p95 / max: `browserRafProbeDeltaMs`;
   - render duration p50 / p95 / max: `renderDurationMs`;
   - scheduled rAF delta p50 / p95 / max: `scheduledRafDeltaMs`;
   - scheduled frame duration p50 / p95 / max: `scheduledFrameDurationMs`;
   - `liveFrameMessageFps`;
   - `appliedLiveFrameFps`;
   - `renderFps`;
   - coalesced frame count: `coalescedLiveFrameCount`;
   - sequence/counter gap if present;
   - `liveFramesPerAppliedFrame` and `coalescedLiveFramesPerAppliedFrame` as current counter-gap evidence when no explicit sequence gap field is present.

Interpretation:

- `browserRafProbeFps` around 30 with short render duration points to OBS / CEF Browser Source rAF half-rate.
- `browserRafProbeFps` around 60 with apply/render around 30 points to render/scheduler backlog or pending-render gating.
- Coalesced count close to live messages minus applied frames, or live/coalesced-per-applied ratios near the observed live-to-applied ratio, supports intentional latest-wins coalescing.
