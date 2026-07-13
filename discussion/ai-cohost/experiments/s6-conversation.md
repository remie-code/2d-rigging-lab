# S6 conversation — 会話が続く（barge-in + 自発発火）の実 SDK 観測

> Status: Recorded（2026-07-13）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）。S6 Domain D。
> 位置づけ: [s5-vision.md](s5-vision.md) に続く S 系列の計器。**S6 で新たに barge-in（中断+切断点）と
> fire-scheduler（自発 3 種: 呼びかけ/区切り/沈黙）を実 SDK 経路で駆動する初回確認**。
> 流儀: s5-vision.md を踏襲（限界の明示 → 再現手順 → 生データ → 所見 → 未実施の明記）。

## 0. これは何を測ったか（限界の明示・鉄の規律）

`createFireOrchestrator`（barge-in・soul 追記タイミング）と `createFireScheduler`（呼びかけ/区切り/
沈黙の判定）を**実物のまま**組み合わせ、`session` だけを実 `createLlmSession`（サブスク OAuth・
claude-opus-4-8）に差し替えて駆動した（`apps/soul/agent/scripts/observe-conversation.mjs`・新規・
observe-vision.mjs の写経）。

**実物**: fire-orchestrator・fire-scheduler・transcript-buffer・createLlmSession・FIRE_SYSTEM_PROMPT・
listWindows/captureWindow（沈黙=視覚発火の実キャプチャ）。**fake**: player（play/stop を記録するだけ・
実 WinRT MediaPlayer は起動しない）・channel（sendSet/sendEnvelope を記録し accepted を返すだけ・実
Control Channel には繋がない）・speakImpl（実 AivisSpeech TTS は叩かず母音タイムラインと
wavDurationSec を合成して返すだけ）。fire-scheduler のタイマ・時計・乱数はスクリプトが注入する fake
clock/RNG で駆動した（実際に 45〜95 秒待つのではなく、fake clock を進めて発火条件を成立させた）。

**実ゲーム窓・実マイク・実器（Electron）・実 AivisSpeech TTS・実 WinRT MediaPlayer は一切使っていない**
（鉄の規律・実マイク不使用の絶対規律）。

### 撃たなかった項目（正直な明記・人間ゲート/L0 委譲）

- **barge-in の「体感レイテンシ」**（ユーザー発話開始→実際に魂の声が止まるまでの体感時間）:
  実マイク・実器・実 WinRT MediaPlayer が要るため**未実施**。fake player の `stop()` 呼び出しは
  コード実行時間のみで、実再生停止の体感とは無関係（測っても意味のある数字にならない）。
  → wave 計画 §1 人間ゲート①（実配信での barge-in 体感）の領分。
- **口閉じ（mouth-open intent.set）の実器での見え方**: 全 fake ゆえ「sendSet が正しい payload で
  1 回飛ぶ」（§3 参照）までしか確認していない。実際の口の閉じ方は Domain B §7 質問 5 のとおり
  人間ゲートの領分。
- **自発発火の「頻度」の体感**（うるさくないか等）: fake clock で条件成立を 1 回ずつ実証したのみで、
  実配信での連続発火頻度・体感は測っていない（人間ゲート④/followup 台帳の領分）。
- **実マイク経由の呼びかけ照合の命中率**: 転写は `buffer.append({text:...})` で直接注入しており、
  実際の音声→ASR 転写揺れは経由していない（S6 planning-inventory §4-2 の既知の限界のまま）。

## 1. 実行環境

| 項目 | 値 |
|------|----|
| OS | Microsoft Windows 11 Home（win32） |
| Node | v22.14.0 |
| LLM | Agent SDK / model `claude-opus-4-8` |
| 認証 | **apiKeySource = `none`**（＝ `/login` サブスク OAuth）。env ガード（`assertSubscriptionAuthEnv`）
  通過（`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_USE_*` すべて未設定・
  `ANTHROPIC_BASE_URL` は既定値と一致＝warning 0 件）。 |
| キャプチャ対象（沈黙=視覚発火のみ） | 自分で起動した notepad.exe（マーカー本文込み一時ファイル）。実ゲーム窓は不使用。 |
| 記録時刻 | 2026-07-13T10:18:28.462Z 開始 |
| 実 ask 数 | **5**（ハード上限ちょうど・リトライ発生なし） |

## 2. 再現手順

```
# 前提: /login 済み・ガード対象環境変数が未設定。AivisSpeech・器・マイク・実ゲームは不要
#       （player/channel/speak は fake・沈黙=視覚発火のキャプチャ対象は自分で起動したメモ帳のみ）。
# 注意: サブスク枠を消費する（5 ask）。不用意に走らせない。
node apps/soul/agent/scripts/observe-conversation.mjs
```

沈黙（視覚発火）で撮影したメモ帳のマーカー本文:

```
S6会話観測: 青いペンギンが虹色のスケボーで宇宙を飛んでいる。背景には黄色い月が3つ並んでいる。
```

## 3. シナリオ 1（ask #1・#2）: barge-in 中断 + 「遮られた事実」への反応

### 手順

1. `buffer.append({text: "配信の感想を一言でいいから聞かせてよ"})` → `orchestrator.fire()`（ask #1）。
2. `onState("speaking")` 到達を待ってから 1200ms 待機（発話の途中まで待つ）。
3. `orchestrator.interrupt()` を呼ぶ（barge-in 相当）。
4. `buffer.append({text: "さっき遮っちゃってごめんね、続き聞かせて"})` → `orchestrator.fire()`（ask #2）。

### 生データ

| 項目 | 値 |
|---|---|
| ask #1 応答全文（中断前） | `"今日の配信、めっちゃ楽しかったよ<smile>"` |
| interrupt() 実行時刻（speaking 到達から） | 1200ms 後（スクリプトが待機した時間） |
| `interrupt()` 戻り値 | `{ interrupted:true, elapsedMs:1203, charsSpoken:6, prefix:"今日の配信、" }` |
| bargeIn 診断 | `{ elapsedMs:1203, charsSpoken:6, totalChars:16, prefix:"今日の配信、" }` |
| `fire()`（ask #1）戻り値 | `{ fired:true, interrupted:true, replyText:"今日の配信、", charsSpoken:6, elapsedMs:1203 }` |
| soul 行（append 後・実観測） | `"今日の配信、…（遮られた）"` |
| ask #2 you 発話 | `"さっき遮っちゃってごめんね、続き聞かせて"` |
| ask #2 応答全文 | `"ううん大丈夫<smile>今日はコメントもいっぱいで盛り上がったよね"` |
| キーワード一致判定（`/遮\|中断\|ごめ\|さっき\|途中/`） | false（参考情報。後述） |

### 所見

- **切断点算出の実測**: 16 文字中 6 文字（`elapsedMs=1203ms` の時点で voiced モーラのオンセットを
  厳密に過ぎた分だけ）が声に出たと計算され、soul 行に `接頭辞 + "…（遮られた）"` の形で 1 回だけ
  append された。過大評価（実際より多く言ったことにする）は観測されなかった（barge-in.mjs §3 の
  保守化設計どおり）。
- **「遮られた事実を踏まえた」返事の実観測（(a) の核心）**: ask #2 の返事「ううん大丈夫、今日は
  コメントもいっぱいで盛り上がったよね」は、直前の you 発話「さっき遮っちゃってごめんね」に対して
  **文脈的には自然に反応している**（「ううん大丈夫」＝謝罪への応答として通る）。ただし機械的な
  キーワード一致（「遮」「中断」等の単語そのもの）は含まれておらず、**言及の有無は表現の自由度が
  高く機械判定が難しい**（LLM は「何を言うか」を自由に選ぶため、事実を踏まえていても直接的な単語で
  言及するとは限らない）。生の応答テキストをそのまま記録するに留め、厳密な「言及した/していない」の
  二値判定はしていない——この解釈は人間の目で確認してほしい。
- **soul 追記の append-only 実測**: 中断後の会話ログには you 2 件 + soul 2 件（中断分1件+続き1件）
  が積まれ、上書き・削除は発生していない（append-only 設計の実 SDK 経路での裏取り）。

## 4. シナリオ 2（ask #3）: 呼びかけ（call）発火の実測

`createFireScheduler` を実物のまま生成し（fake clock/RNG 注入）、`buffer.onAppend` を
`scheduler.handleTranscript` へ配線（cockpit-server の実配線と同型）。

```
buffer.append({ text: "コーディ、聞いてる?" })
  → handleTranscript が textMatchesName で命中（不応期・確率は掛けない・裁定4どおり確実発火）
  → onFireRequest({kind:"call"}) → orchestrator.fire()（実 SDK ask #3）
```

| 項目 | 値 |
|---|---|
| 発火 kind | `call`（確認済み） |
| `fire()` 戻り値 | `{ fired:true, replyText:"うん、聞いてるよ<nod>" }` |

**所見**: 呼びかけ照合が実際に `fireOrchestrator.fire()` を駆動し、実 SDK ask に到達することを確認
した。「呼ばれたら確実に返す」（裁定4）が実 SDK 経路でも機能している。

## 5. シナリオ 3（ask #4）: 区切り応答（turn-end）発火の実測

fake clock を用い、不応期（`TURN_END_REFRACTORY_MS=8000`）をクリアするため 8500ms 進めてから
`handleVadEvent({type:"speechEnd"})` → `turnEndSilenceMs=2000` 分 fake clock を進めてタイマ満了、
`rng()=0`（常に確率判定を通過するよう固定）で発火。

```
clock.advance(8500)                                   // 不応期クリア
buffer.append({ text: "今日はいい天気だね" })              // 呼びかけ非該当の発話
scheduler.handleVadEvent({ type: "speechEnd" })        // 無音待ちタイマを張る
clock.advance(2000)                                    // タイマ満了→条件成立→emitFire("turn-end")
```

| 項目 | 値 |
|---|---|
| 発火 kind | `turn-end`（確認済み） |
| fake clock 上の発火時刻 | 10500ms（scheduler 起点からの論理時間） |
| `fire()` 戻り値 | `{ fired:true, replyText:"ほんとだね、こういう日は気持ちいいな<smile>" }` |

**所見**: `speechEnd` 後の無音待ち → 不応期 → 確率判定という 3 条件の AND が実際に
`fireOrchestrator.fire()` を駆動し、実 SDK ask に到達することを確認した。fake clock による論理時間
制御で、実際に 2 秒待つのではなくタイマ条件の成立自体を実射で裏取りできた。

## 6. シナリオ 4（ask #5）: 沈黙（silence）発火の実測（視覚発火・実キャプチャ）

長い不応期（`SILENCE_REFRACTORY_MS=90000`）をクリアするため fake clock を 95000ms 進めた（沈黙の
基礎無音 `SILENCE_BASE_MS=45000` 到達で不成立→再武装、90000ms 到達で成立という 2 段階の連鎖を
`advance()` が 1 回の呼び出しで正しく処理することを確認）。事前に自分で起動したメモ帳窓を
`getVisionTarget` の対象に設定し、`fire({vision:true})` が実際に実 `captureWindow`（PowerShell・
PrintWindow）で撮影することを確認した。

```
notepad 起動・マーカー本文書き込み → listWindows() でタイトル解決（実測: pid=30208 で確認）
getVisionTarget = () => そのタイトル
clock.advance(95_000)                                  // 沈黙タイマの連鎖成立
  → emitFire("silence") → orchestrator.fire({vision:true})（実キャプチャ + 実 SDK ask #5）
```

| 項目 | 値 |
|---|---|
| 発火 kind | `silence`（確認済み） |
| fake clock 上の発火時刻 | 105500ms |
| 沈黙予算残数（発火後） | 5（初期値 6 から −1） |
| `fire({vision:true})` 戻り値 | `{ fired:true, replyText:"なにこれ<surprised>青いペンギンが宇宙飛んでるって、すごい発想だね", vision:true }` |
| 画面言及キーワード一致 | `["ペンギン","青","宇宙"]`（マーカー本文の要素に複数言及） |

**所見**: 沈黙タイマが 2 段階（不成立→再武装→成立）の連鎖を経て実際に `fire({vision:true})` を駆動し、
実キャプチャ→実 SDK ask（画像込み）→画面内容に言及した返事、という視覚発火の全経路が自発発火から
実射できることを確認した。S5 の観測（メモ帳マーカーへの言及）と同種の判定が、S6 の沈黙トリガ経由
でも成立している。

## 7. usage 推移（5 ask 通し・累積の重さの早期検知）

| ask | kind | input_tokens | cache_creation_input_tokens | cache_read_input_tokens | output_tokens | ttft_ms | ask_ms |
|---|---|---|---|---|---|---|---|
| 1 | 通常（barge-in 前半） | 416 | 0 | 0 | 42 | 3436.5 | 5871.4 |
| 2 | 通常（barge-in 後半） | 525 | 0 | 0 | 35 | 3919.4 | 6372.1 |
| 3 | call | 674 | 0 | 0 | 16 | 1449.1 | 3766.6 |
| 4 | turn-end | 831 | 0 | 0 | 25 | 1288.1 | 3155.1 |
| 5 | silence（vision） | **2** | **1788** | 0 | 37 | 3470.9 | 7276.3 |

- **ask #1〜4（テキストのみ）は `input_tokens` が単調増加**（416→525→674→831・約 150〜160/ask の
  増分）——会話ログの累積が素直に反映されている。S5 の観測（画像込み履歴では `input_tokens` が一定で
  `cache_read_input_tokens` が増える）とは異なる形——**画像を含まない履歴では素の input_tokens
  加算、画像を含む履歴では cache 価格へ振り替わる**という 2 つの実測パターンが揃った。
- **ask #5（画像込み・cold）は `input_tokens` が 2 まで落ち、`cache_creation_input_tokens=1788` が
  新規発生**（S5 の cold ask #1 と同型の挙動: 画像込みの新規プロンプトはキャッシュ生成として計上）。
  `ephemeral_1h_input_tokens=1788` にのみ値が乗り `ephemeral_5m` は 0（S5 と同じ TTL 挙動）。
- **累積の重さの早期検知**（wave 計画由来の裁定）: この 5 ask 通しでは `ask_ms` が 3.1〜7.3 秒の
  レンジに収まり、劣化傾向は観測されなかった（セッション生存期間が短いため長時間運用の重さは
  この観測の範囲外・followup 台帳へ）。

## 8. 器側の実観測（fake だが実際に送出されたペイロード）

- **barge-in の口閉じ送出**: `channel.sendSet({slotId:"mouth-open", value:0, ttlMs:400})` が実際に
  1 回送出された（fake channel が記録・器契約どおりの payload 形）。
- **プレイヤー停止**: fake player の `stop()` が 1 回呼ばれた（barge-in 中断時の 1 回のみ・他 4 回の
  発話は自然完了なので stop は呼ばれない）。
- **演出（intent.envelope）**: 5 ask 全てで表情タグ（smile/nod/surprised）に応じた envelope が
  複数スロット（mouth-smile/eye-blink-left/eye-blink-right/head-tilt 等）へ送出された（S4 の演出
  経路が barge-in・自発発火の両方と共存して動くことを実測で確認・無退行）。

## 9. 後始末の自己確認

- `Get-Process notepad` を実行し、該当プロセスが存在しないこと（非 0 終了コード）を確認した。
- スクリプトが自前生成した一時ファイル（`%TEMP%\conversation-observe-*.txt`）が残っていないことを
  確認した（実行後 `ls` で該当ファイルなし）。
- `cd apps/soul/agent && node --test`（タイムアウト 300s）を実行し、507/507 で無退行を確認した
  （このスクリプトはテストファイルではなく `node --test` の対象外）。
- 画像はディスクへ一切書いていない（`jpegBase64` は変数保持のみ・ログにも先頭文字列を出さない）。

## 10. §質問（Orch / レビューへの申し送り）

1. **barge-in 後の「言及」の機械判定は諦め、生テキスト記録に留めた**: LLM の応答の自由度が高く、
   「遮られた事実に触れたか」を単純な文字列一致で判定するのは信頼できないと判断した（§3 参照）。
   厳密な判定が必要なら、追加の ask で LLM 自身に判定させる等の設計が考えられるが、それは新たな
   ask 消費を伴うため v0 では行っていない。人間の目での確認を推奨する。
2. **fake clock による「頻度」の実射は 1 回ずつの条件成立の実証に留まる**: 実配信での自発発火の
   連続頻度・体感のうるささは、この観測の範囲外（人間ゲート④・followup 台帳の領分）。
3. **barge-in の体感レイテンシは完全に未実施**: 実マイク・実器・実 WinRT MediaPlayer が要るため、
   このドメインでは測れないと判断した。人間ゲート①の合格判定（「声が止まり、器の口が閉じる」）で
   実測してほしい。
