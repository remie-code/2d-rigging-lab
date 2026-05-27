# Acceptance Runner Design

> Status: Draft design for test evidence planning. This is not implementation code.

## Purpose

The Acceptance Runner sits above validator, runtime, operation, GUI evidence, AI evidence, and demo-safe checks. Its job is to decide whether the Private 2D Rigging Lab / Prototype MVP has enough evidence for each AC and scenario.

The runner does not replace module tests. It aggregates evidence from fixtures and module outputs into AC-level `pass`, `fail`, or `needs_review` results.

## Basis Separation

### Repository Facts

- MVP scope is Private Authoring-to-Viewer Prototype.
- Minimum Open Dynamics v1 is part of MVP.
- MVP evidence must cover GUI authoring, project-defined package save/reload, private runtime/viewer evaluation, validator report, AI dry-run/diff/repair suggestion, rights/provenance, and demo-safe capture.
- Validator profile IDs currently defined by contracts are `editorIncremental`, `viewer`, `strict`, `acceptance`, and `aiDryRun`.
- Runtime replay evidence uses `RuntimeSequenceFrameDto[]`, explicit `RuntimeEvaluationContextDto`, `RuntimeStateDto`, fixed timestep, and state-sequence artifacts where `states.length` equals `frameCount+1`.
- GUI screenshots are supplemental evidence only. `operations/log.jsonl` and semantic GUI evidence are the source of truth for GUI authoring evidence.

### Design Decisions

- The runner ingests machine-readable manifests and expected artifact references instead of treating prose Markdown as the runtime oracle.
- AC and scenario Markdown remain the human source of truth; runner manifests carry stable IDs, links, scope, gates, and evidence expectations derived from those documents.
- MVP acceptance runner statuses are limited to `pass`, `fail`, and `needs_review`.
- Optional, future, or out-of-MVP tracks are excluded from `mvp-acceptance` unless a separate profile explicitly includes them. Excluded items must not cause MVP failure.
- The runner must never use Cubism formats, SDK/Core behavior, viewer matching, physics compatibility, or existing Cubism models as an oracle.

### Assumptions

- A traceability matrix and fixture manifests will exist before implementation.
- Expected artifacts can be addressed by stable paths plus IDs/hashes.
- Runtime and validator modules can produce deterministic structured reports before the full UI is complete.

### Items Requiring Hands-on Verification

- Actual fixture repository paths.
- Exact comparator command or test harness.
- Final JSON schema names for runner manifests and result files.
- Whether visual review is recorded in the same result file or a linked review artifact.

## Responsibility

The Acceptance Runner is responsible for:

- ingesting acceptance profiles, traceability, fixture manifests, and expected artifact manifests;
- selecting AC/scenario/test/fixture rows for the active profile;
- executing or reading module evidence in a deterministic order;
- requiring GUI authoring evidence for MVP candidates;
- invoking validator with the `acceptance` profile for MVP evidence;
- invoking runtime sequence replay for dynamics evidence;
- consuming AI dry-run and diff artifacts without committing package mutations;
- consuming demo-safe and rights/provenance evidence;
- producing AC-level and scenario-level `pass`, `fail`, or `needs_review` results;
- writing an evidence bundle index that future agents can audit.

The runner is not responsible for:

- validating every package field itself;
- evaluating runtime semantics itself;
- making legal rights judgments beyond recorded metadata gates;
- judging commercial visual quality automatically;
- parsing or loading external proprietary model formats;
- comparing output against external viewers or existing external models.

## Inputs

| Input | Purpose | Required for `mvp-acceptance` |
|---|---|---|
| Acceptance profile | Selects gate set, fixture set, and strictness | Yes |
| Traceability matrix | Maps AC IDs to scenario IDs, test IDs, fixtures, expected artifacts, and gates | Yes |
| Fixture manifest | Defines fixture ID, input artifacts, expected artifacts, related AC/scenario IDs, update rule | Yes |
| Expected artifact manifest | Defines expected reports, snapshots, diffs, GUI evidence, AI transcripts, and demo preflight outputs | Yes |
| Project-defined package | Package under test | Yes |
| Operation log | GUI and AI operation evidence | Yes for GUI-authored MVP candidates |
| GUI evidence | Semantic screen/panel/selection/hit-test state linked to operations | Yes for GUI flows |
| Validation report | Validator output, normally `profile=acceptance` | Yes |
| Runtime snapshots | Summary, targeted, or full runtime evidence | Yes when runtime-visible |
| Runtime state sequence | Exact replay evidence for dynamics sequence tests | Yes for strict dynamics fixtures |
| Diff artifacts | Model/runtime/validation diffs for operations and AI dry-runs | Yes when operation or AI evidence is required |
| AI transcript | AI request/response, dry-run operation result, repair candidate provenance | Yes for AI ACs |
| Demo preflight report | Demo-safe capture and redaction evidence | Yes for demo-safe ACs |
| Rights/provenance metadata | Source, license, author, AI-use, display and reuse flags | Yes |

## Manifest Ingestion

The runner should ingest a normalized manifest set:

| Manifest section | Required fields |
|---|---|
| Run metadata | `runId`, `profileId`, `createdAt`, `runnerVersion`, `repoRevision` |
| Scope | included AC IDs, included scenario IDs, excluded future/optional IDs, rationale |
| Test rows | `testId`, `acIds`, `scenarioIds`, `fixtureId`, `automationLevel`, `gate`, `ownerModule` |
| Fixture refs | fixture manifest path, package path, operation log path, source artifact refs |
| Expected evidence | expected artifact refs with kind, path, ID, comparison mode, required/optional |
| Gate policy | gate IDs, severity/status mapping, missing-evidence behavior |
| Comparator policy | semantic JSON, JSONL sequence, snapshot epsilon, state sequence replay |

Manifest validation gates:

- every machine-readable ID must be non-empty and contain no spaces;
- every included AC/scenario/test/fixture ID must resolve exactly once;
- every required artifact ref must exist or be reported as `missingEvidence`;
- future or optional domain items must be explicitly out of scope for `mvp-acceptance`;
- forbidden external-format or SDK/Core dependencies must not appear as package inputs, fixtures, implementation dependencies, or oracle references.

## AC and Scenario Aggregation

The runner builds this graph:

```text
AC -> scenario -> test -> fixture -> operation flow -> expected artifacts -> observed artifacts -> gates -> result
```

Aggregation rules:

- A scenario is `fail` if any MVP-blocking required gate fails or required evidence is missing.
- A scenario is `needs_review` if blocking gates pass but manual review, warning escalation, rights ambiguity, visual review, or demo-safe review remains open.
- A scenario is `pass` only if every required gate passes and no required review remains.
- An AC is `fail` if any required scenario for that AC fails.
- An AC is `needs_review` if no required scenario fails but at least one required scenario needs review.
- An AC is `pass` if all required scenarios pass.
- Optional/future scenarios are reported under scope notes, not folded into MVP status.

## Execution Order

The default `mvp-acceptance` order is:

1. Manifest integrity and scope gate.
2. Rights/provenance fixture gate.
3. GUI authoring evidence gate.
4. Operation log and diff gate.
5. Package schema and reference gate through validator.
6. Runtime load and snapshot gate.
7. Dynamics deterministic sequence gate where applicable.
8. AI dry-run, diff, repair suggestion, and approval-boundary gate.
9. Demo-safe preflight gate.
10. Manual visual review gate, when required by the fixture.
11. AC/scenario rollup.

This order prevents later runtime or demo claims from masking missing GUI, rights, or package evidence.

## Status Semantics

| Status | Meaning |
|---|---|
| `pass` | Required evidence exists, required comparisons pass, no blocking diagnostics, no required manual review remains. |
| `fail` | Required evidence is missing, a blocking gate fails, acceptance validator status fails, AI dry-run mutates package, dynamics replay evidence is incomplete, or forbidden oracle/dependency appears. |
| `needs_review` | Structured evidence is present but requires human judgment, rights clarification, visual review, warning escalation, or demo-safe wording review. |

The runner may preserve validator check statuses such as `warning` or `not_applicable` in linked details, but runner-level AC/scenario statuses stay limited to `pass`, `fail`, and `needs_review`.

## Evidence Bundle Shape

The runner writes one bundle index per run. It should be compact enough to audit without embedding full artifacts.

| Field | Description |
|---|---|
| `schemaVersion` | Expected value such as `acceptance-evidence-bundle-v1`. |
| `bundleId` | Stable ID for the bundle. No spaces. |
| `runId` | Runner execution ID. No spaces. |
| `profileId` | Example: `mvp-acceptance`, `demo-safe`, or `strict-determinism`. |
| `scope` | Included/excluded AC and scenario IDs with reasons. |
| `inputs` | Manifest paths, fixture IDs, package refs, operation log refs. |
| `artifacts` | Array of artifact refs with kind, path, ID, hash, comparison mode, producer, related AC/scenario/test IDs. |
| `gates` | Gate results with status, blocking failures, warnings, and linked artifact IDs. |
| `scenarioResults` | Scenario status, fixture/test coverage, evidence refs, missing evidence, manual review flag. |
| `acResults` | AC status, related scenarios, blocking failures, missing evidence, review notes. |
| `summary` | Counts by status and highest blocking reason. |

Artifact kinds:

- `package`
- `operationLog`
- `guiEvidence`
- `validationReport`
- `runtimeSnapshot`
- `runtimeState`
- `runtimeStateSequence`
- `modelDiff`
- `runtimeDiff`
- `validationDiff`
- `aiCommandTranscript`
- `repairCandidate`
- `demoPreflightReport`
- `rightsProvenance`
- `visualCapture`
- `visualReview`

For each artifact, record:

- path or URI relative to the repository;
- producer module;
- content hash when generated;
- schema version when available;
- comparison mode;
- related AC, scenario, test, fixture, operation, and snapshot IDs;
- demo-safe classification;
- whether it is required or supplemental.

## Gate Definitions

| Gate ID | Blocks MVP | Pass condition | Failure examples |
|---|---|---|---|
| `gate.manifestIntegrity` | Yes | All required IDs, refs, and scope entries resolve. | Missing fixture ref, duplicate test ID, ID contains spaces. |
| `gate.scopeGuardrail` | Yes | MVP scope excludes future/optional tracks and forbidden external or SDK/Core oracles. | Fixture uses external model package as oracle. |
| `gate.rightsProvenance` | Yes | Required source/provenance metadata exists and no blocked rights source is required. | `rights.provenanceMissing`, third-party asset without permission. |
| `gate.guiAuthoringEvidence` | Yes | GUI operation log exists and covers required authoring path. | `evidence.guiOperationLogMissing`, script-only package as MVP candidate. |
| `gate.operationLifecycle` | Yes | Dry-run does not commit; commit logs operation and revision; diffs are present. | Package revision changes during AI dry-run. |
| `gate.validatorAcceptance` | Yes | `profile=acceptance` report has no blocking/error status for required checks. | Missing texture, invalid mesh, unresolved mask source. |
| `gate.runtimeSnapshot` | Yes | Runtime produces non-empty draw list and required summary/target/full snapshot. | `runtime.drawListEmpty`, `runtime.loadBlocking`. |
| `gate.dynamicsReplay` | Yes when fixture requires Dynamics | Same package/input/context/version/timestep produces expected state and snapshot sequence. | `runtime.stateSequenceLengthMismatch`, `dynamics.nonDeterministicSnapshot`. |
| `gate.aiDryRunSafety` | Yes when AI evidence is required | AI returns dry-run, diffs, repair candidate, provenance, and approval requirement without mutation. | `ai.dryRunMutatedPackage`. |
| `gate.demoSafe` | Yes for demo-safe ACs | Preflight allows capture or reports only reviewable warnings. | Internal schema, source paths, forbidden dependency claims, solver internals exposed. |
| `gate.visualReview` | No by default | Required visual review artifact exists when marked required. | Missing review creates `needs_review`, not automatic `fail` unless fixture marks it blocking. |

## Dynamics Acceptance Rules

Dynamics acceptance uses structured replay, not image matching.

Required evidence for exact replay:

- initial `RuntimeStateDto`;
- canonical `RuntimeSequenceFrameDto[]`;
- `inputFramesHash`;
- explicit `RuntimeEvaluationContextDto`;
- evaluator version summary;
- `fixedStepMs`;
- expected `RuntimeStateSequenceArtifact`;
- expected targeted or full `RuntimeSnapshotDto` sequence;
- no `runtime.stateSequenceLengthMismatch`;
- epsilon-equivalent state and snapshot values for every frame.

Final-state-only comparison is a smoke test and must not be labeled exact deterministic replay evidence.

## Demo-safe and Rights Integration

The runner treats rights and demo-safe evidence as first-class gates, not optional notes.

Rights/provenance evidence must connect source assets through generated package artifacts and any AI-edited outputs. Demo-safe evidence must verify that capture output does not expose code, internal schema, private file paths, forbidden dependency claims, solver internals, or blocked third-party asset information.

Demo-safe screenshots or video captures are allowed only as supplemental evidence. The gate relies on the demo preflight report plus semantic capture state.

## AI Evidence Integration

AI evidence must demonstrate safe boundaries:

- AI reads structure, validation report, runtime snapshot, and diffs.
- AI produces dry-run operation requests and repair suggestions.
- AI dry-run does not mutate package files or append committed operation log entries.
- Commit requires human approval and a normal operation log entry.
- Repair candidates include source report IDs, problem check IDs, target IDs, expected diffs, risk, approval requirement, and provenance.

The runner fails AI evidence if the package revision mutates during dry-run, target IDs are ambiguous, approval is missing for commit, or the AI proposes out-of-scope automatic rig completion as MVP evidence.

## Result Acceptance Criteria

An implementation of this design is acceptable when:

- it can read a manifest set without parsing prose as oracle;
- it produces deterministic `pass`, `fail`, or `needs_review` rollups;
- missing required evidence is explicit;
- all artifact refs are traceable to AC and scenario IDs;
- GUI authoring evidence is required for MVP authoring claims;
- runtime/dynamics evidence uses structured snapshots and state sequences;
- AI evidence remains dry-run first and approval-bound;
- demo-safe and rights gates are visible in the result summary;
- no external proprietary format, SDK/Core behavior, viewer matching, physics compatibility, or existing model is used as an oracle.

## Risks

- If traceability manifests drift from AC/scenario prose, the runner may report false confidence. Contract review should be required for manifest updates.
- If GUI evidence is reduced to screenshots, MVP authoring may be incorrectly accepted. Operation logs and semantic GUI evidence must stay mandatory.
- If visual review is made blocking too early, MVP acceptance may become subjective. Initial runner behavior should prefer `needs_review` unless a fixture explicitly marks visual review blocking.
- If dynamics evidence omits state sequence metadata, exact replay claims become unverifiable.
