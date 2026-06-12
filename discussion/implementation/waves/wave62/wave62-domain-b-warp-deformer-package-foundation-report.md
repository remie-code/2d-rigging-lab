# Wave62 Domain B: Warp Deformer Package Foundation Report

## Status

pass

## Current-State Findings

- 既存 `warpLattice2d` は `RigControlDto` の storage kind として存在し、`latticeColumns * latticeRows` が `restControlPoints` と keyform `controlPointOffsets` の cardinality である。既存 tests も columns / rows を制御点数として扱っている。
- 既存 authoring mutation / operation は `createWarpLattice2dRigControl` と `bindRigControlChild` を持ち、dry-run / commit、model diff、checked target refs、operation log の基礎がある。
- Validator は `warpLattice2d` の bounds、rest point cardinality、keyform patch、runtime evidence に加え、rig control semantic validator で missing refs / cycle を検出している。
- Runtime evaluator は `bilinear-grid-v1` の semantic warp lattice evaluator であり、Bezier surface evaluation は存在しない。

## Chosen Contract Strategy

- 新しい storage kind は追加せず、既存 `warpLattice2d` を後方互換 storage として拡張した。
- User-facing concept は `Warp Deformer` とし、新規作成時に optional `warpDeformer` metadata を `warpLattice2d` rig control に保存する。
- Transform divisions は既存 `latticeColumns` / `latticeRows` を authoritative storage とし、metadata の `transformGrid.columns` / `rows` はこれと一致する必要がある。semantics は `controlPointCount`。
- Bezier edit surface は metadata に `columns` / `rows`、固定 `editType: "cubicBezierSurfaceV1"`、row-major rest control points、zero handles、deterministic generation metadata を保存する。
- Runtime は既存 `bilinear-grid-v1` のまま。Bezier edit surface は保存と検証のみで、runtime 変形評価や Cubism 互換は主張しない。

## Domain C Handoff Contract Note

Create operation:

```ts
{
  operationType: "createWarpDeformer",
  payload: {
    partId: string,
    displayName: string,
    parentRigControlId?: string,
    childDrawableIds?: string[],
    childRigControlIds?: string[],
    domainBounds: { x: number, y: number, width: number, height: number },
    transformColumns: number,
    transformRows: number,
    bezierColumns: number,
    bezierRows: number,
    bezierEditType?: "cubicBezierSurfaceV1"
  }
}
```

- `childDrawableIds` / `childRigControlIds` は schema default で `[]`。
- Commit は stored `rigControlId` を display name から既存 operation id policy に従って生成する。
- `parentRigControlId` がある場合、作成後に parent の `childRigControlIds` へ binding される。
- Dry-run は元 session / package revision / operation log を変更しない。

Read projection:

```ts
projectWarpDeformerReadModel(rigControl)
```

returns:

```ts
{
  kind: "warpDeformer",
  storageKind: "warpLattice2d",
  rigControlId: string,
  displayName: string,
  partId: string,
  parentRigControlId?: string,
  childDrawableIds: string[],
  childRigControlIds: string[],
  domainBounds: Rect,
  transformGrid: { columns: number, rows: number, pointCountSemantics: "controlPointCount" },
  bezierEditSurface: {
    columns: number,
    rows: number,
    editType: "cubicBezierSurfaceV1",
    pointOrder: "rowMajorYThenXFromDomainMinV1",
    restControlPoints: Vec2[],
    handles: { inTangent: Vec2, outTangent: Vec2 }[],
    restSurfaceGeneration: object
  },
  bezierSurfaceStatus: "stored" | "legacyDefaulted",
  evaluationBoundary: {
    transformEvaluation: "bilinearGridV1",
    bezierEvaluation: "storedNotEvaluatedV0"
  }
}
```

Editor may display/edit in draft before Apply:

- name
- parent deformer
- bound children summary
- domain bounds
- Transform columns / rows
- Bezier columns / rows
- Bezier edit type as readonly/fixed default

Unsupported / evaluation boundary:

- No committed update-basic-settings operation was added in Domain B; Editor v0 should edit draft values before `createWarpDeformer` Apply.
- Bezier surface is not evaluated by runtime and is not converted to transform lattice yet.
- Existing keyform authoring remains `controlPointOffsets` over the Transform lattice cardinality.
- No Cubism format, Cubism SDK/Core, or Cubism compatibility claim is introduced.

## Changed Files

- `packages/package-format/src/warp-deformer-contract.ts`
- `packages/package-format/src/warp-deformer-projection.ts`
- `packages/package-format/src/index.ts`
- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/warp-lattice2d-contract.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/index.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`
- `packages/validator-core/src/validators/warp-lattice-schema-issues.ts`
- `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md`

## Verification

- `pnpm typecheck`: pass.
- Focused Warp Deformer / operation / validator / AI tests: pass, 6 files / 50 tests.
  - `packages/package-format/src/warp-lattice2d-contract.test.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
  - `packages/operation-core/src/operations/rig-control.test.ts`
  - `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - `packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
  - `packages/ai-interface/src/ai-codex-proposal-command.test.ts`
- Existing authoring / runtime rig regression tests: pass, 4 files / 30 tests.
  - `packages/authoring-core/src/rig-control-mutations.test.ts`
  - `packages/authoring-core/src/keyform-mutations.test.ts`
  - `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
- Existing validator semantic / runtime evidence tests: pass, 3 files / 18 tests.
  - `packages/validator-core/src/rig-control-semantic.test.ts`
  - `packages/validator-core/src/rig-control-runtime-evidence.test.ts`
  - `packages/validator-core/src/rig-control-contract-evidence-fixture.test.ts`
- `git diff --check`: pass. Output contained existing CRLF normalization warnings only.

Note: Vitest initially failed inside the sandbox with esbuild `spawn EPERM`; the same focused test commands passed when rerun with approved escalation.

## Residual Risks

- Bezier edit surface is persisted and validated but not evaluated. Runtime behavior remains existing bilinear lattice behavior.
- Transform divisions are stored as control point counts. Domain C should label or summarize cell count carefully to avoid UX ambiguity.
- Committed Warp Deformer settings update is not implemented in Domain B. For Editor v0, draft editing before create/Apply is the intended path.
- Legacy `warpLattice2d` without `warpDeformer` metadata projects as `legacyDefaulted`; this is a read compatibility fallback, not a persistent migration.
- Operation-core duplicates the Warp Deformer metadata literal strings locally to avoid adding a new package dependency; future contract expansion should consider a cleaner shared dependency boundary.
