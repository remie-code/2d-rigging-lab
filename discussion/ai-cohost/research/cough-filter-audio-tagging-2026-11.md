# 咳払いの「うん」を耳の出口で落とす — 音の種類の判定(audio tagging)の調査(2026-11-03)

> Sylph による調査。設計判断ではない。【公式】【リポジトリ事実】【実測】【推測】を区別。
> 動機(ユーザー 2026-11-03): 配信者の咳払いが、ほぼ毎回「うん」と書き起こされる。操縦席の会話の列に出て、判定も本物の発話として扱い、チャッピーが変な返事をする。両方を直したい。
> Undine の方向: 文字が短い区間(「うん」など)だけ音の種類の判定にかけ、「咳 / 咳払い」と強く出たときだけ転写の行にしない。迷ったら残す。
> 実測の材料: Wikimedia Commons のパブリックドメインの咳の録音 2 本(`Cough 1.ogg` `Cough 2.ogg`、作者 ezwa)から咳を 1 つずつ切り出した 9 個(0.3〜0.76 秒)と、Windows の音声合成(Haruka)で作った「うん」「うーん」「はい」「うんうん」。**配信者の声・本物の咳払い・本物の「うん」は使っていない。** モデルと音はリポジトリの外(スクラッチ)に置いた。

## 1. 結論

- **候補 1 は条件つきで使える。** 決め手は 2 つ。
  - sherpa-onnx-node 2.0.0 に `AudioTagging` があり、子プロセス(ローカルの文字起こし)でそのまま呼べる。
  - CED-Tiny は int8 で 6.1MB と小さい。1 回の判定は 5 秒にのばしても約 15ms で済む。
- **条件 1: 短い区間をそのまま渡すと結果が壊れる。** 1 秒未満のまま渡すと、咳も「うん」も「Music」「Synthesizer」になる。無音を足して 5 秒程度にのばすと、意味のある結果が出た。
- **条件 2: 「強く出たら」の値は低めに決める必要がある。** のばした咳では「Throat clearing」が 1 位になったが、確率は 0.14〜0.60 だった。0.8 のような高いしきい値にすると、ほぼ何も落とせない。
- 合成の「うん」では、咳・咳払いの確率が全件 0.00 だった。「Speech」は 0.36〜0.73。分かれ方は良いが、本物の「うん」と本物の咳払いで確かめる必要がある(§8)。
- **差し込む場所:** 子プロセス `local-stt-worker-core.mjs` の `transcribe` で判定する。音と文字が両方そろい、sherpa も読み込めるのはここだけ。落とすかどうかは、親の `ear-pipeline.mjs` の `transcribeAndAppend` で決める(`buffer.append` の前)。
- これで直るのはローカルの文字起こし(Zipformer / Parakeet)だけ。whisper と ElevenLabs の経路には効かない(§5)。

## 2. sherpa-onnx の audio tagging

- **Node の口【リポジトリ事実】**
  - 入っている版は `apps/soul/agent/node_modules/sherpa-onnx-node` の **2.0.0**。
  - `audio-tagg.js` に `AudioTagging` があり、`sherpa-onnx.js` から公開されている。
  - 使い方は `new AudioTagging({ model: { ced | zipformer: { model }, numThreads, provider, debug }, labels, topK })` → `createStream()` → `stream.acceptWaveform({ samples: Float32Array, sampleRate })` → `compute(stream, topK)`。
  - 戻り値は `[{ name, prob, index }]`。
  - **`compute` は同期で、非同期版はない。** 認識器の `decodeAsync` とは違う。
- **公式の例【公式】**
  - https://github.com/k2-fsa/sherpa-onnx/blob/master/nodejs-addon-examples/test_audio_tagging_ced.js
  - 同じ場所に `test_audio_tagging_zipformer.js` もある。
  - 文書: https://k2-fsa.github.io/sherpa/onnx/audio-tagging/index.html
- **学習済みモデル【公式】**
  - すべて AudioSet(527 種類)で学習されている。CPU でオフラインで動く。
  - 配布元は https://github.com/k2-fsa/sherpa-onnx/releases/tag/audio-tagging-models

| モデル | tar.bz2 | model.int8.onnx | パラメータ / AudioSet mAP | 備考 |
|---|---|---|---|---|
| **ced-tiny**(2024-04-19) | 28.5MB | **6.1MB**(fp32 22MB) | 5.5M / 48.1 | 今回実測した |
| ced-mini | 47.7MB | 10.5MB(fp32 39MB) | 9.6M / 49.0 | 今回実測した |
| ced-small | 101MB | 不明 | 22M / 49.6 | 未取得 |
| ced-base | 387MB | 不明 | 86M / 50.0 | 未取得 |
| zipformer-small(2024-04-15) | 111MB | 26MB(fp32 88MB) | 不明 | 公式値: 1 スレッドで RTF 0.027〜0.031(機材不明)。100MB を超えたので取得していない |
| zipformer(2024-04-09) | 301MB | 不明 | 不明 | 未取得 |

- CED のパラメータ数と mAP は https://github.com/RicherMans/CED に載っている【公式】。
- CED の onnx の入力は `feats [batch, 64, time]`(64 次元のメル特徴)、出力は `prob [batch, 527]` だった【実測】。特徴は sherpa の C++ 側で作られる。

## 3. ラベル

- `class_labels_indices.csv` の番号と表記は次のとおり【実測】。tiny と mini で同じファイルだった。
- 声: `0 "Speech"`、`1 "Male speech, man speaking"`、`2 "Female speech, woman speaking"`、`6 "Babbling"`、`7 "Speech synthesizer"`
- 声以外の口・喉の音: `37 "Humming"`、`38 "Groan"`、`39 "Grunt"`、`41 "Breathing"`、`44 "Gasp"`、`46 "Snort"`、**`47 "Cough"`**、**`48 "Throat clearing"`**、`49 "Sneeze"`、`50 "Sniff"`、`58 "Burping, eructation"`、`59 "Hiccup"`
- その他: `496 "Hum"`(機械音の方)、`137 "Music"`、`272 "Video game music"`、`267 "Background music"`

## 4. 速さ

- 実測の条件: Ryzen 7 5700X、ゲームなし、1 回の判定の中央値(30 回)。
- 実測した時間【実測】:

| 入力の長さ | tiny 1 スレッド | tiny 2 スレッド | mini 1 スレッド | mini 2 スレッド |
|---|---|---|---|---|
| 0.3 秒 | 1.0ms | 1.0ms | 1.2ms | 1.1ms |
| 1.0 秒 | 3.2ms | 2.8ms | 4.3ms | 3.3ms |
| 1.5 秒 | 4.6ms | 3.5ms | 6.3ms | 4.6ms |
| 2 秒 | 5.8ms | 5.1ms | 8.3ms | 7.2ms |
| **5 秒(短い区間をのばした長さ)** | **15ms** | 11ms | 23ms | 19ms |
| 10 秒 | 33ms | 23ms | 57ms | 39ms |

- 読み込みとメモリ【実測】:
  - 読み込みは 70〜105ms。
  - メモリは、sherpa を読み込んだだけの状態(約 37MB)から、tiny を 1 つ作ると約 +30MB 増えた。
- 見込み【推測】: 短い区間だけを判定するなら、1 発話あたり +15ms 前後(tiny・1 スレッド)。Zipformer の推論(中央値 0.12 秒)と比べて小さい。

## 5. 差し込む場所(リポジトリの事実)

- **音と文字が一緒にある場所は 2 か所。**
  - **親** `src/ears/ear-pipeline.mjs` の `transcribeAndAppend(job)`
    - `await transcribe(job.wav)` の直後で、`job.wav`(WAV のバイト列。前に 200ms の本物の音、前後に 300ms の作り物の無音を含む)と `text` がそろう。
    - そのあと `buffer.append` に進む。
    - **音はメモリの中だけにある。**
    - ただし親では sherpa-onnx-node を読み込めない。耳の Silero VAD(onnxruntime-node 1.27.0)と onnxruntime.dll の版がぶつかるため(`stt-candidates-2026-10.md` §6、`no-sherpa-in-parent.test.mjs`)。
  - **子** `src/ears/local-stt/local-stt-worker-core.mjs` の `transcribe(msg)`
    - `samples`(Float32Array)と、認識結果の `text` がそろう。
    - sherpa がすでに読み込まれている。**判定はここで回すのが自然。**
- **親の onnxruntime-node で CED を直接動かす案は難しい。** 入力がメル特徴なので、sherpa と同じ特徴の作り方を自前で書き直すことになる【推測】。
- **ブロックの扱い**
  - 子の推論は 1 発話ずつ直列(`chain`)。
  - `AudioTagging.compute` は同期なので、子のイベントループを tiny で約 15ms 塞ぐ。親は塞がない。
- **直す場所の候補【推測】**
  1. `local-stt-engines.mjs`: 判定モデルの置き場(`vendor/models/` 配下)、存在の確認、設定の正規化(有効にするか、「短い」の文字数、しきい値)。
  2. `local-stt-worker-core.mjs`: `init` で `AudioTagging` を作る。`transcribe` では、文字が短いときだけ無音を足して約 5 秒にし、`compute` で判定する。結果の `result` には必要な確率(Speech / Cough / Throat clearing)だけを載せる。
  3. `local-stt-client.mjs`: init で判定モデルのファイルを渡し、結果を親へ返す。
  4. `ear-pipeline.mjs` の `transcribeAndAppend`: 落とすと決めたら append せず、診断(例: `transcriptDropped`)と数を残す。本文と音は記録に残さない。
  5. `scripts/fetch-local-stt-models.mjs`: 判定モデルの取得。
  6. `cockpit-server.mjs`: 設定を渡し、モデルが無いときの扱いを決める。
  7. テスト: 偽物の sherpa に `AudioTagging` を足す。
- **Discord の経路【リポジトリ事実】**
  - 音の入口(`captureFactory`、`discord-audio.mjs`)が違うだけで、同じ `ear-pipeline` を通る。同じ場所に入れれば両方に効く。
  - 人ごとに耳があり、ローカルの文字起こしなら人ごとに子プロセスを fork する(`localSttFactory` は耳ごと)。判定モデルも人数分読み込まれる(tiny なら 1 人あたり +30MB 前後【推測】)。
  - Discord の耳は `minSpeechMs` を 400ms にしている(`discord-experience.mjs`)。
- **効かない経路【リポジトリ事実】**
  - whisper(親から whisper-server を呼ぶ。子プロセスがない)
  - ElevenLabs(音を流し続け、commit の文字だけが来る。区間の音と文字が対にならない)
- **声を保存しない約束**
  - 上の流れは、音を IPC のメモリで渡すだけで、ファイルを使わない。
  - 判定の結果として本文や音をログに出さないことは、作るときに確かめる必要がある。
- **残る問題【推測】**
  - 転写を落としても、VAD の speechStart / speechEnd は咳で出たままになる。
  - そのため、割り込み(`barge-in`)や区切り応答の待ち(`fire-scheduler`)には咳の影響が残る。今回の問題の外。

## 6. 候補 2(声の高さ)

- **リポジトリにある部品【リポジトリ事実】**
  - 声の高さを出す部品はない。`node_modules` に pitch / yin / meyda などは入っていない。
  - sherpa-onnx-node にも、声の高さを返す口はない。
- **自前の簡単な判定は書ける**(数十行。自己相関で 70〜400Hz に周期があるかを、32ms ごとに見る)。今回スクラッチで試した【実測】:
  - 合成の「うん」「うーん」「ん」「はい」「うんうん」: 有声の割合 0.93〜1.00(F0 約 176〜211Hz)
  - 咳の切り出し 20 個(0.16 秒以上のもの): 0.00〜0.44 が 17 個。**0.72〜0.89 が 3 個**(`Cough 2` の、声の混じる咳)
  - 咳に音楽を混ぜると、有声の割合が上がる(0.0 → 0.27〜0.40)
- **見立て【推測】**
  - 咳払い(「ん゛っ」)は、声帯が鳴る有声のものが多い。単独で落とす根拠には弱い。
  - 「有声の割合が非常に高ければ残す」という、**残す側の補助**としてなら使える。

## 7. リスク

- **本物の短い「うん」を咳と取り違えるか**
  - 合成の「うん」では、咳・咳払いは全件 0.00 だった【実測】。BGM を混ぜても同じ。
  - ただし、のばさずに渡すと「Music」「Synthesizer」になる。のばしても mini では「Speech」が 0.2〜0.5 まで下がることがある【実測】。「Humming」はほぼ 0 だった。
  - 本物の鼻にかかった「んー」や、相槌の「うん」がどう出るかは分からない【推測】。
  - 「Speech が低い」ことを落とす条件の主にすると危ない。「Cough + Throat clearing が一定以上、かつ Speech が低い」の両方を求める方が、迷ったら残す方針に合う【推測】。
- **短い区間ののばし方**
  - 今回は、作り物の無音(0)を足して 5 秒にした。2 秒だと tiny / mini とも揺れた【実測】。
  - 本物のマイクの床ノイズで足すと結果が変わるかは未確認。
- **BGM・ゲーム音**
  - 咳に音楽を混ぜると(区間の振幅に対して 0.05〜0.3 倍)、咳払いの確率は下がった(例: 0.52 → 0.24)。1 位が「Music」になったものもある【実測】。
  - **誤って落とす方ではなく、落とし損ねる方に倒れた。** 迷ったら残す方針とは食い違わない。
  - 配信のマイクにゲーム音がどれだけ入るかは不明(§8)。
- **しきい値**
  - のばした単独の咳でも、咳払いの確率は 0.14〜0.60 にとどまった【実測】。
  - 元の 11〜21 秒の録音を丸ごと渡すと、Cough が 0.76〜0.88 になった。確率は「区間の長さ」と「咳の数」で大きく変わる。
  - しきい値は、本物の配信の音で決める必要がある【推測】。
- **ライセンス**
  - CED のコードのリポジトリ(RicherMans/CED)は **GPL-3.0**。重みは Hugging Face の `mispeech/ced-tiny` / `ced-mini` / `ced-base` が **Apache-2.0** と表示している【公式】。
  - sherpa の変換版の README は「RicherMans/CED から変換」とだけ書いていて、ライセンスの記載はない。
  - Zipformer の audio tagging は icefall(Apache-2.0)で学習されている。モデル自体のライセンス表記は見つからなかった。
  - ラベルの表(AudioSet オントロジー)は Google の CC BY 4.0【公式・既知】。
  - リポジトリは公開なので、既存の `vendor/models/`(`.gitignore` 済み)と取得スクリプトの流儀で、**モデルはリポジトリに入れない方が安全**【推測】。
- **CPU**: 判定は短い区間だけ、+15ms 程度なので、負荷は無視できる見込み【推測】。

## 8. 分からないこと

1. 本物の配信者の咳払いと本物の「うん」で、確率がどう分かれるか。これが一番大事。区切られた区間を数十個ずつ、保存せずにメモリの中だけで回して確率だけを集める、などの手順が要る。
2. 「短い文字」を何文字以下とするか。咳払いが「うん」以外(「ん」「はい」など)になる例があるか。
3. 配信のマイクに、ゲーム音・BGM がどれだけ入るか。
4. zipformer-small(26MB)の方が、短い区間に強いか。今回は取得していない。
5. 判定モデルが無い・読み込めないとき、耳を止めるか、判定なしで続けるか。
6. whisper / ElevenLabs の経路でも直す必要があるか。今の本番は Zipformer(`stt-candidates-2026-10.md` §7)。
7. VAD が咳で出す speechStart(割り込み・区切り応答の待ち)も止めたいか。今回の範囲の外。
8. CED の重みのライセンス表記が、GPL-3.0(コード)と Apache-2.0(Hugging Face の重み)で食い違う点を、どう扱うか。
