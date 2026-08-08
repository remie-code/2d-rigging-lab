# AI Cohost map update report

> 2026-08-08。`map-update-contract.md` に従い、子 map → ai-cohost topic map の順で更新した。対象は `discussion/ai-cohost/**/_map.md` と本報告だけで、source・test・非 map 文書・`discussion/concept/_map.md` には触れていない。

## 1. 所有範囲と実確認

確認した9 map:

- `discussion/ai-cohost/_map.md`
- `discussion/ai-cohost/architecture/_map.md`
- `discussion/ai-cohost/concept/_map.md`
- `discussion/ai-cohost/implementation/_map.md`
- `discussion/ai-cohost/implementation/orchestration/_map.md`
- `discussion/ai-cohost/implementation/screens/_map.md`
- `discussion/ai-cohost/premises/_map.md`
- `discussion/ai-cohost/research/_map.md`
- `discussion/ai-cohost/soul/_map.md`

変更6、意図的に未変更3、作成0。

## 2. 変更内容

### 変更した map

- `ai-cohost/concept/_map.md`: MVP境界を「リポジトリ全体でLLM/知覚禁止」から、`apps/soul` 特区内のみ許可・特区外禁止へ訂正。改定一号/二号のAccepted日付を保持。
- `ai-cohost/implementation/screens/_map.md`: `soul-cockpit.md` と `cockpit-redesign.md` を索引。C4 context-check の古い次 action を、S8/多頭化/記憶の現在ゲート参照へ置換。
- `ai-cohost/implementation/orchestration/_map.md`: S7を実装済み・30分実配信実質合格として更新。S8、brain-swap、reading/interjection、stream-memory の棚卸し/計画を実在ファイルへ追加し、機械ゲートと人間ゲートを分離。
- `ai-cohost/soul/_map.md`: 前提討議だけの入口から、S1〜S8実装・後発判断・残るゲートを索引する入口へ更新。Max 20x+Agent SDK、4頭registry、配信間記憶、persona/S9を明示。
- `ai-cohost/implementation/_map.md`: 冒頭に現在到達の要約を追加。C1〜C7、S1〜S7、S8、4頭、朗読、記憶の到達と、人間ゲート未完了を区別。
- `ai-cohost/_map.md`: child map 更新後に実装/soul行、Current State、Next Actions、Unresolved Questionsを更新。D4=YouTube、D6=キー操作梯子、D7=Variant対象外、身体author境界は維持。

### 意図的に未変更

- `ai-cohost/architecture/_map.md`: D1/D4/D6/D7 と C2〜C6設計の現在記述が監査結果と整合。
- `ai-cohost/premises/_map.md`: accepted-premises の唯一の入口として現行。
- `ai-cohost/research/_map.md`: 2026-07の歴史的調査スナップショットとして日付・再確認注意を保持。

## 3. 置換した主張と根拠

| 旧い入口 | 現在の正 | 根拠 |
|---|---|---|
| S7発進待ち/YouTube実ゲート後日 | `/live/<id>` 実配信30分ノーブレイク、コメント読み上げ・視聴者名認識。実ゲート実質合格 | `50-ai-cohost.md` §4.1, §5.1, §7; `implementation/_map.md` #23 |
| 知性アクセス経路未決 | 主経路 Max 20x + Agent SDK。枠/制度は監視 | `50-ai-cohost.md` §3.1; `soul/llm-access-path.md` |
| 特区外を含むLLM/知覚全面禁止 | `apps/soul` 特区内のみ許可、特区外は禁止 | `concept/mvp-boundary-amendment.md` §6; `50-ai-cohost.md` §3.1/§5.2 |
| S8/brain/memory の「次」だけを索引 | S8は764/764・9レーン、brainは4頭実装・初回体感、memoryは957/957・6レーン。各人間ゲートは未記録 | `50-ai-cohost.md` §4.3, §7; `s8-wave-plan.md`; `brain-swap-wave-plan.md`; `stream-memory-wave-plan.md` |
| UI map がC1/C3/C4だけ | `soul-cockpit.md` と `cockpit-redesign.md` を現在UI入口に追加 | `50-ai-cohost.md` §5.2; `apps/soul/README.md` §操縦席 |

## 4. 維持した決定とゲート境界

- C1〜C7完全閉鎖とC7の「waveなしOBS二体並走検証」を維持。
- S8 kill/NG/開示の機械実装と、kill実射・通常発話無退行の人間ゲートを分離。
- brain-swapの(a') SDK+スレッド継続+配信後rollout掃除、Opus > Sol ≒ 5.5 > Terra の初回体感を事実として索引し、最終速度/品質/無退行/掃除ゲートは未完了のまま。
- stream-memoryの自動搭載3件、20分checkpoint/手動/SIGINT、OFF止水栓、視聴者名秘匿を実装事実として索引し、4点実射を未完了のまま。
- reading/interjectionの1時間40分実配信4点ゲート合格を完了として索引。
- D4/D6/D7、身体authorのmodel-authoring引き渡し、persona/S9声のユーザー/product判断を再裁定しない。

## 5. 検証

- `git diff --check -- discussion/ai-cohost`: pass（whitespace errorなし）。
- Markdown相対リンク検査（PowerShell regex + `Test-Path`、9 map）: 変更リンクの missing なし。
- `git diff --stat -- discussion/ai-cohost`: 6 map changed、67 insertions/15 deletions。
- source/test/config は変更していない。実機・YouTube・kill・記憶の人間ゲートは再実施していない。

## 6. 所有範囲外の残課題

- `discussion/concept/_map.md` および他topic親/root map の更新は各owner/Phase 2へ委譲。
- S8 kill、brain-swap、stream-memory の人間ゲート実施・記録はユーザー実射が必要。
- persona/S9の声・身体の製品判断、Max/Agent SDK制度・費用の再確認は継続監視。
