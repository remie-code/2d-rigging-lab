# 今の魂を「体験・ロール・芯・入口出口」に仕分ける(Sylph 2026-10-30)

> 種別: リポジトリの事実の調査(読み取りのみ)。仕分けの**候補**を並べたもの。設計・決定ではない。
> 対象: `apps/soul/agent`(コミット c113f3d5 時点の作業ツリー)。
> 語彙の出どころ: [../scope.md](../scope.md) §5〜§7。前の棚卸し [soul-inventory-2026-10.md](soul-inventory-2026-10.md)(以下「前の棚卸し」)の行番号を使い回している。
> `memories/` の中身、`.env*`、`cockpit-settings.local.json` の中身は開いていない(置き場だけ確かめた)。
> 行番号は調査時点のもの。【推測】と書いたもの以外はコードで確かめた。
> 層の略: 体験 = 体験(モード)/ ロール / 芯 / 出入 = 入口・出口。

## 1. 要点

- **芯にあたる仕組みは、部品としてはかなり切り出されている。** 頭の差し替え口(`MindSession`)、声の差し替え口(`VoiceEngine`)、再生器の形、判定エンジンの形(`judge`)、思い出しの係は、それぞれ注入で動く。芯の部品の多くは「純ロジック + 注入」の書き方になっている。
- **ただし、組み立てる場所が 1 つしかない。** 操縦席サーバ(`cockpit-server.mjs`・3318 行)と起動(`scripts/cockpit.mjs`・2361 行)が、芯・配信の画面・YouTube・判定の 1 段目と 2 段目を、同じ閉包の中で結線している。体験を分けるには、まずここを割る必要がある。
- **ロールという単位は、今のコードに無い。** 名前は「頭(技術的なモデル)」に付いている(`brains.mjs:56-107`)。会話指示の上書きも頭の id ごとに保存される(`fire-orchestrator.mjs:230-266`)。頭を替えると名前と性格が一緒に替わる。ロールを選ぶ口は無く、選べるのは頭だけ。
- **会話の正本(転写バッファ)は耳の中にある。** 耳が止まると発火も断る。正本・耳・場の始まりが 1 つに溶けている。話者は `you` / `soul` / `viewer` の 3 値で、人間も AI も 1 人ずつしか表せない。
- **口は体(器)が無いと出ない。** 運び手が器の `accepted` を待つ。体はロールのオプション、という絵とは逆になっている。
- **判定の問いの文 1 本に、体験・ロール・芯が混ざっている。** 「ゲーム配信」(体験)、「サポート役の AI Tuber」「性格の 1 文」(ロール)、5 択の形(芯)が同じ関数で組まれる。
- **2 段の判定の 1 段目は、3 つの別々のスイッチに散っている。** キル(`killed`)、自発の ON/OFF、話し始めの方式。2 段目の判定(speak-now / コメント反応)と同じ `isActive` に足し算で入っている。
- **4 つの層に入りにくいものがある。** 「場(1 回の集まり)」「参加者の名簿」「目(画面)と文字の入口」「秘匿・安全の方針」「資源と資格」「操作する人」。§4 にまとめた。

## 2. 仕分け表

「層」は候補。1 つに決まらないものは、部分ごとに分けて書いた。

### 2.1 耳(入口)と会話の正本

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| マイクの取り込み | `src/ears/ffmpeg-capture.mjs`、継ぎ目 `ear-pipeline.mjs:174`(`captureFactory`) | 出入(耳) | マイク名は 1 つ(`cockpit-server.mjs` の `currentDevice`)。耳は 1 本(`:809`) | 入口の形は差し替えやすい(前の棚卸し §2.1)。縛りは入口ではなく「1 本しか持たない」側 |
| 耳の管(区切り・VAD・リング) | `ear-pipeline.mjs`、`pcm-framing.mjs`、`pcm-ring-buffer.mjs`、`silero-vad.mjs`、`speech-segmenter.mjs` | 出入(耳)か芯 | VAD は耳ごとに 1 つ。「誰かが喋っている」は真偽値 1 つ(`cockpit-server.mjs:863`、`:1355-1360`) | 音から発話を切る仕組みは、どの入口でも同じ。芯に置く候補。一方、話者ごとに 1 本要るので、入口に付属させる候補もある |
| 文字起こしの方式 | `whisper-*.mjs`、`elevenlabs-stt.mjs`、`local-stt/*`、選択は `ear-pipeline.mjs:511-603` | 出入(耳)。資源としては §4 | whisper は既定ポート 1 つ。ElevenLabs は同時接続の上限(前の棚卸し §2.3) | 方式そのものは耳の部品。でも N 本で共有する資源(ポート・モデル・接続数)は、入口の外の持ち物かもしれない |
| 文字起こしの名前の手がかり | whisper の prompt(`cockpit-server.mjs:1325-1329` → `model-identity.mjs:58`、`:67`)、ローカルの hotwords(`local-stt-engines.mjs:71`) | ロールのデータを耳が使う | 名前は頭の identity から引く。hotwords の既定は「チャッピー」「コーディ」の固定 | ロールの持ち物(名前)を耳が読む形。Discord で別のロールなら、ここも替わる |
| 転写バッファ(会話の正本) | `src/ears/transcript-buffer.mjs` | 芯 | 話者は 3 値。知らない値は throw(`:77-78`)。耳の中で作られる(`ear-pipeline.mjs:192`、`:475`)。外に出すのは先送り済み(`cockpit-server.mjs:2696-2700`) | `soul` が 1 つなので、複数のロールが同じ場にいる形も表せない |
| 頭に渡す整形 | `src/mind/fire-injection.mjs` | 芯(形)+ 体験(ラベルの意味) | `you:` / `soul:` / `viewer(名前):`(`:46-61`)。知らない話者は `you`(`:40-44`) | ラベルの意味(you = 配信者)を頭に教える文は無い。教えるならロールか体験の言い回し |

### 2.2 頭(芯)とロールの持ち物

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| 頭の表・頭の差し替え | `src/mind/brains.mjs`、`llm-session.mjs`、`codex-session.mjs`、操縦席 `/api/brain` | 芯 | 頭の行に名前(identity)が付いている(`brains.mjs:56-107`) | 頭は芯の部品。ロールが「どの頭を使うか」を持つのか、頭は全体で 1 つなのか、語彙では決まらない |
| 名前と呼ばれ方 | `src/mind/model-identity.mjs:52-74` | ロール | cody / chappy の 2 つだけ。固定の表。頭から引く(`brains.mjs:124`) | 「モデルの家族ごとの名前」として作られた(model-identity wave)。ロールの名前と同じものか、別の軸か |
| 会話指示(性格の指示) | 既定 `fire-orchestrator.mjs:205-207`、組み立て `:280-288`、保存 `cockpit-settings-store.mjs`(キー `conversationInstructions`)、編集 `ui/conversation-instruction-editor.mjs` | ロール | 既定は「あなたは配信の相方です」。上書きは頭の id ごと(`:230-266`)。名前の一文は cody / chappy しか作れない(`:282-285`) | 既定の文の「配信の」は体験の言葉。性格(ロール)と場の説明(体験)が 1 文に入っている |
| 魂の教え(固定の指示) | `skills/expression.md`、`skills/screen.md`、`skills/recall.md`、`src/mind/soul-skills.mjs` | 芯(仕組みの説明)。一部は体験・ロール | `recall.md` は「過去の配信の記録」「配信者に頼まれたら」(前の棚卸し §7) | `expression.md` は体があるときだけ意味がある(ロールの体の有無次第)。`screen.md` は目があるときだけ(体験次第) |
| 発火の胴体 | `src/mind/fire-orchestrator.mjs` | 芯 | 耳が無いと断る(`:1784`)。`soul` 1 つに書く。口を閉じる命令を器に直接送る(`:639-692`)。表情を器に送る(`:949`) | 芯の中心だが、画面を見る道(`:1616`、`:1685`)、NG(`:1028`)、キル、体への送り出しを全部抱えている |
| 文脈の圧縮 | `src/mind/context-compactor.mjs` | 芯 | 隙間 = 「配信者の喋り終わりから 3 秒」(`:29`、`:40-41`)。材料の `userSpeaking` は 1 つ | N 人のとき「隙間」をどう数えるかは芯の中で決まる話【推測】 |
| 頭の後片付け | Codex の記録の掃除(`scripts/cockpit.mjs` 冒頭の `sweepCodexRollouts`、台帳 `codex-rollouts.local.json`) | 芯 | 起動 1 回に 1 度 | 縛りは見当たらない |

### 2.3 いつしゃべるか(判定)と安全弁

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| 判定エンジン | `src/mind/speak-now-decisions.mjs` | 芯(外のサービスへの口) | 縛りは無い。形は `judge({input, instructions, choices})` | 外のサービス(Decisions API)の口なので、入口出口に近いとも言える |
| speak-now(話し始めの判定) | `src/mind/speak-now.mjs` | 仕組み = 芯。問いの文 = 体験 + ロール。選択肢の形 = 芯かロール | ラベル「配信者」(`:54`)。問い「ゲーム配信で配信者の隣にいるサポート役の AI Tuber」(`:81`)。相槌の指示「配信者の話に」(`:72`)。`you` 1 件ごとに判定(前の棚卸し §5) | 「ゲーム配信」は体験。「サポート役」「性格の 1 文」(`:91-101`)はロール。5 択と「画面を見る」は、目がある体験だけの選択肢かもしれない |
| 口数モード | `speak-now.mjs:91-101`、`fire-scheduler.mjs` の定数、設定 `verbosityMode`、`ui/control-bar.mjs` | ロール(方針の強さ)か体験(操作者のつまみ) | 説明文に YouTube(`ui/control-bar.mjs:148`) | 判定の中では「性格の 1 文」として効くのでロールに近い。でも配信者がその場で回すつまみでもある |
| 話し始めの方式(従来 / speak-now) | 設定 `speakStartMode`、`cockpit-server.mjs:2398-2399` | ロール(方針の選び方)か芯(エンジンの切り替え) | 1 段目の `isActive` にも混ざっている | 「どの方針エンジンを使うか」がロールの持ち物か、芯の設定か、決まらない |
| 従来の発火の予定 | `src/mind/fire-scheduler.mjs` | 仕組み = 芯。呼びかけ・区切り・沈黙・合いの手の数値 = ロール。コメント系 = 体験 | `you` の転写と VAD 1 本で動く。呼びかけの既定の揺れはコーディ系(`:232`)。コメント応答・コメント内呼びかけ・予算(`:343`)は YouTube 用 | 1 つの部品に 3 層が入っている。沈黙の発火は画面付き(目がある体験向け) |
| 割り込み(barge-in) | `src/mind/barge-in.mjs`、結線 `cockpit-server.mjs:2311` | 芯(仕組み)。誰が止められるか = 体験かロール | VAD 1 本。猶予 2 秒(`:38`)。口を閉じるスロットは器の語彙(`:60`) | 何人もいる場で「誰の声で止まるか」は場の決まりか、ロールの性格か |
| 1 段目: キル・自発の ON/OFF | キル `cockpit-server.mjs:822`、`:1902-1930`、`fire-orchestrator.mjs` の `kill()`。自発 `/api/self-fire` | 芯(仕組み)+ 体験(誰がどう押すか) | キルの正本は操縦席の変数 1 つ。自発の ON/OFF は発火の予定の `isEnabled()` | scope §7 の「場が許す」にあたる。今は 3 つ(キル・自発・話し始めの方式)が `isActive` に足し算で入る(`:2398-2399`、`:2464-2465`)。1 つの「許し」の口にまとまっていない |
| NG の最終検査 | `src/mind/ng-words.mjs`、検問 `fire-orchestrator.mjs:1028` | 芯(出口の前の検問)。語の表 = 体験か全体 | 「配信の安全弁」として作られた(`ng-words.mjs` ヘッダ) | 仲間内でも同じ表でよいかは決まっていない |
| コメントを弾く判定 | `src/mind/comment-guard.mjs` | 体験(配信) | 問い「YouTube ライブ配信のコメント欄に」(`:53`) | 「信用できない文字の入力を、正本に入れる前に検める」仕組みは、Discord の文字チャットでも使える形かもしれない(芯の候補)【推測】 |
| コメントに反応する判定 | `src/mind/comment-react.mjs` | 体験(配信)。判定の性格の 1 文はロール | 問い「ゲーム配信で…視聴者からこのコメントが届いた」(`:61`)。忙しい間の取り置き(設定 `commentBusyPolicy`) | 「文字の入力に反応するか」の判定として見れば、2 段目の判定の一種(芯の仕組み + ロールの方針) |
| 手動の発火 | `/api/fire`、`/api/vision-fire`、`scripts/fire-hotkey.ahk` | 体験(操作者の道具) | 押すのは配信者 | Discord で誰が押すのか(§4 の「操作する人」) |

### 2.4 記憶

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| 書き出し役(②)と保存の引き金 | `src/mind/memory.mjs`、`scripts/cockpit.mjs:1975-2025`(20 分ごと・手動・耳の Stop・終了時) | 仕組み = 芯。頼みの文 = 体験 + ロール | 起動 1 回 = 配信 1 本の記録(`cockpit.mjs:1635`、`memory.mjs:147`)。頼みの文は配信の記録(`memory.mjs:164-200`) | 引き金(耳の Stop)が「場の終わり」の代わりをしている。§4 の「場」 |
| 記憶の置き場 | `src/memory/memory-store.mjs:87`(`DEFAULT_MEMORY_DIR`)、決まりの種 `conventions-seed.md` | 仕組み = 芯。置き場と決まりの中身 = ロール(scope §6「記憶はロールごと」) | 置き場は 1 つ。決まりは「配信をまたぐ記憶」「トピックはゲーム単位」(`conventions-seed.md:3`、`:21`) | 決まりの文は、ロールの持ち物か、体験の持ち物か(配信の決まりを Discord のチャッピーにも使うか) |
| 思い出し(④・係・目印) | `src/mind/recall.mjs`、`recall-desk.mjs`、`recall-tag.mjs` | 芯。頼みの文 = 体験 | 「you = 配信者」「過去の配信の記録」(前の棚卸し §7)。名前を落とす(`recall.mjs:70-90`) | 名前を落とす決まりは §4 の「秘匿の方針」 |
| ②④の頭の決め方 | `scripts/cockpit.mjs:594-599`(`resolveWriterBrainDef`) | 芯 | 今の頭が Claude なら既定の Codex | ロールが頭を持つなら、②④の頭も替わるのか |

### 2.5 口(声にして出す)と体

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| 文の切り出し・タグの分離 | `incremental-sentence-tag-buffer.mjs`、`expression-parser.mjs`、`recall-tag.mjs` | 芯 | 縛りは無い | 表情タグの 6 語は体がある前提の語彙 |
| 声の差し替え口と声の種類 | `src/voice/engines/voice-engine.mjs`、`aivis-voice-engine.mjs`、`elevenlabs-voice-engine.mjs`、`tts-client.mjs` | 差し替え口 = 芯。どの声か = ロール | 声の方式は設定 1 つ(`ttsEngine`)。声の id は全体で 1 つ(§5) | 声を作るサービス自体は入口出口に近い。「どの声か」だけがロール |
| 運び手(順に鳴らす) | `src/voice/speech-streamer.mjs` | 芯 | 器の `openSpeech` が `accepted` でないと鳴らさない(`:456-475`) | 「体なしでもしゃべれる」(scope §5)には、ここの約束を変える必要がある(前の棚卸し §4.3) |
| 再生器 | `src/voice/stream-player.mjs`、`audio-devices.mjs` | 出入(声の出口) | 出力デバイス名は 1 つ(設定 `audioDevice`) | 形(`open/write/end/stop/onEvent`)は差し替えやすい |
| 口の時間割 | `src/voice/mora-timeline.mjs`、`engines/elevenlabs-timeline.mjs` | 芯か出入(体) | 体に送るためだけに作る | 割り込みの「どこまで声に出たか」の計算にも使う(`barge-in.mjs`)。体が無くても芯が要る材料 |
| 表情の表と翻訳 | `src/mind/expression-table.mjs`、`expression-translator.mjs` | ロール(体)か出入(体) | 数値は器のスロット語彙とリグの向き次第(`expression-table.mjs` ヘッダ) | 表は 1 つ。体(モデル)ごとに替わるならロールの体の持ち物 |
| 器への道(channel) | `src/channel/channel-client.mjs`、`scripts/cockpit.mjs:200-260`(`createLazyChannel`) | 出入(体) | URL は設定 1 つ(`lastChannelUrl`)。無いと発話できない | 体はロールのオプション(scope §6)。URL はロールの持ち物か、体験の接続設定か |

### 2.6 目

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| 画面キャプチャ・窓の一覧 | `src/eyes/resident-capture.mjs`、`window-capture.mjs`、`window-list.mjs` | 出入(目)。どの窓を見るか = 体験 | 窓は 1 つ(設定 `visionTarget`、ゲームの窓)。耳の Start で立ち上がる | scope の入口出口の例(耳・声・体)に、目が無い。§4 |

### 2.7 操縦席・起動・観測

| 機能 | 主なファイル | 層 | 配信・1人への縛り | 迷いどころ |
|---|---|---|---|---|
| YouTube チャットの器官 | `src/chat/live-chat-client.mjs`、`innertube.mjs`、合流 `cockpit-server.mjs:2689-2834` | 体験(配信)の入口 | 合流は耳のバッファへ(`:2834`)。耳が止まると積まない | 器官そのものは独立(魂を import しない)。合流の結線だけが操縦席の中にある |
| 操縦席サーバ | `src/cockpit/cockpit-server.mjs` | 体験(配信の画面と API)+ 芯の組み立て | 耳 1 本・キル・判定・コメント・思い出しの係をすべてこの中で結ぶ | 「画面のためのサーバ」と「芯を組み立てる場所」が同じ。体験の画面を替えると芯の結線も替わる |
| 画面 | `src/cockpit/ui/*`、`view-logic/*`、`cockpit.html` | 体験 | 話者「配信者」(`view-logic/glance-timeline.mjs:38`)、「配信前」(`glance-meters.mjs:183`)、接続先 YouTube(`ui/settings-drawer.mjs:853`)。設定のタブは 接続 / 入出力 / 頭脳・会話 / 記憶 / 運転 / ログ(`settings-drawer.mjs:139-144`) | 「頭脳・会話」のタブにロールの編集(会話指示)が入っている |
| 設定の保存 | `src/cockpit/cockpit-settings-store.mjs`(1 つの JSON) | 層ごとに割れる | 全部が 1 ファイル・1 組 | 中身の割り方の候補: 体験 = `chatSource`・`visionTarget`・`commentBusyPolicy`。ロール = `conversationInstructions`・`verbosityMode`・`speakStartMode`・`ttsEngine`(?)・`backchannelMinIntervalSec`・`lastChannelUrl`(?)。芯 = `brainChoice`(?)・`compact*`・`codexFastMode`・`latency*`。出入 = `lastDevice`・`audioDevice`・`sttEngine`・`localStt*`。1 段目 = `selfFireEnabled`・`bargeInEnabled`。(?)は迷うもの |
| 残量・警告 | `src/cockpit/quota.mjs`、`warnings.mjs` | 体験(画面)。中身は §4 の「資源」 | 縛りは無い | 警告の種類(チャットの切断など)は体験ごとに違う |
| 起動 | `scripts/cockpit.mjs` | 体験の組み立て + 芯の組み立て | 起動 1 回 = 配信 1 本。役の選択の引数は無い(`parseCockpitArgs` `:129-152` は port / channel / speaker など) | 起動が「どの体験で、どのロールで」を受け取る口になる場所の候補 |
| 頭の文脈の記録・発火の診断・遅延 | `src/mind/session-usage-log.mjs`、`fire-diagnostics.mjs`、`fire-latency.mjs` | 芯(観測)。§4 | 起動ごとに 1 ファイル。区間に「文字起こし・判定」(1 人の発言が前提)【推測】 | 観測は層の外に置く考え方もある |
| 会話 CLI・耳 CLI | `src/cli/cli.mjs`、`src/cli/ears-cli.mjs` | 小さな体験か道具 | cli.mjs は標準入力 1 本・器が必須 | cli.mjs は「操縦席を使わない、もう 1 つの体験」の実例として読める |
| 計測・試験の道具 | `scripts/probe-*`、`preflight-*`、`bench-*`、`src/test-support/*` | どれでもない(道具) | probe の問いが判定の文の出どころ(`speak-now.mjs` ヘッダ) | §4 |

## 3. 固い結び目

ほどくのが一番大変そうな場所。上ほど影響が広い【推測】。

1. **会話の正本 = 耳 = 場の始まり。** 正本は耳の中で作られる(`ear-pipeline.mjs:192`)。操縦席は耳を 1 本だけ持つ(`cockpit-server.mjs:809`)。発火・判定・コメント・思い出しの係は、みな `pipeline.transcriptBuffer` を見る(`:2263`、`:2396`、`:2462`、`:2526`)。耳が止まると発火を断る(`fire-orchestrator.mjs:1784`)。さらに耳の Start / Stop が、声の engine の作り直し・画面キャプチャの立ち上げ・記憶の保存の引き金を兼ねる。正本を芯に出すと、場の始まりと終わりを別に決める必要が出る。
2. **ロール(名前・性格)が頭に縛られている。** 名前は頭の表の行に付く(`brains.mjs:56-107`)。会話指示の上書きは頭の id ごと(`fire-orchestrator.mjs:230-266`)。名前の一文は cody / chappy しか作れない(`:282-285`)。名前は判定 3 つ・発火の予定・whisper・画面の見出しに「今の頭の identity」として流れる(`cockpit-server.mjs:2655`、`:2360-2367`、`:1325-1329`)。ロールを頭から離すと、これら全部の引き口が替わる。
3. **口が体に縛られている。** 運び手は器の `accepted` が無いと鳴らさない(`speech-streamer.mjs:456-475`)。発火の胴体が口を閉じる命令を器に直接送る(`fire-orchestrator.mjs:639-692`)。表情の教え(`skills/expression.md`)は体の有無にかかわらず頭に渡る。
4. **組み立ての場所が 1 つ。** `cockpit-server.mjs` の 1 つの関数の中で、配信の画面の API、YouTube の合流、1 段目のスイッチ、2 段目の判定、思い出しの係が結ばれている。1 段目と 2 段目は同じ `isActive` の足し算(`:2398-2399`、`:2464-2465`)。体験を 2 つにするとき、どこまでが芯の組み立てかを切り出す必要がある。
5. **話者が 3 値で、人も AI も 1 人ずつ。** `you` / `soul` / `viewer` だけ(`transcript-buffer.mjs:77-78`)。整形(`fire-injection.mjs`・`memory.mjs`・`recall.mjs`)、判定 3 つ、発火の予定、画面がこの 3 値で分岐する(前の棚卸し §3.2)。N 人の人間も、同じ場の複数ロールも表せない。
6. **判定の問いの文が 3 層を 1 文に混ぜる。** `speakNowQuestion`(`speak-now.mjs:81`)と `commentReactQuestion`(`comment-react.mjs:61`)は「ゲーム配信」(体験)・「サポート役の AI Tuber」(ロール)・名前(ロール)を 1 つのテンプレートで組む。性格の 1 文(`:91-101`)は口数モードから作られ、会話指示(性格の指示)とは別に持たれている。ロールの性格が 2 か所に分かれている。
7. **1 起動 = 1 配信 = 1 記憶。** 記録のファイル名は起動時に 1 回決まる(`cockpit.mjs:1635`)。置き場は 1 つ(`memory-store.mjs:87`)。決まりの種は配信の言葉(`conventions-seed.md`)。
8. **設定が 1 ファイルに同居。** 体験・ロール・芯・入口出口の値が 1 つの JSON にある(`cockpit-settings-store.mjs`)。ほどくのは難しくないが、ロールを複数登録するなら置き場の形が要る【推測】。

## 4. どの層にも入らないもの(足りないかもしれない考え)

- **場(1 回の集まり・セッション)。** 始まり・終わり、記録の単位、1 段目の「許し」の持ち主。今は「起動 1 回」と「耳の Start / Stop」が代わりをしている。体験の一部とも言えるが、体験(配信モード)は何回も開かれる。体験と場は別の単位かもしれない。
- **参加者の名簿(人間側)。** 誰がいるか、名前、Discord のユーザーとの対応。今は `viewer` の `displayName` だけ。芯の「話者付きの会話の記録」に要るが、誰が名簿を持つか(体験か芯か)は語彙にない。
- **操作する人。** 配信では、配信者が「話し手(`you`)」と「操作する人(キル・手動の発火・つまみ)」を兼ねる。Discord では、操作する人と、話す仲間が分かれる可能性がある【推測】。1 段目の「場が許す」を誰が握るかに関わる。
- **目(画面)と文字の入口。** scope の入口出口の例は、耳・声・体の 3 つ。今は目(画面キャプチャ)と文字の入口(YouTube コメント)もある。Discord なら文字チャットや画面共有がありうる【推測】。入口の種類を「耳」より広く取る必要があるかもしれない。
- **頭(技術的なモデル)とロールの関係。** 頭は芯の部品だが、今は名前を持っている(§3 の 2)。「ロールがどの頭を使うか」を持つのか、頭は全体設定なのか、語彙では決まらない。②④の頭(`resolveWriterBrainDef`)も同じ問い。
- **秘匿・安全の方針。** 視聴者の名前を落とす(`memory.mjs`・`recall.mjs`・`conventions-seed.md:41`)、NG の表、コメントを弾く判定、仲間の同意(scope §3)。どれも層をまたぐ。「名前を残さない」は、配信のコメントの性質(体験)か、ロールの記憶の決まりか、場の同意か、決まらない。
- **資源と資格。** キー(`.env.*`)、頭の資格(`brains.mjs` の `credentialPath`)、残量(`quota.mjs`)、ElevenLabs の同時接続の上限、whisper のポート。ロールや体験をまたいで共有される。N 人分の耳や複数ロールで取り合いになる。
- **観測・診断。** 頭の文脈の記録、発火の診断、遅延の内訳、警告。芯の中にあるが、体験の画面に出る。層の外に置く考え方もある。
- **道具。** probe / preflight / bench の scripts、テストの偽物、CLI。判定の問いの文は probe が出どころなので、ロールの言い回しを替えると probe も替わる。
- **言葉の重なり。** 「役」はもう別の意味で使われている。記憶の書き出し役・思い出し役(`memory.mjs` の `WRITER_ROLE`)、runtime-player の「役割つき起動」(`discussion/ai-cohost/architecture/runtime-player-model-host-roles.md`)、判定の問いの「サポート役」。新しい「ロール」と取り違えやすい。

## 5. 今のロールの置き場

今のコードに「ロール」という単位は無い。ロールに当たりそうなものが、次の場所に散らばっている。

| ロールの持ち物(scope §6) | 今の置き場 | 選ばれ方 |
|---|---|---|
| 名前 | `src/mind/model-identity.mjs:52-74`(cody / chappy の固定の表) | 頭の選択から引く(`brains.mjs:124` `resolveBrainIdentity`、`cockpit.mjs:1624`)。知らない頭はコーディ(`model-identity.mjs:74`) |
| 呼ばれ方の揺れ | `model-identity.mjs` の `voiceCallVariants` / `commentCallVariants` / `whisperPrompt`。古い既定 `fire-scheduler.mjs:207`、`:232`。ローカルの hotwords `local-stt-engines.mjs:71`(設定キー `localSttHotwords` で上書き) | 前の 3 つは頭から。hotwords は設定から(頭と無関係) |
| 性格の指示 | 既定 `fire-orchestrator.mjs:205-207`。ユーザーの上書きは `apps/soul/agent/cockpit-settings.local.json` のキー `conversationInstructions`(頭の id ごと。中身は読んでいない。同じ場所に `cockpit-settings.local.json.bak-20261027` もある) | 今の頭の id で引く(`cockpit.mjs:1752-1753`)。編集は操縦席の「頭脳・会話」タブ |
| 固定の教え | `apps/soul/agent/skills/*.md` | 全部の頭に同じものを足す(`soul-skills.mjs`) |
| 声 | 方式は設定 `ttsEngine`(全体で 1 つ)。AivisSpeech の話者は起動引数 `--speaker`、無ければ `tts-client.mjs:29`(`888753760`)。ElevenLabs の声は `elevenlabs-voice-engine.mjs:60` の既定の id(設定の口は無い) | 頭とは無関係。全体で 1 つ |
| いつしゃべるかの方針 | 性格の 1 文 `speak-now.mjs:91-101`(口数モードから)。問い `speak-now.mjs:81`、`comment-react.mjs:61`。選択肢 `speak-now.mjs:115`。設定 `speakStartMode`・`verbosityMode`・`backchannelMinIntervalSec`・`commentBusyPolicy`。発火の予定の数値 `fire-scheduler.mjs` | 名前だけ頭から。ほかは設定(全体で 1 つ) |
| 体 | 器の URL は設定 `lastChannelUrl`(または起動引数 `--channel`)。表情の表 `expression-table.mjs`(1 つ)。表情の教え `skills/expression.md` | 全体で 1 つ。体なしの道は無い |
| 記憶 | `apps/soul/agent/memories/`(`memory-store.mjs:87`・中身は開いていない)。決まりの種 `src/memory/conventions-seed.md` | 全体で 1 つ |

- **選び方**: ロールを選ぶ口は無い。選べるのは頭だけ(操縦席の `/api/brain`、設定 `brainChoice`)。頭を替えると、名前と会話指示が一緒に替わる。声・方針・体・記憶は替わらない。
- **登録の仕方**: 名前は表に行を足す(コードの変更)。会話指示は操縦席で編集できる(頭の id ごと)。それ以外は設定ファイルかコードの定数。

## 6. 未確認のこと

- `conversationInstructions` の上書きの中身。今のチャッピーの「ロールらしさ」がどこまでそこに書かれているか。読んでいない。
- `memories/` の中身。置き場をロールごとに分けたとき、今の中身をどう扱うかは中身次第。開いていない。
- 観測の記録(`session-usage-log.mjs`・`fire-latency.mjs`)が 1 人の発言をどこまで前提にしているか。ヘッダだけ読んだ。
- `fire-scheduler.mjs` の古い名前の揺れ(`:207`、`:232`)が、今も実際に使われる道があるか。identity の提供口が無いときの既定と読んだが、確かめていない。
- 画面の部品(`ui/*`)のうち、どれが配信だけの部品で、どれが他の体験でも使えそうか。見出しと語を grep しただけで、部品ごとには読んでいない。
- `cockpit-server.mjs` の中で、芯の組み立てと画面の API がどの行で分けられるか。大きな区切りは追ったが、全部は読んでいない。
- 2 段の判定を芯に置いたとき、従来の発火の予定(機械の信号)を「ロールの方針の一種」と見るか「1 段目の一種」と見るか。コードからは決まらない。
- Discord 側の入口(人ごとの音・文字チャット・画面共有)の形。この調査の範囲外。
