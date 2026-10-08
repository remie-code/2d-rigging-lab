# S8「配信に耐える」planning gate 棚卸し

> Status: 完了(2026-07-16)。議論の裁定 + Sylph 二体(キル配管 / 操縦席・検問所)の事実調査を統合。
> 出典: [s-series-decomposition.md](../s-series-decomposition.md) S8 行、議論(2026-07-16)。
> 計画本体: [s8-wave-plan.md](s8-wave-plan.md)。

## 1. 議論の裁定(2026-07-16・ユーザー確定)

### 1-1. 事故モデル(前提)

- **黙る事故は無害・喋る事故だけが危険**。S7 までの「壊れる前提」設計で沈黙側は既に守られており、S8 の安全弁は全て「声になって出ていくもの」だけを向く。
- 声になるものは全て **TTS 直前の一箇所**を通る(S4 タグパーサの住処 = 安全弁の検問所)。
- 想定シーン: ①視聴者の挑発・注入(コメント=赤の他人が書ける唯一の入力) ②LLM の素の踏み外し ③暴走(止まらない・喋りすぎ・自己応答連鎖) ④読んではいけないものの読み上げ ⓪AI 開示(規約・予防)。
- 本丸は**キルスイッチ**(未知の事故への万能解)。機械弁(NG)は既知の最悪語のみ。

### 1-2. 裁定一覧

| # | 論点 | 裁定 |
|---|---|---|
| 1 | キルの深さ | **声の即切断+全発火語彙(manual 含む)OFF・耳と転写は生存・一クリック復帰**。プロセスは殺さない(「一言事故った→切った→30秒後に復帰」を成立させる) |
| 2 | NG ワードの範囲 | **最小リスト**(差別語級の最悪語のみ)。URL/電話番号パターンの読み上げ抑止は v0 外 |
| 3 | キルの届く手 | **操縦席の運転バー KILL ボタン(枠予約済み)+グローバルホットキー**の二本。配信中はゲーム画面注視のためホットキーが実効の手 |
| 4 | NG 命中時の挙動 | **その一言を丸ごと没**(声に出さない)。置換・ピー音・再生成はしない。正本には「没にした」事実だけ記録(没にした内容は書かない) |
| 5 | AI 開示の形 | 開示文言を起草(L0)→ユーザーが YouTube 概要欄に貼る。**配信前チェックリスト**(数行)を台帳に置く。コードなし |
| 6 | ゲートの縮小 | 元定義「30分リハ・キル即効・/usage」のうち /usage は実配信で回収済み(30分で 5h limit 1%未満)、リハ本体も実質先取り済み。縮小後: **「キルを実際に押して声が即座に切れ・自発が止まり・一クリックで復帰する」+「弁が通常の発話を邪魔しない」**の二点 |
| 7 | キルの方向性(小裁定) | ホットキーは**殺す専用**(トグルにしない=二度押しで復帰してしまう事故を防ぐ)。復帰は操縦席の一クリックのみ。キル状態は in-memory のみ(再起動を跨いで永続しない) |

※ 7 は L0 の設計判断(裁定 1・3 の自然な帰結)。wave 計画に組み込み、レビューで妥当性確認。

## 2. リポジトリ事実(Sylph 調査・file:line 付き)

### 2-1. キル配管(Sylph A)

- **全発火の単一合流点**: manual(`POST /api/fire`→cockpit-server.mjs:797 / `POST /api/vision-fire`→:837)も、scheduler 由来 5 種(call/turn-end/silence/comment/comment-call、onFireRequest→cockpit-server.mjs:1162-1190)も、**必ず `fire-orchestrator.mjs:691 fire()` を通る**。disposed チェック(:692)・busy チェック(:696)と同じ位置にガード節を挟める。
  - 注: `fire-scheduler.setEnabled`(fire-scheduler.mjs:545)は**自発 5 種のみ**でmanual 非対象(コメント :48 に明記)——キルのゲートには不足。ゲートは orchestrator 側に置く。
- **声の即切断は barge-in の `interrupt()` が既に持つ**(fire-orchestrator.mjs:421-504): `pb.interrupted=true` → タイマ解除 → `player.stop()`(:436) → 口閉じ `channel.sendSet({slotId:"mouth-open", value:0, ttlMs:400})`(:445-465、定数は barge-in.mjs:44/:50) → `computeSpokenPrefix` で切断点算出 → 正本へ「接頭辞+…(遮られた)」追記(:483-489) → resolve。
- **再生キューは存在しない**(audio-player.mjs:22「PLAY: 前の声は置換される」・currentPlayback は単一スロット :203-215・busy 中の新規 fire は :696 で拒否)——「キュー破棄」という工程自体が不要。
- **in-flight 破棄の縫い目**: `session.ask` の await(通常 :577・視覚 :540)を**打ち切る機構は存在しない**。既存の dispose()(:731-744)も currentPlayback 設置後(=speak 以降)にしか効かない。→ ask 中のキルは「返ってきた結果を捨てる」形で塞ぐ(speechText 確定 :310 〜 speakImpl :337 の間にキル検査を挟む)。即効性は声の停止側で確保されるため、応答破棄で十分。破棄した応答の LLM 代金は受容(稀事象)。
- **耳の構造的独立**: src/ears/ に mind/ への実 import ゼロ(grep 確認)。耳→発火系の唯一の結合点は cockpit-server の `onVadEvent`(:629,:631)・`onTranscript`(:637)コールバック内の転送のみ。発火・音声を止めても VAD・whisper・転写バッファは無影響=「耳と転写は生存」は自然に成立。
- **本番結線**: player は scripts/cockpit.mjs:453-456 で遅延生成(playerProxy :467-479)、orchestrator は fireOrchestratorFactory(:511-527)で生成。createCockpitServer 呼び出し(:557-584)に `selfFireInitialEnabled`/`onSetSelfFireEnabled` 等と同型のフック追加位置がある。**orchestrator は遅延生成のため、キル中に初回生成された場合も既にキル状態で生まれる形にする必要がある**(ゲート漏れ防止)。

### 2-2. 操縦席・検問所・慣行(Sylph B)

- **KILL ボタン枠**: control-bar.mjs:120-124 `KillSwitch()` = disabled ボタンのみ(「S8 で実装(場所のみ予約)」:37)。配置済み(:231)。
- **endpoint 追加の模範**: `POST /api/verbosity`(cockpit-server.mjs:898-924、/api/self-fire :877-897 の写経)——検証→setter→フック(失敗寛容)→`broadcastState()`→snapshot 返却。snapshot 露出は :498 の隣。UI 側は control-bar.mjs:194-213(POST→`applySnapshot(res.j)`)、view-logic のエラー文言は view-logic/control.mjs:126-139 の写経。
- **SSE 慣行**: `broadcast(event, data)`(cockpit-server.mjs:513-527)。状態変更は `broadcastState()` で `state` イベント一発が慣行。
- **server テスト**: 個別 test ケース列挙形式(66 件)。新 endpoint は専用 test を追加。cockpit-server.mjs:279 の JSDoc「16 エンドポイント×13 SSE」の数字表記は手動更新の慣行[推測扱いだが追随する]。
- **AHK**: scripts/fire-hotkey.ahk(v2)。`^!f`→POST /api/fire(:29,:38-49)、`^!g`→POST /api/vision-fire(:36,:51-62)。port はコード内定数 8181(:26)・失敗は握って無通知。同型で `^!k`→POST /api/kill を追加できる。
- **TTS 直前の検問所**: speechText 確定 = fire-orchestrator.mjs:309-310(`parseExpressionTags` 後)。TTS へ渡る最終点 = :337 `speakImpl(speechText, ...)`。この区間は `processAskedReply`(:301)内で、**視覚 Fire(:541)と通常 Fire(:578)の両方が通る唯一の合流点**——NG 検査とキル検査を同じ場所に挿せる。
- **データ駆動表の前例**: expression-table.mjs(`Object.freeze` 二重凍結 + health test で構造的整合性を 1 テスト 1 観点)。NG リストも同形式(src/mind/ng-words.mjs)が自然。
- **正本への記録 API**: transcript-buffer.mjs `append()`(:147-175)、speaker は "you"/"soul"/"viewer"(:78)。barge-in の正直記録の前例 = 正本へ注記追記(fire-orchestrator.mjs:484-489、`…(遮られた)`)+ diagnostic SSE(:492-498、type:"bargeIn")の二本立て——没記録も同じ二本立てが自然。

### 2-3. 残る[推測]と扱い

- `createSessionProxy` 本体・`createLazyChannel` の sendSet 委譲先は未読了(Sylph A 申告)——ask 打ち切りをしない方針のため計画上は影響なし。Orch が実装時に必要範囲だけ確認。
- server テストの「16×13」数字が機械カウントでなく JSDoc コメントである件——additive 追加時にコメントも更新する(Domain B タスクに含める)。

## 3. 計画への持ち込み(要点)

1. キルのゲートは **orchestrator.fire() 冒頭の一点**(disposed/busy の隣)。scheduler の setEnabled は使わない(manual 非対象のため)。
2. キルの切断動作は **interrupt() の流用**(注記だけ `…(遮られた)` と別の専用文言に)。
3. in-flight は **応答破棄**(processAskedReply 内・speakImpl 直前のキル検査)。ask の打ち切りはしない。
4. NG 検査も**同じ検問所**(speechText 確定後・speakImpl 前)。命中=丸ごと没・正本に事実のみ記録+diagnostic SSE。
5. キル状態の正本はサーバ(cockpit-server)側に一つ。orchestrator へは生成時(遅延生成でも)と遷移時の両方で確実に伝播(キル中に生まれる orchestrator はキル済みで生まれる)。
6. ホットキー `^!k` は kill 専用(revive は操縦席のみ)。エンドポイントは明示指定(`{killed:true|false}`)でトグルにしない。
