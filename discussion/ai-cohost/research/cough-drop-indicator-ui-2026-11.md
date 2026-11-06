# 咳として落とした区間の知らせ — 操縦席のどこに置くか(調査 2026-11-06)

調べた人: Sylph / 宛先: Undine。読むだけの調査(コード・設定は変更なし、操縦席は起動していない、実データは未読)。
ラベル: 【リポジトリ事実】= file:line で確認 / 【推測】= 私の読み・見込み。パスは `apps/soul/agent/src/` 起点(`cockpit/...`、`ears/...`)。

ユーザーの要望(2026-11-06): タイムラインに乗せたくない / 軽く分かる形 / 落とされたと知りたいが積極的ではなく、「咳として落としてるやつあるな」と分かる程度 / 画面のどこかに残り続けるのは嫌。

---

## 1. 結論(推し)

**推しは候補 A「上の帯の状態のピルの隣に、短い間だけ出る小さな札『咳 ×N』」**(client だけで完結・数秒で自然に消える・タイムラインにも警告にも混ぜない)。

理由(要点):
- 配信者が横目で見る場所(上の帯)で、すでに「聞いてる」のピル(耳の状態)がある。そこの隣は「耳のことだ」と直感的に結びつく【推測】。
- 「消える」仕組みは画面側に 1 秒刻みの時計が既にあり(`ui/app.mjs:331` の `nowTick`)、期限切れを描画時に判定するだけで足りる。サーバ側の板も記録も要らない【リポジトリ事実+推測】。
- 落とした区間の文字・確率は札には出さず、マウスを乗せたとき(`title`)だけ。画面の上だけ・サーバは記録しない前提と合う。
- 配信中ずっと残る場所(会話の列・警告・ログの数字)に足さないので「残り続けるのが嫌」を満たす。

注意: 画面に「一瞬光る」類のアニメーションは**今 1 つも無い**(§3)。札の出入りを滑らかにするなら `@keyframes` を初めて足すことになる(不要なら出入りは即時でもよい)。

---

## 2. 画面の今の作り(領域ごと・何を出す・いつ消える)

骨組みは `cockpit/cockpit.html:23-27`(`#app` に `ui/app.mjs` の `mount` を載せるだけ)。全体の 3 段組は `cockpit/ui/styles.mjs:101-107`(上の帯 / メイン / 下の帯)。App の構成は `cockpit/ui/app.mjs:407-516`。

| 領域 | 出しているもの | 消え方 | 根拠 |
|---|---|---|---|
| 上の帯: 名前・モデル名 | ロールの表示名、頭のモデル名 | 常時 | `cockpit/ui/header.mjs:123-131` |
| 上の帯: 状態のピル | 喋ってる / 圧縮中 / 考えてる / 始めてる / 記録中 / **聞いてる(耳)** / 起動中 / 止まってる | 状態が変われば入れ替わる(常に 1 つ表示) | `cockpit/view-logic/glance-meters.mjs:181-192`、`header.mjs:132` |
| 上の帯: Discord の接続表示 | Discord の場の間だけ、入っている途中 / 入っている / 切れた | 場が閉じれば消える | `header.mjs:133`、`styles.mjs:131-136` |
| 上の帯: 警告 | 異常のときだけ小さな札。最大 3 個 + 「+N」 | 状態型は直れば消える。出来事型は 60 秒(`WARNING_EVENT_TTL_MS`)で消える | `header.mjs:135-140`、`glance-meters.mjs:141-168`、`warnings.mjs:35,129-166` |
| 上の帯: 残量ゲージ 2 本・KILL | Codex 週 / ElevenLabs 月、KILL ボタン | 常時 | `header.mjs:141-148` |
| 会話タイムライン(左 約 6 割・主役) | you / soul の行、判定の札、遅延の棒、「推論に使った範囲」、薄い note 行(相槌の間隔で流れた判定)、出来事の行(Discord) | 最新が下、**最大 300 行保持**(`CONVO_KEEP`)で、入りきらない古い行は上で切れる。履歴が残る領域 | `cockpit/ui/conversation.mjs:1-24,96-115`、`glance-timeline.mjs:38` |
| 会話: 配信前の中央 | 「配信を始める」「Discord の VC に入る」「準備・設定」・始められなかった理由 | 場が開けば消える | `conversation.mjs:87-105` |
| コメント(右 約 3.5 割) | 視聴者コメント・反応印・**「弾いた: 種類」(本文なし)** | **最大 200 行保持**(`COMMENTS_KEEP`)。弾いた行は列に積まれて押し流されるまで残る | `cockpit/ui/comments.mjs:1-46`、`glance-timeline.mjs:40,229-240,515-520` |
| Discord の操作パネル(Discord の場の間、コメント列の置き場) | 接続 / しゃべり方 / 見る窓 | 場が閉じれば消える | `app.mjs:508-519`、`cockpit/ui/discord-panel.mjs:60-` |
| 下の帯 | 運転設定の表示(自発・口数など)、遅延の凡例 8 つ、「配信を終える」(2 回押し・4 秒で戻る)、歯車 | 常時(「配信を終える」は場が開いている間だけ) | `cockpit/ui/bottom-bar.mjs:25-46`、`app.mjs:424-427` |
| 準備・設定(ダイアログ・普段は畳む) | 5〜6 タブ。「ログ」タブに観測フィード(全行・ゴースト行・usage)・**discarded の数字**・稼働時間・耳/whisper/ffmpeg/stt/tts の健康 1 行 | フィードは残る(開かないと見えない) | `cockpit/ui/settings-drawer.mjs:157-162`、`feed.mjs:95-135`、`header.mjs:79-100`、`app.mjs:536-540` |

今すでにある「落とした」系の表示(重要):
- **`discard` SSE** → ログのタブに薄い斜体のゴースト行「(discarded)」と、footer の累計数字 `discarded:`(ともにログのタブの中だけ・開かないと見えない)。`cockpit/view-logic/ghost.mjs:29-32`、`cockpit/ui/rows.mjs:279-280`、`app.mjs:313-316`、`feed.mjs:135`。ラベルは `reason` を見ない一律の「(discarded)」【リポジトリ事実】。
- **会話タイムラインは `discard` を無視する**: `glanceAfterSseEvent` の switch に `discard` / `diagnostic` の case が無い(`glance-timeline.mjs:278-340`、固定テスト `glance-timeline.test.mjs:192`)。つまり**咳の知らせを discard / diagnostic に載せるだけでは会話の列には乗らない**【リポジトリ事実+推測】。

---

## 3. 一時的な表示のしくみ(あれば・使い回せるか)

操縦席の中に**アニメーション・トースト・点滅・フェードは存在しない**。`cockpit/` の非テストのコードで `toast|blink|flash|badge|pulse` は 0 件、`@keyframes` / `animation` / `transition` も `styles.mjs` に 0 件(grep 結果【リポジトリ事実】)。あるのは次の 3 種類の「出て消える」だけ。

1. **警告の出来事型(サーバ側の板)**: `createWarningBoard().pushEvent(id, spec)`(`cockpit/warnings.mjs:129-166`)。`eventTtlMs` 60 秒で消え、同じ id が続けば期限を延ばし `×回数`(`warnings.mjs:149-165`、表示は `glance-meters.mjs:155-157`)。変更は `onChange` で SSE `warnings` に載る(`cockpit-server.mjs:1470`)。表示側は `warningsView(list, nowMs)` が `expiresAtMs <= nowMs` を弾く(`glance-meters.mjs:150-153`)。上の帯は 1 秒刻みの `nowTick` を渡している(`app.mjs:331`、`header.mjs:126`)ので、サーバからの「消えた」通知が遅れても画面側が自分で消せる。
   - 使い回せる点: 出来事型・回数のまとめ・期限延長・`title` に補足(`detail`)。
   - 使い回しにくい点: 色が `warn`(琥珀)か `alert`(赤)の 2 つだけ(`glance-meters.mjs:156`、`styles.mjs:158-160`)。「異常があるときだけ」の領域(`header.mjs:20`、`warnings.mjs:6-7`)なので意味が違う。表示は最大 3 個で、咳が本物の警告を押し出す可能性がある(赤が先に並ぶので赤は残る・琥珀の警告は「+N」に押される)。警告の一覧は snapshot にも載る(`app.mjs:285`)ので、画面を開き直すと残り時間ぶん復元される(これは残り続けるのではなく 60 秒以内の話)。
2. **2 回押しの armed 状態**(`app.mjs:424-427`): `setTimeout` 4 秒で戻る、クライアントだけの一時状態。仕組みは「state + setTimeout」。同じ型で、「札を出す state + 数秒の timer」は作れる(新規は小さい)。
3. **状態のピル**(`glance-meters.mjs:181-192`): 状態が変われば入れ替わる。一時的な出来事の表示ではない(咳のたびにピルを替えると「聞いてる」が点滅して煩い・【推測】)。

ログのタブのフィードは「残る」側(`feed.mjs`)。上の帯のゲージは常時。

---

## 4. 区間が画面に届く経路

### 4.1 サーバから画面
- 画面は `EventSource("/api/events")` で購読(`app.mjs:261`)し、`SSE_EVENT_NAMES` 17 本(`app.mjs:78-96`)を `addEventListener`。受けるたびに ログのフィード(`feedAfterSseEvent`)・会話/コメント(`glanceAfterSseEvent`)・非タイムライン効果(`applyNonFeedSseEvent`)の 3 経路に通す(`app.mjs:262-268`)。
- 名前の一覧は固定点で、テストが本数と名前を固定している(`cockpit-ui.test.mjs:101` 付近・`app.mjs:76`)。**新しい SSE イベント名を足すとこのテストと一覧の更新が要る**。既存の名前を使うなら不要。
- サーバの出口は `broadcast(event, data)`(`cockpit-server.mjs:1727-1737`、全クライアントへ `event:/data:` フレームを書く)。

### 4.2 耳の結果(文字起こし)の道
- 耳(`ears/ear-pipeline.mjs`)が発話区間を文字起こしし、`transcriptBuffer.append({startMs,endMs,text})` で会話の正本(`ears/transcript-buffer.mjs`)に積む(ローカル STT は `ear-pipeline.mjs:389-392`、ElevenLabs の commit は `:419-430`)。
- 積めた行 → 耳ごとの口 `makeEarTranscriptMouth(engine)`(`cockpit-server.mjs:1841-1871`)が `broadcast("transcript", {...})`。画面側は会話(you)・ログに反映する。
- 積めなかった行(空白のみ・`isBlankTranscript`)→ `append` が `discarded += 1` して `onDiscard` の購読者へ `{startMs,endMs,text,reason:"blank"}` を渡す(`transcript-buffer.mjs:186-197`)。場が張った購読(`cockpit-server.mjs:2556-2565`)が **`broadcast("discard", { startMs, endMs, reason, appended, discarded })`**。なお `text` は info にあるが**放送には載せていない**【リポジトリ事実】。
- 耳が VAD の出来事(`speechStart/End/Cancel`)を `broadcast("vad", …)` で流す(`cockpit-server.mjs:1818-1826`)。画面は speaking 行のみ使う(ログ)。

### 4.3 ローカルの耳と Discord の耳
- **口は同じ**: ローカル(配信のマイク)は `venue.earTranscriptMouth({engine})`(`cockpit-server.mjs:2328`)、Discord は `x.venue.createEar({... transcriptBuffer: speakerTranscriptMouth(x.venue.transcriptBuffer, person) ...})`(`discord/discord-experience.mjs:491-499`)→ `createVenueEar`(`cockpit-server.mjs:2052-2063`、`onTranscript: makeEarTranscriptMouth(...)`、`onDiagnostic: handleDiagnostic`)。どちらも同じ `venueTranscript`(場の正本)と同じ `discard` 購読、同じ `ear-pipeline` に行き着く。画面側は経路を区別しない(会話の you の名前だけ Discord の名前になる・`app.mjs:386-389`)。
- **違いは「誰の」**: Discord は 1 人 1 本の耳(`person.key`)で、`speakerTranscriptMouth` が正本への `append` に名前・id を足している(`discord-experience.mjs:275-288`)。咳を耳の出口(`ear-pipeline` の `append` の前)で落とすなら、その時点では耳は人を知らない。**「誰の咳か」を知らせに載せたいなら、耳に人の識別を渡す口が別途要る**【推測】。「咳 ×N」だけなら不要。
- `diagnostic`(`cockpit-server.mjs:1794-1806`)は耳が `onDiagnostic` で出す道(asrFailure が `startMs/endMs` を持つ・ゴースト行)。未知の type は**ログにも出ない(null)**(`ghost.mjs:68-71`)、会話にも乗らない。

### 4.4 落とした区間の知らせを足すなら、口はどこが自然か(候補・決めない)
- **口 α: 既存の `discard` に `reason: "cough"` を足して流す**(推し寄り)。サーバの出口 1 か所(`cockpit-server.mjs:2556-2565` の周辺)に揃い、SSE 名の追加なし。ただし今の `discard` は「正本が空白を捨てた」の道(`transcript-buffer.onDiscard`)で、咳の判定は耳の出口(`ear-pipeline` で `append` の前)になる想定なので、**耳から正本を経由せず場へ知らせる新しい口**(ear-pipeline の option か `onDiagnostic` 経由)が要る。画面側は `discard` を受けると既に ログに「(discarded)」を足し `discarded` カウンタを上げる(`rows.mjs:279-280`、`app.mjs:313-316`)ので、咳を同じ `discard` に混ぜると**ログのタブの `discarded:` カウンタに混ざる**(意味を分けたいなら `reason` 見て分岐)。`discard` の payload に `reason` は既にあるので、画面は `reason === "cough"` を見て一時表示に使える。
- **口 β: `diagnostic` の新 type(例 `coughDropped`)**。`handleDiagnostic` が既に任意フィールド(startMs/endMs/reason/message…)を載せて流す(`cockpit-server.mjs:1794-1806`)。未知 type は log にも会話にも出ない(`ghost.mjs:68-71`、`glance-timeline.mjs` は diagnostic を見ない)ので「他の画面を汚さない」。**本文・確率を載せるフィールドは今の固定リストに無い**(`message` / `reason` に詰めるか、リストの追加)。カウンタ(`discarded`)にも混ざらない。ear-pipeline からは既に `onDiagnostic` が使えるので、**耳側の配線が最も小さい**【推測】。
- 新しい SSE 名(`coughDrop` など)は本数固定のテスト・一覧(§4.1)に手が入る。クリーンだが一番大きい。

---

## 5. 候補

共通の前提: 画面だけ・サーバは記録しない。表示は client の state + 期限(`nowTick`、`app.mjs:331`)で消す。

### 候補 A: 上の帯・状態のピルの隣に「咳 ×N」の小さな札(推し)
- **どこに・何を**: `header.mjs:132-133` のピル / Discord 接続表示の並びに、`.warn-chip` と別の薄いグレー札(`styles.mjs:160` の `.warn-chip.more` に近い見た目)。文言は「咳 ×2」程度。
- **消え方**: 最後の咳から約 6〜10 秒でページ側が自分で消す(`now - lastAt > N`)。続けて落ちれば `×N` が増えて期限が延びる。期限切れで `N` を 0 に戻す。出入りを CSS の一回きりの `@keyframes`(薄く光ってフェード)にするかは任意(今は無いので新規)。
- **中身に文字・確率**: 札の文言には出さない。`title`(ホバー)だけに「うん / Speech 0.04」を入れられる(画面のみ・warnings の `detail`→`title` と同じ流儀、`glance-meters.mjs:158`)。常時は出さない。
- **体験**: 良: 横目の定位置・耳の隣で意味が通る・タイムラインにも警告にも混ざらない・自然に消える。悪: 配信者が上の帯を見ていない瞬間に出て消えると気づかない(要望は「積極的でなく」なので許容【推測】)。nowrap の flex の中に出入りするので、他の要素(`.top-warnings` は `flex:1`)が少し動く → 場所を固定幅で確保するか絶対配置が要る。
- **手間**: 小〜中。新規: App に state 1 組(lastAt / count)、`discard` or `diagnostic` の受け口(`applyNonFeedSseEvent`、`app.mjs:309-336`)、view-logic に純関数 1 本(`glance-meters.mjs` 流儀・テスト可)、TopBar に札、CSS 数行。サーバは口 α か β の 1 か所。
- **使い回し**: `nowTick`(1 秒時計)、`.warn-chip` の見た目、`applyNonFeedSseEvent` の switch、`discard` / `diagnostic`(§4.4)。

### 候補 B: 既存の「警告」の出来事型に載せる(`pushEvent`、薄い info 色を足す)
- **どこに・何を**: 上の帯の警告欄(`header.mjs:135-140`)に「咳として落とした ×N」。サーバの `warningBoard.pushEvent("cough-drop", …)`(`warnings.mjs:129`)。
- **消え方**: 最後の咳から 60 秒(`WARNING_EVENT_TTL_MS`)。回数は ×N で自動集計(`warnings.mjs:149-165`)。
- **中身に文字・確率**: `detail`(ホバーの `title`)に入れられる。ただし `warnings.mjs:11-13` の方針(会話本文は入れない・呼び出し側が伏せた文言だけ)と、サーバ側の板・snapshot に載る(`app.mjs:285`)ことから、**本文は載せない方が一貫**【推測】。確率だけなら可。
- **体験**: 良: 実装が一番小さい・消え方も既存どおり。悪: 警告欄は「異常があるときだけ」の領域で、咳が出ると琥珀色の警告が付き**誤報感**(色が `warn` か `alert` のみ。info 色を足すと見た目の変更も要る)。1 分間も残る(要望の「残り続けるのは嫌」に近づく)。最大 3 個の枠(`WARNINGS_SHOWN`)を食う。
- **手間**: 最小。サーバ 1 か所(`pushEvent` ・別の口 β 相当)+ 任意で info 色 1 つ(CSS 数行 + `glance-meters.mjs:156` の className)。テストは `warnings.test.mjs`・`cockpit-ui-glance.test.mjs` 流儀。
- **使い回し**: `warnings.mjs` 一式・`warningsView`・`.warn-chip`。

### 候補 C: 会話パネルの見出し行(「会話」の右)に、数秒だけ出る控えめな数字
- **どこに・何を**: `conversation.mjs:96` の `<h2 class="panel-title">会話</h2>` の右端に「咳 ×2」(行リストの外・`convo-list` には入れない)。
- **消え方**: A と同じく client の期限(数秒)。
- **中身に文字・確率**: 札には出さない・`title` のみ。
- **体験**: 良: 主役の会話の目の前で、「今の変な応答はこれの有無」と結びつけやすい。悪: ユーザーが「タイムラインに乗るのは何かやだ」と言った場所のすぐ隣で、見た目が近いため**タイムラインの一部のように感じられる恐れ**【推測】。Discord の場では会話パネルは同じ(`app.mjs:497-505`)なので問題なし。
- **手間**: A と同程度(受け口・state・純関数)。TopBar でなく ConversationPanel に props を足す点が違う。
- **使い回し**: A と同じ(時計・受け口)。

### 候補 D(参考・最小): 画面に出さずログのタブだけに残す(今の `discard` の道を活かす)
- **どこに・何を**: ログのタブのゴースト行(「(discarded)」を `reason` で「(咳として落とした)」に出し分け)と、`discarded` カウンタ(`rows.mjs:279-280`、`feed.mjs:135`)。メイン画面は無変更。
- **消え方**: ログに残る(フィード行は積み上がる)。ただし**準備・設定のダイアログを開かない限り見えない**(`app.mjs:536-540`)。
- **体験**: 「画面のどこかに残り続ける」ことは無い(メインには出ない)が、「あ、落としてるやつあるな」と**気づく手段にならない**(要望の「軽く分かる」を満たさない)【推測】。A〜C のどれかに付け足す「記録側の補助」としてなら、既存の道を活かすだけで済む。
- **手間**: 最小(`ghost.mjs` の分岐 + 口 α)。
- **使い回し**: `discard` SSE・ゴースト行・カウンタ。**注意: `discarded` の数字は blank 破棄と混ざる**ので出し分けるなら `reason` を見る。

### 推し(再掲)
**A**。理由: (1) 横目の定位置である上の帯の耳(聞いてる)の隣で意味が自然に通じる、(2) 画面側の 1 秒時計で自然に消え、サーバに板も記録も要らない、(3) 警告欄の「異常のときだけ」の意味を汚さず(B との違い)、会話のタイムラインに近づけすぎない(C との違い)、(4) 手間は小〜中。文字・確率はホバーの `title` のみ(画面だけ)。D はあとから足せる補助。

---

## 6. 質問(Undine / ユーザーへ)

1. 消えるまでの時間はどのくらいを想定するか(私の目安は 6〜10 秒・「軽く分かる」程度)。60 秒(警告の出来事型と同じ)だと「残り続ける」感が出ると見ている。
2. 札に本文(「うん」)や確率(Speech 0.04)を出すか。私の推しは「札には出さず、ホバーの `title` だけ」。本文を SSE に載せるのは、`discard` が今は本文を載せていない(`cockpit-server.mjs:2556-2565`)ので設計判断になる(画面だけ・記録しない前提でも、サーバ → ブラウザの経路には出る)。
3. 咳の知らせの口は α(`discard` に reason)・β(`diagnostic` の新 type)・新 SSE 名のどれにするか。私の読みでは β が耳側の配線最小(`ear-pipeline` に既に `onDiagnostic` がある)、α は画面側が既に `discard` を受けているので受け口が簡単、ただし `discarded` カウンタと混ざる点の整理が要る。
4. Discord で「誰の咳か」を示したいか(要らなければ「咳 ×N」だけで足りる。要るなら耳に人の識別を渡す口が要る・§4.3)。
5. ElevenLabs の STT(commit 経路 `ear-pipeline.mjs:419-430`)にも同じ咳の落としを掛ける想定か(音の種類の判定は音声が要るが、commit は文字しか来ない・【推測】)。段階 2 の対象がローカル STT の経路のみなら、画面は「その経路で落ちたときだけ出る」でよい。
6. 札の出入りにアニメーション(一瞬光る・フェード)を付けるか、即時の出入りでよいか。前者は操縦席に初めて `@keyframes` を足すことになる。
7. (範囲外の気づき)記録は画面側だけで構わないとのことだが、サーバの warnings 一覧は snapshot に載るので、B を選ぶ場合は 60 秒以内の開き直しで復元される。A / C は開き直しで消える(client の state のみ)。この差を許容するか。
