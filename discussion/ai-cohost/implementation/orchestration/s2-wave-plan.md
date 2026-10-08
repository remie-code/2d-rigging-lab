# S2 wave計画: 耳が生える(ローカルASR常時+転写バッファ)

> Status: **完全閉鎖(2026-07-12)**。機械ゲート全緑+人間ゲート合格(ユーザー「完璧だ」——転写が数秒以内に積もる・OBS同時キャプチャ問題なし)。
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
- **設計注記(Domain Aレビュー note 1 の引き継ぎ)**: セグメンタの `speechEnd.endMs` は flush 時に speechPadMs 分だけストリーム実在範囲を超え得る。maxSpeech 分割セグメントは前後 2×pad 重なる(いずれも意図された純関数契約)。**PCMリングバッファからの範囲切り出しは [0, 実データ末尾] への clamp が必須**。
- Domain A 続行残項目の回収(Undine裁定 2026-07-12): **preflight-vad の再現資材化**(I/O名照合自体はレビューの使い捨てプローブで達成済み・スクリプト未作成)+ **VADラッパ到達テストの追加**。
- **設計注記(Domain Bレビュー notes 1/2/3/4 の引き継ぎ・Undine裁定 2026-07-12)**:
  - whisper-server の監視は **2 経路必須**: spawn 失敗は `onExit` に乗らず `ready` の reject でのみ観測される。結線層は「ready の reject」と「ready 後の onExit」の両方で死を監視すること(note 2)。
  - `onExit` 正経路(ready 後の非 dispose 死→onExit 発火)のテストを結線テストと同時に 1 本足す(note 3)。
  - 転写バッファの **listener 例外契約の線引き**を決めて固定テストを置く: 現実装は listener の throw が append 呼び出し元へ伝播し残り listener がスキップされる(正本自体は壊れない)。「listener は throw しない契約」の明文化か結線層での try/catch かを決める(note 4)。
  - whisper-client のタイムアウトは fetch 完了までしか覆わない(本文読み取りは対象外)。常駐結線では「1 発話の転写処理全体」への外側の見張りを検討(note 1)。
- **有界レイテンシチューニング(Undine裁定 2026-07-12)**: warm 6.6〜9.5s は人間ゲート「数秒以内の追従」を落とすリスクが高く、ゲートに届く努力はS2スコープ内。試すのは 3 系統まで: (a) `--audio-ctx` の発話長比例の動的設定(30s固定窓短縮の正攻法・品質への影響も1〜2ケースで確認) (b) threads(4/8+必要なら中間値1点) (c) `-bo 1` 等の探索幅削減。各設定のレイテンシ・転写品質を experiments/s2-ears.md に記録し、**warm 2〜3s以下に届いたら打ち切り**。届かなければ最良設定+正直な記録で人間ゲートへ(ゲート判定はユーザーの領分)。threads 常駐既定は「計測上の最速」ではなく**「最速に近い最小スレッド数」**(配信中は器の二体とCPU共有)。
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

- 2026-07-12: **Domain A 閉鎖**。Gnome実装([../waves/s2/domain-a.md](../waves/s2/domain-a.md))→Review-Sylph 3レーン **PASS-with-notes・blockingゼロ**([../reviews/s2/domain-a-review.md](../reviews/s2/domain-a-review.md))。129/129緑(S1 84無退行+新規45)・3チェック無退行・保護対象不変・vendor/録音物の非コミット化(魂ローカル .gitignore 新設)。
- 2026-07-12: **choke point 1 解消**(ユーザー作業完了をUndineがL0裏取り: `npm install` 済み・`silero_vad.onnx` 2,327,524 byte 配置済み)。魂の package-lock.json +186行差分は install の自然な帰結として受理(§4-1 の保護対象ではない・Undine裁定)。レビューが Silero ONNX I/O 名(input/state/sr→output/stateN)を実モデル照合し一致確認。stopなしで Domain B へ続行(Undine指示)。
- 2026-07-12: **Domain B 閉鎖**。Gnome実装([../waves/s2/domain-b.md](../waves/s2/domain-b.md))→Review-Sylph 3レーン **PASS-with-notes・blockingゼロ**([../reviews/s2/domain-b-review.md](../reviews/s2/domain-b-review.md))。160/160緑(baseline 129無退行+新規31)・3チェック無退行・保護対象不変・新規npm依存ゼロ・preflight-asr実機PASS(レビュー独立再実行含む・孤児プロセスなし)・日本語転写の実取得成功(kotoba実機)。レイテンシ実測 warm ≈6.6s@8T/≈9.5s@4T(音声長非依存の固定コスト)→上記の有界チューニングを Domain C へ。転写バッファの無限成長は長期記憶の別問題系列へ先送り(s2-followup.md に記録・Undine裁定)。
- 2026-07-12: **Domain C 閉鎖 = 機械ゲート閉鎖(wave完了・残るは人間ゲートのみ)**。Gnome実装([../waves/s2/domain-c.md](../waves/s2/domain-c.md))→Review-Sylph 3レーン **PASS-with-notes・blockingゼロ**([../reviews/s2/domain-c-review.md](../reviews/s2/domain-c-review.md))。196/196緑(baseline 160無退行+新規36)・3チェック無退行・保護対象不変・設計注記6点全回収。**有界チューニング打ち切り基準到達**: 採用構成(threads 6+動的 audio_ctx `clamp(ceil(秒×50)+96,256,1500)`+maxSpeechMs 20000+minSilenceMs 400)で **warm 1.5〜1.8s ≤ 基準2〜3s**(未チューニング比≈4倍・品質全窓一致)。縦貫通実機 preflight-ears は Gnome/Orch/Review の3実行者独立PASS(latency 1465〜1536ms・孤児ゼロ)。silero-vad.mjs への許可超過2修正(v5 576入力文脈=公式OnnxWrapperと1:1一致・intraOpNumThreads:1=アイドル396%→1.2%/コア)は **Undine事後承認+レビュー独立検証で確定受理**。レビューnote 6(process直列契約のJSDoc)はwave内で即時回収(196/196緑を再確認)。preflight-asr の分担解釈(素の全窓経路=preflight-asr / 採用経路=preflight-ears+bench-asr N=8)を機械ゲート4の充足として確定(Orch裁量・Undine承認)。計測は [../../experiments/s2-ears.md](../../experiments/s2-ears.md)(実マイク数字は人間ゲート後追記)。残 non-blocking は [../waves/s2/s2-followup.md](../waves/s2/s2-followup.md) §4〜§5 に台帳化(watchdog非キャンセルは S3 設計注記として明示引き継ぎ)。人間ゲート手順: [../waves/s2/human-gate-procedure.md](../waves/s2/human-gate-procedure.md)。人間ゲートと CLOSURE 判定は Undine が引き取る。
- 2026-07-12: **人間ゲート合格(ユーザー実施)→ S2 完全閉鎖**。判定「**完璧だ**」——発話ごとに正しい転写が数秒以内に積もる。観察2件: (1) 滑舌が悪いときはたまに聞き違えるが意識して喋れば問題なし=「転写は完璧でない」というS3品質前提のユーザー自身による実地裏付け (2) **OBS同時起動でもマイク共有キャプチャに問題なし**=棚卸しの推測(Windows共有モード)が実証され、配信と耳の同時稼働が成立。
