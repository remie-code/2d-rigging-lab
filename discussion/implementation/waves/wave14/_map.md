# Wave 14 Map

> Wave: `editor-embedded-preview-foundation`
> Status: Completed / implementation-proven
> Date: 2026-05-30

## Files

| Path | Role | Status |
|---|---|---|
| [wave14-preview-runtime-projection-foundation-completion.md](wave14-preview-runtime-projection-foundation-completion.md) | Domain A completion report | pass |
| [wave14-preview-ready-sample-package-completion.md](wave14-preview-ready-sample-package-completion.md) | Domain B completion report | pass |
| [wave14-preview-controls-and-workflow-state-completion.md](wave14-preview-controls-and-workflow-state-completion.md) | Domain C completion report | pass |
| [wave14-embedded-preview-panel-ui-completion.md](wave14-embedded-preview-panel-ui-completion.md) | Domain D completion report | pass |
| [wave14-preview-e2e-and-accessibility-smoke-completion.md](wave14-preview-e2e-and-accessibility-smoke-completion.md) | Domain E completion report | pass |
| [wave14-sample-aware-ai-editor-regression-fix-completion.md](wave14-sample-aware-ai-editor-regression-fix-completion.md) | Focused needs-fix completion report | pass |
| [integration-review.md](integration-review.md) | Wave-level integration review after needs-fix rerun | pass |
| [wave14-final-report.md](wave14-final-report.md) | Wave 14 final report | pass |

## Summary

Wave 14 source implementation reached the embedded editor preview foundation:

- runtime snapshot/diff projection for editor preview;
- preview-ready sample package with slider-visible runtime deformation;
- preview-only workflow state and reset;
- embedded preview panel with runtime-projected SVG visual, summary, sliders, and reset;
- desktop/mobile browser smoke and basic accessible-name checks.

The first integration review found a root `pnpm.cmd test` failure in existing AI/editor-session regression tests that still assumed the browser sample had zero parameters. A focused needs-fix loop made those tests sample-aware, and final verification now passes.

## Next

Use [wave14-final-report.md](wave14-final-report.md) and [integration-review.md](integration-review.md) as the Wave 14 completion evidence before planning the next visible product workflow wave.
