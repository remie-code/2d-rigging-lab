# 配信間記憶 Domain A「記憶の器官」— 実装報告

> 実装者: Gnome（サブエージェント委任・Orch-Sylph 経由）。
> 対象: `apps/soul/agent/src/mind/memory.mjs`（新設）+ `apps/soul/agent/src/mind/memory.test.mjs`（新設）+ `apps/soul/agent/.gitignore`（追記）。
> 根拠文書: [stream-memory.md](../../../soul/stream-memory.md)（裁定 7 件）・[stream-memory-inventory.md](../../orchestration/stream-memory-inventory.md)（L0 設計判断 7 件）・[stream-memory-wave-plan.md](../../orchestration/stream-memory-wave-plan.md)（§3 Domain A・§4 blocking 基準）。

## 1. 実装した関数の一覧と署名

いずれも `apps/soul/agent/src/mind/memory.mjs`。純関数と I/O を分離し、`@ts-check` 準拠。

### `formatTranscriptForDigest(entries)`
- 引数: `ReadonlyArray<{ text: string; speaker?: string; displayName?: string }>`（transcript-buffer.mjs `all()` が返す形をそのまま受理）。
- 返り値: `string`（話者ラベル付きの 1 本のダイアログ・改行結合。空配列 → 空文字列）。
- 意味論: `you: 本文` / `soul: 本文` / `viewer: 本文`。**viewer 行は displayName（視聴者名）を一切描かない**（fire-injection.mjs の `formatLine` が描く `viewer(名前): 本文` の意匠は真似ていない）。未知話者は `you` に寄せる（防御的）。窓絞り・文字数上限はここでは行わない全量整形の専用純関数（formatFireInjection へのハック流用はしていない・L0 設計判断 1 に準拠）。

### `DIGEST_GENERATION_INSTRUCTION`（定数・string）
- ダイジェスト生成指示の日本語文。内容: 配信の出来事/交わした話題・ジョーク・言い回し(callback の種)/配信者について分かったこと。「視聴者の名前や、個人を特定できる情報は一切書かないでください」を明記(blocking #1 第二防御)。分量目安 1500 字程度と明記。指示文自体の長さは 1500 字未満(機械テストで固定)。

### `generateDigest({ brainDef, createImpl, entries })`
- 引数: `brainDef`(brains registry の 1 エントリ相当・`{create}` を持つ)・`createImpl`(create の差し替え口・**createImpl があれば createImpl を優先**)・`entries`(全量転写)。
- 返り値: `Promise<string | null>`。空転写(`formatTranscriptForDigest` の結果が空文字列)なら **create を呼ばず** `null` を返す。
- 意味論: `create({ systemPrompt: DIGEST_GENERATION_INSTRUCTION }) → ask(整形済み転写) → dispose()` を実行し `replyText` を返す。**dispose は try/finally で必ず呼ぶ**(ask が throw/reject しても呼ばれる)。常駐セッションには一切触れない自前の使い捨てセッション(blocking #2)。`create`/`createImpl` がどちらも関数でなければ `TypeError` を throw。

### `saveDigest(digest, { dir, startedAtMs })`
- 引数: `digest: string`・`dir`(既定 `DEFAULT_MEMORIES_DIR`)・`startedAtMs: number`(必須・ファイル名の元)。
- 返り値: 書き込んだファイルの絶対パス(`string`)。
- 意味論: `<dir>/<startedAtMs から導いたファイル名>.md` へ書く。**同一 startedAtMs は常に同一ファイル名 → 上書き**。`mkdirSync(dir, {recursive:true})` でディレクトリ自動作成。ファイル名はコロンを含まない ISO 由来の文字列(例 `2026-07-19T14-30-00.md`)で、辞書順=時系列昇順(loadRecentDigests の降順ソートの前提)。パス組み立てに使う外部入力は無い(digest 本文はファイル内容としてのみ書く・パスには使わない)。

### `loadRecentDigests({ dir, n, maxChars })`
- 引数: `dir`(既定 `DEFAULT_MEMORIES_DIR`)・`n`(既定 `DEFAULT_DIGEST_COUNT`=3)・`maxChars`(既定 `Infinity`=無制限)。
- 返り値: `{ text: string; count: number }`。`text` は `composeSystemPrompt` にそのまま渡せる形(ダイジェスト本文を `\n\n` で連結)。`count` は実際に搭載した件数(UI の「記憶 N 件を搭載」表示用)。
- 意味論: `.md` 拡張子のみ読む・ファイル名降順(新しい順)で最大 `n` 件・**ファイル単位で合計 `maxChars` を超えないよう打ち切る**(文章を途中で割らない。最初の 1 件は上限超過でも必ず含める=空を返さない安全弁)。`dir` 不在・空ディレクトリ → `{text:"", count:0}`。個別ファイルの読み取り失敗は握って次へ進む(欠損耐性)。

### `composeSystemPrompt(masque, memoryText)`
- 引数: `masque: string`(FIRE_SYSTEM_PROMPT)・`memoryText: string | null | undefined`。
- 返り値: `string`。
- 意味論: `memoryText` が空文字列・空白のみ・null・undefined のいずれかなら **素の masque をそのまま返す**(blocking #4 OFF の完全性・注入側)。それ以外は `masque + 見出し + memoryText` を合成して返す。

### 定数
- `DEFAULT_MEMORIES_DIR` = `join(here, "..", "..", "memories")` = `apps/soul/agent/memories/`(cockpit-settings-store.mjs の `DEFAULT_SETTINGS_PATH` と同型の写経)。
- `DEFAULT_DIGEST_COUNT` = `3`(裁定 3)。

## 2. blocking 基準への対応箇所

- **#1 視聴者情報の秘匿(二重防御)**: 第一防御は `formatTranscriptForDigest`(`memory.mjs` 内 `formatDigestLine`)— viewer 行から displayName を完全に除外し `viewer: 本文` のみで描く。機械テスト `memory.test.mjs` の `"formatTranscriptForDigest: viewer の displayName（視聴者名）は出力に一切現れない（blocking #1 機械固定）"` で 2 種の視聴者名(`とある視聴者A`・`視聴者B太郎`)が出力文字列に一切含まれないこと、かつ括弧意匠を真似ていないことを固定。第二防御は `DIGEST_GENERATION_INSTRUCTION` に視聴者名・個人特定情報の禁止を明記(機械テストで文言存在を固定)。
- **#2 常駐の不汚染**: `generateDigest` は `brainDef`/`createImpl` から**自分で** create した使い捨てセッションのみを使う。常駐 session を受け取る引数は存在しない(契約上そもそも触れない)。機械テスト `"generateDigest: 常駐セッションには一切触れない"` で、別途用意した `residentSession`(呼ばれたら throw する ask/dispose)が一切呼ばれないことを確認。`"create→ask 一発→dispose"` テストで create 1 回・ask 1 回・dispose 1 回を固定。`"ask が throw しても dispose は必ず呼ばれる"` テストで try/finally を固定。
- **#3 shutdown が固まらない**: Domain B の領分のため対象外(本報告では扱わない)。
- **#4 OFF の完全性(注入側)**: `composeSystemPrompt` が memoryText 空/null/undefined/空白のみで素の masque を返すことを 4 パターンの機械テストで固定。
- **#6 メモリファイルの安全**: `saveDigest`/`loadRecentDigests` は呼び出し側が渡した `dir` 配下のみを触る(既定値も `apps/soul/agent/memories/` に固定)。ファイル名は `startedAtMs`(制御された数値)からのみ導出し、転写本文・話者名などの外部入力はパス組み立てに一切使わない。`loadRecentDigests` は `.md` 拡張子のみ読む(機械テストで `.txt`/拡張子なしファイルが無視されることを固定)。全テストは `fs.mkdtempSync(os.tmpdir())` のスクラッチディレクトリのみを使い、実体の `apps/soul/agent/memories/` はテスト後も生成されていないことを実行後に確認済み(`ls apps/soul/agent/memories` → `No such file or directory`)。

## 3. `node --test` の生 tail

### memory.test.mjs 単体(27 件)
```
1..27
# tests 27
# suites 0
# pass 27
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 189.003
```

### apps/soul/agent 全体(ベースライン 887 + 新規 27 = 914)
```
1..914
# tests 914
# suites 0
# pass 914
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6262.7303
```

## 4. `git diff --stat` の生出力

```
apps/soul/agent/.gitignore | 6 ++++++
1 file changed, 6 insertions(+)
```
(`memory.mjs` / `memory.test.mjs` は新規ファイルのため `git diff --stat` の追跡対象外。`git status --short` では下記の通り新規ファイルとして現れる。)

```
 M apps/soul/agent/.gitignore
?? apps/soul/agent/src/mind/memory.mjs
?? apps/soul/agent/src/mind/memory.test.mjs
```

他ファイル(`.tmp/`・`apps/authoring-host/`・`discussion/mesh-generation/`・`discussion/model-authoring/` 等)の変更は本タスク開始前から存在していた別作業由来であり、本セッションでは一切触れていない(タスク開始時の git status と対照して確認済み)。

## 5. 追加/変更したファイルの絶対パス一覧

- 新設: `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\memory.mjs`
- 新設: `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\memory.test.mjs`
- 追記(6 行): `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\.gitignore`
- 本報告: `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\stream-memory\domain-a.md`

## 6. 裁量判断(設計未定義を合理的に埋めた箇所)

1. **ファイル名形式**: `new Date(startedAtMs).toISOString()` からミリ秒以下+`Z` を除去し、コロンをハイフンへ置換した形(例 `2026-07-19T14-30-00.md`)を採用。UTC 固定・辞書順=時系列昇順を機械テストで固定(`saveDigest: ファイル名は辞書順 = 時系列昇順になる`)。タイムゾーンをローカルにする案もあったが、UTC のほうが実装が単純で衝突の心配がないためこちらを採用した。Domain B 側で表示用にローカル時刻へ変換する場合は別途対応が要る点は申し送り。
2. **`generateDigest` の引数形**: wave-plan は「brainDef(または create)を注入口として受け」とだけ指定していたため、`{ brainDef, createImpl, entries }` という 1 オプションオブジェクトの形に確定した。`createImpl` を優先するフォールバック順にしたのは、テストでの差し替えやすさ(brains registry 全体を模す必要がない)を優先したため。
3. **`loadRecentDigests` の maxChars 超過時の切り方**: 仕様文言は「合計サイズ上限(maxChars で切る)」とだけで、行単位か・ファイル単位かの指定はなかった。ダイジェストファイルは 1 配信 1 ファイルの意味あるまとまりであり、fire-injection.mjs のような「行単位で古い方を削る」方式だと文章が意味不明な断片になり得ると判断し、**ファイル単位で丸ごと含める/含めないを判定し、最初の 1 件だけは上限超過でも必ず含める**(空を返さない安全弁)方式に決めた。formatFireInjection の「最新 1 行は常に残す」の思想を踏襲。
4. **`saveDigest` の `digest` 引数の型防御**: `digest` が文字列でない場合(null 等)は `String(digest ?? "")` にフォールバックして書き込む(呼び出し側のバグで即クラッシュしない・cockpit-settings-store.mjs の「失敗寛容」の空気に寄せた)。ただし `startedAtMs` は必須・不正なら `TypeError` を投げる(こちらは呼び出し側の明確なバグなので黙殺しない・transcript-buffer.mjs の validate 方針に寄せた)。
5. **`composeSystemPrompt` の見出し文言**: `MEMORY_SECTION_HEADER`(「これまでの配信で起きたことの記憶(参考程度に踏まえてください)」)という非 export の内部定数を新設。wave-plan に見出し文言の指定は無かったため、LLM への合成テキストとして自然な形を自分で決めた。Domain B で見出し文言を変えたい場合は本ファイルの `MEMORY_SECTION_HEADER` を書き換えるだけで済む(export はしていない=外部から見出しだけ差し替える口は無い)。

## 7. 質問(判断に迷った点・Domain B への申し送り)

1. **`loadRecentDigests` の `count` の定義**: 「上限で打ち切られたファイルはカウントに入れない」という実装にした(`parts.push` した件のみ count に加算)。UI の「記憶 N 件を搭載」表示と一致する定義のつもりだが、Domain B 側の意図(例えば「試みた件数」を見せたいのか「実際に文字が入った件数」を見せたいのか)によっては調整が必要かもしれない。要確認。
2. **`generateDigest` の `ask` への入力形**: 現状 `ask(transcriptText)` は文字列のみを渡している(brains.mjs の `MindSession.ask` は `string | Array<any>` を受理するが、視覚発火のような content ブロック配列は使っていない)。ダイジェスト生成に画像等を含める予定は soul §3 に無かったため文字列のみとした。将来「配信のスクリーンショットも記憶に含める」という要求が出た場合は `generateDigest` のシグネチャ変更が必要になる旨、申し送り。
3. **`maxChars` の既定値を `Infinity` にした点**: wave-plan/inventory は「合計サイズ上限つき」とだけあり、具体的な既定文字数(例えば FIRE_MAX_CHARS=4000 のような値)は指定されていなかった。Domain B 側で `composeSystemPrompt` に渡す前に呼ぶ実際の運用コードでは、具体的な `maxChars`(例えば仮面+記憶+当日窓の合計トークン予算を勘案した値)を明示的に渡すことを推奨する。Domain B の配線コードでこの値を決め打ちする際は、本モジュールにハードコードされた定数が無い点に注意されたい。
4. **開示文言の改訂**: wave-plan §6 により L0 直轄・wave 外の扱いなので本ドメインでは一切手を付けていない。念のため申し送りのみ。
