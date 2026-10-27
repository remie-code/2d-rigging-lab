# 応答の遅れの直し 完了報告(Gnome 2026-10-27。Undine が受け取って置いた)

> 計画: [../../orchestration/latency-fix-plan.md](../../orchestration/latency-fix-plan.md)。Gnome は報告ファイルを書けなかったため、最終メッセージの全文の要点を Undine がここに置いた。

- `node --test` 1668/1668(新規 20)、`pnpm run check:soul-zone` 成功。
- **ephemeral(Codex 0.163.0 の実機)**: thread は `ephemeral=true`・`path=null` で、ファイルは書けた。~/.codex/sessions の記録は 0 件。thread/delete は「not persisted」で失敗するため、使い捨ての dispose では呼ばない。組み込み後の通し(① → 使い捨て → ①)で、①の記録は残った。①の phase は final_answer、item/completed から ask の戻りまで 35〜42ms。
- **掃除**: 1 プロセス・1 台帳につき 1 回(操縦席は `main()` の最初で明示的に呼ぶ。cli 等は最初の常駐セッションで 1 回)。このプロセスで生きている thread は消さない。ephemeral は掃除せず、台帳にも載せない。テストで「①が生きている間に使い捨てを作っても①の記録は消えない」を固定した。
- **締めの合図**: codex-session の ask に `onTextDone`(agentMessage の item/completed で、delta の累積と text が一致した直後。commentary は除く)。orchestrator はそこで flush し、ask の戻りでは二重に flush しない(締めた後に本文が続いたときだけもう一度)。`firstSentenceMs` の定義は変えていない。
- **句点**: 例を句点付きにした(「そうだね。<nod>」、recall の例)。6 語のタグか recall の前に声にする文字があれば、その時点で 1 文として出す(タグは文に含めない)。recall は `<recall` + 語でない文字で目印と決まった時点で区切る。文の途中のタグでも区切る(「えっ<surprised>ほんとに?」は 2 文になる。つなげた本文・会話ログ・表情は変わらない)。
- **指示の切り分け**: `skills/expression.md`・`skills/screen.md` を新設した。①への固定の部分は 名前 + 会話指示 + 表情 + 画面 + 思い出す の順。会話指示の既定は話し方の一文だけ。`FIRE_SYSTEM_PROMPT`(Claude)にも 3 つの教えが入った。設定ファイルの上書きは codex-56-sol 349 → 99 字、codex-astra 297 → 71 字(先に `.bak-20261027` に写し、バイト一致を確認)。
- **遅延の記録**: session-usage に `type:"latency"` の行(fireId・きっかけ・spoken・vision・level・brain・sttEngine・voiceEngine・各区間・合計)。会話の中身は書かない。起動ごと 1 ファイルのまま。
- **期待値を変えた既存テスト**: fire-orchestrator 2 件(FIRE_SYSTEM_PROMPT に教えが入った)、soul-skills 2 件と scripts/cockpit.test 1 件(教えが 3 つ)。
- **残るリスク**: 文の途中のタグでも文が分かれるので、文ごとの合成が増える(気になれば「タグの後ろが句読点か終わりのときだけ」に絞れる)。実機で「未対応の通知」の警告(remoteControl/status/changed ほか)が出る(既存の常駐セッションでも同じ)。
