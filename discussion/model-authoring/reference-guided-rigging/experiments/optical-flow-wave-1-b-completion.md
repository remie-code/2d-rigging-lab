# Wave 1 B completion: 比較ビュー基盤

状態: **内部verification完了・独立review合格**。人工fixtureによる技術確認。実参照の対応品質・rig品質・Accepted User Gateは **pending**。

## Basisと分担

- 計画: [optical-flow-wave-plan.md](../optical-flow-wave-plan.md)。共通契約v1と確定した境界補足を適用。
- 作業root: `C:/workspace/remie/rigging/second-rigging-6-sol`。
- Orch-Sylphはsourceを書かず、Gnomeが実装、別コンテキストのReview-Sylphがbasis/source/fixture/試験/実browserを独立確認。1 review loop、阻害指摘なし。実装中の無効maskキャッシュ改善も最終review対象。
- 所有: `reference-generation/optical-flow/viewer/` と `reference-generation/optical-flow/fixtures/viewer/`。既存alignmentビュー、承認済み画像、Aの計算基盤・venvは変更していない。
- 独立review: [wave-1-b.md](../../../implementation/reviews/reference-guided-rigging/wave-1-b.md)。地図登録はrootへ依頼。

## 受け取れる具体物

- 比較URL: <http://127.0.0.1:8769/optical-flow/viewer/index.html>
- B fixtureを明示: <http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../fixtures/viewer/manifest.json>
- A fixture接続確認: <http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../fixtures/compute/translation-v1/manifest.json>
- 起動/操作/再検証: `C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/viewer/README.md`。

同位置・倍率で正面/中間/最大を即時切替。共通crop、1点の隣接2段経路、疎な矢印、不確実/無効領域、全体/個別overlay切替を提供する。画面上で人工fixtureと明示し、採用候補は正解保証ではないと説明する。アニメーション補間は行わない。

manifest queryはviewer URL相対、画像/field参照はmanifest URL相対。schema・frame/field順序・サイズ・画像SHA-256・raw byte数・validity値・finiteを検証し、読込中/失敗を表示する。取得はno-store。field格子密度が異なってもcanvas pxで扱う。

## 実装artifact

`viewer/`: `index.html`, `style.css`, `app.mjs`, `flow.mjs`, `flow.test.mjs`, `loading_server.py`, `README.md`。

`fixtures/viewer/`: `generate.py`, `manifest.json`, `neutral.png`, `midpoint.png`, `endpoint.png`, `f01/f12/f02.f32`, `f01/f12/f02.u8`。

vanilla HTML/CSS/ES modules。人工fixture生成は既存Python/Pillow、試験はNode。AのPython環境や重みを使用しない。

## 内部verification

Gnome: Node 9/9 pass、app syntax check pass。Review-Sylphはsandboxのchild-process EPERMを避け `--test-isolation=none` で同じ9件を独立実行し9/9 pass。

独立追加検証: 非正方canvas/異密度格子、負dx・正dy、F12を途中qで評価する合成、4辺exclusive、NaN/Infinity、重み0の隣接非有限値、fixture全4,800格子点でtraceとf02が一致（採用候補3,780/無効1,020）。境界は0<=x<W, 0<=y<H、画像外は無効。canvas内最外半セルだけ境界値延長し、非ゼロ寄与点すべてfiniteかつvalidity=1を必要とする。

実browserは両担当ともcua_replの専用tabで操作し、既存ユーザーのalignment/compare.htmlには干渉していない。独立reviewが以下を再確認した。

- B既知点 `(200,160) → (240,180) → (259.6,173.6)`。空間変化するf12を経由して追跡。
- 第1区間invalid `(350,180)`、第2区間invalid `(420,260) → (460,280)` で経路停止。
- 即時切替、共通crop、同じ表示矩形、cropクリック座標復元、全体/個別overlay。
- HTTP404の可視エラー、8秒遅延中のloading/操作無効から成功/操作可能への遷移。
- A製translation-v1がqueryでロード成功。3画像、f01/f12/f02、異密度40x30/80x60、既知点 `(100,80) → (112,76) → (120,82)` と、`(128,84) → (140,80)` の第2区間停止・赤patchを確認。

スクリーンショットとAXの生証跡は各担当のcua tool出力。再現可能なコマンドと期待値はviewer README、独立観測と最終版hashはreview reportに記録。loading用一時serverは時間制限付き。既存8769配信は継続利用。

## 制約とWave 2へ渡す事項

- 共通cropは全体/中央70%の2種類、選択点は1つ。自由pan/任意cropは未実装。
- 赤は無効なfield格子セルの表示。隣接invalidが補間へ寄与する場合は、赤の外でも経路停止する。赤なし・validity=1は正しさの保証ではない。
- 矢印/無効領域は選択fieldの出発画像座標。frame切替ではfieldを自動変更しない。UIの場選択・説明に従って観察する。
- f02の全点一致はloaderでは検査しない。点経路はf01→f12を直接追う。人工fixtureの一致は独立検証済み。
- foreground/遮蔽/描き変わりの判定はこのviewerが生成するものではない。背景の矢印に部位対応の意味を付けない。
- A/B接続は人工fixtureで確認済み。2048×3072実参照での性能・実推定の対応品質・部位観察・入力manifestはWave 2で確認する。
- rootの実参照画像観察と、ユーザーによるAccepted User Gateは未実施。内部passを見た目の承認へ継承しない。格子工程は自動開始しない。
