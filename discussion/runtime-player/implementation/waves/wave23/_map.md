# Runtime Player Wave23 Reports Map

> Wave23 vowel shape-blend evidence index.

## Files

| Path | Status | Content |
|---|---|---|
| [wave23-domain-a-vowel-shape-blend-report.md](wave23-domain-a-vowel-shape-blend-report.md) | Pass | Domain A normalized convex vowel blending, strength-before-normalization, `mouth_open=s`, and three-lane review pass |
| [wave23-final-integration-report.md](wave23-final-integration-report.md) | Pass (clean integration review) | Final integration, optional test/comment improvements, focused verification, pre-existing full-suite caveat, and residual real-device gate |

## Current State

- Domain A and final integration are pass at the source/test/review level; cp17 is removed for the supported vowel-lipsync path.
- Enabled, gate-open output publishes five vowel values as `s × normalized weight` with `mouth_open=s`; gate-closed output publishes finite zero values, while disabled/unsupported paths retain jawOpen fallback.
- Focused verification is typecheck exit 0 and 4 files / 38 tests; the full unit result remains 479 passed / 2 pre-existing browser-source failures, as recorded by the clean review.
- Temporal smoothing, a user τ control, jawOpen seasoning, top-k/dimension surgery, “e” gating, and curve shaping remain out of scope pending real-device observation.

## Human / Product Gate

- Real speech with iFacialMocap and a vowel-rigged model remains pending for transition smoothness, “e” parasitism, and “u” jitter. This gate is separate from the implementation pass and determines whether later smoothing or other follow-up is warranted.

## Related Review Map

- [../../reviews/wave23/_map.md](../../reviews/wave23/_map.md)
