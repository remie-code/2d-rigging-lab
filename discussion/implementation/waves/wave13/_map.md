# Wave 13 Map

> Wave: `runtime-diff-and-grid2d-evidence-hardening`
> Status: Completed / implementation-proven
> Date: 2026-05-30

## Files

| Path | Role | Status |
|---|---|---|
| [wave13-runtime-diff-contract-and-comparison-semantics-completion.md](wave13-runtime-diff-contract-and-comparison-semantics-completion.md) | Domain A completion report | pass |
| [wave13-diagnostic-policy-alignment-completion.md](wave13-diagnostic-policy-alignment-completion.md) | Inserted diagnostic alignment gate completion report | pass |
| [wave13-keyform-diagnostic-regression-hardening-completion.md](wave13-keyform-diagnostic-regression-hardening-completion.md) | Domain B completion report after alignment | pass |
| [wave13-runtime-evidence-diff-projection-hardening-completion.md](wave13-runtime-evidence-diff-projection-hardening-completion.md) | Domain C completion report | pass |
| [wave13-grid2d-runtime-fixture-and-evidence-completion.md](wave13-grid2d-runtime-fixture-and-evidence-completion.md) | Domain D completion report | pass |
| [wave13-ai-editor-grid2d-evidence-regression-completion.md](wave13-ai-editor-grid2d-evidence-regression-completion.md) | Domain E completion report | pass |
| [integration-review.md](integration-review.md) | Wave-level integration review | pass |
| [wave13-final-report.md](wave13-final-report.md) | Wave 13 final report | pass |

## Summary

Wave 13 hardens the Wave 12 runtime keyform foundation before moving to UI, viewer, transport, or LLM integration work.

Implemented scope:

- Runtime diff keeps `runtime-diff-v1` and adds defaulted dedicated fields for drawable runtime state changes and drawList changes.
- Snapshot comparison now emits dedicated opacity, visibility, draw order, and drawList diff fields while preserving legacy `drawableChanges` and `/drawList` `parameterChanges` compatibility.
- `keyform.grid2dDuplicateKey` is aligned as severity `error`, with strict and acceptance behavior still failing.
- Keyform diagnostic regressions cover duplicate keys/coordinates, missing parameter, unsupported evaluator, unsupported patch shape, Grid2D clamp, and missing surrounding key behavior.
- Runtime evidence artifact tests prove enriched runtime diff projection.
- A compact `runtime-grid2d-keyform-evidence` fixture records Grid2D samples, runtime-visible drawable change, and enriched runtime diff output.
- AI/editor regression proves `addKeyformGrid2d` dry-run, approval, commit, operation log, transcript, and persisted runtime-visible evidence.

Out of scope remains editor UI expansion, private viewer implementation, external HTTP/WebSocket/MCP transport, LLM provider integration, Cubism compatibility, and `rigControl` keyform target application.

## Next

Recommended next wave: user-visible editor/viewer product workflow hardening.

The runtime observation layer is now strong enough to support a next wave that chooses a visible MVP slice: embedded preview/private viewer, drawable/mesh authoring workflow, mask/rig-control workflow, project import/export, or dynamics workflow verification.
