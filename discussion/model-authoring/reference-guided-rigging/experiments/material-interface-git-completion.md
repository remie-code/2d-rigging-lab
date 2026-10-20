# 素材インターフェース git 前提化 completion

状態: Wave 1・2 実装済み、ブランチ `authoring-host/material-interface-on-git` にコミット済み。master 未マージ。実モデルでの制作往復（顎下の影の続き）は未実施。
Basis: [判断](../material-interface-git-redesign.md)、[計画](../material-interface-git-wave-plan.md)。レビュー: [Wave 1](../../../implementation/reviews/reference-guided-rigging/material-interface-git-wave-1.md)、[Wave 2](../../../implementation/reviews/reference-guided-rigging/material-interface-git-wave-2.md)。

## コミット

| コミット | 内容 |
|---|---|
| 6bcbc164 | 判断と計画、旧 wave plan・契約・Wave 1 A の Superseded 注記 |
| d095bf6c | Wave 1: `addDrawableFromImage` / `replaceDrawableImage`（operation と authoring-core 関数）を追加。旧経路は温存 |
| 9df53322 | Wave 2: ホストの PNG 取り込み、旧経路の撤去、読み取り専用 2 コマンド、ロック・エラー型の移設、`MATERIAL_COMMANDS.md` 書き直し |

## 実装の要点（リポジトリ事実）

- **2 つの operation**: payload には画像パス、RGBA SHA-256、幅・高さ、配置、足し方、来歴メモを持つ。operation log にはパスとハッシュだけが残る（2026-10-20 追記: 操作の記録はその後パッケージから撤去した。根拠: [drop-operation-log.md](../../../design/drop-operation-log.md)）。
- **ID の種**: operationId から作る。operationId を省略した場合は、種別・部品・`r<basePackageRevision>`・ハッシュ先頭 16 桁から決まる。同じ operationId の再実行は `idCollision` で拒否される。
- **ホストの取り込み**: dry-run と commit のたびに次を行う。
  1. PNG を読み、検査し、RGBA8 に正規化する。
  2. 寸法・inset（0 のみ）・同期 SHA-256 を payload と照合する。
  3. セッション上とディスク上のどちらでも、既存の内容と衝突しないことを確かめる。
  4. 別セッションにバイトを登録し、そのセッションで operation を流す。
  - ホストのセッションが差し替わるのは、commit が成功したときだけ。
- **保存**: 画像のバイトを書けない場合は、JSON を 1 つも書く前に拒否する。
- **撤去したもの**:
  - 候補ストア、状態機械、承認、元パッケージの控え、作業用の複製、全ファイル指紋、stage / backup 入れ替え、候補内の範囲ガード
  - 旧 10 コマンド、比較 viewer、関連テスト
  - `llm-workspace/material-interface-*`（ローカル成果物、約 132MB）
- **残したもの**:
  - `extractMaterialSource` と `previewMaterialPlacement`（どちらも読み取り専用）
  - PNG の検査、配置の合わせ込み（対応点と残差）
  - 差し替えの共有キー検査、共有メッシュの拒否
- **ロックとエラー型**: `withPackageLock` / `HostError` として中立なモジュールへ移した。busy の checkId は `authoringHost.packageBusy`。
- **AI 提案カタログ**: 新 2 operation は載せない。提案の dry-run は PNG 取り込みを持たない経路で行うため。

## 検証（実験結果）

| 確認 | 結果 |
|---|---|
| `pnpm typecheck` / `pnpm typecheck:authoring-host` | 通過 |
| `pnpm test:unit` | 250 ファイル / 1554 件通過 |
| `pnpm test:authoring-host` | 162 件中 161 件通過 |
| `pnpm check:deps` / `pnpm check:soul-zone` | 通過 |
| `pnpm check:source` | 違反 1 件 |
| 実モデル r2152 の複製（`.git` を除く 399MB）で追加の dry-run → commit（Gnome 計測） | dry-run 16.96 秒、commit 32.90 秒。パッケージ外に stage・backup・候補置き場は作られない |

- `test:authoring-host` の失敗 1 件は、`state-directory-guard.test.ts` の ENOENT。変更前から失敗しているもので、今回の変更とは無関係。
- `check:source` の違反 1 件は、担当外の既知違反 `apps/runtime-player/src/main/physiology/index.ts`。
- 旧方式の参考値（2026-10-20 の観測）: 一手ごとに約 5 分、apply 時はメモリ約 8GB。

## 残課題（未決事項）

- `state-directory-guard.test.ts` の既存失敗。ロックより先に state dir を検査すれば直るが、全コマンドの処理順を変えることになる。
- 実モデルの commit 約 33 秒の大半は、`operations/log.jsonl`（約 249MB）の再シリアライズと、全テクスチャの読み比べと推測している（プロファイルは未取得）。素材インターフェースとは別の既存の重さ。（2026-10-20 追記: その後の計測で記録の読み書きが大半と確かめ、記録の撤去とテクスチャ判定の複製の解消で対処した。根拠: [drop-operation-log.md](../../../design/drop-operation-log.md)）
- 判断文書にある対象外事項（使われなくなったテクスチャの掃除、padding 方針、operating-policies の「非バイナリ」の記述）。
- `AiCommandRequestSchema` が intersection のため、payload の中の未知キーを拒否しない（以前からの挙動）。
