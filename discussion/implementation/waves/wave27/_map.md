# Wave 27 Map

> Wave: `mask-clipping-opacity-authoring-v1`  
> Status: `pass / implementation-proven` as of 2026-06-01.  
> Clean integration review: `pass` at [../../reviews/wave27/wave27-clean-integration-review.md](../../reviews/wave27/wave27-clean-integration-review.md).

## Entry Points

| Path | Role | Status |
|---|---|---|
| [wave27-final-report.md](wave27-final-report.md) | Final integration report, final verification summary, residual risks, and fixture/traceability registration note | `pass / implementation-proven` |
| [../../reviews/wave27/_map.md](../../reviews/wave27/_map.md) | Review artifact map | domain reviews `pass`; clean review `pass` registered |
| [../../reviews/wave27/wave27-clean-integration-review.md](../../reviews/wave27/wave27-clean-integration-review.md) | Clean integration review | `pass` |
| [../../orchestration/wave27-plan.md](../../orchestration/wave27-plan.md) | Wave27 orchestration plan | completed by this wave |

## Domain Reports

| Domain | Report | Status |
|---|---|---|
| A. Mask relation authoring / operation foundation | [wave27-domain-a-mask-relation-authoring-operation-foundation.md](wave27-domain-a-mask-relation-authoring-operation-foundation.md) | `pass` |
| B. Runtime composition evidence hardening | [wave27-domain-b-runtime-composition-evidence-hardening.md](wave27-domain-b-runtime-composition-evidence-hardening.md) | `pass` |
| C. Validator composition diagnostics | [wave27-validator-composition-diagnostics-report.md](wave27-validator-composition-diagnostics-report.md) | `pass` |
| D. Composition contract fixtures | [wave27-domain-d-composition-contract-fixtures.md](wave27-domain-d-composition-contract-fixtures.md) | `pass` |
| E. Editor composition authoring UX | [wave27-domain-e-editor-composition-authoring-ux.md](wave27-domain-e-editor-composition-authoring-ux.md) | `pass` |
| F. Composition e2e persistence smoke | [wave27-domain-f-composition-e2e-persistence-smoke.md](wave27-domain-f-composition-e2e-persistence-smoke.md) | `pass` |
| G. Integration review and final report | [wave27-final-report.md](wave27-final-report.md) | `pass / implementation-proven` |

## Summary

Wave27 proves semantic mask relation / clipping intent / opacity authoring as a project-defined composition workflow. It covers `setMaskRelation` authoring operation support, runtime mask/opacity evidence, validator composition diagnostics, rights-clean contract fixtures, Editor Composition / Mask / Opacity UX, Viewer / Runtime semantic observation, and desktop/mobile browser save/load smoke.

Non-goals remain out of scope: pixel clipping oracle, full renderer, standalone viewer, Cubism compatibility, file picker, parser, image decode, archive import/export, actual binary upload, external dependencies, and package manifest/lockfile changes.
