# ゲーム画面 OCR Wave 2 独立レビュー

2026-11-21。対象は場の開閉、確定した画面文字の会話への受け渡し、推論範囲、記憶書き出し。判断基準は[配信での体験の合意](../../../game-dialogue/screen-text-blocks.md)と[Wave 2 の計画](../../orchestration/game-dialogue-ocr-wave-plan.md)。

## 配信と会話への接続

- 配信の場が開く最後の処理で、OCR がオンかつ窓指定ありなら取得を始める。開始失敗時と Discord の場では開始しない。閉場は会話の正本を写す前に取得を取り消す。窓変更・見失い・再開では途中の表示を捨てる。遅れて返った処理結果は取り消し信号で捨てる。すでに確定した行は閉場時の記憶の入力に入る。[Cockpit の配線](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs#L1060)・[場の閉鎖処理](../../../../../apps/soul/agent/src/cockpit/venue/lifecycle.mjs#L180)・[取得スケジューラ](../../../../../apps/soul/agent/src/eyes/game-dialogue-ocr-scheduler.mjs)
- Windows の通常起動は `start-cockpit.cmd` から Cockpit CLI に進み、`STREAM_GAME_OCR_INTERVAL_MS` を起動時に読む。11月21日時点の既定は 1,500 ms。前の取得・認識が終わるまで途中の tick を捨てる。一枚撮影は既存の発火から独立して呼べる。[起動手順](../../../../../apps/soul/README.md)・[起動配線](../../../../../apps/soul/agent/src/cockpit/startup/run-cockpit.mjs#L1040)
- 確定した行の本文・改行・seq・表示順・表示時刻は会話の正本から SSE と snapshot に渡る。発火予定には回さない。既存の発話機会には、確定順の会話入力と表示時間を渡す。線は `fireAsk.windowSeqs` に従い、未投入のゲーム行を跨ぐと途切れる。ログは場ごとにファイルを切り替え、発火ごとの経過時間、上限適用前の文字量、投入 seq、未送信の除外理由 `time` / `chars` を記録する。[SSE への変換](../../../../../apps/soul/agent/src/cockpit/cockpit-public-transcript.mjs)・[入力の整形](../../../../../apps/soul/agent/src/mind/fire-injection.mjs)・[使用ログ](../../../../../apps/soul/agent/src/mind/session-usage-log.mjs)・[会話欄の線](../../../../../apps/soul/agent/src/cockpit/view-logic/glance-timeline.mjs)

## 指摘と再確認

1. 発話意図に応じて演技・注意対象を決める経路は、直近会話を別の判定入力に渡す。初回差分ではこの入力にゲーム画面も入り、同じ OCR 本文が後続の発火でも使われ得た。修正後はゲーム画面を除く。テストでは発話に渡す本文にゲーム行があり、模擬 Decisions に渡す JSON にはゲーム行が無いことを照合した。[発話・動作の判定入力](../../../../../apps/soul/agent/src/mind/fire-orchestrator.mjs#L1012)・[判定 JSON の回帰試験](../../../../../apps/soul/agent/src/mind/fire-orchestrator.test.mjs#L125)
2. 初回差分では同じ場でスレッドを切り替えると、文字数で落ちた古い台詞が、先に渡った新しい台詞の後に再登場し得た。修正後は場の正本と最後に渡した seq を基準にゲーム行を絞る。スレッドを替えても既送信の行と追い越した行は戻らず、次の場では新しい正本で seq を使い直せる。[場ごとの入力履歴](../../../../../apps/soul/agent/src/mind/fire-orchestrator.mjs#L533)・[発火の回帰試験](../../../../../apps/soul/agent/src/mind/fire-orchestrator.test.mjs#L3943)

## 検証

- 修正後に取得・一枚撮影、転写バッファー、発火オーケストレータとスケジューラ、使用ログ、記憶書き出し、会話表示の 8 ファイルを独立実行し、316 件すべてが通過した。`git diff --check` も通過した。
- 隔離 localhost の Cockpit HTTP 試験を独立実行し通過。既定のサンドボックスではループバック接続が `EACCES` になったため、許可を得て同じ試験を再実行した。認識を保留した状態で一枚撮影と手動発火を受理し、閉場・対象窓変更で中止し、再開後に遅延結果が入らないことを照合した。使用ログの試験は時間・文字数の片方だけで落ちる入力を発火経路で照合し、別試験で一時 JSONL に実際に書いて読み戻した。[HTTP 統合試験](../../../../../apps/soul/agent/src/cockpit/cockpit-server.test.mjs#L197)・[JSONL の書き戻し試験](../../../../../apps/soul/agent/src/mind/session-usage-log.test.mjs#L37)
- 実行担当による修正後の隔離 Windows・Chrome スモークでは、100 ms 設定時の Windows OCR の開始間隔は 1,744 / 1,473 / 1,421 / 1,427 ms、3,000 ms 設定時は 2,822 / 3,014 / 3,010 / 3,085 ms。両方で実行は最大 1 件、OCR の確定だけでは ask なし。seq 0 の確定本文が SSE、手動発火の localhost 入力、Chrome の「推論に使った範囲」と一致し、2 px の線が出た。OCR 中に手動発話を受理し、一枚の JPEG が 149 / 160 ms で取得できた。閉場時の中止、再開時に前の場の OCR 行が消えること、隔離した記憶書き出しの入力に確定台詞が入り記憶ファイルに書き出されることを確認した。実 JSONL に `pendingElapsedMs: 687 / 2202`（設定順）、`pendingChars: 82`、`windowSeqs: [0]`、`droppedUnsentGame: []` が残った。100 ms の追加実行では模擬 PCM と player を通して相方の行まで確認した。

開発検証は隔離した設定・場・記憶で実施した。Windows スモークは物理マイクを使っていない。普段の配信で黙読後の発話にチャッピーが台詞を踏まえて返すことは、配信者の最終確認に残る。

## 11月22日　既定周期の変更

既定の取得周期を 1,000 ms に変更した差分を独立確認した。本番と同じ設定の解決関数で未設定・無効値が 1,000 ms になり、900 ms と 2,500 ms の指定は取得タイマーに反映された。認識中の tick の見送りと、場の切替後に遅延結果を追加しない試験も含め、スケジューラ試験 3 件が通過した。[スケジューラ試験](../../../../../apps/soul/agent/src/eyes/game-dialogue-ocr-scheduler.test.mjs)
