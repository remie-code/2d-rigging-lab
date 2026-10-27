# 耳(STT)の候補の洗い出し — ローカル化を中心に(調査 2026-10-25)

> Sylph による調査。設計判断ではない。【公式】【第三者】【推測】を区別。
> 結果: Zipformer を採用し、実配信で合格(§7)。
> 動機(ユーザー 2026-10-25): ElevenLabs の STT に不満はない。ただし ElevenLabs の消費のほぼ全部が配信者の発話の文字起こしで、ここをローカルに落とせば ElevenLabs のクレジットは声(TTS)だけで済み、チャッピーを連れ回すハードルが下がる。最重要の物差しは「ローカル(Windows)で、ElevenLabs scribe_v2_realtime に近い確定の速さ(喋り終わり→確定 ≈0.9 秒)と日本語精度が出るか」。
> 精度の物差し(ユーザー 2026-10-25): 大きく外さなければよい。たとえば「アーツ異常」が ElevenLabs でも「八つ以上」になるが、前後のやり取り(「八つ以上になっちゃった」「チャッピー、アーツ」「あ、アーツは言えた」)があれば、頭(gpt-6.1-sol)は「アーツ異常」だと分かる。精度より速さとローカルで動くことを優先する。
> 今の耳: whisper.cpp + kotoba-whisper q5_0(CPU 版。同梱に CUDA の DLL が無い)+ Silero VAD で ≈1.5 秒。ElevenLabs scribe_v2_realtime で ≈0.9 秒([../elevenlabs/experiments/01-stt-behavior.md](../elevenlabs/experiments/01-stt-behavior.md))。
> ユーザーの PC: RTX 4070 SUPER(VRAM 12GB のはず)、Ryzen 7 5700X(8 コア 16 スレッド)。配信中は同じ PC でゲームと OBS が動く。CPU 版の whisper で重さを感じたことはない。

## 1. 「いろどり」

- STT ではなかった。Aratako 氏の日本語の**音声合成(TTS)**「Irodori-TTS」と見られる【公式】。ローカルで動き、重みは MIT。最新は v4.1-Small(0.8B、2026-08)と v4-Large(3B、2026-09 末)。https://huggingface.co/Aratako/Irodori-TTS-v4.1-Small 、https://github.com/Aratako/Irodori-TTS
- 耳の候補にはならないが、声(今は AivisSpeech / ElevenLabs)の候補にはなりうる。

## 2. ローカルの見立て

- ローカルの確定時間は「手元 VAD の無音しきい値 + 推論時間」。今の約 1.5 秒の大半は、CPU で kotoba-whisper を自己回帰でデコードする時間(約 1 秒)と見ている【推測】。
- 非自己回帰のモデル(Parakeet-ja、ReazonSpeech Zipformer)に替えれば、CPU だけで推論は 0.1〜0.3 秒の見込み。無音 0.4〜0.5 秒と合わせて **0.6〜0.8 秒**【推測。この PC では未計測】。

| 候補 | 動かし方(Windows / Node) | 速さ | 日本語の精度 | 語彙の追加 | ライセンス |
|---|---|---|---|---|---|
| **Parakeet TDT-CTC 0.6B ja**(NVIDIA) | sherpa-onnx の int8 CTC 版(655MB)を `sherpa-onnx-node`(win-x64 ネイティブ同梱)で直接呼べる | CPU: 同系 0.6B が 9800X3D で実時間の 36 倍【第三者】→ 5700X で数秒の発話が 0.1〜0.3 秒【推測】。GPU は 1 発話 0.04 秒【第三者】 | FLEURS CER 5.94%【第三者】、JSUT 6.4・CV8 7.1【公式】 | CTC 版は sherpa の hotwords 不可【公式】。後段の辞書補正頼み | CC-BY-4.0(商用可・表示義務) |
| **ReazonSpeech K2 v2**(Zipformer 159M) | sherpa-onnx(公式モデルあり)、Node から可 | CPU 1 スレッドで RTF 0.054【公式】 | FLEURS 9.40%【第三者】 | transducer なので hotwords が使える【公式】。日本語での効き方は未確認 | Apache-2.0 |
| kotoba-whisper v2.x(今) | whisper.cpp(CUDA 版にすると速い) | CPU で推論約 1 秒 | FLEURS 6.92%(v2.2) | プロンプト | Apache-2.0 |
| Whisper large-v3 / turbo | whisper.cpp CUDA、faster-whisper | GPU が要る | 4.49 / 4.81%(最良)【第三者】 | プロンプト | MIT |
| Qwen3-ASR 0.6B / 1.7B | ストリーミングは vLLM(Linux)限定 | 未確認 | 日本語の公式値なし | 未確認 | Apache-2.0 |
| Nemotron 3.5 ASR Streaming 0.6B | 真のストリーミングだが NeMo・Linux | 速い | CER 11.5〜13.9%(公式) | — | OpenMDW-1.1 |
| SenseVoice-Small | sherpa-onnx | 10 秒を 70ms【公式】 | 日本語の数値なし | — | 商用可否が曖昧 |

- 固有名詞の注意【第三者】: IT 用語の実音声の評価で、Parakeet / ReazonSpeech は固有名詞の F1 が 0.15〜0.25 と低い(Whisper・Qwen3 は約 0.6)。「チャッピー」の聞き取りを、今ある辞書補正の資産で吸収できるかが要点になる。
- CPU だけで足りる見込み。言い終わりのときだけ 0.1〜0.3 秒 CPU を使う程度で、今の CPU 版 whisper より負荷の時間は短い【推測】。GPU とゲームの同居の影響を実測した公開情報は見つからなかった。
- `vendor/whisper/parakeet.dll`: whisper.cpp 本家に 2026-06 に Parakeet 対応が入った成果物。ただし公式の変換済みモデルは欧州 25 言語版だけで、日本語版が変換できるかは未確認。サーバー機能はない。日本語なら sherpa-onnx 経路の方が確実【推測】。
- 主な出典: https://dev.classmethod.jp/articles/japanese-asr-l40s-fleurs-benchmark/ 、https://huggingface.co/nvidia/parakeet-tdt_ctc-0.6b-ja 、https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8 、https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html 、https://github.com/istupakov/onnx-asr 、https://research.reazon.jp/projects/ReazonSpeech/ 、https://scrapbox.io/tomiokario/ASR

## 3. クラウド候補(比較用)

| 候補 | 確定 | 料金/時 | 語彙 | 注意 |
|---|---|---|---|---|
| ElevenLabs scribe_v2_realtime(今) | ≈0.9 秒(実測) | $0.39 | — | TTS とクレジット共用 |
| Soniox stt-rt-v5 | 意味ベースの endpoint(500〜3000ms) | **$0.12** | context terms | — |
| Deepgram Flux Multilingual | EndOfTurn(500ms から) | $0.47 | keyterm +$0.08 | 新規の無料枠あり |
| AssemblyAI Universal-3.6 Pro RT | 無音 100〜1000ms で区切る | 約 $0.45 | 100 語 | — |
| Google gemini-3.5-transcribe-live | VAD 選択可 | 約 $0.54 | ~1000 語 | セッション最長 10 分、無料枠は学習に使われる |
| OpenAI gpt-live-transcribe | サーバー VAD なし | $1.02 | keywords | — |
| Azure MAI-Transcribe-2-Streaming | サーバー VAD なし | $0.54 | なし | プレビュー、日本リージョンなし |
| AmiVoice | 途中結果あり | 約 99 円〜 | 辞書 | 無音は課金されない |

## 4. 未確認

1. Parakeet-ja / Zipformer を、5700X の CPU で、ゲームを動かしながら使ったときの推論時間。
2. 実際の配信音声(雑談・相槌・「チャッピー」)での精度(FLEURS は読み上げ音声)。
3. sherpa-onnx の hotwords が日本語の Zipformer で効くか。
4. whisper.cpp の parakeet 変換が日本語版で通るか。
5. GPU で推論したときのゲームへの影響。

## 5. CPU 実測(2026-10-25、ゲームなし。Sylph)

- 材料: 共演配信の音声から、配信者の発話を 80 個切り出した(合計 324 秒、1〜10 秒)。参照は ElevenLabs の文字起こし。
- 1 発話の推論時間の中央値(2 スレッド): Zipformer 0.12 秒、Parakeet 0.36 秒。今の whisper.cpp(CPU、6 スレッド)は約 2 秒。
- 喋り終わり→確定の見込み(VAD の無音 0.4 秒 + 取り込み + 推論): Zipformer 約 0.6〜0.75 秒、Parakeet 約 0.9〜1.3 秒(4 スレッドなら 0.75〜1.0 秒)、whisper 約 2.4 秒。
- 精度の目安(ElevenLabs との CER の中央値。表記の揺れを含む): Parakeet 0.09、Zipformer 0.205(前後に無音を足すと 0.125)、whisper 0.24。
  - Zipformer は文頭の 1 語を落としやすい。
  - whisper は 20 発話中 3 件で同じ文を繰り返した。
  - 「チャッピー」は 2 件とも両モデルで書けた。
- メモリ: Parakeet 約 0.9GB、Zipformer 約 0.5GB。
- 使ったモデル:
  - Parakeet は `csukuangfj/sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8`(Hugging Face)。
  - Zipformer は sherpa-onnx の GitHub Releases にある `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01`(int8)。

## 6. 同じプロセスで動かせない問題と、VAD の統一の検討(2026-10-25)

- `sherpa-onnx-node` と、耳の Silero VAD を動かす `onnxruntime-node`(1.27.0)は、どちらも `onnxruntime.dll` を名前で読み込む。版が違う(sherpa 側は 1.27.20260615)ため、同じプロセスでは後から読み込んだ方が落ちる(実測)。worker_threads でも同じプロセスなので避けられない。
- **VAD も sherpa に統一できるか**を確かめた。
  - モデル: 今の `vendor/models/silero_vad.onnx` を sherpa がそのまま読めた。32ms ごとの判定は 99% 一致した。
  - ただし sherpa-onnx-node の Vad は、フレームごとの確率を返さない(返すのは on/off と切り出し済みの区間だけ)。そのため、今の自前のセグメンタ(しゃべり始め・終わり・割り込みの合図を作る部分)につなげない。
  - sherpa 自身の区切りに任せると、しゃべり始めの合図が中央値で約 0.29 秒(最大 1.2 秒)遅れた。区切り方も変わり、5 分の音声で大きくずれた区間が 2〜7 個出た。
- **判断(ユーザー 2026-10-25): (A) ローカルの文字起こしを子プロセスに分ける。** 耳の VAD とセグメンタは今のまま(間合いに触らない)。

## 7. 実配信の結果(ユーザー 2026-10-28、Zipformer で約 2 時間)

- 文字起こしの精度は ElevenLabs の方が圧倒的に高い。
- ただし頭(gpt-6.1-sol)の推論で差が埋まった。「2,3回」が「二十三回」と書き起こされても、チャッピーは文脈から誤りだと分かり、「2,3回」として会話した。§0 の「アーツ異常」の見立てどおり。
- 2 時間で ElevenLabs は月の枠の約 5%(声だけ)。**Zipformer を本番の耳にする。** ゲートの記録は [../implementation/waves/local-stt/human-gate.md](../implementation/waves/local-stt/human-gate.md)。
