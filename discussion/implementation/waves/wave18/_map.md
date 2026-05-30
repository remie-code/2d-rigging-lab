# Wave 18 Implementation Map

> Wave: `split-png-source-asset-and-provenance-intake`
> Status: Completed / implementation-proven
> Date: 2026-05-30

## Reports

| Path | Role | Status |
|---|---|---|
| [wave18-split-png-import-operation-foundation-completion.md](wave18-split-png-import-operation-foundation-completion.md) | Domain A completion: split PNG import operation foundation | pass |
| [wave18-asset-rights-provenance-validator-evidence-completion.md](wave18-asset-rights-provenance-validator-evidence-completion.md) | Domain B completion: asset rights / provenance validator evidence | pass |
| [wave18-editor-source-intake-draft-ui-state-completion.md](wave18-editor-source-intake-draft-ui-state-completion.md) | Domain C completion: editor source intake draft UI / state | pass |
| [wave18-editor-source-import-workflow-integration-completion.md](wave18-editor-source-import-workflow-integration-completion.md) | Domain D completion: editor source import workflow integration | pass |
| [wave18-imported-source-package-evidence-preview-consistency-completion.md](wave18-imported-source-package-evidence-preview-consistency-completion.md) | Domain E completion: imported source package / evidence / preview consistency | pass |
| [wave18-source-intake-e2e-and-persistence-smoke-completion.md](wave18-source-intake-e2e-and-persistence-smoke-completion.md) | Domain F completion: source intake E2E and persistence smoke | pass |
| [wave18-integration-review-and-final-report-completion.md](wave18-integration-review-and-final-report-completion.md) | Domain G completion: integration review and final report | pass |
| [wave18-final-report.md](wave18-final-report.md) | Wave 18 final report | pass |

## Summary

Wave 18 added metadata-backed split PNG source asset intake. The editor can register source asset / layer metadata with rights and provenance, commit it through operation lifecycle, create a drawable from the imported source layer, generate mesh evidence, and preserve source manifest / rights / provenance / drawable relation through browser-local save/load.

Real PNG bytes, OS file picker, PNG decode, texture atlas generation, and actual bitmap rendering remain future scope.
