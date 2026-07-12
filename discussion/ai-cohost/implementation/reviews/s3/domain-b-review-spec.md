# S3 Domain B レビュー（spec レーン）: 操縦席拡張 + 本番結線 + AHK 同梱 + 計測 + docs

> 判定: **PASS（blocking ゼロ・non-blocking 3 件）**。2026-07-12, Review-Sylph（spec）。委任元 Orch-Sylph。
> 判定基準: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §2 裁定・§3 Domain B・§4 blocking・§5 choke point /
> [../../waves/s3/domain-a.md](../../waves/s3/domain-a.md) §2 ワイヤ契約 / [domain-a-review.md](domain-a-review.md) §3 引き継ぎ 4 件。
> Gnome 実装記録: [../../waves/s3/domain-b.md](../../waves/s3/domain-b.md)。
> 検査方法: コード読解 + 記録との突合のみ（**measure-fire.mjs は実行していない**——実 SDK 消費の規律。
> 実マイク・実器・実再生も不使用）。数字の独立再実行は test レーンの領分。

## 0. 総合判定

**PASS。** wave 計画 §3 Domain B の全項目が実体化され、ワイヤ契約（domain-a.md §2）の消費は契約に
過不足なく、裁定 1（AHK）と人間ゲート手順書は成立し、引き継ぎ 4 件はすべて充足または台帳に記録済み。
契約齟齬なし。

## 1. 問い 1: wave 計画 §3 Domain B の全項目の実体化 — 充足

| §3 項目 | 実体 | 所見 |
|---|---|---|
| Fire ボタン（busy 表示連動） | `cockpit.html` `#btn-fire` + `applySoulState()` | SSE `soul`（idle/thinking/speaking）連動で idle 以外は disable + アンバー表示。クリック直後の即 disable（連打防止）→ POST 応答の `state` で復帰。二重の防波堤（サーバ側 busy 無視）と整合 |
| Timeline の soul 行（スタイル差） | `addTranscriptRow` の `row speaker-<speaker>` + `.row.speaker-soul .who { color:#8fb7ff }` | S2.5 の受け口の実体化（新規行描画コードなし・履歴復元でも speaker が届く）。テスト固定あり |
| 発火マーカー | `addFireMarkerRow`（SSE `fire` accepted:true）→ `.row.fire-marker`（--speaking） | `fired (N lines, M chars injected)` で注入量も可視。独立行採用の理由（thinking の時間差が読める）は soul-cockpit.md §2.1 に記録 |
| AHK 同梱 + README 導入手順 | `scripts/fire-hotkey.ahk` + README S3 節 + 手順書 §9 | 問い 3 参照 |
| 計測 → s3-summon.md | `scripts/measure-fire.mjs` → `experiments/s3-summon.md` | 問い 7 参照。TTFT/usage/注入文字数は機械実測、音声開始 E2E は人間ゲート記入欄（§4）——全器官必須のため機械で計らない切り分けは wave 計画 §1（人間ゲートの定義）と整合 |
| docs（README・人間ゲート手順書・followup） | README S3 節 / `waves/s3/human-gate-procedure.md` / `waves/s3/s3-followup.md` | いずれも実在・内容が実装と一致（問い 4・5） |

また §2 裁定 2 の「X・上限は設定値」は `--fire-window-min` / `--fire-max-chars`（`scripts/cockpit.mjs`）で
充足（soul-cockpit.md §4「設定の編集 UI は作らない = CLI フラグのまま」とも整合）。裁定 5 の busy 表示も充足。

## 2. 問い 2: ワイヤ契約（domain-a.md §2）の正しい消費 — 適合・契約外期待なし

- **POST /api/fire**: body `{}`・503 → `fire not available (start cockpit with --channel)` 案内・
  `fired:false` → `not fired: <reason>` を淡色 `#fire-note` へ・応答の `state` で busy 復帰判定。
  契約の 202/200/503 と reason 集合（busy/ears-not-running/empty-window/empty-reply/error）に過不足なく
  対応（reason は汎用表示なので集合の将来拡張にも壊れない）。status 202 を特別扱いせず `fired` で
  分岐するのは契約の意味論どおり（頑健な消費）。
- **SSE `soul`**: `{state}` のみ読む。契約どおり。
- **SSE `fire`**: accepted:true → `atMs/includedCount/injectedChars`（すべて契約掲載フィールド。欠損は
  `?` フォールバック）、accepted:false → reason 表示。契約どおり。
- **SSE `transcript`（speaker:"soul"）**: 既存行描画が `d.speaker || "you"` で分岐——契約 §2.2 の
  「既存 transcript 描画に speaker で行スタイル分岐すればよい」を字義どおり実装。
- **diagnostic fireEmptyReply / fireError**: `(fire: empty reply)` / `(fire error: <message>)` の
  ゴースト行。`message` は domain-a.md §1.3 の onDiagnostic 契約に載るフィールドで、契約外期待なし。
- **契約外を期待していないことの確認**: GET /api/state に発火状態を期待していない（load 時は idle 固定
  = domain-a.md §2.3「SSE soul で足りる想定」どおり。開き直し時の一瞬の idle 表示は domain-b.md §4-2 に
  正直に記録済み・実害なしの説明も妥当）。`server.fireState()`（HTTP 未露出）にも触れていない。
- サーバ実装（cockpit-server.mjs L600-611）と突合し、202/200/503 と `state` 補完が契約どおりであることを
  独立確認（Domain A ファイルは Domain B で無変更——git diff は cockpit.html / cockpit.mjs / README /
  soul-cockpit.md の 4 変更 + 新規 4 ファイルのみ）。

## 3. 問い 3: 裁定 1（AHK）の充足 — 適合

- `scripts/fire-hotkey.ahk`（AutoHotkey v2・`#Requires v2.0`）: 既定 Ctrl+Alt+F（`^!f::`）→
  `POST http://127.0.0.1:<CockpitPort>/api/fire`。**グローバルキー → POST /api/fire の形で成果物として
  同梱**。127.0.0.1 ハードコード（外部送信なし = wave 計画 §4-4 の精神とも整合）・非同期送信で
  ゲームを止めない・失敗は握る（ゲーム中に邪魔しない）。ポート既定 8181 は `DEFAULT_COCKPIT_PORT`
  と一致。
- **導入手順**: ファイル内コメント（4 ステップ + カスタマイズ）+ README S3 節（AHK v2 インストール →
  ダブルクリック → Ctrl+Alt+F・ポート/キー編集箇所・127.0.0.1 限定）+ 人間ゲート手順書 §9。README の
  詳細はファイル内コメントへの参照だが導入の要点は README 本文にも書かれており「README に導入手順」を
  満たす。
- **「ゲートはボタンで成立・AHK 任意」の明記**: fire-hotkey.ahk 冒頭・README（「AHK が無くてもゲートは
  Fire ボタンで成立する」）・手順書 §9（「ゲート後の任意」）・soul-cockpit.md §2.1 の 4 箇所で明記。充足。

## 4. 問い 4: 人間ゲート手順書の完全性 — 適合

`waves/s3/human-gate-procedure.md` は S2.5/S1 手順書の型（なぜ人間か → 起動手順 → 判定 → 終了 →
トラブルシュート表）を踏襲し、wave 計画 §5 の choke point を過不足なく手順化:

1. §1 AivisSpeech 起動（疎通 curl つき）→ 2. §2 器 + Channel（Endpoint URL の控え方）→ 3. §3 操縦席
   `--channel` 起動（起動コマンド 1 個・`fire enabled` 行の確認・lazy connect の注意 = 器が後でも可）→
   4. §4 ブラウザ + マイク Start → 5. §5 独り言（「聞いているがまだ考えていない」の明記）→ 6. §6 Fire
   （マーカー行 → thinking → soul 行の観察点）→ 7. §7 合格判定 =「直前の話を踏まえた返事が**声 + 口**で
   返る」（wave 計画 §1 の文言どおり・「無関係の定型あいさつではない」の判定補助つき）→ §8 終了
   （clean close）。
2. **choke point はユーザーの作業のみ**: 全手順が実マイク・実器・実再生・サブスク OAuth を要する = 機械で
   代行できない領分に限定。エージェント非実行の規律も冒頭に明記。s3-summon.md §3/§4 の記入欄への誘導
   （E2E 3 回 + 遅延 append 観測）も §7 に組み込まれている。
3. §10 の切り分け表は S3 の新規失敗様式（fire disabled / ears-not-running / empty-window / fire error の
   各種）を網羅し、S1/S2.5 手順書への参照で既知様式を重複させない。前提（vendor 配置・/login・env
   ガード）はヘッダに合算されている。

## 5. 問い 5: 引き継ぎ 4 件（domain-a-review.md §3）の処理 — 全件充足/記録

| # | 引き継ぎ | 処理 | 所見 |
|---|---|---|---|
| 1 | Undine 裁定: 遅延 append の観測項目を s3-summon.md へ | **充足** | s3-summon.md §3 に (a) 意味順の捻れ (b) 窓の遅延感度の両論点・観測方法・記入欄・「本計測では構造上発生しない 0/5」の正直な注記。followup §1-4 にも台帳化 |
| 2 | Q1〜Q3 の裁量選択の記録 | **充足** | domain-b.md §2 に選択 + 根拠の表、s3-followup.md §1-1〜1-3 に持ち越しとして台帳化。Q2 の「Domain A コードは S3 で変更禁止ゆえ見送り」は wave 分割規律に忠実 |
| 3 | windowMs/maxChars の実設定結線 | **充足** | `scripts/cockpit.mjs` `--fire-window-min`（分 → ms 換算）/ `--fire-max-chars` → orchestrator options へ。未指定は FIRE_WINDOW_MS / FIRE_MAX_CHARS の既定に落ちる（非有限値も既定へ・防御的）。parse はテスト固定（scripts/cockpit.test.mjs） |
| 4 | soul/fire SSE の購読 | **充足** | cockpit.html が `soul`/`fire` を購読（問い 2）。購読の存在はテスト固定（cockpit-page.test.mjs の S3 新規 6 ケース） |

## 6. 問い 6: soul-cockpit.md の更新 — 適合

git diff で確認: **追加のみ**。§2.1 新設（Fire セクション/soul 行/マーカー行/失敗ゴースト行/AHK の
実体化記録・マーカー独立行採用の理由つき）+ §3 の S3 該当 2 行に「**S3で実体化済み**(§2.1)」の注記。
**S6（barge-in）/S7（視聴者コメント）/S8（キルスイッチ等）/コストメーターの予約行は不変**。
§4「ないもの、が設計」も不変（設定 UI を作らず CLI フラグにした Domain B の判断はここと整合）。

## 7. 問い 7: 計測記録の整合（measure-fire.mjs コード ⇔ s3-summon.md）— 適合

コード読解のみで突合（実行していない）:

- **実 ask 上限 5 のハードガード**: `MAX_ASKS = 5`・計測ラッパ `measuringSession.ask` が
  `askCount >= MAX_ASKS` で throw（6 回目拒否）。ループも `i < MAX_ASKS`。s3-summon.md §2 の記載
  （「5 回固定・6 回目 throw」）と一致。env ガード（assertSubscriptionAuthEnv）を起動冒頭で通す =
  wave 計画 §4-3 の環境変数ガード遵守。
- **fake の範囲**: speak/channel/player が fake・session/orchestrator/transcript-buffer/fire-injection が
  実物——s3-summon.md ヘッダの宣言と一致。実マイク・録音物・実器・実 TTS 不使用（§4-2 も充足）。
- **記録欄の構成**: 機械で計れるもの（TTFT/ask/usage/注入 lines・chars）は §1 の表、機械で計れない
  もの（音声開始 E2E・遅延 append 頻度）は人間ゲート記入欄（§4・§3）——「何を計り何を人間ゲートに
  残したか」の切り分けが wave 計画 §1 と一致。
- **転記の内部整合**（妥当性の再実行は test レーンの領分・ここでは構成整合のみ）: 注入 chars の系列
  （36→127→193→253→318）は fixture 発話 + `you: `/`soul: ` ラベル形式と算術一致（#1 = 31 字 + ラベル
  5 字 = 36）。lines の系列（1,3,5,7,9）は「各 fire 前に you 1 件 + soul 応答が正本に積まれる」構造と
  一致。usage 合計（input 2,273 / output 189 / cache_creation 1,273）は表の行和と一致。TTFT/ask の
  数字は domain-b.md §3 と s3-summon.md §1 で一致。

## 8. blocking / non-blocking

**blocking: なし。**

**non-blocking（次に該当ファイルを触る wave で回収推奨・S3 ゲートを妨げない）:**

1. **cockpit.html ヘッダコメントの契約参照が古い**（L139 付近）:「消費するワイヤ契約は Domain A の
   domain-a.md §3（HTTP）・§4（SSE）のみ」は S2.5 文書（waves/s2.5/domain-a.md）を指したままで、
   S3 で waves/s3/domain-a.md §2（/api/fire・soul/fire/diagnostic）も消費するようになった実態と
   ズレた。個別箇所のコメント（§2.1 参照等）は正しいのでコメントのみの問題。
2. **既存テスト名の含意ズレが followup 台帳に未収載**: domain-b.md §4-1 の
   「diagnostic asrFailure adds a ghost row; **other diagnostic types do not**」問題（S3 で
   fireEmptyReply/fireError もゴースト行を出すため名前が実装と食い違う・assert は通る）は実装記録には
   あるが s3-followup.md に行がない。台帳へ 1 行追記しておくと次の回収漏れを防げる。
3. **soul-cockpit.md §2.1 の reason 列挙に empty-reply が無い**:「非受理の reason(busy /
   ears-not-running / empty-window / error)」——契約は empty-reply も含む（画面実装は reason を汎用
   表示するので動作齟齬なし・列挙の網羅性だけの問題）。

## 9. 質問（Orch へ）

なし（spec 観点の疑義はすべて non-blocking として上記に区分した）。
