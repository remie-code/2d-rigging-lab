# Wave 29 Map

> Wave: `canvas-mesh-editing-v1`
> Status: `pass / implementation-proven` as of 2026-06-02.
> Clean integration review: `pass` at [../../reviews/wave29/wave29-clean-integration-review.md](../../reviews/wave29/wave29-clean-integration-review.md).

## Entry Points

| Path | Role | Status |
|---|---|---|
| [wave29-final-report.md](wave29-final-report.md) | Final integration report, verification summary, residual risks, and registration summary | `pass / implementation-proven`; clean review `pass` |
| [../../reviews/wave29/_map.md](../../reviews/wave29/_map.md) | Review artifact map | domain reviews `pass`; clean review path registered |
| [../../reviews/wave29/wave29-clean-integration-review.md](../../reviews/wave29/wave29-clean-integration-review.md) | Clean integration review | `pass` |
| [../../orchestration/wave29-plan.md](../../orchestration/wave29-plan.md) | Wave29 orchestration plan | completed by this wave |

## Domain Reports

| Domain | Report | Status |
|---|---|---|
| A. Mesh edit operation hardening | [wave29-domain-a-operation-hardening-orch-report.md](wave29-domain-a-operation-hardening-orch-report.md) | `pass` |
| A. Gnome implementation report | [wave29-domain-a-operation-hardening-gnome-report.md](wave29-domain-a-operation-hardening-gnome-report.md) | `done` |
| B. Runtime / Preview / Viewer mesh edit evidence | [domain-b-runtime-preview-viewer-mesh-edit-evidence-gnome-report.md](domain-b-runtime-preview-viewer-mesh-edit-evidence-gnome-report.md) | `pass` |
| C. Validator mesh topology diagnostics | [wave29-domain-c-validator-mesh-topology-diagnostics-orch-report.md](wave29-domain-c-validator-mesh-topology-diagnostics-orch-report.md) | `pass` |
| C. Gnome implementation report | [wave29-domain-c-validator-mesh-topology-diagnostics-gnome-report.md](wave29-domain-c-validator-mesh-topology-diagnostics-gnome-report.md) | `done` |
| D. Editor canvas mesh selection state / view model | [domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md](domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md) | `pass` |
| E. Mesh edit contract fixtures | [wave29-domain-e-mesh-edit-contract-fixtures-orch-report.md](wave29-domain-e-mesh-edit-contract-fixtures-orch-report.md) | `pass` |
| E. Gnome implementation report | [wave29-domain-e-mesh-edit-contract-fixtures-gnome-report.md](wave29-domain-e-mesh-edit-contract-fixtures-gnome-report.md) | `done` |
| F. Editor canvas mesh workflow UX | [wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md](wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md) | `pass` |
| G. Canvas mesh edit e2e persistence smoke | [wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md](wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md) | `pass` |
| H. Integration review and final report | [wave29-final-report.md](wave29-final-report.md) | final verification `pass`; clean review `pass` |

## Summary

Wave29 proves bounded Canvas Mesh Editing v1. It covers canvas/SVG mesh vertex selection, single and multi-vertex movement through `moveMeshVertex`, locked/editor-hidden/runtime-hidden guard behavior, semantic Preview / Viewer / Runtime mesh evidence, validator topology diagnostics, rights-clean semantic contract fixtures, browser-local save/load, and desktop/mobile e2e persistence smoke.

Non-goals remain out of scope: topology editor, UV editor, automatic triangulation, full renderer, pixel oracle, real image bytes, file picker, parser, image decode, archive import/export, external dependency, package manifest/lockfile changes, and Cubism compatibility.
