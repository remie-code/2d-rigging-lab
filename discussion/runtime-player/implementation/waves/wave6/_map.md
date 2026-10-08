# Runtime Player Wave6 Wave Reports Map

> Runtime Player Wave6 completion reports for Body Follow v0.

## Status

- Wave: `runtime-player-body-follow-v0`
- Current completed domains:
  - Domain A, `runtime-player-wave6-input-profile-position-calibration`
  - Domain B, `runtime-player-wave6-body-auto-mapping-live-follow`
  - Domain C, `runtime-player-wave6-final-integration-clean-review` docs/report integration portion
- Domain A verdict: pass
- Domain B verdict: pass
- Final integration report verdict: pass for docs/report integration
- Final clean integration review: pass ([../../reviews/wave6/runtime-player-wave6-final-clean-integration-review.md](../../reviews/wave6/runtime-player-wave6-final-clean-integration-review.md))
- Domain A reviews: [../../reviews/wave6/_map.md](../../reviews/wave6/_map.md)
- Domain B reviews: [../../reviews/wave6/_map.md](../../reviews/wave6/_map.md)

## Reports

| Path | Status | Content |
|---|---|---|
| [runtime-player-wave6-domain-a-input-profile-position-calibration-report.md](runtime-player-wave6-domain-a-input-profile-position-calibration-report.md) | Pass | Domain A report for backward-compatible head position calibration, section readiness, missing-only / head-position-only recalibration, Look Forward head position neutral, and focused verification. |
| [runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md](runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md) | Pass | Domain B report for body semantic slots, Body X/Z auto mapping, body follow controls, main-owned smoothing state, sanitized body runtime parameter values, reset hooks, and focused verification. |
| [runtime-player-wave6-final-integration-report.md](runtime-player-wave6-final-integration-report.md) | Pass | Final integration report for Wave6 dependency gate, integrated source/test evidence, docs/maps alignment, final clean integration review pass, and remaining manual verification. |

## Manual Verification Remaining

- Launch Electron Runtime Player and inspect the Input Profile section readiness and missing-only / head-position-only calibration controls.
- Inspect the Mapping page Body group and Body X/Z sliders/toggles in the live Control Window.
- Load a Runtime Export with authored `Body Angle X` / `Body Angle Z` keyforms.
- Connect real iFacialMocap input and verify clean Stage body motion.
- Confirm existing face / eyes / mouth motion still works after body slots are present.
- Confirm Stage remains model-only and shows no setup/debug/raw tracking body UI.
- Tune Body X/Z default strengths and lag with real-device visual evidence if needed.
