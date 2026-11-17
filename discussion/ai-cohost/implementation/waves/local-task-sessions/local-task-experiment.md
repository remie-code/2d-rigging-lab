# Windowsのローカル小タスク実験

[実装計画](../../orchestration/local-task-sessions-wave-plan.md) · [前段のPDF実験](../discord-companion-inputs/pdf-path-experiment.md)

## 担当のファイル権限

製品同梱の Codex App Server 0.163.0 の `command/exec` を使い、合成資料の原本と別担当の作業先を同じ場に置いた。`workspaceWrite` の `writableRoots` にその担当専用の作業先だけを指定し、`excludeTmpdirEnvVar: true`、`excludeSlashTmp: true`、`networkAccess: false` を指定した。

| 操作 | Windows での観測 |
| --- | --- |
| 自分の作業先へ `Set-Content` | 成功 |
| 合成の資料原本を読む | 成功 |
| 原本、別担当の作業先、共有一時フォルダに書く | アクセス拒否 |
| `writableRoots` が空のとき自分の作業先に書く | アクセス拒否 |
| 共有一時フォルダの除外を外し原本、別担当の作業先、共有一時フォルダに書く | 合成領域への書き込みが成功 |

再測定では、先行担当が書き込みに成功した個別作業先を次の担当から上書きしようとすると拒否された。合成の永続記憶領域への書き込みも拒否された。共有一時フォルダを許可した対照条件では、4か所とも書き込めた。

Desktopの外側プロセスに付く Windows 登録情報2件が残った条件では、前段と同じ package identity エラーが生じた。通常相当の起動では、担当の PowerShell が ConstrainedLanguage で動き、WinRT API の直接呼び出しを拒否した。この条件を踏まえ、場発行の資料参照とページ指定を受け取る読み取り用の道具として WinRT を使う。

## 実モデルによるPDFの確認

最初の試行では担当が専用の作業先へ結果を書いて読み直したものの、文字PDFと画像PDFの識別子は両方とも不正答だった。所要時間は71.9秒。Windowsホストで同じレンダラーから両PDFのページ画像を生成できたことを踏まえ、以降は資料の指定ページを場の領域へPNGとして書き、担当が `view_image` で開く経路を使った。小さな自作字形の画像PDFは字形改善後も誤読したため、画像PDFの合成データにWindows標準のConsolasで描画したJPEGを埋め込んだ。

`node apps/soul/agent/scripts/probe-local-task.mjs` を通常起動相当のWindowsプロセスで実行した。Desktop由来のWindows登録情報2件は、この試験プロセスの環境から除いた。同梱のCodex App Server 0.163.0とGPT-5.6 Terraを使用し、二つの試行は別のthreadと作業先を使用した。

| PDF | 対象ページ | 読み取った識別子 | 所要時間 | 合成PDFの SHA-256 |
| --- | --- | --- | --- | --- |
| 文字 | 4 | `A9EAF229F2C2` | 19,012 ms | `ba13f1fdc8ae58391993e7302c86b3456ceebfe2af74fd0fdf6f33afead662e4` |
| 画像のみ | 5 | `47AEAEAE5AF5` | 19,489 ms | `6423cd5c7a12e243e9a866d83b086e3fb5066ee3b3657b330a8d3fff2621209e` |

両方の原本に識別子そのものの連続バイト列がないことを確認した。各担当から `render_venue_pdf_page` の呼び出しと `imageView` の通知を観測し、専用作業先に正答を含む `result.txt` が生成された。文字PDFの `Set-Content` と、両方の `Get-Content` は終了コード0だった。

隔離したCockpitの既定ロール `chappy` と同じ GPT-6.1 Sol、推論設定 `low` でも新規セッション二つで追試した。両方で指定ページの呼び出しと画像表示を観測した。.NET の書込コマンドは失敗したが、担当が `Set-Content` と `Get-Content` を使い、専用作業先の成果物と最終返答に同じ正答が入った。

| PDF | 対象ページ | 読み取った識別子 | 所要時間 | 合成PDFの SHA-256 |
| --- | --- | --- | --- | --- |
| 文字 | 4 | `32223749979E` | 22,123 ms | `f70066aeb0608e5aa8f089bbcc5547aabfeabbb243d5408e412976a88ff55586` |
| 画像のみ | 5 | `FA29FF57CA3C` | 25,246 ms | `5df9c13c38732e03dbefce0a825133f582aa68de1897f1d3beccf54205a64499` |

## Cockpit の起動と会話の接続

設定、環境のプライベートデータ、一時フォルダを隔離したコピーで `npm run cockpit --prefix apps/soul/agent -- --port 0` を起動した。ループバックの `/` と `/api/state` が200、場が閉じているときの `/api/discord/chat` が409を返し、標準入力の EOF で終了コード0となった。

合成Discord入力の接続試験では、Discord Gateway から通常の Fire と共通実行口を通した。テスト用の担当が処理中にも主会話が進み、担当の返答を別の Fire が受け取った。実モデル試行は上記の製品と同じ担当・道具を使う probe で行った。本人の実Discordと会話は未確認。
