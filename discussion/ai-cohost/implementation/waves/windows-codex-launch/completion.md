# WindowsでのCodex起動と小タスクの実機検証

[合意済みの計画](../../orchestration/windows-codex-launch-wave-plan.md) · [独立レビュー](../../reviews/windows-codex-launch/review.md)

WindowsのCodex Desktopから登録情報を引き継いだ環境で、製品の小タスク実行口から同梱npm版のCodex App Server 0.163.0を起動した。`resolveWriterBrainDef('codex-61-sol')` から `runLocalTask`、場の担当領域、`createCodexSession` を通り、GPT-6.1 Sol（`low`）で実行した。起動の観測用ラッパーは製品から渡された子環境をそのまま `spawn` に渡した。セッション作成時に実行ファイル、環境、CORE除外条件を同時に確定する修正を加えたあとも、同じ経路で実機検証に成功した。

親では `CODEX_WINDOWS_REGISTERED_CORE=1` と `CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY` を継承していた。子にはCOREがなく、FAMILYは親と同じ値だった。処理後も親の両変数が残っていた。

実際の `turn/start` は `approvalPolicy: never`、`workspaceWrite`、`networkAccess: false`、`excludeTmpdirEnvVar: true`、`excludeSlashTmp: true` で、`writableRoots` には担当の cwd だけが入っていた。PowerShellによる合成資料の操作を観測し、処理後のファイルをホスト側でも照合した。

| 操作 | 実機での観測 |
| --- | --- |
| 合成資料の原本を読む | 成功。合成識別子を取得 |
| 自分の作業先に `result.txt` を書き、読み直す | 成功。ホストからも同じ識別子を確認 |
| 合成資料の原本に書き込む | アクセス拒否。ホストでバイト列が同一 |
| 先行担当の作業先にあるファイルへ書き込む | アクセス拒否。ホストでバイト列が同一 |

再現には既存のCodexログインとWindows登録情報を持つ親から `node tmp/windows-codex-launch-probe.mjs` を実行した。外側の実行制約下では `~/.codex` のSQLite初期化が失敗したため、正規の承認を得て再実行した。担当に実際に適用された条件と結果は上記のとおり。最終プローブは終了コード0。ローカルの一時ログは `tmp/windows-codex-launch-probe-final.log`（最終差分で成功）、`tmp/windows-codex-launch-probe.log`（初回レビュー時の成功）、`tmp/windows-codex-launch-probe-sandboxed.log`（外側の実行制約下）に記録した。

最終差分で共通起動・小タスク実行・場の担当領域のテストは59件中59件成功し、独立レビューでの再実行も同じ結果だった。Cockpitのループバック接続は外側の実行制約下で `EACCES` となったため、正規の承認を得て `npm.cmd test --prefix apps/soul/agent` を再実行した。全体2,574件が成功し、失敗・中断・スキップは0件だった。ローカルの一時ログは `tmp/windows-codex-launch-full-test.log`。実Discordでの会話は[既存の本人確認](../local-task-sessions/human-gate.md)に記載している。
