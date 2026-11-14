# 演技×注意対象 Wave 1 独立レビュー

**2026-11-12 合格。** 原本の再現、6組の直接再生、通常終了と中断、r804 の2表示経路を確認した。実会話での対象選択・自然さと配布用 exe の確認は Wave 2 の本人確認に残る。

[Wave 1 の受領基準](../../waves/performance-attention/wave1-basis.md)と[実装契約](../../waves/performance-attention/wave1-contract.md)を、[ユーザー判断 §7](../../../concept/speech-motion-performance-and-attention.md#7-製品接続のcontext-check2026-11-12確定)と[承認試作](../../../experiments/speech-motion-brief-relief-variants-v1.md)に照らして確認した。

## 原本と再現

[保存先](../../../experiments/speech-motion-brief-relief-variants-v1/)の定義、provenance、承認ハッシュ、フレーム入力、検証 JSON、MP4 4本、コンタクトシートは制作時の `tmp/speech-motion/brief-relief-variants-v1/` と SHA-256 が一致した。README と描画・組み立て・検証用の4ファイルは原本の参照先と出力先を移設している。保存先にフレーム画像の全量や外部モデルを含めず、モデルの配置とハッシュ、再現コマンドは README から辿れる。

再生成した3案の各125 PNGを元フレームと突合し、375/375枚が一致した。相方の125枚は承認記録内の SHA-256 にも一致した。保存版と再現版の MP4 は4/4本一致し、相方の SHA-256 は `264e694c85c99558ac639b106158fb8a302f2c4a1f3d2e5ba69428caea7095e5`。保存版の検証 JSON は各125フレーム、24fps、無音、全フレームのデコード成功を記録している。

## 登録・合成・状態遷移

- 共有 lookup は旧3種の相方と短い安堵の3対象を解決し、演技未対応・対象不明・未制作を区別する。従来の preset ID と Stage Y 単体形式も通る。新旧指定を混ぜたリクエストは拒否する。WS の `accepted` は受付の応答で、区間や接続の所有権で無視された場合も返る。 [共有レジストリ](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-registry.mjs)・[受付処理](../../../../../apps/runtime-player/src/main/control-channel/channel-request-dispatch.ts)
- 新3案の7パラメータと Y の全キーフレームは制作定義と一致する。r804 の package ID・revision・ロード時検証済みの atlas SHA-256・有効な対象 slot binding と既定値を照合し、不一致は `motionModelMismatch` を返す。実行用の7パラメータをモデル単位で合成するため、相方の Body X はピーク −5.8、終端 −5.0 に達する。口の値は既存のフレームに残り、Stage Y は同じ時刻で別にサンプルされる。 [曲線と適用条件](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-r804-clips.json)・[フレーム合成](../../../../../apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts)
- 新クリップは直前の表示フレームとの差分を400msで減衰し、制作時刻どおりに曲線へ接続する。通常 end は区間を閉じ、進行中の新クリップは 4.5秒の曲線末尾まで進み、そこから400msで現在の基底へ戻る。Stage Y は制作時と同じ180msの進入を持つ。cancel・次区間の begin・所有接続の切断は進行中の曲線から解除する。遅着・重複・古い所有者からの操作は新しい区間のモーションに適用しない。 [状態機械](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-state.ts)
- 実 WS とフレーム心臓を通る Soul 統合テストでは、r804 の相方版で Body X が −5.8 に到達し、fixture の `fireKill` から `fire.kill()` と WS cancel を経て、解除開始時の Body X が半分になり基底へ戻ることを確認した。同じ解除で Stage Y は 14 → 7 → 0px。end 後の cancel、切断、次区間による解除は登録のテストでも確認した。 [Soul 統合テスト](../../../../../apps/runtime-player/src/main/control-channel/speech-intent-motion-integration.test.ts)

## 独立再実行

| テスト | 結果 |
|---|---:|
| `speech-motion-registry.test.ts` | 10/10 |
| `speech-stage-y.test.ts` | 26/26 |
| `channel-protocol-contract.test.ts` | 20/20 |
| `channel-server.test.ts` | 11/11 |
| `speech-intent-motion-integration.test.ts` | 1/1 |

実 WS 2ファイルは初回のサンドボックス実行でソケット接続に失敗し、ローカルループバックを許可した再実行で12/12件が通った。`git diff --check` は成功。source organization guard は `apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反1件を報告した。該当ファイルは HEAD と同じで、[先行の独立レビュー](../stage-vertical-motion/review.md)にも同じ違反がある。

実装担当の全体試験は Runtime Player が155ファイル・1065件、packages が250ファイル・1552件。型検査、依存関係、Soul Zone 境界検査も成功との報告を受けた。

## r804 の実表示

隔離した Runtime Player と実 WebSocket を用い、Native Stage と Chrome の Browser Source を順に確認した。両経路で直接指定の6組を再生した。新3案は約70ms後に通常 end を送り、開始・沈み・戻り・曲線終端・解除後の画像を制作原本の近い時刻のフレームと見比べた。実表示ではゲームが正面のまま沈み、相方は画面左への注意を保って上がり、視聴者は控えめに上を見る。相方版は制作原本で終端姿勢を保ち、製品ではその姿勢まで到達した後に基底へ戻った。生理まばたきや画角の違いが画像に現れる。 [Native 比較](../../../../../tmp/performance-attention-display/proof-4aPbMK/native-comparison.png)・[Browser Source 比較](../../../../../tmp/performance-attention-display/proof-4aPbMK/browser-comparison.png)

Stage Presence は Off。各採取点で手動 pan X = −522px、zoom = 2.75 を保持した。手動 pan Y = −123px に対する演技中の変位は下表のとおり。各案とも曲線終端と解除後の Y は −123px に戻った。 [同一描画のフレーム値と座標](../../../../../tmp/performance-attention-display/proof-4aPbMK/samples.json)

| 対象 | Native の沈み | Browser Source の沈み |
|---|---:|---:|
| ゲーム画面 | +12.50px | +12.50px |
| 相方 | +14.00px | +14.00px |
| 視聴者 | +11.96px | +11.89px |

相方の Body X は沈みの撮影点で Native −5.795／Browser −5.794、両経路の終端で −5.0。頭 X は終端 −17.5° で、画像にも左向きが残った。キー時刻1320msの −5.8 は状態機械と実 WS 統合試験で確認した。口との重なりは、視聴者向けの途中で口開きが Native 0.642／Browser 0.647 の画像と同時点の Y 変位を確認した。直接 cancel 後は両経路で Y が −123px に戻った。

別姿勢からの進入では、Native の頭 X は開始前 +16.5°、開始時刻 0ms でも +16.5°、228ms 後に +6.11°。Browser Source の初回の進入画像は開始31ms前だったため再採取した。再採取では、Native は開始付近の +16.5° から78ms後に +15.61°、232ms後に +5.82°。Browser Source は開始48ms前に +16.5°、52ms後に +16.20°、191ms後に +8.95°。対応する画像も右向きから正面へ移行している。 [再採取のフレーム値](../../../../../tmp/performance-attention-display/proof-7NFlaE/samples.json)・[Browser の52ms画像](../../../../../tmp/performance-attention-display/proof-7NFlaE/browser-non-neutral-entry.png)・[Browser の191ms画像](../../../../../tmp/performance-attention-display/proof-7NFlaE/browser-non-neutral-transition.png)

初回の CDP スクリーンショットは数秒遅れ、計測時点と別の画像になったため再採取した。採用した証拠は隔離ビルドの renderer に採取用フックを置き、既存 `renderScheduledFrame()` で評価済み入力と実際の描画変換を適用し、同じタスクで画素を読み出したもの。メインと採取フックを追加する前の renderer の SHA-256 は計測記録と一致した。この採取で確認した範囲は描画結果と値の対応。隠しウィンドウでの自然な描画間隔や通常環境の表示レイテンシーは測定対象外。実 OBS・マイク・配信は使用していない。 [撮影スクリプト](../../../../../apps/runtime-player/scripts/capture-speech-motion.mjs)
