# Wave 1 独立レビュー

修正1の再レビューで Wave 1 の内部検証は合格。承認範囲は [Wave 1 計画](../../orchestration/local-task-sessions-wave-plan.md) と [実装契約](../../waves/local-task-sessions/basis.md) を参照。

## 実装の確認

- 通常 Cockpit の recall は Fire のタグ受付から recall desk、先頭ロールの `recall.run`、起動スクリプトの `recallRunner`、`runRecall`、共通 `taskSessions.run` へ流れる。runner は記憶の場所と担当 factory を準備待機前に選ぶ。共通実行口は依頼ごとに factory を呼び、`ephemeral` と `finalAnswerOnly` を適用して一度 ask する。
- 共通実行口は返答本文を返し、起動・ask の失敗や呼び出し元が指定した打ち切りは reject する。部分回答の意味判定は入っていない。記憶の read-only、指示、返答解釈、受付の実行一件・待ち一件、発話判断は recall 側に残る。共通の本文・生成制限はない。個別の明示取消しの実装はこの差分にない。
- desk を閉じると受付と未配送結果を捨て、後から完了した task や発話判定を新しい desk に渡さない。共通 scope は受付停止と実行・dispose の待機を分ける。受付済みの仕事を通常 close で待つ処理は Wave 2 の範囲。
- 同じ作業ツリーにあった Discord の chat/API、資料入力、VC 世代の差分および Fire の資料注入差分は前段由来。共通基盤への recall 移行の証拠は、scope、recall 本体と desk、Cockpit の job 型・runner 配線、追加試験から確認した。

## 修正1の確認

- 初回は、旧場で Fire の列に積まれた未使用の recall の前置きが、desk の破棄後も残っていた。修正後は Cockpit の `parkRecallDesk` が desk を閉じ、Fire 側でも発生元が `recall` の前置きを破棄する。同じ場の次 ask は従来どおり前置きを受け取り、次場への切替で他の内部指示は保持される。
- Fire は通知直前に、発火時に取得した転写を Cockpit が管理する現在の開いた場の転写と照合する。通常起動の `fireOrchestratorFactory` がこのフックを Fire に渡すため、旧 Fire の遅延タグで新しい場・ロールの担当処理は起動しない。
- scope は dispose のエラーを記録し、`waitForIdle` に続いて `getCleanupFailures` で取得できる。Codex の担当プロセスを終了確認できない場合も、元の返答・実行エラーを保持しながら解放失敗を通知する。削除前にこの失敗を確認して使用中の可能性がある領域を保持する接続は Wave 2 で検証する。

## 試験と未確認事項

- 修正1後の独立実行で 63/63。対象は task-session、recall、recall-desk、recall-tag、fire-orchestrator-recall、cockpit-ui-recall。追加の実 Fire 試験で担当の応答を保留中も次の会話が成立し、待機依頼は別担当で処理され、両担当の dispose と結果の前置きを確認。追加試験で、古い転写の Fire が遅延タグを投げないこと、返答と ask 失敗の両経路で dispose のエラーを別に取得できることも確認。
- 基線 58/58、Soul 全体 2,570/2,570、`check:soul-zone` 成功と `git diff --check` 成功は実装担当報告。修正1の HTTP 2/2 は実装担当報告。うち新規の `cockpit-stream.test.mjs` は実 Fire を使い、同じ場での結果配送、閉じて次の場を開いた後の前置き遮断、他の内部指示の保持を次 ask で検査する。初回の独立 HTTP 実行はループバック接続の権限制約で完走できなかった。`check:source` は実装担当報告で既存の `apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反。
- 実モデルによる会話と本人確認は保留。Discord 資料の通常利用、場の寿命、記憶保存と後始末は Wave 2・3 で確認する。
