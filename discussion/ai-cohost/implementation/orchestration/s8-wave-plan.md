# S8「配信に耐える」wave 計画

> Status: 計画確定(2026-07-16)・発進待ち。
> 根拠: [s8-planning-inventory.md](s8-planning-inventory.md)(裁定 7 件 + 配管事実)。
> 位置づけ: S 系列最後の必須問題。実体は「事故った時に止められるか」——キルスイッチ+NG 最小検査+AI 開示。
> 方式: 単一 Orch-Sylph(opus)が Domain A→B→C 順次。各ドメイン Gnome(sonnet)実装 + Review-Sylph(sonnet)3 レーン(spec/design/test)。鉄の規律(子の完了主張は成果物 Read と数字の独立再実行で裏取り)・在席プロトコル(委任プロンプトに PowerShell 在席ループを明示)は従来どおり。

## 1. ゴールとゲート

- **ゴール**: 配信中の「あっ」の瞬間に、一撃で声を切り・全発火を止め・一クリックで復帰できる。既知の最悪語は声になる前に落ちる。AI 出演の開示が概要欄にある。
- **機械ゲート**: `node --test` 全緑(ベースライン 729)・server ワイヤ契約は additive のみ・器/契約/依存/lockfile 不変・SDK 消費ゼロ。
- **人間ゲート(縮小裁定済み)**: ①発話中にキル(ホットキー)→**声が即座に切れ・口が閉じ・以後の発火(manual 含む)が全て弾かれ・操縦席にキル状態が見える**→一クリック復帰→次の発火が普通に動く。②弁が通常の発話を一切邪魔しない(普段どおり喋れる)。

## 2. 設計の枠(裁定済み・詳細は inventory)

- キル = 声の即切断+全発火 OFF(manual 含む)+耳/転写生存+一クリック復帰。プロセス不殺・in-memory のみ。
- ゲート点は `fire-orchestrator.fire()` 冒頭の一点(全発火の唯一の合流点)。切断は `interrupt()` 流用(専用注記)。in-flight は応答破棄(ask 打ち切りはしない)。
- NG = 最小リスト(差別語級のみ)・TTS 直前検問所(speechText 確定後〜speakImpl 前)・命中は丸ごと没・正本に事実のみ記録+diagnostic。
- ホットキー `^!k` は kill 専用。復帰は操縦席のみ。エンドポイントは `{killed:true|false}` の明示指定(トグル禁止)。
- キル中に遅延生成される orchestrator はキル済みで生まれる(ゲート漏れ防止)。

## 3. ドメイン分割

### Domain A: キルスイッチ中核(src/mind/)

- fire-orchestrator に `kill()` / `revive()` とキル状態を実装。`kill()` = 状態遷移+(再生中なら)interrupt 相当の即切断(player.stop+口閉じ+正本へ専用注記「…(強制停止)」系+diagnostic type:"kill")。
- `fire()` 冒頭ガード(disposed/busy の隣): キル中は `{fired:false, reason:"killed"}`。
- in-flight 破棄: `processAskedReply` 内・speakImpl 直前でキル検査。キル後に返った LLM 応答は声にせず soul 追記もせず、diagnostic に破棄事実のみ。
- 機械テスト: idle 中キル/再生中キル(声停止+口閉じ+注記)/ask 待ち中キル(応答が返っても喋らない・soul 追記なし)/revive 後の発火復活/manual 発火もキルで弾かれる/耳系(transcript-buffer 等)無影響。

### Domain B: 操縦席+ホットキー配線(src/cockpit/ + scripts/)

- `POST /api/kill`(`{killed:true|false}` 検証・/api/self-fire 写経・`broadcastState()`・snapshot に `killed` 露出)。キル状態の正本はサーバ側一つ・orchestrator へ生成時+遷移時の両方で伝播。
- KILL ボタン実装(control-bar.mjs の予約枠を活性化): 通常時=押すと kill、キル中=バー全体が視覚的に「殺し中」と分かる状態+復帰ボタン(一クリック revive)。view-logic 純関数+既存写経。
- fire-hotkey.ahk に `^!k` → POST /api/kill `{killed:true}` を追加(kill 専用・既存 2 キーの写経)。
- server テスト(新 endpoint・snapshot キー・SSE)+ cockpit-page テスト。cockpit-server.mjs:279 の「16 エンドポイント×13 SSE」数字コメントを追随更新。

### Domain C: NG 最終検査(src/mind/)+ docs

- `src/mind/ng-words.mjs`: expression-table 形式(Object.freeze+health test)の最小リスト(差別語級のみ・数語)。照合は NFKC 正規化+部分一致の素朴形。
- 検問所実装: Domain A のキル検査と同じ場所(speechText 確定後〜speakImpl 前)。命中=丸ごと没(声なし・soul 本文追記なし)・正本へ「(発話を没にした: NG 検査)」の事実のみ・diagnostic type:"ngBlocked"(没にした内容はどこにも書かない)。
- 機械テスト: 命中で没(speak 不呼び出し)/非命中は素通り/正規化照合/リスト health。
- docs 更新(README の安全弁節)+ followup 台帳([../waves/s8/s8-followup.md](../waves/s8/s8-followup.md))。

### wave 外(L0 直轄・コードなし)

- AI 開示文言の起草+配信前チェックリスト → `discussion/ai-cohost/operations/pre-stream-checklist.md`(L0 が起草・ユーザーが概要欄へ貼る)。

## 4. blocking レビュー基準

1. **キルの完全性**: キル状態で声が TTS に到達する経路がゼロであること(manual・自発 5 種・視覚・in-flight 全て)。特に「キル中に遅延生成された orchestrator」の漏れ。
2. **即効性**: kill→player.stop の間に await の割り込み余地がないこと(best-effort 同期呼び)。
3. **耳の不干渉**: キルが ears 系(VAD/whisper/転写)に触れないこと。
4. **ワイヤ契約 additive**: 既存 16 エンドポイント×13 SSE 不変・追加のみ。器/契約/依存/lockfile 不変。
5. **没の秘匿**: NG 没・キル破棄の内容が正本・SSE・ログのどこにも漏れないこと(事実の記録のみ)。
6. **復帰の健全性**: revive 後に残留状態(interrupted 汚染・busy 固着)がないこと。

## 5. choke point(ユーザーの作業)

- AutoHotkey スクリプトの再読み込み(`^!k` 追加後)。
- 概要欄への開示文言貼り付け(L0 起草後)。
- 人間ゲート実施(§1 の 2 点)。
- install 作業なし(新規依存ゼロ)。

## 6. Status

(発進後に記録)
