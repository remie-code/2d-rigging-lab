# 素材インターフェース git 前提化 実装計画

状態: Draft（ユーザー確認待ち）。2026-10-20。ブランチ `authoring-host/material-interface-on-git`（master 4fa1cef0 から）。
Basis: [material-interface-git-redesign.md](material-interface-git-redesign.md)（判断）。棚卸しは 2026-10-20 の Sylph 調査 3 本（実装の地図、バイトの入り口、開発規約）。

## 進め方

- 軽量（判断 9）: wave ごとに Gnome 1 名がテスト込みで実装・自己検証する。wave の終わりに Sylph（sonnet）1 レーンで、計画・判断との突き合わせと差分レビューを行う。
- Gnome はコミットしない。L0 が wave ごとにコミットする。`pnpm install`、新規依存、lockfile の変更は禁止。
- Wave 1 と Wave 2 は同じファイルに触れない。Wave 2 は Wave 1 の公開 API に依存するため直列で進める。

## 名前（案）

| 種類 | 名前 | 内容 |
|---|---|---|
| operation | `addDrawableFromImage` | 画像から部品を足す |
| operation | `replaceDrawableImage` | 部品の画像を差し替える（部品 ID 維持、メッシュ作り直し、宣言した形のキーだけリセット） |
| AI コマンド（読み取り専用） | `extractMaterialSource` | 現行のまま |
| AI コマンド（読み取り専用） | `previewMaterialPlacement` | 候補なしで、画像パス・配置・足し方・viewport から置いてみる描画を返す |

## Wave 1: パッケージ層（contracts / authoring-core / operation-core / validator-core）

**contracts**
- `material-candidate.ts` と `material-operation-result.ts` を撤去する。
- 残す契約が依存している restPose は、残すファイルへ移す。
- 版は `{packageId, packageRevision}` だけにする（指紋なし）。
- `material-artifacts.ts` の sidecar と sourceContext から、候補 ID・候補リビジョン・作業用パッケージ・指紋を外す。
- `material-contract-fixtures.ts` から候補 fixture を外す。テストを追随させる。

**authoring-core**
- `material-candidate-build.ts` を、候補を受け取らない 2 関数に置き換える（追加、差し替え）。
  - 入力: 正規化済み画像の記述子、配置、足し方、来歴メモ、ID の種（operationId 由来）。
  - 処理: ソース・来歴・権利・テクスチャの項目を作り、部品とメッシュを作るか差し替える。
- ID の種は候補 ID から operationId へ変える（`material-source-mapping.ts`）。
- 画像のバイトはこの層では登録しない。セッションに登録済みであることと、ハッシュが一致することを確認する。
- `guardMaterialCandidateOperation` を撤去する。差し替えの共有キー検査と共有メッシュ拒否（`material-geometry-reset.ts`、到達性ヘルパー）は残す。
- index.ts の export を更新する。

**operation-core**
- 2 つの operation type、payload schema、同期 handler（dry-run / commit）を追加する。
- payload の中身: 画像パス、RGBA の SHA-256、幅・高さ、配置、足し方（追加: 部品 ID、表示名、親パーツ、挿入位置、デフォーマ、マスク、可視性、既定の不透明度／差し替え: 部品 ID、リセットする形のキー ID 一覧）、来歴メモ。
- バイトがセッションに無い、またはハッシュが合わない場合は error で拒否する。

**validator-core**
- `material-candidate-integration.test.ts` を、新しい 2 関数の結果が通常の validator を通ることの確認に置き換える。

**完了条件**
- `pnpm check`（typecheck、test:unit、check:deps、check:source、check:soul-zone）が通る。check:source に既知の担当外違反が残っていれば、その旨を記録する。
- 新しい handler の単体テストで、次を確認する:
  - 追加: 部品・メッシュ・パーツ内の位置・描画順・デフォーマ・マスク・テクスチャの項目に寸法と inset が付くこと。
  - 差し替え: 部品 ID が維持され、宣言したキーだけが消え、共有キーと共有メッシュは拒否されること。
  - バイトが無い場合、またはハッシュが不一致の場合に拒否されること。
  - dry-run が元のセッションを変えないこと。

## Wave 2: ホスト層（apps/authoring-host / ai-interface）

**ロックとエラー型**
- `withMaterialPackageLock` と `MaterialHostError` を、素材ではない中立なモジュール（例: `package-lock.ts`、`host-error.ts`）へ移す。全コマンドの挙動は変えない。

**PNG の取り込み**
- `dryRunOperation` / `commitOperation` で operationType が上の 2 つのときは、operation を流す前に次を行う:
  1. payload のパスから PNG を読む
  2. 検査する（`material-png-validation.ts`、`material-image-decode.ts`）
  3. 同期版でハッシュを計算し、payload と照合する
  4. `registerAuthoringSessionBinaryBytes` で登録する
- 失敗したら operation を流さずに拒否する。

**撤去**
- `material-candidate-store.ts`、`material-candidate-operation.ts`、`material-candidate-apply.ts`、`material-package-fingerprint.ts`（パッケージ外への書き出し検査は残す機能側へ移す）、`material-package-transaction.ts`（ロック以外）と、各テスト。
- `material-command-test-fixtures.ts`、`material-roundtrip.test.ts`、`run-material-command.test.ts`、`material-transaction-failures.test.ts`。

**素材コマンドの振り分け**
- `run-material-command.ts` を、読み取り専用の 2 コマンドだけを捌く形に書き直す。
- `material-comparison-viewer.ts` は working モードを撤去する。placement モードを残すかは実装時に判断し、残さない場合は撤去する。

**ai-interface**
- 10 コマンドを撤去し、読み取り専用 2 コマンドを追加する。
- コマンド名・payload・response の列挙と、executor の扱いを追随させる。

**テスト**
- 新しいテスト:
  - CLI 経由で、fixture パッケージに PNG から部品を足す（dry-run → commit → 再読込 → 描画）。
  - 差し替え（同じ流れ）。
  - バイト登録の失敗時に JSON が書かれないこと。
- 移植: `material-atlas-stale.test.ts` の意図（差し替え後に古い atlas preview が stale になる）を、新しい操作の経路へ移す。

**文書と成果物**
- `MATERIAL_COMMANDS.md` を書き直す: 読み取り専用 2 コマンドと、2 つの operation の dry-run / commit の使い方。git とコミットの扱いは書かない（呼び出し側の運用）。
- `llm-workspace/material-interface-*` を削除する（gitignore 対象のローカル成果物）。

**完了条件**
- `pnpm check`、`pnpm test:authoring-host`、`pnpm typecheck:authoring-host` が通る。
- 実パッケージを複製した一時ディレクトリで、追加の dry-run → commit が 1 分以内に終わること。パッケージ外に複製・退避・候補置き場が作られないこと。

## Wave 3: 記録（L0）

- 置き換える文書（wave-plan、contract、wave-1-a）の冒頭に Superseded 注記を入れ、本計画と判断へリンクする。
- `reference-guided-rigging/_map.md`、`experiments/_map.md`、`implementation/reviews/reference-guided-rigging/_map.md` の状態欄を更新する。
- completion を `experiments/material-interface-git-completion.md` に、レビューを `discussion/implementation/reviews/reference-guided-rigging/material-interface-git-wave-{1,2}.md` に置く。

## 後続（この計画の外）

- technique-catalog の顎下の影の続き。r2152 の `workspace/` に、首をマスクにする `setMaskRelation` を普通の操作で入れ、描画順を確認し、正面と上向きの差分を描画する。
