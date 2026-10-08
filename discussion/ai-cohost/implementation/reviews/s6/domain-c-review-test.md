# S6 Domain C（発火スケジューラ）レビュー — test レーン

> レビュアー: Review-Sylph（test レーン）。2026-07-13。
> 判定基準: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §3 Domain C・§4 blocking 基準 3。
> Gnome 成果物: [../../waves/s6/domain-c.md](../../waves/s6/domain-c.md)。

## 判定: **PASS**

全分岐決定論（fake clock + 注入 RNG + 注入 timer）・LLM 非依存の構造的テスト固定・S1〜S5 無退行（既存
cockpit-server テストは 1 行も変更されず全緑）を自分で実行して確認した。blocking 指摘なし。non-blocking の
軽微なカバレッジの穴が 2 点ある（下記）。

## 1. 自分で実行した生数字

```
$ cd apps/soul/agent && node --test
# tests 479
# suites 0
# pass 479
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1241.6981
```
自然終了（プロンプト復帰・ハングなし）。timeout 300 付きで実行し、途中で止まることなく完走した。
domain-c.md §9 の主張（tests 479 / pass 479 / fail 0）と一致。

```
$ cd apps/soul/agent && node --test src/mind/fire-scheduler.test.mjs src/cockpit/cockpit-server.test.mjs
# tests 71
# pass 71
# fail 0
# duration_ms 412.663
```
`grep -c '^test(' fire-scheduler.test.mjs` = 22、`grep -c '^test(' cockpit-server.test.mjs` = 49。
domain-c.md の主張（fire-scheduler 22 本・cockpit-server 44→49=+5）と一致。

```
$ git diff -- apps/soul/agent/src/cockpit/cockpit-server.test.mjs | grep -E "^-" | grep -v "^---"
(出力なし。grep 終了コード 1 = 削除行ゼロ = 既存 44 本は完全に追加のみで無改変)
```
`git diff --stat` は `+116 insertions(+)` のみで deletions 0（既存テストの隠れた改変・退行隠蔽は無し）。

`cockpit-server.mjs` 側の `git diff` に現れる `-` 2 行は結線コードの型注釈コメント行と `visionTarget:` 行末の
カンマ追加（`selfFire` フィールド追加のための純粋な拡張）であり、既存挙動の削除ではないことを diff 本文で確認。

## 2. 全分岐決定論（fire-scheduler.test.mjs・最重要観点）

実時計・実乱数への依存を精査した。`makeFakeClock()`（L27-58）が `setTimeoutImpl`/`clearTimeoutImpl`/`advance`/`now`
を全て提供し、`rngHit`/`rngMiss`/`makeSeededRng`（線形合同法）が RNG を全て注入している。ファイル全体を
grep したが `Math.random(` の実呼び出し・裸の `setTimeout(`・`Date.now()` は一切なし（コメント中の言及 1 件のみ）。

逐条確認:

| 分岐 | テスト | fake 化 |
|---|---|---|
| 呼びかけ命中・確実発火（不応期/確率を掛けない） | L115-134 | fake clock・rngMiss でも影響しないことまで確認 |
| 呼びかけ非該当/soul除外/空文字 | L136-155 | ○ |
| 呼びかけ OFF/busy | L157-180 | ○ |
| 区切り X 秒無音境界（X-1で出ない/Xで出る） | L202-212 | fake clock advance |
| 区切り確率外れ | L214-221 | rngMiss |
| 区切り speechStart 取消 | L223-236 | fake clock |
| 区切り不応期内/経過後 | L238-253 | soul append で基点更新→fake clock |
| 区切り busy | L255-263 | ○ |
| 沈黙 Y+ジッター境界 | L285-295, L297-307 | fake clock + 固定 rng |
| 沈黙 活動リセット | L309-319 | ○ |
| 沈黙 長不応期内→再武装 | L321-332 | ○ |
| 沈黙 予算切れ・カウント・タイマ非残留 | L334-352（`clock.pending()===0` まで確認） | ○ |
| 沈黙 busy→再武装 | L354-364 | ○ |
| OFF トグル：タイマ畳み・再ON で沈黙カウント再開 | L368-397 | `clock.pending()` で直接検証 |
| 決定論（同入力+同seed→同発火要求列） | L410-440 | seeded RNG・2 回実行し deepEqual |
| 正規化境界（NFKC・ひら→カナ・濁点剥がし・部分一致） | L84-111 | 純関数・時刻/RNG 不要 |

全分岐が fake clock/注入 RNG/注入 timer で固定されており、実時計・実乱数に依存する穴は見つからなかった。

## 3. LLM 非依存のテスト固定

L444-451「LLM 非依存」テストは `readFileSync` でソースを実際に読み、
①`/^\s*import\s.+from\s/m` が false（import 文ゼロ）②`.ask(` が 0 件 ③
`createLlmSession|llm-session|claude-agent-sdk|session\.ask` が 0 件、の 3 点を assert している。
形骸化（ハードコード true 等）ではなく実ファイルを検査する機能するテストであることを確認した。
`fire-scheduler.mjs` を通読し、import 文・`import(...)` 動的呼び出し・`require(` のいずれも存在しないことを
自分でも grep して確認済み（構造的にも LLM/SDK への到達経路が無い）。

軽微な観測: 正規表現 `/^\s*import\s.+from\s/m` は `from` を伴わない `import(...)`（動的 import）を検知しない
理論上の穴があるが、現在のソースに動的 import は存在しないため実害はない（non-blocking、§5 参照）。

## 4. S1〜S5 無退行

- `node --test` 全体 479/479 緑（fire-orchestrator・barge-in・cockpit・cli・speak・audio-player 等の既存テスト
  を含む）。手動 Fire・視覚発火・barge-in 関連の既存テストが本レーンの変更で壊れていないことを実行結果で確認。
- cockpit-server.test.mjs の既存 44 本は diff 上 1 行も変更されておらず（§1 の grep 結果）、退行が「テストの
  改変で隠される」余地がない。
- 新規 5 本（L1222-1328）はいずれも即時判定の「呼びかけ（call）」経路のみで縦串確認（scheduler 未生成時の
  `selfFire:null`・既定 OFF・busy 無視・setSelfFireEnabled/selfFireStatus・snapshot）。domain-c.md §8 質問 7 が
  自認する通り、turn-end/silence はタイマ依存のため cockpit-server 経由の決定論テストは無く、純ロジック側
  （fire-scheduler.test.mjs）に全分岐を集約する設計判断は妥当（cockpit-server 側は「結線の縦串」に徹しており、
  重複テストで判定ロジックを二重管理しない選択は合理的）。
- scheduler は `selfFireInitialEnabled` 既定 false で生成されるため、既存の全テスト（selfFireInitialEnabled を
  指定しないもの全て）は scheduler が発火要求を出さない状態で走る。実際に 479/479 が無変更で緑という結果が
  この「既定 OFF で観測差ゼロ」という主張を裏付けている。

## 5. カバレッジの穴（non-blocking）

1. **`speechCancel` の scheduler 内明示テスト不在**: ソース（fire-scheduler.mjs L320-321 コメント）は
   speechCancel を無視すると明言しているが、`fire-scheduler.test.mjs` に `handleVadEvent({type:"speechCancel"})`
   を直接叩いて「区切りタイマ/沈黙タイマに影響を与えない」ことを固定するテストが見当たらない
   （grep で 0 件）。動作は speechStart の取消テストで間接的に守られている面はあるが、speechCancel 自体の
   分岐は独立して固定されていない。domain-b.md（barge-in gate）側で扱われている可能性はあるが、Domain C の
   「区切り」分岐列挙（wave-plan §3「区切り応答」記述）には speechCancel の明記は無いため blocking 基準3の
   対象外と判断——non-blocking として追加を推奨。
2. **不正入力（null event/entry・type/speaker 欠落）のテスト不在**: ソースのガード節
   （`event == null`・`typeof event.type !== "string"`・`entry == null`）は存在するが、これらの防御分岐を
   直接叩くテストが無い（domain-c.md §2-1「失敗の扱い」に記載された契約の一部）。防御コードの存在は確認したが
   テストでの固定は無い。non-blocking。
3. （軽微・実害なし）LLM 非依存テストの import 検知正規表現が動的 `import()` を捕捉しない理論上の穴（§3）。
   現状ソースには該当なし。

いずれも blocking 基準（全分岐決定論・LLM 非依存・S1〜S5 無退行）には抵触しない付随的な穴であり、
機械ゲートを止める理由にはならないと判断した。

## 6. 無音・ハング

`node --test`（全体・当該2ファイルのみ、双方）とも自然終了しプロンプトへ復帰した。実マイク・実音・実 SDK・
実 PowerShell の使用箇所はコード上・テスト実行ログ上ともに見当たらない（fire-scheduler は import ゼロで
到達不能、cockpit-server テストは既存の fake pipeline/fake orchestrator ヘルパー `makeOnAppendPipeline`/
`makeFakeOrchestrator` を再利用しており、これらは本セッション以前から使われている in-memory fake）。
event loop リークなし（`clock.pending()===0` を明示 assert する箇所が複数あり、タイマ解除も直接検証されている）。

## 7. §質問（Orch への申し送り）

- なし。test レーンとして判断に迷う点は無かった。§5 の non-blocking 2 点は追加テストの提案として記載したのみ。

## 結論

- **判定: PASS（blocking 指摘なし）**。
- 全分岐決定論・LLM 非依存の構造的テスト・S1〜S5 無退行（既存44本無改変・479/479緑）を自分の実行で確認した。
- non-blocking: speechCancel 単独分岐・不正入力防御分岐のテスト追加を推奨（次の追撃 wave か followup 台帳向き）。
