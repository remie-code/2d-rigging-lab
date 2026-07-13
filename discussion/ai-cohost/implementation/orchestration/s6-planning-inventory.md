# S6 planning inventory: 会話が続く(barge-in+自発発火)

> Status: 完了(2026-07-13)。議論裁定11件で設計は確定済み・棚卸しは全て事実確認(追加裁定なし)。wave計画は [s6-wave-plan.md](s6-wave-plan.md)。
> 実施: Sylph A(コード読み取り: 停止契約・配線点)・Sylph B(実機: 出力デバイス指定・名前転写揺れ)。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S6。

## 1. 議論で確定した裁定(2026-07-13)

1. **原則**: 「いつ喋るか」は機械信号のみ(VAD時間・タイマー・文字列照合)。LLMは「何を言うか」だけ。判断のためのaskは打たない。
2. **barge-in=免罪符**: 誤爆(考え中の間での発火等)は「起きてよい失敗」に格下げされる。これが粗いヒューリスティクスを許す構造的理由。
3. **barge-in機構**: ユーザー発話検出→魂の再生と器の口を停止。モーラタイムラインで「どこまで実際に声に出たか」を切断点として正直記録(遮られた事実を会話の記憶に残す)。最小持続時間の機械弁(瞬間スパイクでは譲らない)。
4. **発火語彙4種**: ①手動(最優先・従来) ②呼びかけ=名前の文字列照合(確実に返す) ③区切り応答=発話終了後のVAD無音+**不応期+確率** ④沈黙=長閾値+**ジッター**+長不応期+予算(中身はS5視覚発火=画面を見て一言)。
5. **名前=「こーでぃー」**(Claude Code→Cody)。照合は転写揺れ集合に対して(§4)。
6. **自発OFFトグル**: 操縦席のモードスイッチ(手動発火は影響を受けない)。
7. **出力デバイス指定(最小形)をS6前倒し**: アームマイクが魂の声を拾う自己割り込みの物理対策。魂の声の出力先指定のみ・ルーティングGUIはS8のまま。
8. **数値は全部v0コード内定数**(不応期・確率・ジッター・閾値・予算)。ツマミは作らない(ゲインの教訓)。人間ゲートの体感で定数を直す。
9. **受容事項**: 独り言への誤応答は味(不応期+確率で希釈)・転写ゴミへの応答は仕方ない・考え中の間の誤爆は起きてよい失敗。
10. **長回し(セッション使い捨て)**: 方向性のみ合意(会話の正本は転写バッファ側にある=セッション差し替えは構造的に安い・裏で温めて差し替え・閾値は計器基準)。**細部は実配信の問題駆動=S6 waveスコープ外**(followup台帳へ)。
11. ユーザー音響環境の事実: アームマイク(Shure MV7+)が魂の声をたまに拾う。ゲーム音声とLLM音声のデバイス分離は元々の願望でもある。

## 2. 器の口を止める手段(Sylph A・器コード不変で可)

- **契約に停止/キャンセル専用kindは無い**(supportedKinds=set/envelope/speechの3つ、channel-protocol-contract.ts:33-37)。
- **使える既存意味論**: 口グループスロット(mouth-open等)への `intent.set`/`intent.envelope` 着弾で、**speechタイムライン全体が現在値からreleaseMs(既定400ms)かけて基底(閉口)へ強制release**(control-channel-overlay-store.ts:130-131,159,328-359。C6設計の既存意味論)。例: mouth-openへ set value=0・短TTL。**器の契約拡張は不要**。
- 補助事実: intent.speech再送は後着置換(store:189-201)・空タイムラインはinvalidPayload拒否(validation:406-413)・切断はreleaseAll(barge-inには粗い)。
- 1モーラ・s=0送信は事実上の即時閉口として機能しうるが**契約上のstop定義ではない**(用途外流用・実機未検証)——採らない場合の比較材料として記録。

## 3. 魂の再生停止と出力デバイス指定(Sylph A+B)

### 3-1. 現行プレイヤーは途中停止が構造的に不可能

常駐PowerShellは「stdin 1行=WAVパス→`PlaySync()`(ブロッキング)」ループ(audio-player.mjs:31-40)。PlaySync中はReadLineに戻らないため停止コマンドが届かない。SoundPlayerはデバイス指定も不可(実機確認・公開メンバにAPI無し)。

### 3-2. WinRT MediaPlayerが一石二鳥(実機実証・依存ゼロ)

`Windows.Media.Playback.MediaPlayer`(PowerShell 5.1から `Add-Type -AssemblyName System.Runtime.WindowsRuntime` のみで使用可):
- **`AudioDevice` プロパティで出力デバイス指定**——「ヘッドホン (2- Shure MV7+)」(日本語名)への実再生をCore Audioセッション列挙で客観確認済み。
- **非同期再生**なのでstdinループが生きたまま=**Stop命令が届く**(途中停止問題も同時解決)。完了検出は `PlaybackSession.PlaybackState` の50msポーリング(実測: 800ms WAV→904/919msで検出。WinRTイベント購読はPS5.1不可を実測)。
- 同一playerのSource差し替えで連続再生OK=常駐1プロセスの現行プロトコル維持。列挙+選択セットアップ42〜47ms。Node→PowerShellへの日本語デバイス名受け渡し(env経由)無劣化を実測。
- デバイス列挙: WinRT `DeviceInformation.FindAllAsync(GetAudioRenderSelector())` でアクティブ5件(実機: BenQ既定/Pico/TOSHIBA-TV/Realtek/**ヘッドホン(2- Shure MV7+)**)。
- 代替の不採用材料: ffplay+`SDL_AUDIO_DEVICE_NAME` は動くが**日本語デバイス名で失敗**(実測・本機の現実的対象がヘッドホン=日本語名)・OSアプリ別割り当てはexeパス単位(全powershell.exe共通)+GUI操作依存。

### 3-3. 「本当に喋っている区間」の追跡が必要(重要事実)

fire-orchestratorの `speaking` 状態は「envelope送出〜speak() resolve」で終わり、**実際の音声再生中はすでにidle**(fire-orchestrator.mjs:263,273,409)。speak()は `wavDurationSec` を返すが呼び出し元は捨てている(speak.mjs:108)。barge-inの「魂発話中」判定には再生実区間の追跡(MediaPlayer化でプレイヤー自身が再生状態を持てる)が要る。

## 4. VADイベントと呼びかけ照合(Sylph A+B)

### 4-1. 耳はS6を先読み済み

セグメンタのイベント3種(speech-segmenter.mjs:92-95): **`speechStart`**(閾値跨ぎ即発火・「S6 barge-inが最短で知るための信号」とヘッダ明記)・**`speechEnd`**(minSilence=常駐既定400msの無音確定・reason付き)・**`speechCancel`**(スパイク棄却のretraction・「S6のduck取り消し用」と明記)。最小持続時間の機械弁は speechStart+speechCancel の組で自然に組める。
- 無音の明示イベントは無い(イベント不在が無音)。時刻はストリームms(壁時計でない・`pipeline.streamMs()` 公開あり)。区切り/沈黙タイマーは消費側実装。
- 配線点: `createEarPipeline({onVadEvent})`(現消費者はcockpit-serverのSSEのみ)。orchestrator結線はhooks注入の既存2段構造(cockpit-server:797-813・cockpit.mjs:327-343)。
- 呼びかけ照合の挿入点: `transcriptBuffer.onAppend(listener)`(「S3の発火判定はこれを入口にできる」とコメント明記・transcript-buffer.mjs:26,212)。注意: 話者無差別なので `speaker:"soul"` 除外必須(前例cockpit-server:503)・listenerはthrow禁止契約。

### 4-2. 「こーでぃー」のkotoba転写揺れ(実機採取・AivisSpeech合成音×話速/ピッチ/抑揚振り)

- **同一WAVへの転写は決定論的**(3回完全一致)。揺れは音声側由来。
- **観測7種**: `コーディ` / `コーディー` / `コーティー` / `コーキー` / `コーピー` / `こうて` / `こうで`。
- 揺れの軸: 末尾長音の有無・ディ/ティの清濁・まれな子音誤認(キ/ピ)・**名前単独発話は崩壊気味**(こうて/こうで)・呼びかけ直後の読点は消えて本文と連結(「コーディこれどう思う?」)。
- 照合集合v0の材料: `コーディ(ー)/コーティ(ー)` を軸に正規化照合。`コーピー` は「コピー」との誤爆リスクがあるため採用は慎重に。実人声・マイク経由の揺れは未採取(実マイク規律)→人間ゲートで補完・照合集合はデータ定数で拡張可能に。

## 5. その他の受け皿(Sylph A)

- **busy状態機械**: idle/thinking/speaking。「重ね発火・割り込みはS6の領分」とコメント明記(fire-orchestrator.mjs:29-32)。stateはクロージャ内・外部から遷移させる口は無い→中断用の公開口を足す形。finallyの冪等idle復帰(:167-172,407-410)。
- **トグル写経元**: cockpit.htmlに既存checkboxは無し。最も近いのはvision-target設定一式(UI→POST→hooks→settings永続化)。永続化は cockpit-settings-store の writeMerged 追記式(新キー1個の型)。
- **v0定数の流儀**: `FIRE_WINDOW_MS`/`FIRE_MAX_CHARS` 型(export定数)・`EAR_DEFAULTS` 型(Object.freeze束)。不応期/確率/ジッター/閾値/予算はこの型で。
- 転写バッファは**append-only**(正本の流儀)——切断記録は「上書き」でなく追記で表現する制約。

## 6. waveへ持ち込む検証・計測項目

1. barge-in体感レイテンシ(ユーザー発話開始→魂の声が止まるまで)実測。
2. 口閉じ(mouth-open set→forced release 400ms)の実機の見え方。
3. 照合集合の実人声での命中/漏れ(人間ゲート)。
4. 自発発火の頻度体感(不応期・確率・ジッター定数の調整材料)+沈黙発火のトークン予算実測(S5 usage計器)。
5. MediaPlayer化での再生品質・レイテンシ無退行(S1比)。
