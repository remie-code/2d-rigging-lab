# チャッピーの GPT-6.2 Astra / Sol 実装・検証記録

[合意済みの計画](../../orchestration/chappy-gpt-62-models-wave-plan.md) · [Windows 小タスクの合格条件](../windows-codex-launch/completion.md)

2026-11-18。Soul の直接依存 `@openai/codex-sdk` と lockfile を 0.169.1 に更新した。Cockpit のロール編集のモデル候補に GPT-6.2 Astra と GPT-6.2 Sol を追加した。既存の六候補も表示され、チャッピーの初回モデルは GPT-6.1 Sol、こーでぃーの初回モデルは Claude (Opus 5.5) のまま。それぞれの新候補は既存の Codex セッションを使い、実行するターンに `low` を指定する。

## Cockpit での保存・再起動・会話

Chrome の実画面を Playwright で操作した。隔離した Cockpit で準備・設定 → ロールを開き、チャッピーの「モデル」を選択して「ロールを保存」を押した。保存応答と隔離先の `roles/chappy/role.json` を確認し、Cockpit を終了して別プロセスで起動した。起動直後の `/api/state` のロールとモデル、およびモデル欄の選択値が保存値と一致した。続けて「配信を始める」を押し、短い合成転写を会話欄で確認して、準備・設定 → 運転の Fire を押した。Fire の 202 応答と、同じ会話欄にモデルが返した文字列を確認した。

| モデル | Cockpit PID（保存時 → 再起動後） | `thread/start` の応答モデル | 入力を含む `turn/start` の effort | `turn/completed` | 会話欄の返信 |
| --- | --- | --- | --- | --- | --- |
| GPT-6.2 Astra | 61912 → 18264 | `gpt-6.2-astra` | `low` | `completed` | `ASTRA-62-717` |
| GPT-6.2 Sol | 41976 → 21496 | `gpt-6.2-sol` | `low` | `completed` | `SOL-62-942` |

実行ファイルは製品既定で解決した Soul の npm 依存の Windows x64 `codex.exe`。Node の観測用 preload は起動引数、子環境、RPC メッセージをそのまま中継し、`initialize` の 0.169.1、開始モデル、会話入力を含むターン、返答の `item/completed`、同じ thread の `turn/completed` を照合した。両モデルとも `thread/start` の応答に含まれるスレッド既定の effort は `high`、会話ターンの明示指定は `low` だった。

コード相対のロール・設定・記憶・ログは隔離コピーを使い、npm 依存だけ製品のディレクトリを参照した。隔離コピーの `pipelineFactory` に合成転写を渡す耳を接続し、配信の会話バッファと耳の通知口を通した。隔離したロールは「体なし」にし、音声合成にはループバックの無音 WAV を使った。マイク、実際の音声認識・音声合成、器、Discord、YouTube は検証対象外。音声合成の用意がない初回試行ではモデル応答が完了しても会話欄への反映が失敗したため、無音 WAV を用意した検証で両方の表示を確認した。

## 引継ぎと Windows 小タスク

通常の会話に使うロールのモデルを、記憶の参照・保存・整理とローカル小タスクへ引き継ぐ経路は共通の `resolveWriterBrainDef(currentBrain)` を使う。両候補をこの共通解決が返すことを回帰テストで確認した。実機では終了時の記憶保存が両モデルでそれぞれ会話と同じモデルを `low` で起動し、隔離した記憶への保存コミットまで進んだ。整理も Astra の先行試行と Sol の最終試行でそれぞれ会話と同じモデルを `low` で起動した。記憶参照は製品の実機試行では発火させていない。

GPT-6.2 Sol を代表に、製品の `resolveWriterBrainDef` → `runLocalTask` → 場の担当領域 → `createCodexSession` を通して、通常の購読認証で製品既定の 0.169.1 を起動した。親にある Windows 登録情報の CORE を子から除き、FAMILY を一致させて渡し、親の両変数が残ることを確認した。実際のターンではモデル `gpt-6.2-sol`、effort `low`、`approvalPolicy: never`、`workspaceWrite`。書き込み可能なルートはその担当の作業先だけで、ネットワーク禁止および一時フォルダ除外を観測した。

| 操作 | 実機・ホスト照合 |
| --- | --- |
| 合成資料の原本を読む | 合成識別子を取得 |
| 担当先の `result.txt` に書いて読み戻す | 成功。ホスト側でも同じ識別子を確認 |
| 原本に書く | アクセス拒否。保存内容は元と一致 |
| 先行担当先の `sibling.txt` に書く | アクセス拒否。保存内容は元と一致 |

## 回帰と観測ログ

`npm.cmd test --prefix apps/soul/agent` は 2,580 件成功。失敗・中断・スキップは 0 件。両候補のモデル ID と effort、表示順とラベル、既存ロールの既定・移行・保存値、担当モデルの解決を含む。実機のブラウザ操作と RPC は `tmp/chappy-62-cockpit-astra.log` と `tmp/chappy-62-cockpit-sol.log`、Astra の記憶保存・整理の先行試行は `tmp/chappy-62-cockpit-ui-final.log`、小タスクは `tmp/chappy-62-local-task.log`、全体テストは `tmp/chappy-62-full-test.log` に記録した。これらはローカルの一時ログ。
