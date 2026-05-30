# Wave 17 Domain A Completion: mesh vertex operation foundation

## Verdict

`pass` after Undine-approved additional fix

別コンテキストの Gnome 実装として、`moveMeshVertex` の authoring mutation / operation handler / registry lifecycle regression を実装した。needs-fix loop 1 で stable per-vertex model diff は修正済み。Undine の追加判断により `packages/operation-core/src/payloads/model-edit.ts` の最小 schema 変更が許可され、public lifecycle empty `vertexDeltas` も `operation.moveMeshVertex.emptyDelta` に到達するよう修正した。

## Changed Files

Authoring mutation:

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/mesh-mutations.ts`
- `packages/authoring-core/src/mesh-mutations.test.ts`

Operation foundation:

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.test.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`

Report:

- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`

Needs-fix loop 1 changes:

- `packages/operation-core/src/operations/move-mesh-vertex.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.test.ts`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`

Undine-approved additional fix changes:

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.test.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`

## Implementation Summary

- `moveMeshVertices` authoring helper を追加し、`mesh.vertexStableIds` で `vertexDeltas[].vertexId` を解決して base mesh `vertices` を delta 加算で更新する。
- 頂点移動後、mesh `bounds` を更新済み頂点から再計算する。
- dry-run は cloned authoring session に適用し、commit は実 session に適用する `moveMeshVertexOperationHandler` を追加した。
- `operation-registry.ts` に `moveMeshVertex` を登録した。
- Undine 判断に基づき `MoveMeshVertexPayloadSchema.vertexDeltas` から `.min(1)` を外し、空配列は schema reject ではなく handler precondition diagnostic に委譲する。
- 既存 lifecycle の `moveMeshVertex` unsupported regression を、supported commit / operation log regression に更新した。unsupported operation coverage は未登録の `setRightsMetadata` へ移した。
- `generateMesh` / `setDrawOrder` / `setRuntimeVisibility` の既存handlerには触れていない。

## Diagnostics Semantics

`moveMeshVertex` handler は次を deterministic precondition diagnostics として返す。

- `operation.moveMeshVertex.missingMesh`: `payload.meshId` が graph に存在しない。
- `operation.moveMeshVertex.missingVertex`: mesh の `vertexStableIds` に `vertexId` が存在しない。
- `operation.moveMeshVertex.duplicateVertexDelta`: 同じ `vertexId` が payload 内に複数回現れる。
- `operation.moveMeshVertex.emptyDelta`: handler 入力の `vertexDeltas` が空。
- `operation.moveMeshVertex.noOp`: 全delta適用後に頂点位置が変わらない。severity は `warning`。
- `operation.moveMeshVertex.unsupportedKeyformScope`: `keyformScope` 付き payload は Wave17 Domain A では明示的に rejected。

Authoring helper 側も対応する `AuthoringMutationError` code で同じ失敗を mutation 前に拒否する。

Undine-approved additional fix 後、`MoveMeshVertexPayloadSchema` は `vertexDeltas: []` を schema-valid として受け付ける。public `OperationRequestSchema` / `createOperationCore.commitOperation` / `dryRunOperation` 経由でも handler precondition が `operation.moveMeshVertex.emptyDelta` を返す。

## Needs-Fix Loop 1

Review report: `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`

Result:

- Finding 2 fixed: `modelDiff.changed` に mesh-level entry に加えて stable per-vertex entry を追加した。各 vertex entry は `target: { kind: "vertex", id: <stable vertexId>, path: "/model/meshes/<meshId>/vertices/<index>" }` と before/after position field を持つ。
- Finding 1 fixed by Undine-approved additional scope: public lifecycle 経由の empty `vertexDeltas` は payload schema を通過し、handler precondition で `operation.moveMeshVertex.emptyDelta` として rejected になる。

## Verification

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-mutations.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts`
  - sandbox: node_modules `vitest.mjs` 読み取りが `EPERM`
  - escalated rerun: pass, 3 files / 22 tests
- `pnpm.cmd typecheck`
  - sandbox: node_modules `typescript/bin/tsc` 読み取りが `EPERM`
  - first escalated run: test fixture cast の TS2352 を検出し修正
  - final escalated run: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`: pass, LF/CRLF warning only
- New-file trailing whitespace check with `Select-String`: pass, no matches

Needs-fix loop 1 verification:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-mutations.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts`: pass, 3 files / 22 tests, escalated due to sandbox EPERM on Vitest node_modules reads
- `pnpm.cmd typecheck`: pass, escalated due to sandbox EPERM on TypeScript node_modules reads
- `pnpm.cmd run check:source`: pass
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`: pass, LF/CRLF warning only

Undine-approved additional fix verification:

- `pnpm.cmd exec vitest run packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts`
  - sandbox: node_modules `vitest.mjs` 読み取りが `EPERM`
  - escalated rerun: pass, 3 files / 24 tests
- `pnpm.cmd typecheck`
  - sandbox: node_modules `typescript/bin/tsc` 読み取りが `EPERM`
  - escalated rerun: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`: pass, LF/CRLF warning only

## Source Organization Notes

- `packages/operation-core/src/index.ts` は編集していない。
- `packages/authoring-core/src/index.ts` は既存の `export * from "./mesh-mutations.js";` のままで、barrel-only を維持している。
- 新規operation logic は `packages/operation-core/src/operations/move-mesh-vertex.ts` に閉じた。
- mesh vertex mutation は既存の mesh mutation責務ファイル `packages/authoring-core/src/mesh-mutations.ts` に追加した。catch-all file / 巨大 `index.ts` は作っていない。
- payload schema の最小変更は既存の model edit payload schema 責務ファイル `packages/operation-core/src/payloads/model-edit.ts` に閉じた。

## Remaining Risks / User Decision Points

- keyform-scoped vertex edit は設計どおり future scope。Wave17 Domain A では unsupported diagnostic のみ。
- runtime snapshot の vertex hash / dedicated runtime diff は Domain B 側の責務。Domain A は authoring graph、operation lifecycle、model diff までを実装した。
- 空 `vertexDeltas` の public lifecycle diagnostic は追加修正で解消済み。残るユーザー判断点はなし。
