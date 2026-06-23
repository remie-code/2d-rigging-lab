# Runtime Player Wave11 Report Map

> Stage Motion / Head Position Follow implementation reports.

## Files

| Path | Status | Content |
|---|---|---|
| [runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md](runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md) | Pass | Explicit near/far Input Profile calibration, readiness split, missing-only recovery, depth normalization helper, and focused tests |
| [runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md](runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md) | Pass | Main-owned Stage Motion math/runtime, Window State persistence, sanitized Browser Source composed transform, native preview override, and Wave10 suspension preservation |
| [runtime-player-wave11-domain-c-stage-motion-ui-report.md](runtime-player-wave11-domain-c-stage-motion-ui-report.md) | Pass | Compact Stage page Stage Motion panel, live settings updates, auto-save status, missing near/far recovery route, and no mapping/editor controls |
| [runtime-player-wave11-final-integration-report.md](runtime-player-wave11-final-integration-report.md) | Pass; pending clean review | Domain D documentation alignment, preserved A/B/C evidence, final integration check trace, manual verification checklist, and residual risks |

## Implementation Facts

- Input Profile supports explicit `head-position-left-right` and `head-position-near-far` readiness.
- Existing profiles without near/far still load and can recover through missing-only or near/far section calibration.
- Stage Motion belongs to the Stage page, not Mapping.
- Stage Motion settings auto-save through Window State / local display settings.
- Manual Stage pan/zoom remains the saved base transform.
- Live horizontal offset and depth scale are transient and not saved.
- Browser Source receives only the sanitized composed Stage transform for Stage Motion.
- Browser Source receives no raw tracking frame, raw head position, calibration internals, or debug diagnostics.
- Wave10 native local preview live rendering suspension remains effective while Browser Source continues Stage Motion.

## Remaining Manual Verification

- Near/far calibration with real iFacialMocap input.
- Stage Motion left/right and near/far scale direction and tuning.
- Browser Source parity with native local preview when active.
- Browser Source Stage Motion while native local preview live rendering is suspended.
- Persistence after Runtime Player restart.
- Wave10 suspension/resume/performance product-confidence checks.
