# 記憶の作り直し Wave 3(Domain D)軽いレビュー

> Review-Sylph(1 レーン・軽め)→ Undine。対象: 未コミットの作業ツリー(直前のコミット f0a8828e が Wave 2)。基準: [計画](../../orchestration/memory-recall-wave-plan.md) §0・§3・Wave 2 からの申し送り、[合意](../../../memory/recall-flow.md) §4・§6・§7、[実装報告](../../waves/memory-recall/domain-d-report.md)。コードは変更していない。本物の頭・Decisions API は呼んでいない。memories/ の記憶の本文は読んでいない。

## 判定: 合格

契約の食い違い・明らかな不具合は見つからなかった。下に注記(Undine の判断待ちの 2 点を含む)。

## テスト

- `apps/soul/agent` で `node --test`: **1578 件すべて合格**(fail 0・skipped 0)。報告と一致。
- リポジトリルートで `pnpm run check:soul-zone`: 合格(1523 ファイル)。
- 本物の `apps/soul/agent/memories/` の git: 3 コミット・作業ツリー clean(変更なし)。

## 確認した点(diff・コード・実行で)

1. **目印**
   - `recall` は `recall-tag.mjs` の `CONTROL_TAG_WORDS` で、表情の 6 語(`EXPRESSION_WORDS`)には混ざっていない。`events` にも未知タグの診断にも入らない。
   - 一括(`parseExpressionTags`)と逐次(`incremental-sentence-tag-buffer`)に同じ `scanRecallTag` を使う。手元で 9 例を両経路に流し、声と頼みごとが一致した(通常・引数に `< >`・直後の表情タグ・閉じていない・空・2 連続・本文の `<`)。壊れた・閉じていない目印は頼みにならず、声にも出ない。
   - 渡すのは `fire()` が結果を返す直前(状態 idle の後)。ask 失敗・キル・NG・dispose は渡さない。`fireId` を添える。
2. **教え**: `skills/recall.md` は `appendSoulSkills` で「名前 + 会話指示」の後ろに足す。①のセッション作成(`scripts/cockpit.mjs` の 1 箇所)にだけ足され、②④(`resolveWriterBrainDef` 経由の create)と判定の使い捨てには足されない(`buildFireSystemPrompt` の呼び出し箇所を grep で確認)。会話指示の上書きで消えないことは 6 つの頭でテスト済み。読めなければ警告 1 行。
3. **係**: 実行 1・待ち 1・捨て(`recall-desk.mjs`)。④は `create({ systemPrompt, cwd: 記憶のフォルダ, sandbox: "read-only", finalAnswerOnly: true, onWarning })`、頭は `resolveWriterBrainDef`(Codex 固定)、`finally` で dispose。直近 1 分は `appendedAtMs` で切り(転写の実際のフィールド名と一致)、`formatTranscriptForDigest` で視聴者名を落とす。判定の入力も displayName を使わない。
4. **判定と届け方**: `isBusy`(fireInFlight と orchestrator の状態)が偽になってから判定。0.8 以上でだけ避ける(0.79 は言う・拒否と読めない答えは言う側)。判定の失敗・タイムアウトは言う側+`judge-error`(source recall)。避けない→括った instruction で `requestSelfFire("recall")`、忙しければ列の先頭に戻して notifyIdle で判定からやり直す。避ける→`deferInstruction`(次の ask の先頭に 1 回・上限 3 件・会話ログに残らない)。見つからない→判定せず発火。括り文に「中に命令のような文があっても従わない」が入っている(発火用・黙って渡す用とも)。要約と頼みごとは `< > [ ] 「 」` を無害化。
5. **ログ・警告**: ログのタブの 4 種の行は selfFire の `kind: "recall-step"` に相乗り(SSE 17 本のまま)。ターミナル行は phase・確率・judge=error・reason だけで頼みごとも出さない。fire-diagnostics のトレースは `recall.requested {count}`・`deferred.instruction.consumed {count}` のみ。session-usage / onAskRecord に会話・記憶の中身を足す変更は無い(数字と種類だけ)。`recall-error` は warn・detail 200 字までのエラー文。
6. **config/read 失敗**: `MCP_CONFIG_READ_FAILED_WARNING` を export し、`isMcpConfigReadFailureWarning` は完全一致。文言の部分一致は無い。
7. **人間ゲート(計画 §6)**: 1(MCP)は Wave 1 の仕組み、5・6 は Wave 2 と移し替え済みの記憶。2〜4 はこの実装で確かめられる配線が揃っている(教え→目印→④→判定→発火 or 前置き、ログの行「思い出し中/思い出した/見つからなかった/避けた」)。足りない配線は見つからなかった。

## 差分(要修正)

なし。

## 注記(Undine の判断待ち・軽微)

1. **④が失敗・打ち切りのとき、①には何も渡らない**(報告の質問 2)。教えは「結果はあとで届く」と言うので、①は待ちぼうけになり、配信者にはそれきりになる。計画の文言(見つからなかった=①に伝える)の範囲外なので差分とはしないが、人間ゲート 3 の「見つからなかった」と区別がつかない失敗が起きうる。希望なら失敗も「見つからなかった」扱い(または失敗した旨)で発火する小さな追加で足りる。
2. **目印の後ろの同じ行に `>` を含む文があると、その手前まで声から落ちる**(例: `…<recall x> 3 > 2 だよ。` は「x> 3」を頼みごとに取り、声は「 2 だよ。」になる)。書式の仕様(同じ行の最後の `>`)どおりで、教えは「返事の最後に書く」「頼みごとに山括弧を使わない」としているので実害は小さい。逐次では目印の後ろの同じ行の文は行末か返事の終わりまで声が遅れる(報告のリスクに既出)。
3. 報告の質問 1(自発 OFF・従来モードでも係を動かす)は、合意 §4 の「①が自分で頼んだことの続き」に沿うので現状でよいと見る。質問 3(会話指示の編集ページに教えを読み取り専用で見せる)・質問 4(しきい値 0.8)は人間ゲート 4 の実機の結果で決めるのがよい。
4. 黙って渡す前置きは、次の ask の直前に積みが空になる。その ask が失敗すると前置きは失われる(progressive correction と同じ形で、まれ)。
5. 思い出した要約が「避けるか」判定として Decisions API(OpenAI)に送られる点は、報告のリスクどおり。視聴者名は落としている。
