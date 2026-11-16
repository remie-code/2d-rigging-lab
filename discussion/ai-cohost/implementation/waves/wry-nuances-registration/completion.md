# 苦笑の新5案の登録

2026-11-16。比較で採用した②〜⑥を外部定義 `wry-nuances.json` に登録した。各案はゲーム画面・視聴者向けで同じ正面基準のクリップを使う。相方向けは未制作。①「やれやれ」は既存の `wry-headshake` として引き続き選べる。 [比較と採用記録](../../../experiments/speech-motion-wry-nuances-v1/README.md) · [登録定義](../../../../../apps/runtime-player/assets/speech-motions/wry-nuances.json)

| 候補IDの末尾 | ニュアンス | クリップ |
|---|---|---|
| `empathize` | きつさに同調する | `02-empathize` |
| `deflated` | 報われなさに力が抜ける | `03-deflated` |
| `tease` | 可笑しな状況を茶化す | `04-tease` |
| `self-deprecate` | 自分の頼りなさを笑う | `05-self-deprecate` |
| `soft-limit` | 柔らかく限界を伝える | `06-soft-limit` |

既存の苦笑パラメーターを使い、比較時の固定値、曲線、時間を引き継いだ。Stageの倍率1・Y=0、瞳の中央固定、通常瞬きの抑制も保持した。無音プレビュー用の閉口は描画だけの条件で、実発話の口形は音声経路が担う。

## 曲線と実行時の照合

独立レビューで全19曲線114キーと実効固定値を照合した。実装検証では各案・対象の131時刻、計1,310フレームで、モデルパラメーターとStageを試作の描画入力に照合した。試作①は既存定義と一致し、登録ファイルも配置前と一致した。Playerの配布・ローダー・制御契約・実WebSocket統合は61件すべて通過した。 [独立レビュー](../../reviews/wry-nuances-registration/review.md)

## 隔離した通常版での確認

配布済み exe を隔離スロットで起動した。新規追加後は11資産・24候補・36対象組・28クリップ。WebSocketを通した選択 fixture で新規10組、既存の「やれやれ」2組、相方向けの照れ笑い1組の再生要求が受理された。区間記録の定義参照を開き、すべてのクリップを照合した。相方向けの未制作5組、対象不明、`none` では再生要求が出なかった。保存した親定義の SHA-256 は `95682b734ec6fb344963ab2253638bb766c739763cb239ee051df0a6030f5523`。

証拠は `tmp/wry-nuances-registration/staging-normal-c8asCl/report.json`。

## 現用への配置

現用の `C:\Users\remie\AppData\Roaming\@private-2d-rigging-lab\runtime-player\slots\autonomous-default\speech-motions` に新規 JSON を1件追加した。配布元・現用とも新規 JSON の SHA-256 は `e3fc039d3ecfacf7e5d6553ad0d50776e173533fa0a74f83d785333884f5f2c9`。双方の既存10資産、現用モデル入力67ファイル（Git管理データを除く）とExport4ファイル、試作の定義・再生データ・生成コード、通常版とportableのバイナリが配置前後で一致した。次回起動で新しい候補が読み込まれる。

配置証拠は `tmp/wry-nuances-registration/deployment.json` と `model-binary-before.json`、`model-binary-after.json`。実会話での選択傾向、同期、配信画面上の見え方は未確認。
