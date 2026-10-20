# Golden Update Policy

> Superseded（2026-10-20）: 操作の記録（operation log / `operations/log.jsonl`）はパッケージから撤去した。本書の operation log に関する記述（記録を必須・前提・証拠とする要件、`operations/log.jsonl#<id>` 参照、`operationLog` 種別、`getOperationLog`、transactionId を含む）はすべて無効。変更履歴は git、操作ごとの説明は operation result（modelDiff 等）と validation が担う。根拠: [drop-operation-log.md](../../design/drop-operation-log.md)

> P1 policy for updating expected artifacts without hiding regressions.

## 1. Golden Artifacts

Golden artifacts are versioned expected outputs used by contract, runtime, validator, and acceptance tests.

Golden by default:

- validation reports
- runtime snapshots
- RuntimeState artifacts
- RuntimeState sequence artifacts
- model/runtime/validation diffs
- operation logs used as fixture evidence
- GUI evidence semantic JSON
- AI command transcripts
- demo preflight reports
- rights/provenance reports

Reference artifacts, not pixel-perfect goldens by default:

- screenshots
- representative demo captures
- human visual review notes

## 2. Update Preconditions

A golden update is allowed only when one of these is true:

- the source AC/scenario/contract changed intentionally;
- the fixture operation flow changed intentionally;
- runtime evaluator version changed and `evaluatorVersionSummary` is updated;
- epsilon policy changed and the change is documented;
- validator check severity/status changed with a recorded design reason;
- GUI evidence schema changed without altering the proven user workflow.

The update request must name the affected AC/scenario IDs and test IDs.

## 3. Required Review

| Artifact | Required review |
|----------|-----------------|
| runtime snapshot | runtime-core owner + traceability check |
| RuntimeState sequence | runtime-core owner + strict determinism check |
| validation report | validator-core owner |
| GUI evidence | editor-ui owner + operation-core owner |
| AI transcript | ai-interface owner + operation-core owner |
| demo preflight | demo policy owner |
| rights/provenance report | package-format owner |

## 4. Dynamics Golden Rule

Exact Dynamics replay goldens must not be approved from final state alone. Approval requires:

- same `packageHash`;
- same `inputFramesHash`;
- same `runtimeEvaluationContext`;
- same `evaluatorVersionSummary`;
- same `fixedStepMs`;
- same `frameCount`;
- same `states.length`;
- epsilon-equivalent `states[i]` for every `0 <= i <= frameCount`;
- no `runtime.stateSequenceLengthMismatch`.

If only `states[frameCount]` is checked, the update is a smoke golden update and must not replace exact deterministic replay evidence.

## 5. Hash And Non-Determinism

Hashes must exclude timestamps, local file paths, operation wall-clock IDs, UI-only transient fields, and non-frame context fields unless the artifact policy explicitly includes them.

`inputFramesHash` is owned by frame-local input sequence evidence. `runtimeEvaluationContext` and `evaluatorVersionSummary` are separate golden fields.

## 6. Forbidden Golden Sources

Do not generate or approve goldens from:

- Cubism SDK/Core output;
- Cubism Viewer matching;
- Cubism Physics behavior;
- existing official or third-party models;
- rights-unclear assets;
- public/demo surfaces that reveal internal schema or unsafe compatibility claims.

## 7. Update Record

Every golden update review records:

- changed test IDs;
- changed fixture IDs;
- changed expected artifacts;
- source reason;
- reviewer;
- whether AC/scenario coverage changed;
- whether human visual review is required;
- whether demo-safe and rights/provenance gates were re-run.
