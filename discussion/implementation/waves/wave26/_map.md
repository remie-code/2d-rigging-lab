# Wave 26 Map

> Wave: `rig-control-keyform-viewer-hardening`  
> Status: `pass / implementation-proven` as of 2026-06-01.

## Entry Points

| Path | Role | Status |
|---|---|---|
| [wave26-final-report.md](wave26-final-report.md) | Final integration report and verification summary | `pass / implementation-proven` |
| [../../reviews/wave26/wave26-clean-integration-review.md](../../reviews/wave26/wave26-clean-integration-review.md) | Clean integration review | `pass` |
| [../../orchestration/wave26-plan.md](../../orchestration/wave26-plan.md) | Wave26 orchestration plan | completed by this wave |

## Domain Reports

| Domain | Report | Status |
|---|---|---|
| A. Rig-control keyform operation / fixture hardening | [domain-a-completion-report.md](domain-a-completion-report.md) | `pass` |
| B. Runtime rig-control keyform evidence hardening | [domain-b-completion-report.md](domain-b-completion-report.md) | `pass` |
| C. Validator / report hardening | [wave26-domain-c-validator-report-hardening-completion.md](wave26-domain-c-validator-report-hardening-completion.md) | `pass` |
| D. Editor rig-control keyform authoring UX | [domain-d-completion-report.md](domain-d-completion-report.md) | `pass` |
| E. Viewer / evidence presentation and e2e persistence smoke | [domain-e-completion-report.md](domain-e-completion-report.md) | `pass` |

## Summary

Wave26 hardens Wave25 rig controls by proving `rigControl:angleDegrees` keyform operation/evidence, runtime local/world transform and affected-target evidence, validator/report checks, editor keyform UX, Viewer / Runtime observation, and desktop/mobile e2e persistence smoke.

Non-goals remain out of scope: Cubism compatibility, direct physics, warp lattice full evaluator, file picker/parser/image decode/archive/actual binary upload, full renderer, pixel oracle, standalone viewer, external dependencies, and package manifest/lockfile changes.
