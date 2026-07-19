# Domain A(記憶の器官: src/mind/memory.mjs)spec 遵守レビュー

> レビュアー: Review-Sylph(spec 遵守レーン・読み取り専任)。呼び出し元: Orch-Sylph。
> 対象: `apps/soul/agent/src/mind/memory.mjs`(新設)・`memory.test.mjs`(新設)・`apps/soul/agent/.gitignore`(追記)。実装ソースを自ら通読して検証(Gnome 自己申告 = `discussion/ai-cohost/implementation/waves/stream-memory/domain-a.md` は鵜呑みにせず file:line で裏取り)。
> 参照: `discussion/ai-cohost/soul/stream-memory.md`(裁定 7 件)・`discussion/ai-cohost/implementation/orchestration/stream-memory-inventory.md`(L0 設計判断 7 件)・`stream-memory-wave-plan.md`(§3 Domain A・§4 blocking 基準 6 項)。
> 実測: `apps/soul/agent` で `node --test` を自分で実行 → `tests 914 / pass 914 / fail 0`(ベースライン 887 + 新規 27・Gnome 申告と一致)。`git status --short -- apps/soul/agent`(repo root から)で変更が `.gitignore`(M)+ `memory.mjs`/`memory.test.mjs`(新規 2 件)のみであることを自分で確認済み。`ls apps/soul/agent/memories` が `No such file or directory` であることも自分で確認し、テストが実体の memories/ を汚染していないことを裏取りした。

## 総合判定: **PASS**(blocking なし・軽微な質問 2 件)

## 関数群の充足(wave-plan §3 Domain A)

| 要素 | 判定 | ソース根拠 |
|---|---|---|
| 全量転写の専用整形関数 | PASS | `memory.mjs:83-86` `formatTranscriptForDigest`。fire-injection.mjs は import すら無い(`memory.mjs:37-39` の import は node:fs/path/url のみ)= 独立新設。 |
| 生成指示(視聴者名除外を明記) | PASS | `memory.mjs:92-99` `DIGEST_GENERATION_INSTRUCTION`。`:98` に「視聴者の名前や、個人を特定できる情報は一切書かないでください」を明記。 |
| generateDigest(brainDef 注入・create→ask 一発→dispose・fake 注入口) | PASS | `memory.mjs:122-141`。`createImpl`(fake 注入口)と `brainDef.create` の両対応(`:129`)。 |
| saveDigest(同一セッション同一ファイル上書き・dir 自動作成) | PASS | `memory.mjs:172-179`。`digestFileName(startedAtMs)`(`:150-158`)が同一入力→同一文字列を保証・`mkdirSync(dir,{recursive:true})`(`:176`)。 |
| loadRecentDigests(N=3・降順・合計上限・欠損耐性) | PASS | `memory.mjs:197-235`。既定 `n=DEFAULT_DIGEST_COUNT`(=3・`:47`)・`:209` でファイル名降順ソート・`:224-228` で合計上限判定・`:202-207`(dir 不在)/`:220-222`(個別ファイル読み取り失敗)の欠損耐性。 |
| composeSystemPrompt(ON/OFF) | PASS | `memory.mjs:249-254`。 |
| .gitignore の memories/ 追記 | PASS | `apps/soul/agent/.gitignore:41`(コメント付き・裁定 5 への参照あり)。 |

## blocking 基準(§4)への適合

| # | 基準 | 判定 | ソース根拠 |
|---|---|---|---|
| 1 | 視聴者情報の秘匿(二重防御) | PASS | 第一防御: `formatDigestLine`(`memory.mjs:70-73`)は `labelOf(e.speaker)` と `e.text` のみを使い、`e.displayName` を一切参照しない(型注釈コメントに現れるのみ・実行コードでは触れられていない)。fire-injection.mjs の `viewer(名前):` 意匠は真似ていない(括弧を出力しない)。テスト `memory.test.mjs:43-57` で 2 種の視聴者名が出力に一切現れないこと・括弧が無いことを機械固定。第二防御: `DIGEST_GENERATION_INSTRUCTION`(`:98`)に視聴者名禁止を明記、テスト `:70-74` で文言存在を固定。 |
| 2 | 常駐の不汚染 | PASS | `generateDigest` は常駐 session を受け取る引数が存在しない(契約上そもそも触れられない・`memory.mjs:122-123` の分割代入は `brainDef, createImpl, entries` のみ)。`try{...}finally{await session.dispose();}`(`:135-140`)で ask が throw しても dispose 保証。テスト `memory.test.mjs:142-160`(residentSession が呼ばれないことを確認)・`:129-140`(throw 時も dispose=1)・`:104-119`(create=1・ask=1・dispose=1)で機械固定。 |
| 4 | OFF の完全性(注入側) | PASS | `composeSystemPrompt`(`memory.mjs:249-254`)は memoryText が空文字列/空白のみ/null/undefined のいずれでも素の masque を返す。テスト `memory.test.mjs:341-364` で 4 パターン固定。委任プロンプトの言う「注入側」の範囲に限定されており、タイマー等の Domain B 領分には立ち入っていない(整合)。 |
| 6 | メモリファイルの安全 | PASS | `saveDigest`/`loadRecentDigests` は呼び出し側が渡した `dir` 配下のみ(`join(dir, fileName)` 形。dir 自体の外への到達経路なし)。ファイル名は `digestFileName(startedAtMs)`(`:150-158`)のみから導出し、`startedAtMs` は `typeof`/`Number.isFinite` チェック(`:151-153`)で非数値なら TypeError=転写本文・話者名等の外部入力がパス組み立てに紛れ込む経路が構造的に無い。`.md` 拡張子のみ読む(`:209`)。テスト `:307-320`(.txt 無視)・`:322-337`(EISDIR=壊れたエントリのスキップ)で固定。 |
| 3(軽視程度) | shutdown が固まらない(Domain B 領分) | 参考良好 | `generateDigest` は素の async 関数で内部 timeout 機構は持たないが、これは意図的(Domain B が `Promise.race` 等で外側からラップする形を阻害しない)。`dispose` は ask の完了/失敗と独立して必ず呼ばれる設計(`:135-140`)なので、Domain B 側が timeout で先に進めても session の後始末は裏で保証される。Domain A の設計は #3 を満たす形を阻害していない。 |
| 5(軽視程度) | ワイヤ additive(Domain B 領分) | 対象外 | Domain A は新設ファイルのみで既存の器/契約/依存に触れていない(`.gitignore` 追記のみ)。該当なし。 |

## 裁定・L0 設計判断との整合

| 論点 | 判定 | ソース根拠 |
|---|---|---|
| 裁定 2(視聴者名を残さない) | PASS | 上表 blocking #1 と同一根拠(二重防御)。 |
| 裁定 3(N=3) | PASS | `memory.mjs:47` `DEFAULT_DIGEST_COUNT = 3`。テスト `:256-267` で既定 n=3 を固定。 |
| 裁定 4(一つの操作=同一ファイル上書き) | PASS | `saveDigest` は同一 `startedAtMs` → 同一ファイル名 → 上書き(`:172-179`)。テスト `:178-193` で 2 回保存してファイルが 1 個のまま・内容が最後の書き込みで上書きされることを固定。「三つの引き金がいずれも同じ startedAtMs を渡す」ことは Domain B の配線責務だが、Domain A 側が提供する性質(同一入力→同一ファイル)は裁定の要求を正しく満たす形。 |
| 裁定 5(人間可読 md・ローカル) | PASS | `saveDigest` はダイジェスト本文をそのまま平文で `.md` へ書く(`:177`)。`DEFAULT_MEMORIES_DIR`(`:44`)は `apps/soul/agent/memories/` を指す(テスト `:234-236` で固定)。`.gitignore:41` で非コミット。 |
| 裁定 7(使い捨て ask) | PASS | `generateDigest` の `create→ask 一発→dispose`(`:134-140`)。 |
| soul §3 の生成指示骨子 | PASS | `DIGEST_GENERATION_INSTRUCTION`(`:92-99`)に「配信で起きた出来事(プレイしたゲーム・進行・ハイライト)」「交わした話題やジョーク・言い回し」「配信者について新しく分かったこと」を明記。stream-memory.md §3 の 3 項目とそのまま対応。 |
| L0 設計判断 1(formatFireInjection への巨大有限値ハックをしない) | PASS | `formatTranscriptForDigest`/`formatDigestLine` は fire-injection.mjs に一切依存しない独立実装(import 文で裏取り済み)。 |
| L0 設計判断 2(器官は src/mind/memory.mjs) | PASS | ファイルパスがそのまま一致。 |

## 裁量判断の妥当性評価(`domain-a.md` §6)

1. **ファイル名形式(UTC 固定・ISO 由来・コロン除去)**: wave-plan/inventory に文字コード上の指定はなく、辞書順=時系列順という loadRecentDigests の前提を自ら機械テスト(`memory.test.mjs:221-232`)で固定している。裁定・設計判断に反しない妥当な裁量。
2. **generateDigest の引数形(`{brainDef, createImpl, entries}`・createImpl 優先)**: inventory §2-2 は「生成(brains の create を注入可能に=テストは fake)」とだけ指定しており、具体的な引数形は未定義。fake 注入のしやすさを優先した設計は妥当。
3. **loadRecentDigests の maxChars 超過時の切り方(ファイル単位・最初の 1 件は上限超過でも必ず含める)**: wave-plan/inventory は「合計サイズ上限」とだけで単位を指定していない。文章を意味不明な断片にしない設計判断は合理的で、fire-injection.mjs の「最新 1 行は常に残す」思想の踏襲という説明も筋が通っている。反する記述は見当たらない。
4. **saveDigest の digest 引数型防御の非対称(digest は寛容・startedAtMs は非寛容)**: blocking #6(パス安全)の観点から `startedAtMs` を厳格にする判断は正しい方向(あいまいな入力でファイル名が壊れることを防ぐ)。妥当。
5. **composeSystemPrompt の見出し文言(`MEMORY_SECTION_HEADER`・非 export)**: wave-plan に見出し文言の指定はなく、Domain B が変更したい場合はこのファイルを直接編集すればよい(export していない=外部からの差し替え口が無いことも意図通りで、系統だった注入点は composeSystemPrompt 自体に一本化されている)。妥当。

いずれも裁定・L0 設計判断に反する選択は無い。

## 質問(Orch-Sylph 判断が必要な場合のみ)

1. **`loadRecentDigests` の `count` 定義**(`domain-a.md` §7-1 で Gnome 自身も申し送り済み): 上限で打ち切られたファイルは count に加算しない実装(`memory.mjs:226-231`、`parts.push` した件のみ加算)。spec 文書に count の厳密な定義はなく、実装上の選択は自然だが、Domain B の UI「記憶 N 件を搭載」表示の意図(試みた件数 vs 実際に文字が入った件数)と齟齬が無いか、Domain B 着手時に確認されたい。spec 適合性としては blocking ではない。
2. **`loadRecentDigests` の `maxChars` 既定値が `Infinity`(無制限)**(`domain-a.md` §7-3 で Gnome 自身も申し送り済み): wave-plan/inventory は「合計サイズ上限つき」の機能自体を Domain A の要素として要求しており、機能(引数経由で上限を効かせられること)はテスト込みで実装・確認済み(`memory.test.mjs:269-282`)。ただし既定値自体は無制限のため、Domain B が明示的に具体的な値を `loadRecentDigests({..., maxChars})` へ渡すことが前提の設計になっている。この前提が Domain B 側で漏れなく踏襲されるか、Domain B レビュー時に確認する必要がある(Domain A 単体としては blocking 要因ではない)。

## 差分・要修正

なし。
