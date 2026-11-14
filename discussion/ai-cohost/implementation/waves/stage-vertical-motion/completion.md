# 発話モーションの Stage Y 完了記録

[合意 Wave](../../orchestration/stage-vertical-motion-wave-plan.md) / [basis](basis.md) / [独立レビュー](../../reviews/stage-vertical-motion/review.md) / [本人確認手順](human-gate.md)

## 実装

発話モーションに `stageY` のキーフレームを持たせ、既存の `intent.motion` で単独または頭・姿勢の preset とともに再生する。Y はモデルのパラメータと分離し、Native Stage と Browser Source の表示用 transform に現在の手動 pan からの変位として加える。Stage Presence の X/拡縮、カメラ由来の Stage Motion、手動配置の保存は従来どおり。確認用の [保存定義](evidence/stage-y-motion.json) は候補レジストリ外にある。

## 実表示

更新した win-unpacked 版を隔離プロファイルで起動。r804、Stage Presence Off、手動 pan x=21/y=34・zoom 0.85。保存定義を実 WebSocket で送信し、Electron Native Stage（600×720）と Chromium の Browser Source ページ（850×900）を順番に撮影した。Browser Source 接続中は既存仕様で Native のライブ描画が一時停止する。

両出力で pan.y は **34 → −56 → 99 → 34**、pan.x と zoom は全点で一定。論理ピクセルで上へ90、下へ65、最後に基準へ戻った。独立レビューで画像上の足元の画素位置も確認した。上下指定を外して同じ preset を再生する試行では、両表示とも各18点で pan/zoom が基準のままだった。大きめの変位を使ったため、Native の上位置では髪先が画面の上端に触れる。[比較画像](evidence/stage-y-contact-sheet.png) / [計測](evidence/display-transforms.json) / Native [基準](evidence/native-baseline.png)・[上](evidence/native-up.png)・[下](evidence/native-down.png)・[復帰](evidence/native-returned.png) / Browser [基準](evidence/browser-baseline.png)・[上](evidence/browser-up.png)・[下](evidence/browser-down.png)・[復帰](evidence/browser-returned.png)。

## 機械・配布ゲート

Runtime Player 全154ファイル1055件、Runtime Player とrootの型検査、JSON SchemaのAjv検証11件、依存・Soul zone・fixture guard と `git diff --check` が通過。独立実行は Browser Source の server/client を含む40ファイル372件。修正後に Fire の実 kill → WebSocket cancel → Stage Y の解除（−80 → −40 → 0）も独立実行で確認した。source guard の失敗は基点から変わっていない `physiology/index.ts` の barrel-only 違反1件。

既存 dist:win の等価手順で `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` と `apps/runtime-player/dist/Runtime Player 0.0.0.exe` を更新した。通常版から上記の両表示を検証し、portable 版も別の隔離プロファイルで r804・Presence Off・Y変位と復帰を確認した。portable が起動時に展開した `app.asar` と通常版の `app.asar` は SHA-256 `0fe4446ec62346c202a5fd88f2b6585c5e29fa2cb8d5b2a91b7f68049fc894f4` で一致。ASAR 内の main.js は今回のビルド出力と同じ SHA-256 `981215cf85e36b89ea5c189e8997b80a9496e3f2808dddb7543a34ea9da84250`。独立レビューは合格（初回所見と限定再確認）。配布物本体のSHA-256、起動確認ログ、再現コマンドは[検証記録](evidence/README.md)を参照。検証専用の Runtime Player・Chrome・ローカルサーバーは終了し、今回作成した一時プロファイル3個を削除した。

## 本人確認

本人の普段の設定での見え方、OBS アプリ内での表示、実会話と実音声は未確認。配信やマイクを起動せずに [本人確認手順](human-gate.md) で機能を試せる。この確認後に安堵の演技を制作する。




