# Fixtures and Contract Tests

> 状態: Draft / Review ready
> 出力先: discussion/design/module-contracts/fixtures-and-contract-tests.md
> 主な読者: fixtures implementer / all module implementers / reviewer
> 主な所有module: `fixtures-contract-tests`
> Source of truth: zod
> 根拠: [module-boundaries.md](module-boundaries.md), [typescript-contracts.md](typescript-contracts.md), [package-file-format-contract.md](package-file-format-contract.md), [operation-contracts.md](operation-contracts.md), [runtime-core-contract.md](runtime-core-contract.md), [validator-contract.md](validator-contract.md), [ai-command-contract.md](ai-command-contract.md)

## Purpose and Scope

This document fixes fixture names, expected artifacts, contract test ownership, and update rules. Its purpose is to prevent parallel implementation agents from creating compatible-looking but incompatible modules.

It covers:

- fixture list,
- expected validation reports,
- expected runtime snapshots,
- expected model/runtime/validation diffs,
- contract test matrix,
- fixture ownership/update rules,
- PSD happy path,
- PSD unsupported layer,
- split PNG fallback,
- Project-defined two-axis keyform grid,
- parent-child rig control diagonal expression.
- Minimum Open Dynamics v1 hair/cloth/accessory computed output parameter behavior.

It does not create actual fixture files yet.

## Basis Separation

### Repository Facts

- MVP requires AC/scenario traceability down to operation flow, fixtures, and expected output.
- Module contracts are design artifacts; production `.ts` and fixture JSON files are not being created in this task.

### Prior Design Decisions

- PSD primary source asset fixture is required.
- Split PNG fallback fixture remains for compatibility/debug.
- GUI operation log is required expected evidence.
- Expected runtime snapshots and validation reports are contract outputs.

### Assumptions

- Future fixture files live under a path such as `fixtures/contracts/<fixture-id>/`, but the exact implementation path can be decided during scaffolding.
- Expected artifacts are checked semantically with epsilon policies, not by brittle textual equality where ordering is irrelevant.

## Contract Summary

| Contract | Owner module | Consumers | Source of truth | Artifact |
|----------|--------------|-----------|-----------------|----------|
| Fixture manifest | `fixtures-contract-tests` | all tests | zod | manifest JSON |
| Expected validation report | `validator-core` + fixtures | validator, AI, acceptance | zod | report JSON |
| Expected runtime snapshot | `runtime-core` + fixtures | runtime, renderer, AI | zod | snapshot JSON |
| Expected operation log | `operation-core` + fixtures | GUI, AI, acceptance | zod | JSONL |
| Expected diffs | `operation-core` + AI | AI, validator | zod | diff JSON |

## TypeScript / Zod Sketches

## Fixture Manifest Schema

```ts
import { z } from "zod";
import {
  ValidationReportIdSchema,
  RuntimeSnapshotIdSchema,
  OperationIdSchema,
} from "./contracts";

export const ContractFixtureIdSchema = z.enum([
  "minimal-valid-package",
  "psd-import-happy-path",
  "psd-unsupported-layer",
  "split-png-fallback",
  "tutorial-like-authoring",
  "manual-face-grid-2d",
  "keyform-grid-invalid",
  "keyform-missing-endpoint",
  "parent-child-rigControl-diagonal",
  "minimal-dynamics-hairSway",
  "invalid-dynamics-missing-driver",
  "invalid-dynamics-missing-output",
  "invalid-dynamics-cycle",
  "invalid-dynamics-output-target-duplicate",
  "dynamics-output-range-clamp",
  "dynamics-reset-determinism",
  "dynamics-fixed-step-replay",
  "demo-safe-dynamics-capture",
  "invalid-mesh-triangle",
  "invalid-missing-texture",
  "invalid-rigControl-cycle",
  "invalid-mask-reference",
  "rights-provenance-missing",
  "keyform-grid-overdimension",
  "parent-child-out-of-domain",
  "runtime-load-blocking",
  "ai-invalid-mutation",
  "out-of-range-parameter-dry-run",
  "ai-repair-dry-run",
  "script-generated-minimal",
  "gui-hit-test-rigControl",
  "ai-screenshot-rigControl-parameter",
]);
export type ContractFixtureId = z.infer<typeof ContractFixtureIdSchema>;

export const ExpectedArtifactSchema = z.object({
  kind: z.enum(["package", "operationLog", "validationReport", "runtimeSnapshot", "modelDiff", "runtimeDiff", "validationDiff", "commandTranscript"]),
  path: z.string(),
  id: z.union([ValidationReportIdSchema, RuntimeSnapshotIdSchema, OperationIdSchema, z.string()]).optional(),
  comparison: z.enum(["exact-json", "semantic-json", "snapshot-epsilon", "jsonl-sequence"]),
});

export const ContractFixtureManifestSchema = z.object({
  schemaVersion: z.literal("contract-fixture-manifest-v1"),
  fixtureId: ContractFixtureIdSchema,
  title: z.string(),
  coversAC: z.array(z.string()),
  coversScenarios: z.array(z.string()),
  modulesBlocked: z.array(z.string()),
  inputArtifacts: z.array(z.string()),
  expectedArtifacts: z.array(ExpectedArtifactSchema),
  updateRule: z.enum(["requires-contract-review", "allowed-with-snapshot-regeneration", "generated"]),
});
export type ContractFixtureManifestDto = z.infer<typeof ContractFixtureManifestSchema>;
```

## Fixture List

| Fixture | Covers | Expected artifacts | Blocks which modules |
|---------|--------|--------------------|----------------------|
| `minimal-valid-package` | package load, runtime non-empty, base validation pass | package, validation report, summary snapshot | package-format, runtime-core, validator-core |
| `psd-import-happy-path` | PSD layer/group import, provenance, drawable/part/texture creation | operation result, model diff, validation report | package-format, operation-core, editor-ui |
| `psd-unsupported-layer` | unsupported smart/text/effect/fill handling | validation report with unsupported diagnostics | package-format, validator-core |
| `split-png-fallback` | fallback source asset path | provenance warning, package diff | package-format, operation-core |
| `tutorial-like-authoring` | GUI authoring MVP flow | operation log, full snapshot, validation report | editor-ui, operation-core, validator-core |
| `manual-face-grid-2d` | `parameter-grid-2d-v1` manual face grid | full runtime snapshot, validation report | runtime-core, operation-core |
| `keyform-grid-invalid` | missing/duplicate two-axis grid coordinates | validation fail report | runtime-core, validator-core |
| `keyform-missing-endpoint` | one-axis keyform lacks required endpoint | validation warning/fail report | operation-core, validator-core |
| `parent-child-rigControl-diagonal` | parent-child rig control diagonal expression | targeted snapshot, runtime diff | runtime-core, validator-core |
| `minimal-dynamics-hairSway` | faceYaw authored input drives delayed/clamped hairSway computed output | snapshot sequence, runtime state refs, validation report | package-format, runtime-core, validator-core, editor-ui |
| `invalid-dynamics-missing-driver` | dynamics group missing valid authoredInput driver | validation fail report | package-format, validator-core |
| `invalid-dynamics-missing-output` | dynamics group missing computedDynamics output | validation fail report | package-format, validator-core |
| `invalid-dynamics-cycle` | computed output used as dynamics driver or group dependency | blocking validation report | runtime-core, validator-core |
| `invalid-dynamics-output-target-duplicate` | two groups target the same computedDynamics output parameter | validation fail report | package-format, validator-core |
| `dynamics-output-range-clamp` | output clamp and range diagnostics | targeted snapshot + validation report | runtime-core, validator-core |
| `dynamics-reset-determinism` | fixed timestep reset replay equivalence | paired snapshot sequences + runtime state sequences | runtime-core, validator-core |
| `dynamics-fixed-step-replay` | explicit RuntimeStateDto accumulator replay over variable delta inputs | snapshot sequence + initial/final RuntimeStateDto artifacts | runtime-core, validator-core |
| `demo-safe-dynamics-capture` | dynamics demo hides unsafe internal names and solver details | demo preflight report | validator-core, viewer-ui |
| `invalid-mesh-triangle` | triangle index out of range / degenerate triangle | validation fail report with mesh target | validator-core, runtime-core |
| `invalid-missing-texture` | visible drawable missing texture | validation fail report | package-format, validator-core |
| `invalid-rigControl-cycle` | hierarchy cycle | blocking validation report | runtime-core, validator-core |
| `invalid-mask-reference` | missing/invalid mask relation | validation report + snapshot diagnostic | validator-core, runtime-core |
| `rights-provenance-missing` | missing source provenance / blocked rights | validation fail report | package-format, validator-core |
| `keyform-grid-overdimension` | three or more parameters on one target grid | validation needs_review/fail report | operation-core, runtime-core, validator-core |
| `parent-child-out-of-domain` | child vertex outside parent warp domain | warning/needs_review report | runtime-core, validator-core |
| `runtime-load-blocking` | normalized graph cannot produce deterministic snapshot | blocking report | package-format, runtime-core, validator-core |
| `ai-invalid-mutation` | AI dry-run incorrectly mutates package | acceptance fail report | ai-interface, operation-core, validator-core |
| `out-of-range-parameter-dry-run` | AI/API range clamp and strict fail | operation result, snapshot, validation diff | operation-core, runtime-core, validator-core |
| `ai-repair-dry-run` | AI repair proposal and no commit | command transcript, diffs, repair candidate | ai-interface, operation-core, validator-core |
| `script-generated-minimal` | no GUI authoring evidence | acceptance fail / auxiliary status | validator-core, acceptance runner |
| `gui-hit-test-rigControl` | semantic canvas hit-test target resolution | hit-test response | editor-ui, ai-interface |
| `ai-screenshot-rigControl-parameter` | screenshot-assisted AI still uses semantic APIs | command sequence, dry-run diff | editor-ui, ai-interface |

## Expected Validation Reports

| Fixture | Required checks |
|---------|-----------------|
| `minimal-valid-package` | `pkg.schema.requiredFileMissing` absent, `runtime.drawListEmpty` absent, summary `status=pass`, highest severity <= `info` |
| `psd-import-happy-path` | `rights.provenanceMissing` absent, source asset provenance linked to every created drawable |
| `psd-unsupported-layer` | `asset.psd.unsupportedFeature` with `severity=warning` or `error`, target kind `sourceAsset`, related scenario `SC-IN-003` |
| `rights-provenance-missing` | `rights.provenanceMissing` with `severity=error`, acceptance `status=fail`, target kind `sourceAsset` |
| `keyform-missing-endpoint` | `keyform.missingEndpoint` with `severity=warning`; strict profile `status=fail` when interpolation needs both endpoints |
| `keyform-grid-invalid` | `keyform.grid2dMissingKey` or `keyform.grid2dDuplicateKey` with `severity=error/blocking`, target keyform set ID |
| `invalid-mesh-triangle` | `mesh.triangleIndexOutOfRange` with `severity=blocking`; optional `mesh.degenerateTriangle` warning on second mesh |
| `invalid-missing-texture` | `ref.drawableTextureMissing` with `severity=error`, target visible drawable ID, acceptance `status=fail` |
| `invalid-rigControl-cycle` | `rigControl.cycle` with `severity=blocking`, target kind `rigControl`, no successful topological order |
| `parent-child-out-of-domain` | `rigControl.childOutsideWarpDomain` with `severity=warning`, acceptance `status=needs_review` |
| `minimal-dynamics-hairSway` | no `dynamics.*` error/blocking diagnostics; output parameter has `valueSource="computedDynamics"`; one group has exactly one output |
| `invalid-dynamics-missing-driver` | `dynamics.driverMissing` or `dynamics.driverMustBeAuthoredInput` with `severity=error` |
| `invalid-dynamics-missing-output` | `dynamics.outputMissing` or `dynamics.outputMustBeComputedParameter` with `severity=error` |
| `invalid-dynamics-cycle` | `dynamics.outputUsedAsDriver` or `dynamics.groupCycle` with `severity=blocking` |
| `invalid-dynamics-output-target-duplicate` | `dynamics.outputTargetDuplicate` with `severity=error`, acceptance `status=fail` |
| `dynamics-output-range-clamp` | `dynamics.outputParameterOutOfRange` warning/error or `dynamics.outputClamped` evidence and clamped output value |
| `dynamics-reset-determinism` | no `dynamics.nonDeterministicSnapshot`; paired sequence hashes match |
| `dynamics-fixed-step-replay` | no `runtime.timestepOverflow`; accumulator/final state match expected replay |
| `demo-safe-dynamics-capture` | `dynamics.demoUnsafeInternalName` absent or warning-only with safe public wording |
| `invalid-mask-reference` | `mask.sourceMissing` or `mask.drawableMissing` with `severity=blocking`, target mask relation ID |
| `keyform-grid-overdimension` | `keyform.tooManyParametersForMvp` with `severity=warning`, acceptance `status=needs_review` |
| `runtime-load-blocking` | `runtime.loadBlocking` with `severity=blocking`; no accepted viewer snapshot |
| `script-generated-minimal` | `evidence.guiOperationLogMissing` with `severity=blocking`, acceptance `status=fail` |
| `ai-invalid-mutation` | `ai.dryRunMutatedPackage` with `severity=blocking`, acceptance `status=fail` |
| `ai-repair-dry-run` | baseline problem check remains linked, repair candidate present, no `ai.dryRunMutatedPackage` |

## Expected Runtime Snapshots

| Fixture | Snapshot detail | Required assertions |
|---------|-----------------|---------------------|
| `minimal-valid-package` | `summary` | non-empty draw list, no blocking diagnostics |
| `tutorial-like-authoring` | `full` | `eyeOpen`, `mouthOpen`, `hairSway`, `faceYaw`, `facePitch` representative inputs change drawable bounds/hash without blocking diagnostics |
| `manual-face-grid-2d` | `full` | manual face grid values at `(-30,-30)`, `(0,0)`, `(30,30)`, `(-30,30)`, `(30,-30)` produce deterministic vertex hashes under declared epsilon |
| `parent-child-rigControl-diagonal` | `targeted` | parent rotation and child warp states are both present; child final bounds differ from parent-only baseline |
| `minimal-dynamics-hairSway` | `targeted` sequence | `faceYaw` authored input drives one `hairSway` computed output with delayed follow, damping, output clamp, debug target fields, and no direct mesh/rigControl writes |
| `dynamics-reset-determinism` | `targeted` sequence pair | same initial `RuntimeStateDto`, `RuntimeSequenceFrameDto[]`, and fixedStepMs produce identical dynamics output sequence and state summary |
| `dynamics-fixed-step-replay` | `targeted` sequence | variable delta inputs produce deterministic fixed-step substeps, accumulatorMs, and final RuntimeStateDto |
| `out-of-range-parameter-dry-run` | `targeted` | raw input recorded, value clamped to range, `runtime.parameterClamped` warning emitted |

## Expected Runtime States

| Fixture | Required state artifacts | Required assertions |
|---------|--------------------------|---------------------|
| `minimal-dynamics-hairSway` | `runtime/states/initial-runtime-state.json`, `runtime/states/expected-next-runtime-state.json` | initial state package identity matches fixture package; each group starts at currentTarget with velocity=0, tick=0, resetCounter=1 |
| `dynamics-reset-determinism` | `runtime/states/expected-runtime-state-sequence.json` | paired runs produce byte-stable state sequence under declared evaluator version and epsilon policy |
| `dynamics-fixed-step-replay` | `runtime/states/initial-runtime-state.json`, `runtime/states/expected-runtime-state-sequence.json`, `runtime/states/expected-next-runtime-state.json` | variable `deltaTimeMs` frames update accumulatorMs and final state deterministically; timestep mismatch fixture emits `dynamics.timestepMismatch` |

## Expected Diffs

| Fixture | Diff types | Required assertions |
|---------|------------|---------------------|
| `psd-import-happy-path` | model diff | source asset, parts, drawables, textures added |
| `moveMeshVertex` slice inside `ai-repair-dry-run` | model/runtime/validation diff | vertex field changes include mesh ID and vertex ID; runtime hash changes; validation has no new `blocking` |
| `out-of-range-parameter-dry-run` | runtime/validation diff | `runtime.parameterClamped` diagnostic added, base package revision unchanged |
| `parent-child-rigControl-diagonal` | runtime diff | targeted rig control local state and child drawable bounds/hash change |
| `minimal-dynamics-hairSway` | runtime diff | authored `faceYaw` sequence changes computed `hairSway`; `dynamicsChanges` records output/state deltas before keyform/rigControl snapshot output |
| `dynamics-reset-determinism` | runtime diff | reset replay has no output/state mismatch |
| `dynamics-fixed-step-replay` | runtime diff | accumulator and tick changes are reflected in `dynamicsChanges` or associated state evidence |
| `ai-invalid-mutation` | model/validation diff | package revision changed during dry-run is detected as invalid mutation |

## Contract Test Matrix

| Test | Reads | Asserts |
|------|-------|---------|
| package schema roundtrip | fixture package DTOs | Zod parse and stable ID prefixes |
| load to runtime graph | package fixture | package-format can build normalized graph |
| runtime snapshot compare | package + inputs | snapshot matches expected under epsilon |
| validator expected report | package + profile | check IDs/status/severity match |
| operation dry-run | package + operation request | diffs generated, no revision mutation |
| operation commit | package + operation request | operation log entry and revision update |
| AI command transcript | command sequence | approval boundary, evidence refs, revalidation |
| GUI evidence acceptance | operation log + supplemental refs | GUI log required; screenshots not sufficient |

## Fixture Ownership and Update Rules

| Artifact | Owner | Update rule |
|----------|-------|-------------|
| fixture manifest | fixtures implementer | requires contract review |
| package DTO fixture | package-format implementer | requires contract review |
| expected runtime snapshot | runtime implementer | regenerate only with evaluator version bump or approved epsilon change |
| expected validation report | validator implementer | update only with check registry change |
| operation log fixture | operation/editor implementers | update only with operation schema change |
| AI command transcript | AI implementer | update only with command contract change |

## Diagram Requirements

The fixture flow diagram defines expected artifact production and consumption. Fixture manifests and expected artifact schemas remain the source of truth.

## Fixture -> Expected Artifact Flow

```mermaid
flowchart LR
  fixture[Contract fixture package/input] --> package[package-format parse]
  fixture --> operation[operation-core dry-run/commit]
  package --> runtime[runtime-core snapshot]
  package --> validator[validator-core report]
  operation --> diffs[model/runtime/validation diffs]
  runtime --> expectedSnapshot[expected runtime snapshot]
  validator --> expectedReport[expected validation report]
  diffs --> expectedDiff[expected diff]
  expectedSnapshot --> contractTest[contract tests]
  expectedReport --> contractTest
  expectedDiff --> contractTest
```

## Traceability

| Requirement | Contract element | Verification |
|-------------|------------------|--------------|
| AC-MVP-003, SC-IN-002 | `psd-import-happy-path` | import operation + package diff |
| AC-MVP-008, SC-PARAM-004 | `manual-face-grid-2d` | runtime snapshot and validation report |
| AC-MVP-009, SC-DEF-003 | `parent-child-rigControl-diagonal` | runtime snapshot/diff |
| AC-MVP-010, AC-PHYS-001..006, SC-DYN-001..004 | `minimal-dynamics-hairSway`, `dynamics-reset-determinism` | dynamics snapshot sequence / validation |
| AC-MVP-013, SC-MVP-004 | expected validation reports | validator contract tests |
| AC-MVP-014, SC-AGENT-002 | `ai-repair-dry-run` | command transcript + diffs |
| SC-MVP-005 | `script-generated-minimal` | acceptance profile expected fail |

## Verification and Fixtures

This entire document defines the verification strategy. Each fixture must include:

- manifest,
- source/input artifacts,
- operation sequence where relevant,
- expected validation report,
- expected runtime snapshot where runtime-visible,
- expected model/runtime/validation diffs where operation/AI-visible,
- traceability to AC and scenario IDs.

## Open Questions

| Question | Impact | Status |
|----------|--------|--------|
| Exact repository fixture path | can-defer | recommended path is `fixtures/contracts/<fixture-id>/` |
| Whether expected artifacts are checked by Vitest snapshots or custom semantic comparator | can-defer | comparator semantics are fixed by this document |
| Actual source art creation method for rights-clean PSD | can-defer | provenance/rights contract already defines required metadata |

## Handoff Checklist

- [x] Public API / DTO が示されている
- [x] Source of truth が契約ごとに明記されている
- [x] 依存方向、処理順序、状態遷移が必要な箇所に Mermaid 図がある
- [x] AC / scenario traceability がある
- [x] Fixture または expected output がある
- [x] 未決事項が implementation-blocking / can-defer に分かれている

## Review Requirements

Review this file for:

- fixture coverage across happy path, unsupported input, invalid graph, GUI evidence, and AI dry-run,
- expected artifact sufficiency,
- consistency with check IDs, snapshot detail, and operation request contracts.
