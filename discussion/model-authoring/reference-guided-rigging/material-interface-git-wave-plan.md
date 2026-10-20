# 素材インターフェース git 前提化 実装計画

状態: 実行中。2026-10-20 ユーザー承認。Wave 1 完了（Gnome 実装、Sylph 1 レーンで PASS with warnings、warning 1・3 と追加テストは Wave 1 内で対応済み、2・4 は Wave 2 の受け入れ条件へ）。ブランチ `authoring-host/material-interface-on-git`（master 4fa1cef0 から）。
Basis: [material-interface-git-redesign.md](material-interface-git-redesign.md)（判断）。棚卸しは 2026-10-20 の Sylph 調査 3 本（実装の地図、バイトの入り口、開発規約）。

## 進め方

- 軽量（判断 9）: wave ごとに Gnome 1 名がテスト込みで実装・自己検証する。wave の終わりに Sylph（sonnet）1 レーンで、計画・判断との突き合わせと差分レビューを行う。
- Gnome はコミットしない。L0 が wave ごとにコミットする。`pnpm install`、新規依存、lockfile の変更は禁止。
- Wave 2 は Wave 1 の公開 API に依存するため直列で進める。各 wave の終わりで全テストが通る状態を保つ（Wave 1 は足すだけ、撤去は Wave 2）。

## 名前（案）

| 種類 | 名前 | 内容 |
|---|---|---|
| operation | `addDrawableFromImage` | 画像から部品を足す |
| operation | `replaceDrawableImage` | 部品の画像を差し替える（部品 ID 維持、メッシュ作り直し、宣言した形のキーだけリセット） |
| AI コマンド（読み取り専用） | `extractMaterialSource` | 現行のまま |
| AI コマンド（読み取り専用） | `previewMaterialPlacement` | 候補なしで、画像パス・配置・足し方・viewport から置いてみる描画を返す |

## Wave 1: パッケージ層に新しい経路を足す（contracts / authoring-core / operation-core / validator-core）

2026-10-20 改定: 候補の型は ai-interface とホストが import しているため、Wave 1 で消すと Wave 2 の担当ファイルが壊れる。Wave 1 は**足すだけ**にして旧経路を動くまま残し、撤去はすべて Wave 2 で行う。

**contracts**
- 指紋を持たない版 `{packageId, packageRevision}` の schema を足す（Wave 2 で sidecar と sourceContext をこちらへ切り替える）。
- 2 つの operation の payload が使う型（足し方・配置・画像の記述）は、既存の `material-intent.ts`、`material-coordinates.ts`、`material-image.ts` を再利用する。足りない分だけ追加する。

**authoring-core**
- 候補を受け取らない 2 関数（追加、差し替え）を足す。
  - 入力: 正規化済み画像の記述子、配置、足し方、来歴メモ、ID の種（operationId 由来）。
  - 処理: ソース・来歴・権利・テクスチャの項目を作り、部品とメッシュを作るか差し替える。
- 既存の `buildMaterialCandidate` は、この 2 関数を呼ぶ形に寄せる（重複を作らない）。ID の種は呼び出し側から渡す（旧経路は候補 ID 由来、新経路は operationId 由来）。
- 画像のバイトはこの層では登録しない。新しい 2 関数は、セッションに登録済みであることとハッシュの一致を確認する。
- 差し替えの共有キー検査と共有メッシュ拒否（`material-geometry-reset.ts`、到達性ヘルパー）は新しい差し替え関数でも効かせる。
- `guardMaterialCandidateOperation` は Wave 2 で撤去する（ホストが使っているため）。
- index.ts の export を追加する。

**operation-core**
- 2 つの operation type、payload schema、同期 handler（dry-run / commit）を追加する。
- payload の中身: 画像パス、RGBA の SHA-256、幅・高さ、配置、足し方（追加: 部品 ID、表示名、親パーツ、挿入位置、デフォーマ、マスク、可視性、既定の不透明度／差し替え: 部品 ID、リセットする形のキー ID 一覧）、来歴メモ。
- バイトがセッションに無い、またはハッシュが合わない場合は error で拒否する。

**validator-core**
- 新しい 2 関数の結果が通常の validator を通ることを確認するテストを足す。`material-candidate-integration.test.ts` の撤去は Wave 2。

**完了条件**
- `pnpm check`（typecheck、test:unit、check:deps、check:source、check:soul-zone）が通る。check:source に既知の担当外違反が残っていれば、その旨を記録する。
- 新しい handler の単体テストで、次を確認する:
  - 追加: 部品・メッシュ・パーツ内の位置・描画順・デフォーマ・マスク・テクスチャの項目に寸法と inset が付くこと。
  - 差し替え: 部品 ID が維持され、宣言したキーだけが消え、共有キーと共有メッシュは拒否されること。
  - バイトが無い場合、またはハッシュが不一致の場合に拒否されること。
  - dry-run が元のセッションを変えないこと。

## Wave 2: ホストの取り込みと旧経路の撤去（apps/authoring-host / ai-interface / contracts / authoring-core / validator-core）

**パッケージ層の撤去（Wave 1 から移したもの）**
- contracts: `material-candidate.ts` と `material-operation-result.ts` を撤去する。残す契約が依存する restPose は残すファイルへ移す。`material-artifacts.ts` の sidecar と sourceContext は、Wave 1 で足した指紋なしの版へ切り替え、候補 ID・候補リビジョン・作業用パッケージを外す。候補 fixture を外す。
- authoring-core: `buildMaterialCandidate`、`guardMaterialCandidateOperation`、候補用 fixture を撤去する。
- validator-core: `material-candidate-integration.test.ts` を撤去する。

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

**Wave 1 レビューからの申し送り（受け入れ条件に含める）**
- ホストは、デコードした幅・高さが payload と一致すること、contentInset が 0 であること、同期で計算した RGBA SHA-256 が payload と一致することを検査する。operation-core は申告された digest と `w*h*4` しか見ない。
- dry-run・拒否・失敗のときに、登録したバイトがセッションにもパッケージにも残らないこと。一時クローンで登録して検証するか、失敗時に登録を取り消す。
- ID の種は operationId 由来（省略時は種別・部品・ハッシュ・basePackageRevision から決まる）。同じ operationId の再実行は idCollision で拒否される。`MATERIAL_COMMANDS.md` に書く。
- ai-interface の AI 提案カタログ（`ai-codex-proposal-operation-catalog.ts`）に新 2 operation を載せるかを明示する。

**完了条件**
- `pnpm check`、`pnpm test:authoring-host`、`pnpm typecheck:authoring-host` が通る。
- 実パッケージを複製した一時ディレクトリで、追加の dry-run → commit が 1 分以内に終わること。パッケージ外に複製・退避・候補置き場が作られないこと。

## Wave 3: 記録（L0）

- 置き換える文書（wave-plan、contract、wave-1-a）の冒頭に Superseded 注記を入れ、本計画と判断へリンクする。
- `reference-guided-rigging/_map.md`、`experiments/_map.md`、`implementation/reviews/reference-guided-rigging/_map.md` の状態欄を更新する。
- completion を `experiments/material-interface-git-completion.md` に、レビューを `discussion/implementation/reviews/reference-guided-rigging/material-interface-git-wave-{1,2}.md` に置く。

## 後続（この計画の外）

- technique-catalog の顎下の影の続き。r2152 の `workspace/` に、首をマスクにする `setMaskRelation` を普通の操作で入れ、描画順を確認し、正面と上向きの差分を描画する。
