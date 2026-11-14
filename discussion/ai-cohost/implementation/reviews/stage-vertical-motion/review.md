# 発話モーションの Stage Y 独立レビュー

2026-11-11。対象は `codex/intent-motion` の作業ツリー。[合意済み計画](../../orchestration/stage-vertical-motion-wave-plan.md) と [実装 basis](../../waves/stage-vertical-motion/basis.md) に照合した。

## ソースと試験

- Stage Y は `SpeechMotionState` のスカラーを `RuntimePlayerControlChannelOverlayStore` と frame heart から `stageYOffsetPx` として取り出す。モデルスロットへの解決、口パクのタイムライン、音声開始の条件は従来の経路を通る。実 WebSocket の統合試験で上下、頭、口、母音を同じ tick で観測した。
- `stage-motion-runtime.ts` が現在の手動配置と Stage Presence から得た `pan.y` に Y を加える。Off でも Y が非ゼロの間は Native override を送る。On 時の X・拡縮は既存計算を通る。`runtime-player-main.ts` の共通出力は Native の IPC と Browser Source のサーバーへ渡り、Browser Source のクライアントは変換をレンダラーに設定する。
- 実装裁量は `stage-viewport-px-v1` の論理 px、下が正、180 ms 進入、400 ms 解除、最大 64 点と ±200 px の変位。表示の拡大率とビューポート寸法に対し、オフセットの論理 px は一定。手動配置が変わるとその時点の配置に加算する。
- `stageY` 単独と preset 併用を許可。保存 preset は任意の `stageY` を参照でき、要求の明示指定が優先される。`speech-motion-presets.json` の製品候補は `receive`、`interest`、`ask`。増加時刻は実行時に検証し、個数、組の長さ、範囲、先頭時刻、指定可能な操作を契約にも表現した。
- 区間と発話世代の進行、early end、cancel、接続切断、新しい接続、過去の所有者や区間から遅着した要求、hard clear を確認。製品の kill は発話中断と同じ motion cancel 経路を使う。

## 初回指摘の再確認

- 軽微。`channel-intent-motion-payload-schema.json` の先頭時刻が実装と同じ 0 に限定されるよう修正された。
- 中。`speech-motion-state.ts` で自然解除中に終了通知を受けた場合、元の解除期限を維持するよう修正された。終点後に途中サンプルがない場合を回帰試験で確認した。
- 中。`speech-intent-motion-integration.test.ts` が上下、preset の頭動作、口パクを同じ tick で確認するよう修正された。

## 独立実行

- Runtime Player の Control Channel、Stage Motion、role composition、Browser Source server / client の Vitest は、loopback 接続許可下で 40 ファイル 372 件合格。サンドボックス内での初回実行は WebSocket 接続が必要な 12 件が失敗し、同じ対象の許可付き実行で全件合格した。
- Stage Y が動作中の製品 Fire kill を加えた WebSocket 統合試験を独立で再実行し合格。Y は −80 → −40 → 0 px。Runtime Player の TypeScript 型検査も合格。
- 依存関係、Soul Zone 境界、Soul Zone 境界の fixture は合格。source organization guard は `apps/runtime-player/src/main/physiology/index.ts` の既知 barrel-only 違反 1 件。対象ファイルの HEAD 差分は空。

## 保存定義と実表示

- 隔離起動した実 Electron の Native Stage と Chrome で開いた実 Browser Source ページで r804 を表示。実 Control Channel WebSocket から保存 JSON を `receive` preset と再生した。Stage Presence Off の状態で、各出力の `pan.y` は 34 → −56 → 99 → 34、`pan.x` は 21、zoom は 0.85。preset のみを同じ接続で別区間として再生すると、各出力とも 18 サンプルで手動配置を維持した。[変換の記録](../../waves/stage-vertical-motion/evidence/display-transforms.json)
- 8 枚を目視し、Native 600×720 と Browser 850×900 でモデル全体が同じ論理 px だけ上下し、復帰を確認。画像から抽出した足元の画素境界は Native が 570 → 480 → 635 → 570、Browser が 703 → 613 → 768 → 703。Native の上昇時は撮影用配置で毛先が上端から少し出る。[実表示の比較画像](../../waves/stage-vertical-motion/evidence/stage-y-contact-sheet.png)
- 確認用 JSON と再生 CLI を使う [本人確認手順](../../waves/stage-vertical-motion/human-gate.md) を UI の表示名と照合。`--without-stage-y` と通常の再生の両方で同じ保存定義を使う。本人の普段のアプリと OBS ホスト上での視認は未確認。

## 配布物と判定

- `win-unpacked/resources/app.asar` の `out/main/main.js` を読み出し、現行ビルドと SHA-256 `981215cf85e36b89ea5c189e8997b80a9496e3f2808dddb7543a34ea9da84250` が一致すること、`intent.motion` と `stageYOffsetPx` を含むことを確認した。確認 JSON、再生 CLI、キャプチャ用スクリプトは製品 ASAR 外。
- portable の配布 exe は SHA-256 `673702d18c37b532f18f37902f4c6b5ce92bfe093b50e37cadbf75f8e002b2a5`。隔離起動した portable の Control ページから特定した実行中の ASAR は、独立計算した `win-unpacked` の ASAR と SHA-256 `0fe4446ec62346c202a5fd88f2b6585c5e29fa2cb8d5b2a91b7f68049fc894f4` が一致。portable でも r804、Stage Presence Off、preset のみ、実 WebSocket から上下と手動位置への復帰を観測した。[portable smoke](../../waves/stage-vertical-motion/evidence/portable-smoke.json)
- 機械検証は合格。本人確認が残る。
