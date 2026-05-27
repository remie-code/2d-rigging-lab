# Test Taxonomy

> Shared classification for MVP test design.

## 1. Test Families

| Family | Purpose | Primary artifacts | Typical owner |
|--------|---------|-------------------|---------------|
| `schema` | Validate JSON/DTO shape and required files. | schema result, validation report | package-format |
| `contract` | Prove module DTO/API contracts align. | contract report, request/response examples | module owner |
| `operation` | Prove GUI/AI/import operations produce valid dry-run/commit/diff evidence. | operation log, model diff, runtime diff | operation-core |
| `runtime` | Prove parameters, keyforms, rigControls, masks, draw order, and snapshots evaluate deterministically. | runtime snapshot, runtime diff | runtime-core |
| `dynamicsSequence` | Prove Minimum Open Dynamics v1 fixed-step replay. | RuntimeState sequence artifact, computed parameter sequence | runtime-core |
| `validator` | Prove invalid fixtures emit expected diagnostics and profile behavior. | validation report | validator-core |
| `guiEvidence` | Prove private GUI authoring happened and semantic targets are stable. | GUI evidence, operation log, capture metadata | editor-ui |
| `aiAssistant` | Prove AI uses inspect/dry-run/diff/approval boundaries safely. | AI command transcript, dry-run result, diffs | ai-interface |
| `acceptance` | Aggregate AC/scenario evidence into MVP status. | acceptance runner result | acceptance-runner |
| `demoSafe` | Prove capture/proposal surfaces hide unsafe details and claims. | demo preflight report | viewer-ui / demo policy |
| `rightsProvenance` | Prove source assets and derived artifacts are rights-clean. | provenance report, rights metadata | package-format |
| `guardrail` | Prove forbidden inputs, claims, and surfaces stay out of MVP evidence. | scan report, validation report | validator-core |

## 2. Gate Levels

| Gate | Meaning |
|------|---------|
| `mvp-blocking` | Required for MVP pass. Missing/failing evidence fails acceptance. |
| `mvp-warning` | Required to report; failure may become `needs_review`. |
| `p1-blocking` | Required before implementation begins or before broad integration. |
| `optional` | Useful but not required for P0/P1 completion. |

## 3. Oracle Types

| Oracle | Use |
|--------|-----|
| `schema` | DTO and file schemas. |
| `contract` | Module contract examples and invariants. |
| `semanticState` | Stable IDs, model graph state, GUI semantic state. |
| `runtimeSnapshot` | Summary/targeted/full runtime snapshots. |
| `runtimeStateSequence` | Full RuntimeState sequence comparison for exact Dynamics replay. |
| `validationDiagnostic` | Expected check IDs, severity, status, targets, evidence. |
| `operationDiff` | Model/runtime/validation diffs from dry-run or commit. |
| `humanChecklist` | Bounded visual or demo review checklist. |
| `surfaceScan` | Demo/proposal/UI forbidden surface scan. |
| `rightsMetadata` | Provenance and license metadata. |

Not allowed as oracles:

- Cubism SDK/Core behavior
- Cubism Viewer or Cubism Physics matching
- Existing Cubism or third-party model behavior
- Pixel-perfect commercial output quality

## 4. Fixture Categories

| Category | Representative fixtures |
|----------|-------------------------|
| `happyPath` | `minimal-valid-package`, `psd-import-happy-path`, `tutorial-like-authoring` |
| `runtimeHappyPath` | `manual-face-grid-2d`, `parent-child-rigControl-diagonal`, `minimal-dynamics-hairSway` |
| `invalidModel` | `invalid-mesh-triangle`, `invalid-missing-texture`, `invalid-rigControl-cycle`, `invalid-mask-reference` |
| `invalidDynamics` | `invalid-dynamics-missing-driver`, `invalid-dynamics-missing-output`, `invalid-dynamics-cycle`, `invalid-dynamics-output-target-duplicate` |
| `dynamicsReplay` | `dynamics-reset-determinism`, `dynamics-fixed-step-replay`, `dynamics-output-range-clamp` |
| `guiEvidence` | `gui-hit-test-rigControl`, `gui-dynamics-panel-authoring`, `gui-keyform-grid-authoring` |
| `aiAssistant` | `ai-invalid-mutation`, `ai-repair-dry-run`, `out-of-range-parameter-dry-run`, `ai-screenshot-rigControl-parameter` |
| `demoSafe` | `demo-safe-dynamics-capture`, `demo-safe-viewer-capture`, `demo-unsafe-cubism-term` |
| `rightsProvenance` | `rights-provenance-missing`, `script-generated-minimal` |

## 5. Test Profile Mapping

| Profile | Included families |
|---------|-------------------|
| `dev-fast` | `schema`, selected `contract`, selected `operation` |
| `contract` | `schema`, `contract`, API request/response examples |
| `strict-determinism` | `runtime`, `dynamicsSequence`, hash/epsilon replay |
| `mvp-acceptance` | all P0/P1 families required by AC/scenario traceability |
| `demo-safe` | `demoSafe`, `rightsProvenance`, `guardrail` |
| `proposal-package` | `demoSafe`, `rightsProvenance`, non-affiliation wording checks |

## 6. Evidence Completeness Rule

A test row is complete only if it declares all of:

- `testId`
- related AC IDs
- related scenario IDs
- fixture ID
- operation flow
- expected artifacts
- oracle
- automation level
- gate
- owner module

Rows missing any field are not acceptance-ready.
