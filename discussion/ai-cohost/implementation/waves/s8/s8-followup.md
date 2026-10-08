# S8 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-16, Gnome / S8 Domain C）。台帳の流儀は
> [../s7/s7-followup.md](../s7/s7-followup.md) を踏襲。
> 出典: [domain-a.md](domain-a.md)（Domain A 実装報告・裁量判断/質問）+
> [domain-b.md](domain-b.md)（Domain B 実装報告・裁量判断/質問）+
> 本 domain-c.md（Domain C 実装報告）+
> [../../orchestration/s8-wave-plan.md](../../orchestration/s8-wave-plan.md)。

## 1. S8 で新設された語彙（reason / 診断 type / snapshot キー）

fire-orchestrator の戻り値・診断・cockpit-server の snapshot に、S8 で以下が新設された:

- **戻り値 `reason`**:
  - `"killed"` — `fire()` 冒頭ガード（キル中は全発火経路を弾く。manual・視覚・自発 preferred 共通）。
  - `"killed-inflight"` — in-flight 破棄（ask を撃った後にキルされたケース。Domain A）。
  - `"ng-blocked"` — NG 没（TTS 直前検問所で NG 語命中により丸ごと没。Domain C）。
- **診断 `type`**:
  - `"kill"` — キルによる再生中切断発生（`elapsedMs`/`charsSpoken`/`totalChars`/`prefix`）。
  - `"killStopError"` / `"killMouthCloseRejected"` / `"killMouthCloseError"` — `severSpeaking` の
    エラー系診断を kill 経路でパラメータ化したもの（bargeIn 系と対称）。
  - `"killDiscarded"` — in-flight 破棄の事実のみ（`{type}` のみ・本文非搭載）。
  - `"ngBlocked"` — NG 没の事実のみ（`{type}` のみ・命中語も応答本文も非搭載）。
- **snapshot キー**: `killed`（boolean・cockpit-server 正本・常に boolean で既定 false）。

いずれも既存の `reason`/`type`/snapshot キーと衝突しない新設のみ（additive）。

## 2. 申し送り（Domain A/B レビューより・Domain C 委任プロンプトに明記されていた既知事項）

### (a) 再生中 kill の `fire()` Promise は barge-in と見分けがつかない

`kill()` 実行時に再生中の発話があると、`severSpeaking()` を barge-in（`interrupt()`）と共有するため、
`fire()` の Promise は `{fired:true, interrupted:true, replyText:<声に出た接頭辞>, ...}` を返す。
これは barge-in 中断と同一の意味論（DRY を優先した設計・domain-a.md 裁量判断 4）であり、「kill され
たのに `fired:true`」という見た目になるが、「発話は始まり、途中で強制切断された」という事実を素直に
表している。

**kill API のレスポンス正本は snapshot（+ `kill()` 自身の戻り値）であり、`fire()` には依存しない**
（Domain B は実装済み・`POST /api/kill` は `fireOrchestrator.kill()`/`revive()` を呼ぶが、レスポンス
は `snapshot()` のみを返す設計。`kill()` 自身の戻り値に `elapsedMs`/`charsSpoken`/`prefix` が含まれ
るため、Domain B は `fire()` の Promise を待つ必要がない）。この設計は既に確定・実装済みであり、
Domain C の検問所（NG 最終検査）はこの構造に影響しない（NG 没も `fire()` の戻り値 `reason:
"ng-blocked"` として同様に正直に返る）。

### (b) born-killed 配線（`initialKilled`）は正しいが、現アーキでは今日到達しない経路

`createFireOrchestrator({ initialKilled })` は正しく実装されており（`getKilled()` が直後から
`true`）、cockpit-server も `fireOrchestratorFactory` の hooks へ `initialKilled: killed`（サーバ
正本）を渡している。しかし**現アーキでは orchestrator 本体が構築時に一度だけ eager 生成される**
（session/player は「実際に fire される時」まで遅延生成されるが、orchestrator 自体は遅延しない）
ため、「キル中に新しい orchestrator が生まれる」という状況が今日のコードパスには存在しない。
`initialKilled=true` の経路は**将来 orchestrator 再生成経路が入った時のための担保**として実装済み
（無駄ではないが、現状は到達しないコードであることを記録しておく）。

## 3. v0 外として送った項目（裁定 2・過剰に広げない）

- **URL/電話番号パターンの読み上げ抑止**: NG 最終検査は語彙の部分一致のみを扱う。個人情報パターン
  （URL・電話番号等）の読み上げ抑止は別の検査軸であり v0 外。
- **NG リストの拡張**: 現在は差別語級の最小 starter list（3〜5 語・`src/mind/ng-words.mjs`）のみ。
  軽度の悪態・スラング等への拡張は v0 外（過剰に広げない）。
- **NG 語形変化/難読化対応**: 現在の照合は NFKC 正規化 + 部分一致の素朴形のみ。伏字・読み替え・
  分かち書き崩し・濁点分解等の難読化対応は v0 外。

## 4. 人間ゲート（縮小裁定・§1）— 未実施（ユーザー作業・choke point）

S8 wave 計画（s8-wave-plan.md §1）の人間ゲート 2 点は、本 Domain C（機械テストのみ）の完了時点では
未実施:

- [ ] ①発話中にキル（ホットキー `^!k` または操縦席 KILL ボタン）→ 声が即座に切れ・口が閉じ・以後の
  発火（manual 含む）が全て弾かれ・操縦席にキル状態が見える → 一クリック復帰 → 次の発火が普通に動く。
- [ ] ②弁（キルスイッチ・NG 最終検査）が通常の発話を一切邪魔しない（普段どおり喋れる）。

choke point（s8-wave-plan.md §5）: AutoHotkey スクリプトの再読み込み（`^!k` 追加後）・概要欄への開示
文言貼り付け（L0 起草後）・人間ゲート実施。install 作業なし（新規依存ゼロ）。

## 5. wave 外（L0 直轄・コードなし）

AI 開示文言の起草 + 配信前チェックリスト → `discussion/ai-cohost/operations/pre-stream-checklist.md`
（L0 が起草・ユーザーが概要欄へ貼る）。Domain C は README にその存在へ言及するのみで、このファイル
自体は作成していない（wave 計画のとおり L0 の領分）。

## 6. NG 誤爆（false positive）の具体例 — 人間ゲートで NG リストを見直す際の提示材料（L0 追記 2026-07-16）

Domain C の design レーンが発見し、Orch-Sylph が独立に再現確認した、**素朴な部分一致ゆえの誤爆**:

| 入力（通常語） | 判定 | 原因（NG 語） |
|---|---|---|
| ガイジン | true（没） | 「ガイジ」を部分文字列として含む |
| 本土人口 | true（没） | 「土人」 |
| 郷土人形 | true（没） | 「土人」 |
| つんぼ桟敷 | true（没） | 「つんぼ」 |
| こんにちは | false（正常） | — |

- 検査対象は**コーディの生成文**（転写ではない）。Opus が「ガイジン」「本土人口」等をカタカナ/漢字
  そのままで生成する頻度は高くないと見られるが、ゼロではない。命中すると**その一言が黙って没になる**
  （操縦席の diagnostic に `ngBlocked` は出る）。
- 対処の在り処は 1 箇所: `apps/soul/agent/src/mind/ng-words.mjs` の `NG_WORDS`（語の差し替え/削除）。
  語形境界判定の導入は v0 外（§3）で、必要になったら将来拡張。
- **運用推奨（L0）**: v0 はこのまま人間ゲートへ。配信中に `ngBlocked` が出たのに心当たりがない場合は
  誤爆を疑い、このリストを編集する。ゲート時にユーザーがリスト自体を確認・裁定する（starter list の
  裁定どおり）。
