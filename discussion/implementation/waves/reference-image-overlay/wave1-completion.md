# Wave 1 の完了記録

**Wave 1 の内部判定は合格。** 独立 Review-Sylph が契約・実装・テスト・実画像を照合した。 [独立レビュー](../../reviews/reference-image-overlay/wave1.md)

## 実装

- `packages/contracts` と `packages/authoring-core` に共有状態、PNG の寸法検査、配置演算、workspace での保存・検証の接続点を追加した。後続 Editor の接続は [共有契約](wave1-contract.md) に記録した。
- `packages/ai-interface` と `apps/authoring-host` に、`referenceImage` の取得・登録/差替え・更新・除去と `renderView` の表示切替を追加した。Host の描画は `packages/render-software` の前景描画を使う。 [Host 利用手順](../../../../apps/authoring-host/reference-image.md)
- 参照画像は workspace の `authoring/` に保持する。Host の通常モデル保存・Export はモデルファイルを使い、参照操作だけで revision を進めない。

## 検査

- Root / Host 型チェック、root unit 251 ファイル・1,553 テスト、依存境界・Soul 境界、参照専用 Host CLI テストが通過した。
- Host 全体は 164/165。変更前と同じ `state-directory-guard.test.ts` の `rejects a state directory inside the package directory before doing any IO` が失敗した。存在しない package 親への lock 取得が state-directory の拒否に先行する。
- ソース構成チェックは実装前と同じ `apps/runtime-player/src/main/physiology/index.ts` の barrel 規約違反を報告した。

## 実 Host CLI の確認

- r815 の検証用コピーに実参照 PNG を登録し、登録元の検証ファイルを削除した後も別の CLI プロセスから読み込めた。pivot を画像座標 `(550, 535)` に置き直す前後の PNG はバイト一致。非中心 pivot を維持して倍率 `0.875`、回転 `2.4°` を適用した。
- 546×465 と 536×444 の出力で三つの表示を確認した。opacity 0 の重ね合わせはモデルのみと一致し、0.45 で参照最大 alpha は 115、1 で 255。差替え PNG でも元 alpha 127 に opacity 0.5 を掛けて 64。非表示時も設定値を保持し、不正登録・不正 pivot で既存参照を維持した。除去後の通常描画はモデルのみと一致した。
- 参照更新の前後で、モデルファイルと Runtime Export の全 entry がバイト一致した。旧 workspace の通常描画と参照追加後の明示モデル単独も PNG がバイト一致した。
- 参照の虹彩上にある上まつ毛の黒い線がモデルより下に見えたため、右目上まつ毛に対応する key value 1 の制御点183を Y 方向へ +9 モデル単位動かした。出力の画像列 x=290 で、暗色境界はモデル y=130 から 144 px へ下がり、参照は y=178 px。差は縮んだが、34 px のずれと、変更箇所に局所的な折れが残った。モデルのみで 6,087 px、重ね合わせで 6,031 px に変化があり、変更域は両方とも出力 `[247, 102, 346, 180)`。r815→r816 の前後で、同一 viewport・パラメータ・opacity の参照単独 PNG はバイト一致した。

検証資料はリポジトリ内の `tmp/reference-overlay-wave1/` に保存した。

- [参照、r815、r816 の比較](../../../../tmp/reference-overlay-wave1/outputs/comparison-eye.png)
- [重ね合わせの前後比較](../../../../tmp/reference-overlay-wave1/outputs/comparison-eye-overlays.png)
- [広い viewport の三表示](../../../../tmp/reference-overlay-wave1/outputs/comparison-wide.png)
- [検証数値](../../../../tmp/reference-overlay-wave1/outputs/verification.json) と [CLI 再現手順](../../../../tmp/reference-overlay-wave1/reproduce.py)

## Wave 2 への引き継ぎ

Editor の画像選択、位置合わせ操作、固定した参照上での Rig 編集、pan/zoom、Undo/Redo、Save Workspace 復帰を接続して実 Electron で確認する。Editor の保存済み workspace を Host で再読込し、同じ参照の使用と両者の描画を照合する。本人の操作感・制作評価は [2 Wave計画 §2](../../orchestration/reference-image-overlay-wave-plan.md#2-accepted-user-gate) に基づく。
