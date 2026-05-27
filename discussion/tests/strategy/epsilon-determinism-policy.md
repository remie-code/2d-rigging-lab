# Epsilon and Determinism Policy

> P1 strategy for numeric comparison, canonical hashes, and exact replay classification.

## 1. Purpose

This policy defines how runtime, Dynamics, snapshot, RuntimeState, and expected artifact comparisons tolerate floating-point differences without hiding nondeterminism.

It supports `strict-determinism`, `contract`, and `mvp-acceptance` profiles. It also defines the boundary between exact deterministic replay and smoke tests.

## 2. Basis Separation

### Official Facts

No external official facts are used as the source of truth for this policy.

### Repository Facts

- Runtime snapshots already define default vertex, bounds, opacity, and hash precision values.
- `inputFramesHash` is `sha256(canonical-json(RuntimeSequenceFrameDto[]))`.
- `RuntimeEvaluationContextDto` and `evaluatorVersionSummary` are separate evidence fields.
- Exact Dynamics replay requires full `RuntimeStateSequenceArtifact` comparison.
- Snapshot and RuntimeState artifacts must exclude nondeterministic fields from semantic hashes.

### Design Decisions

- Epsilon applies only to approved numeric fields.
- Stable IDs, enum values, check IDs, target kinds, fixture IDs, test IDs, hash strings, package identity, frame index, tick, and resetCounter compare exactly.
- `fixedStepMs` compares exactly for exact replay. A different timestep is a different replay, not an epsilon difference.
- Snapshot hashes are evidence and fast comparison aids; they do not replace required semantic comparison when a test claims exact replay.
- Final-state-only checks are smoke tests.

### Assumptions

- Canonical JSON serialization will be implemented consistently across test runners.
- Numeric expected artifacts are generated from the same `scalarDampedFollowV1` oracle and evaluator version declared in the fixture.
- Runtime and validator tests can choose `summary`, `targeted`, or `full` snapshot detail, but exact Dynamics replay still needs the full RuntimeState sequence.

### Experiment Results

No numeric experiments were performed while writing this policy.

### Risks

- Too-wide epsilon can hide solver regressions.
- Too-strict text equality can fail stable behavior because of harmless floating serialization differences.
- Hash-only comparison can hide which field regressed.
- Cross-platform floating behavior must be verified once implementation exists.

### Requires Hands-On Verification

- Final finite number serialization format.
- Actual hash values for fixtures.
- Cross-platform replay on the supported CI/runtime matrix.
- Whether the chosen Dynamics numeric epsilon needs tightening after first fixture generation.

## 3. Default Epsilon Values

| Field family | Default epsilon | Notes |
|--------------|-----------------|-------|
| `vertexPositionEpsilon` | `0.0001` canvas units | Runtime contract default |
| `boundsEpsilon` | `0.0001` canvas units | Runtime contract default |
| `opacityEpsilon` | `0.000001` | Runtime contract default |
| `scalarParameterEpsilon` | `0.000001` | authored/computed/effective parameter numeric comparison |
| `dynamicsStateEpsilon` | `0.000001` | position, velocity, rawTarget, clampedTarget, output value |
| `accumulatorMsEpsilon` | `0.000001` ms | accumulator comparison only |
| `hashPrecisionDecimals` | `5` | round vertex positions before vertex hash |

Fixtures may tighten epsilon. Fixtures may loosen epsilon only when the reason is recorded in the fixture manifest or golden update record.

## 4. Exact Fields

These fields compare exactly in strict and acceptance profiles:

- schemaVersion;
- packageId;
- packageRevision;
- packageHash when present;
- fixture ID;
- test ID;
- AC and scenario IDs;
- frameIndex;
- frameCount;
- `states.length`;
- `fixedStepMs`;
- dynamics group IDs;
- parameter IDs;
- outputParameterId;
- solverKind;
- evaluatorVersionSummary;
- runtimeEvaluationContext;
- check IDs;
- severity and status;
- tick;
- resetCounter;
- resetReasons order;
- draw list order;
- machine-readable target kind and target ID values.

Machine-readable identifiers must not contain spaces.

## 5. Epsilon Fields

These numeric fields may compare with epsilon:

- authored parameter numeric values;
- computed parameter numeric values;
- effective parameter numeric values;
- dynamics position;
- dynamics velocity;
- dynamics rawTarget;
- dynamics clampedTarget;
- dynamics output value;
- RuntimeState `accumulatorMs`;
- drawable bounds;
- vertices in `full` snapshots;
- opacity.

Integer counters and IDs never use epsilon.

## 6. Canonical JSON Policy

Canonical JSON for hashes uses:

- lexicographically sorted object keys;
- preserved array order;
- project-defined finite number serialization;
- no timestamps;
- no local file paths;
- no operation wall-clock IDs;
- no UI-only transient fields;
- no source surface fields inside `inputFramesHash`;
- no evaluator version fields inside `inputFramesHash`.

`RuntimeEvaluationContextDto` is stored separately as `runtimeEvaluationContext`. Evaluator and solver versions are stored separately as `evaluatorVersionSummary`.

## 7. Hash Policy

| Hash | Input | Purpose |
|------|-------|---------|
| `packageHash` | Canonical project-defined model package content | Proves replay uses the same package graph |
| `inputFramesHash` | Canonical `RuntimeSequenceFrameDto[]` only | Proves frame-local input sequence |
| `snapshotSemanticHash` | Canonical deterministic snapshot fields after applying precision policy | Fast evidence for snapshot equality |
| `runtimeStateSequenceHash` | Canonical `RuntimeStateSequenceArtifact` evidence fields and states | Fast evidence for replay equality |
| `vertexHash` | Rounded full vertex positions using `hashPrecisionDecimals` | Summary/targeted snapshot comparison |

Snapshot semantic hashes exclude:

- `snapshotId`;
- `createdAt`;
- local file paths;
- UI hover/selection/transient panel state;
- trace timing;
- operation wall-clock IDs;
- nondeterministic ordering not part of runtime semantics.

Snapshot semantic hashes include:

- package identity;
- snapshot detail;
- evaluator versions;
- runtime context;
- parameter values;
- dynamics group state summaries;
- diagnostics;
- draw list;
- evaluated bounds;
- vertex hashes;
- masks;
- rig control state where present.

When a strict comparison hash mismatches, the test must produce a semantic diff. For exact replay, a matching hash is supporting evidence; the required oracle is still the semantic full RuntimeState sequence comparison.

## 8. RuntimeState Sequence Comparison

Exact `RuntimeStateSequenceArtifact` comparison requires:

- same `packageHash`, unless hashless replay is explicitly declared;
- same `inputFramesHash`;
- same `runtimeEvaluationContext`;
- same `evaluatorVersionSummary`;
- same `fixedStepMs`;
- same `frameCount`;
- `states.length = frameCount + 1`;
- same dynamics group key set in every state;
- exact `frameIndex` for every state;
- epsilon-equivalent `accumulatorMs`;
- epsilon-equivalent `position` and `velocity`;
- exact `tick`;
- exact `resetCounter`;
- no `runtime.stateSequenceLengthMismatch`.

State comparison starts at `states[0]`, not at the first post-frame state.

## 9. Snapshot Comparison

| Snapshot detail | Required comparison |
|-----------------|---------------------|
| `summary` | package identity, evaluator versions, context, parameter values, draw list, bounds, vertex hashes, diagnostics |
| `targeted` | `summary` plus full details for target IDs and selected dynamics groups |
| `full` | all vertices, masks, rig controls, dynamics driver/output/state/debug fields, diagnostics, and trace when present |

For Dynamics exact replay, snapshot comparison validates observed runtime output and diagnostics. It does not replace `RuntimeStateSequenceArtifact` comparison.

## 10. Exact Replay vs Smoke

Exact deterministic replay:

- uses explicit initial `RuntimeStateDto`;
- evaluates a declared `RuntimeSequenceFrameDto[]`;
- records `inputFramesHash`;
- records `runtimeEvaluationContext`;
- records `evaluatorVersionSummary`;
- records `fixedStepMs`;
- records package identity and preferably `packageHash`;
- compares full `RuntimeStateSequenceArtifact.states[]`;
- compares expected computed parameter sequence;
- compares expected snapshot sequence;
- fails on replay diagnostics.

Smoke test:

- may check only a final `RuntimeStateDto`;
- may check only a non-empty snapshot;
- may check only one frame;
- may check only summary snapshot fields;
- may omit `inputFramesHash`, context, or evaluator version evidence.

Smoke tests are useful for `dev-fast`, viewer load sanity, and early fixture scaffolding. They must not be labeled as exact deterministic replay, and they must not be the sole evidence for P0 Dynamics acceptance.

## 11. Profile Behavior

| Profile | Determinism behavior |
|---------|----------------------|
| `dev-fast` | Allows smoke tests and summary snapshots; reports missing exact evidence as non-blocking |
| `contract` | Requires DTO shape, hash field presence where declared, and semantic comparator behavior |
| `strict-determinism` | Requires exact replay comparison and semantic diffs on mismatch |
| `mvp-acceptance` | Requires exact replay for Dynamics P0 rows and fails incomplete evidence |
| `demo-safe` | Requires deterministic capture start state and forbids unsafe surface fields |

## 12. Golden Update Interaction

Golden updates for runtime snapshots, RuntimeState artifacts, RuntimeState sequence artifacts, and Dynamics expected sequences must record:

- changed test IDs;
- changed fixture IDs;
- old and new evaluatorVersionSummary;
- old and new epsilon policy if changed;
- old and new `inputFramesHash` if frame input changed;
- old and new `packageHash` if package content changed;
- whether the change is exact replay evidence or smoke evidence.

Final-state-only smoke goldens must not replace exact deterministic replay goldens.

## 13. Acceptance Criteria

This policy is satisfied when:

- every strict Dynamics fixture declares epsilon policy and hash policy;
- `inputFramesHash` is limited to `RuntimeSequenceFrameDto[]`;
- snapshot semantic hashes exclude nondeterministic fields;
- exact replay compares full RuntimeState sequences;
- smoke tests are clearly labeled;
- machine-readable IDs contain no spaces;
- comparisons produce field-level diffs when hashes mismatch.
