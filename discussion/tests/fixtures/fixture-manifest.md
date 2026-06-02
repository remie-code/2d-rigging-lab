# P0 Fixture Manifest

> Status: Draft P0 test design artifact.
> Scope: fixture classes, expected evidence, oracles, gates, and owner modules for the Private 2D Rigging Lab / Prototype baseline.
> JSON mirror: [fixture-manifest.json](fixture-manifest.json)

## Basis Separation

### Repository Facts

- The current MVP baseline is the Private 2D Rigging Lab / Prototype.
- MVP completion requires GUI authoring, project-defined model package save/reload, private runtime/viewer evaluation, validator reports, AI dry-run/diff/repair suggestion, rights/provenance evidence, demo-safe capture, and Cubism-independent completion.
- Minimum Open Dynamics v1 is in MVP and is limited to parameter-driven deterministic secondary motion through `scalarDampedFollowV1`, authored driver parameters, and computed output parameters.
- Runtime evidence uses explicit `RuntimeStateDto` input/output. Runtime state sequence evidence stores `states[0]` as the initial state and `states[i+1]` as the post-frame state after frame `i`.

### Design Decisions

- P0 fixtures are evidence fixtures, not production sample models.
- Each P0 fixture must declare related AC/SC IDs, an operation flow, expected artifacts, oracle, automation level, gate, and owner module.
- GUI screenshots are supplemental only. Required GUI evidence is semantic GUI evidence plus committed GUI operation log entries.
- Dynamics exact replay fixtures compare the full runtime state sequence, not only the final state.
- Existing Cubism models, Cubism formats, SDK/Core behavior, viewer matching, physics compatibility, or third-party Live2D assets are never used as fixture input or oracle.

### Assumptions

- Future physical fixture data can live under an implementation path such as `fixtures/contracts/<fixture-id>/`.
- Expected artifacts are semantic JSON artifacts checked with the policy in [../expected/expected-artifacts-policy.md](../expected/expected-artifacts-policy.md).
- Visual capture is useful for review, but P0 pass/fail depends on structured artifacts unless the fixture explicitly declares hybrid/manual review.

## Fixture Classes

| Class | Purpose | P0 examples |
|---|---|---|
| `happy-path` | Prove the authoring-to-viewer path works with valid rights-clean data. | `minimal-valid-package`, `psd-import-happy-path`, `tutorial-like-authoring`, `wave30-tutorial-mini-model-contract-fixtures` |
| `invalid` | Prove validator diagnostics, severity, and gate behavior. | `invalid-mesh-triangle`, `invalid-rigControl-cycle`, `invalid-dynamics-cycle` |
| `dynamics` | Prove Minimum Open Dynamics v1 package, replay, validation, and demo-safe behavior. | `minimal-dynamics-hairSway`, `dynamics-fixed-step-replay` |
| `gui-evidence` | Prove GUI authoring is present and operation-core is the mutation boundary. | `tutorial-like-authoring`, `script-generated-minimal`, `wave30-tutorial-mini-model-contract-fixtures` |
| `ai` | Prove AI observes, dry-runs, diffs, and proposes repair without unapproved mutation. | `ai-repair-dry-run`, `ai-invalid-mutation` |
| `demo-safe` | Prove capture surfaces expose only approved high-level private prototype output. | `demo-safe-dynamics-capture`, `demo-unsafe-forbidden-term` |
| `rights-provenance` | Prove source asset rights/provenance are present, traceable, and gateable. | `rights-provenance-missing`, `psd-import-happy-path`, `wave31-byte-sample-characterization` |

## Artifact Shorthand

| Shorthand | Meaning |
|---|---|
| `validation` | Expected `ValidationReportDto` or demo preflight report section. |
| `snapshot` | Expected `RuntimeSnapshotDto`, either `summary`, `targeted`, or `full`. |
| `diff` | Expected model/runtime/validation diff. |
| `runtimeState` | Single generated `runtime/states/*.runtime-state.json` artifact. |
| `runtimeStateSequence` | Generated `runtime/state-sequences/*.runtime-state-sequence.json` artifact. |
| `operationLog` | Expected `operations/log.jsonl` entries. |
| `guiEvidence` | Expected `GuiOperationEvidenceDto` or editor semantic state evidence. |
| `aiTranscript` | Expected AI command request/response transcript. |
| `demoPreflight` | Expected demo-safe preflight output. |

## Traceability Connection Policy

Repository fact after review_009 fixes: every fixture with gate `mvp-blocking` is referenced by at least one Test ID in [../traceability/test-traceability-matrix.json](../traceability/test-traceability-matrix.json).

Design decision: the Acceptance Runner must fail `gate.manifestIntegrity` when a `mvp-blocking` fixture has no Test ID reference. If a fixture is intentionally kept outside executable acceptance coverage, lower its gate to `warning` or `optional` and record the reason in this manifest.

The JSON mirror records this as `traceabilityConnectionPolicy` and `mvpBlockingFixtureConnectionAudit`.

## P0 Fixtures

| Fixture ID | Class | Purpose | Related AC/SC | Operation flow | Expected artifacts | Oracle | Automation | Gate | Owner module |
|---|---|---|---|---|---|---|---|---|---|
| `minimal-valid-package` | `happy-path` | Prove mandatory package files, stable IDs, base references, runtime load, and non-empty draw list. | AC-MVP-004, AC-MVP-012, AC-MVP-013, AC-DRAW-001, AC-RUNTIME-001, SC-VIEWER-001, SC-RUNTIME-001 | `loadPackage`, `validatePackage`, `getRuntimeSnapshot` | validation=`minimal.validation.json`; snapshot=`summary`; diff=`none`; runtimeState=`none` | Project package schema, reference validation, runtime non-empty draw list. | auto | mvp-blocking | `package-format` |
| `psd-import-happy-path` | `happy-path`, `rights-provenance` | Prove layered character PSD profile creates source assets, parts, drawables, textures, and provenance. | AC-MVP-002, AC-MVP-003, AC-IN-001, AC-IN-002, AC-IN-006, AC-RIGHTS-002, SC-IN-001 | `importPsdSourceAsset`, `createDrawable`, `validatePackage` | validation=`rights/import-pass`; snapshot=`none`; diff=`modelDiff`; runtimeState=`none`; operationLog=`gui/import-log` | Project-defined `layered-character-psd-profile-v1` and rights/provenance metadata. | auto | mvp-blocking | `package-format` |
| `psd-unsupported-layer` | `invalid` | Prove unsupported PSD source features become structured diagnostics without becoming runtime graph requirements. | AC-MVP-003, AC-IN-006, SC-IN-001 | `importPsdSourceAsset`, `validatePackage` | validation=`asset.psd.unsupportedFeature`; snapshot=`none`; diff=`modelDiff`; runtimeState=`none` | Import diagnostics and retained/lost source information. | auto | warning | `package-format` |
| `split-png-fallback` | `happy-path` | Prove split PNG fallback records placement, missing PSD tree warning, and provenance. | AC-MVP-003, AC-IN-001, AC-IN-006, SC-IN-001 | `importSplitPngSourceAsset`, `createDrawable`, `validatePackage` | validation=`fallback-warning`; snapshot=`none`; diff=`modelDiff`; runtimeState=`none`; operationLog=`gui/import-log` | Split PNG fallback profile and provenance warning. | auto | warning | `package-format` |
| `tutorial-like-authoring` | `happy-path`, `gui-evidence` | Prove the GUI authoring path covers import, mesh, part, mask, draw order, parameter, keyform, rig control, dynamics, save/reload, preview, and validation. | AC-MVP-001..AC-MVP-014, SC-MVP-001, SC-MVP-002, SC-MVP-003, SC-WF-001 | `importPsdSourceAsset`, `generateMesh`, `createParameter`, `addKeyform`, `addKeyformGrid2d`, `createRotation2dRigControl`, `createWarpLattice2dRigControl`, `setMaskRelation`, `setDrawOrder`, `createDynamicsGroup`, `validatePackage` | validation=`acceptance-pass`; snapshot=`full`; diff=`modelDiff+runtimeDiff`; runtimeState=`initial+final`; operationLog=`gui/full-log`; guiEvidence=`semantic-state` | GUI operation log plus runtime/validator evidence; screenshot is supplemental. | hybrid | mvp-blocking | `editor-ui` |
| `manual-face-grid-2d` | `happy-path` | Prove `parameter-grid-2d-v1` face yaw/pitch grid saves and evaluates deterministically. | AC-MVP-008, AC-MVP-010, AC-PARAM-004, AC-PARAM-005, AC-PARAM-007, AC-FACE-007, SC-PARAM-003, SC-PARAM-004, SC-FACE-003 | `createParameter`, `addKeyformGrid2d`, `getRuntimeSnapshot`, `validatePackage` | validation=`grid-pass`; snapshot=`full`; diff=`runtimeDiff`; runtimeState=`none`; operationLog=`gui/grid-log` | Runtime keyform grid semantics and vertex hash epsilon policy. | auto | mvp-blocking | `runtime-core` |
| `parent-child-rigControl-diagonal` | `happy-path` | Prove parent-before-child rig control evaluation composes diagonal expression. | AC-MVP-009, AC-MVP-010, AC-DEF-003, AC-DEF-004, AC-DEF-005, SC-DEF-002 | `createRotation2dRigControl`, `createWarpLattice2dRigControl`, `bindRigControlChild`, `getRuntimeSnapshot` | validation=`hierarchy-pass`; snapshot=`targeted`; diff=`runtimeDiff`; runtimeState=`none`; operationLog=`gui/rigControl-log` | Runtime hierarchy topological order and targeted snapshot comparison. | auto | mvp-blocking | `runtime-core` |
| `minimal-dynamics-hairSway` | `happy-path`, `dynamics` | Prove authored `faceYaw` drives delayed/clamped `hairSway` computed output without direct mesh or rig control writes. | AC-MVP-010, AC-MVP-012, AC-PHYS-001..AC-PHYS-005, SC-DYN-001, SC-DYN-002 | `createDynamicsGroup`, `bindDynamicsDriver`, `bindDynamicsOutput`, `setDynamicsSettings`, `resetDynamicsPreviewState`, `runDynamicsPreviewSequence`, `validatePackage` | validation=`dynamics-pass`; snapshot=`targeted-sequence`; diff=`runtimeDiff.dynamicsChanges`; runtimeState=`initial+expected-next`; runtimeStateSequence=`expected` | `scalarDampedFollowV1` contract and exact replay policy. | auto | mvp-blocking | `runtime-core` |
| `dynamics-reset-determinism` | `dynamics` | Prove reset boundaries and repeated replay produce the same dynamics output and state sequence. | AC-PHYS-003, AC-PHYS-004, AC-PHYS-005, SC-DYN-002 | `resetDynamicsPreviewState`, `runDynamicsPreviewSequence`, `runDynamicsPreviewSequence` | validation=`no-nondeterminism`; snapshot=`paired-targeted-sequences`; diff=`runtimeDiff.noMismatch`; runtimeStateSequence=`replay-a+replay-b` | Full `RuntimeStateSequenceArtifact` equality under identical package/input/context/evaluator versions. | auto | mvp-blocking | `runtime-core` |
| `dynamics-fixed-step-replay` | `dynamics` | Prove variable frame deltas are lowered to fixed-step substeps with deterministic accumulator and state evidence. | AC-MVP-012, AC-PHYS-003, AC-PHYS-004, AC-PHYS-005, SC-DYN-002 | `runDynamicsPreviewSequence`, `validatePackage` | validation=`no-timestep-overflow`; snapshot=`targeted-sequence`; diff=`runtimeDiff.dynamicsChanges`; runtimeState=`initial+expected-next`; runtimeStateSequence=`expected` | Fixed timestep policy, accumulator semantics, full sequence comparison. | auto | mvp-blocking | `runtime-core` |
| `dynamics-output-range-clamp` | `dynamics`, `invalid` | Prove output clamp evidence and out-of-range diagnostics are visible. | AC-PHYS-002, AC-PHYS-003, AC-PHYS-005, SC-DYN-003 | `setDynamicsSettings`, `runDynamicsPreviewSequence`, `validatePackage` | validation=`dynamics.outputParameterOutOfRange|dynamics.outputClamped`; snapshot=`targeted`; diff=`runtimeDiff.dynamicsChanges`; runtimeState=`expected-next` | Runtime clamp diagnostics and validator check registry. | auto | mvp-blocking | `validator-core` |
| `invalid-dynamics-missing-driver` | `invalid`, `dynamics` | Prove a dynamics group without a valid authored driver fails validation. | AC-PHYS-002, SC-DYN-003 | `createDynamicsGroup`, `bindDynamicsOutput`, `validatePackage` | validation=`dynamics.driverMissing`; snapshot=`none`; diff=`none`; runtimeState=`none` | Validator check registry. | auto | mvp-blocking | `validator-core` |
| `invalid-dynamics-missing-output` | `invalid`, `dynamics` | Prove a dynamics group without a computed output parameter fails validation. | AC-PHYS-002, SC-DYN-003 | `createDynamicsGroup`, `bindDynamicsDriver`, `validatePackage` | validation=`dynamics.outputMissing`; snapshot=`none`; diff=`none`; runtimeState=`none` | Validator check registry. | auto | mvp-blocking | `validator-core` |
| `invalid-dynamics-cycle` | `invalid`, `dynamics` | Prove computed outputs cannot be drivers and group dependencies are prohibited. | AC-PHYS-002, SC-DYN-003 | `createDynamicsGroup`, `bindDynamicsDriver`, `bindDynamicsOutput`, `validatePackage` | validation=`dynamics.outputUsedAsDriver|dynamics.groupCycle`; snapshot=`none`; diff=`none`; runtimeState=`none` | Validator check registry and dynamics dependency rules. | auto | mvp-blocking | `validator-core` |
| `invalid-dynamics-output-target-duplicate` | `invalid`, `dynamics` | Prove two groups cannot target the same computed output parameter. | AC-PHYS-001, AC-PHYS-002, SC-DYN-003 | `createDynamicsGroup`, `bindDynamicsOutput`, `validatePackage` | validation=`dynamics.outputTargetDuplicate`; snapshot=`none`; diff=`none`; runtimeState=`none` | Validator check registry and package dynamics invariants. | auto | mvp-blocking | `validator-core` |
| `invalid-mesh-triangle` | `invalid` | Prove out-of-range or degenerate mesh triangles block invalid geometry. | AC-MVP-005, AC-MESH-004, SC-MESH-002, SC-VALIDATOR-002 | `generateMesh`, `validatePackage` | validation=`mesh.triangleIndexOutOfRange`; snapshot=`none-or-blocking`; diff=`none`; runtimeState=`none` | Mesh semantic validation. | auto | mvp-blocking | `validator-core` |
| `invalid-missing-texture` | `invalid` | Prove visible drawable missing texture fails package/reference validation. | AC-MVP-004, AC-VALIDATOR-002, SC-VALIDATOR-001 | `createDrawable`, `validatePackage` | validation=`ref.drawableTextureMissing`; snapshot=`none`; diff=`none`; runtimeState=`none` | Package reference validation. | auto | mvp-blocking | `validator-core` |
| `invalid-rigControl-cycle` | `invalid` | Prove rig control hierarchy cycles block runtime evaluation. | AC-MVP-009, AC-DEF-004, AC-DEF-005, SC-DEF-002 | `bindRigControlChild`, `validatePackage` | validation=`rigControl.cycle`; snapshot=`none-or-blocking`; diff=`none`; runtimeState=`none` | Rig control graph acyclicity. | auto | mvp-blocking | `validator-core` |
| `invalid-mask-reference` | `invalid` | Prove missing mask source/target is reported and not silently ignored. | AC-MVP-007, AC-DRAW-004, SC-DRAW-002, SC-DEF-003 | `setMaskRelation`, `validatePackage`, `getRuntimeSnapshot` | validation=`mask.sourceMissing|mask.drawableMissing`; snapshot=`diagnostic`; diff=`none`; runtimeState=`none` | Mask reference validation and runtime mask diagnostics. | auto | mvp-blocking | `validator-core` |
| `wave27-composition-contract-fixtures` | `happy-path` | Prove semantic mask relation plus opacity evidence contract from operation through package, runtime snapshot/diff, validation, and Viewer-facing evidence. | AC-MVP-007, AC-MVP-012, AC-MVP-013, SC-MVP-003, SC-MVP-004 | `setMaskRelation`, `validatePackage`, `getRuntimeSnapshot`, `evaluateViewerRuntimeSnapshot` | operation=`expected/operation-result-evidence-summary.json`; package=`expected/package-materialization-summary.json`; snapshot=`expected/runtime-snapshot-summary.json`; diff=`expected/runtime-diff-summary.json`; validation=`expected/validation-report-summary.json`; viewerEvidence=`expected/viewer-facing-evidence-summary.json` | Project-defined semantic mask relation / opacity evidence; no pixel clipping or full renderer oracle. | auto | warning | `operation-core` |
| `wave28-part-texture-layer-contract-fixtures` | `happy-path`, `gui-evidence` | Prove semantic part hierarchy, drawable part reassignment, existing texture atlas assignment, runtime/viewer evidence, validator evidence, and editor layer-state evidence. | AC-MVP-004, AC-MVP-012, AC-MVP-013, SC-DRAW-001, SC-PART-001, SC-MVP-003, SC-MVP-004 | `createPart`, `updatePart`, `setDrawablePart`, `setDrawableTexture`, `validatePackage`, `getRuntimeSnapshot`, `evaluateViewerRuntimeSnapshot` | operation=`expected/operation-chain-summary.json`; package=`expected/package-materialization-summary.json`; runtimeViewerEvidence=`expected/runtime-viewer-evidence-summary.json`; validation=`expected/validation-report-summary.json`; editorLayerState=`expected/editor-layer-state-evidence-summary.json` | Project-defined semantic part / texture / layer evidence; no real image bytes, image decode, file picker, pixel oracle, or full renderer oracle. | auto | warning | `operation-core` |
| `wave29-mesh-edit-contract-fixtures` | `happy-path`, `invalid`, `gui-evidence` | Prove semantic mesh edit evidence for multi-vertex moveMeshVertex, package materialization, runtime/viewer mesh evidence, validator topology diagnostics, and editor selection state. | AC-MVP-005, AC-MVP-012, AC-MVP-013, SC-MESH-001, SC-MESH-002, SC-MVP-003, SC-MVP-004 | `createDrawable`, `generateMesh`, `moveMeshVertex`, `validatePackage`, `getRuntimeSnapshot`, `evaluateViewerRuntimeSnapshot` | operation=`expected/operation-chain-summary.json`; package=`expected/package-materialization-summary.json`; runtimeViewerEvidence=`expected/runtime-viewer-evidence-summary.json`; validation=`expected/validation-report-summary.json`; editorSelection=`expected/editor-selection-evidence-summary.json` | Project-defined semantic JSON mesh edit, runtime/viewer mesh, topology diagnostic, and editor selection evidence only. | auto | warning | `operation-core` |
| `wave30-tutorial-mini-model-contract-fixtures` | `happy-path`, `invalid`, `gui-evidence` | Prove rights-clean synthetic tutorial mini model readiness across operation recipe, package graph, runtime/viewer semantic evidence, validator readiness, and editor-state readiness evidence. | AC-MVP-004, AC-MVP-005, AC-MVP-007, AC-MVP-009, AC-MVP-010, AC-MVP-012, AC-MVP-013, AC-MVP-016, SC-MVP-001, SC-MVP-002, SC-MVP-003, SC-MVP-004, SC-MVP-006, SC-DRAW-001, SC-MESH-001, SC-DEF-002, SC-PARAM-002, SC-DYN-001 | `applyTutorialMiniModelRecipe`, `validateTutorialMiniModelReadiness`, `getRuntimeSnapshot`, `evaluateViewerRuntimeSnapshot` | operation=`expected/operation-chain-summary.json`; package=`expected/package-graph-summary.json`; runtimeViewerEvidence=`expected/runtime-viewer-evidence-summary.json`; validation=`expected/validation-readiness-summary.json`; editorReadiness=`expected/editor-state-readiness-evidence-summary.json` | Project-defined semantic tutorial readiness evidence only; no real asset bytes, image decode, file picker, full renderer, pixel oracle, texture sampling correctness, public sample distribution, external dependency, or Cubism compatibility oracle. | auto | warning | `operation-core` |
| `wave31-byte-sample-characterization` | `rights-provenance` | Prove `test_data/sample_model.psd` is a local byte-only input basis with deterministic byteLength, SHA-256 digest, declared media type fallback, and rights/provenance metadata for Wave31 byte-intake/e2e. | AC-MVP-002, AC-MVP-013, AC-IN-001, AC-IN-006, AC-RIGHTS-002, AC-SAMPLE-001, AC-SAMPLE-005, SC-SAMPLE-001 | `readLocalSampleFile`, `computeSha256`, `compareByteLength`, `applyMediaTypeFallback`, `validateRightsMetadata` | byteCharacterization=`expected/sample-model-byte-characterization-summary.json`; validation=`none`; snapshot=`none`; diff=`none` | Local sample byte-only fixture contract; byteLength, SHA-256, declared media type fallback, and rights/provenance metadata only. No PSD parser, header/layer semantics, image decode, raster extraction, texture materialization, public sample distribution, external dependency, or Cubism compatibility oracle. | auto | warning | `fixtures-contract-tests` |
| `keyform-grid-invalid` | `invalid` | Prove missing or duplicate two-axis grid coordinates fail strict evaluation. | AC-PARAM-005, AC-PARAM-007, SC-PARAM-004 | `addKeyformGrid2d`, `validatePackage`, `getRuntimeSnapshot` | validation=`keyform.grid2dMissingKey|keyform.grid2dDuplicateKey`; snapshot=`blocking-or-diagnostic`; diff=`none`; runtimeState=`none` | Keyform grid validator and runtime sampling diagnostics. | auto | mvp-blocking | `validator-core` |
| `keyform-missing-endpoint` | `invalid` | Prove one-axis interpolation endpoint omissions are visible and profile-gated. | AC-MVP-008, AC-PARAM-003, SC-PARAM-007 | `addKeyform`, `validatePackage` | validation=`keyform.missingEndpoint`; snapshot=`none`; diff=`none`; runtimeState=`none` | Validator profile behavior. | auto | warning | `validator-core` |
| `runtime-load-blocking` | `invalid` | Prove a normalized graph that cannot produce deterministic runtime output fails before viewer acceptance. | AC-MVP-012, AC-RUNTIME-001, AC-VALIDATOR-004, SC-RUNTIME-001, SC-VALIDATOR-002 | `loadPackage`, `getRuntimeSnapshot`, `validatePackage` | validation=`runtime.loadBlocking`; snapshot=`none`; diff=`none`; runtimeState=`none` | Runtime load contract and validator runtime-load phase. | auto | mvp-blocking | `runtime-core` |
| `rights-provenance-missing` | `invalid`, `rights-provenance` | Prove missing source provenance or blocked rights prevents MVP/demo acceptance. | AC-MVP-002, AC-RIGHTS-001, AC-RIGHTS-002, AC-SAMPLE-005, SC-IN-002, SC-HYGIENE-001 | `setRightsMetadata`, `validatePackage` | validation=`rights.provenanceMissing`; snapshot=`none`; diff=`validationDiff`; runtimeState=`none` | Rights/provenance metadata contract; no legal conclusion implied. | auto | mvp-blocking | `validator-core` |
| `script-generated-minimal` | `invalid`, `gui-evidence` | Prove script-only model generation is auxiliary and cannot satisfy MVP GUI authoring. | AC-MVP-001, AC-MVP-016, SC-MVP-006, SC-WF-001 | `loadPackage`, `validatePackage` | validation=`evidence.guiOperationLogMissing`; snapshot=`summary-optional`; diff=`none`; runtimeState=`none`; operationLog=`missing` | Acceptance evidence policy requiring GUI operation log. | auto | mvp-blocking | `acceptance-runner` |
| `gui-hit-test-rigControl` | `gui-evidence`, `ai` | Prove semantic hit-test returns stable rig control IDs and operation targets. | AC-MVP-014, AC-AI-002, SC-AI-002, SC-AGENT-002 | `getEditorState`, `getCanvasViewport`, `hitTestCanvas` | validation=`none`; snapshot=`none`; diff=`none`; runtimeState=`none`; guiEvidence=`hit-test-response` | Editor semantic state and hit-test contract. | auto | mvp-blocking | `editor-ui` |
| `ai-screenshot-rigControl-parameter` | `ai`, `gui-evidence` | Prove screenshot-assisted AI uses semantic APIs before dry-running a rig control/keyform edit. | AC-MVP-014, AC-AI-002, AC-AGENT-002, SC-AI-002, SC-AGENT-002 | `getEditorState`, `hitTestCanvas`, `inspectTarget`, `dryRunOperation`, `validatePackage` | validation=`aiDryRun-report`; snapshot=`targeted`; diff=`modelDiff+runtimeDiff+validationDiff`; runtimeState=`none`; aiTranscript=`command-sequence`; guiEvidence=`semantic-target` | AI command contract and semantic target selection. | hybrid | mvp-blocking | `ai-interface` |
| `ai-invalid-mutation` | `ai`, `invalid` | Prove AI dry-run that mutates package state is detected as blocking. | AC-MVP-014, AC-AI-003, AC-AGENT-002, SC-AI-002, SC-AGENT-002 | `dryRunOperation`, `validatePackage` | validation=`ai.dryRunMutatedPackage`; snapshot=`none`; diff=`modelDiff+validationDiff`; runtimeState=`none`; aiTranscript=`dry-run` | Package revision must not change during dry-run. | auto | mvp-blocking | `ai-interface` |
| `out-of-range-parameter-dry-run` | `ai`, `invalid` | Prove out-of-range parameter input clamps/warns without committing the package. | AC-MVP-012, AC-MVP-014, SC-AGENT-002, SC-RUNTIME-002 | `dryRunOperation`, `getRuntimeSnapshot`, `validatePackage` | validation=`runtime.parameterClamped`; snapshot=`targeted`; diff=`runtimeDiff+validationDiff`; runtimeState=`expected-next-optional`; aiTranscript=`dry-run` | Runtime parameter clamp policy and dry-run no-commit boundary. | auto | mvp-blocking | `operation-core` |
| `ai-repair-dry-run` | `ai` | Prove AI repair proposal returns candidate, diffs, provenance, and revalidation steps without commit. | AC-MVP-014, AC-AI-003, AC-AI-004, AC-AI-007, AC-AGENT-002, AC-AGENT-005, SC-AI-002, SC-AGENT-002 | `validatePackage`, `createRepairCandidate`, `dryRunOperation`, `getDiff`, `rerunValidation` | validation=`baseline+aiDryRun`; snapshot=`targeted-if-runtime-visible`; diff=`modelDiff+runtimeDiff+validationDiff`; runtimeState=`none`; aiTranscript=`repair-flow` | AI approval boundary, repair candidate schema, diff contracts. | auto | mvp-blocking | `ai-interface` |
| `demo-safe-dynamics-capture` | `demo-safe`, `dynamics`, `rights-provenance` | Prove secondary motion demo capture uses rights-clean assets and hides unsafe/internal implementation details. | AC-MVP-015, AC-PHYS-006, AC-RIGHTS-001, AC-RIGHTS-002, AC-RIGHTS-005, SC-DYN-004, SC-HYGIENE-001 | `validatePackage`, `runDynamicsPreviewSequence`, `runDemoPreflight` | validation=`demoSafe-pass`; snapshot=`targeted-capture`; diff=`none`; runtimeState=`demo-initial+final`; runtimeStateSequence=`demo-expected`; demoPreflight=`allowed` | Demo-safe preflight, rights metadata, and high-level viewer capture state. | hybrid | mvp-blocking | `viewer-ui` |
| `demo-safe-viewer-capture` | `demo-safe`, `rights-provenance` | Prove private viewer capture exposes only allowed scene, disclaimer, and high-level controls. | AC-MVP-015, AC-RIGHTS-004, SC-MVP-005, SC-HYGIENE-001 | `runDemoPreflight`, `getRuntimeSnapshot` | validation=`demoSafe-pass`; snapshot=`summary`; diff=`none`; runtimeState=`none`; demoPreflight=`allowed-capture-state` | Demo capture surface policy and structured capture state. | hybrid | mvp-blocking | `viewer-ui` |
| `demo-unsafe-forbidden-term` | `demo-safe`, `invalid` | Prove demo preflight detects prohibited vendor/format/compatibility wording on public-facing surfaces. | AC-MVP-015, AC-MVP-016, AC-RIGHTS-003, AC-RIGHTS-004, SC-HYGIENE-001, SC-HYGIENE-002 | `runDemoPreflight`, `validatePackage` | validation=`unsafe-term-diagnostics`; snapshot=`none`; diff=`none`; runtimeState=`none`; demoPreflight=`blocked` | Forbidden surface scan by surface classification; not an external runtime oracle. | auto | mvp-blocking | `validator-core` |
| `unsupported-input-boundary` | `invalid`, `guardrail` | Prove unsupported proprietary/runtime input paths are rejected without load, inspect, convert, or migration behavior. | AC-MVP-016, AC-IN-004, AC-IN-005, AC-EXPORT-006, SC-MVP-006, SC-IN-004 | `attemptUnsupportedImport`, `validatePackage`, `assertNoLoadInspectConvertPath` | validation=`unsupported-input-boundary`; demoPreflight=`nondependency-scan`; snapshot=`none`; runtimeState=`none` | Project-defined input boundary and nondependency guardrail. | auto | mvp-blocking | `validator-core` |
| `demo-safe-preflight` | `demo-safe`, `rights-provenance` | Prove demo-safe preflight produces allow-list, redaction, rights visibility, and blocked-field evidence. | AC-MVP-015, AC-RIGHTS-004, AC-RIGHTS-005, SC-MVP-005, SC-WF-002, SC-HYGIENE-001 | `runDemoSafePreflight`, `scanCaptureSurface`, `redactInternalFields`, `writeCaptureAllowList` | validation=`demoSafe-pass`; demoPreflight=`report+redacted-fields+allowed-capture-state` | Demo-safe preflight policy and capture allow-list. | hybrid | mvp-blocking | `validator-core` |
| `proposal-boundary-review` | `demo-safe`, `guardrail` | Prove proposal and future-public materials stay separate from private implementation and avoid compatibility or internal-schema claims. | AC-MVP-015, AC-MVP-016, SC-HYGIENE-002, SC-HYGIENE-003 | `classifyArtifactTrack`, `scanForImplementationClaims`, `verifyFutureSubsetSeparation` | validation=`proposal-boundary-review`; demoPreflight=`hygiene-boundary-report`; snapshot=`none` | Track classification and demo/proposal hygiene policy. | manual | warning | `validator-core` |
| `discussion-doc-baseline` | `guardrail` | Prove discussion docs restore the current Private Prototype baseline and source paths. | AC-MVP-016, AC-DOC-001, AC-DOC-002, SC-DOC-001, SC-DOC-002 | `readDiscussionMap`, `readConcept`, `readMvpAc`, `assertPrivatePrototypeBaseline` | validation=`discussion-doc-baseline`; demoPreflight=`source-baseline-report`; snapshot=`none` | Discussion source map and private baseline policy. | auto | warning | `fixtures-contract-tests` |
| `nondependency-guardrail-scan` | `guardrail`, `demo-safe` | Prove MVP evidence has no forbidden dependency or oracle on proprietary formats, SDK/Core, viewer matching, physics compatibility, or existing third-party models. | AC-MVP-016, AC-IN-004, AC-EXPORT-006, AC-RIGHTS-003, SC-MVP-006, SC-WF-002, SC-IN-004 | `scanPackageManifest`, `scanFixtureMetadata`, `scanDemoSurface`, `assertNoForbiddenOracle` | validation=`nondependency-guardrail-scan`; demoPreflight=`nondependency-scan`; snapshot=`none` | Nondependency guardrail and fixture metadata scan. | auto | mvp-blocking | `validator-core` |
| `traceability-lint` | `guardrail` | Prove P0/P1 traceability rows are complete, all MVP AC and active scenarios are mapped, and machine-readable IDs contain no spaces. | AC-MVP-013, AC-MVP-014, SC-VERIFY-001, SC-AGENT-001 | `readTraceabilityJson`, `verifyMvpAcCoverage`, `verifyScenarioCoverage`, `verifyModuleSurfaceCoverage`, `verifyNoSpaceIds` | validation=`traceability-lint`; demoPreflight=`traceability-lint-report`; snapshot=`none` | Traceability completeness and ID policy. | auto | mvp-blocking | `fixtures-contract-tests` |

## RuntimeStateSequenceArtifact Exact Replay Requirements

Exact deterministic replay fixtures are `minimal-dynamics-hairSway`, `dynamics-reset-determinism`, `dynamics-fixed-step-replay`, and `demo-safe-dynamics-capture`.

Required sequence semantics:

- `states[0]` is the initial `RuntimeStateDto` before any frame is evaluated.
- For frame `i`, `states[i+1]` is the post-frame `RuntimeStateDto` after evaluating `RuntimeSequenceFrameDto` frame `i`.
- `frameCount` equals the number of evaluated frames.
- `states.length = frameCount + 1`.
- A mismatch emits `runtime.stateSequenceLengthMismatch` and the artifact is not exact deterministic replay evidence.

Required exact replay fields:

- `packageHash`.
- `inputFramesHash`.
- `runtimeEvaluationContext`.
- `evaluatorVersionSummary`.
- `fixedStepMs`.
- `frameCount`.
- Full `states[]`.

Full sequence comparison passes only when:

- `packageHash` matches.
- `inputFramesHash` matches.
- `runtimeEvaluationContext` matches.
- `evaluatorVersionSummary` matches.
- `fixedStepMs` matches.
- `frameCount` and `states.length` match.
- Every `states[i]` is equal or epsilon-equivalent under the declared policy.
- No `runtime.stateSequenceLengthMismatch` diagnostic is present.

Final-state-only comparison is a smoke test and must not be labeled exact deterministic replay evidence.

## Oracle Policy

Allowed oracles:

- Project-defined Zod/DTO schemas and module contracts.
- Package reference and semantic validation rules.
- Runtime evaluator contract, including `scalarDampedFollowV1` and epsilon policy.
- Validator check registry and profile behavior.
- GUI semantic state, operation log, and operation-core diffs.
- Rights/provenance metadata and demo-safe preflight rules.

Disallowed oracles:

- Cubism format files or existing Cubism/Live2D models.
- Cubism SDK/Core or viewer matching.
- Cubism Physics compatibility or external solver behavior.
- Third-party model visual behavior or commercial art quality comparison.
