# S2 planning gate 棚卸し(外部実態+実機環境)

> Status: 完了(2026-07-12)。Sylph 1体(Web一次情報+実機実測)の報告をUndineが統合。Verdict: needs_design → ユーザー裁定4件で解消(§5)。
> 対象: S2「耳が生える」([../s-series-decomposition.md](../s-series-decomposition.md))。

## 1. whisper.cpp(2026-07時点の事実)

- 最新 v1.9.1(2026-06-19)。**公式Windows zip配布**: whisper-bin-x64(8MB)/ whisper-blas-bin-x64(21MB、OpenBLAS)/ CUDA版(278〜678MB)。CIは全Windowsジョブ `WHISPER_SDL2=ON` → **whisper-cli / whisper-server / whisper-stream がSDL2.dll込み同梱**(マイク取り込みはSDL2担当、追加install不要)。
- VADは二系統: **cli/serverはSilero VAD統合済み**(`--vad -vm ggml-silero-v6.2.0.bin`、閾値・最小発話長等フルオプション)。**streamは簡易エネルギーVADのみ**(Silero未統合、stream.cpp読解で確認)。
- whisper-serverはHTTP `/inference` へ**発話単位WAVのmultipart POST**(ストリーミングWSなし)→「いつ区切るか」はクライアント側の仕事。
- 実運用の定石: 「外部VADで発話単位に切ってからWhisperへ渡す」(whisper.cpp issue #3744ほか)。

## 2. kotoba-whisper(同)

- 最新 v2.2(話者分離等はHF Pythonパイプライン専用。コアはv2.0)。**公式ggml変換あり**: `ggml-kotoba-whisper-v2.0.bin`(1519MB)/ **`-q5_0`(538MB)**。**Apache 2.0**。公式CTranslate2版もあり。
- 公式ベンチ: large-v3比6.3倍速・同等精度(distil構成)。whisper.cppで50分音声≈581秒(M2 Pro)≈実時間の約5倍速。Windows CPUの直接ベンチは未発見(不明)。

## 3. 対抗馬と周辺(要点)

- **sherpa-onnx-node**: npm プリビルド(2026-07更新、活発)、プロセス内でVAD+ASR完結、日本語はSenseVoice/zipformer-ja。最軽量級だが**日本語精度はkotoba比で未知**、マイク例のnode-cpalが若い。
- **Python faster-whisper / WhisperLive / speaches**: 実績厚いが常駐Python+サーバ層が増える。優位性なし。
- **Vosk**: ストリーミング最良だが精度でWhisper系に劣る扱い。
- **Node側VAD**: Silero VAD(MIT・ONNX)を `onnxruntime-node`(1.27.0、2026-06更新)経由で利用可(`@ricky0123/vad` 等の既製npmあり)。

## 4. 実機実測

- GPU: **RTX 4070 SUPER(VRAM 12GB)**——配信中は器の二体が使用するため**ASRはCPU路線が安全**。
- ffmpeg / sox / ffprobe / ffplay **全て未インストール**。Python 3.11.0+pipあり。マイクデバイス複数(PicoStreamingMicrophone等)全てOK状態。
- Windows共有モードでのOBSとのマイク同時キャプチャは可能見込み(推測。人間ゲートで実地確認)。

## 5. ユーザー裁定(2026-07-12)

1. **構成 = 本命形(b)**: `ffmpeg(マイク取り込み・16kHz mono PCM)→魂内Silero VAD(発話セグメンタ+VADイベント)→whisper-server(kotoba q5_0・CPU)→転写バッファ`。理由: S6(barge-in)とS9(相槌)が要求する**VADイベントを魂の手に入れる**——(a)最小案(whisper-stream)ではS6で載せ替え工事が確定するため、定石の直行を選ぶ。
2. **sherpa-onnx(プロセス内蔵案)は不採用**(精度未知+依存最小方針との不整合)。記録のみ。
3. **モデル実測比較ステップは設けない**: kotoba直行。精度・負荷の不満が出たら `experiments/` で再訪。
4. **診断表示はCLI**(器のUIには触れない)。

## 6. install品目(ユーザー作業。配置は wave 計画が規定)

- ffmpeg(winget)/ whisper.cpp 公式zip(BLAS x64)/ kotoba ggml q5_0(538MB)/ (wave中)npm install(onnxruntime-node系のVAD依存)。バイナリ・モデルは**リポジトリ非コミット**(gitignore)。
