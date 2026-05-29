# Wave 12 Map

> Wave: `runtime-keyform-evaluation-foundation`
> Status: Completed / implementation-proven
> Date: 2026-05-29

## Files

| Path | Role | Status |
|---|---|---|
| [wave12-runtime-keyform-binding-identity-and-parameter-resolution-completion.md](wave12-runtime-keyform-binding-identity-and-parameter-resolution-completion.md) | Domain A completion report | pass |
| [wave12-runtime-keyform-sampling-foundation-completion.md](wave12-runtime-keyform-sampling-foundation-completion.md) | Domain B completion report | pass |
| [wave12-runtime-keyform-target-application-completion.md](wave12-runtime-keyform-target-application-completion.md) | Domain C completion report | pass |
| [wave12-runtime-snapshot-keyform-integration-completion.md](wave12-runtime-snapshot-keyform-integration-completion.md) | Domain D completion report | pass |
| [wave12-runtime-evidence-keyform-regression-completion.md](wave12-runtime-evidence-keyform-regression-completion.md) | Domain E completion report | pass |
| [wave12-runtime-keyform-fixture-completion.md](wave12-runtime-keyform-fixture-completion.md) | Domain F completion report | pass |
| [integration-review.md](integration-review.md) | Wave-level integration review | pass |
| [wave12-final-report.md](wave12-final-report.md) | Wave 12 final report | pass |

## Summary

Wave 12 connects authored keyforms to runtime evaluation output.

Implemented scope:

- Runtime keyform binding identity via `keyformSetId`.
- Effective parameter resolution helper for runtime sampling.
- `linear-1d-v1` and `parameter-grid-2d-v1` sampling foundation.
- Mesh vertices and drawable opacity / visibility / draw order target application.
- Runtime snapshot integration with non-empty `keyformSamples`.
- Runtime diff observation for keyform-driven drawable changes.
- Runtime, editor-session, AI-host evidence regressions for runtime-visible `addKeyform`.
- Compact runtime keyform evaluation contract fixture.

Out of scope remains UI authoring expansion, external HTTP/WebSocket/MCP transport, full rigControl target application, and AI-host `addKeyformGrid2d` evidence expansion.

## Next

Recommended next wave: runtime diff and Grid2D evidence hardening.

The main residual contract gap is richer diff structure for drawList / opacity / visibility / draw order. A follow-up can also add AI-host-level `addKeyformGrid2d` runtime evidence and expand diagnostic regression coverage without changing the Wave 12 foundation.
