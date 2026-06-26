# Runtime Player Wave19 Review Map

> Review artifacts for Runtime Player Wave19.

## Files

| Path | Status | Content |
|---|---|---|
| [domain-a-spec-compliance-review.md](domain-a-spec-compliance-review.md) | Pass | Spec compliance review for Domain A Browser Source rAF cadence metrics |
| [domain-a-design-development-compliance-review.md](domain-a-design-development-compliance-review.md) | Pass | Design/development compliance review for Domain A rAF probe, diagnostics boundaries, and report semantics |
| [domain-a-test-adequacy-review.md](domain-a-test-adequacy-review.md) | Pass | Test adequacy review for Domain A diagnostics, report, sanitizer, and renderer metrics coverage |
| [wave19-final-spec-completion-review.md](wave19-final-spec-completion-review.md) | Pass | Final spec/completion review for Wave19 final integration and documentation alignment |
| [wave19-final-design-development-review.md](wave19-final-design-development-review.md) | Pass | Final design/development review for Wave19 rAF cadence diagnostics and final closeout |
| [wave19-final-test-docs-review.md](wave19-final-test-docs-review.md) | Pass | Final test/docs review for Wave19 verification evidence, docs/maps, and manual OBS checklist |

## Current State

- Domain A spec compliance verdict is `pass`.
- Domain A design/development compliance verdict is `pass`.
- Domain A test adequacy verdict is `pass`.
- Wave19 final spec/completion verdict is `pass`.
- Wave19 final design/development verdict is `pass`.
- Wave19 final test/docs verdict is `pass`.
- Domain A report: [../../waves/wave19/domain-a-browser-source-raf-cadence-metrics-report.md](../../waves/wave19/domain-a-browser-source-raf-cadence-metrics-report.md)
- Final integration report: [../../waves/wave19/wave19-final-integration-report.md](../../waves/wave19/wave19-final-integration-report.md)
- No review lane reported blocking findings.
- Domain B final integration/docs alignment and final reviews are complete with `pass`.
- Domain B final integration applied this policy: `実装事実に合わせて関連ドキュメントを更新する。`
- Manual real OBS / CEF Browser Source cadence capture remains pending.

## Manual Review Focus

- Confirm copied Browser Source reports include lightweight rAF cadence, render duration, scheduled frame duration, live/apply/render FPS, and coalescing interpretation fields without exposing raw tracking/debug/calibration data, Browser Source tokens, private paths, Runtime Export payloads, textures, or mesh data.
- Confirm latest-wins coalescing remains intentional and no Runtime Export, Editor, package-format schema, dependency, or lockfile changes were introduced by Wave19.
- For the remaining manual check, open Runtime Player with a real Runtime Export, connect iFacialMocap, connect OBS Browser Source, set OBS video FPS and Browser Source custom FPS to 60, run Browser Source Performance Diagnostics, save the copied report to `tmp/report.log`, and compare Browser Source rAF probe FPS, Browser Source rAF delta p50/p95/max, render duration p50/p95/max, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `coalescedLiveFrameCount`, and sequence/counter gap evidence if present.
