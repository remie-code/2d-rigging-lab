# 苦笑の新5案の登録レビュー

2026-11-16。合格、現用プロファイルへ配置可。レビュー対象の `wry-nuances.json` の SHA-256 は `e3fc039d3ecfacf7e5d6553ad0d50776e173533fa0a74f83d785333884f5f2c9`。隔離試験の資産と一致する。

## 採用元との独立照合

- version 2 の新規資産は②〜⑥の5候補・5クリップを持つ。各候補の `game` と `viewers` は試作正面版の同一 ID を参照する。①「やれやれ」は既存 `wry-headshake` のまま残り、登録済みファイルは HEAD と一致する。試作①の曲線・固定値・既定値・尺・entry・Stage Y も既存定義と一致した。[採用資産](../../../../../apps/runtime-player/assets/speech-motions/wry-nuances.json) · [試作曲線](../../../experiments/speech-motion-wry-nuances-v1/performance.json)
- ②〜⑥の全19曲線114キー、6,500 ms、`preserve-clock`、Stage の全キーが試作と一致した。試作の `fixed` を展開した後で `tracks` を重ねる順序に従い、③の `param_body_angle_z` は曲線を使う。各クリップの残りの固定値は、試作で実際に使われる値と一致した。Stage は scale 1・Y 0、瞳XYは0、両目開度は1で固定する。[試作生成](../../../experiments/speech-motion-wry-nuances-v1/author.py) · [試作描画](../../../experiments/speech-motion-wry-nuances-v1/render.mjs)
- すべてのモデルパラメータ曲線は 0 ms と 6,500 ms でニュートラル。⑤の顔の横回転は1,800〜2,850 msに7度、4,150 msに0度。ランタイムでは五次補間を使い、前の姿勢からの `preserve-clock` の入り補正と通常の解放が適用される。製品では口を通常の発話口パクに任せ、比較試作の閉口は renderer で指定する。[再生処理](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-playback.ts) · [試作描画条件](../../../experiments/speech-motion-wry-nuances-v1/definition.json)
- 選択用の説明は、つらさへの同調、徒労、冗談の重ね、自分の不得手、限界と代案をそれぞれ固有の例で区別する。既存①の「やれやれ」は共通説明で `wry-headshake` に誘導する。試作READMEの採用節には正面版の共用、⑤の一時横向き、相方版の未制作、①の扱い、口パクの扱いがそろっている。[採用資産](../../../../../apps/runtime-player/assets/speech-motions/wry-nuances.json) · [採用節](../../../experiments/speech-motion-wry-nuances-v1/README.md#比較後の採用)

## 起動・選択・記録

- 独立実行の配布資産テストは27件合格。既存の件数検査と共有のアーカイブ件数検査が11資産・24候補・36組・28クリップを確認した。追加で実行した既存のWebSocket使用テスト2件はレビュー環境で `Control Channel socket failed to open` となった。3ファイルを合わせて38件合格・2件失敗。[配布資産テスト](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-distribution.test.ts)
- Orchestrator の隔離通常版 exe では20ケースを確認した。新規5候補の `game` と `viewers` の10組、旧 `wry-headshake` の2組、既存の照れの相方版は受理され、記録の保存定義参照から各クリップを照合できた。新規5候補の `partner` は `unproduced-pair`、未知の注意対象は `unknown-attention-target`、`none` は演技なし。既存候補の説明・対象ペア・定義アーカイブのハッシュは比較前後で一致した。[隔離試験ログ](../../../../../tmp/wry-nuances-registration/staging-normal-c8asCl/report.json)
- 実装担当の再生照合では、新規5候補の `game`・`viewers` を合計1,310フレーム比較し、モデルパラメータとStageが一致した。[再生照合ログ](../../../../../tmp/wry-nuances-registration/source-proof.json)

独立レビュー後、実装担当がループバックに接続できる環境で再実行し、既存WebSocketの2件を含む全61件が通過した。 [最終テストログ](../../../../../tmp/wry-nuances-registration/source-all-focused-tests.log)
