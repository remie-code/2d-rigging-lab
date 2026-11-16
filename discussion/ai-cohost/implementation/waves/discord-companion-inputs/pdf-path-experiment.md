# 合成PDFの読取実験

通常のCockpitと同じSoulの `BRAINS` にある Codex App Server 0.163.0 / GPT-5.6 Terra を使った。文中の識別子を推測できない1ページの文字PDFと、可視内容を画像だけで持つ1ページのPDFを生成し、実資料と既存会話から隔離した。Codexの各試行は専用の一時cwdを使う使い捨てthreadで、`read-only`、`approvalPolicy: never`、ツールの `networkAccess: false` を維持した。

## 絶対パスで読む

最初の実行では外側の作業サンドボックスでApp ServerのSQLite初期化が拒否された。承認後は外側の起動を通常のターミナル相当にしてApp Serverへ接続できた。内側の制約は同じで、Codex Desktopが外側プロセスに注入した環境変数が残った条件では、ツールに `registered Core process has no package identity` が出た。モデルの返答は両方とも読み取れなかった旨だった。

| 合成PDF | `turn/start` 応答 | TTFT | ask全体 |
| --- | ---: | ---: | ---: |
| 文字 | 1,359 ms | 3,807 ms | 10,726 ms |
| 画像のみ | 678 ms | 3,863 ms | 11,377 ms |

起動時にDesktopが付けた `CODEX_WINDOWS_REGISTERED_CORE` と `CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY` を実験プロセスの環境から除いて比較すると、内側の同じポリシーでShellと指定パスのアクセスが成功した。`pdftotext` は見つからず、非圧縮の文字PDFでは `Get-Content -Raw` でバイト列を読み、`Select-String` で該当行を取り出して正答した。この経路で確認したのは直接検索できるPDFに限られる。画像のみではパスから正答できなかった。

画像のみのPDFに対して、実験機にある `pdftoppm` の絶対パスを候補の読み取りツールとして渡した。内側でコマンドは起動したが、一時cwdへのPNG書き出しに失敗して終了コード1となった。`view_image` まで到達しなかった。

| Desktopの起動識別子を除いた試行 | `turn/start` 応答 | TTFT | ask全体 |
| --- | ---: | ---: | ---: |
| 文字、バイト列から正答 | 575 ms | 3,866 ms | 24,994 ms |
| 画像のみ、既存コマンドを探索 | 571 ms | 3,753 ms | 13,502 ms |
| 画像のみ、Popplerの絶対パス指定 | 991 ms | 3,726 ms | 12,091 ms |

## 既存画像入力で読む

App Serverの外でPopplerを使ってページを描画し、通常のS5と同じ画像ブロックを渡した。どちらも識別子に正答した。

| 合成PDF | 事前描画 | TTFT | ask全体 |
| --- | ---: | ---: | ---: |
| 文字 | 85 ms | 3,363 ms | 3,555 ms |
| 画像のみ | 51 ms | 4,489 ms | 4,660 ms |

通常のWindowsのマシン・ユーザーPATHに `pdftoppm`、`pdftotext`、`pdfinfo`、`tesseract` はなかった。実験用のPopplerはCodex Desktopが提供するディレクトリにあった。Windows標準の `Windows.Data.Pdf` へ通常の.NETファイルストリームを渡した描画も成功した。画像のみの同じfixtureの先頭ページが幅1,536 px、23,781 bytesのPNGとして得られ、WinRTの処理時間は250 msだった。PowerShellの起動時間はこの250 msに含めていない。`StorageFile.GetFileFromPathAsync` は作業サンドボックスでアクセスを拒否された。

実装したNodeの描画口から同じ2件を描画できた。1ページ目のPNGは文字PDFが15,515 bytes、画像のみのPDFが23,781 bytes。Windows PowerShell起動込みの初回計測はそれぞれ690 msと662 msだった。

続けて製品の `renderDiscordPdf()` の出力を `BRAINS.codex` に渡した。実際のApp Serverが `localImage` を処理し、文字PDFの `E14AADF5B744` と画像のみPDFの `2E79ED1CBC7B` に正答した。内側のread-only・approval never・network access無効は維持した。

| 合成PDF | 製品の描画処理 | TTFT | ask全体 |
| --- | ---: | ---: | ---: |
| 文字 | 547 ms | 3,894 ms | 4,148 ms |
| 画像のみ | 532 ms | 4,247 ms | 4,383 ms |

描画処理はPowerShell起動を含む。TTFTとask全体は専用セッションの起動を含み、描画時間を含まない。

## Claude SDKのdocument入力

既存と同じ `BRAINS.claude` / Claude Opus 4.8 にPDFのbase64 `document` ブロックを渡した。文字4,673 ms、画像のみ3,951 msで、どちらも既存OAuthセッションの期限切れと更新失敗で終了した。外側の作業sandboxの外でも同じエラー（文字881 ms、画像のみ867 ms）だった。TTFTおよびモデルによる読み取りは未測定。別の認証方式の追加は行っていない。

TTFTは `ask` 開始から最初のテキストdeltaまで。ask全体は `ask` 開始から完了までで、初回の接続を含む。各測定は単発の合成資料試行であり、Discord添付の取得、音声発話、読み上げを含まない。
