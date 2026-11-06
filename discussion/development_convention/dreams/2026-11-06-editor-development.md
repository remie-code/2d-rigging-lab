# Editorの現在地: 計画停止と、その後の実装をつなぐ夢

2026-11-06。問いは「Editorの開発はどこまで進んでいる？」。開始cleanは呼び出し元が確認。入口は [全体地図](../../_map.md) → [implementation](../../implementation/_map.md)。今回の編集・調査はこの問いに限定し、コードと履歴本文は変更していない。

## 観測と直した理由

従来の地図はWave102の計画停止とW103–109の専門領域を区別していたが、利用者の作業へ翻訳する道が薄く、番号外の仕事や最近の修正を見落としやすかった。implementation地図に「取り込み→構造・メッシュ・rig/keyform編集→保存→Viewer→Atlas/Variant/export」の問い別入口を加え、全体地図から案内した。ここでいう機能はリンク先の過去の実装・レビュー証拠であり、今回の現HEADの全機能認証ではない。

- [W58–60](../../implementation/_map.md) はPSD取込・Canvas表示・構造編集、W62–78はmesh/deformer/parameter/keyform・保存復元、W79–84はViewer/dynamics、W99–102はVariant/Atlas/exportの端点として選んだ。全Waveの本文精読はせず、親索引と代表のleaf mapを照合した。
- [W102](../../implementation/waves/wave102/_map.md) はexportの`baseVisible`/`visible`を分ける基盤のpass。これはmainline計画の停止点であり、「Editor全体が完成」「以後ソース変更なし」の証明ではない。
- 番号外では [mesh](../../mesh-generation/_map.md) はv6D default + v7比較、品質は一長一短でhold。[performance](../../render-performance/_map.md) はPerf Wave2をユーザーが実モデルで十分と受け入れてclose。[Electron](../../editor-electron-migration/_map.md) はWS1–4とpackaging完了。Git `2a92ca6d` / `e0fec737` / `81423d28` / `5bf35d02` / `305abd38` / `ecc3d8ce` がそれぞれのEditor変更を示す。
- `git log -- apps/editor` の最近の変更も照合した。`d6d99010` (2026-09-08) はgrid keyformとkeyed scaleをCanvasで評価する修正。差分と現在の [parameter-keyform-state.ts](../../../apps/editor/src/features/editor-session/model/parameter-keyform-state.ts)、[canvas-evaluation.ts](../../../apps/editor/src/workspace/canvas/canvas-evaluation.ts) の対応を確認した。`a2267e91` (2026-10-20) は操作ログ撤去の横断変更で、Editor差分自体はAtlasテストの期待値変更。コミット本文の速度数値は今回追試していない。

## 確認できた範囲と残り

地図、代表の完了索引、関連Git履歴/差分、Canvas評価の該当ソースを読んだ。起動、PSD取込、保存復元、配布exe、全テストは今回実行していない。ElectronのPSD E2E前提・独立typecheck/unit・dead branch・metadata warning、mesh/renderの実機/GPU/pixel gates、Runtime Playerの実機/OBS gatesは各topicが所有し、今回解消した扱いにしない。過去のpassと現在の負債も相殺しない。

次の自然な問いは「いまElectron EditorでPSDから保存・再開まで通るか」。これは今回の記憶整理とは別の実行検証になる。

呼び出し元が初見のSolシルフへ最上位入口と問いだけを渡した独立読み直しでは、利用者ができることと計画停止後の進展の両面を復元できた。一方、implementation地図末尾にAtlas UI/packingとVariant Managerを未実装扱いする古い一括除外が残ると指摘された。W99–102の完了記録・残債と照合してこの除外を修正し、Manager/Canvas・Viewer内切替・Skyline packing・export基盤の実装証拠と、browser visual/E2E未実施・外部Player切替の別境界を明記した。他の古い除外も後続topicへ照会する案内とし、現在のElectron filesystem保存などと混同しないようにした。コミットは呼び出し元が扱う。
