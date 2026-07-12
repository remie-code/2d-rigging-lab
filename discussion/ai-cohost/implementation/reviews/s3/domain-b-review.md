# S3 Domain B 統合レビュー: 操縦席拡張 + 本番結線 + AHK 同梱 + 計測 + docs

> 判定: **PASS（blocking ゼロ）**。2026-07-12, Orch-Sylph が 3 レーン（spec / design / test）を統合。
> 対象: `apps/soul/agent/src/cockpit/cockpit.html`・`scripts/cockpit.mjs`・`scripts/cockpit.test.mjs`・`scripts/fire-hotkey.ahk`・`scripts/measure-fire.mjs` + docs（soul-cockpit.md / README / human-gate-procedure / s3-followup / experiments/s3-summon.md）。Gnome 実装記録: [../../waves/s3/domain-b.md](../../waves/s3/domain-b.md)。
> 判定基準: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §3 Domain B・§4 blocking 基準・[domain-a-review.md](domain-a-review.md) §3 引き継ぎ 4 件。
> レーン別詳細: [domain-b-review-spec.md](domain-b-review-spec.md) / [domain-b-review-design.md](domain-b-review-design.md) / [domain-b-review-test.md](domain-b-review-test.md)。
> 規律: **measure-fire.mjs は 3 レーンとも再実行禁止**（実 SDK 消費・上限 5 ask は Gnome が消費済み）。数字の裏取りはコード読解 + 記録間の検算（test レーン §4 が転記・合計の内部整合を全数一致で確認）。

## 0. 総合判定

**PASS。全 3 レーン blocking ゼロ。** Orch も機械ゲート（node --test / preflight 2 種 / lockfile / 3 チェック）を独立に再実行し一致を確認。

| レーン | 判定 | 独立裏取り |
| --- | --- | --- |
| spec（契約適合） | PASS | wave 計画 §3 Domain B 全項目の実体化・ワイヤ契約（domain-a.md §2）の過不足ない消費・裁定 1（AHK 同梱 + README + 任意性明記）・人間ゲート手順書の完全性（choke point はユーザー作業のみ）・引き継ぎ 4 件全充足を突合。 |
| design（品質・自己完結・安全） | PASS | Domain A 成果への Domain B 由来混入なし（記録と 1:1 突合）・llm-session/speak/ear-pipeline/cli 完全不変・cockpit.html 外部リソースゼロ（機械検索 0 件）・--channel 未指定経路の構造的不変・トークン redact・shutdown 全畳み・AHK 127.0.0.1 ハードコード・measure-fire の 5 ask ハードガード実在を確認。 |
| test（テスト実在・機械ゲート） | PASS | 269/269 を独立 2 回実行（決定的）・新規 12 テストはホローでない（挙動の核を assert）・既存テストは末尾追加のみ（単一 hunk 実測）・preflight 2 種 PASS・lockfile 差分ゼロ・計測記録の静的整合（usage 合計等の検算全数一致）。 |

## 1. blocking 基準（wave 契約 §4）の充足

1. **lockfile・器コード・C4 契約・既存挙動不変 + 新規依存ゼロ**: lockfile 2 種 + package.json 差分ゼロ（4 実行者一致）。Domain B の変更は cockpit.html / scripts/cockpit.mjs / docs のみ（追加的）。--channel 未指定時は factory 引数自体が存在しない構造で S2.5 挙動不変（実起動 exit=0 で確認）。**適合**。
2. **3 チェック無退行・実マイク非使用**: check:soul-zone 緑（1320）・check:deps 緑・check:source は器 pre-existing 1 件のみ（S3 新規違反ゼロ・S2.5 と同一状態）——Orch 最終検証で再実測（design レーン質問 1 への回答・§2 生数字）。テストは全 fake・実マイク/録音物/実器/実再生非使用。**適合**。
3. **SDK 実消費は最小・環境変数ガード遵守**: 実 ask は measure-fire.mjs の **5 回のみ**（上限 5 の契約どおり・6 回目 throw のハードガードをコードで確認）。env ガードは measure-fire 冒頭 + cockpit.mjs --channel 経路 + llm-session 内の三重。**適合**。
4. **発火口が 127.0.0.1 の内側**: AHK は 127.0.0.1 ハードコード（外部送信なし）。cockpit は既存 loopback バインド不変。**適合**。
5. **終了処理・タイムアウト**: shutdown で server→session→player→channel を各 try/catch で全畳み（EOF clean exit=0 実測）。新規テストはタイムアウト付き（cockpit-page 追加分は同期静的検査のため不要 = 既存型どおり）。**適合**。

## 2. 裏取りの生数字（3 レーン + Orch 一致）

- `node --test`（apps/soul/agent）→ `tests 269 / pass 269 / fail 0 / cancelled 0 / skipped 0`（baseline 257 + cockpit-page +6 + scripts/cockpit +6。test レーン 2 回実行で同数 = 決定的。non-blocking 即時回収後の再実行でも 269/269）。
- `node scripts/preflight-fire.mjs` → `RESULT: PASS / EXIT=0`（Domain A 無退行）。`node scripts/preflight-cockpit.mjs` → `RESULT: PASS / exit=0`（S2.5 無退行）。
- `echo "" | node scripts/cockpit.mjs --port <N>`（--channel なし）→ `fire disabled` 表示・EOF clean close・exit=0（従来挙動）。
- 3 チェック（Orch 最終検証・2026-07-12）: `check:soul-zone` **緑（1320 ファイル・違反ゼロ）** / `check:deps` **緑** / `check:source` **器 pre-existing（apps/runtime-player/src/main/physiology/index.ts）1 件のみ**（.ts 限定スキャン・S3 の新規 .mjs/.html/.ahk は非対象 = 新規違反ゼロ・無退行）。
- lockfile 3 種（pnpm-lock.yaml / package-lock.json / package.json）差分ゼロ。
- 実 SDK 計測（Gnome 実行・再実行禁止で記録検算のみ）: 5/5 fired・TTFT 3196.4〜3943.4ms・ask 5954.7〜6750.7ms・usage 合計 input 2,273（+cache_creation 1,273）/ output 189 tok（[../../../experiments/s3-summon.md](../../../experiments/s3-summon.md) §1・転記/合計の検算一致を test レーンが確認）。

## 3. 非 blocking 事項の処理

**wave 内で即時回収済み（Gnome・字面のみ・回収後 269/269 緑）:**
- spec §8-1: cockpit.html ヘッダコメントの契約参照を S2.5+S3 併記に更新。
- spec §8-3: soul-cockpit.md §2.1 の reason 列挙に empty-reply を追加（+ 同種の cockpit.html CSS 行内コメント 1 箇所も回収）。
- spec §8-2: 既存テスト名の含意ズレ（「other diagnostic types do not」）を s3-followup.md §2-5 に台帳化（既存テスト変更禁止の規律により名前は S3 で触らない）。

**台帳へ記録済み（[../../waves/s3/s3-followup.md](../../waves/s3/s3-followup.md)）:**
- lazy channel の切断非回復（§2-1）・main 実配線の機械テスト無し（§2-2）・fire-note の表示残留（§2-3）・発火マーカー非復元（§2-4）・テスト名含意ズレ（§2-5）・Q1〜Q3 見送り分（§1-1〜1-3）・遅延 append 観測（§1-4・s3-summon.md §3 に記入欄）。
- design §9-1（AHK の COM オブジェクト寿命・導入時 1 回の動作確認で足りる）・§9-2（fetch catch 経路の一瞬の有効化・サーバ側 busy が防波堤）・§9-3（shutdown の外側 try・cli.mjs 型踏襲）は実害なしの記録のみ（ゲート後の運用で気になれば数行）。

## 4. Orch 判断（レーン質問への回答）

- **design 質問 1（3 チェックの生数字）**: Orch が最終検証で再実測し §2 に記録（domain-b.md §3 にも Orch 追記）。充足。
- ページ load 時の soul 状態 idle 固定描画（Gnome 質問 2）は domain-a.md §2.3 の契約（SSE soul で足りる・/api/state 非搭載）どおりの消費で妥当。/api/state への fireState 搭載は Domain A 拡張として followup の領分（S3 では見送りで正しい）。
