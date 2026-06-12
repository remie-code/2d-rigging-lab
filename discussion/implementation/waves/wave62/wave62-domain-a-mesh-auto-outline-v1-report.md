# Wave62 Domain A: Mesh Auto Outline v1 Report

- Status: implemented
- Domain id: `wave62-mesh-auto-outline-v1`

## Current-State Findings

- Wave61 baselineは `packages/authoring-core/src/mesh-generation.ts` の `auto-grid-v1` で、RGBA alpha boundsを使うが境界頂点はalpha輪郭へ吸着しない。
- `generateMesh` operation payload schemaはすでに `auto-outline-v1` を受け入れる形だったが、handler側でunsupported rejectしていた。
- Editor Mesh ToolはPreview -> Apply、Regenerate -> Apply、Cancel導線を既に持ち、preview meshをoperationへ渡してcommitする構造だった。

## Implementation Summary

- `auto-outline-v1` を追加し、Mesh Tool preview / Apply の既定methodを `auto-outline-v1` に変更した。
- Algorithm:
  - RGBA alpha thresholdからbinary maskを作る。
  - alpha boundsを計算する。
  - alpha pixel外周のdirected boundary edgesを追跡してcontour loopを抽出する。
  - preset別に輪郭簡略化する。凹角と隣接角は保護して透明の切れ込みを跨ぎにくくする。
  - alpha内部へpreset密度でinterior pointsを置く。
  - contour + interior pointsを決定的な軽量Delaunayでtriangulateする。
  - centroid / edge midpoint samplingでalpha外・透明中心のtriangleを除外する。
  - pixel座標をstage座標とUVへ線形変換し、stable idsを決定的に生成する。
- Fallback:
  - bytes取得不能、invalid RGBA、alpha空、contour抽出失敗、triangulation失敗時は既存bounds gridへ明示fallbackする。
  - Editor Inspectorに `Source` と `Fallback` を表示する。
  - Operation provenance `transformHistory` に `meshSource:*` と `fallback:*` を残す。

## Changed Files

- `packages/authoring-core/src/mesh-outline-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`

## Verification

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`: pass, 6 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`: pass, 9 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`: pass, 3 tests.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass, 4 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `git diff --check`: pass.
- `pnpm.cmd typecheck`: failed outside Domain A due untracked Warp Deformer files:
  - `packages/operation-core/src/operations/create-warp-deformer.ts`
  - `packages/package-format/src/warp-deformer-contract.ts`
- `pnpm.cmd --dir apps/editor typecheck`: failed for the same Warp Deformer files.

## Residual Risks

- Initial contour handling keeps holes and multiple islands best-effort; no user-visible warning channel exists yet for ignored/simplified islands.
- Triangulation is unconstrained Delaunay plus alpha rejection, so complex thin shapes may still need later quality tuning.
- Full typecheck cannot be used as final pass evidence until the concurrent Warp Deformer changes are fixed.
