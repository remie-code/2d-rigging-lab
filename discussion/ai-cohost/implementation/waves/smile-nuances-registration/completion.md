# 笑み5本の登録

2026-11-16。比較で採用した笑み5本を画面左の相方（`partner`）向けに登録した。配布元の `smile-nuances.json` は version 2 の親定義で、起動時に各子が Decision の候補に展開される。 [登録定義](../../../../../apps/runtime-player/assets/speech-motions/smile-nuances.json) · [登録計画](../../orchestration/smile-nuances-registration-plan.md)

| 候補 ID | ニュアンス | クリップ |
|---|---|---|
| `smile-nuances--soft` | 柔らかく微笑む | `01-soft` |
| `smile-nuances--joy` | 嬉しさが弾む | `02-joy` |
| `smile-nuances--shy` | 照れながら笑う（相手→そらす→相手） | `shy-v2` |
| `smile-nuances--proud` | 少し得意げに笑う | `04-proud` |
| `smile-nuances--relief` | 息を抜いてから微笑む | `05-relief` |

折り重なっていた固定値と曲線は、比較用レンダラーで有効だった値に揃えた。Stage の倍率と Y を固定し、眼球の基準値と通常瞬きの抑制を既存の方式で適用した。発話時の口形は音声経路が制御する。 [5本の比較](../../../experiments/speech-motion-smile-nuances-v1/README.md) · [照れの改訂版](../../../experiments/speech-motion-shy-aversion-v2/README.md)

## 検証と配置

- 採用元と再生経路を全129キーと50 ms間隔の665時刻で照合した。比較用の一時 fixture を含め、Player の Control Channel 275件、Soul の発話意図モーション・Fire連携140件、および Player 型検査が通過した。独立レビューで配布・ローダー・WebSocket 統合の46件が通過し、既存テストの件数更新だけを残した最終構成で Player の配布・ローダー・WebSocket 統合40件と Soul の139件が通過した。 [独立レビュー](../../reviews/smile-nuances-registration/review.md)
- 配布済みの通常版 Runtime Player を隔離スロットで起動した。相方向け5組が増え、全体は10資産・19候補・26対象組・23クリップになった。既存の `shared-laughter` も候補に残った。WebSocket を通した選択 fixture で、新規5件と既存1件の再生要求が受理され、区間記録のクリップ ID と保存済み定義が一致した。ゲーム・視聴者向けの未制作、対象不明、`none` の4件では再生要求が出なかった。親の保存済み定義の SHA-256 は `bed9d8b2c6d0688ec4414fae727dd540f121bbea3669a96a55c49bc47f99129b`。
- 現用の `C:\Users\remie\AppData\Roaming\@private-2d-rigging-lab\runtime-player\slots\autonomous-default\speech-motions` に JSON を1件追加した。配布元と現用先の新規 JSON の SHA-256 はともに `d035d0a642f2c7c9a330e1641048e400d51e74064ed0882754a4ef33121ccd48`。双方で既存9件のハッシュは配置前後で一致した。同じ exe が次回の通常起動から読み込む。

証拠は `tmp/smile-nuances-registration/staging-normal-FLPmc2/report.json` と `tmp/smile-nuances-registration/deployment.json`。実会話での Decision の選択傾向と画面上の見え方は未確認。
