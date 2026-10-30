# 今の操縦席を、配信者の目で見る(Sylph 2026-10-30)

> 種別: リポジトリの事実の調査(読み取りのみ)。「今どうなっているか」だけを書く。あるべき形・設計・決定は書かない。
> 対象: `apps/soul/agent`(コミット c113f3d5 時点の作業ツリー)。パスは断りがなければ `apps/soul/agent/` からの相対。
> 層の候補は [layer-classification-2026-10.md](layer-classification-2026-10.md)(以下「仕分け」)と [../scope.md](../scope.md) §5〜§12 の語彙に合わせた。候補であって決定ではない。
> `.env*`・`cockpit-settings.local.json`(と .bak)の中身・`memories/` は開いていない。設定のキー名は `src/cockpit/cockpit-settings-store.mjs` のコードから取った。
> 行番号は調査時点のもの。【推測】と書いたもの以外はコードで確かめた。
> 層の略: 体験 / 場 / ロール / 芯 / 出入(入口・出口)/ 操作(操作する人)/ 外(どの層にも入りにくい: 資源・観測など。仕分け §4)。迷うものは「A か B」と書き、【曖昧】を付けた。

## 1. 要点

- **起動はターミナルから 1 本。** `node scripts/cockpit.mjs`(`package.json:9` の `cockpit`)。リポジトリ直下には `cockpit` のスクリプトが無い。ブラウザは `--open` を付けたときだけ開く。付けなければ URL を自分で開く(`scripts/cockpit.mjs:2255-2256`、`:2350`)。
- **メイン画面は見るだけの画面。** 上の帯(名前・モデル名・状態・警告・残量 2 本・KILL)、会話(左)、コメント(右)、下の帯(運転設定の表示・遅延の凡例・歯車)。操作できるのは KILL / 復帰と歯車だけ(配信前は中央の「準備・設定を開く」も)。
- **設定はすべて 1 つのダイアログ「準備・設定」に入っている。** タブは 接続 / 入出力 / 頭脳・会話 / 記憶 / 運転 / ログ の 6 つ(`src/cockpit/ui/settings-drawer.mjs:138-145`)。手動の発火ボタンも「運転」タブの中にある。
- **耳の Start が、いくつもの意味を兼ねている。** マイク・文字起こし・声の方式はどれも Start のときに効く。Start は画面キャプチャと声のプレイヤーも起こす。Stop は記憶の保存の引き金になる。動いている間に Start を押しても何も変わらない(`src/cockpit/cockpit-server.mjs:1196-1198`)。
- **「頭脳」を選ぶと、名前と会話指示も一緒に替わる。** 頭脳の選択肢は 6 つのモデル名(`view-logic/health.mjs:183-190`)。会話指示は頭脳の id ごとに保存される。ロールを選ぶ口は無い。
- **声は体(runtime-player の channel)が無いと出ない。** 手動の発火でも、Channel URL が無ければ発火が失敗する(`scripts/cockpit.mjs:1886-1888`)。Channel は最初の発火のときに初めてつながる。
- **操縦席の外の作業が多い。** 起動引数(声の話者 id など)、runtime-player の channel を開いて URL をコピー、AivisSpeech の起動、AHK のホットキー、設定ファイルの手書きのキー(12 個)、キーの置き場(`.env.*.local` 2 つ)。
- **配信前チェックリストは、今の画面とずれている。** 「運転バー」「Chat」はもう無い。名前の表記も違う(§6)。

## 2. 配信者の流れ(起動から終了まで)

### 2.1 起動の前

1. AivisSpeech を起動しておく(既定 `http://127.0.0.1:10101`。`--tts-base-url` で変える。`scripts/cockpit.mjs:1526`)。操縦席は AivisSpeech を起動しない。ElevenLabs の声を使うときも、読みは AivisSpeech から取る(`scripts/cockpit.mjs:1597-1602`)。
2. runtime-player(体)を起動し、Channel のページで channel を Open にして、URL をコピーする。channel は起動時は Closed(`apps/runtime-player/src/control/channel-page.tsx:16-21`)。token と port は runtime-player 側に残る(`apps/runtime-player/src/main/control-channel/channel-config-store.ts:9`、`:37-38`)。
3. 必要なら AHK のホットキー(`scripts/fire-hotkey.ahk`)を起動する。

### 2.2 起動

- コマンド: `node scripts/cockpit.mjs [--port N] [--open] [--channel <ws-url>] [--tts-base-url <url>] [--speaker <id>] [--fire-window-min <m>] [--fire-max-chars <n>]`(`scripts/cockpit.mjs:129-152`、`:1519-1531`)。`npm run cockpit --prefix apps/soul/agent` でも同じ。
- 起動のときに起きること:
  - 前回の Codex の記録ファイルを掃除する(`:1543-1547`)。
  - 設定ファイルを読む。記憶のフォルダを用意し、今回の記録のファイル名を決める(`:1629-1635`)。
  - `127.0.0.1:8181` で待ち受け、URL をターミナルに出す(`src/cockpit/cockpit-server.mjs:117`、`scripts/cockpit.mjs:2255-2256`)。
  - Channel URL が(`--channel` か前回の記憶で)あれば「fire enabled」、無ければ「Channel 欄に URL を入れると Fire が有効化」と出す(`:2257-2272`)。
  - `--channel` を付けたときだけ、頭のセッションを起動時に作る。付けなければ最初の発火のときに作る(`:2131-2134`)。
- 開く画面: メイン画面。耳が止まっているので、会話の場所の中央に大きな「準備・設定を開く」ボタンが出る(`src/cockpit/ui/conversation.mjs:78-82`、`view-logic/glance-meters.mjs:184-186`)。ダイアログは自動では開かない(`ui/app.mjs:157-158`)。

### 2.3 配信前の準備(準備・設定のダイアログ)

ふつうの順番【推測。画面の並びとチェックリストから】:

1. 接続タブ: 器(Channel)に runtime-player の URL を貼って Set。YouTube の配信 URL を入れて Connect。
2. 入出力タブ: マイク・文字起こし・声を選び、Start。声の出力先と視界(ゲーム窓)を選んで Set。
3. 頭脳・会話タブ: 頭脳を選んで Set。必要なら会話指示を編集。
4. 運転タブ: 自発を ON にする(初回の既定は OFF。`scripts/cockpit.mjs:1555`)。口数・話し始めを確かめる。
5. 一言しゃべって、会話に転写が積もるのを見る。一度 Fire して声を聞く。KILL を一度押して、復帰する(チェックリスト ③〜⑤)。

### 2.4 配信中

- メイン画面を横目で見る。会話(配信者とチャッピーの行・判定の札・遅延の棒)、コメント、上の帯の状態と警告。
- 操作は KILL(上の帯のボタン、または `Ctrl+Alt+K`)と、ホットキーの発火(`Ctrl+Alt+F` / `Ctrl+Alt+G`)。復帰は画面のボタンだけ(`scripts/fire-hotkey.ahk:17-19`)。
- 設定を変えるときはダイアログを開く。運転タブのつまみは、変えたその場で効く。

### 2.5 終わり

- 入出力タブの Stop: 耳を止める。止める前の転写で記憶の保存が走る(前の保存から増えていなければ書かない。`scripts/cockpit.mjs:2021-2024`)。
- 記憶タブの「今日を記録」: その場で保存する(`:2015`)。ほかに 20 分ごとの自動保存もある(`:2007-2012`)。
- ターミナルで Ctrl+C: 最後の保存をして閉じる。保存は最大 90 秒待つ。もう一度 Ctrl+C で待たずに終わる(`:103`、`:2278-2345`)。

## 3. 画面と操作の一覧

「保存先」の「設定 `キー`」は `cockpit-settings.local.json` の中のキー(書き込みは `cockpit-settings-store.mjs`)。「—」は保存しない。

### 3.1 メイン画面: 上の帯(`ui/header.mjs:118-142`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 名前(チャッピー / こーでぃー) | 表示だけ。今の頭脳から引く(`header.mjs:36-51`、`src/mind/brains.mjs:56-107`) | — (頭脳の選択に従う) | 頭脳の Set ですぐ | ロール |
| モデル名(例 GPT-6.1 Sol) | 表示だけ(`ui/app.mjs:321`) | — | 頭脳の Set ですぐ | ロール(どのモデルで動かすか)か芯【曖昧】 |
| 状態のピル(喋ってる / 圧縮中 / 考えてる / 聞いてる / 起動中 / 止まってる) | 表示だけ(`view-logic/glance-meters.mjs:174-181`) | — | 常に | 芯(状態)+ 場(耳が動いているか) |
| 警告(異常のときだけ・3 件まで + N) | 表示だけ。文字起こし・声・マイク・チャット・Codex の上限・OpenAI の残高・判定のエラー・頭のエラー など(`cockpit-server.mjs:1034-1093`、`:1157-1163`) | — | 常に | 外(観測)。中身は層をまたぐ |
| 残量「Codex 週」「ElevenLabs 月」 | 表示だけ。Codex は頭が Codex のときだけ値が出る(`scripts/cockpit.mjs:1951-1952`) | — | 常に | 外(資源) |
| KILL / 復帰 | 全部の発火を止め、声を切る / 戻す(`cockpit-server.mjs:1902-1931`)。確認なしの 1 クリック | — (起動するたびに KILL でない状態に戻る) | すぐ | 場(1 段目の「場が許す」)・操作 |

### 3.2 メイン画面: 会話・コメント・下の帯

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 会話(左・最新が下・スクロールなし) | 表示だけ。話者は「配信者」(`view-logic/glance-timeline.mjs:38`)とチャッピー。判定の札・遅延の棒・推論に使った範囲 | — (範囲と遅延は開き直すと消える) | 常に | 場(1 回分の会話)。話者の名前は体験とロール |
| 配信前の「準備・設定を開く」 | ダイアログを開く(`ui/conversation.mjs:78-82`) | — | 耳が止まっている間だけ出る | 操作 |
| コメント(右・新しいものが上) | 表示だけ。反応した印・弾いた札(`ui/comments.mjs`) | — | YouTube に Connect していて、耳が動いている間 | 体験(配信) |
| 下の帯の運転設定(自発・口数・話し始め・忙しい間のコメント) | 表示だけ(`view-logic/glance-meters.mjs:201-211`)。変えるのは運転タブ | — | 常に | 運転タブと同じ |
| 遅延の凡例(8 つ) | 表示だけ(`glance-meters.mjs:31-40`) | — | 常に | 外(観測) |
| 「⚙ 準備・設定」 | ダイアログの開閉(`ui/bottom-bar.mjs:33-35`) | — | すぐ | 操作 |
| ブラウザのタブ名 | 「チャッピー — Soul Cockpit」(`ui/header.mjs:54-59`) | — | 頭脳の Set ですぐ | ロール |

### 3.3 準備・設定: 接続タブ(`settings-drawer.mjs:831-885`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 器(Channel)の入力 + Set | 体(runtime-player)への URL。Set のあと入力欄は空になる(token を残さない) | 設定 `lastChannelUrl`(起動引数 `--channel` が優先して上書き。`scripts/cockpit.mjs:1649`、`:1703-1706`) | 次の発火(そのときに初めてつなぐ。`scripts/cockpit.mjs:1810-1814`) | 出入(体の出口)かロール(体はロールのオプション)【曖昧】 |
| 器の状態(「URL — idle / connecting / connected / error」か「not configured」) | 表示だけ(`view-logic/status.mjs:80-92`) | — | 常に。最初の発火までは idle | 出入 |
| YouTube の入力 + Connect | YouTube のチャットを取り始める(`cockpit-server.mjs:2925-2951`) | 設定 `chatSource`(次の起動で入力欄に戻る。自動では Connect しない) | すぐ | 体験(配信の入口) |
| Disconnect | チャットを止める | — | すぐ | 体験 |
| チャットの状態(not connected / connecting / live / retrying / dead) | 表示だけ(`status.mjs:27-37`) | — | 常に | 体験 |

### 3.4 準備・設定: 入出力タブ(`settings-drawer.mjs:886-963`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| マイク(select) | 耳が聞くデバイス。初期の選択は前回のマイク | 設定 `lastDevice`(Start のときに書く。`cockpit-server.mjs:1203`) | Start。動いている間は Stop → Start が要る | 出入(耳) |
| Start | 耳を開く。文字起こしの用意、声の engine の用意、画面キャプチャの係と声のプレイヤーを起こす(`cockpit-server.mjs:1195-1468`、`scripts/cockpit.mjs:2208-2217`)。ElevenLabs のキーはここで読む | 下の 3 つを書く | すぐ | 場(始まりの代わり)+ 出入【曖昧】 |
| Stop | 耳を閉じる。記憶の保存が走る。キャプチャの係を止める(`cockpit-server.mjs:1471-1494`) | — | すぐ | 場(終わりの代わり)+ 出入【曖昧】 |
| 文字起こし(ローカル(whisper) / ElevenLabs / Zipformer(ローカル) / Parakeet(ローカル)) | 文字起こしの方式(`view-logic/settings.mjs:365-371`) | 設定 `sttEngine`(Start のときに書く) | 次の Start | 出入(耳) |
| 声(AivisSpeech / ElevenLabs) | 声を作る方式(`settings.mjs:389-392`) | 設定 `ttsEngine`(Start のときに書く) | 次の Start(Start より前の発火は前回の方式) | ロール(声)か出入(声の出口)【曖昧】 |
| 声の出力先(select)+ Refresh devices + Set device | 声を鳴らすデバイス。select の初期は一覧の先頭(保存した値ではない。`settings-drawer.mjs:516`) | 設定 `audioDevice` | 次の発火(プレイヤーを作り直す。`scripts/cockpit.mjs:1921-1937`) | 出入(声の出口) |
| 視界(ゲーム窓)(select)+ Refresh windows + Set target | 画面を見るときに撮る窓。select の初期は一覧の先頭(`settings-drawer.mjs:504`) | 設定 `visionTarget` | 次に画面を撮るとき(発火ごとに読む。`scripts/cockpit.mjs:2100`) | 体験(目の入口) |
| エラー欄・状態の文字 | 表示だけ | — | — | — |

### 3.5 準備・設定: 頭脳・会話タブ(`settings-drawer.mjs:964-1044`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 頭脳(select・6 つ: Claude (Opus 4.8) / Claude (Opus 5.5) / Codex (GPT-5.6 Terra) / Codex (GPT-5.6 Sol) / GPT-6 Astra / GPT-6.1 Sol)+ Set | 頭のモデル。同時に名前(こーでぃー / チャッピー)と、使う会話指示も替わる(`scripts/cockpit.mjs:1947-1954`) | 設定 `brainChoice` | 名前の表示と whisper の名前の手がかりはすぐ(`cockpit-server.mjs:1325-1329`)。頭のセッションは次の発火で作り直す。記憶の書き出し役・思い出し役の頭も替わる(Claude なら Codex に固定。`scripts/cockpit.mjs:594-599`) | ロール(選ぶもの)+ ロールが持つモデルの選択【曖昧】 |
| 頭脳の状態・資格の有無 | 表示だけ(資格ファイルがあるかだけ見る。`scripts/cockpit.mjs:1970-1973`) | — | — | 外(資格) |
| 会話指示を編集 | 同じダイアログの中で編集の画面に切り替える | — | — | ロール |
| 圧縮を始める大きさ(5 万〜45 万トークン)+ Set | 頭の会話を圧縮する目安。「Codex の頭のときだけ効きます」と書いてある(`view-logic/settings.mjs:222`) | 設定 `compactThresholdTokens` | 次の確かめ(走っている compactor を差し替える) | 芯 |
| Codex の fast(チェック) | Codex の頭の返事を速くする(使用量が増える)。Claude の頭では「効きません」と出る(`settings.mjs:297-298`、`:325-333`) | 設定 `codexFastMode` | 次の返事 | 芯かロール(モデルの使い方)【曖昧】 |

### 3.6 頭脳・会話タブの中の「会話指示」の画面(`ui/conversation-instruction-editor.mjs`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| ← 頭脳・会話 | 元の画面に戻る(未保存なら確かめる) | — | — | 操作 |
| 技術頭脳(select・6 つ) | どの頭脳の会話指示を編集するか。今の頭脳でなくても選べる(`:56-67`) | — | — | ロールの持ち物を頭脳で引いている【曖昧】 |
| 技術ラベル・システム管理の識別(読み取り専用) | 表示だけ。名前は今の頭脳のときだけ出る(`:69-76`) | — | — | ロール |
| 適用状態(既定 / この頭脳の保存済み上書き・revision) | 表示だけ | — | — | — |
| 会話指示本文(textarea) | 下書き | — (保存するまで) | — | ロール(性格の指示) |
| 既定へ戻す | その頭脳の上書きを消す | 設定 `conversationInstructions`(頭脳の id ごと。`cockpit-settings-store.mjs:118-119`、`:411-419`) | 次の発火(セッションを作り直す) | ロール |
| 保存して次のFireから反映 | 上書きを保存する | 設定 `conversationInstructions`(頭脳の id ごと) | 次の発火 | ロール |
| 魂がいつも足す教え(表情 / 画面 / 思い出す・読み取り専用) | 表示だけ(`skills/*.md`) | — (ファイル) | — | 芯。表情は体、画面は目があるときだけ意味がある(仕分け §2.2) |
| 「未保存の会話指示があります」(破棄して続ける / 編集を続ける) | ダイアログの中の確かめ(`settings-drawer.mjs:824-830`) | — | — | 操作 |

### 3.7 準備・設定: 記憶タブ(`settings-drawer.mjs:1045-1056`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 今日を記録 | 記憶の書き出し役(使い捨ての Codex)に、今の転写を書かせてコミットする(`scripts/cockpit.mjs:1979-2015`) | `memories/`(git) | すぐ(数十秒かかる) | ロール(記憶)か場(終わりの代わり)【曖昧】 |
| 最後に記録: HH:MM:SS(記録中…) | 表示だけ。このプロセスの中の記録だけ数える(`view-logic/settings.mjs:205-209`) | — | — | ロール |

### 3.8 準備・設定: 運転タブ(`ui/control-bar.mjs:373-399`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 自発(チェック) | 自分からしゃべる発火の ON/OFF。speak-now とコメント反応の判定も、これが ON でないと動かない(`cockpit-server.mjs:2398-2399`、`:2464-2465`)。初回の既定は OFF | 設定 `selfFireEnabled` | すぐ | 場(1 段目)・操作 |
| かぶり(チェック) | 配信者が話し始めたら声を止める(barge-in)。既定 ON(`scripts/cockpit.mjs:1557`) | 設定 `bargeInEnabled` | すぐ | 場(1 段目)かロール(性格)【曖昧】 |
| 口数(控えめ / ふつう / おしゃべり) | 自発の頻度。speak-now では判定の「性格の 1 文」になる。説明文に YouTube が出る(`control-bar.mjs:148`) | 設定 `verbosityMode` | すぐ | ロール(方針)か操作(その場のつまみ)【曖昧】 |
| 話し始め(従来 / speak-now) | 自発の決め方。従来 = 機械の信号、speak-now = 配信者の発言ごとに判定 API(`control-bar.mjs:170`)。初回の既定は speak-now(`scripts/cockpit.mjs:1185`) | 設定 `speakStartMode` | すぐ | ロール(方針)か芯(エンジン)【曖昧】 |
| 忙しい間のコメント(あとで拾う / 見逃す) | しゃべっている間に届いたコメントの扱い。speak-now の間だけ効く(`control-bar.mjs:181-187`) | 設定 `commentBusyPolicy` | すぐ(見逃すにすると取っておいた分も捨てる。`cockpit-server.mjs:1888-1890`) | 体験(配信) |
| 🎤 Fire | 手動の発火(`/api/fire`) | — | すぐ(忙しい間は無視) | 操作 |
| 🖼 Fire+視覚 | 画面を見て発火(`/api/vision-fire`)。視界の窓が要る | — | すぐ | 操作 + 体験(目) |
| soul: 状態・fire-note | 表示だけ | — | — | — |

### 3.9 準備・設定: ログタブ(`settings-drawer.mjs:1061-1063`、`ui/app.mjs:369-371`)

| 表示 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| 健康の 1 行(耳・whisper・ffmpeg・stt・tts・mic・voice) | 表示だけ(`ui/header.mjs:73-97`) | — | — | 外(観測) |
| 観測フィード(全行・マーカー・ゴースト行・usage・破棄の数・uptime) | 表示だけ | — | — | 外(観測) |
| 最新へ ↓ | フィードの末尾に戻る(`ui/feed.mjs:132`) | — | — | 操作 |

### 3.10 画面に無い設定(設定ファイルを手で書く・`cockpit-settings-store.mjs:56-85`)

| キー | 何が変わる | 効く時 | 層の候補 |
|---|---|---|---|
| `commentHoldMaxAgeSec` / `commentHoldMaxCount` | あとで拾うコメントの鮮度と件数(既定 20 秒 / 3 件) | 次の起動 | 体験 |
| `backchannelMinIntervalSec` | speak-now の相槌どうしの最小間隔(既定 8 秒) | 次の起動 | ロール(方針) |
| `latencyWarnSec` / `latencyAlertSec` | 遅延の棒の琥珀・赤の境目(既定 4 / 6 秒) | 次の起動 | 外(観測)・操作 |
| `compactQuietSec` / `compactMinIntervalMin` | 圧縮の隙間と最小間隔(既定 3 秒 / 10 分) | 次の起動 | 芯 |
| `localSttThreads` / `localSttPreRollMs` / `localSttSilencePadMs` | ローカルの文字起こしの調整 | 次の Start | 出入(耳) |
| `localSttHotwords` / `localSttHotwordsScore` | Zipformer の名前の手がかり(既定「チャッピー」「コーディ」の固定・頭脳と無関係) | 次の Start | ロール(名前)を耳が使う【曖昧】 |

### 3.11 起動引数(`scripts/cockpit.mjs:129-152`)

| 引数 | 何が変わる | 保存先 | 効く時 | 層の候補 |
|---|---|---|---|---|
| `--port N` | 操縦席のポート(既定 8181) | — | 起動 | 操作。AHK の `CockpitPort := 8181` を手で合わせる(`scripts/fire-hotkey.ahk:31`) |
| `--open` | 起動後にブラウザを開く | — | 起動 | 操作 |
| `--channel <ws-url>` | 器の URL の初期値。頭のセッションを起動時に作る | 設定 `lastChannelUrl` にも書く | 起動 | 出入(体)かロール【曖昧】 |
| `--tts-base-url <url>` | AivisSpeech の場所 | — | 起動 | 外(資源) |
| `--speaker <id>` | AivisSpeech の話者(無ければ `src/voice/tts-client.mjs:29` の既定) | — | 起動 | ロール(声) |
| `--fire-window-min` / `--fire-max-chars` | 頭に渡す会話の窓の幅と文字数 | — | 起動 | 芯 |

## 4. 操縦席の外でやること

- **起動**: ターミナルで `node scripts/cockpit.mjs`(または `npm run cockpit --prefix apps/soul/agent`)。終了も同じターミナルの Ctrl+C。
- **体(runtime-player)**: 起動して、Channel を Open にし、URL をコピーして操縦席の「器(Channel)」に貼る。channel は起動のたびに Closed から始まる。token と port は runtime-player 側に残るので、2 回目からは URL の貼り直しは要らないことが多い【推測。runtime-player の保存を見ただけで、実際に同じ URL になるか確かめていない】。
- **AivisSpeech**: 自分で起動しておく。ElevenLabs の声でも、読みを取るために要る。
- **ホットキー**: AutoHotkey v2 で `scripts/fire-hotkey.ahk` を起動する。`Ctrl+Alt+F` 発火 / `Ctrl+Alt+G` 画面を見て発火 / `Ctrl+Alt+K` KILL。復帰はホットキーに無い。
- **キーと資格の置き場**(中身は読んでいない):
  - `apps/soul/agent/.env.elevenlabs.local`(ElevenLabs の文字起こし・声・残量)
  - `apps/soul/agent/.env.decisions.local`(判定 API = speak-now・コメント判定・思い出しの判定)
  - 頭の資格は各サービスの資格ファイル(`brains.mjs` の `credentialPath`)。操縦席は有無だけ見る。
- **ローカルの文字起こしのモデル**: `scripts/fetch-local-stt-models.mjs` で取ってくる。無いと Start が失敗する(`cockpit-server.mjs:1267-1283`)。
- **設定ファイルの手書き**: §3.10 のキー。
- **声の話者**: AivisSpeech の話者は起動引数 `--speaker` だけ。ElevenLabs の声の id はコードの定数(`src/voice/engines/elevenlabs-voice-engine.mjs:60`)で、画面にも引数にも口が無い。
- **配信の外の準備**: YouTube の概要欄の AI 開示文言、合成コンテンツの申告、OBS で声の出力先を拾う設定(`discussion/ai-cohost/operations/pre-stream-checklist.md` ①④)。

## 5. 引っかかり

### 5.1 頭脳の言葉で、ロールの中身を選んでいる

- 「頭脳」の select はモデル名だけを並べる。でも選ぶと名前(こーでぃー / チャッピー)と会話指示まで替わる。画面のどこにも「名前が替わる」とは書いていない。
- 会話指示は頭脳の id ごとに 6 つ別々に持つ(`cockpit-settings-store.mjs:214-243`)。編集の画面の select の見出しは「技術頭脳」。同じチャッピーでも、GPT-5.6 Sol と GPT-6.1 Sol で別の指示になる(scope §8 の「ほぼ同じはず」とつながる)。
- 名前の一覧は 2 つ(`header.mjs:36-39`、`src/mind/model-identity.mjs:57`、`:66`)。名前は頭脳の表の行に付いている。
- 声・口数・話し始め・hotwords・記憶は、頭脳を替えても替わらない。名前と会話指示だけが頭脳について回る。

### 5.2 一部の頭脳でしか意味の無い操作

- 「圧縮を始める大きさ」「Codex の fast」は Codex の頭だけで効く。Claude の頭でも同じ場所に出て、文言で「効きません」と言う。
- 残量「Codex 週」は Codex の頭のときだけ値が出る。
- 記憶の書き出し役と思い出し役は、Claude の頭のときは既定の Codex になる(`scripts/cockpit.mjs:594-599`)。画面には出ない。

### 5.3 黙って他のものに頼っている

- **声は体が無いと出ない。** Channel URL が無いと、手動の発火も失敗する(`scripts/cockpit.mjs:1886-1888`)。失敗は上の帯に「頭のエラー」と出るはず【推測。`fireError` が `brain-error` になる道(`cockpit-server.mjs:1157-1163`)を読んだだけ】。原因が器でも、言葉は「頭」になる。
- **器の状態は、最初の発火まで idle。** Channel は最初の発火で初めてつながる。チェックリスト ② の「Channel が緑」は、一度発火しないと見えない。メイン画面には器の状態が出ない(警告の種類にも器の未接続が無い)。
- **speak-now は自発が ON でないと動かない。** 初回の既定は「話し始め = speak-now」「自発 = OFF」。このままだと自分からは何もしゃべらない(`cockpit-server.mjs:2398-2399`)。画面にその関係の説明は無い。
- **コメントは耳が動いていないと捨てられる。** YouTube に Connect していても、耳が止まっていれば診断だけ出して積まない(`cockpit-server.mjs:2824-2832`)。
- **YouTube は自動で再接続しない。** 前回の URL は入力欄に戻るが、起動のたびに Connect を押す。
- **文字起こし・声・マイクは Start でしか効かない。** 動いている間に選び直しても、Start は何もしない(`cockpit-server.mjs:1196-1198`)。Stop → Start が要る。Stop は記憶の保存を走らせ、転写の正本(耳の中のバッファ)も作り直しになる【推測。Start のたびに新しい耳を作る(`cockpit-server.mjs:1331`)ことから】。
- **声の方式は入出力タブの耳の行にある。** 声(出口)の切り替えが、耳(入口)の Start に縛られている。
- **忙しい間のコメント・コメント反応は speak-now の間だけ。** 口数がコメント応答に効くのは従来モードの側。どちらも YouTube に Connect しているときだけ意味がある。
- **Fire+視覚・画面を見る発火は、視界の窓に頼る。** 窓は「ゲーム窓」と書かれている。

### 5.4 同じものが 2 か所にある / 一部しか戻らない

- 運転設定は、下の帯(表示だけ)と運転タブ(操作)の 2 か所。
- KILL は上の帯のボタンと AHK。発火は運転タブのボタンと AHK。
- 耳の状態は、上の帯のピルとログタブの健康の行。
- 声の出力先と視界の select は、開くと一覧の先頭が選ばれている。保存した値は下の文字で出るだけ。そのまま Set を押すと先頭のデバイス・窓になる。
- 記憶の保存の引き金が 4 つある(20 分ごと・今日を記録・Stop・Ctrl+C)。画面に出るのは「最後に記録」の時刻だけ。

### 5.5 言葉が配信に寄っている

- 「配信前」「配信者」(会話の話者)、「今日を記録」、「視界(ゲーム窓)」、口数の説明の YouTube、接続タブの YouTube。
- 状態の文字やボタンは英語が混じる(Set / Connect / Start / not configured / connected など)。

### 5.6 置き場が 1 つ

- 画面で変えるものも手で書くものも、`cockpit-settings.local.json` 1 つに入る。Channel の token(`lastChannelUrl`)もここにある。
- 記憶のフォルダは 1 つ(`memories/`)。ロールや頭脳で分かれない。

## 6. 文書とコードの食い違い

コードが正しい、として書く。

| 文書 | 文書の言うこと | コードの今 |
|---|---|---|
| `discussion/ai-cohost/operations/pre-stream-checklist.md` ⑥ | 口数は「操縦席運転バー」で見る | 運転バーは無い。準備・設定の運転タブ(`ui/control-bar.mjs:1-8`)。下の帯に表示だけある |
| 同 ⑦ | 「操縦席 Chat」で Connect | 接続タブの「YouTube」(`settings-drawer.mjs:853`) |
| 同 ② | Channel が緑 | 最初の発火まではつながらない(idle)。§5.3 |
| 同 §1 | 「コーディ(Cody)」 | 画面の名前は「こーでぃー」(`model-identity.mjs:57`、`header.mjs:37`) |
| 同 全体 | 起動の手順・AivisSpeech・自発を ON にすること・会話指示・記憶の保存・終了の待ちは書いていない | §2・§4 のとおり必要 |
| `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md` §2・§3 | タブは 4 つ(接続 / 入出力 / 頭脳・会話 / 記憶)。発火・自発・かぶり・口数・KILL はダイアログの外。会話指示は 4 つの頭脳 id。初回の自動展開を残す。歯車はヘッダ。会話指示の画面に記憶の構造を見せる | タブは 6 つ(運転・ログが増えた)。自発・かぶり・口数・発火はダイアログの中(KILL だけ上の帯)。頭脳 id は 6 つ。自動展開はやめた(`ui/app.mjs:157`)。歯車は下の帯。記憶の表示は撤去(`settings-drawer.mjs:18`) |
| `discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md` §1・§5 | 配信中は操縦席を操作できない。発火と KILL のボタンは置かない | §7 で改めた。KILL のボタンは上の帯に常にある。発火のボタンは運転タブにある |
| `discussion/ai-cohost/implementation/screens/cockpit-stt-selection.md` :75 | 声のプレイヤーは最初の Fire で作られ、耳の Start では起動しない | 今は Start で声のプレイヤーと声の engine を起こす(`scripts/cockpit.mjs:27-28`、`:2208-2217`) |
| 同 :14・:50 | 文字起こしは whisper / ElevenLabs の 2 つ | 4 つ(Zipformer・Parakeet が増えた。`view-logic/settings.mjs:365-371`) |
| `scripts/fire-hotkey.ahk` の冒頭 | 操縦席を `--channel` 付きで「fire 有効で起動」しておく。対象は操縦席の「Vision target」で選ぶ | `--channel` は無くてよい(接続タブで入れる)。見出しは「視界(ゲーム窓)」 |
| 依頼の文 | `pnpm cockpit` で起動 | リポジトリ直下の `package.json` に `cockpit` は無い。`apps/soul/agent/package.json:9` にある(そのフォルダの中なら `pnpm cockpit` で動くはず【推測】)。文書の書き方は `npm run cockpit --prefix apps/soul/agent` |
| `discussion/ai-cohost/implementation/screens/cockpit-redesign.md`・`soul-cockpit.md` | 引き出し・ヘッダ・運転バーの画面 | どちらも古い段階の文書(Draft 2026-07-14 / S2.5)。今の画面は cockpit-glance-redesign.md の形 |

## 7. 未確認のこと

- Channel URL が無いときの発火の失敗が、上の帯でどう見えるか(「頭のエラー」になると読んだが、動かしていない)。
- runtime-player を 2 回目に起動したとき、Channel の URL が前と同じになるか。runtime-player の起動の仕方(配信者がどのコマンド・どの窓から開くか)は追っていない。
- AivisSpeech が立っていないとき、操縦席がどこでどう知らせるか。
- Stop → Start のあと、画面の会話タイムラインと、頭に渡る会話の窓がどう見えるか(耳の中のバッファは作り直しになると読んだ。頭のセッション自体は続く)。
- 状態の色(器の「緑」など)の CSS は見ていない。
- `conversationInstructions` の今の中身と、`memories/` の中身。開いていない。
- 配信者が実際に `--open` や `--speaker` を使っているか。設定ファイルに手書きのキーが入っているか。
- OBS の側の設定(声の出力先をどう拾うか)。リポジトリの外。
