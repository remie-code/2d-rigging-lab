# Expected Artifacts Policy

> Status: Draft P0 test design artifact.
> Applies to: [../fixtures/fixture-manifest.md](../fixtures/fixture-manifest.md) and [../fixtures/fixture-manifest.json](../fixtures/fixture-manifest.json).

## Purpose

Expected artifacts are the evidence that a fixture satisfies an AC/scenario. They are not implementation code and they are not replacement model source. A fixture passes only when the required expected artifacts exist, parse against the relevant contract, and compare according to the policy below.

## Artifact Families

| Artifact | Required for | Primary owner | Comparison |
|---|---|---|---|
| `OperationLogArtifact` | GUI authoring, operation-core commits, AI approval boundary | `operation-core` | `jsonl-sequence` with deterministic operation ordering |
| `ValidationReportArtifact` | validator, acceptance runner, AI-readable reports, invalid fixtures | `validator-core` | `semantic-json` over check IDs, target refs, severity, status, evidence refs |
| `RuntimeSnapshotArtifact` | runtime/viewer/preview evidence | `runtime-core` | `snapshot-epsilon` by detail level |
| `RuntimeStateArtifact` | single initial, next, final, or reset state evidence | `runtime-core` | `semantic-json` plus numeric epsilon |
| `RuntimeStateSequenceArtifact` | exact deterministic replay and Dynamics acceptance | `runtime-core` | full sequence comparison |
| `ModelDiffArtifact` | operation and AI model changes | `operation-core` | `semantic-json` over target refs and field changes |
| `RuntimeDiffArtifact` | runtime-impacting operation and Dynamics comparisons | `runtime-core` | `snapshot-epsilon` plus `dynamicsChanges` checks |
| `ValidationDiffArtifact` | AI dry-run, repair, and revalidation evidence | `validator-core` | `semantic-json` over new/resolved failures and severity changes |
| `GuiEvidenceArtifact` | GUI semantic state, hit-test, supplemental GUI evidence | `editor-ui` | `semantic-json`; screenshots are supplemental |
| `AiCommandTranscriptArtifact` | AI observe/dry-run/diff/repair flows | `ai-interface` | ordered request/response sequence |
| `DemoPreflightArtifact` | demo-safe and unsafe-surface checks | `validator-core` | `semantic-json` over allowed/blocked fields |
| `RightsProvenanceArtifact` | source rights, provenance, display and redistribution flags | `package-format` | `semantic-json`; no legal conclusion implied |

## Required Artifact Rules

### Operation Log

`operations/log.jsonl` is required for any MVP candidate claiming GUI authoring. It must contain committed entries with:

- `operationId`
- `transactionId`
- `timestamp`
- `actor`
- `surface`
- `operationType`
- `targetIds`
- `payload`
- `result`
- `provenanceId`
- `validationReportIds`
- `runtimeSnapshotIds`
- `reversible`

For GUI fixtures, at least one relevant committed entry must have `surface="gui"`. Playwright trace, screenshot, video, or raw pointer samples can supplement the log but cannot replace it.

### Validation Report

Expected validation reports must compare:

- `schemaVersion`
- `reportId` shape, not literal generated ID unless the fixture marks it stable
- `profile`
- `summary.status`
- `summary.highestSeverity`
- required `checks[].checkId`
- required `checks[].severity`
- required `checks[].status`
- required `checks[].target.kind`
- required target IDs or target paths when the fixture names an exact target
- `relatedAC`
- `relatedScenarios`
- `repairCandidateIds`
- linked `snapshotIds` and `operationIds`

Timestamps, generated report IDs, and ordering of unrelated checks are ignored unless the fixture explicitly marks them as part of the oracle.

### Runtime Snapshot

Runtime snapshots use detail-specific comparisons:

- `summary`: package identity, context, parameter values, draw list, bounds, vertex hashes, diagnostics.
- `targeted`: `summary` plus full data for target IDs and selected dynamics groups.
- `full`: all vertices, masks, rig control state, dynamics driver/output/state/diagnostics, and trace.

All numeric comparisons use the fixture's epsilon policy or the default runtime epsilon policy. Runtime snapshots must never be compared to external viewer output as an oracle.

### Runtime State

Single-state artifacts must be generated evidence under `runtime/states/*.runtime-state.json`. They must contain exactly one `RuntimeStateDto` and must not be treated as authored model source.

Required fields:

- `schemaVersion="runtime-state-v1"`
- `packageId`
- `packageRevision`
- `packageHash` when exact replay evidence is required
- `frameIndex`
- `fixedStepMs`
- `accumulatorMs`
- `dynamicsGroups`

For initial Dynamics state, each active group starts at current target with `velocity=0`, `tick=0`, and `resetCounter=1`.

### RuntimeStateSequenceArtifact Exact Replay

Exact deterministic replay requires `runtime/state-sequences/*.runtime-state-sequence.json` with:

- `schemaVersion="runtime-state-sequence-v1"`
- `packageId`
- `packageRevision`
- `packageHash`
- `fixedStepMs`
- `frameCount`
- `inputFramesHash`
- `runtimeEvaluationContext`
- `evaluatorVersionSummary`
- full `states[]`

Semantics:

- `states[0]` is the initial `RuntimeStateDto` before any frame is evaluated.
- For frame `i`, `states[i+1]` is the post-frame state after evaluating `RuntimeSequenceFrameDto` frame `i`.
- `states.length = frameCount + 1`.

`inputFramesHash` is `sha256(canonical-json(RuntimeSequenceFrameDto[]))`.

Canonical JSON for `inputFramesHash`:

- Sort object keys lexicographically.
- Preserve array order.
- Use the project-defined finite number serialization policy.
- Exclude timestamps, operation IDs, UI-only fields, and non-frame context fields.
- Do not include `runtimeEvaluationContext`.
- Do not include `evaluatorVersionSummary`.

Exact deterministic replay passes only when all compared artifacts have:

- the same `packageHash`
- the same `inputFramesHash`
- the same `runtimeEvaluationContext`
- the same `evaluatorVersionSummary`
- the same `fixedStepMs`
- the same `frameCount`
- the same `states.length`
- epsilon-equivalent `states[i]` for every `0 <= i <= frameCount`
- no `runtime.stateSequenceLengthMismatch`

Final-state-only comparison is a smoke test. It is not exact deterministic replay evidence.

### Diff Artifacts

Model, runtime, and validation diffs must use stable target refs and must not rely on textual JSON ordering.

Runtime diffs for Dynamics fixtures must include `dynamicsChanges` when a dynamics group state, output, tick, velocity, position, reset counter, or output parameter changes.

AI dry-run diffs must prove the base package revision was not committed or overwritten before approval.

### GUI Evidence

Required GUI evidence is semantic:

- editor semantic state
- selected target stable IDs
- active tool or panel
- hit-test result when target selection was visual
- operation ID created by a GUI surface
- supplemental evidence refs when screenshots, traces, or videos are captured

Screenshots can support manual review, but they are not the sole pass/fail oracle for target identity, GUI authoring, or operation correctness.

### AI Command Transcript

AI command transcripts must show ordered requests and responses for observe, inspect, dry-run, diff, validation, repair candidate, and approval boundary flows.

Required checks:

- Read-only commands do not mutate the package.
- `dryRunOperation` has `dryRun=true`.
- Dry-run returns model/runtime/validation diffs where relevant.
- Commit is absent unless an explicit approval step is represented.
- Repair suggestions include provenance and revalidation steps.
- AI does not claim rights/legal certainty from metadata alone.

### Demo Preflight

Demo preflight artifacts must classify:

- `allowedToCapture`
- unsafe terms or unsafe fields
- hidden fields
- redacted fields
- rights status
- third-party asset detection
- proprietary/vendor format surface detection
- internal schema visibility
- solver detail visibility
- recommended disclaimer

Demo-safe capture can use a runtime snapshot as structured visual evidence, but the preflight report is the gate.

### Rights and Provenance

Rights/provenance expected artifacts must verify:

- source asset ID
- creator
- license
- redistributionAllowed
- displayAllowed or equivalent demo display flag
- AI generation/editing flag
- content hash when available
- transform history
- source-to-texture/drawable/package traceability

The artifact can classify `cleared`, `needs_review`, or `blocked`, but it must not assert legal safety beyond recorded metadata.

## Gates

| Gate | Meaning |
|---|---|
| `mvp-blocking` | A failure blocks MVP acceptance for the related AC/scenario. |
| `warning` | A failure is reported but does not block MVP unless the active profile escalates it. |
| `manual-review` | Human review is required; structured artifacts still need to exist. |
| `optional` | Useful coverage but not required for P0 MVP acceptance. |

## Automation Levels

| Level | Meaning |
|---|---|
| `auto` | Fully checkable from structured artifacts. |
| `hybrid` | Structured artifacts gate the result; human review may check visual/readability suitability. |
| `manual` | Human review is the primary decision, with structured artifacts as supporting evidence. |

P0 fixtures should avoid `manual` unless no structured substitute exists.

## Golden Update Policy

- Expected validation reports update only with an approved validator check registry or profile behavior change.
- Runtime snapshots update only with an approved runtime evaluator version or epsilon policy change.
- Runtime state sequence artifacts update only with an approved `scalarDampedFollowV1`, timestep, reset, or state DTO semantic change.
- Operation logs update only with an approved operation schema or GUI operation mapping change.
- AI transcripts update only with an approved AI command contract change.
- Demo preflight reports update only with an approved demo-safe surface policy change.
- Rights/provenance expected artifacts update only with an approved rights/provenance schema or fixture metadata correction.

Each golden update must preserve related AC/SC links and note whether it changes behavior, schema, or only generated values.

## Oracle Boundaries

Allowed oracles:

- Project-defined package and contract DTO schemas.
- Module contract semantics in `discussion/design/module-contracts/`.
- Validator check registry and profile behavior.
- Runtime evaluator semantics, including `scalarDampedFollowV1`.
- Runtime epsilon and exact replay policy.
- Operation log and operation-core diff contracts.
- GUI semantic state and stable target IDs.
- Rights/provenance metadata and demo-safe preflight policy.

Disallowed oracles:

- Cubism formats, SDK/Core, runtime, viewer matching, physics compatibility, or existing Cubism/Live2D models.
- Third-party model visual behavior.
- Pixel-perfect screenshot comparison as the sole MVP pass/fail signal.
- AI claims that are not backed by report, diff, operation, runtime, or provenance artifacts.
