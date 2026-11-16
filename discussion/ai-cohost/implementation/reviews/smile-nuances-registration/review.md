# 笑みのニュアンス登録の独立レビュー

2026-11-16。合格。外部JSONの登録内容、既存Playerでの解決・再生経路、選択記録を確認した。 [登録計画](../../orchestration/smile-nuances-registration-plan.md) · [登録定義](../../../../../apps/runtime-player/assets/speech-motions/smile-nuances.json)

| 選択IDの末尾 | 比較試作のクリップ | 時間 | 笑顔の最大値 |
|---|---|---:|---:|
| soft | v1 01-soft | 6500 ms | 0.72 |
| joy | v1 02-joy | 6500 ms | 1.00 |
| shy | v2 shy-v2 | 7000 ms | 0.87 |
| proud | v1 04-proud | 6500 ms | 0.85 |
| relief | v1 05-relief | 6500 ms | 0.90 |

- 両試作の definition、performance、renderer と照合した。5本の duration、entry、全 track の点と値、Stage Y=0・scale=1、実効 fixed が一致した。試作rendererは fixed に track 値を上書きする。loaderは同名の fixed と track を許さないため、登録では上書きされる fixed だけを省いている。試作と再生はいずれも五次smoothstep。照れは頭Xが左 −10° → +7° → 左 −10° と推移し、6.65秒で正面へ戻る。 [v1 定義](../../../experiments/speech-motion-smile-nuances-v1/definition.json) · [v1 データ](../../../experiments/speech-motion-smile-nuances-v1/performance.json) · [v1 描画](../../../experiments/speech-motion-smile-nuances-v1/render.mjs) · [v2 定義](../../../experiments/speech-motion-shy-aversion-v2/definition.json) · [v2 データ](../../../experiments/speech-motion-shy-aversion-v2/performance.json) · [v2 描画](../../../experiments/speech-motion-shy-aversion-v2/render.mjs)
- 比較用の閉口処理はrendererの入力。登録クリップは口開き・母音の入力を保持し、眼球XY=0・左右の通常開度=1で通常の瞬きを抑える。笑顔は既存の param_shared_laughter で出す。再生テストはニュートラルから開始し、50ms間隔と全trackのキーフレームで値を照合した。実配信では preserve-clock の標準処理により、開始姿勢が異なると最初の最大400msに連続化補正が入る。終了後も標準の400msで現在のベースへ戻る。 [再生処理](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-playback.ts) · [照合用テスト](../../../../../tmp/smile-nuances-registration/speech-motion-distribution.test.ts) · [サンプル数](../../../../../tmp/smile-nuances-registration/playback-sample-summary.json)
- version 2 の親説明と各子の発話例が結合され、5子と5組だけが公開される。全5組とも相方（画面左）。game と viewers は unproduced-pair、未知の対象は unknown-attention-target、none と親IDは unsupported-performance。shared-laughter は既存3組のまま選択可能。親説明は親しみ・成功の喜び・照れ・軽い自信・安堵を列挙し、shared-laughter の「面白さを共有して一緒に笑う」と区別できる。両試作READMEの採用節で採用元と画面左の組を追跡できる。 [ローダー](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-assets.ts) · [既存の共有笑い](../../../../../apps/runtime-player/assets/speech-motions/shared-laughter.json) · [v1 採用記録](../../../experiments/speech-motion-smile-nuances-v1/README.md) · [v2 採用記録](../../../experiments/speech-motion-shy-aversion-v2/README.md)
- 比較照合を含む作業用テストで配布定義33件、ローダー12件、実WebSocket連携1件の全46件に独立実行で合格した。比較用の追加fixtureを一時領域に保存し、恒久テストを総数等の既存assertion更新に縮めた最終状態でも、配布定義27件、ローダー12件、実WebSocket連携1件の全40件に独立再実行で合格した。新規分を含むソース全10件と現用の既存9件のSHA-256は、照合用の配置前基準とすべて一致した。 [ローダーテスト](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-assets.test.ts) · [実WebSocket連携テスト](../../../../../apps/runtime-player/src/main/control-channel/speech-intent-motion-integration.test.ts) · [配置前ハッシュ](../../../../../tmp/smile-nuances-registration/baseline.json)
- Orch-Sylphの通常版exe隔離起動記録では、14候補・21組から19候補・26組へ増え、独立したクリップは23本。5子と既存の wry-headshake の強制選択、非対応4経路、親定義アーカイブ参照を確認した。起動時カタログには既存の shared-laughter も掲載されていた。テスト対象の登録JSONのSHA-256は d035d0a642f2c7c9a330e1641048e400d51e74064ed0882754a4ef33121ccd48。 [隔離起動記録](../../../../../tmp/smile-nuances-registration/staging-normal-FLPmc2/report.json)

現用 autonomous-default への配置後にソースと配置先の新規JSONのSHA-256一致を確認した。配置記録でも現用の既存9件のSHA-256は配置前と一致する。次回起動後の実発話での選択、同期、画面上の本人確認が残る。 [現用配置記録](../../../../../tmp/smile-nuances-registration/deployment.json)
