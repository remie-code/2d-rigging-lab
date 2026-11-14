# 参照画像表示 Wave 2 独立レビュー

[Wave 2 の実装根拠](../../waves/reference-image-overlay/wave2-basis.md) と [Editor / Host の共有契約](../../waves/reference-image-overlay/wave1-contract.md) を基準に確認した。**Wave 2 の内部判定は合格。** 作業感と造形は [User Gate](../../orchestration/reference-image-overlay-wave-plan.md#2-accepted-user-gate) で本人が確認する。

## 実装と契約

- Canvas は共有の座標演算を使う。pivot の再指定は画像座標の値だけを更新する。拡縮と回転は、その点のモデル座標を固定する。画像とモデルに同じ pan/zoom を適用し、参照の元 alpha と指定 opacity を合成する。三表示で変換と opacity を共有し、調整中は Rig の Canvas 操作を抑止する。**Done** 後、モデルが見える表示では既存の Rig 操作に戻る。 [Canvas のジェスチャー](../../../../apps/editor/src/workspace/canvas/canvas-reference-image.ts)、[描画](../../../../apps/editor/src/workspace/canvas/canvas-renderer.ts)、[Canvas 操作](../../../../apps/editor/src/workspace/panels/canvas-preview-panel.tsx)
- 参照と Rig の編集は共通の Undo / Redo に記録する。通常 Save は参照変更時だけ参照のファイルを更新し、モデルだけの保存では Host が更新した参照を保持する。変更した PNG を先に公開し、次に参照 JSON を切り替える。Electron の各ファイル書き込みは一時ファイルからの rename を使う。Editor 内の通常 Save は直列化され、保存開始後に加えた編集は未保存として残る。Create / Save As では参照なしも明示する。 [セッションと履歴](../../../../apps/editor/src/features/editor-session/editor-session-context.tsx)、[workspace 保存](../../../../apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts)、[Electron ファイル書込](../../../../apps/editor/src/main/workspace-fs/workspace-fs-store.ts)
- 参照はモデルグラフや Runtime Export 用アセットに入らない。通常 Save は既存のモデル保存も行い、参照編集のみでモデル版は進まない。Electron から保存した参照を Host が読む。Host が更新した設定は Editor を開き直すと読める。双方が参照を変更した場合は最後に公開された JSON が残る。 [Editor 操作手順](../../../../apps/editor/reference-image.md)
- 同順位の 1D replace と Grid2D additiveDelta を確認した。Host は snapshot の sampling 後に Rig サンプルを同じ compositionOrder と keyformSetId で整列する。r815 の対象まつ毛を両目 open=1、笑み 0 / 0.7 / 1 で独立実行し、Canvas / Host の対応頂点の最大距離はすべて約 5.68 × 10⁻¹⁴ モデル単位だった。評価順への変更は入っていない。 [Host Rig 評価](../../../../packages/runtime-core/src/rig-control-evaluation.ts)、[比較スクリプト](../../../../tmp/reference-overlay-wave2/evaluation.mjs)、[比較結果](../../../../tmp/reference-overlay-wave2/evaluation.jsonl)

## テスト

- 独立実行では履歴・保存・参照ジェスチャー・Canvas 描画・Canvas 評価の 5 ファイル 74 件が通過した。非中心 pivot の再指定と各隅の拡縮、回転、PNG の保存再開、保存途中の後続編集、通常 Save での Host 参照保持を含む。Host 参照専用 1 件、root 型検査、依存関係と Soul 境界の検査も通過した。
- 最終差分で Editor 全体を独立実行し、503 件通過、4 件 skip、4 件失敗だった。4 件は HEAD 差分のない diagnostics jump のテストで、旧 UI の `import` を期待するのに対し実装は `workspace` を返す。Editor 型検査の 23 診断は対象ファイルと診断行が HEAD と一致する。source organization は既存 Runtime の `physiology/index.ts` を報告した。 [Editor 型診断と HEAD の照合](../../../../tmp/reference-overlay-wave2/editor-typecheck-baseline.json)

## 実 Electron と Host

- 隔離 r815 コピーを実 Electron の Open UI から開いた。検証は非表示の隔離ウィンドウで、ネイティブフォルダ選択結果だけをコピー先に固定した。PNG chooser、キーボード、ポインター、preload / main の保存経路を通った。参照の移動、pivot 指定、角ハンドルによる拡縮、回転ハンドルと数値入力、三表示と 45% opacity、ホイールと中ボタン・Space ドラッグを確認した。保存値から再計算したモデル座標の pivot は (969.000097, 388.999948) で、指定した (969, 389) と一致する。 [通し試験](../../../../tmp/reference-overlay-wave2/editor-ui.mjs)、[実測値](../../../../tmp/reference-overlay-wave2/editor-ui-result.json)、[位置合わせ画面](../../../../tmp/reference-overlay-wave2/editor-adjustment.png)
- 固定後の Rig 編集は既存の右目 1D キーで、点 183 の Y だけが約 +9 変わった。保存前後で参照 JSON は一致した。Undo と再保存で keyforms は変更前とバイト一致し、同一セッションで workspace を開き直した後も参照が戻った。別 Electron セッションでも 0.875 倍、+2.4°、Overlay 45% の復元、画像の差替え・解除と Undo / Redo、未保存状態のディスク不変を確認した。 [編集画面](../../../../tmp/reference-overlay-wave2/editor-rig-edited.png)、[再開画面](../../../../tmp/reference-overlay-wave2/editor-reopened.png)、[別セッションの結果](../../../../tmp/reference-overlay-wave2/editor-reopen-result.json)
- 狭幅 1264×735 では、縦積みの各パネルに高さを確保して全体をスクロールする。検証した Canvas 描画領域は 316 px、Hierarchy は 160 px。狭幅の実画面で四隅・回転・pivot が見え、Hierarchy で選んだ Body Z の Inspector を縦スクロールで表示できた。広幅の可変 split は従来の分岐を使用する。 [狭幅の位置合わせ](../../../../tmp/reference-overlay-wave2/editor-narrow-adjustment.png)、[Hierarchy](../../../../tmp/reference-overlay-wave2/editor-narrow-hierarchy.png)、[Inspector](../../../../tmp/reference-overlay-wave2/editor-narrow-inspector.png)
- 別プロセスの Host CLI は Editor が保存した PNG 識別情報、変換、opacity を読み取った。比較画像の sidecar 6 枚でモデル版は前 r815、後 r816。パラメータは笑み 0.7、左右の目 1、顔角度 X / Y 0。viewport (899, 330, 134, 111) と出力 536×444 は全枚一致した。参照単独 PNG は編集前後でバイト一致した。Host による変更も右目 1D キーの点 183 の Y +9 の一件と独立に照合した。 [比較の測定値](../../../../tmp/reference-overlay-wave2/host-outputs/verification.json)
- 比較画面では右目上まつ毛の暗い輪郭が局所的に下がる。出力 x=290、y=100〜207 を上から走査し、RGB の全チャネルが 112 未満になる最初の画素は r815 で y=130、r816 で y=144、参照で y=178。ここでは差が縮まり、モデル輪郭に中央の折れと高さの差が残る。 [参照・変更前・変更後](../../../../tmp/reference-overlay-wave2/host-outputs/comparison-eye.png)、[重ね合わせ前後](../../../../tmp/reference-overlay-wave2/host-outputs/comparison-eye-overlays.png)

## 起動候補と検証範囲

- 最終 Windows x64 portable を隔離デスクトップで起動し、Open Workspace 入口まで確認した。実 Electron 試験に使ったビルド出力と、候補用 app.asar 内の main、preload、renderer 3 ファイルの SHA-256 を照合した。最終 exe は 94,690,490 bytes、SHA-256 `EDBC6F60FA6BE39DF03B9398A1D3B7CBCB035C3FE063A76A08B9206057A8FEC2` を独立に確認した。 [最終候補](<../../../../tmp/reference-overlay-wave2/candidate-final/Private 2D Rigging Lab 0.0.0.exe>)、[起動画面](../../../../tmp/reference-overlay-wave2/portable-smoke-final.png)、[格納ファイル照合](../../../../tmp/reference-overlay-wave2/candidate-build-integrity.json)
- 参照 PNG の書き込み失敗時に参照 JSON の公開へ進まないことはコードで確認した。OS レベルで意図的に書き込みを失敗させる実 Electron 試験は今回の実証に含まれない。モデルファイルと参照は個別に保存する。
