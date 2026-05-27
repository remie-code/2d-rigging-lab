# Dynamics Test Policy

> P0 policy for testing Minimum Open Dynamics v1 as deterministic secondary motion evidence.

## 1. Purpose

This policy fixes how Dynamics tests prove AC-MVP-010, AC-MVP-012, AC-MVP-013, AC-PHYS-001 through AC-PHYS-006, SC-BODY-003, and SC-DYN-001 through SC-DYN-004.

Minimum Open Dynamics v1 is parameter-driven deterministic secondary motion. Tests prove that authored driver parameters produce computed output parameters through project-defined `scalarDampedFollowV1` semantics, then feed ordinary keyform / rigControl / drawable runtime evaluation.

Dynamics tests must not use Cubism Physics behavior, Cubism Viewer matching, external solver matching, existing model behavior, or pixel-perfect visual matching as an oracle.

## 2. Basis Separation

### Official Facts

No external official facts are used as the source of truth for this policy.

### Repository Facts

- Minimum Open Dynamics v1 is Current MVP scope.
- MVP Dynamics is limited to `solverKind="scalarDampedFollowV1"`.
- Runtime Core has explicit state: previous `RuntimeStateDto` in, `RuntimeSnapshotDto` and next `RuntimeStateDto` out.
- `RuntimeSequenceFrameDto[]` is the frame-local input sequence for replay.
- `RuntimeStateSequenceArtifact.states[0]` is the initial state before the first frame.
- For frame `i`, `RuntimeStateSequenceArtifact.states[i + 1]` is the post-frame state after evaluating `frames[i]`.
- `states.length = frameCount + 1` is required; mismatch emits `runtime.stateSequenceLengthMismatch`.
- Machine-readable IDs must not contain spaces.

### Design Decisions

- P0 Dynamics acceptance requires exact deterministic replay evidence, not final-state-only evidence.
- The replay oracle is the project-defined `scalarDampedFollowV1` contract.
- A dynamics group has exactly one computedDynamics output parameter in MVP.
- Multiple drivers are combined by deterministic weighted sum in declaration order.
- Dynamics reads only authoredInput parameters and writes only computedDynamics parameters.
- Dynamics never writes mesh vertices, rigControl properties, drawable visibility, opacity, draw order, or mask state directly.

### Assumptions

- Fixture files will later live under an implementation-owned fixture path, but expected artifact names and comparison rules are fixed here.
- Runtime evaluator versioning is available as `evaluatorVersionSummary`.
- `packageHash` is available for exact replay fixtures unless a fixture explicitly declares hashless replay.

### Experiment Results

No hands-on runtime experiments were performed while writing this policy.

### Risks

- If fixture authors compare only final state, nondeterministic intermediate frames can pass incorrectly.
- If `inputFramesHash` includes context, timestamps, operation IDs, or UI-only fields, identical frame-local inputs can hash differently.
- If snapshot hashes replace semantic comparison, a hash implementation bug can hide a runtime regression.

### Requires Hands-On Verification

- Actual `scalarDampedFollowV1` numeric outputs for each fixture.
- Actual canonical JSON serialization for `inputFramesHash`.
- Actual snapshot and RuntimeState sequence hashes after fixture generation.

## 3. P0 Dynamics Evidence Rule

P0 Dynamics evidence requires all of:

- initial `RuntimeStateDto`;
- previous `RuntimeStateDto` for each evaluated frame;
- next `RuntimeStateDto` for each evaluated frame;
- `fixedStepMs`;
- `RuntimeSequenceFrameDto[]` input sequence;
- `inputFramesHash`;
- `runtimeEvaluationContext`;
- `evaluatorVersionSummary`;
- expected computed parameter sequence;
- expected `RuntimeSnapshotDto` sequence at `targeted` or `full` detail;
- full `RuntimeStateSequenceArtifact` comparison;
- validation report with no blocking Dynamics diagnostics.

The exact replay comparison must cover the full sequence from `states[0]` through `states[frameCount]`. Checking only `states[frameCount]` is a smoke test.

## 4. Required Artifact Shape

Each exact Dynamics fixture must provide or reference these artifacts:

| Artifact | Required content | Comparison |
|----------|------------------|------------|
| `runtime/states/initial.runtime-state.json` | Initial `RuntimeStateDto` with package identity, `fixedStepMs`, `accumulatorMs=0`, all dynamics groups, position at current target, velocity `0`, tick `0`, resetCounter `1` | semantic JSON |
| `runtime/state-sequences/expected.runtime-state-sequence.json` | `RuntimeStateSequenceArtifact` with `states[0]` initial and post-frame states through `states[frameCount]` | full sequence with epsilon |
| `runtime/dynamics-input-sequence.json` | Canonical `RuntimeSequenceFrameDto[]` used for replay | `inputFramesHash` |
| `runtime/expected-computed-parameters.json` | Frame-indexed computed parameter values such as `param_hairSway` | epsilon |
| `runtime/snapshots/expected.runtime-snapshot-sequence.json` | Frame-indexed targeted or full snapshots, including evaluated dynamics state and diagnostics | snapshot epsilon |
| `runtime/diffs/expected-dynamics-diff.json` | `dynamicsChanges` for state/output deltas where relevant | semantic JSON |
| `validation/expected-validation-report.json` | Expected Dynamics checks, severity, targets, evidence refs, and AC/scenario links | validation diagnostic |

`inputFramesHash` is `sha256(canonical-json(RuntimeSequenceFrameDto[]))`. It proves only frame-local input. `runtimeEvaluationContext` and `evaluatorVersionSummary` are separate evidence fields and must not be folded into `inputFramesHash`.

## 5. Exact Replay Pass Rule

Exact deterministic replay passes only when all conditions hold:

- `packageHash` matches, unless the fixture explicitly declares hashless replay.
- `inputFramesHash` matches.
- `runtimeEvaluationContext` matches.
- `evaluatorVersionSummary` matches.
- `fixedStepMs` matches exactly.
- `frameCount` matches.
- `states.length` matches and equals `frameCount + 1`.
- Every `states[i]` for `0 <= i <= frameCount` matches under the epsilon policy.
- The expected computed parameter sequence matches under epsilon.
- The snapshot sequence matches under the snapshot comparison policy.
- No `runtime.stateSequenceLengthMismatch`, `dynamics.nonDeterministicSnapshot`, `dynamics.nanState`, `dynamics.groupCycle`, or `dynamics.outputTargetDuplicate` diagnostic is present.

Final-state-only, single-frame-only, summary-snapshot-only, or non-empty-output-only checks are smoke tests. Smoke tests can support `dev-fast` and viewer sanity checks, but they cannot satisfy exact deterministic replay evidence for P0 acceptance.

## 6. P0 Test Rows

| Test ID | Fixture | Purpose | Oracle | Gate |
|---------|---------|---------|--------|------|
| `TC-DYN-001-GROUP-SCHEMA` | `minimal-dynamics-hairSway` | One group, authoredInput drivers, one computedDynamics output, valid reset policy | `validationDiagnostic` | `mvp-blocking` |
| `TC-DYN-002-HAIRSWAY-SEQUENCE` | `minimal-dynamics-hairSway` | `faceYaw` input sequence produces delayed `hairSway` computed output | `runtimeStateSequence` | `mvp-blocking` |
| `TC-DYN-003-FIXED-STEP-REPLAY` | `dynamics-fixed-step-replay` | Variable `deltaTimeMs` inputs produce deterministic fixed-step substeps and accumulator state | `runtimeStateSequence` | `mvp-blocking` |
| `TC-DYN-004-RESET-DETERMINISM` | `dynamics-reset-determinism` | Reset boundaries create identical replay from the same initial state | `runtimeStateSequence` | `mvp-blocking` |
| `TC-DYN-005-INVALID-GRAPH` | `invalid-dynamics-cycle` | Computed output as driver or group dependency is rejected | `validationDiagnostic` | `mvp-blocking` |
| `TC-DYN-006-OUTPUT-DUPLICATE` | `invalid-dynamics-output-target-duplicate` | Multiple groups cannot target the same computed output parameter | `validationDiagnostic` | `mvp-blocking` |

## 7. P1 Test Rows

| Test ID | Fixture | Purpose | Oracle | Gate |
|---------|---------|---------|--------|------|
| `TC-DYN-101-OUTPUT-CLAMP` | `dynamics-output-range-clamp` | Clamp behavior and `dynamics.outputClamped` evidence are stable | `runtimeSnapshot` | `p1-blocking` |
| `TC-DYN-102-PREVIEW-VIEWER-EQUIVALENCE` | `minimal-dynamics-hairSway` | Editor preview and Viewer use the same frame input, state, context, and evaluator versions | `runtimeStateSequence` | `p1-blocking` |
| `TC-DYN-103-DEMO-SAFE` | `demo-safe-dynamics-capture` | Demo surface exposes high-level driver/output results without unsafe internals | `surfaceScan` | `p1-blocking` |
| `TC-DYN-104-SMOKE-VIEWER` | `minimal-dynamics-hairSway` | Viewer can load and produce non-empty Dynamics snapshot evidence | `runtimeSnapshot` | `mvp-warning` |

## 8. Snapshot Requirements

Dynamics snapshots used by exact replay fixtures must include:

- authored parameter values;
- computed parameter values;
- effective parameter values;
- dynamics group ID;
- enabled state;
- `solverKind`;
- driver values;
- output parameter ID;
- output value;
- position;
- velocity;
- tick;
- `fixedStepMs`;
- resetCounter;
- reset applied flag where relevant;
- reset reasons where relevant;
- `rawTarget` and `clampedTarget` for targeted/full detail;
- diagnostics.

Snapshot comparison is not a substitute for RuntimeState sequence comparison. It proves observed runtime output; the `RuntimeStateSequenceArtifact` proves replay state.

## 9. Validator Requirements

Validator profile behavior must align with these checks:

| Check ID | Exact replay behavior |
|----------|-----------------------|
| `runtime.stateSequenceLengthMismatch` | Fail for strict, acceptance, and demoSafe replay evidence |
| `runtime.statePackageMismatch` | Fail or require reset before replay |
| `runtime.statePackageHashUnavailable` | Warn in strict; exact replay fixture may fail unless declared hashless |
| `runtime.stateMissingDynamicsGroup` | Fail when exact replay evidence depends on prior state |
| `runtime.stateUnknownDynamicsGroup` | Fail when exact replay evidence depends on full state equality |
| `dynamics.timestepMismatch` | Fail for strict and acceptance replay |
| `runtime.timestepOverflow` | Fail for exact replay fixtures |
| `dynamics.nonDeterministicSnapshot` | Fail for strict and acceptance |
| `dynamics.nanState` | Blocking fail |

## 10. Delegation Boundaries

| Owner | Responsibility |
|-------|----------------|
| `runtime-core` | Implement `createInitialRuntimeState`, frame/sequence evaluation, `scalarDampedFollowV1`, snapshot and next-state semantics |
| `validator-core` | Emit diagnostics, compare evidence artifacts, classify exact replay vs smoke evidence |
| `fixtures-contract-tests` | Provide frame input, expected computed sequence, expected snapshots, expected RuntimeState sequence artifacts |
| `acceptance-runner` | Aggregate AC/scenario evidence and reject incomplete replay evidence |
| `editor-ui` / `viewer-ui` | Supply preview/viewer frame sequences and context without changing runtime semantics |

This document does not authorize implementation code. It only defines required test evidence and comparison policy.

## 11. Acceptance Criteria

This policy is satisfied when:

- Every P0 row has a fixture, expected artifacts, oracle, gate, and owner.
- Exact replay rows compare the full `RuntimeStateSequenceArtifact`, not only final state.
- Expected computed parameter sequences are explicit.
- `inputFramesHash`, `runtimeEvaluationContext`, `evaluatorVersionSummary`, `fixedStepMs`, `packageHash`, and epsilon policy are recorded.
- All machine-readable IDs contain no spaces.
- Non-oracle external compatibility claims are absent from pass criteria.
