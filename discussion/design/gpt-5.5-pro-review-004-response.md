# GPT-5.5 Pro Review 004 Response

> Source review: `memo/gpt-5.5-pro-review/review_004.md`
> Scope: `discussion/` only. No implementation code changed.
> Relationship: Supersedes the RuntimeState / operation evidence details recorded in `gpt-5.5-pro-review-003-response.md`.

## Decision

`review_004.md` is accepted as the current source of truth for Minimum Open Dynamics v1 RuntimeState handling.

The MVP contract now treats RuntimeState as testable evidence, not only an in-memory runtime detail:

- Runtime Core exposes `createInitialRuntimeState`.
- `RuntimeStateDtoSchema` is sourced from `typescript-contracts.md`.
- `RuntimeStateDto` carries package identity: `packageId`, `packageRevision`, and optional `packageHash`.
- `runDynamicsPreviewSequence` uses `frames: RuntimeSequenceFrameDto[]` as the contract and acceptance source of truth.
- Operation results can return `generatedRuntimeStateRefs`, `finalRuntimeState`, and `finalRuntimeStateRef`.
- Generated RuntimeState evidence lives under `runtime/states/*.runtime-state.json`.

Cubism Physics compatibility, Cubism SDK/Core, Cubism Viewer matching, Cubism Editor Physics UI reproduction, and Cubism file formats remain non-oracles for MVP success.

## P0/P1/P2 Classification

| Review item | Classification | Result |
|-------------|----------------|--------|
| P0-1 Initial RuntimeState generation | 今回反映 | `createInitialRuntimeState`, package identity, group initialization, missing/unknown/stale state diagnostics, and timestep mismatch policy added. |
| P0-2 `runDynamicsPreviewSequence` payload | 今回反映 | `RuntimeSequenceFrameSchema` added; operation and AI payloads now use `frames`; `authoredParameterFrames` is documented only as an adapter convenience shape. |
| P0-3 RuntimeState evidence result | 今回反映 | `OperationResultSchema` now includes generated state refs and final state fields; artifact policy adds `runtime/states/*.runtime-state.json`. |
| P1-4 RuntimeState passthrough removal | 今回反映 | Operation and AI `RuntimeStatePayloadSchema` now aliases `RuntimeStateDtoSchema`. |
| P1-5 Remove legacy multi-output field | 今回反映 | Runtime snapshot Dynamics group schema now uses `outputParameterId` and `outputValue` only. |
| P1-6 RuntimeStateDto source of truth | 今回反映 | `typescript-contracts.md` is the DTO source of truth; runtime-core documents semantics only. |
| P1-7 `fixedStepMs` ownership | 今回反映 | `RuntimeStateDto.fixedStepMs` is the active timestep; sequence `fixedStepMs` only initializes state; mismatch emits `dynamics.timestepMismatch`. |
| P1-8 Dynamics debug fields | 今回反映 | `rawTarget`, `clampedTarget`, `outputClamped`, `resetApplied`, and `resetReasons` added for targeted/full snapshots. |
| P2-9 GUI unresolved wording | 今回反映 | `parameter-grid-2d-v1` is stated as fixed runtime evaluator; only GUI editing expression remains unresolved. |
| P2-10 RuntimeState artifact policy | 今回反映 | RuntimeState evidence is a generated artifact under `runtime/states/`, not an authored package body file. |

## Updated Areas

- Acceptance criteria and DOMAIN-09 now require initial RuntimeState generation and RuntimeState identity diagnostics.
- Scenario 209 now uses `RuntimeSequenceFrameDto[]`, final RuntimeState evidence, and debug snapshot expectations.
- Runtime, operation, AI, package layout, validator, fixture, and traceability contracts now align around generated RuntimeState evidence.
- GUI screen spec no longer implies that the runtime choice between 1D and 2D face yaw / pitch evaluator is unresolved.

## Remaining Implementation-Time Non-Blockers

- Exact fixture JSON numbers for `scalarDampedFollowV1` expected state sequences.
- Concrete runtime state artifact naming under fixture directories beyond the documented canonical examples.
- Concrete UI editing layout for `parameter-grid-2d-v1`.
