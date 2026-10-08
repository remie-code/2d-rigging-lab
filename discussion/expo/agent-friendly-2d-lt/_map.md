# エージェントフレンドリーな2Dモデリングシステム LT

7分のVRChat LT用。既存の展示ポスターを参考に、発表用資料を別原稿として管理する。

| ファイル | 内容 | 状態 |
|---|---|---|
| [export/README.md](export/README.md) | UnaSlides用MP4・PDFへのリンク、会場設定、検証記録 | ローカル出力済み、未アップロード |
| [build-unaslides.py](build-unaslides.py) | 承認済み5枚のプレビューからMP4とPDFを再出力 | 検証済み |
| [slides-overview.html](slides-overview.html) | 保存済みプレビュー5枚を発表順に並べた一覧。画像をクリックして拡大 | 確認用 |
| [slide-design.md](slide-design.md) | ユーザー合意、共通ベース、未決事項 | 5枚の見た目と全体の流れをユーザー確認済み |
| [source-facts.md](source-facts.md) | リポジトリ根拠とUnaSlidesの公式資料 | 記録済み |
| [00-cover.html](00-cover.html) | タイトルの表紙（アーカイブQRは公開版で削除） | 見た目をユーザー確認済み |
| [01-overview.html](01-overview.html) | 本編1枚目「今回開発したもの」 | 見た目をユーザー確認済み |
| [01-overview-preview.png](01-overview-preview.png) | 1600×900でブラウザ描画した確認用画像 | 原稿に対応 |
| [02-modeling-tools.html](02-modeling-tools.html) | 本編A。人間用GUIとエージェント用CLIのスクリーンショット | 見た目をユーザー確認済み |
| [02-modeling-tools-preview.png](02-modeling-tools-preview.png) | 本編Aの1600×900確認画像 | 原稿に対応 |
| [03-streaming-tools.html](03-streaming-tools.html) | 本編B。Player・AI会話行動システムとモデル表示例 | 見た目をユーザー確認済み |
| [03-streaming-tools-preview.png](03-streaming-tools-preview.png) | 本編Bの1600×900確認画像 | 見た目をユーザー確認済み |
| [04-development-duration.html](04-development-duration.html) | 本編C。来客の関心と約2週間の開発期間をオチにする最終スライド | 見た目をユーザー確認済み |
| [04-development-duration-preview.png](04-development-duration-preview.png) | 本編Cの1600×900確認画像 | 見た目をユーザー確認済み |
| [slide-theme.css](slide-theme.css) | 全本編で再利用する余白・タイトル・下線・印刷設定 | Draft |
| [assets/](assets/_map.md) | 編集可能なSVG図と外部ツールのアイコン | Draft |

UnaSlides用のローカルMP4と確認用PDFを出力済み。

公開リポジトリには、アーカイブQRを含むファイル（`assets/archive-qr.png`、`00-cover-preview.png`、`slides-overview.png`、出力したMP4とPDF）を含めていない。次は動画の配置と会場での確認。開催イベント名・日付は未確認。
