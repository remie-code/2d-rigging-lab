# Test Design Review

> Review of P0/P1 test design deliverables against `discussion/tests/test_basis.md`, current AC, active scenarios, module contracts, demo policy, and proposal boundary documents.

## Verdict

`pass`

P0 and P1 test design deliverables exist and are internally consistent after review fixes. No implementation code was added.

## Review Basis

- `discussion/tests/test_basis.md`
- `discussion/_conventions.md`
- `discussion/concept/modified_concept.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/02_DomainAcceptanceCriteria/`
- `discussion/design/module-contracts/`
- `discussion/demo/streaming-demo-policy.md`
- `discussion/proposal/live2d-feature-proposal-template.md`

## Deliverable Check

| Priority | File | Status |
|----------|------|--------|
| P0 | `discussion/tests/strategy/test-strategy.md` | present |
| P0 | `discussion/tests/strategy/test-taxonomy.md` | present |
| P0 | `discussion/tests/traceability/test-traceability-matrix.md` | present |
| P0 | `discussion/tests/traceability/test-traceability-matrix.json` | present and JSON parsed |
| P0 | `discussion/tests/fixtures/fixture-manifest.md` | present |
| P0 | `discussion/tests/fixtures/fixture-manifest.json` | present and JSON parsed |
| P0 | `discussion/tests/expected/expected-artifacts-policy.md` | present |
| P0 | `discussion/tests/policies/dynamics-test-policy.md` | present |
| P0 | `discussion/tests/runners/acceptance-runner-design.md` | present |
| P1 | `discussion/tests/strategy/epsilon-determinism-policy.md` | present |
| P1 | `discussion/tests/strategy/golden-update-policy.md` | present |
| P1 | `discussion/tests/policies/gui-evidence-schema.md` | present |
| P1 | `discussion/tests/runners/validator-profile-design.md` | present |
| P1 | `discussion/tests/policies/ai-assistant-test-design.md` | present |
| P1 | `discussion/tests/policies/demo-safe-test-policy.md` | present |
| P1 | `discussion/tests/policies/rights-provenance-test-design.md` | present |

## Findings

### Blocking

None remaining.

Blocking findings found during integration and fixed before final verdict:

- `test-traceability-matrix.json` referenced six fixtures not present in `fixture-manifest.json`. Fixed by adding `unsupported-input-boundary`, `demo-safe-preflight`, `proposal-boundary-review`, `discussion-doc-baseline`, `nondependency-guardrail-scan`, and `traceability-lint` to both fixture manifest formats.
- `TC-AI-DRYRUN-REPAIR-001` referenced non-existent scenario IDs `SC-AGENT-003` and `SC-AGENT-005`. Fixed by removing those refs; the current source scenario IDs `SC-AI-003` and `SC-AI-004` are covered by dedicated AI provenance and audit tests.

### Warning

- Expected artifacts, fixture package contents, runner outputs, screenshots, hashes, and exact JSON bytes are planned evidence paths. That is appropriate for this design-only goal, but implementation will need materialized fixtures.
- Six scenario headings are excluded from active P0 gate coverage by `activeScenarioPolicy.excludedScenarioIds` because they are optional or Future-only: `SC-ANIM-001`, `SC-ANIM-002`, `SC-SDK-001`, `SC-VTUBER-001`, `SC-API-001`, and `SC-SAMPLE-002`.
- Hybrid/manual evidence remains for GUI, demo-safe, proposal/hygiene, and visual review gates until runners and capture policies are implemented.

### Suggestion

- Add a future machine-check for `test-traceability-matrix.json` and `fixture-manifest.json` so missing fixture refs and non-existent scenario refs fail early.
- When implementation creates fixtures, generate a small invalid `RuntimeStateSequenceArtifact` with mismatched `states.length` to verify `runtime.stateSequenceLengthMismatch`.
- Keep screenshots as supporting evidence until a stable semantic capture runner exists.

## Coverage Audit

| Check | Result |
|-------|--------|
| MVP AC coverage | `16/16` covered by one or more Test IDs |
| Active scenario coverage | `62/62` covered after applying `activeScenarioPolicy.excludedScenarioIds` |
| Traceability entries | `39` Test IDs |
| Fixture manifest entries | `38` fixtures |
| Missing required traceability fields | none |
| Traceability fixture refs missing from manifest | none |
| Machine-readable ID spaces in Test IDs, fixture refs, and operation flow IDs | none found |

## Evidence Semantics Review

Dynamics design includes:

- previous and next `RuntimeStateDto`;
- `RuntimeSequenceFrameDto[]`;
- `fixedStepMs`;
- expected computed parameter sequence;
- full `RuntimeStateSequenceArtifact` comparison;
- `inputFramesHash = sha256(canonical-json(RuntimeSequenceFrameDto[]))`;
- `runtimeEvaluationContext` stored separately from `inputFramesHash`;
- `evaluatorVersionSummary` stored separately from `inputFramesHash`;
- exact deterministic replay requiring full `states[i]` comparison for every `0 <= i <= frameCount`.

Final-state-only checks are documented as smoke tests, not exact deterministic replay evidence.

## Oracle Review

Allowed oracles are project-defined contracts, schemas, operation logs, runtime snapshots, RuntimeState sequence artifacts, validator diagnostics, GUI semantic evidence, AI command transcripts, demo-safe preflight reports, and rights/provenance metadata.

The design does not use Cubism formats, Cubism SDK/Core, existing Cubism models, Cubism Viewer matching, or Cubism Physics compatibility as test oracles.

## Files Reviewed

- `discussion/tests/strategy/test-strategy.md`
- `discussion/tests/strategy/test-taxonomy.md`
- `discussion/tests/strategy/epsilon-determinism-policy.md`
- `discussion/tests/strategy/golden-update-policy.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/traceability/test-traceability-matrix.json`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/fixtures/fixture-manifest.json`
- `discussion/tests/expected/expected-artifacts-policy.md`
- `discussion/tests/policies/dynamics-test-policy.md`
- `discussion/tests/policies/gui-evidence-schema.md`
- `discussion/tests/policies/ai-assistant-test-design.md`
- `discussion/tests/policies/demo-safe-test-policy.md`
- `discussion/tests/policies/rights-provenance-test-design.md`
- `discussion/tests/runners/acceptance-runner-design.md`
- `discussion/tests/runners/validator-profile-design.md`

## Review Result

P0/P1 test design is complete for the current design-document phase. Remaining work is implementation-time fixture materialization and runner execution, not missing P0/P1 design.
