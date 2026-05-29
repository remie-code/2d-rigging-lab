# Wave 4 Domain A Completion: authoring runtime adapter foundation

> Domain: `wave4-authoring-runtime-adapter-foundation`  
> Verdict: pass  
> 実施日: 2026-05-29  
> 担当: Orch-Sylph domain agent

## Changed Files

- `packages/authoring-core/package.json`
- `packages/authoring-core/src/to-runtime-graph.ts`
- `packages/authoring-core/src/runtime-graph-parameters.ts`
- `packages/authoring-core/src/runtime-graph-drawables.ts`
- `packages/authoring-core/src/runtime-graph-dynamics.ts`
- `packages/authoring-core/src/runtime-graph-rig-controls.ts`
- `packages/authoring-core/src/runtime-graph-keyforms.ts`
- `packages/authoring-core/src/runtime-graph-adapter.test.ts`
- `packages/authoring-core/src/dependency-boundary.test.ts`
- `packages/authoring-core/src/index.ts`
- `discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md`

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/implementation/waves/wave3/wave3-final-report.md`
- `discussion/implementation/waves/wave3/integration-review.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md`
- `discussion/implementation/reviews/wave3/wave3-authoring-core-session-foundation-review.md`
- Public exports in `authoring-core`, `runtime-core`, `package-format`, and `contracts`.

## Implementation Summary

- `toRuntimeGraph(session, options)` を追加し、`AuthoringSession` から `NormalizedRuntimeGraph` を生成できるようにした。
- `toRuntimeGraphFromAuthoringGraph(graph, context)` を追加し、graph 単体でも package identity / revision を明示して変換できるようにした。
- package DTO 由来の authoring collections を runtime graph の shape へ変換した。
  - parameters: `ReadonlyMap<ParameterId, NormalizedParameter>`
  - drawables: mesh bounds / vertices / vertex count / visibility / opacity / base draw order
  - dynamics groups: driver / output / settings / reset policy
  - rig controls: `rotation2d` / `warpLattice2d`
  - keyforms: `linear-1d-v1` / `parameter-grid-2d-v1`
  - masks: enabled mask relations
  - draw order: package `stableOrder` を runtime draw order として使用
- `authoring-core` package manifest に `@private-2d-rigging-lab/runtime-core` workspace dependency を追加した。
- `index.ts` は barrel export のみに維持した。
- dependency boundary test を Wave4 方針に更新し、runtime-core import は adapter 関連ファイルと adapter test のみに限定した。`operation-core` / `validator-core` import は引き続き禁止。

## Verification Performed

- `pnpm exec vitest run packages/authoring-core/src`: pass。3 files / 6 tests pass。
- `pnpm typecheck`: pass。
- `pnpm check:source`: pass。
- `pnpm check:deps`: pass。
- `git diff --check -- packages/authoring-core discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md`: pass。CRLF warning のみ。
- Boundary search:
  - `rg '@private-2d-rigging-lab/(operation-core|validator-core)' packages/authoring-core/src`: match なし。
  - `rg '@private-2d-rigging-lab/runtime-core' packages/authoring-core/src`: adapter 関連ファイルと `runtime-graph-adapter.test.ts` のみ。

Sandbox / environment notes:

- 初回 `pnpm exec vitest run packages/authoring-core/src` は sandbox EPERM で `vitest.mjs` を open できず、外部権限で再実行した。
- `authoring-core -> runtime-core` workspace link 作成のため `pnpm install --lockfile=false --force` を実行した。最初の実行は timeout で node_modules が半端になったため、外部権限で復旧した。
- `pnpm-lock.yaml` は Domain A の forbidden write scope のため最終差分に含めていない。lockfile sync は integration scope で扱う必要がある。

## Remaining Issues

- Blocking: なし。
- Non-blocking: `pnpm-lock.yaml` は更新していないため、Wave4 integration domain で `pnpm install` による lockfile 同期が必要。
- Non-blocking: current package DTO に package hash / disabled future layers の authoring graph field がないため、adapter は `packageHash` を options / context で受け取り、`disabledFutureLayers` は空配列にしている。
- Non-blocking: runtime graph の mask relation には `enabled` field がないため、adapter は enabled mask のみ runtime-visible mask として渡す。

## User-Decision Points

- なし。

## Provisional Assumptions

- Package `DrawOrderEntryDto.stableOrder` は runtime graph の deterministic draw order として扱う。Drawable の `baseDrawOrder` は drawable field に保持する。
- Package keyform target の `opacity` / `visibility` / `drawOrder` は runtime graph type に独立 target kind がないため、`targetKind: "drawable"` と `targetProperty` で表現する。
- `packageHash` は package DTO source of truth に存在しないため、adapter caller が必要なときに options / context で渡す。
- Editor-only selection / lock / viewport / DOM state は `AuthoringGraph` に保持されていないため、runtime graph へ渡していない。
