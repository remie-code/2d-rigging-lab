# Wave 3 Domain A Completion: authoring-core session foundation

> Domain: `wave3-authoring-core-session-foundation`  
> Verdict: pass  
> 実施日: 2026-05-29  
> 担当: Orch-Sylph domain agent

## Changed Files

- `packages/authoring-core/package.json`
- `packages/authoring-core/src/package-info.ts`
- `packages/authoring-core/src/authoring-revision.ts`
- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/authoring-session.ts`
- `packages/authoring-core/src/from-package-document.ts`
- `packages/authoring-core/src/graph-selectors.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/authoring-session.test.ts`
- `packages/authoring-core/src/dependency-boundary.test.ts`
- `discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md`

## Basis Used

- `discussion/implementation/orchestration/wave3-plan.md`
- `discussion/implementation/waves/wave2/wave2-final-report.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/package-format/src/index.ts`
- `packages/contracts/src/index.ts`

## Implementation Summary

- `@private-2d-rigging-lab/authoring-core` package を追加した。
- `PackageDocumentDto` から `AuthoringSession` を生成する `createAuthoringSessionFromPackageDocument` を追加した。
- `AuthoringSession` は package identity、package revision、authoring revision、dirty flag、`AuthoringGraph` を保持する。
- `AuthoringGraph` は package DTO 由来の model-visible collections と source/provenance/rights metadata を deep clone して保持する。
- `cloneAuthoringSession` / `createDryRunAuthoringSession` を追加し、dry-run 用 copy が元 session を mutate しない形にした。
- `createParameter` mutation を追加し、重複 parameter を拒否しつつ、成功時に authoring revision increment、dirty flag 更新、stable order 追加を行う。
- `index.ts` は barrel export のみにした。
- `runtime-core`、`operation-core`、`validator-core` への import は導入していない。

## Verification Performed

- `pnpm install`: pass。新規 workspace package の依存リンク作成のため外部権限で実行。
- `pnpm typecheck`: pass。
- `pnpm exec vitest run packages/authoring-core/src`: pass。2 files / 4 tests pass。最初は sandbox EPERM で失敗したため、外部権限で再実行。
- `pnpm check:source`: pass。
- `pnpm check:deps`: pass。
- Boundary search: `rg "@private-2d-rigging-lab/(runtime-core|operation-core|validator-core)" packages/authoring-core/src` は match なし。

## Remaining Issues

- Blocking: なし。
- Non-blocking: production `toRuntimeGraph` は未実装。Wave 3 計画どおり runtime-core import を避けるため、この domain では future hook も追加していない。
- Non-blocking: `createParameter` は最小 mutation surface であり、operation-core 側の payload / precondition 詳細に応じて後続 domain で狭い API 調整が必要になる可能性がある。

## User-Decision Points

- 現時点でユーザー判断が必要な点はなし。

## Provisional Assumptions

- package DTO から作成した session は「編集可能な authoring session」だが、未変更状態として `dirty=false` で開始する。必要な場合は `CreateAuthoringSessionOptions.dirty` で初期 dirty flag を指定できる。
- `authoringRevision` は package revision とは独立した dirty authoring revision として `0` から開始する。必要な場合は `CreateAuthoringSessionOptions.authoringRevision` で初期値を指定できる。
- `minimal-valid-package` fixture は parameter 0 件が正であり、create-parameter mutation test で新規 parameter 追加を検証する。
