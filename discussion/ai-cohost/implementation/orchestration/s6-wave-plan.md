# S6 wave計画: 会話が続く(barge-in+自発発火)

> Status: **計画確定(2026-07-13)・発進待ち**。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S6 / [s6-planning-inventory.md](s6-planning-inventory.md)(棚卸し+裁定11件)。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→C→Dを順次実行。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来。

## 1. ゴールとゲート

- **人間ゲート**: ①こーでぃーが喋っとる最中に君が話し始める→**声が止まり、器の口が閉じる**。次の発火で遮られた事実を踏まえた会話が続く。②「こーでぃー」と呼ぶ→返事が返る。③実況の区切りでたまに拾ってくる(全部には返さない)。④しばらく無言でいる→そのうち画面を見て一言(頻度がうるさくない)。⑤自発OFFトグルで②〜④が黙る(手動Fireは生きる)。⑥魂の声が指定デバイス(マイクが拾わん先)から出る。
- **機械ゲート**: 全テスト無退行+新規全緑・3チェック無退行・lockfile不変・新規依存ゼロ・**器コード完全不変**(口停止は契約内の既存意味論のみ)・実マイク不使用・SDK実消費は上限5 ask。

## 2. 設計の枠(裁定済み・詳細はinventory)

- **原則**: 「いつ喋るか」は機械信号のみ。LLMは「何を言うか」だけ。判断のためのaskは打たない。
- **barge-in**: `speechStart`(VAD即時)を起点に、最小持続時間の機械弁(`speechCancel` が来ずにNms持続)で確定→①プレイヤー停止 ②器へ mouth-open `intent.set`(value=0・短TTL)=speechタイムライン強制release(400ms・契約内) ③切断点記録。誤爆は起きてよい失敗(免罪符)。
- **切断点の正直記録**: モーラタイムライン×再生経過時間で「実際に声に出た文字まで」を算出。転写バッファは**append-only維持**——soul行の追記を「発話完了時(全文)または中断時(声に出た接頭辞+中断注記)」に行う形へ変更(S3の追記タイミング変更=裁定済みの意図変更としてテストで固定)。
- **発火語彙4種**(手動/呼びかけ/区切り応答/沈黙)。自発3種は**発火スケジューラ**(新モジュール・純ロジック)が機械信号だけで判定: 呼びかけ=転写照合(確実)・区切り=speechEnd後の無音X秒+不応期+確率・沈黙=Y秒+ジッター+長不応期+予算(中身はS5視覚発火)。数値は全部コード内定数(fake clock+注入RNGで決定論テスト)。
- **照合集合v0**: `コーディ(ー)/コーティ(ー)` 軸の正規化照合・データ定数(揺れ7種の実測はinventory §4-2。コーピーは誤爆リスクで見送り)。
- **プレイヤー刷新**: 常駐PowerShellを SoundPlayer(PlaySync) → **WinRT MediaPlayer**(非同期+`AudioDevice`指定+PlaybackStateポーリング)へ。停止命令とデバイス指定と再生実区間の追跡(「本当に喋っとる区間」)が一挙に手に入る(実機実証済み・依存ゼロ)。
- **自発OFFトグル**: 操縦席のモードスイッチ+永続化。手動Fireは対象外。
- **長回し(セッション使い捨て)はスコープ外**(方向性のみ台帳へ・実配信の問題駆動)。

## 3. ドメイン分割

### Domain A: 声の器官刷新(voice)

- audio-player常駐スクリプトをMediaPlayer化: `play(wavPath)` / `stop()` / 再生状態(`isPlaying()`または再生開始・終了通知)/ 出力デバイス指定(名前指定・env経由受け渡し)/ デバイス列挙 `listAudioDevices()`。プロトコルは行コマンド2種(PLAY/STOP)+状態応答。
- speak経路: wavDurationSec・再生開始時刻を捨てずに返す(切断点算出の材料)。
- テスト: fake exec/子プロセスで純部品テスト(コマンド往復・停止・状態)。実機は `scripts/preflight-voice.mjs` 拡張or新設(短いWAVで停止とデバイス列挙を検証・音は短く)。S1挙動(既定デバイス再生)の無退行。

### Domain B: barge-in(mind+channel)

- fire-orchestrator: 再生実区間の追跡(speakの戻り値活用)+**中断の公開口**(interrupt)。中断時: プレイヤーstop→channelへmouth-open set(value=0・短TTL)→切断点算出(モーラタイムライン×経過時間)→soul行追記(声に出た接頭辞+中断注記)→診断(barge-in発生)。自然完了時: 全文追記(追記タイミング変更をテストで固定)。
- 機械弁: speechStart受信→Nms内にspeechCancelが来なければ確定(定数)。
- 結線: onVadEventの消費を(SSEと並んで)barge-in判定へ。
- テスト: 全fake(player/channel/segmenterイベント)で縦検証(中断・スパイク取り消し・自然完了・busy整合・S3/S5無退行)。

### Domain C: 発火スケジューラ(mind・純ロジック)

- 新モジュール: 入力=VADイベント・転写onAppend(soul除外)・時刻(注入clock)・自発enable状態。出力=発火要求(kind: call/turn-end/silence)。
- 呼びかけ照合(正規化+揺れ集合データ定数)・区切り応答(speechEnd後X秒無音+不応期+確率[注入RNG])・沈黙(Y秒+ジッター+長不応期+予算カウンタ)。busy中・自発OFF中は発火要求を出さない。
- orchestrator結線: kind付き発火(callとturn-endは通常Fire相当・silenceは視覚発火相当)。発火要求の衝突・busy無視は既存状態機械に従う。
- テスト: fake clock+注入RNGで全分岐決定論(不応期・確率・ジッター・予算・OFFトグル)。

### Domain D: 操縦席+実SDK確認+計測+docs

- 操縦席: 自発ON/OFFトグル(モードスイッチ・永続化)・出力デバイス選択UI(列挙→select→永続化=vision-targetの写経)・タイムライン行(barge-in中断マーカー・自発発火マーカーのkind表示・スケジューラ診断のゴースト行)。
- 実SDK確認(上限5 ask): 自発発火(区切り/沈黙)の実射+barge-in後の「遮られた事実を踏まえた」返事の実観測→ `experiments/s6-conversation.md`(barge-in停止レイテンシ・自発発火の頻度観測・usage推移)。
- docs+followup: README・人間ゲート手順書(音響環境の設営=デバイス指定込み)・s6-followup台帳(セッション使い捨ての方向性・定数の体感調整・照合集合の実人声拡張・実況長回しの計測)。

## 4. blockingレビュー基準

1. **器コード・契約JSON・lockfile完全不変。新規依存ゼロ**(WinRT/PowerShell内蔵のみ)。手動Fire・視覚発火・S1〜S5既存挙動不変(soul行追記タイミング変更のみ裁定済み意図変更としてテスト固定)。
2. 3チェック無退行。実マイク・録音物非使用(検証音は合成のみ・scratchpad限定・残さない)。
3. スケジューラは純ロジック+fake clock/注入RNGで**全分岐決定論テスト必須**。「いつ喋るか」判断にLLM askを使うコード経路が存在しないこと。
4. barge-in経路は全fake縦検証+切断点記録の正直性(声に出とらん文字を出たことにしない)をテストで固定。転写バッファのappend-only維持。
5. SDK実消費は上限5 ask。環境変数ガード遵守。
6. 終了処理・タイムアウト(従来どおり)。

## 5. choke point(ユーザーの作業)

人間ゲートのみ(§1の①〜⑥)。音響設営: 操縦席で魂の声の出力先を「ヘッドホン(2- Shure MV7+)」等マイクが拾わんデバイスに指定する手順は手順書に含める。

## 6. Status

計画確定・発進待ち。
