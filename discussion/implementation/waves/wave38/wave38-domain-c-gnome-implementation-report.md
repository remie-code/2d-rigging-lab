# Wave38 Domain C Gnome Implementation Report

## Verdict

needs_review

## Scope

Domain: `wave38-validator-topology-uv-diagnostics`

Validator-core に限定して、Domain A の optional package mesh fields と現行 runtime-core mesh evidence で検証できる topology / UV diagnostics を追加した。Operation implementation、Editor UI、Renderer / pixel oracle / image decode validation、dependency manifest / lockfile 変更は行っていない。

## Files Changed

- `packages/validator-core/src/validators/mesh-semantics.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/mesh-topology-diagnostics.test.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave38/wave38-domain-c-gnome-implementation-report.md`

## Implementation Summary

- Added package-side deterministic mesh diagnostics:
  - `mesh.duplicateTriangle`
  - `mesh.orphanedVertex`
  - `mesh.triangleStableIdsLengthMismatch`
  - `mesh.uvCoordinateOutOfBounds`
- Split runtime mesh evidence inconsistency from missing evidence:
  - existing `mesh.runtimeEvidenceMissing` remains for missing snapshot / drawable / per-drawable mesh evidence.
  - new `mesh.runtimeEvidenceMismatch` covers stale runtime snapshot identity and package/runtime mesh evidence disagreement.
- Extended runtime topology mismatch comparison for current runtime-core evidence fields:
  - `vertexCount`
  - `stableVertexIdCount`
  - `stableTriangleIdCount`
  - `uvCount`
  - `triangleCount`
  - `triangleIndexCount`
  - mesh-local `topologyRevision` when package or runtime evidence carries it
  - topology booleans, including `hasStableTriangleIds`
  - runtime mesh bounds / vertexHash self-consistency
  - exposed non-empty `vertices.length`
- Registered all new checks in the default check catalog.
- Updated the validator contract check table and mesh validation rules.

## Fix Loop 1

Review-Sylph found that parallel Domain B runtime evidence now exposes `topology.stableTriangleIdCount`, optional `topology.topologyRevision`, and `topology.hasStableTriangleIds`.

Applied fixes:

- Extended `RuntimeMeshEvidenceLike.topology` and `collectRuntimeMeshEvidenceMismatches` to compare:
  - `topology.stableTriangleIdCount`
  - `topology.topologyRevision`
  - `topology.hasStableTriangleIds`
- Kept comparisons optional-aware for legacy evidence: package/runtime mismatch is reported when either side carries the field.
- Added focused stale mesh-local `topologyRevision` runtime evidence tamper coverage.
- Updated valid mesh topology fixture evidence with matching `triangleStableIds` and `topologyRevision`.
- Updated validator contract wording to remove the stale "runtime/viewer evidence does not carry topologyRevision" limitation.

## Verification

Passed focused validator test:

```text
pnpm.cmd exec vitest run packages\validator-core\src\mesh-topology-diagnostics.test.ts
```

Result: 1 test file passed, 12 tests passed.

Fix loop 1 focused validator test:

```text
pnpm.cmd exec vitest run packages\validator-core\src\mesh-topology-diagnostics.test.ts
```

Result: 1 test file passed, 13 tests passed.

Passed typecheck:

```text
pnpm.cmd typecheck
```

Result: root TypeScript and editor TypeScript checks passed.

Whitespace check:

```text
git diff --check -- packages\validator-core\src discussion\design\module-contracts\validator-contract.md
```

Result: exit code 0. Git reported CRLF conversion warnings only.

## Remaining Issues / Deferred Items

- Mesh-local `topologyRevision` is now compared when package or runtime/viewer mesh evidence carries it. Domain C still does not invent a packageRevision-to-topologyRevision rule.
- Existing summary snapshots can materialize `mesh.vertices` as an empty array, so `vertices.length` mismatch is checked only when runtime mesh evidence exposes non-empty vertex evidence. This preserves existing valid viewer evidence behavior.
- Domain B / parallel workspace changes were observed in `packages/authoring-core/**`; Domain C did not edit those files.

## User Decision Points

None.

## Forbidden Scope Confirmation

- Did not edit operation-core implementation.
- Did not edit Editor UI or app UI.
- Did not edit renderer, pixel oracle, image decode, or texture sampling validation.
- Did not add dependencies or modify manifests / lockfiles.
- Did not touch `index.ts`.
