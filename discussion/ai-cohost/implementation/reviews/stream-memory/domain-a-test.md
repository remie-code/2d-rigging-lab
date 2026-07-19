# 配信間記憶 Domain A「記憶の器官」— test レーン レビュー報告

> レビュー担当: Review-Sylph（サブエージェント委任・Orch-Sylph 経由・test レーン）。
> 対象: `apps/soul/agent/src/mind/memory.mjs`（新設）+ `apps/soul/agent/src/mind/memory.test.mjs`（新設）+ `apps/soul/agent/.gitignore`（追記）。
> 突合先: [stream-memory-wave-plan.md](../../orchestration/stream-memory-wave-plan.md) §3 Domain A / §4 blocking 基準・[domain-a.md](../../waves/stream-memory/domain-a.md)（Gnome 完了報告）。

## 1. テスト設計の網羅（wave-plan §3 機械テスト列挙との突合）

| 要求項目 | 実装状況 | 根拠（file:line） |
|---|---|---|
| 整形（3 話者: you/soul/viewer） | 実装済み | `memory.test.mjs:30-41`（`formatTranscriptForDigest` の 3 話者ラベル固定） |
| viewer の displayName が出力に現れないことの機械固定（**blocking #1 第一防御**） | 実装済み・直接検査 | `memory.test.mjs:43-57`（2 種の視聴者名文字列 `とある視聴者A`/`視聴者B太郎` が `text.includes(...)` で不在確認・かつ `viewer(名前):` 意匠の括弧不在まで確認） |
| 未知話者の防御的フォールバック | 実装済み（列挙外・良い追加） | `memory.test.mjs:59-62` |
| 空配列 → 空文字列 | 実装済み | `memory.test.mjs:64-66` |
| 生成指示に視聴者名禁止明記（blocking #1 第二防御） | 実装済み | `memory.test.mjs:70-74` |
| 生成が使い捨て（create→ask→dispose） | 実装済み | `memory.test.mjs:104-119` |
| brainDef.create 経由のフォールバック | 実装済み | `memory.test.mjs:121-127` |
| ask が throw しても dispose される | 実装済み | `memory.test.mjs:129-140`（`generateDigest` 実装側の try/finally は `memory.mjs:135-140` で対応確認） |
| 常駐セッションに一切触れない | 実装済み | `memory.test.mjs:142-160`（`residentSession.ask/dispose` が呼ばれたら throw する fake を用意し、契約上そもそも渡す口が無いことを確認） |
| 空転写なら create を呼ばず null | 実装済み | `memory.test.mjs:162-167` |
| create 未指定は throw | 実装済み | `memory.test.mjs:169-174` |
| 上書き（同一 startedAtMs で同一ファイル） | 実装済み | `memory.test.mjs:178-193`（ファイル数 1 個固定・内容が最後の書き込みで上書きされていることまで確認） |
| ディレクトリ自動作成 | 実装済み | `memory.test.mjs:195-206` |
| ファイル名安全性（コロン不使用・.md） | 実装済み | `memory.test.mjs:208-219` |
| ファイル名の辞書順=時系列順 | 実装済み | `memory.test.mjs:221-232` |
| 読み込み N 件（新しい順） | 実装済み | `memory.test.mjs:240-254` |
| 既定 n=3 | 実装済み | `memory.test.mjs:256-267` |
| 合計上限 maxChars で切る | 実装済み | `memory.test.mjs:269-282` |
| 欠損耐性（dir 不在） | 実装済み | `memory.test.mjs:284-294` |
| 欠損耐性（空ディレクトリ） | 実装済み | `memory.test.mjs:296-305` |
| .md のみ読む（メモリ安全） | 実装済み | `memory.test.mjs:307-320`（`.txt`/拡張子なしファイルが無視されることを直接確認） |
| 壊れた/読めないファイルの耐性 | 実装済み | `memory.test.mjs:322-337`（ディレクトリを `.md` 名で作り `EISDIR` を実際に踏ませる手堅い手法） |
| compose の ON/OFF | 実装済み | `memory.test.mjs:341-364`（空文字列/undefined/null/空白のみの 4 パターン） |

wave-plan §3 が列挙する機械テストは**全て実装済み**。欠落なし。

## 2. `node --test` の生 tail（自分で実行）

### memory.test.mjs 単体
```
$ node --test src/mind/memory.test.mjs
...
1..27
# tests 27
# suites 0
# pass 27
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 121.0205
```

### apps/soul/agent 全体（`node --test`）
```
...
1..914
# tests 914
# suites 0
# pass 914
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6192.6416
```
Gnome 報告の 27/27・914/914 と一致（自分で独立再実行して裏取り済み）。

### memories/ 不在確認（テスト前後）
```
$ ls memories
ls: cannot access 'memories': No such file or directory   ← テスト実行前（node --test 914件の前）

$ node --test                                              ← 914件フル実行

$ ls memories
ls: cannot access 'memories': No such file or directory   ← テスト実行後（不在のまま）

$ git status --short | grep -i memories
（該当なし・grep exit 1）
```
実体 `apps/soul/agent/memories/` はテスト前後で生成されていないことを確認した。

## 3. fake の徹底・非汚染の確認

- `generateDigest` の唯一の外部呼び出し口は `createImpl ?? brainDef?.create`（`memory.mjs:129`）。テスト側は `makeFakeCreate`（`memory.test.mjs:82-102`）で完全に in-memory な fake を注入しており、`@anthropic-ai/claude-agent-sdk` や `@openai/codex-sdk` への実呼び出し経路は無い。ネットワーク・実 LLM・実マイクの消費はゼロ。
- テストは全て `mkdtempSync(os.tmpdir())` によるスクラッチディレクトリを `dir` オプションとして明示的に注入しており（`memory.test.mjs:24-26` の `tmpDir()` ヘルパー）、`DEFAULT_MEMORIES_DIR`（実体 `apps/soul/agent/memories/`）や `~/.codex` には一切触れていない。各テストは `finally` で `rmSync(dir, { recursive: true, force: true })` により後始末している（例: `memory.test.mjs:190-192`, `203-205`, `216-218` 等、全 saveDigest/loadRecentDigests 系テストで徹底）。
- 上記§2 のとおり実測でも `memories/` 不在を確認済みであり、報告内容と実測が一致する。

## 4. テストの質

- blocking #1 の viewer 名テスト（`memory.test.mjs:43-57`）は空アサートではなく、実際の視聴者名文字列 2 種が出力に**含まれない**ことを `assert.ok(!text.includes(...))` で直接検査しており、さらに `viewer(名前):` という意匠自体を真似ていないことまで（括弧が出力に無いこと）機械固定している。「生成指示にだけ頼らない・整形段階での機械的排除」を担保する良いテストになっている。
- `generateDigest` の常駐不汚染テスト（`memory.test.mjs:142-160`）は、呼ばれたら即 throw する `residentSession` を用意し「渡す口が無い」契約を裏付けている。厳密には「渡されていないので呼ばれるはずがない」ことの構造的確認（契約テスト）であり、動的に汚染を検出する類のテストではないが、`generateDigest` のシグネチャ自体（`brainDef`/`createImpl`/`entries` のみ）を実装側でも確認しており（`memory.mjs:114-121`）、対応関係は妥当。
- `loadRecentDigests` の壊れたファイル耐性テスト（`memory.test.mjs:322-337`）は、`.md` 名のディレクトリを実際に作って `EISDIR` を発生させる実践的な手法で、モックに頼らず本物の失敗モードを再現しており質が高い。
- 上書きテスト（`memory.test.mjs:178-193`）はファイル数だけでなく内容（最後の書き込みで上書きされていること）まで確認しており、意味のある不変を突いている。
- 総じて、緑を取るためだけの空アサートは見当たらない。

## 5. 差分・要修正

**blocking 相当の要修正はなし。** 以下は任意の改善提案（判定には影響しない）。

1. `saveDigest` の `startedAtMs` が非数値（`digestFileName` が `TypeError` を投げる異常系・`memory.mjs:151-153`）に対する機械テストが無い。wave-plan §3 の列挙には無い項目であり Gnome の裁量実装（domain-a.md §6-4）だが、blocking #6「パス組み立てに外部入力を使わない」の異常系側（不正な入力を渡したら型で弾かれること）を直接固定しておくと、将来の回帰にも強くなる。
2. `saveDigest` の `digest` 非文字列フォールバック（`String(digest ?? "")`・`memory.mjs:177`）にも対応する機械テストが無い。同じく裁量実装であり必須ではない。
3. `generateDigest` で `brainDef` と `createImpl` の両方が渡された場合に `createImpl` を優先する、というフォールバック順序（`memory.mjs:129`）を直接固定するテストが無い（`121-127` のテストは `brainDef` 単独のケースのみ）。

いずれも wave-plan §3 の必須列挙には含まれず、blocking 基準にも抵触しない。次ドメイン(B)着手を妨げるものではないため「要修正」ではなく将来的な補強候補として記載する。

## 6. 判定

**合格**

- wave-plan §3 の機械テスト列挙: 完全網羅。
- blocking #1（視聴者秘匿・整形段階での直接検査）・#2（常駐不汚染・dispose 保証）・#4（OFF の完全性）・#6（メモリ安全・.md のみ・dir 配下のみ）: いずれも対応する機械テストで固定済み、かつ実装コードと整合。
- fake 徹底: 実 LLM/実ネット/実マイク消費ゼロを確認。
- テスト非汚染: 自分で `node --test` を実行し、実行前後で `apps/soul/agent/memories/` が生成されていないことを実測確認。
- 数字: 27/27（単体）・914/914（全体）を自分で独立再実行し、Gnome 報告と一致することを確認。

## 7. 質問

なし（test レーンの範囲では判断保留事項なし）。§5 に記載した 3 点は改善提案であり、Domain B 側の設計判断を待つ必要はない。
