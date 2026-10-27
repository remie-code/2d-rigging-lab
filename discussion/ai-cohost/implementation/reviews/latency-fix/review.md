# 応答の遅れの直し レビュー(Review-Sylph・軽め 1 レーン 2026-10-27)

判定: **合格**(契約の食い違い・明らかな不具合なし。注記のみ)

テスト: `node --test`(apps/soul/agent)1668 件 pass / 0 fail。`pnpm run check:soul-zone` 成功(1534 ファイル)。

## 確認した点(diff・テスト・実ファイルで確認)
1. 掃除: `sweepCodexRollouts` は 1 台帳 1 回(`sweptLedgers`)・生きている thread(`liveThreadIds`)は消さず台帳に残す。ephemeral は掃除せず、応答の thread も ephemeral のときだけ台帳・`persistedThreadIds` に載せない。dispose の `thread/delete` と記録削除は persisted のみ。memory.mjs(②)と recall.mjs(④)だけが `ephemeral: true`。①(cockpit.mjs の `brainDef.create`)は未指定=記録が残るので圧縮の前提は保たれる。操縦席は main() で起動時に 1 回呼ぶ。
2. 締めの合図: `item/completed` で delta 累積と text の一致検査の後、commentary 以外で `onTextDone`(例外は握る)。orchestrator は `flushed` を append で戻すため、二重 flush なし・合図の後に本文が続けば最後に再 flush。speech-streamer の `enqueue` を止めるのは `finish()` 後だけなので、合図後の追加は安全。Claude の頭(llm-session)は onTextDone を使わず、ask 戻りの flush のまま(経路不変)。
3. 句点: タグ前の区切りは「完結した 6 語タグ・recall(`<recall`+語でない文字で確定)」のみ。未知語・壊れた山括弧は従来どおり。タグは文に含めず、tags・recalls は従来どおり出る。会話ログ・表情は ask 戻りの全文を parse するので影響なし(テストでも固定)。
4. 指示の切り分け: 会話指示の既定は話し方 2 文のみ。expression.md(6 語・半角山括弧・読み上げに含めない)は移動前と同等(例のみ句点付きに変更)。screen.md・recall.md は `SOUL_SKILL_NAMES` 経由で①の固定部(名前 + 会話指示 + 表情 + 画面 + 思い出す)にだけ入る。`appendSoulSkills` の使用は cockpit.mjs と FIRE_SYSTEM_PROMPT のみで、②④には入らない。会話指示の画面の読むだけ表示は `SOUL_SKILL_LABELS` に 2 件追加。設定の上書きは 682 → 206 文字(キーは同一・本文は読んでいない)。
5. 遅延の記録: `replyLatencyUsageRecord` は数字・種類・エンジン名・causeType/choice のみ拾い、本文・ID は落とす(テストで固定)。
6. `.gitignore` に `cockpit-settings.local.json.bak*` あり。`git check-ignore` で .bak が無視されることを確認、status にも出ない。

## 差分(要修正)
なし。

## 注記
- 文の途中のタグでも文が分かれる(「えっ<surprised>ほんとに?」は 2 文・文ごとの合成が増え、句読点なしの区切りで抑揚が切れる可能性)。報告 §残るリスクのとおり。気になれば「タグの直後が句読点か終端のときだけ」に絞れる。
- `FIRE_SYSTEM_PROMPT` はモジュール読み込み時に skills/ を同期で読む(`onWarning` なし・読めなければ黙って空)。観測用スクリプトと Claude の頭だけが使うため実害は小さい。
- 合図後に turn が失敗した場合、既に声に回した最後の文は `llm-failed` で abort される(従来の途中失敗と同型)。
- 実機の通し・ephemeral の挙動は報告の記述に依拠(私は実機を起動していない)。
