# Domain A(記憶の器官: src/mind/memory.mjs)design(コード品質)レビュー

> レビュアー: Review-Sylph(design レーン=設計品質/コード品質・読み取り専任)。呼び出し元: Orch-Sylph。
> 対象: `apps/soul/agent/src/mind/memory.mjs`(新設)・`memory.test.mjs`(新設)・`apps/soul/agent/.gitignore`(追記)。
> 突合先(自分で Read): `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs`(ローカルファイル永続化の意匠写経元)・`apps/soul/agent/src/mind/fire-injection.mjs`(流用してはいけない対象)・`apps/soul/agent/src/mind/brains.mjs`(MindSession 契約)・`apps/soul/agent/src/mind/fire-orchestrator.mjs`(FIRE_SYSTEM_PROMPT :147-)。
> 参照: `discussion/ai-cohost/soul/stream-memory.md`・`stream-memory-inventory.md`(L0 設計判断 7 件)・`stream-memory-wave-plan.md`(§3/§4)。
> 既存レビュー: spec レーン(`domain-a-spec.md`)・test レーン(`domain-a-test.md`)はいずれも合格判定済み。本レビューはそれらと重複しないコード品質固有の観点に絞る。

## 総合判定: **合格**(blocking 相当の要修正なし・推奨改善 3 件)

## 観点別評価

### 1. 純関数と I/O の分離

- 良好。`labelOf`(:54-58)・`formatDigestLine`(:70-73)・`formatTranscriptForDigest`(:83-86)・`digestFileName`(:150-158 ※`new Date().toISOString()` は引数のみに依存する決定的処理)・`composeSystemPrompt`(:249-254)はいずれも I/O ゼロの純関数。
- I/O は `saveDigest`(:172-179・fs 書き込み)と `loadRecentDigests`(:197-235・fs 読み込み)に閉じている。`generateDigest`(:122-141)は LLM I/O を含むが、これは brains 契約(create/ask/dispose)を使う本務であり適切な境界。
- 時計注入: `saveDigest` は `startedAtMs` を呼び出し側から受け取り、内部で `Date.now()` を呼ばない(決定性・テスト容易性が高い)。妥当。

### 2. 意匠写経の正しさ

- `DEFAULT_MEMORIES_DIR`(:44 `join(here, "..", "..", "memories")`)は `cockpit-settings-store.mjs` の `DEFAULT_SETTINGS_PATH`(:62 `join(here, "..", "..", "cockpit-settings.local.json")`)と同型(`here` からの相対階層が同じ `apps/soul/agent` 直下を指す)。`options.dir` 注入も `options.path` 注入と同型。良好。
- `fire-injection.mjs` の `formatFireInjection` への巨大有限値ハック(L0 設計判断 1)は行わず、`formatTranscriptForDigest` を独立の専用関数として新設している。`memory.mjs` の import(:37-39)は `node:fs`/`node:path`/`node:url` のみで `fire-injection.mjs` への依存は無い(spec レーンでも同一根拠で確認済み)。**L0 判断 1 は正しく守られている。**
- **非対称点(推奨改善・後述 §3-A)**: `cockpit-settings-store.mjs` の `writeMerged`(:102-111)は書き込み失敗(mkdirSync/writeFileSync)を try/catch で握り「起動を止めない」失敗寛容を実現しているが、`memory.mjs` の `saveDigest`(:172-179)は `mkdirSync`/`writeFileSync` を素で呼んでおり、この失敗寛容パターンは踏襲されていない。

### 3. 防御性/失敗寛容

- `loadRecentDigests` の欠損耐性は手厚い: dir 不在(:202-207)・空ディレクトリ(readdirSync が空配列を返す通常経路)・壊れたファイル(:218-223 個別 try/catch で握って次へ)いずれも機械テストで固定済み(test レーンで確認済み)。
- `generateDigest` の空転写ガード(:124-127)・create 未指定時の明示的 TypeError(:130-132)・try/finally による dispose 保証(:135-140)は blocking #2 の要求に正確に対応。
- `saveDigest` の型防御: `digest` は非文字列でも `String(digest ?? "")` にフォールバック(:177・寛容)、`startedAtMs` は非数値なら `digestFileName` 内で TypeError(:151-153・非寛容)。この非対称は Gnome 報告 §6-4 で意図的な裁量として説明されており(「パス組み立ての根幹は明確なバグとして落とす・本文は落とさない」)、blocking #6(パス安全)の観点からは妥当な設計判断。
- **A(推奨改善・要検討)**: `saveDigest` 自体はディスク I/O 失敗(権限エラー・容量不足等)に対する try/catch を持たず、例外がそのまま呼び出し元へ伝播する(:176-177)。`loadRecentDigests` は読み込み系の失敗を全経路で握っているのに対し、書き込み系だけ素通しになっている。wave-plan §4 blocking #3(shutdown が固まらない)は Domain B 領分としているため設計上は「Domain B 側で `Promise.race`/try-catch により吸収する前提」と解釈可能だが、**`memory.mjs` 側にも `cockpit-settings-store.mjs` 由来の失敗寛容を効かせておけば、チェックポイント/手動記録/shutdown のいずれの呼び出し経路でも `saveDigest` 一発の失敗で処理全体が巻き込まれるリスクを構造的に消せる**。現状は「Domain B が確実に呼び出し側でラップする」という前提に依存しており、その前提は `memory.mjs` 側のドキュメント/テストには明記されていない。→ 質問として §5 に記載。
- **C(推奨改善・軽微)**: `loadRecentDigests` の `n`/`maxChars`(:198)には `fire-injection.mjs` の `formatFireInjection`(:88-96 `nowMs`/`windowMs`/`maxChars` を `typeof`+`Number.isFinite` で厳格に検証し TypeError)のような型防御が無い。`n` に負値(例 `-1`)を渡すと `mdFiles.slice(0, n)`(:210)が `Array.prototype.slice` の負インデックス解釈(末尾からのオフセット)により「末尾 1 件を除いた全件」という直感に反する挙動になる(理論上のエッジケース・現行呼び出し元は正の定数のみ想定なので実害は無いが、型防御ゼロは同じ mind/ 配下の兄弟モジュールと防御方針が不揃い)。

### 4. 契約整合

- `generateDigest` の `create({ systemPrompt: DIGEST_GENERATION_INSTRUCTION })`(:134)→ `ask(transcriptText)`(:136 `{ replyText }` を分割代入)→ `dispose()`(:139)は `brains.mjs` の `MindSession` 契約(`ask: (content: string | Array<any>) => Promise<MindSessionAskResult>`・`dispose: () => Promise<void>`)と完全に整合。`replyText` 以外のフィールド(`usage`/`ttftMs`/`elapsedMs`)には触れておらず、契約の superset を安全に無視できている。
- `composeSystemPrompt(masque, memoryText)`(:249-254)は `FIRE_SYSTEM_PROMPT`(fire-orchestrator.mjs:147-)のような句点区切りの地の文字列に対し、`\n\n` + 見出し + `\n` + 記憶テキストを追記する形。masque の末尾が句点で終わる通常の文字列である前提と自然に噛み合っており、不自然な結合にはなっていない。

### 5. 命名/可読性/ドキュメント

- 関数名(`formatTranscriptForDigest`/`generateDigest`/`saveDigest`/`loadRecentDigests`/`composeSystemPrompt`)は動詞+目的語の明確な命名で、`cockpit-settings-store.mjs`(`getXxx`/`setXxx`)・`fire-injection.mjs`(`formatFireInjection`)と一貫したスタイル。
- JSDoc はファイル冒頭のブロックコメント(:1-35)で上位文書・blocking 番号への対応まで明記しており、既存モジュール(`fire-injection.mjs` :1-24 のコメントスタイル)と同水準の丁寧さ。
- ファイル名形式(辞書順=時系列)の設計は `digestFileName`(:150-158)のコメント(:144-146)と `loadRecentDigests` のコメント(:183-184「ファイル名降順(= 新しい順、digestFileName が辞書順=時系列順であることを利用)」)で相互参照が明記されており、この密結合は意図的かつドキュメント化されている。良好。
- **B(推奨改善・軽微)**: `labelOf`(memory.mjs:54-58)は `fire-injection.mjs` の `labelOf`(:37-41)と完全に同一のロジック(you/soul/viewer の 3 分岐)。L0 設計判断 1 が禁止しているのは「整形関数(窓絞り・文字数上限込み)の使い回しハック」であり、この 3 行の話者分類ヘルパー自体まで独立させる必然性は薄い。共通ユーティリティへ抽出しても意匠の独立性(viewer 行の描き方の違い=displayName の扱い)は損なわれない。ただし影響は軽微(3 行の重複)で、動作上の問題は無い。

### 6. 潜在バグ

- 空配列: `formatTranscriptForDigest([])` → `""`(:84-86 `Array.isArray` ガードあり)。問題なし。
- `maxChars=0`/負値: `loadRecentDigests` の打ち切りロジック(:224-228)は `parts.length > 0` を条件にしているため、`maxChars` がどんな値でも最初の 1 件は必ず採用される安全弁が効く(0 や負値でもクラッシュせず 1 件は返る)。意図通り。
- `n=0`: `mdFiles.slice(0, 0)` → `[]` → `{ text: "", count: 0 }`。妥当な動作。`n` が負値の場合は上記 C の通り直感に反する挙動になり得るが、型防御が無いだけで実害があるわけではない。
- 同名ファイル: `startedAtMs` が完全一致(秒単位)すれば意図通り同一ファイルへ収束(裁定 4)。ミリ秒以下は `digestFileName` で切り捨てられるため、同一プロセス内で同一 `startedAtMs` を使い回す設計(Gnome 報告の前提)であれば問題ない。
- タイムゾーン: UTC 固定(`toISOString()`)。裁量判断として明記済みで disclosure なし、妥当。
- ソートの安定性: `mdFiles.filter(...).sort().reverse()`(:209)は文字列既定比較(lexicographic)で ISO 由来のファイル名に対して正しく機能する。同名ファイルはファイルシステムの制約上発生しない。問題なし。

## 差分・要修正

**blocking 相当の要修正はなし。** 以下は推奨改善(判定に影響しない):

1. **(A)** `saveDigest`(memory.mjs:172-179)の `mkdirSync`/`writeFileSync` を try/catch で囲み、`cockpit-settings-store.mjs` の `writeMerged` と同型の失敗寛容にすることを検討されたい。現状は Domain B 側(cockpit.mjs)が呼び出し元で確実に try/catch する前提に依存しており、その前提はコード上に明示されていない。
2. **(B)** `labelOf`(memory.mjs:54-58)は `fire-injection.mjs` の同名関数と完全重複。共通ヘルパーへ抽出してもよいが必須ではない(3 行の軽微な重複)。
3. **(C)** `loadRecentDigests` の `n`/`maxChars` に、`fire-injection.mjs` の `formatFireInjection` と同水準の型防御(TypeError)を足すと、mind/ 配下の防御方針が揃う。現状のリスクは理論上のエッジケース(負値の `n`)のみ。

## 裁量判断の妥当性(Gnome 報告 §6)

1. ファイル名形式(UTC 固定・ISO 由来・コロン除去): 妥当。辞書順=時系列という `loadRecentDigests` の前提を機械テストで固定しており、設計判断・裁定に反しない。
2. `generateDigest` の引数形(`{brainDef, createImpl, entries}`・`createImpl` 優先): 妥当。fake 注入の容易さを優先した合理的選択で、`MindSession` 契約とも齟齬なし。
3. `loadRecentDigests` の `maxChars` 超過時の切り方(ファイル単位・最初の 1 件は必ず含める): 妥当。`fire-injection.mjs` の「最新 1 行は必ず残す」思想を正しく踏襲しつつ、ファイル=意味のあるまとまりという性質の違いを踏まえて単位をファイルへ変えている判断は筋が通っている。
4. `saveDigest` の `digest` 引数型防御(寛容)と `startedAtMs`(非寛容)の非対称: 理由(パス組み立ての根幹は明確なバグとして落とす)は妥当。ただし上記 A の観点(I/O 失敗自体への非寛容)とは別軸の話であり、混同しないよう注意されたい。
5. `MEMORY_SECTION_HEADER` 非 export: 妥当。差し替え口を一本化する設計として自然。

いずれも裁定・L0 設計判断に反する選択は無い。

## 質問

1. **`saveDigest` の書き込み失敗(ディスク I/O エラー)の扱い**: `cockpit-settings-store.mjs` は書き込み失敗をモジュール内で握る意匠だが、`memory.mjs` の `saveDigest` は素通しで例外を投げる。これは「Domain B 側(cockpit.mjs)が呼び出し箇所(チェックポイント/手動記録/shutdown)ごとに確実に try/catch する」という前提の上に成り立つ設計に見えるが、この前提は `memory.mjs` 側のドキュメント・テストいずれにも明記されていない。Domain B 実装時にこの前提を踏襲する(全呼び出し箇所を try/catch で包む)予定があるか、それとも `memory.mjs` 側で失敗寛容にしておくべきか、確認をお願いしたい。blocking ではないが、shutdown 経路(best-effort+timeout)の堅牢性に関わるため Domain B 着手前に方針を決めておくことを推奨する。
