# brain-swap-terra — Codex SDK + GPT-5.6 Terra 縦貫通スパイク実測

> Status: Recorded（2026-07-17）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Undine L0）。brain-swap.md §6 S-1〜S-4。
> 位置づけ: 魂（相方こーでぃー）の**頭脳**を Claude(Opus 常駐) → Codex SDK + GPT-5.6 Terra へ
> 差し替えられるかの速度スパイク。動機（ユーザー）=**応答速度**。実 Terra 消費（ユーザーの
> ChatGPT サブスク枠）はユーザー了承済みの実験。
> 流儀: [s1-first-light.md](s1-first-light.md) を踏襲（実行環境 → 再現手順 → 生データ表 → 導出値 → 所見）。
> 数字は全て Gnome が実行したツールの生出力のみ（捏造なし）。

## 0. これは何を測ったか（限界の明示）

**Codex SDK(`@openai/codex-sdk`) → codex CLI(`exec --experimental-json`) → GPT-5.6 Terra の往復**だけ。
TTS も実器チャネルも通していない（s1-first-light と違い、TTS 内訳は測っていない）。測ったのは
**入力 → Terra が応答テキストを返すまで**の wall-clock と、その内訳（プロセス spawn / thread.started /
agent_message 到達 / turn.completed）。安全設定は sandbox=read-only + approval=never +
web_search=disabled + workingDirectory=スクラッチ（リポジトリ外）。

**呼び出し予算**: 合計 20 発以内の制約下で **16 発**（1 発は生成前 400 で棄却＝下記 §1 追記・
15 発が成功生成）。**429/レート制限は一度も出ていない**。

## 1. 実行環境

| 項目 | 値 |
|------|----|
| OS | Microsoft Windows 11 Home（win32 x64） |
| Node | v22.14.0 |
| SDK | `@openai/codex-sdk` **0.144.5**（依存 `@openai/codex` 0.144.5・vendored codex-cli 0.144.5） |
| モデル ID（指定） | `gpt-5.6-terra` |
| モデル ID（サーバ解決後・エラー文から観測） | `gpt-5.6-terra-1p-codexswic-ev3` |
| 認証 | ChatGPT サブスク OAuth（`~/.codex/auth.json`・SDK 任せ・auth.json は不読）。OPENAI_API_KEY/CODEX_API_KEY/OPENAI_BASE_URL は**未設定を事前確認**。`forced_login_method="chatgpt"` を global config で固定 |
| 記録日 | 2026-07-17（JST 午前） |

**追記（重要な段差・実測 400）**: 主計測を当初 `reasoning_effort=minimal`（設計 S-6 の想定）で叩いたところ、
生成前に **HTTP 400** で棄却された:

```
Unsupported value: 'minimal' is not supported with the 'gpt-5.6-terra-1p-codexswic-ev3' model.
Supported values are: 'none', 'low', 'medium', 'high', and 'xhigh'.  (param: reasoning.effort)
```

→ **Terra は `minimal` 非対応**。最速は `none`。以後の主計測は `effort=none` で実施した。
（この 400 はモデルエンドポイントまで到達した＝**認証経路が生きている**ことの裏取りでもある。）

## 2. 再現手順

```
# 前提: codex login 済み（ChatGPT サブスク）・OPENAI_API_KEY 未設定・codex-sdk 導入済み。
# 注意: 実 Terra 枠を消費する。フェーズ分割実行で予算管理。
node apps/soul/agent/scripts/spike-codex-terra.mjs sessions      # 枠消費0（~/.codex/sessions 件数）
node apps/soul/agent/scripts/spike-codex-terra.mjs main 10       # S-1/S-2: 1 thread × 10 往復 effort=none
node apps/soul/agent/scripts/spike-codex-terra.mjs effort        # S-1 effort: low×2 + medium×2（新スレッド）
node apps/soul/agent/scripts/spike-codex-terra.mjs image         # S-4: 窓1枚→local_image→即削除
```

- スクリプト: `apps/soul/agent/scripts/spike-codex-terra.mjs`（使い捨てスパイク）。
- 注入した persona = `fire-orchestrator.mjs:147 FIRE_SYSTEM_PROMPT` の写し（コーディ＝配信の相方・
  短い日本語一言・表情タグ 6 種）。turn 1 の入力先頭へ埋め込み（現行 Claude 契約もセッション生成時
  固定 systemPrompt＝brain-swap.md §4 の「実質段差なし」を踏襲）。turn 2 以降は user 一言のみ。
- **注意（TTFT 相当が取れない理由）**: codex `--experimental-json` の event schema は agent_message を
  **完成テキストの `item.completed` で 1 回**流す（トークン delta イベントが無い）。よって「最初の
  トークンまで」は観測できず、**`firstAgentMsg` ＝ 応答全文の到達時刻**（≒ `turnCompleted`）。

## 3. 生データ

### 3-1. S-1/S-2 主計測（effort=none・1 thread × 10 往復・thread_id `019f6d46-4a5e-70c1-abc0-677e125e27e4`）

`elapsed` = ask 開始 → generator 完了の wall-clock。`firstEvt` = 最初のイベント（プロセス spawn +
thread.started/resume 到達）。`firstMsg` = agent_message（応答全文）到達。`turnDone` = turn.completed。
`tools` = エージェント行動 item（command_execution 等）の数。単位 ms。

| # | 入力 | elapsed | firstEvt | firstMsg | turnDone | 応答文字数 | tools | in_tok | cached_in | out_tok |
|---|------|--------:|---------:|---------:|---------:|-----------:|------:|-------:|----------:|--------:|
| 1（cold） | こんばんは、配信始まったね！ | **4127.0** | 645.0 | 3627.9 | 3679.6 | 21 | 0 | 11584 | 0 | 14 |
| 2 | 今日はちょっと疲れてるんだ。 | 4205.3 | 319.1 | 3741.5 | 3798.9 | 21 | 0 | 23198 | 11008 | 32 |
| 3 | この後どのゲームやるの？ | 4439.9 | 311.6 | 2829.7 | 2883.0 | 21 | 0 | 34845 | 22016 | 54 |
| 4 | コメント速すぎて追えないね（笑） | 3390.1 | 311.3 | 2928.9 | 2980.2 | 21 | 0 | 46531 | 33536 | 74 |
| 5 | さっきのプレイすごかった！ | 3936.8 | 312.7 | 3187.7 | 3243.2 | 20 | 0 | 58253 | 45056 | 89 |
| 6 | お腹すいてきたなあ。 | 3536.7 | 308.5 | 2967.6 | 3021.6 | 27 | 0 | 70005 | 56576 | 114 |
| 7 | 急に雨降ってきたよ、そっちはどう？ | 3303.4 | 317.5 | 2817.2 | 2874.3 | 26 | 0 | 81802 | 68096 | 135 |
| 8 | 初見です、よろしく！ | 4406.0 | 313.3 | 2705.0 | 2755.0 | 23 | 0 | 93632 | 79616 | 154 |
| 9 | なんだか眠くなってきちゃった。 | 3290.8 | 311.7 | 2828.5 | 2880.5 | 18 | 0 | 105498 | 91136 | 172 |
| 10 | そろそろ終わりの時間かな？ | **6451.9** | 306.0 | 5962.3 | 6018.7 | 17 | 0 | 117399 | 102656 | 190 |

**turn 1 の event timeline（生）**: thread.started@645.0 → turn.started@670.3 → item.completed(agent_message)@3627.9 → turn.completed@3679.6。
（中間の item.updated/reasoning は一切無し＝完成テキストが一度に届く。）

**S-2 応答原文 10 本**（すべて短い日本語一言・英語混入 0・ツール混入 0・表情タグは persona 語彙どおり）:

| # | 応答 |
|---|------|
| 1 | こんばんは、今日もよろしくね\<smile\> |
| 2 | そっか、無理しないでね\<troubled\> |
| 3 | まだ決めてないけど、ゆるく遊べるのがいいね |
| 4 | ほんとだ、みんな元気すぎるね\<smile\> |
| 5 | ありがとう、めっちゃ嬉しい\<smile\> |
| 6 | 配信終わったら何かおいしいもの食べよっか\<smile\> |
| 7 | こっちも降ってきた、急だったね\<surprised\> |
| 8 | 初見さんいらっしゃい、よろしくね\<smile\> |
| 9 | 眠かったら無理せず休んでね\<nod\> |
| 10 | うん、そろそろ締めようか\<nod\> |

### 3-2. S-1 effort 比較（新スレッド・各 2 発・先頭発話は cold）

| effort | # | 入力 | elapsed | firstEvt | firstMsg | turnDone | 応答 | out_tok | reasoning_tok |
|--------|---|------|--------:|---------:|---------:|---------:|------|--------:|--------------:|
| low | 1 | 好きな食べ物は何？ | 3444.3 | 399.3 | 2989.2 | 3042.4 | ラーメンかな、特に味噌。 | 16 | 0 |
| low | 2 | 今日は何して過ごしたの？ | 3963.6 | 665.1 | 3534.2 | 3583.9 | 今日は君と話せるのを楽しみにしてたよ\<smile\> | 37 | 0 |
| medium | 1 | 最近ハマってることある？ | 3797.8 | 324.4 | 3356.8 | 3404.6 | 最近は気になることを深掘りするのにハマってるよ\<smile\> | 26 | 0 |
| medium | 2 | この配信の見どころを教えて！ | 3278.7 | 315.2 | 2799.1 | 2861.2 | コーディとのゆるい掛け合いかな\<smile\> | 46 | 0 |

**注目**: low/medium でも `reasoning_output_tokens=0`。短い雑談では効果段（reasoning）が発火せず、
none/low/medium のレイテンシは**すべて ~3.3〜4.0s に重なる**（effort ダイヤルが速度を動かさない）。
high/xhigh は「速度スパイク」に無関係なので未計測。

### 3-3. S-4 画像（1 発・余力内）

| 項目 | 値 |
|------|----|
| キャプチャ対象窓 | `ChatGPT`（列挙 9 件の先頭・完全一致タイトル） |
| キャプチャ | 1024×554 / JPEG base64 86432 文字（≈63KB）/ 撮影 625ms（PrintWindow 経由 `src/eyes/window-capture.mjs`） |
| 橋渡し | base64 → スクラッチ dir に一時 jpg 書出 → `local_image` で run → run 後に即削除（finally で scratch ごと rm・**削除確認済み**） |
| Terra 往復 | elapsed **4081.0ms** / firstEvt 645.3 / firstMsg 3574.1 / turnDone 3633.6ms |
| usage | in_tok 12344（画像で +~750）/ cached 0 / out 17 / reasoning 0 |
| 応答 | 「画像もちゃんと表示できてるね\<smile\>」（画像受領を確認した短い一言・ツール混入 0） |

### 3-4. S-3 セッション永続の観察（枠消費 0・件数のみ・中身は不読）

| 時点 | `~/.codex/sessions` ファイル数 | 増分 |
|------|-------------------------------:|-----:|
| 実行前 | 4489 | — |
| main 後 | 4491 | +2（失敗した minimal スレッド + 成功 10 往復スレッド） |
| effort 後 | 4493 | +2（low スレッド + medium スレッド） |
| image 後（最終） | 4494 | +1（image スレッド） |

→ **スレッド 1 本につき rollout ファイル 1 つ**（往復ごとではない・resume が同一ファイルに追記）。
成功スレッドのファイル名は `rollout-2026-07-17T08-32-30-019f6d46-4a5e-70c1-abc0-677e125e27e4.jsonl`
（thread_id と一致・**中身は開いていない**）。**注入文（persona + 全 user 発話 + 応答）が丸ごとディスクに残る**。

## 4. 導出値

- **speed（本丸）**: effort=none の 1 往復 wall-clock は **中央値 ~4.0s**（10 発の中央 (3936.8+4127)/2=4031.9ms・
  最小 3290.8ms・最大 6451.9ms）。**cold（turn1）4127ms は warm と大差ない**——SDK は **run() ごとに
  codex CLI を毎回 spawn する**（`dist/index.js` の `spawn()` は run 内・§6 参照）ため、常駐概念が薄く
  cold/warm 差が小さい。**spawn オーバーヘッドは firstEvt に現れ warm ~310ms / cold ~645ms**＝
  恐れていた「12 秒 spawn」ではない（この環境では spawn は安い・律速はモデル往復）。
- **Claude 経路との並記**（[s1-first-light.md](s1-first-light.md) §3 の生値）:
  | 経路 | cold elapsed | warm elapsed | TTFT（最初のトークン） | 外れ値 | 長回し（ユーザー観測） |
  |------|-------------:|-------------:|----------------------|-------:|----------------------|
  | Claude Opus 常駐 | 4960.7ms | **3194.3 / 3345.2ms** | **1267.6 / 1227.6ms**（ストリーミング有） | 9240.6ms | ≈10s まで劣化しうる |
  | Terra @none（Codex SDK） | 4127.0ms | 中央 ~4.0s（3.29〜4.44s） | **無し**（agent_message は完成一括・§0） | 6451.9ms（turn10） | 本スパイク 10 往復では強い劣化傾向なし・turn10 のみ 6.45s |
  → **Terra @none は wall-clock で Claude warm より速くない**（むしろ中央値でやや遅い ~4.0s vs ~3.2s）。
  かつ **codex-sdk 経路はトークンストリーミングを出さない**ため、Claude が持つ「TTFT ~1.2s で先頭文の
  TTS を先行開始できる」利点が無い。「声が鳴り始めるまで」の体感では Terra 経路が不利になりうる。
- **effort は速度に効かない**（短い雑談）: none/low/medium すべて ~3.3〜4.0s・reasoning_tok=0。
  Terra の reasoning は短文雑談では発火せず、ダイヤルは体感速度を動かさなかった。
- **codex のベース文脈が重い**: turn1 で in_tok=11584（persona ~250tok + 一言 ~15tok に対し）＝
  **codex 自身のコーディングエージェント scaffolding が ~11.3k tok** 常に乗る。resume で履歴を毎回
  再生し in_tok は 11.6k→117k（10 往復）まで伸びるが、**cached_in が最大 102k まで追随**するため
  レイテンシは概ね平坦に保たれた（キャッシュが効いている）。out_tok は 14→190 と**スレッド累積の
  走行合計**として報告される（毎往復の増分 14〜25tok が各応答長と一致）。

## 5. 所見（判定材料）

1. **速度動機は「立たない」寄り**。Terra @none は Claude Opus warm と同程度〜やや遅く、かつ
   **トークンストリーミングが無い**分「発話が始まるまで」は不利。ユーザーが体感で欲した「速さ」は、
   少なくとも codex-sdk `--experimental-json` 経路の Terra では**明確な優位が出なかった**（生数字）。
2. **素チャット安定性は満点**（S-2）: main 10 + effort 4 + image 1 = **15/15 が短い日本語一言・
   ツール混入 0・英語混入 0・persona/表情タグ準拠**。コーディングエージェントの地金は
   sandbox=read-only + approval=never + persona 注入で完全に抑えられた。差し替えの「素チャット化」は
   実務上クリア。
3. **`minimal` 非対応**（§1 追記の 400）＝設計 §3/§6 の想定にズレ。Terra の最速は `none`。
   知性契約/操縦席 UX を書くなら effort 選択肢は `none/low/medium/high/xhigh`。
4. **セッション永続はディスクに落ちる**（S-3・§7 で詳述）。SDK 経由では実質不可避。設計 §5 #5 の
   流儀差（視聴者コメント込みの注入文がディスクに残る）は**確定事実**として受容裁定が要る。
5. **spawn は安い**（~310ms warm）。SDK の run() 毎 spawn 設計は、この環境では律速でない。

## 6. codex-sdk API の地の真実（`dist/index.d.ts` / `dist/index.js` を読んだ確定事項）

- `new Codex({config, env, apiKey, baseUrl})` → `startThread(ThreadOptions)` / `resumeThread(id, ThreadOptions)`。
- `ThreadOptions`: `model` / `sandboxMode`(read-only|workspace-write|danger-full-access) / `workingDirectory` /
  `skipGitRepoCheck` / `modelReasoningEffort` / `webSearchEnabled` / `approvalPolicy`(never|on-request|…) /
  `additionalDirectories` / `networkAccessEnabled` / `webSearchMode`。
- `thread.run(input)` / `thread.runStreamed(input, {signal, outputSchema})`。`input` = string | `{type:"text"}` /
  `{type:"local_image", path}` の配列。
- **run() は毎回 `spawn(codex, ["exec","--experimental-json", …])`**（`src/exec.ts`）。thread 継続は
  2 発目以降 `resume <thread_id>` を CLI 引数に足して**`~/.codex/sessions` の rollout を読み直す**方式
  ＝**SDK のマルチターン継続はディスク永続に依存する**。
- event: `thread.started`(thread_id) / `turn.started` / `item.started|updated|completed`(item) /
  `turn.completed`(usage) / `turn.failed`(error) / `error`(message)。**agent_message のトークン delta は無い**。
- `usage` 形: `{ input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens }`（実測確認）。

## 7. S-3 詳細: セッション永続の無効化可否

- codex CLI には **`--ephemeral`（"Run without persisting session files to disk"）** が存在する
  （`codex exec --help` で確認）。
- しかし **codex-sdk 0.144.5 はこれを露出していない**: `ThreadOptions` に無く、`--ephemeral` は
  **bare フラグ**なので `config`（`--config key=value`）としても渡せない。SDK に生引数の passthrough も無い。
- さらに **SDK のマルチターン = `resume`（ディスクの rollout を読む）** なので、仮に ephemeral 化すると
  turn2 の resume 元が消え**マルチターンが壊れる**（永続無効化とSDKのスレッド継続は両立しない）。
- `CODEX_HOME` を退避先へ向ける手も、auth.json が `~/.codex` にあるため**認証が壊れる**（不採用・
  かつ auth 触りは厳守事項違反）。
- **config での無効化キーは見当たらない**（`--ephemeral` は config パスを持たない bare フラグ）。
  → 結論: **SDK 経由では注入文が `~/.codex/sessions` に必ず残る**。回避したいなら (a) codex-sdk を
  フォーク/パッチして `--ephemeral` を足し「毎発火=使い捨てスレッド・文脈は転写バッファから毎回再注入」
  （"転写が正・セッションは使い捨て"の思想と実は合致）か、(b) 永続を受容する、の二択。実装 wave で裁定が要る。
- **課金非干渉**: OPENAI_API_KEY 未設定 + `forced_login_method="chatgpt"` で、SDK は `CODEX_API_KEY` を
  設定せず（apiKey 未指定のため）サブスク OAuth で走った。400 エラーがモデルエンドポイントから返った
  ＝ API キー経路に落ちていない裏取り。

## 8. 失敗・未実施・不明点（正直な列挙）

- **失敗 1 発**: 初回 `effort=minimal` が 400（Terra 非対応）。生成前棄却＝おそらく枠非消費だが保守的に
  1 発計上（16 発中）。以後 `none` で成功。
- **未実施**: `effort=high/xhigh`（速度スパイクに無関係）。TTS/実器 E2E（本スパイクの範囲外）。
- **不明点 a**: `firstAgentMsg`＝完成テキスト到達であり、**真の TTFT（最初のトークン）は codex-sdk
  `--experimental-json` 経路では観測不能**。Terra 自体がストリーミング可能かは別 API 経路の話で本スパイク
  では判定できない（codex 経路の性質として「先頭文先行 TTS」は使えない、が確定事項）。
- **不明点 b**: `out_tok` がスレッド累積の走行合計に見える（増分は各応答長と一致）。SDK/CLI の usage 集計の
  内部仕様は未確認——生値をそのまま §3 に記録した（解釈は最小限）。
- **不明点 c**: 長回し劣化は 10 往復（in_tok 最大 117k）では turn10 の 6.45s 一発のみで、強い上昇トレンドは
  出なかった。Claude で観測された「≈10s」相当まで伸びるかは、より長いセッションでないと分からない
  （キャッシュが効いている間は平坦に見える）。
- **shell_tool=false**: 設計 §6 の `shell_tool=false` に対応する config キーは SDK/CLI で確証が取れず未設定。
  代わりに sandbox=read-only + approval=never で封じ、S-2 でツール混入 0 を実測確認した（結果として不要だった）。

## 9. 質問（Gnome → Undine）

1. **速度判定**: 生数字は「Terra @none ≈ Claude warm（やや遅い）+ ストリーミング無しで体感不利」。
   これはユーザー動機（速さ）に対して**否定寄りの材料**。ユーザー体感裁定（brain-swap.md §5-3）へ
   この並記表（§4）を渡す形でよいか。それとも別プロンプト構成（例: persona を薄くして codex ベース
   文脈 ~11k を削れないか探る）で再スパイクすべきか。
2. **永続の受容 or フォーク**（§7）: SDK 経由では注入文がディスクに残る。(a) codex-sdk パッチで
   `--ephemeral`+毎発火使い捨てスレッド（"転写が正"思想と合致）/ (b) 永続受容、のどちらを実装 wave の
   前提に置くか。ここはユーザー裁定が要る領域と判断（Gnome の一存で決めない）。
3. **effort 既定**: `minimal` 非対応が確定。知性契約の既定 effort は `none`（最速・reasoning 0）でよいか、
   応答品質を見て `low` にするか（速度差はほぼ無い）。

---

**成果物**:
- スパイクスクリプト: `apps/soul/agent/scripts/spike-codex-terra.mjs`
- 本記録: `discussion/ai-cohost/experiments/brain-swap-terra.md`
