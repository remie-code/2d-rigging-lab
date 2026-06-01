# Wave 28 Map

> Wave: `part-texture-layer-tree-workflow-v1`
> Status: `pass / implementation-proven` as of 2026-06-01.
> Clean integration review: `pass` at [../../reviews/wave28/wave28-clean-integration-review.md](../../reviews/wave28/wave28-clean-integration-review.md).

## Entry Points

| Path | Role | Status |
|---|---|---|
| [wave28-final-report.md](wave28-final-report.md) | Final integration report, final verification summary, residual risks, and fixture/traceability registration note | `pass / implementation-proven`; clean review `pass` |
| [../../reviews/wave28/_map.md](../../reviews/wave28/_map.md) | Review artifact map | domain reviews `pass`; clean review path registered |
| [../../reviews/wave28/wave28-clean-integration-review.md](../../reviews/wave28/wave28-clean-integration-review.md) | Clean integration review | `pass` |
| [../../orchestration/wave28-plan.md](../../orchestration/wave28-plan.md) | Wave28 orchestration plan | completed by this wave |

## Domain Reports

| Domain | Report | Status |
|---|---|---|
| A. Part / texture authoring operation foundation | [domain-a-gnome-report.md](domain-a-gnome-report.md) | `pass` |
| B. Runtime / Preview / Viewer layer-tree evidence | [domain-b-runtime-preview-viewer-layer-tree-evidence-report.md](domain-b-runtime-preview-viewer-layer-tree-evidence-report.md) | `pass` |
| C. Validator part / texture / layer diagnostics | [domain-c-validator-part-texture-layer-diagnostics-report.md](domain-c-validator-part-texture-layer-diagnostics-report.md) | `pass` |
| D. Editor layer-tree draft state / view model | [domain-d-editor-layer-tree-draft-state-view-model-completion.md](domain-d-editor-layer-tree-draft-state-view-model-completion.md) | `pass` |
| E. Part / texture / layer contract fixtures | [domain-e-part-texture-layer-contract-fixtures-gnome-report.md](domain-e-part-texture-layer-contract-fixtures-gnome-report.md) | `pass` |
| F. Editor part / texture / layer workflow UX | [domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md](domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md) | `pass` |
| G. Part / texture / layer e2e persistence smoke | [domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md](domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md) | initial `escalate`, cleared by remediation/rerun |
| G R1. Mobile layer-tree overflow remediation | [domain-g-remediation-mobile-layer-tree-overflow-gnome-report.md](domain-g-remediation-mobile-layer-tree-overflow-gnome-report.md) | `pass` |
| G R2. Viewer drawable part evidence remediation | [domain-g-remediation-viewer-drawable-part-evidence-gnome-report.md](domain-g-remediation-viewer-drawable-part-evidence-gnome-report.md) | `pass` |
| G rerun. E2E persistence smoke rerun | [domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md](domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md) | `pass` |
| H. Integration review and final report | [wave28-final-report.md](wave28-final-report.md) | `pass`; clean review `pass` |

## Summary

Wave28 proves a minimum semantic Part / Texture / Layer Tree Workflow v1. It covers part create/update operations, drawable part reassignment, existing texture atlas assignment, semantic runtime/preview/viewer evidence, deterministic validator diagnostics, rights-clean contract fixtures, Editor layer selection / lock / editor-only hide, browser-local save/load, and desktop/mobile e2e persistence smoke.

Non-goals remain out of scope: file picker, parser, archive import/export, image decode, actual binary upload, external dependency, Cubism compatibility, pixel oracle, full renderer, full drag-and-drop layer tree, full part tree UX, UV editor, atlas packer, and mesh topology editor.
