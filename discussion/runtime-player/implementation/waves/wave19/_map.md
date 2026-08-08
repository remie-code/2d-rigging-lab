# Runtime Player Wave19 Wave Report Map

> Wave report artifacts for Runtime Player Wave19.

## Files

| Path | Status | Content |
|---|---|---|
| [domain-a-browser-source-raf-cadence-metrics-report.md](domain-a-browser-source-raf-cadence-metrics-report.md) | Pass | Domain A Browser Source rAF cadence metrics implementation report |
| [wave19-final-integration-report.md](wave19-final-integration-report.md) | Pass | Wave19 final integration, docs/maps alignment, final review evidence, residual risks, and manual OBS cadence checklist |

## Current State

- Wave19 final integration verdict is `pass`.
- Domain A verdict is `pass`.
- Domain A added lightweight Browser Source rAF cadence diagnostics and copied-report interpretation fields.
- Domain A implementation/review loop count: 1, with 0 fix loops.
- Domain A review lanes all passed:
  - [spec compliance](../../reviews/wave19/domain-a-spec-compliance-review.md)
  - [design / development compliance](../../reviews/wave19/domain-a-design-development-compliance-review.md)
  - [test adequacy](../../reviews/wave19/domain-a-test-adequacy-review.md)
- Domain B final integration/docs/review closeout is complete with `pass`.
- Domain B final integration applied this policy: `実装事実に合わせて関連ドキュメントを更新する。`
- Final Review-Sylph lanes all passed:
  - [final spec / completion](../../reviews/wave19/wave19-final-spec-completion-review.md)
  - [final design / development](../../reviews/wave19/wave19-final-design-development-review.md)
  - [final test / docs](../../reviews/wave19/wave19-final-test-docs-review.md)
- Native Stage and Browser Source normal rendering were not intentionally changed by Domain A. A bounded OBS/Chrome/Edge cadence comparison is now recorded in tracked captures; it is objective evidence only and does not establish subjective smoothness or a universal 60 FPS guarantee.
- Tracked objective captures: [`tmp/report.log`](../../../../../tmp/report.log) (Browser Source `liveFrameMessageFps=57.2`, applied/render/rAF `40.1`), [`tmp/chrome-report.log`](../../../../../tmp/chrome-report.log) (Browser Source `59.9` live / `56.7` applied-render / `83.7` rAF probe), and [`tmp/native-stage.log`](../../../../../tmp/native-stage.log) (Native Stage `60.1` live / `50.4` applied-render). The logs do not encode platform/URL provenance.
- Remaining human gates are real Runtime Export + iFacialMocap behavior, OBS/CEF alpha/WebGL2/model visual parity and subjective smoothness, and packaged/dev Electron lifecycle; these are separate from the Wave19 implementation pass.
- No Runtime Export, Editor, package-format schema, dependency, or lockfile changes were introduced by Wave19.

## Manual Follow-Up (reproduction or residual product confidence)

- Open Runtime Player with a real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Set OBS video FPS and Browser Source custom FPS to 60.
- If a new capture is needed for follow-up discussion, run Browser Source Performance Diagnostics and save the copied report to `tmp/report.log`; the existing tracked logs above remain the current objective evidence.
- Compare Browser Source rAF probe FPS (`browserRafProbeFps`), Browser Source rAF delta p50/p95/max when present, render duration p50/p95/max (`renderDurationMs`), `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `coalescedLiveFrameCount`, and sequence/counter gap evidence if present, including `liveFramesPerAppliedFrame` and `coalescedLiveFramesPerAppliedFrame`.
- Interpret `browserRafProbeFps` near 30 with short render duration as likely OBS / CEF rAF half-rate; interpret `browserRafProbeFps` near 60 with apply/render near 30 as render/scheduler backlog or pending-render gating.
