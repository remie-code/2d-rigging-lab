# Wave 18 Domain E 完了報告: Imported Source Package Evidence / Preview Consistency

## Verdict

`pass`

Domain E の実装差分、focused verification、最低検証は通過した。Gnome 実装完了時点では `apps/editor/**` の並行変更に由来する型エラーで full `pnpm.cmd typecheck` が一時失敗していたが、Orch-Sylph の再実行時点では解消済みで full typecheck は pass した。

## 対象

- Domain: `wave18-imported-source-package-evidence-preview-consistency`
- 実装担当: Gnome 別コンテキスト
- 実装 agent id: `019e78e0-501c-7783-9046-b9663a56c4b6` (`Gnome the 29th`)
- Date: 2026-05-30

## 変更ファイル

- `packages/authoring-core/src/package-document-assets.ts`
- `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/fixture-manifest.json`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/baseline-package.json`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/request/import-split-png-source-commit.request.json`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/request/create-drawable-commit.request.json`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/request/generate-mesh-commit.request.json`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json`
- `discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md`

## 実装概要

- Split PNG source import -> `createDrawable` -> `generateMesh` を通す compact fixture と operation-core focused test を追加した。
- Operation result evidence / operation log evidence が source asset、source layer mapping、drawable source refs、provenance、rights を失わないことを確認した。
- Package file set に `assets/sources/source-manifest.json`、`assets/textures/texture-atlas.json`、`assets/provenance.json`、`assets/rights.json`、`operations/log.jsonl` が materialize されることを確認した。
- Runtime snapshot から current SVG preview semantics を要約し、`createDrawable` は bounds rect、`generateMesh` は full snapshot vertices による polygon として観測する。Actual PNG rendering / PNG decode / texture atlas generation は扱っていない。
- Domain B 残リスクだった authoring-core の optional `textureAtlas` preservation は package evidence に必要だったため、`buildPackageDocumentAssets` で base document の `textureAtlas` を保持する最小差分を入れた。
- `index.ts` は編集していない。

## 検証結果

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts` | pass | 1 file / 2 tests。sandbox では Vitest dependency read が `EPERM` のため escalated run。 |
| `pnpm.cmd exec vitest run packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts` | pass | 4 files / 18 tests。 |
| `pnpm.cmd run typecheck:root` | pass | root `tsc --noEmit` pass。 |
| `pnpm.cmd typecheck` | pass | Gnome 実装完了時点では out-of-scope editor 型エラーで一時 fail。Orch-Sylph が 2026-05-30 に再実行し、root と editor の両方が pass。 |
| `pnpm.cmd run check:source` | pass | Source organization guard passed。 |
| `git diff --check -- packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts packages/authoring-core/src/package-document-assets.ts fixtures/contracts/imported-source-package-evidence-preview-consistency discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md` | pass | CRLF normalization warning only。whitespace error なし。 |
| Untracked Domain E trailing whitespace check | pass | 新規 test / fixture files に末尾空白なし。 |

## 残リスク

- Domain E は texture atlas を生成しない。既存 package document にある optional `textureAtlas` を保持し、source / layer / texture refs の整合を fixture で確認する範囲に限定した。
- Texture asset 自体の rights / provenance validator は Domain B と同じく future scope。今回の evidence は source asset rights / provenance、drawable provenance、visible drawable texture reference existence を確認対象にした。

## User Decision Points

なし。
