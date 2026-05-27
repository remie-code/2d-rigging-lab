# GUI Evidence Schema

> P1 policy for proving that MVP authoring happened through the private GUI editor.

## 1. Purpose

GUI evidence proves that a package was authored through the private GUI editor and that UI actions resolved to stable project-defined targets before operation-core mutation.

Screenshots, videos, and browser traces are useful supporting evidence, but they are not sufficient by themselves. The primary evidence is structured semantic state plus committed operation log entries with `surface: "gui"`.

## 2. Basis

### Official Facts

No external official facts are used as test oracles in this policy.

### Repository Facts

- `AC-MVP-001` requires the GUI editor to be the mandatory authoring entry point.
- `AC-MVP-011` and `AC-MVP-012` require preview, save, reload, runtime/viewer display, and runtime snapshots.
- `SC-MVP-001`, `SC-MVP-002`, and `SC-MVP-003` require GUI authoring of source assets, drawable mesh, parameter, keyform, rig control, mask, draw order, and Dynamics.
- `gui-operation-contract.md` requires semantic state APIs, stable test IDs, hit-test results, and operation log evidence.
- `operation-contracts.md` defines `OperationLogEntryDto` as required GUI authoring evidence.

### Assumptions

- The first editor implementation is a web GUI with stable `data-testid` values for critical controls.
- Playwright traces and screenshots may be available, but acceptance must remain valid without pixel-perfect image matching.

## 3. Policy Decisions

- `gui-evidence.json` is the acceptance artifact for GUI evidence.
- A GUI evidence artifact must reference committed operation log entries. Missing operation logs fail the GUI evidence gate.
- Each GUI operation that mutates package-visible state must have stable semantic targets before commit.
- Pixel coordinates may appear in pointer metadata, but they must not be the only target identifier.
- Editor-only state such as selection, active tool, lock, editor hide, viewport, and panel expansion must be separated from runtime-visible model state.
- Captures are supplemental artifacts. They must include capture metadata and must not become hidden visual or Cubism matching oracles.
- GUI evidence must not use Cubism formats, SDK/Core behavior, Cubism Viewer matching, Cubism Physics compatibility, or existing Cubism models as expected output.

## 4. `gui-evidence.json`

Each GUI evidence artifact uses this logical schema. This is a policy schema, not implementation code.

| Field | Required | Meaning |
|-------|----------|---------|
| `schemaVersion` | yes | Literal policy version, currently `gui-evidence-v1`. |
| `evidenceId` | yes | Stable artifact ID without spaces. |
| `testId` | yes | Test ID without spaces. |
| `fixtureId` | yes | Fixture ID without spaces. |
| `relatedAC` | yes | AC IDs proven by this evidence. |
| `relatedScenarios` | yes | Scenario IDs proven by this evidence. |
| `session` | yes | GUI test session metadata. |
| `semanticStates` | yes | Ordered semantic state frames. |
| `operationRefs` | yes | Operation log references that prove committed GUI actions. |
| `captures` | no | Screenshot, video, or trace metadata. Supplemental only. |
| `modelDiffRefs` | no | Model diff artifacts for relevant operations. |
| `runtimeSnapshotRefs` | no | Runtime snapshot refs for runtime-visible changes. |
| `validationReportRefs` | no | Validator report refs for checked package state. |
| `demoPreflightRef` | no | Demo preflight ref when capture evidence is used. |
| `rightsProvenanceReportRef` | no | Rights/provenance report ref for displayed assets. |
| `diagnostics` | yes | GUI evidence diagnostics emitted by the runner. |
| `status` | yes | `pass`, `fail`, or `needs_review`. |

## 5. Session Metadata

| Field | Required | Rule |
|-------|----------|------|
| `sessionId` | yes | Stable ID without spaces. |
| `actor` | yes | `human`, `playwright`, `aiGuiHelper`, or equivalent actor category. |
| `surface` | yes | Must be `gui` for GUI evidence. |
| `appBuildId` | yes | Build or version identifier. |
| `packageId` | yes | Project-defined package ID. |
| `packageRevisionStart` | yes | Revision before the authoring flow. |
| `packageRevisionEnd` | yes | Revision after the authoring flow. |
| `viewportCssPx` | yes | Browser viewport used for captures and hit-tests. |
| `locale` | no | UI locale when relevant to label scans. |
| `startedAt` | no | Timestamp, excluded from deterministic hashes unless explicitly included. |
| `endedAt` | no | Timestamp, excluded from deterministic hashes unless explicitly included. |

## 6. Semantic State Frame

Semantic frames prove what the editor knew at a point in the flow.

| Field | Required | Rule |
|-------|----------|------|
| `frameId` | yes | Stable ID without spaces. |
| `packageRevision` | yes | Revision observed by the editor. |
| `authoringRevision` | yes | Editor authoring revision. |
| `mode` | yes | Editor mode such as `select`, `meshEdit`, `dynamicsEdit`, or `runtimePreview`. |
| `activeToolId` | yes | Stable tool ID. |
| `visiblePanels` | yes | Panel IDs visible to the user. |
| `selectedObjectIds` | yes | Stable target IDs, not display labels only. |
| `lockedIds` | yes | Editor-only locked IDs. |
| `editorHiddenIds` | yes | Editor-only hidden IDs. |
| `currentPreviewParameterValues` | yes | Preview input values, not package defaults unless committed. |
| `canvasViewport` | yes | Canvas/model transform metadata. |
| `hitTestResults` | no | Semantic hit-test results when a canvas target is used. |
| `latestOperationId` | no | Last operation related to this frame. |
| `latestRuntimeSnapshotId` | no | Runtime snapshot visible to this frame. |
| `latestValidationReportId` | no | Validation report visible to this frame. |

## 7. Operation Reference

Each runtime-visible GUI mutation must link to an operation log entry.

| Field | Required | Rule |
|-------|----------|------|
| `operationId` | yes | Must exist in operation log. |
| `operationType` | yes | Must match the operation catalog. |
| `actor` | yes | Actor that triggered the GUI action. |
| `surface` | yes | Must be `gui`. |
| `dryRun` | yes | `false` for committed authoring evidence. Dry-run refs may be included as supporting evidence. |
| `targetIds` | yes | Stable IDs affected by the operation. |
| `packageRevisionBefore` | yes | Revision before commit. |
| `packageRevisionAfter` | yes | Revision after commit. |
| `modelDiffRef` | no | Required for model-changing operations in acceptance tests. |
| `runtimeDiffRef` | no | Required when runtime-visible behavior changes. |
| `validationDiffRef` | no | Required for repair or acceptance-profile operations. |
| `provenanceId` | yes | Provenance link for the operation. |

## 8. Capture Metadata

Captures may support review, but cannot replace semantic state and operation logs.

| Field | Required | Rule |
|-------|----------|------|
| `captureId` | yes | Stable ID without spaces. |
| `kind` | yes | `screenshot`, `video`, `trace`, or `captureSequence`. |
| `surface` | yes | `editor`, `editorPreview`, `privateViewer`, or `demoSafeViewer`. |
| `artifactRef` | yes | Path or artifact reference. |
| `contentHash` | yes | Hash of the capture file when persisted. |
| `viewportCssPx` | yes | Viewport for screenshots/videos. |
| `relatedOperationIds` | no | Operation IDs visible or demonstrated. |
| `semanticStateFrameIds` | yes | Frames that explain what the capture shows. |
| `captureAllowed` | yes | `true` only when demo-safe and rights policy allow the capture. |
| `redactedFields` | yes | Fields hidden before capture. |
| `notes` | no | Human review notes. |

## 9. Required Checks

| Check ID | Gate | Failure condition |
|----------|------|-------------------|
| `guiEvidence.operationLog.required` | `mvp-blocking` | No committed operation log entry with `surface: "gui"`. |
| `guiEvidence.semanticTarget.required` | `mvp-blocking` | Canvas or panel action lacks stable target IDs. |
| `guiEvidence.screenshotOnly.forbidden` | `mvp-blocking` | Screenshot/capture is the only evidence for an authoring step. |
| `guiEvidence.editorRuntimeState.separated` | `mvp-blocking` | Editor-only state is treated as runtime-visible package state. |
| `guiEvidence.captureMetadata.required` | `p1-blocking` | Persisted screenshot/video lacks capture metadata. |
| `guiEvidence.captureAllowed.checked` | `mvp-blocking` | A capture used for demo evidence has `captureAllowed: false` or missing rights proof. |
| `guiEvidence.hiddenCubismOracle.forbidden` | `mvp-blocking` | Expected result depends on Cubism format, SDK/Core, Viewer matching, Physics compatibility, or existing Cubism model behavior. |

## 10. Fixture Requirements

| Fixture ID | Purpose | Required evidence |
|------------|---------|-------------------|
| `tutorial-like-authoring` | Full GUI authoring path from import to save/reload. | `gui-evidence.json`, operation log, validation report, runtime snapshots. |
| `gui-hit-test-rigControl` | Canvas hit-test resolves a rig control to stable IDs. | Semantic state, hit-test result, operation dry-run or commit ref. |
| `gui-dynamics-panel-authoring` | Dynamics panel creates group, binds driver/output, and previews reset. | Operation refs, semantic state, runtime state refs. |
| `gui-mask-setup` | GUI creates mask relation with stable drawable IDs. | Operation refs, validation report, targeted capture metadata. |
| `gui-keyform-grid-authoring` | GUI writes `parameter-grid-2d-v1` keyform evidence. | Operation refs, runtime snapshot, semantic state. |
| `script-generated-minimal` | Proves script-only package cannot pass GUI gate. | Acceptance report with `guiEvidence.operationLog.required`. |
| `demo-safe-dynamics-capture` | GUI capture evidence is demo-safe and rights-clean. | Capture metadata, demo preflight report, rights/provenance report. |

## 11. Pass / Fail Rules

- `pass`: required operation logs, semantic states, target IDs, and supporting runtime/validation artifacts are present and consistent.
- `needs_review`: semantic evidence is complete, but a capture or human visual review note needs confirmation.
- `fail`: operation log is missing, target identity is pixel-only, captures are unsafe, or any hidden Cubism oracle is used.

## 12. Open Questions

| Question | Impact | Status |
|----------|--------|--------|
| Raw pointer sample retention duration | can-defer | Supplemental evidence only. |
| Exact visual review checklist for capture quality | can-defer | Covered by later visual review policy. |
| Whether GUI evidence artifacts are one per test or one per scenario | can-defer | This policy supports both if IDs stay stable. |
