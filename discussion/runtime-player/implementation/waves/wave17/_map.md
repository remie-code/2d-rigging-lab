# Runtime Player Wave17 Reports Map

> Runtime Player Wave17 compiled render frame fast path reports and integration evidence.

## Files

| Path | Status | Content |
|---|---|---|
| [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md) | Pass | Domain A runtime-core render frame API shell report, public snapshot compatibility, focused tests, and three-lane review evidence |
| [domain-b-runtime-core-fast-output-internals-report.md](domain-b-runtime-core-fast-output-internals-report.md) | Pass | Domain B runtime-core fast output internals report, public snapshot/drawable DTO bypass, focused tests, and three-lane review evidence |
| [domain-c-runtime-player-fast-render-path-report.md](domain-c-runtime-player-fast-render-path-report.md) | Pass | Domain C Runtime Player live Stage / Browser Source fast render-frame path connection report, focused Runtime Player tests, and three-lane review evidence |
| [domain-d-fast-path-diagnostics-report.md](domain-d-fast-path-diagnostics-report.md) | Pass | Domain D Performance Diagnostics report semantics, fast-path proof counters, snapshot/public-path wording, focused tests, and three-lane review evidence |
| [wave17-final-integration-report.md](wave17-final-integration-report.md) | Pass | Domain E final integration docs/maps alignment, final checks, final review evidence, manual OBS Browser Source Performance Diagnostics instructions, and residual risks |

## Current State

- Domain A implementation and three independent review lanes are complete with `pass`.
- Domain B implementation and three independent review lanes are complete with `pass`.
- Domain C implementation and three independent review lanes are complete with `pass`.
- Domain D implementation and three independent review lanes are complete with `pass`.
- Domain E final integration documentation is complete with `pass` recommendation, and the three final Review-Sylph lanes are complete with `pass` under [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md).
- Runtime-core exposes additive `RuntimeModelInstance#evaluateRenderFrame(...)` and renderer-facing render frame result types.
- Runtime-core render-frame evaluation now uses narrow internal drawable evaluation and avoids public snapshot DTO and public drawable DTO materialization for the renderer path.
- Runtime Player evaluated Stage render input now defaults to the render-frame path and combines dynamic render-frame output with cached scaffold/static render templates.
- Runtime Player keeps explicit snapshot-mode evaluation for initial/static diagnostic use where public snapshot diagnostics are still needed.
- Performance Diagnostics now surfaces `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, and `runtimeCoreRenderFrameOutputDurationMs`.
- Copied reports now scope render-frame fast-path metrics separately from public snapshot path metrics and print the renderer input mapping duration as `renderInputDrawableMappingDurationMs`.
- Existing `RuntimeModelInstance#evaluateFrame(...)` and `evaluateRuntimeFrame(...)` remain compatible.
- Public snapshot DTO shape and previous public snapshot freshness behavior remain preserved.
- Runtime Export format, package-format schema, Editor source/export regeneration, dependencies, lockfile, and `pnpm install` remain out of scope/unchanged for Wave17.
- Real OBS Browser Source performance improvement remains manually unverified until the user captures a real-model Browser Source deep Performance Diagnostics report and saves it as `tmp/report.log`.

## Related Review Map

- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)
