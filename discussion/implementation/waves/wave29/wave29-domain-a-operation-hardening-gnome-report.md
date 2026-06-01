# Wave29 Domain A Operation Hardening - Gnome Report

Date: 2026-06-01

## Verdict

done

## Scope

- Target: `wave29-mesh-edit-operation-hardening`
- Source scope touched: `packages/operation-core/src/**`
- Report scope touched: `discussion/implementation/waves/wave29/**`
- No authoring-core source changes were needed; existing `moveMeshVertices` already handled stable-ID multi-vertex deltas.

## Changed Files

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.test.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `discussion/implementation/waves/wave29/wave29-domain-a-operation-hardening-gnome-report.md`

## Implemented

- Added `lockedTargetIds` to `MoveMeshVertexPayloadSchema` using the existing Wave28 caller-supplied lock bridge pattern.
- Kept operation-core independent of editor state. The operation only compares caller-supplied locked IDs against graph-derived target refs.
- Extended `moveMeshVertex` checked target refs to include:
  - mesh target
  - owning drawable target when the mesh exists
  - owning part target when the drawable exists
  - every requested stable vertex with index-specific vertex path when resolvable
- Preserved operation log `targetIds` as mesh ID plus requested stable vertex IDs, so existing single-row nudge semantics remain compatible.
- Reinforced tests for:
  - multi-vertex dry-run without mutating the original session
  - multi-vertex commit through operation core
  - model diff entries for every moved stable vertex
  - operation log checked refs for mesh/drawable/part/vertex targets
  - package materialization of committed mesh vertices and bounds
  - caller-supplied locked drawable/part rejection
  - existing single-vertex lifecycle row nudge compatibility

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/authoring-core/src/mesh-mutations.test.ts packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts packages/operation-core/src/operation-schemas.test.ts`
  - 5 files passed
  - 33 tests passed
- `git diff --check -- packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operations/move-mesh-vertex.ts packages/operation-core/src/payloads/model-edit.ts`
  - no whitespace errors
  - Git emitted CRLF normalization warnings only

Attempted:

- `pnpm.cmd typecheck`
  - Domain A local `exactOptionalPropertyTypes` issue was fixed and did not recur.
  - Remaining failure is outside this domain in `packages/validator-core/src/validators/mesh-semantics.ts` lines 171, 186, 191, 193, 205, 211, and 213 (`indexes.runtimeSnapshot` possibly undefined). This file is outside Domain A write scope and appears to be parallel Domain C work.

## Remaining Issues

- Repository-level typecheck is currently blocked by validator-core errors outside this domain.
- Operation contract prose was not edited because Domain A write scope did not include design contract documents. The implemented lock bridge follows the existing operation-core `lockedTargetIds` pattern.

## User Decision Points

- None for Domain A.

## Provisional Assumptions

- Editor lock state is lowered by callers into `payload.lockedTargetIds`; operation-core must not read editor state directly.
- Locked IDs may name mesh, drawable, part, or vertex targets. For mesh edits, drawable and part refs can be derived from the authoring graph without crossing into editor-state ownership.
- Topology creation/deletion, UV editing, and keyform-scoped mesh vertex edits remain outside this wave domain.
