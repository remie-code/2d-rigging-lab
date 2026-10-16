# 操縦席: 文字起こしの選択(whisper / ElevenLabs)

> Status: 体験の合意 Accepted、context-check 済み(2026-10-16、ユーザー × ウンディーネ)。Gnome が実装済み(2026-10-16、`node --test` 1130/1130、check:soul-zone 通過)。**ユーザーが操縦席で確認し合格**(ElevenLabs で動作、確認事項に問題なし。2026-10-16)。
> ゴール: **文字起こしが ElevenLabs で動くようになること**(ユーザー 2026-10-16)。
> 前提の実験・調査: [../../elevenlabs/_map.md](../../elevenlabs/_map.md)(特に experiments/01-stt-behavior.md)、[../../research/ears-capture-buffer-2026-10.md](../../research/ears-capture-buffer-2026-10.md)。現在の操縦席の UI 定義: [cockpit-redesign.md](cockpit-redesign.md)。

## 1. Why

- 発端は STT の確定遅延。現行 whisper 経路は喋り終わりから転写到着まで平均 ≈2.15 秒(取り込み遅れ込みの推定)。ElevenLabs のリアルタイム STT(VAD 無音しきい値 0.3 秒)は commit が喋り終わりから ≈0.9 秒で届いた(実測)。
- 配信中は ElevenLabs を基本にする。ローカル whisper も選べるように残す。

## 2. 今回の範囲

1. 文字起こしの方式を操縦席で選べるようにする(ローカル whisper / ElevenLabs)。
2. 耳のマイク取り込みを dshow `-audio_buffer_size` 既定 50ms にする(現行は約 500ms ずつ届く)。
3. 起動中もヘッダが「Stopped」のままになる不具合を直す(Start 押下後は「Starting」を表示する)。

範囲外(触らない):

- 区切り応答の固定 2 秒待ち(`TURN_END_SILENCE_MS`)。将来 Decisions API の「今喋るべきか」判定で置き換える構想がある([../../decisions/_map.md](../../decisions/_map.md) の `speak-now/`)。
- 短い commit(「だから-」等)をまとめる処理。
- barge-in の仕様変更。運用ではほとんど off の見込みだが、機能は残す。
- **区切り応答・呼びかけ(話し始めの判定)の修正**。ユーザーは話し始めの判定を全面的に改定するつもりで、別途議論のうえ直す(§7)。
- 呼び名の keyterms・previous_text は渡さない(同上の理由)。

## 3. 構造の合意

- **合図は手元、文字起こしは ElevenLabs**。手元の Silero VAD(speechStart / speechEnd / speechCancel)は今のまま動かし、barge-in と区切り応答はそれで動く。ElevenLabs が置き換えるのは whisper による転写の部分だけ。
  - 理由: ElevenLabs には「喋り始めた」合図がなく、最初の partial は喋り始めから約 1 秒後(barge-in には遅すぎる)。commit を speechEnd の代わりにすると遅く(≈0.9 秒 vs 手元 ≈0.45 秒)、約 36 秒の自動確定など発話途中の commit もあり、取り消しに使う speechStart もない。手元 VAD は 1 フレーム ≈0.18ms で軽い。
- ElevenLabs を選んだときは whisper-server を起動しない。
- ElevenLabs の設定: `scribe_v2_realtime`、`commit_strategy=vad`、`vad_silence_threshold_secs=0.3`(受け付ける下限。ただしサーバーは実効 0.5 秒に丸める。2026-10-16 判明)、`audio_format=pcm_16000`、`language_code=ja`。耳の取り込み(16kHz mono s16le)をそのままストリームで送る。
- **commit 1 件を、文字起こし 1 件として転写バッファに積む**。partial は積まない。
- 接続が切れたら自動で繋ぎ直すだけ。whisper へは自動で切り替えない。
- キーは `apps/soul/agent/.env.elevenlabs.local` の `ELEVENLABS_API_KEY`(gitignore 済み)を、操縦席の起動時に読む。

## 4. 体験

### 4.1 今(リポジトリ事実、2026-10-16 時点)

- `start-cockpit.cmd` でサーバーが立ち上がりブラウザが開く。耳は止まっている。LLM セッションと声のプレイヤーは最初の Fire のときに作られる。
- 耳の起動は設定モーダル「入出力」タブのマイク行の **[Start]** だけ。VAD 準備 → whisper-server のモデル読み込み待ち(最大 120 秒)→ マイクを開く。
- 起動中もヘッダは「Stopped」のまま。成功すると「● Listening」と `whisper: up / ffmpeg: up`。
- 今使っているマイク名は画面のどこにも出ない。
- 観測フィードの you の行は、手元 VAD の 0.4 秒の区切りごとに 1 行、whisper の転写が届いた時点で出る。行の横に `(1.5s)` のような遅延が出る。喋っている間は「you ······(speaking)」の行だけが出る。

### 4.2 これから(合意)

**選び方**

- 「入出力」タブのマイクの下に「文字起こし」の選択肢(ローカル(whisper) / ElevenLabs)を置く。
- マイクと同じく **[Start] の前に選ぶ**。耳が動いている間に変えるときは Stop → 選び直す → Start。選択は保存し、次回も復元する。

**Start を押すと**

- ヘッダはすぐ「Starting」になる(範囲 3)。
- ElevenLabs を選んでいれば whisper-server は起動せず、接続できればすぐ Listening になる。
- キーが無い・繋がらないときは、マイク行の下に理由が出る(例: ElevenLabs のキーが見つからない)。

**選べたと分かる手がかり**

- ヘッダのヘルス表示を `stt: ElevenLabs up` / `stt: whisper up` の形にする(今の `whisper: up` の置き換え)。
- 繋ぎ直している間は `stt: ElevenLabs reconnecting` と出す。
- ヘッダに今のマイク名も出す。

**文字起こしの表示**

- ElevenLabs のときは、**commit ごとに 1 行**。短い行も混じる。喋り終わりから ≈0.9 秒で出る。
- **partial(途中経過)は画面に出さない**。
- **行の横の遅延表示は出さない**。whisper のときも消す(今は `(1.5s)` が出ている)。調べたいときのためにログには残す。
- 喋っている間の「you ······(speaking)」の行は、手元 VAD で今のまま出る。

## 5. 補足(事実の確認)

- ユーザーは「フィードに出ている分が LLM に渡る」と理解している。これは概ね正しい: フィードの you の行は転写バッファ(LLM が読む正本)に積まれた行を表示している。partial を表示だけに使うことは技術的には可能だが、出さないことに決めた。
- 「耳の起動に合わせて色々起動する」のはユーザーの勘違いかもしれない、とのこと。実際には LLM と声のプレイヤーは最初の Fire のときに作られる(耳の Start では起動しない)。

## 6. 未決・注意

- 繋ぎっぱなしの間は無音も課金対象(リアルタイム $0.39/時)。ユーザーは「綺麗な回避方法もないので仕方ない」と了承。Free プランは月 ≈2.5 時間・商用不可。配信で使う前にサブスクへ加入する(ユーザー判断済み)。
- 1 接続の最長時間は公式に記載がない(`session_time_limit_exceeded` は存在する)。長時間配信で切れたときに自動再接続で吸収できるか。再接続直後は最初の約 2 秒のバッファが乗る。
- LLM と声のプレイヤーを耳の Start と一緒に起動するかどうか(今回の範囲外として扱うか、ユーザー確認)。

## 7. 既知の影響(範囲外として受け入れ済み)

- **ElevenLabs を選ぶと区切り応答がほぼ出なくなる**(context-check の棚卸しで判明、コードで確認)。区切り応答は「喋り終わり → 2 秒の無音で構え → 構えの間に届いた you の転写を合図に発火(構えて 5 秒で解除)」という作り([apps/soul/agent/src/mind/fire-scheduler.mjs](../../../../../apps/soul/agent/src/mind/fire-scheduler.mjs) の handleVadEvent / handleTranscript)。ElevenLabs の commit は喋り終わりから約 0.5 秒で届き、構えより先に着くため、黙っていると合図が来ない。whisper はたまたま構えの後に届いていた。
- 修正案(構えに入る時点で、喋り終わり以降に転写が届いていれば即発火)はあるが、話し始めの判定の全面改定と合わせて別途扱う(ユーザー判断 2026-10-16)。
- 呼びかけ(名前を呼ぶと即発火)は転写の部分一致で動く。keyterms を渡さないため、ElevenLabs が呼び名をどう書くか(例: 英字の「Cody」)次第で効かないことがある。これも同じ改定で扱う。

## 8. 実装の既定(ウンディーネ提案、ユーザー異議なし 2026-10-16)

- 耳の作り: 手元 VAD とマイク周り(ffmpeg → framer → VAD → segmenter)はそのまま。耳の中で文字起こしを whisper / ElevenLabs に分岐させる。既定は whisper のままにし、既存テストを壊さない。
- 転写 1 件の区間(startMs/endMs)は commit が届いた時点のストリーム時刻(start = end)。本番でこの値を読む処理はない(UI・LLM 注入・記憶・発火は appendedAtMs と text のみ使用)。
- ヘッダ: 既存の `whisper` ヘルスは残し、`stt`(engine と状態)を足す。「繋ぎ直し中」は黄色。マイク名は耳が動いている間だけ出す。
- キー: コード内で `apps/soul/agent/.env.elevenlabs.local` を直接読み、process.env には入れない(子プロセスに渡さない)。
- 遅延のログ: 操縦席の標準出力に 1 行(数字だけ、文字起こし本文は書かない)。物差しは「直前の commit 以降で最後の手元 speechEnd → commit 到着」。
- 繋ぎ直しの間のマイク音は捨てる。空の commit は既存と同じく discarded として数える。
- 取り込み 50ms は whisper のときにも効かせる。計測スクリプト(probe-elevenlabs-stt.mjs)の二重付与を直す。
- 進め方: サブエージェント(Gnome)1本で実装とテストまで行い、ウンディーネが合意と突き合わせて確認し、最後にユーザーが操縦席で触って確かめる(wave 計画は作らない。当初は別セッション案だったがユーザー提案でサブエージェントに変更 2026-10-16)。

## 9. 実装報告(Gnome、2026-10-16)

- 新規: `src/ears/elevenlabs-stt.mjs`(接続・commit 受け取り・指数バックオフの無限再接続 1s→最大15s・キー読み込み)、そのテスト、`src/test-support/fake-websocket.mjs`。変更: ffmpeg-capture(audioBufferMs 既定 50)、ear-pipeline(`stt` 分岐、既定 whisper)、cockpit-server(Starting の broadcast、Start の `sttEngine`、snapshot の `stt`)、settings-store(`sttEngine` の保存)、cockpit.mjs(遅延ログ)、UI(入出力タブの「文字起こし」、ヘッダの `stt:` と `mic:`、you 行の遅延表示の削除)、probe の二重付与の解消。
- 検証: `node --test` 1130/1130(新規 30 件、既存の書き換えなし)、check:soul-zone 通過(ウンディーネも再実行して確認)。fake の耳でブラウザ表示を確認。実 ElevenLabs には無音約 2 秒のみで接続確認(マイクは開いていない)。
- 正本からの逸脱・Gnome が決めた点:
  1. キーは Start のたびに読む(§3 の「起動時に読む」と違う)。キーを置き直しても操縦席の再起動が要らない。process.env には入れない。
  2. 文字起こし方式の保存は Start 時(マイクと同じ)。
  3. エラー欄は「文字起こし」行の下(マイク行の直下ではない)。select は動作中も操作でき、次の Start から効く。
  4. マイク名は Listening の間だけ出す。既定デバイスなら `mic: default`。
  5. 遅延表示を消したのは you 行だけ。soul 行の `(Ns · brain)` は残る。SSE の latencyMs も送り続ける。
  6. 遅延ログは `[cockpit] stt latency: engine=elevenlabs ms=512` の形で whisper のときも出す。起点は speechEnd 発火時刻(whisper の既存 latencyMs と同じ定義)なので、実験の「無音開始」起点より約 0.4 秒小さく出る。
  7. `stt:` の状態は unknown / connecting / up / reconnecting / down。接続後の切断は無限に再接続するので down にならない。
- 判明した事実: VAD 0.3 秒指定は実効 0.5 秒(§3 に反映)。
