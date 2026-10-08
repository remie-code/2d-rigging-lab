# 根拠と外部仕様

## リポジトリの説明資料

- [既存展示の出典](../genai-expo-2026/source-facts.md) §§1–3：AIはEditor GUIではなくauthoring-hostでモデルを編集する。2026年7月の資料として扱い、全機能の最新進捗とは混同しない。
- [Runtime Player](../../runtime-player/_map.md)：モデル実行、トラッキング、OBS向け出力の説明の入口。
- [Soul README](../../../apps/soul/README.md)：AI会話・行動側の領域。

全体図はユーザーと合意した紹介用の概念図で、通信プロトコルや全入出力の網羅図ではない。

## 公式事実（2026-10-04閲覧）

- [UnaSlides利用ガイド](https://note.com/uezo/n/n8626546391fc)：URLの動画をロードし、一定の時間間隔でシークしてスライドを表示。PDFから動画への変換手順を掲載。記事には古い版の仕様もある。
- [配布ページ](https://booth.pm/ja/items/4141632)：v0.9の履歴では既定オフセット0.5秒。既定の割当は1スライド1秒。
- [作者の表示ずれ調査](https://note.com/uezo/n/n5453f8efc5fd)：動画エンコードの影響とBフレーム無効化等の対策を記録。

会場の設定と、作成物がその会場で正しく表示されるかは未検証。

## 素材出典

- OBS / YouTube：Simple Icons配信のSVG（https://cdn.simpleicons.org/obsstudio 、https://cdn.simpleicons.org/youtube）。外部ツールの識別用。ダウンロードした原本をassetsに保存。
- 画像素材アイコン：本スライド用のシンプルな線図。system-overview.svg内で編集可能。
- 現在のOBS / YouTubeアイコンはユーザー指示による画像生成版。公式配布のロゴ原本ではない。生成記録は [assets/image-generation.md](assets/image-generation.md)。以前のSVGは保持し、現在の図では使用しない。
- Editorスクリーンショット：ユーザー添付 `codex-clipboard-5d176666-7ce3-42f5-b324-1124072497fa.png`。変更せず `assets/editor-gui.png` にコピー。
- Codexスクリーンショット：ユーザー添付 `codex-clipboard-aa03ef95-e060-4e03-813b-ba23bddd8cc8.png`。変更せず `assets/codex-modeling.png` にコピー。表示されているのはCodexの会話・結果確認画面で、CLIそのものの画面ではない。

## ユーザー提供情報

- 会場ではLive2Dより開発期間に興味を持つ来客の方が多かったというユーザーの体験。本編Cのオチとして扱い、来客数や割合の数値は追加しない。

- 本編Bの画像はユーザー添付原本をコピーして使用。`codex-clipboard-03468e8b-63e9-4c20-b401-3afc344917b2.png` → `assets/runtime-player.png`、`codex-clipboard-9945e7af-6c08-4782-83f4-9a921fa94239.png` → `assets/runtime-model.png`、`codex-clipboard-0945fa21-d149-4edb-ad2a-876795b2856a.png` → `assets/ai-conversation-settings.png`。モデル表示例は静止画であり、このスライド自体に動画は含まない。

- 開発期間はおおよそ2週間。本編1への掲載指示あり（2026-10-04）。これはユーザーの説明であり、この作業でGit履歴等から独立検証した期間ではない。
- アーカイブQR：添付画像 `codex-clipboard-07a4436d-e917-4e22-bd7b-b648d63c3a41.png` を `assets/archive-qr.png` に変更せずコピーした。
- QRの読取値：`https://www.youtube.com/live/VJUSIcgnCmM`。原画像と表紙の描画画像から同じURLを読み取った。動画内容や公開状態はこの作業では検証していない。
