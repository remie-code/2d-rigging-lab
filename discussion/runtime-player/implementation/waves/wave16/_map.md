# Runtime Player Wave16 Reports Map

> Runtime Player Wave16 Runtime Core Compiled Evaluator v0 reports and integration evidence.

## Files

| Path | Status | Content |
|---|---|---|
| [domain-a-runtime-core-compiled-api-shell-report.md](domain-a-runtime-core-compiled-api-shell-report.md) | Pass | Domain A runtime-core compiled evaluator API shell report, compatible legacy API behavior, and focused tests |
| [domain-b-compiled-snapshot-static-templates-report.md](domain-b-compiled-snapshot-static-templates-report.md) | Pass | Domain B compiled snapshot/static templates report, snapshot compatibility, fresh output arrays, and profiling interpretation |
| [domain-c-compiled-rig-deformer-topology-report.md](domain-c-compiled-rig-deformer-topology-report.md) | Pass | Domain C compiled rig/deformer topology report, nested deformer compatibility, and profiling interpretation |
| [domain-d-runtime-player-compiled-evaluator-connection-report.md](domain-d-runtime-player-compiled-evaluator-connection-report.md) | Pass | Domain D Runtime Player compiled evaluator connection report, target-local instances, Browser Source continuity, and focused tests |
| [wave16-final-integration-report.md](wave16-final-integration-report.md) | Pass recommendation / pending final clean review | Domain E final integration, docs/maps alignment, performance interpretation, manual Browser Source diagnostics checklist, and residual risks |
| [wave16-followup-compiled-evaluator-proof-diagnostics-report.md](wave16-followup-compiled-evaluator-proof-diagnostics-report.md) | In progress | Follow-up diagnostics report for compiled evaluator proof counters, target-local runtime instance cache counters, and copied report cold-path compile metric |

## Current State

- Domains A-D implementation reports and clean reviews are complete with `pass`.
- Domain E recommends `pass`, pending separate final clean Review-Sylph review.
- Runtime-core exposes first-class `compileRuntimeModel(graph)` / `CompiledRuntimeModel` / target-local `RuntimeModelInstance`.
- Runtime Player stores the immutable compiled model in the Runtime Export scaffold and gives each renderer target its own mutable runtime instance cache.
- Existing snapshot DTO shape is preserved, and previous public snapshots/nested arrays are protected from later frame mutation.
- Browser Source reconnect with identical deduplicated payload preserves the current renderer target instance, matching prior live-state continuity.
- `runtimeModelCompileDurationMs` is now copied as a scaffold-build/cold-path latest metric, not as a per-frame runtime-core phase.
- Real OBS Browser Source performance improvement still requires a user-run deep Performance Diagnostics capture saved to `tmp/report.log`.

## Related Review Map

- [../../reviews/wave16/_map.md](../../reviews/wave16/_map.md)
- Final clean integration review is reserved for Review-Sylph at `discussion/runtime-player/implementation/reviews/wave16/wave16-final-clean-integration-review.md`.
