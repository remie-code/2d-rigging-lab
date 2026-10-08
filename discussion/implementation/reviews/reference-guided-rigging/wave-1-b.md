# Wave 1 B 独立レビュー

判定: **PASS（人工fixtureによる比較ビュー基盤・契約接続の技術判定）**。
2026-09-25。Reviewer: Review-Sylph / /root/flow_wave1_b/review_viewer。
修正要求: なし（review loop 1）。実参照の対応品質、rig品質、Accepted User Gateは **pending / 未判定**。

## 対象・basis・独立性

- 計画: [optical-flow-wave-plan.md](../../../model-authoring/reference-guided-rigging/optical-flow-wave-plan.md) のWave 1 B、共通契約v1、root採用の境界補足。
- 関連basis: scope-and-decisions.md / deformer-transfer.md / motion-review.md（同上ディレクトリ）。
- 対象W: C:/workspace/remie/rigging/second-rigging-6-sol。
- sourceレビュー範囲: W/reference-generation/optical-flow/viewer/ と fixtures/viewer/。
- 追加接続確認: root指定の fixtures/compute/translation-v1/manifest.json と、それが参照する画像・fieldのブラウザー読み込み。
- Gnomeと別コンテキストでsource・fixture生成式・binary・testsを確認し、独自数値検証と専用cua_replタブでの操作を実施。Gnome報告を独立確認の代用にしていない。
- source・fixture・Aの環境・既存alignment/compare.htmlは変更していない。旧second-rigging-astraの成果物、git履歴は参照していない。書き込みは本報告のみ。

## 設計適合

契約v1に適合。flow.mjsのvalidateManifest/decodeFieldはschema、座標規約、kind、canvas、3 frame/field IDとペア、画像hash形式、binary bytes/shape、validity 0/1、little-endian float32を扱う。app.mjsのloaderで画像SHA-256と実サイズを照合し、asset URLはmanifest URL基準で解決する。valid=1非有限はロード失敗、valid=0非有限はサンプル時に停止する。

sampleはpixel-edge-centersの格子位置からcanvas px単位のdx,dyを補間し、traceはF12を移動先qで評価する。field密度が異なってもcanvas座標を介して扱う。画像範囲は[0,W)×[0,H)、外側は無効。最外中心と画像端の間だけ境界値延長。非ゼロ補間重みの全点にfiniteかつvalidity=1を要求する。

同一canvasへ原画像を即時描画し、crop・倍率・選択起点を保つ。画像間フェードやフローによるアニメーションはない。疎矢印・3点の経路・無効領域を全体/個別で切替可能。場の出発座標でoverlayを描く規則と、他frame表示中も正面起点を指定する規則を画面で説明している。

人工fixtureは画面上に「実参照の推定結果ではありません」と明示。成功時も「3点を追跡できる採用候補（正解保証なし）」で、validityを確率や意味的対応の正しさに読み替えていない。READMEでも実参照・rig・User Gate未判定を維持している。

## 試験適合と自分で実行した数値検証

実行cwdはW。

- 既存9試験を独立再実行: node --test --test-isolation=none reference-generation/optical-flow/viewer/flow.test.mjs → **9 pass / 0 fail**。通常のnode --testはsandboxの子process spawn EPERMで起動失敗したため、同一testをprocess isolationなしで実行した。失敗を製品不具合として扱っていない。
- reviewer独自のinline Node検証（ファイル変更なし）: canvas 300×200、6×4のF01=(-12,+8)、5×8のF12=(0.1x-3,-0.05y+2)。p=(145,95)→q=(133,103)→r=(143.3,99.85)を確認。異密度・非正方格子・負dx/正dy・途中評価を既存fixtureとは別の値で検証した。
- 4辺の画像外、NaN/Infinity入力位置を無効とし、(0,0)および最終画素内側は有効。重み0のNaN隣接を無視し、僅かな正重みになれば非有限として停止することを確認。
- B fixtureのf02全4,800格子中心で、隣接traceとの有効性一致と最終到達位置の誤差<1e-5を検証。**3,780候補 / 1,020無効、全点一致**。
- fixtures/viewer/generate.pyを読み、人工図形、既知affine画像変換、意図的invalid patch、f02が移動先のF12から生成されることを確認した。推定器や実参照画像は使っていない。

## 自分で確認したブラウザー結果

cua_replでcreateBrowserTabした専用IABタブのみ使用。既存alignmentタブとGnomeの成果タブは選択・操作していない。スクリーンショット、AX状態、DOM矩形の直接観測証跡はreviewer turnのcua tool出力にある。

B URL: http://127.0.0.1:8769/optical-flow/viewer/index.html

- 初期点(200,160)→(240,180)→(259.6,173.6)の3色経路と、表示frameの白輪を確認。f01は右下、f12は右上の矢印を目視した。
- 正面・中間・最大の原画像を切替。中央cropは全frameで{x:96,y:48,width:448,height:336}。検証viewportでcanvas DOM矩形はleft=35.5, top=275.9375, width=887, height=665.25のまま一致した。
- overlay offで原画像だけとなり、onで復帰。矢印・無効領域・経路を個別offとし、経路のみonのスクリーンショットも確認。
- crop画像の座標(200,160)相当をクリックすると(199.8,160.2)→(239.8,180.2)→(259.4,173.8)。UIクリックの画面整数丸め相当の差で、crop復元は整合。
- (350,180)は第1段で停止し、中間/最大を「追跡できません」と表示。(420,260)は中間(460,280)まで進んで第2段で停止。赤patchと停止箇所を目視した。
- manifest=../fixtures/viewer/not-found.json でHTTP404を可視表示し、操作群はinert・点指定はdisabled。
- loading_server.py --port 8771 --delay 8 --duration 90 を独立起動。8秒遅延中の「manifest・画像・フローを読み込み中…」、操作群非表示/inert、点指定disabledをAXで観測。ロード成功後の操作復帰と最大への切替も確認。localhost限定・自動終了server。

A互換URL: http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../fixtures/compute/translation-v1/manifest.json

- manifestと相対images/配下の3画像をロード成功。人工fixture表示を維持。
- f01=40×30、f12=80×60のmanifestを確認。正面/中間/最大とf01/f12/f02を実表示した。
- (100,80)→(112,76)→(120,82)で既知の(12,-4)、(8,6)と一致。
- invalid patchを横切る(128,84)→(140,80)は第2段で停止。中間frame上の赤patch、最大「追跡できません」を目視した。
- これは交換契約の接続確認であり、A推定器や実参照精度の評価ではない。

## 裁量判断・残課題

阻害する設計違反・誤表示は見つからなかった。以下はWave 1 Bの範囲を明示した制約として受容する。

- 赤maskは無効な格子セルを表示する。無効セルが補間に寄与する周辺全域を厳密な連続領域として塗るものではない。疎サンプルの×と選択点の停止判定、READMEの説明を併用する。
- cropは固定2段階、選択点は1つ。自由pan/任意cropはない。
- f02表示と隣接追跡の任意入力での全点一致はloaderで保証しない。本レビューでB fixtureの全格子中心一致を確認した。Aの生成整合性はA reviewの責任範囲。
- 背景上の矢印はforegroundや部位対応の証拠ではない。validityは曖昧さ・遮蔽・意味的誤対応をすべて検出するものではない。
- 実画像2048×3072の性能・実参照上の部位の追跡・候補の有用性はWave 2およびUser Gateで確認する。人工fixture技術passをユーザー合格へ自動継承しない。

## レビュー対象版

SHA-256（W/reference-generation/optical-flow/相対）:

| ファイル | SHA-256 |
| --- | --- |
| viewer/app.mjs | 735A4C2A3AF3289E33FBAF9046A241C9954CA7C00794CC9189DC4934DD5F7D3D |
| viewer/flow.mjs | AF3351A654E1233F1BF5EA2BB13CA51E8E3574B116F269F9AECE9D9350E29833 |
| viewer/flow.test.mjs | 46407F15C9EF5E5D56C1EE9C44D396B3B1D8CB061A5626EDB6A5F6CD2F0624BA |
| fixtures/viewer/manifest.json | 811DF4FCAD55ED24D5C57A54B1C39C0ADCED9A8617513B589E2B3AFCFD65B8ED |
| fixtures/compute/translation-v1/manifest.json | 0C04701E09C2C47D3689DBEB375F711BDAE413F81A8B6159B8ED72A7447B7A33 |

