# ローカルの文字起こし(Parakeet / Zipformer)wave 計画

> Status: ACTIVE(2026-10-25 ユーザー承認)。Domain L 起動。
> 根拠: [../../research/stt-candidates-2026-10.md](../../research/stt-candidates-2026-10.md)(候補・CPU 実測・同じプロセスで動かせない問題・VAD の統一の検討)。
> 動機: ElevenLabs の消費のほぼ全部が文字起こし(送った音声の長さで課金され、無音も送り続けるため配信の時間まるごと)。ローカルにすれば ElevenLabs は声だけになる。
> 規模: 1 wave・1 ドメイン(Gnome)。終わったら軽い突き合わせ(Sylph)を 1 回。

## 0. 合意(ユーザー 2026-10-25)

- 操縦席の文字起こしの選択肢(今は whisper / ElevenLabs)に、**Parakeet(日本語版)と Zipformer(ReazonSpeech K2)の 2 つを足す**。本命は Zipformer(速さ)。
- 精度は大きく外さなければよい(頭が前後の文脈で補える)。
- **(A) ローカルの文字起こしは子プロセスで動かす。** 耳の VAD(onnxruntime-node)と自前のセグメンタは今のまま。
- 依存: `sherpa-onnx-node` を魂の依存に追加済み(Undine、`^2.0.0`)。
- モデル: `apps/soul/agent/vendor/models/`(git 外)に配置済み(Undine)。
  - `parakeet-tdt_ctc-0.6b-ja-int8/`(model.int8.onnx・tokens.txt)
  - `zipformer-ja-reazonspeech-2024-08-01-int8/`(encoder・decoder・joiner の int8 と tokens.txt)
  - 作り直し用に、取得のコマンドを用意する。初回の Start で勝手に落とす作りにはしない。
- スレッド数の既定は 2。設定ファイルで変えられる。
- 発話の余白(ローカルの文字起こしに渡す音だけに効かせる。割り込みや区切りの合図のタイミングは今のまま):
  - (a) 本物の音を前に 0.2 秒含める
  - (b) 作り物の無音を前後に 0.3 秒足す
  - どちらも設定ファイルで変えられる。画面には出さない。
- 名前: Zipformer の hotwords に「チャッピー」「コーディ」を既定で登録する(日本語での効きは実物で確かめる)。Parakeet には無い(CTC のため)。
- モデルが無いときは、理由を付けて Start を失敗にする(ElevenLabs のキーが無いときと同じ)。
- ゲーム中の速さは、組み込み後に操縦席の遅延バーで確かめる。

## 1. Domain L — ローカルの文字起こし(apps/soul/agent)

1. **子プロセス**(新モジュール、例 `src/ears/local-stt/`):
   - Node の子プロセス(fork)で sherpa-onnx-node を読み込む。エンジン(parakeet / zipformer)・モデルのパス・スレッド数・hotwords を受けて OfflineRecognizer を作る。
   - 準備ができたら「ready(読み込み時間)」を返す。
   - 要求 `{id, PCM(16kHz mono)}` → 応答 `{id, text, ms}`。`decodeAsync` が使えれば使う。
   - 親は子の異常終了を検知して、警告と転写の失敗に変える。Stop / dispose で子を畳む。
   - **親(魂の本体)では sherpa-onnx-node を import しない**(onnxruntime.dll がぶつかるため)。テストで固定する。
2. **継ぎ目**: 耳の whisper と同じ「切り出した音 → 転写する関数」(`transcribe(wavBytes, {audioCtx}) → {text, rawText}`、ear-pipeline.mjs:192・:323)に、ローカルの転写関数を差し込む。ASR キュー・転写バッファ・遅延の計測(transcribeMs)は whisper の経路のまま使う。
3. **余白**:
   - (a) は、切り出しの開始を前に広げる(ear-pipeline の ring.slice の startMs)。セグメンタの `speechPadMs` は変えない。
   - (b) は、encode の前に作り物の無音を前後に足す。
   - どちらもローカルのエンジンのときだけ効かせる(whisper は今のまま)。
4. **切り替え**:
   - `STT_ENGINES` に `parakeet` と `zipformer` を足す。直す箇所は、Start の分岐(cockpit-server)、検証(cockpit-server・scripts/cockpit.mjs の値の検証)、設定の保存、UI の選択肢と表示名(view-logic/settings.mjs・health.mjs)。
   - 表示名は、例「Parakeet(ローカル)」「Zipformer(ローカル)」。
5. **設定ファイルのキー**(画面なし): スレッド数(既定 2)、前の余白(既定 200ms)、作り物の無音(既定 300ms)、hotwords(既定 ["チャッピー", "コーディ"])。範囲外は既定に戻す。
6. **警告**: ローカルの子プロセスが落ちたときの警告(alert。whisper の whisperDown と同格)。上の帯の文字起こしの死活表示とラベルも足す。モデルが無いときは、Start を失敗にして理由を出す。
7. **取得のコマンド**: `scripts/` に、公式の配布元から 2 つのモデルを取得して `vendor/models/` に置くコマンドを足す。README の該当箇所に手順を書く。
8. **テスト**: 偽物の子プロセスで、IPC のやり取り・ready・異常終了・dispose・余白(本物の前 0.2 秒と作り物の無音)・切り替え・モデルが無いときの失敗・親で sherpa を import しないこと、を固定する。本物のモデルを使う確認は、短い実機の 1 回で行う(Domain の最後に、子プロセスで Zipformer を 1 発話)。

## 2. 人間ゲート(ユーザーの実機確認)

1. 文字起こしを Zipformer にして Start → しゃべると転写が出る。遅延バーの「文字起こし」の区間が、ElevenLabs と同じかそれより短い。
2. ゲームと OBS を動かしながらでも、遅れや重さが気にならない。
3. 文の頭が欠けていないか(「よし、」など)。欠けるなら余白を詰める。
4. 「チャッピー」で呼んだときに反応する(hotwords の効き)。
5. Parakeet に切り替えても動く(本命ではないが比較)。
6. 配信のあと、ElevenLabs の残量が文字起こしの分だけ減っていない。
