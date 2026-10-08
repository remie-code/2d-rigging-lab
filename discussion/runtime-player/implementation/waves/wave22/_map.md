# Runtime Player Wave22 Reports Map

> Wave22 mouth-open vowel coupling evidence index.

## Files

| Path | Status | Content |
|---|---|---|
| [wave22-domain-a-mouth-open-vowel-coupling-report.md](wave22-domain-a-mouth-open-vowel-coupling-report.md) | Pass | Domain A `param_mouth_open` winner-vowel intensity coupling, jawOpen fallback, six focused tests, and three-lane review pass |
| [wave22-final-integration-report.md](wave22-final-integration-report.md) | Pass (clean integration review) | Final integration and docs/maps alignment; focused live-mapping verification and residual real-device gate |

## Current State

- Domain A and final integration are pass at the source/test/review level.
- With vowel lipsync enabled and supported, `param_mouth_open` follows the winning vowel intensity; disabled or unsupported paths retain jawOpen normalization.
- The focused final verification covers 4 files / 34 tests and typecheck exit 0; no editor or package changes are part of this wave.
- The first increment intentionally excludes temporal smoothing, jawOpen seasoning, and curve shaping.

## Human / Product Gate

- Real iFacialMocap plus a real vowel-rigged model remains pending for closed-vowel over-closing, transition discontinuity, and whether unsmoothed `w` steps are perceptually acceptable. This gate is separate from the implementation pass.

## Related Review Map

- [../../reviews/wave22/_map.md](../../reviews/wave22/_map.md)
