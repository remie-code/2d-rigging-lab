# Test Strategy

> P0 strategy for proving the Private 2D Rigging Lab / Prototype MVP with structured evidence.

## 1. Purpose

The test program proves that the MVP can start from rights-clean layered character art, produce a project-defined model package through the private GUI editor, evaluate it in the private runtime/viewer, validate it, and let the AI assistant inspect and propose safe dry-run operations.

The primary output of testing is evidence, not only pass/fail status. Evidence includes fixture manifests, operation logs, runtime snapshots, runtime state artifacts, RuntimeState sequence artifacts, validation reports, diffs, GUI evidence, AI command transcripts, demo-safe preflight reports, and rights/provenance records.

## 2. Basis

Source-of-truth inputs:

- `discussion/tests/test_basis.md`
- `discussion/concept/modified_concept.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/02_DomainAcceptanceCriteria/`
- `discussion/design/module-contracts/`
- `discussion/demo/streaming-demo-policy.md`
- `discussion/proposal/live2d-feature-proposal-template.md`

When these sources conflict, the test design must record a blocking review finding instead of silently inventing a new requirement.

## 3. MVP Gate

The MVP gate is `mvp-acceptance`. A test contributes to the gate only when it declares:

- `testId`
- related AC and scenario IDs
- fixture ID
- operation flow
- expected artifacts
- oracle
- automation level
- gate
- owner module

The gate can return `pass`, `fail`, or `needs_review`. `needs_review` is acceptable for human visual quality checks, but missing required evidence, blocking validation diagnostics, unsafe demo surface evidence, rights/provenance failure, or AI dry-run mutation is `fail`.

## 4. Evidence Principles

- Prefer structured runtime, validation, operation, and GUI evidence over pixel-only assertions.
- Screenshots and captures are supporting artifacts, not the primary oracle.
- GUI authoring is a required evidence source; script-only model generation cannot prove MVP completion.
- AI assistant tests prove safe operation boundaries, dry-run behavior, diffs, approval flow, and report consumption, not general intelligence.
- Demo-safe tests prove that public/capture surfaces hide forbidden details and unsafe claims.
- Rights/provenance tests prove that fixtures and captures are rights-clean.

## 5. Runtime And Dynamics

Minimum Open Dynamics v1 is in MVP. Dynamics tests are deterministic sequence tests:

- Runtime Core receives previous `RuntimeStateDto` and returns next `RuntimeStateDto`.
- `RuntimeSequenceFrameDto[]` is the source-of-truth frame input.
- `inputFramesHash` proves only the frame-local input sequence.
- `runtimeEvaluationContext` and `evaluatorVersionSummary` are separate evidence.
- Exact deterministic replay compares the full `RuntimeStateSequenceArtifact.states[]`, not only the final state.

The Dynamics oracle is the project-defined `scalarDampedFollowV1` runtime contract. Cubism Physics, Cubism Viewer matching, external solver matching, or existing model behavior are not test oracles.

## 6. Non-Oracles

The following must not be used as pass criteria:

- Cubism file import/export or conversion
- Cubism SDK/Core behavior
- Cubism Viewer visual or physics matching
- Cubism Physics compatibility
- Existing official or third-party models
- Pixel-perfect commercial visual quality

Historical research notes may mention these topics, but fixtures, operation logs, validator evidence, and demo surfaces must not depend on them.

## 7. Automation Levels

| Level | Meaning | Examples |
|-------|---------|----------|
| `auto` | Fully machine-checkable evidence. | schema, validation report, runtime snapshot, exact Dynamics replay |
| `hybrid` | Machine checks plus bounded human review. | GUI authoring evidence with representative captures |
| `manual` | Human review with required checklist evidence. | early visual quality review |

P0/P1 test design should minimize `manual` gates. Manual review must still have a fixture, checklist, and evidence artifact.

## 8. Test ID Rules

Machine-readable IDs use uppercase category prefixes and kebab/camel fragments without spaces.

Examples:

- `TC-MVP-001-GUI-AUTHORING`
- `TC-DYN-002-SEQUENCE-REPLAY`
- `TC-AI-001-DRY-RUN-BOUNDARY`
- `TC-DEMO-001-PREFLIGHT`

Natural prose may use `rig control`, but IDs, target kinds, check IDs, fixture IDs, and artifact IDs must not contain spaces.

## 9. P0/P1 Completion

P0 is complete when strategy, taxonomy, traceability, fixture manifest, expected artifact policy, Dynamics policy, and acceptance runner design exist and align.

P1 is complete when epsilon/determinism, golden update, GUI evidence, validator profiles, AI assistant, demo-safe, and rights/provenance policies exist and align.

The review file must classify remaining issues as `blocking`, `warning`, or `suggestion`. P0/P1 must not leave an unassigned MVP AC or active scenario without a blocking review finding.
