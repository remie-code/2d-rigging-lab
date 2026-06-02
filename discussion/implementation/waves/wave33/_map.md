# Wave33 Map

> Wave33 `layer-tree-direct-manipulation-part-tree-ux-v0` completion artifacts.

## Status

Wave33 completed with final verdict `pass` on 2026-06-02.

Final report: [wave33-final-report.md](wave33-final-report.md)

Clean integration review: [../../reviews/wave33/wave33-clean-integration-review.md](../../reviews/wave33/wave33-clean-integration-review.md)

## Domain Reports

| Domain | Report | Review |
|---|---|---|
| A. Part tree operation / authoring foundation | [wave33-domain-a-part-tree-operation-authoring-foundation-report.md](wave33-domain-a-part-tree-operation-authoring-foundation-report.md) | [../../reviews/wave33/wave33-domain-a-part-tree-operation-authoring-foundation-review.md](../../reviews/wave33/wave33-domain-a-part-tree-operation-authoring-foundation-review.md) |
| B. Runtime / Viewer part tree evidence hardening | [domain-b-runtime-viewer-part-tree-evidence-hardening-completion-report.md](domain-b-runtime-viewer-part-tree-evidence-hardening-completion-report.md) | [../../reviews/wave33/domain-b-runtime-viewer-part-tree-evidence-hardening-review.md](../../reviews/wave33/domain-b-runtime-viewer-part-tree-evidence-hardening-review.md) |
| C. Validator part tree direct-manipulation diagnostics | [domain-c-validator-part-tree-direct-manipulation-diagnostics-completion-report.md](domain-c-validator-part-tree-direct-manipulation-diagnostics-completion-report.md) | [../../reviews/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-review.md](../../reviews/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-review.md) |
| D. Editor layer tree direct-manipulation draft | [domain-d-editor-layer-tree-direct-manipulation-draft-completion-report.md](domain-d-editor-layer-tree-direct-manipulation-draft-completion-report.md) | [../../reviews/wave33/domain-d-editor-layer-tree-direct-manipulation-draft-review.md](../../reviews/wave33/domain-d-editor-layer-tree-direct-manipulation-draft-review.md) |
| E. Editor workflow / session / app-shell integration | [domain-e-editor-layer-tree-workflow-session-integration-completion-report.md](domain-e-editor-layer-tree-workflow-session-integration-completion-report.md) | [../../reviews/wave33/domain-e-editor-layer-tree-workflow-session-integration-review.md](../../reviews/wave33/domain-e-editor-layer-tree-workflow-session-integration-review.md) |
| F. Fixtures and desktop/mobile e2e smoke | [domain-f-layer-tree-fixtures-and-e2e-smoke-completion-report.md](domain-f-layer-tree-fixtures-and-e2e-smoke-completion-report.md) | [../../reviews/wave33/domain-f-layer-tree-fixtures-and-e2e-smoke-review.md](../../reviews/wave33/domain-f-layer-tree-fixtures-and-e2e-smoke-review.md) |
| G. Integration review and final report | [wave33-final-report.md](wave33-final-report.md) | [../../reviews/wave33/wave33-clean-integration-review.md](../../reviews/wave33/wave33-clean-integration-review.md) |

## Verification Summary

Final verification passed: `pnpm.cmd typecheck`, `pnpm.cmd test:unit` (170 files / 868 tests), `pnpm.cmd test:e2e`, `pnpm.cmd run check:source`, `pnpm.cmd run check:deps`, scoped `git diff --check`, dependency manifest/lockfile diff check, and forbidden-scope scan. The initial full unit run exposed a Wave30 fixture runtime evidence mismatch; Gnome fixed the fixture-local evidence backfill narrowly and Review-Sylph accepted the fix before the final unit rerun passed.

## Scope Boundary

Implemented: explicit-control layer tree direct manipulation for part rename, reparent, empty-leaf delete, drawable reassignment, texture assignment, operation/session commit path, semantic runtime/viewer/validator evidence, rights-clean fixture, and desktop/mobile e2e save-load reinspection.

Not implemented: native browser drag-and-drop, multi-select bulk operations, group transform, recursive delete, delete-with-reassign, full renderer, pixel oracle, Cubism compatibility, PSD parser, PNG/image decode, archive import/export, File System Access API, external dependency, package manifest, or lockfile changes.
