# S2 wave計画: 耳が生える(ローカルASR常時+転写バッファ)

> Status: 計画確定(2026-07-12)。発進待ち(ユーザーのバイナリ/モデル配置後)。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S2 / [s2-planning-inventory.md](s2-planning-inventory.md)(棚卸し+ユーザー裁定4件) / [../../architecture/conversation-pipeline-direction.md](../../architecture/conversation-pipeline-direction.md) §1・§2.7。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→Cを順次実行。各ドメインはGnome実装+Review-Sylph 3レーン。S1と同一の鉄の規律(裏取り・生数字・外部公開禁止・install禁止・commit禁止・lockfile/器コード/契約fixture不変)。

## 1. ゴールとゲート

マイク→常時ASR→**魂の転写バッファ(正本)に発話が積もり、CLIで見える**。

- **人間ゲート(一目)**: 普通に喋ると転写が積もっていくのが見える(数秒以内の追従)。
- **機械ゲート**: 純関数(PCM処理・セグメンタ・バッファ)のfixtureテスト全緑+S1テスト無退行+モノレポ既存チェック無退行+lockfile不変。

## 2. 構成(裁定済み)

```
ffmpeg(子プロセス、マイク→16kHz mono s16le PCM stdout)
  → 魂: Silero VAD(onnxruntime-node)→ 発話セグメンタ(VADイベント: speechStart/speechEnd)
  → 発話単位WAV → whisper-server(子プロセス、kotoba q5_0、CPU、localhost HTTP)
  → 転写バッファ(正本: {startMs, endMs, text} 列)→ CLI診断表示
```

- **VADイベントは魂の一級市民**(S6 barge-in / S9 相槌の土台)。転写バッファはS3(発火判定)が消費する継ぎ目。
- ASRは**CPU**(BLAS zip)。GPUは器の二体に譲る。
- バイナリ/モデルの配置(ユーザー作業、**非コミット**): `apps/soul/agent/vendor/whisper/`(zip展開一式)、`apps/soul/agent/vendor/models/ggml-kotoba-whisper-v2.0-q5_0.bin`。vendor/ はwaveで .gitignore 追加。パスは設定で上書き可能に。

## 3. ドメイン分割

### Domain A: 取り込み+VAD+発話セグメンタ

- ffmpeg子プロセス管理(dshow/wasapiデバイス指定は設定可能、再起動耐性)+PCMストリームのフレーム化。
- Silero VAD(onnxruntime-node)ラッパ+**発話セグメンタ純関数**(VAD確率列→speechStart/speechEnd+前後パディング。閾値・最小発話長・最大発話長=whisper-server VADオプション相当の語彙)。
- 発話単位WAV組み立て(既存 wav-duration の逆=エンコーダ純関数)。
- テスト: 合成PCM fixture(正弦波+無音)でセグメンタ境界・純関数を検証(実マイク・実ONNX不要のロジック層と、ONNX要の薄い層を分離)。
- **choke point 1(このドメインでpackage.json更新)**: 依存追加(onnxruntime-node系)→ユーザー `npm install`。

### Domain B: whisper-serverクライアント+転写バッファ+ライフサイクル

- whisper-server子プロセス管理(モデルパス・ポート・起動ヘルスチェック・終了処理。S1のクリーンシャットダウン教訓適用)。
- `/inference` クライアント(発話WAV→text)+タイムスタンプ付与→**転写バッファ**(正本、append-only、S3が読む形)。
- 実機疎通スクリプト `preflight-asr.mjs`(固定WAV→server→text。配線≠疎通)。

### Domain C: 常時稼働の結線+CLI診断+計測+docs

- 耳パイプライン常駐(ffmpeg→VAD→segmenter→ASR→buffer)の結線+CLI表示(積もる転写+VADイベントの可視化)+クリーンシャットダウン。
- 計測→ `experiments/s2-ears.md`(発話終了→転写到着のレイテンシ、CPU負荷、外れ値頻度)。
- docs(README・人間ゲート手順書)+followup記録。

## 4. blockingレビュー基準(S1と同一+追加)

1. pnpm-lock.yaml・器コード・C4契約fixture・S1実装の既存挙動、全て不変(S2は追加のみ。S1テスト84/84無退行)。
2. check:soul-zone / check:deps / check:source 無退行。バイナリ・モデル・音声データの**非コミット**(gitignore整備)。
3. セグメンタ・PCM処理・WAVエンコーダは純関数+fixtureテスト必須。
4. マイク実音声の録音データをリポジトリ・成果物に残さない(プライバシー)。
5. 子プロセス(ffmpeg/whisper-server)の終了処理を明示設計(S1ハング教訓)。

## 5. choke point(ユーザーの作業)

0. **wave発進前**: ffmpeg(winget)+whisper.cpp zip+kotobaモデルを§2の配置へ(手順はUndineが提示)。
1. **Domain A中**: 依存追加後の `npm install`。
2. **人間ゲート**: マイクに向かって喋る→CLIに転写が積もるのを見る(OBS同時起動での共有キャプチャ確認も含む)。

## 6. Status

(発進後に記録)
