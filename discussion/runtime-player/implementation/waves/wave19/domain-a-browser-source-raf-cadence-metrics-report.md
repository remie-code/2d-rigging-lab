# Runtime Player Wave19 Domain A Report: Browser Source RAF Cadence Metrics

- Verdict: pass
- Domain: Domain A / Browser Source RAF Cadence Metrics
- Orchestrator: Orch-Sylph
- Implementation agent: Gnome
- Review lanes: Review-Sylph spec compliance, design/development compliance, test adequacy
- Loop count: 1 implementation/review loop, 0 fix loops

## Scope

Domain A added lightweight Browser Source cadence diagnostics so copied Performance Diagnostics reports can distinguish OBS / CEF rAF half-rate from renderer or scheduler backlog.

Orch-Sylph did not implement source changes directly. Source implementation was delegated to Gnome, and review was delegated to separate Review-Sylph contexts.

Basis:

- [../../orchestration/player-wave19-plan.md](../../orchestration/player-wave19-plan.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../wave18/wave18-final-integration-report.md](../wave18/wave18-final-integration-report.md)
- [../../reviews/wave18/_map.md](../../reviews/wave18/_map.md)

## Implementation Summary

Gnome implemented:

- Browser Source independent rAF probe metrics using scalar counters and last-delta values, separate from live frame arrival and renderer scheduled renders.
- Optional sanitized render metric fields:
  - `browserRafProbeFrameCount`
  - `lastBrowserRafProbeDeltaMs`
  - `browserRafProbeDeltaSampleCount`
- Main-process diagnostics validation for the new optional fields.
- Copied Performance Diagnostics report output for:
  - `browserRafProbeFps`
  - `browserRafProbeDeltaMs`
  - `scheduledRafDeltaMs`
  - `renderDurationMs`
  - `scheduledFrameDurationMs`
  - `liveFramesPerAppliedFrame`
  - `coalescedLiveFramesPerAppliedFrame`
- Unknown/missing-value formatting for new cadence metrics.
- Focused tests for Browser Source client rAF probing, metrics validation, sanitized diagnostics payloads, report formatting, and existing frame-pacing behavior.

Existing lightweight metrics remain present:

- `inputReceiveFpsLatest`
- `liveFrameMessageFps`
- `appliedLiveFrameFps`
- `renderFps`
- `coalescedLiveFrameCount`
- fast-path proof counters including compiled evaluator/render frame, transient, public snapshot materialization, scaffold cache, and runtime model instance cache counters.

## Files Changed

Source and tests:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Review artifacts:

- [../../reviews/wave19/domain-a-spec-compliance-review.md](../../reviews/wave19/domain-a-spec-compliance-review.md)
- [../../reviews/wave19/domain-a-design-development-compliance-review.md](../../reviews/wave19/domain-a-design-development-compliance-review.md)
- [../../reviews/wave19/domain-a-test-adequacy-review.md](../../reviews/wave19/domain-a-test-adequacy-review.md)

Domain report artifacts:

- [domain-a-browser-source-raf-cadence-metrics-report.md](domain-a-browser-source-raf-cadence-metrics-report.md)
- [_map.md](_map.md)
- [../../reviews/wave19/_map.md](../../reviews/wave19/_map.md)

Pre-existing Wave19 planning/map working tree changes were present before Domain A execution and were not reverted.

## Verification

Gnome verification:

- Focused Vitest: 5 files / 77 tests passed.
- `pnpm.cmd typecheck`: passed.
- `git diff --check`: no whitespace errors; CRLF working-copy warnings only.
- Initial sandbox Vitest attempt failed with `spawn EPERM`; the command was rerun with approved escalation and passed.

Review-Sylph verification:

- Spec compliance review: pass. No tests rerun by that reviewer.
- Design/development review: pass. Focused Vitest rerun passed, 4 files / 65 tests; `pnpm.cmd typecheck` passed.
- Test adequacy review: pass. Focused Vitest rerun passed, 5 files / 77 tests; `pnpm.cmd typecheck` passed; `git diff --check` for target source/test files had no whitespace errors, CRLF warnings only.

No `pnpm install` was run.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-a-spec-compliance-review.md](../../reviews/wave19/domain-a-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-a-design-development-compliance-review.md](../../reviews/wave19/domain-a-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-a-test-adequacy-review.md](../../reviews/wave19/domain-a-test-adequacy-review.md) | pass |

No review lane required a fix loop.

## Acceptance Criteria Covered

- Performance Diagnostics can identify whether Browser Source half-rate behavior is caused by Browser Source rAF cadence or render/scheduler backlog.
- Browser Source copied report includes lightweight rAF cadence metrics.
- Browser Source copied report includes render/coalescing metrics needed to interpret one-frame-for-two-input behavior.
- Missing metrics are handled gracefully.
- Existing Native Stage / Browser Source render behavior is preserved.
- Runtime Player does not restore deep runtime-core profiling as a product path.
- Browser Source diagnostics remain sanitized and do not expose raw tracking, tokens, private paths, Runtime Export payloads, textures, or mesh data.
- Focused tests and typecheck pass.

## Forbidden Scope Confirmation

- Runtime Export format was not changed.
- Editor was not changed.
- package-format schema was not changed.
- Dependencies and lockfile were not changed.
- `pnpm install` was not run.
- Runtime-core deep product profiling was not reintroduced.
- Raw tracking/debug/calibration data, Browser Source tokens, private paths, full Runtime Export payload, textures, and mesh data were not exposed.
- Browser Source visual output and scheduler semantics were not intentionally changed.
- Wave10 native local preview suspension, Wave11 Stage Motion, Wave12 Variant switching, Wave17 render-frame fast path, and Wave18 lightweight diagnostics posture remain in scope and reviewers found no regression evidence.

## Remaining Issues / Manual Checks

Real OBS / CEF behavior still needs manual confirmation with the product path:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Set OBS video FPS and Browser Source custom FPS to 60.
- Run Performance Diagnostics for Browser Source or Both.
- Save copied report to `tmp/report.log`.
- Compare:
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

Residual interpretation note: p50 / p95 / max duration summaries are lightweight diagnostics snapshot summaries, not raw full-trace profiling. That is intentional for Wave19.
