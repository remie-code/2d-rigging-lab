# Wave 17 Domain B Completion: mesh vertex runtime evidence regression

## Verdict

`pass`

Domain B の source / fixture 実装と focused evidence verification は pass。初回時点では必須 verification の `pnpm.cmd typecheck` が Domain B forbidden scope の `apps/editor/src/editor-state/mesh-edit-state.ts` で失敗したため `escalate` としたが、Domain C completion 後の Orch-Sylph 再実行で full `pnpm.cmd typecheck` が pass した。

追加 source 修正は不要。Domain B は `pass` とする。

## Context Separation Evidence

- Gnome implementation context: `019e7884-7107-74d1-9244-9fe8a7a9fbb7` (`Gnome the 11th`)
- Review-Sylph context: `019e788e-7587-7eb0-b066-9fa817b2924e` (`Sylph the 12th`)
- Orch-Sylph は source implementation files を編集せず、Gnome 実装と Review-Sylph レビューを別コンテキストとして起動・待機・統合した。
- Review report: `discussion/implementation/reviews/wave17/wave17-mesh-vertex-runtime-evidence-regression-review.md`

Review-Sylph は Domain B 実装・fixture・test adequacy に blocking finding なしと判断した。初回時点の escalation 理由だった必須 full `pnpm.cmd typecheck` 失敗は、Domain C completion 後の Orch-Sylph 再実行で解消済み。

## Changed Files

- `packages/runtime-core/src/snapshot.ts`
- `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts`
- `fixtures/contracts/mesh-vertex-runtime-evidence/fixture-manifest.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/request/create-drawable-commit.request.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/request/generate-mesh-commit.request.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/request/move-mesh-vertex-commit.request.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json`
- `fixtures/contracts/created-drawable-runtime-evidence/expected/created-drawable-runtime-evidence-summary.json`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`

## Implementation Summary

- `NormalizedDrawable.vertices` がある runtime snapshot では、頂点数 fallback ではなく実 vertex 座標から `vhash_*` を算出するようにした。
- `createDrawable -> generateMesh -> moveMeshVertex` の compact contract fixture を追加した。
- `moveMeshVertex` commit 後、runtime snapshot full detail で mesh vertices / bounds / vertexHash が変わることを regression 化した。
- Runtime diff は既存 `drawableChanges` field で `boundsChanged: true` と `vertexHashBefore/After` を観測する。
- Validation report は edited mesh evidence を `candidateStatus: pass` として受け入れ、runtime snapshot ids と operation log evidence を保持する。
- Operation result と operation log entry の双方で runtime snapshot ids、validation report ids、runtime diff drawable changes、payload `vertexDeltas` が保持されることを fixture summary に固定した。
- 既存 created-drawable runtime evidence fixture の expected hash を、頂点内容由来 hash に合わせて更新した。

## Verification

- `pnpm.cmd exec vitest run packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts`
  - sandbox: `node_modules/.../vitest.mjs` read が `EPERM`
  - escalated rerun: pass, 1 file / 1 test
- `pnpm.cmd exec vitest run packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts packages/operation-core/src/created-drawable-runtime-evidence.test.ts packages/operation-core/src/drawable-layer-runtime-evidence.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/snapshot-keyform-integration.test.ts`
  - sandbox: `node_modules/.../vitest.mjs` read が `EPERM`
  - escalated rerun after expected fixture hash update: pass, 6 files / 14 tests
- `pnpm.cmd exec vitest run packages/validator-core/src/runtime-evidence-report.test.ts packages/validator-core/src/validation-report-artifacts.test.ts`
  - sandbox: `node_modules/.../vitest.mjs` read が `EPERM`
  - escalated rerun: pass, 2 files / 9 tests
- `pnpm.cmd typecheck`
  - sandbox: `node_modules/.../typescript/bin/tsc` read が `EPERM`
  - escalated rerun: root typecheck pass, then editor typecheck fail:
    - `apps/editor/src/editor-state/mesh-edit-state.ts(43,33): error TS2345: Argument of type 'string' is not assignable to parameter of type 'MeshId'.`
    - `apps/editor/src/editor-state/mesh-edit-state.ts` は untracked で Domain B forbidden scope のため未修正。
- Domain C completion 後の Orch-Sylph 再実行:
  - `pnpm.cmd typecheck`
  - sandbox: `node_modules/.../typescript/bin/tsc` read が `EPERM`
  - escalated rerun: pass。root typecheck と editor typecheck の両方が通過。
- `pnpm.cmd run typecheck:root`
  - sandbox: `node_modules/.../typescript/bin/tsc` read が `EPERM`
  - escalated rerun: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- packages/operation-core/src packages/runtime-core/src packages/validator-core/src fixtures/contracts discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`: pass, LF/CRLF warnings only

## Remaining Risks / User-Decision Points

- 初回時点の full `pnpm.cmd typecheck` failure は Domain C completion 後に解消済み。Domain B の追加 source 修正は不要だった。
- Runtime diff は shared contract redesign なしで既存 `drawableChanges` を使っている。専用 mesh vertex diff field は追加していない。
- Validator は現時点の runtime evidence report として edited mesh を pass と扱う。mesh topology / triangle semantic のより詳細な validation は future validator expansion の範囲。
- Domain A handler 本体の変更は不要だった。
