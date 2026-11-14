# Wave 1の受領記録

## 原本と実行定義

[制作原本・再現手順・代表プレビュー](../../../experiments/speech-motion-brief-relief-variants-v1/)を保存した。承認済みの `definition.json`、`provenance.json`、比較・個別MP4四本、承認ハッシュ、コンタクトシート、制作証跡は旧tmpとSHA-256が一致。再現のREADME・スクリプトは保存先から実行でき、生成先をGit対象外のtmpへ移した。再描画した375 PNGと4本のMP4は原本と一致した。

実行用の[短い安堵3組の曲線](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-r804-clips.json)は原本の `game`、`partner`、`viewers` へ対応する。旧3曲線は既存preset IDを使い、相方向けとして共有lookupに登録した。6組のIDと直接指定の手順は[後続契約](wave1-contract.md)に記載。

## 曲線と実表示の範囲

- ゲームは正面で沈み、相方は画面左へ向き、視聴者は視線を上げる。相方は沈みから基準高へ戻った後も横向きを保ち、製品解除で基底姿勢へ戻る。承認プレビューは向いた姿勢で終わるため、最後の画面は製品と異なる。
- 最終の[Native比較](../../../../../tmp/performance-attention-display/proof-4aPbMK/native-comparison.png)と[Browser Source比較](../../../../../tmp/performance-attention-display/proof-4aPbMK/browser-comparison.png)は、隔離ビルドの既存描画関数で現在の受信フレームを描き、同じ描画タスクで実フレーム値・カメラ・PNGを採取した。非表示ウィンドウの自然描画を待たないため、実運用の描画頻度と体感上の滑らかさは確認していない。[同じ描画で取得した数値](../../../../../tmp/performance-attention-display/proof-4aPbMK/samples.json)
- 試作は専用の構図、製品確認は手動pan X −522、zoom 2.75のStageから切り出した。現在姿勢との差分を最初の400msで減衰させ、製品は口・まばたき等も合成する。比較に見える位置・傾きの差を画角だけで説明し切ったとは判断していない。
- 旧Native CDPスクリーンショットには約2.3–4.1秒の採取遅れがあり、ラベルが違う同一画像も出たため、表示証拠から除外した。Stage PNG APIだけを使った中間試行ではgame entryの画と別取得のIPC値にずれが残り、最終の同期採取で正面を確認した。
- 両表示で6組が再生され、`end` を再生約70ms後に送っても新3組は完走。Stage Presence Offの手動Y −123から、ゲーム −110.5、相方 −109、視聴者約 −111を経て基底へ復帰。相方Body XはアクセントでNative −5.795／Browser −5.794、終端は両方で −5.0を保持。頭X −17.5と画面左への向きが残り、その後解除した。
- 別姿勢からの進入では、両表示とも開始前の頭Xは +16.5°。同期採取の追試はNativeで78ms時 +15.606°、232ms時 +5.817°、Browserで52ms時 +16.205°、191ms時 +8.945°。最初の比較採取のBrowser直後ラベルは開始前だったため、追試で実際の開始後を確認した。口開き0.642／0.647と上体・Stage Yが共存し、cancel後はY基底に復帰。実Soul `fire.kill()` の別プロセス統合は相方のBody XとYの解除まで確認した。[追試の同期採取](../../../../../tmp/performance-attention-display/proof-7NFlaE/samples.json)

## 独立レビューと後続

独立Review-Sylphが実装・再現・実WS・同期採取を照合し、Wave 1を合格と判定した。rootも最終の両比較シートを目視した。本人による実会話での見え方・自然さの判断は配布更新後に行う。[独立レビュー](../../reviews/performance-attention/wave1.md)

| 検査 | 結果 |
|---|---|
| Runtime Player全体 | 155ファイル・1065件成功。実WSの6組、legacy互換、モデル不一致、遅着・接続所有者、Soul kill統合を含む |
| root packages | 250ファイル・1552件成功 |
| Soul関連 | 134件成功 |
| ビルドと型 | Electronビルド、rootとRuntime Playerの型検査に成功 |
| 境界・整形 | deps、Soul-zone、fixture、`git diff --check` 成功。source organizationは基点と差分のない `physiology/index.ts` の既知1件。独立したlintスクリプトはなし |
| 独立再実行 | registry、Stage Y、protocol、channel server、Soul実WS統合の5ファイル68件成功。原本の再現と同期PNG・実フレーム値を独立照合 |

Wave 2は[後続契約](wave1-contract.md)を使い、二問判定、非待機の音声接続、記録と配布更新を担当する。配布用win-unpackedとportableの更新はWave 2で行う。

## Gnomeの実装所有

- `apps/runtime-player/scripts/` の `capture-speech-motion.mjs`、`replay-stage-y.mjs`。
- `apps/runtime-player/src/main/` の `runtime-player-main.ts` と、`role-composition/` の `autonomous-frame-heart.ts`、`input-subsystem.ts`、`input-subsystem.test.ts`。
- `control-channel/` の `channel-request-dispatch.ts`、`channel-server.ts`、`control-channel-overlay-store.ts`、`speech-motion-state.ts`、`speech-motion-registry.test.ts`、`speech-intent-motion-integration.test.ts`。
- `control-channel/contract/` の `channel-envelope-schema.json`、`channel-exchange-examples.json`、`channel-intent-motion-payload-schema.json`、`channel-protocol-contract.ts`、`speech-motion-r804-clips.json`、`speech-motion-registry.json`、`speech-motion-registry.mjs`、`speech-motion-registry.d.mts`。
- [制作記録](../../../experiments/speech-motion-brief-relief-variants-v1.md)と[同名の保存ディレクトリ](../../../experiments/speech-motion-brief-relief-variants-v1/)の15ファイル。
