# S2 人間ゲート手順書 — 「喋ると転写が積もる」

> Status: 手順確定（2026-07-12, Gnome / S2 Domain C）。**実行はユーザー**（実マイク取り込みを
> 伴うため Gnome / エージェントは実行しない＝規律）。
> ゴール: [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §1 の人間ゲート
> ——「普通に喋ると転写が積もっていくのが見える（数秒以内の追従）」を一目で確認する。
> 前提: `apps/soul/agent` install 済み・`vendor/` に whisper 一式 + kotoba + silero_vad.onnx 配置済み・
> ffmpeg が PATH（または env `FFMPEG_PATH`）にある。

## なぜ人間がやるのか（配線の存在 ≠ 疎通）

機械テスト（195+ 緑）と preflight 3 種は「合成音声までの疎通」を証明済み:

- `preflight-vad.mjs`: 実 Silero ONNX が TTS 音声に確率 ≈1.0 で反応する。
- `preflight-asr.mjs`: 実 whisper-server が TTS 音声を正しく転写する。
- `preflight-ears.mjs`: **パイプライン全体**（VAD→セグメンタ→切り出し→ASR→バッファ）が
  TTS 音声で縦に貫通し、発話終了→転写 ≈1.5s。

残る未検証は「**実マイク**」だけ: dshow デバイスの取り込み・部屋の残響/環境雑音での VAD 閾値の
実効性・肉声に対する kotoba の転写品質。ここは人間の耳と口でしか確定しない。

## 1. 事前疎通（任意・おすすめ・マイク不要）

```
node apps/soul/agent/scripts/preflight-vad.mjs     # VAD 実機（要 AivisSpeech。--synthetic で無しでも可）
node apps/soul/agent/scripts/preflight-ears.mjs    # 耳の縦貫通（要 AivisSpeech）
```
どちらも `RESULT: PASS` なら、マイク以外の全部品は生きている。

## 2. マイクデバイス名を調べる

```
node apps/soul/agent/src/ears-cli.mjs --list-devices
```
ffmpeg のデバイス一覧（dshow）が出る。音声デバイスの名前（例 `マイク (USB Audio Device)`）を控える。

## 3. 耳 CLI 起動 → 喋る

```
node apps/soul/agent/src/ears-cli.mjs --device "マイク (USB Audio Device)"
```
（`audio=` 前置は CLI が補う。環境変数 `EARS_DEVICE` でも指定可。）

- 起動で whisper-server（モデルロード ≈0.5s）と VAD が立ち上がり、
  `[ears] 耳が開きました。` が出る。
- **普通に喋る** → 喋り出しで `[vad] … speechStart`、言い終わって ≈0.4s で
  `[vad] … speechEnd`、その ≈1.5〜2s 後に `[text] …「喋った内容」(+latency)` が積もる。
- stderr には 1 行 JSON の計測（`{"event":"transcript","latency_ms":…,"audio_ctx":…}`）が出る
  （実マイク実測として experiments/s2-ears.md へ追記する材料）。
- **Ctrl+C** または **EOF（Ctrl+Z→Enter）**で全 dispose して終了。

## 4. 合格判定

**「喋ると転写が積もる」** — マイクに向かって数文を普通の速さで話して、

- 発話のたびに `[text]` 行が増えていき、
- 内容がおおむね正しく、
- 言い終わりから**数秒以内**（目安 2〜3s）に現れる。

これが一目で成り立てば **S2 人間ゲート合格**。あわせて **OBS 同時起動での共有キャプチャ確認**
（配信を模した負荷で器の二体 + 耳が並走しても追従が保たれるか）も一度見る（wave 計画 §5-2）。

## 5. チューニングの追撃（ズレたとき）

| 症状 | 調整 |
|------|------|
| 静かに話すと拾わない / 雑音を拾う | `--threshold 0.4`（下げる=敏感）/ `0.6`（上げる=鈍感）。診断の `speechCancel` 頻発は閾値が低すぎるサイン |
| 文の途中で切れる | `--min-silence-ms 600`（間を長く待つ。既定 400） |
| 転写が遅く感じる | `--threads 8`（8T で ≈10% 速い・器の二体との取り合いに注意） |
| 転写が化ける・繰り返す | `--no-dynamic-audio-ctx` で全窓に固定して切り分け（遅くなるが品質基準）。全窓でも化けるならモデル起因 |

## 6. うまくいかないときの切り分け

| 症状 | 見るところ |
|------|-----------|
| 起動即 `failed to bring up ears` | whisper-server の起動失敗（ready の reject）。`--port` 衝突・vendor のモデル/exe 配置・`WHISPER_SERVER_PATH`/`WHISPER_MODEL_PATH` を確認 |
| `[diag] ffmpegExit` が繰り返し出る | デバイス名の誤り（`--list-devices` で正確な名前を再確認）。ffmpeg は 500ms 間隔で 5 回まで自動再起動し、それでも死ぬと止まる |
| `[diag] whisperDown` が出た | whisper-server が落ちた。**ASR は停止・VAD は続く**設計（自動再起動しない）。CLI を再起動する。直前の stderr JSON に exit code が残る |
| speechStart は出るのに `[text]` が来ない | `[diag] asrFailure`/`asrSkipped` を確認。whisper-server のポートに別プロセスがいると HTTP エラーになる |
| 無音なのに転写が湧く | kotoba の無音幻聴。空転写はバッファ前に破棄されるが、非空の幻聴は `--threshold` を上げて VAD で絞る |
