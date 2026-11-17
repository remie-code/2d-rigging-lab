# Windows の Codex 起動変更の独立レビュー

2026-11-18。判定は合格。対象は[今回の計画](../../orchestration/windows-codex-launch-wave-plan.md)と[小タスクの実装契約](../../waves/local-task-sessions/basis.md)に定めた Windows の起動と書き込みの分離。

## ソースと回帰テスト

- `codex-session.mjs` の共通 App Server 起動は、Windows で実行ファイルと環境の両方を既定にした場合に限り、環境のコピーから `CODEX_WINDOWS_REGISTERED_CORE` を大文字小文字を区別せず除く。親の環境は編集せず、`CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY` を含む残りの値を引き継ぐ。実行ファイルまたは環境を明示した場合は従来の値を使う。
- 回帰テストは既定経路と二種類の明示指定を実際の spawn 呼び出しの引数で比較する。子の環境全体を比較し、親の CORE と FAMILY も確認する。独立に Windows 上で `codex-session.test.mjs` の 55 件と `task-session.test.mjs`・`venue-task-resources.test.mjs` の計 4 件を実行し、全件成功。対象差分の `git diff --check` も成功。
- 再レビューでは、既定値を使うかの判定を実行ファイルと環境の選定時に確定する修正を確認した。呼び出し元がセッション作成後に既定の指定を明示へ差し替えるケースと、明示を既定へ差し戻すケースを回帰テストに追加した。最終差分で Windows の関連 59 件を再実行し、全件成功した。環境のコピーは引き続き子を起動する時点で作成する。

- 最終差分で正規承認を受けて実行した Soul 全体の `npm.cmd test --prefix apps/soul/agent` は終了コード 0。ログ `tmp/windows-codex-launch-full-test.log` で 2574 件すべての成功を確認した。失敗・取消し・スキップは 0 件。

## Windows 実機

`tmp/windows-codex-launch-probe.mjs` と `tmp/windows-codex-launch-probe.log` を照合した。プローブは製品の場の資料管理、`runLocalTask`、Cockpit の担当選択と共通セッションを経由して npm 同梱の Codex 0.163.0 を起動した。観測用 `spawnImpl` は製品側が組み立てた環境をそのまま Node の `spawn` に渡し、`turn/start` も送信内容を記録してそのまま転送した。実子の初期化応答と完了イベントを確認した。

- 起動時の記録は親の CORE 有効、親の FAMILY 有り、子の CORE 無し、親子の FAMILY 一致を示し、ホストの事後確認でも親の両変数が残った。
- 実際の `turn/start` は `approvalPolicy: "never"`、`workspaceWrite`、`networkAccess: false`、共有一時領域の除外を指定した。唯一の書き込みルートとターンの cwd が実行イベントの cwd に一致した。ネットワークと共有一時領域は設定値で確認した。
- 実コマンドは合成原本の UUID を担当の `result.txt` へ書き出して読み戻し、原本と別担当の合成ファイルへの各書き込みで Windows のアクセス拒否を記録した。ホストが担当先の保存値および原本と別担当ファイルの内容を検査し、すべてのアサーションを通過した。判定にはモデルの報告に加え実コマンドの結果とホストのファイル検査を使った。
- 初回の実機ログでは書き込みの分離を観測できたが、PowerShell のエラー分類が `NotSpecified` だったためプローブのアサーションが落ちた。最終版は例外メッセージのアクセス拒否を検証し、最後に `{"result":"passed"}` を記録した。
- 外側の実行サンドボックス内での起動試行は、App Server の stdout が早期終了したことを `tmp/windows-codex-launch-probe-sandboxed.log` に記録した。最終実機結果は正規承認を受けたホスト起動のもので、担当の `approvalPolicy` と `sandboxPolicy` は上記のとおり。

- 最終差分での再試行は終了コード 0 だった。`tmp/windows-codex-launch-probe-final.log` を照合し、親子の起動環境、担当専用の書き込みルート、実コマンドの二つのアクセス拒否、三つのファイルの事後検査、および `{"result":"passed"}` を再確認した。
