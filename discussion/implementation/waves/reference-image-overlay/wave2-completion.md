# Wave 2 の完了記録

**Wave 2 の内部判定は合格。** 別コンテキストの Review-Sylph が契約・実装・対象試験・実 Electron・Host 比較・最終候補を照合した。操作感と造形の判断は本人確認を待つ。 [独立レビュー](../../reviews/reference-image-overlay/wave2.md) ・ [本人確認の手順](human-gate.md)

## Editor と Host の往復

- 中央 Canvas の `Reference Image` で登録・差替え・除去、三つの表示、透明度を操作できる。`Adjust Reference` の間に移動・四隅拡縮・回転・基準点の置き直し・数値調整を行う。`Done` 後は位置合わせを保持して Rig 編集に戻る。参照操作とモデル操作は共通の Undo/Redo 履歴に入る。
- `Save Workspace` で元 PNG を公開してから参照 JSON を切り替える。通常のモデル保存で未変更の参照を再公開しないため、Host が保存した参照を保持する。別のフォルダへの Create / Save As では現在の参照を保存し、参照なしの場合は宛先の古い参照を解除する。Editor と Host の双方で参照を変更した場合は最後の保存値を再開時に読む。
- 隔離した実 Electron で PNG 選択、位置合わせ、非中心 pivot の拡縮・回転、透明度と表示、pan/zoom、固定後の Rig ドラッグ、Undo、保存と同一セッションでの開き直しを確認した。独立した Electron セッションでも保存状態の再開、差替え・除去と Undo/Redo を確認した。Native の workspace 選択ダイアログは戻り値を隔離フォルダへ固定し、Editor UI の操作、preload/Main IPC、保存、PNG chooser は実経路を通した。 [通し検証](../../../../tmp/reference-overlay-wave2/editor-ui-result.json) ・ [再開検証](../../../../tmp/reference-overlay-wave2/editor-reopen-result.json)
- PNG は 1,167,815 bytes。overlay 45%、倍率 0.875、回転 2.4°、画像内の基準点 `(550,535)` から保存後のモデル座標を再計算すると `(969.00010,388.99995)`。GUI で保存した warp 編集は点183の Y 約 +9 のみで、参照 JSON はバイト一致した。Undo 後に保存した keyforms は編集前とバイト一致した。 [位置合わせ](../../../../tmp/reference-overlay-wave2/editor-adjustment.png) ・ [再開した画面](../../../../tmp/reference-overlay-wave2/editor-reopened.png)
- 別プロセスの Host CLI が Editor の r815 に保存した同じ PNG・変換・表示・opacity を読み取った。笑み `.7`、両目開き `1`、顔角度 `0`、viewport `(899,330,134,111)`、出力 536×444 を揃え、`rig_eye_r_open` の既存1Dキー値1で点183を Y +9、r815→r816 とした。前後で参照単独 PNG はバイト一致。モデル単独 6,087 px、overlay 6,030 px の変化はいずれも矩形 `[247,102,346,180)`。列 x=290、y=100–207 で RGB 各値が112未満となる最上端はモデル y=130→144、参照 y=178。上まつ毛に高さの差と局所的な折れが残った。 [参照・変更前・変更後](../../../../tmp/reference-overlay-wave2/host-outputs/comparison-eye.png) ・ [重ね合わせ](../../../../tmp/reference-overlay-wave2/host-outputs/comparison-eye-overlays.png) ・ [条件と差分](../../../../tmp/reference-overlay-wave2/host-outputs/verification.json)
- 1D / Grid2D の同順位を実 r815 で照合した。Host の Rig 評価はサンプリング後に並べ替えるため、笑み値 0 / .7 / 1 で対象の最終頂点は Editor と最大 5.69×10⁻¹⁴ モデル単位の差に収まった。評価順は既存処理を使用した。 [頂点比較](../../../../tmp/reference-overlay-wave2/evaluation.jsonl)
- 1264×735 の縦積みレイアウトでは各パネルの最低高を確保し、既存の縦スクロールで移動する。実 Electron で `Body Z` を Hierarchy から選び、Inspector と参照の回転ハンドルを確認した。 [Hierarchy](../../../../tmp/reference-overlay-wave2/editor-narrow-hierarchy.png) ・ [Inspector](../../../../tmp/reference-overlay-wave2/editor-narrow-inspector.png) ・ [位置合わせ](../../../../tmp/reference-overlay-wave2/editor-narrow-adjustment.png)

## 検査

- 最終 Editor の対象単体テスト 51/51 通過。
- Editor の型検査は23診断。全診断の対象ファイルと該当行は HEAD と同一。 [基点照合](../../../../tmp/reference-overlay-wave2/editor-typecheck-baseline.json)
- Editor 全体の単体実行は503件通過、4件スキップ、既存 `diagnostics-jump-actions.test.ts` が4件失敗。Wave 1 で記録した Host state-directory guard と Runtime Player のソース構成の既存失敗は [Wave 1 完了記録](wave1-completion.md#検査) を参照。
- PNG 書き込み失敗時に参照 JSON の切替へ進まないことはコードで確認した。OS レベルの意図的な書き込み障害は未実証。

## Windows 候補

保存の修正と狭幅レイアウトの修正を含む最終ソースから Windows x64 portable を生成した。隔離デスクトップで起動し、Editor 画面を確認した。パッケージ内の main・preload・renderer 計5ファイルが最終ビルドと SHA-256 一致した。候補 EXE は 94,690,490 bytes、SHA-256 `EDBC6F60FA6BE39DF03B9398A1D3B7CBCB035C3FE063A76A08B9206057A8FEC2`。 [最終 Editor 候補](<../../../../tmp/reference-overlay-wave2/candidate-final/Private 2D Rigging Lab 0.0.0.exe>) ・ [起動画面](../../../../tmp/reference-overlay-wave2/portable-smoke-final.png) ・ [ビルド照合](../../../../tmp/reference-overlay-wave2/candidate-build-integrity.json)
