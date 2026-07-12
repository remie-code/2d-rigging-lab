# S2.5 Domain B 統合レビュー: ページ本体 + 永続化 + 起動導線 + preflight + 仕上げ

> 判定: **PASS（blocking ゼロ）**。2026-07-12, Orch-Sylph が 3 レーン（spec / design / test）を統合。
> 対象: `apps/soul/agent/src/cockpit.html`・`cockpit-page.mjs`・`cockpit-settings-store.mjs`・`scripts/cockpit.mjs`・`scripts/preflight-cockpit.mjs`（+ テスト 2 本）。Gnome 実装記録: [../../waves/s2.5/domain-b.md](../../waves/s2.5/domain-b.md)。
> 判定基準: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §4 / [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md)。
> レーン別詳細: [domain-b-review-spec.md](domain-b-review-spec.md) / [domain-b-review-design.md](domain-b-review-design.md) / [domain-b-review-test.md](domain-b-review-test.md)。

## 0. 総合判定

**PASS。全 3 レーン blocking ゼロ。** Orch も機械ゲートを独立に再実行し一致を確認。

| レーン | 判定 | 独立裏取り |
| --- | --- | --- |
| spec（画面要件・手順書） | PASS | soul-cockpit.md §2 の全要素が DOM 構造として存在（9 識別子固定）。ワイヤ契約を齟齬なく消費。人間ゲート手順書が CLI 不使用で完結。起動 1 コマンド。 |
| design（品質・自己完結・安全） | PASS | ページ外部リソースゼロ・settings store 失敗寛容/非汚染・cockpit.mjs clean 終了・127.0.0.1 固定・既存コード非接触を `git`/`node --test`/preflight で独立実測。 |
| test（テスト実在・機械ゲート） | PASS | `226/226`・新規 9/9・preflight PASS(exit0/ハングなし)・3 チェック・lockfile 差分ゼロ・実設定ファイル非汚染を独立実行で再現。テストはホローでない。 |

## 1. blocking 基準（wave 契約 §4）の充足

1. **lockfile 不変・新規 npm 依存ゼロ**: `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json` = 差分ゼロ（3 レーン + Orch 一致）。`package.json` は `scripts` に `cockpit` 1 行追加のみ・`dependencies` 不変。ページは vanilla + ブラウザ組み込み（`EventSource`/`fetch`）・外部リソース/CDN ゼロ（テストで固定）。**適合**。
2. **3 チェック無退行**: `check:soul-zone` 緑（1312 ファイル）・`check:deps` 緑。`check:source` は器の `apps/runtime-player/src/main/physiology/index.ts`（pre-existing・S2.5 無関係）1 件のみで赤——**Domain B 新規ファイル（.mjs/.html）の新規違反ゼロ**（このチェックは .ts のみ走査）。無退行。**適合**。
3. **127.0.0.1 限定バインド**: 起動エントリ・preflight とも loopback 固定。Domain A の `assertLoopbackHost` を崩さず利用。**適合**。
4. **実マイク音声・録音の非使用/非保存**: テスト・preflight とも実 ffmpeg/実マイク不使用（ffmpeg 不在環境でも `/api/devices` は 200+空配列+error）。実設定ファイル `cockpit-settings.local.json` は全実行後も未作成（非汚染を実測）。**適合**。
5. **終了処理明示 + UI を閉じても魂が生きる**: `cockpit.mjs` は SIGINT/stdin EOF で `server.close()`→`process.exit(0)`（ハングなし・preflight/Orch 実測）。UI 生存性はサーバ本体（Domain A）で固定済み。**適合**。

## 2. ワイヤ契約の消費（domain-a.md §3-5 → UI）

ページは Domain A の契約だけを消費: `GET /api/devices`→ドロップダウン、`GET /api/state`→履歴復元+ヘッダ/フッタ、`POST /api/ears/start|stop`→Start/Stop、SSE `state`→ヘッダ/フッタ更新（down は赤+reason）、`vad`→(speaking) ライブ行、`transcript`→本文行（latency は live のみ）、`discard`→footer discarded。拡張予約（話者 you/soul・空 .marker・diagnostic 購読口）は枠だけ・作り込みなし。認証/転写編集/設定編集 UI なし（§4「ないもの」尊重）。

## 3. 非 blocking 事項（followup 台帳 `s2-5-followup.md` へ記録済み）

- **N1**: 履歴レイテンシ非対称（正本 transcript-buffer に latency フィールドが無いことに合わせた設計どおり・回収不要。ただし soul-cockpit.md §2 モックとの字面差＝**Undine 確認事項**として残存）。
- **N2**: `cockpit-page.test.mjs` の履歴レイテンシ非対称テストは静的コード検査止まり（実装コードとは一致・実害なし）。
- **N3**: `scripts/cockpit.mjs` の起動導線（URL 表示・SIGINT/EOF clean close）自体の機械テストが無い（サーバ本体 close は Domain A で固定・実挙動は preflight+人間ゲート Ctrl+C で担保）。**Orch が followup §1-5 に追記**。
- **N4（spec）**: (speaking) ライブ行の時刻列がモック図と異なり空表示（軽微・見た目は人間ゲート領分）。
- **N5**: 409 / devices 失敗 HTTP の回帰固定は Domain A テスト（変更禁止）側の欠落（followup §1-1,1-2）。Domain B スコープ外で正しい線引き。

## 4. Orch 判断（Gnome/レビュー質問への回答）

- **Domain B が Domain A テストに触れないのは正しい線引き**（Gnome Q1・test レーン確認）。409/devices 失敗 HTTP の回帰固定は Domain A の契約対象——S2.5 では Domain A の `cockpit-server.test.mjs` を変更禁止としたため wave 内では回収せず followup 化。実挙動は preflight（devices 失敗 200+error を実測）+ ページ側 disable（409 多重抑止）で担保済み。恒久固定は S3 以降で Domain A テストへケース追加が素直。
- **uptime のクライアント側ローカル刻みは v0 で十分**（Gnome Q2・両レーン一致）。厳密化は S3 のコストメーター/レイテンシ実測と同時に tick イベントを足すのが素直（followup §2-1）。
- **履歴レイテンシ非対称の最終裁定は Undine へ申し送り**（正本を汚さない v0 非対称を許容するか。実装は契約どおりで blocking ではない）。

## 5. 裏取りの生数字（3 レーン + Orch 一致）

- `node --test`（`apps/soul/agent`）→ `tests 226 / pass 226 / fail 0 / cancelled 0 / skipped 0`（196 + Domain A 21 + Domain B 9）。
- `node --test src/cockpit-page.test.mjs src/cockpit-settings-store.test.mjs` → `tests 9 / pass 9 / fail 0`。
- `node scripts/preflight-cockpit.mjs` → `RESULT: PASS` / `EXIT=0` / server closed no hang / 127.0.0.1 バインド。
- `check:soul-zone` 緑（1312）/ `check:deps` 緑 / `check:source` 赤（器 pre-existing のみ・新規違反ゼロ）。
- lockfile 2 種差分ゼロ。実設定ファイル `cockpit-settings.local.json` 未作成（非汚染）。Domain A の `cockpit-server.mjs`/`.test.mjs` 無変更。
