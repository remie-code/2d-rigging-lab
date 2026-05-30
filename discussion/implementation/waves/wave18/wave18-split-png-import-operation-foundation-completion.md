# Wave 18 Domain A 完了報告: Split PNG Import Operation Foundation

## Verdict

`pass`

## 対象

- Domain: `wave18-split-png-import-operation-foundation`
- 実装担当: Gnome 別コンテキスト
- 実装 agent id: `019e78c4-e6e7-7b90-86e3-db534adeb9aa` (`Gnome the 22nd`)
- レビュー担当: Review-Sylph 別コンテキスト
- レビュー agent id: `019e78d1-60bb-7262-beb8-09d74d1063b3` (`Sylph the 24th`)
- Orch-Sylph source 実装: なし。Orch-Sylph は source / tests を編集せず、実装を Gnome に委譲し、レビューを別 Review-Sylph に委譲した。
- Date: 2026-05-30

## 変更ファイル

- `packages/authoring-core/src/source-asset-mutations.ts`
- `packages/authoring-core/src/source-asset-mutations.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
- `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`
- `packages/operation-core/src/operations/set-rights-metadata.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave18/wave18-split-png-import-operation-foundation-review.md`

## 実装概要

- `importSplitPngSourceAsset` handler を実装し、operation registry に登録した。
- Split PNG manifest metadata を operation payload として受け取り、real file IO / PNG decode なしで `SourceAsset` / `SourceLayer` / rights / provenance を authoring session に追加する foundation にした。
- `setRightsMetadata` handler を実装し、既存 source asset の rights record 更新と provenance related operation 更新を行うようにした。
- `importPsdSourceAsset` は Wave 18 Domain A の範囲外として、operation-specific unsupported diagnostic を返す handler を registry に登録した。
- `createDrawable` が import 済み `sourceAssetId` / `sourceLayerId` を参照して commit できる focused test を追加した。
- `index.ts` は re-export のみを維持した。

## Deterministic Diagnostics

- `operation.importSplitPngSourceAsset.missingManifestPath`
- `operation.importSplitPngSourceAsset.invalidImportProfile`
- `operation.importSplitPngSourceAsset.duplicateSourceAsset`
- `operation.importSplitPngSourceAsset.missingRights`
- `operation.importSplitPngSourceAsset.blockedRights`
- `operation.importSplitPngSourceAsset.missingProvenance`
- `operation.importSplitPngSourceAsset.missingLayers`
- `operation.importSplitPngSourceAsset.missingDefaultPart`
- `operation.importSplitPngSourceAsset.duplicateSourceLayer`
- `operation.importSplitPngSourceAsset.missingLayerBounds`
- `operation.setRightsMetadata.missingSourceAsset`
- `operation.setRightsMetadata.blockedRights`
- `operation.setRightsMetadata.missingProvenance`
- `operation.importPsdSourceAsset.unsupported`

## レビュー結果

- Review-Sylph agent id: `019e78d1-60bb-7262-beb8-09d74d1063b3` (`Sylph the 24th`)
- Review artifact: `discussion/implementation/reviews/wave18/wave18-split-png-import-operation-foundation-review.md`
- Review verdict: `pass`
- Blocking findings: なし
- レビュー lane:
  - Design / Development Compliance Review
  - Test Adequacy Review
  - Rights / Provenance Integrity Review

## 検証

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/source-asset-mutations.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-schemas.test.ts` | pass, 4 files / 31 tests |
| `pnpm.cmd typecheck` | pass after sandbox escalation |
| `pnpm.cmd run check:source` | pass |
| `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md` | pass; CRLF normalization warnings only |

## 残リスク

- この Domain A は metadata-backed foundation のみ。file read、PNG decode、image existence validation、texture atlas generation、PSD binary parse は対象外。
- `setRightsMetadata` は `blocked` status を source asset update の precondition diagnostic として reject する。Blocked asset を accepted package state として記録する運用が必要なら、別waveで設計判断が必要。
- `SourceAsset.diagnostics` は compact fallback notes に限定している。より豊かな candidate drawable / part mapping evidence は後続 Wave 18 domains の範囲。

## User Decision Points

Domain A completion を妨げる user decision point はなし。
