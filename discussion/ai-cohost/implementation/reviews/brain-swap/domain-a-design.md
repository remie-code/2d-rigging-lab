# Domain A（知性契約 + Codex 頭）レビュー — design レーン

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: `apps/soul/agent/src/mind/codex-session.mjs` ほか Domain A 成果物一式。
> 基準: [brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §4 blocking 基準（主眼 #1/#5/#7）。
> 方法: Gnome の実装報告（`waves/brain-swap/domain-a.md`）は裏取り対象として読み、判断はすべて実コード精読・grep・自分での `node --test` 実行・実機 `~/.codex/sessions` 件数確認に基づく。

## 総合判定: **PASS**

blocking 基準 #1/#5/#7 のいずれについても、危険な削除経路・封じ込め漏れ・検問所迂回は見つからなかった。以下、独立検証の根拠を示す。

---

## 1. 【最重要 blocking #1】rollout 掃除の安全性 — 独立検証

### 1-1. 削除経路の全数確認（grep）

`codex-session.mjs` 内で `readdirSync` / `unlinkSync` / `rmSync` を呼ぶ箇所を全て洗い出した（自分で grep 実行・結果転記）:

```
52:  readdirSync,
54:  rmSync,
55:  unlinkSync,
126:      entries = readdirSync(dir, { withFileTypes: true });
139:            unlinkSync(entryPath);
433:            unlinkSync(filePath);
455:        rmSync(workingDirectory, { recursive: true, force: true });
```

- `readdirSync` 呼び出しは **`deleteRolloutForThreadId` 関数内の 1 箇所のみ**（:126）。ディレクトリ列挙経路はここ以外に存在しない。
- rollout 削除の `unlinkSync` は :139 の 1 箇所のみ。:433 は画像一時ファイル（`workingDirectory` 配下・別物・後述 §2）の削除で rollout とは無関係。
- :455 の `rmSync` は dispose 時にセッション自身が `mkdtempSync(os.tmpdir())` で作ったスクラッチディレクトリを丸ごと消すもので、対象は `~/.codex/sessions` ではなく OS temp 配下の自セッション専用ディレクトリ（§2 参照）。rollout の bulk 削除ではない。

→ **rollout ファイルの削除経路は `deleteRolloutForThreadId` 一関数に一元化されている**ことを確認した。

### 1-2. 完全一致ロジックの実コード

`extractThreadIdFromRolloutFilename`（:103-106）:
```js
const ROLLOUT_FILENAME_RE = /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/;
function extractThreadIdFromRolloutFilename(fileName) {
  const m = ROLLOUT_FILENAME_RE.exec(fileName);
  return m ? m[1] : null;
}
```
`deleteRolloutForThreadId`（:116-151）の削除判定:
```js
const id = extractThreadIdFromRolloutFilename(entry.name);
if (id !== null && id === threadId) {
  try { unlinkSync(entryPath); deleted = true; } catch { /* 諦める */ }
}
```
比較は `===`（文字列完全一致）のみ。`includes` / `startsWith` / `endsWith` / `glob` / `minimatch` / ワイルドカードは**ソース全体を通じて一切登場しない**（grep でも rollout 削除に関わる箇所にこれらの語は出現しない）。ループは `deleted` フラグで即座に打ち切られ、**1 threadId につき最大 1 ファイルしか消えない**構造（walk 内 `if (deleted) return;` が二重に効いている）。「台帳に無い id を全部消す」「日付ディレクトリごと rm」に相当する経路は実装として存在しない。

### 1-3. homeDir の閉じ込め

`deleteRolloutForThreadId(homeDir, threadId)` の探索起点は `path.join(homeDir, ".codex", "sessions")`（:117）のみ。`createCodexSession` の既定値は `homeDir = os.homedir()`（:349）で、テストでは全て `homeDir` をスクラッチ tmpdir に差し替えて呼んでいる。削除は常にこの1本のパス配下に閉じている。

### 1-4. 「見つからなければ諦める」の実装

- `readdirSync` 失敗（ディレクトリ無し/読めない）→ `catch { return; }`（:125-129）でエラーを外に投げない。
- `unlinkSync` 失敗 → `catch { /* 削除失敗も正直に諦める */ }`（:141-143）で握りつぶす。
- `sweepLedger` はどの id が見つからなくても最後に `writeLedger(ledgerPath, [])` で台帳を空にするのみ（:193-200）。throw なし。

いずれも起動/dispose を止めない設計を確認した。

### 1-5. 起動時 sweep とdispose 削除の同一ルール

- 起動時: `sweepLedger(homeDir, ledgerPath)`（:363・`createCodexSession` 冒頭）→ 台帳の各 id に対し `deleteRolloutForThreadId` を呼ぶだけ（:196-198）。
- dispose: `for (const id of threadIds) { deleteRolloutForThreadId(homeDir, id); }`（:450-452）。

両方とも同一の `deleteRolloutForThreadId` 関数を経由しており、削除ルールに分岐や特例は無い。dispose 対象は「このセッションインスタンスが `ask()` 中に記録した `threadIds`（通常 1 件）」のみで、他セッションが積んだ id には触れない（`removeFromLedger` も除去対象の id リストでフィルタするのみ・:222-228）。

### 1-6. rollout ファイルの中身に触れていないことの確認

rollout ファイルに対する I/O は `readdirSync`（メタデータ列挙）と `unlinkSync`（削除）のみ。`readFileSync` は sidecar 台帳（`ledgerPath` = JSON）読み込みにしか使われていない（:160）。rollout の JSONL 本体を open/read する経路は無い。

### 1-7. 性質テスト（`codex-session.test.mjs`）の実効性を自分で確認

5 本の blocking 性質テストのコードを読み、以下を確認した（Gnome の主張どおりの検証内容）:

1. 起動時 sweep: 他人 rollout 12 本（日付分散） + 自分 2 本（台帳記載）→ sweep 後、自分の 2 本のみ消え他人 12 本は無傷、台帳は空に。
2. dispose: 他人 rollout 10 本 + `ask()` で確定した自分の thread_id 1 本 → dispose 後、自分の 1 本のみ消え他人 10 本は無傷。
3. 台帳に存在しない id（`ghost-thread-does-not-exist`）→ throw せず台帳から除去のみ、他 rollout 無傷。
4. `~/.codex/sessions` 相当のディレクトリ自体が無い環境 → sweep は throw しない。
5. **部分一致 decoy テスト**: 台帳 id `"abc"` に対し、ファイル名 `rollout-...-xxx-abc-yyy.jsonl`（"abc" を部分文字列に含むが末尾は `xxx-abc-yyy`）は無傷、完全一致する `rollout-...-abc.jsonl` のみ削除されることを確認するテスト。実際にコードを読み、`ROLLOUT_FILENAME_RE` のキャプチャ group が `xxx-abc-yyy` 全体（`.+` は貪欲マッチで末尾直前までを拾う）になり `"abc"` とは非一致になる構造を確認した。

自分で以下を実行し、5 本を含む全テストが緑であることを確認した:
```
$ node --test src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/env-guard.test.mjs
# tests 42 / pass 42 / fail 0
$ node --test  （apps/soul/agent 全体）
# tests 797 / pass 797 / fail 0
```

### 1-8. 実機非干渉の直接証拠（自分で実行・再現）

Gnome の報告（sessions_file_count=4494）を鵜呑みにせず、レビュー実行中に自分でも同じゼロコストコマンドを実行した:
```
$ node apps/soul/agent/scripts/spike-codex-terra.mjs sessions
sessions_file_count=4494
```
Gnome の記録（4494）と完全一致し、かつテストスイート（性質テスト含む）を自分で走らせた**後**でもこの数値が変わっていないことを確認した。テストが本物の `~/.codex/sessions`（ユーザーの 4400+ rollout）に一切触れていないことの直接的な追加裏取りになった。

**結論（§1 総括）**: 削除は sidecar 台帳の thread_id との完全一致のみで行われ、bulk/部分一致/パターン削除の経路は実装上存在しない。blocking 基準 #1 は満たされている。

---

## 2. 【blocking #5】画像橋渡しの封じ込め

- `buildInput`（:240-273）が base64 ブロックを `workingDirectory` 配下の `image-<uuid>.<ext>` へ `writeFileSync` し `tempFiles` に積む。
- `ask()` 内（:411-438）は `try { ...runTurn... } finally { for (const filePath of tempFiles) { try { unlinkSync(filePath); } catch {} } }` という構造で、**`runTurn` が throw しても（turn.failed 経由）finally は必ず実行される**（try/finally の言語仕様どおり）。実際に「turn.failed でも画像の一時ファイルは finally で削除される」というテストが存在し、自分で緑を確認した。
- `workingDirectory` は `mkdtempSync(path.join(os.tmpdir(), "codex-session-"))`（:366）で **リポジトリ外**の OS temp 配下。`sandboxMode:"read-only"` との二重防御になっている。
- 知性契約（`ask(content)` の入出力）は base64 のままで変化しておらず（`buildInput` はアダプタ内部でのみ変換）、契約自体に `local_image` や一時ファイルパスが漏れ出す経路は無い。
- モジュールヘッダ（:28-35）に昇格予約の一文（brain-swap.md §5 参照）を確認した。

blocking 基準 #5 は満たされている。

---

## 3. 【blocking #7】KILL/NG 弁の頭非依存

- `git diff --stat` で `apps/soul/agent/src/mind/fire-orchestrator.mjs` が **無変更**であることを確認済み（diff 無出力）。KILL 検査（`killed` フラグ）と NG 検問所（`containsNgWord(speechText)`）は `processAskedReply`（fire-orchestrator.mjs:330-364）内、`asked.replyText` を受け取った後段に固定で存在し、`asked` を生成した頭（Claude/Codex）を区別しない構造になっている。
- `createFireOrchestrator` は `options.session.ask` という抽象越しにしか頭を扱わない（:206-208 の型チェックのみ）。`codex-session.mjs` は `{replyText, usage, ttftMs, elapsedMs}` を返す `ask()` を実装するだけで、検問所を迂回する独自の発話経路（例えば speak 直呼びや別のイベント発火）は一切持たない。

blocking 基準 #7 は満たされている（検問所は元々頭の外にあり、Domain A はその構造を一切崩していない）。

---

## 4. その他の設計所見

### 4-1. スレッド継続の設計
`thread = codex.startThread(...)` は `createCodexSession` 呼び出し時に 1 回だけ実行され（:374-382）、以降の `ask()` は同一 `thread` オブジェクトの `runStreamed` を呼ぶだけ（`turnCount` で `isFirstTurn` だけを判定し systemPrompt 前置を制御）。ask ごとに新スレッドを作る経路は無い。テスト「ask(string) は turn1 で systemPrompt を前置し、turn2 以降はそのまま渡す」で実測確認済み。brain-swap.md §9 (a') の「スレッド継続」設計と一致している。

### 4-2. エラーの正直さ
`runTurn`（:283-319）は `turn.failed`/`error` イベントを `errorMsg` に集約し、`errorMsg !== null` なら明示的に `throw new Error(...)`（:314-316）。空応答を黙って返す経路は無い。fire-orchestrator 側の catch（fireError 系・Domain A 変更範囲外）にそのまま乗る設計であることをコードレベルで確認した。

### 4-3. env の安全
- `new CodexCtor({config:{forced_login_method:"chatgpt"}})` のみを渡し、`env`/`apiKey`/`baseUrl` は渡していない（:369-372）。未指定なら SDK は `process.env` を継承する設計（型定義コメントの解釈は inventory §2-4 と整合）。
- `assertSubscriptionAuthEnvOpenAI`（env-guard.mjs:129-164）は `OPENAI_API_KEY`/`CODEX_API_KEY` の完全一致検査で throw、`OPENAI_BASE_URL` は非空なら warn（throw しない）。Anthropic 版（:73-114）は 1 バイトも変更されていないことを diff で確認済み（`env-guard.mjs` の diff は sibling 追記のみ）。

---

## 5. non-blocking の気づき

1. **`OPENAI_BASE_URL` warn ロジックの簡略化**（non-blocking）: Anthropic 版は既定値との比較ロジックを持つが、OpenAI 版は「非空なら常に warn」に単純化されている。Codex SDK の baseUrl 既定値が型定義/README に明記されていないための保守的な設計判断であり、安全側に倒れている（false negative がない）ため blocking ではない。
2. **`buildInput` の未知ブロック型の黙殺**（non-blocking）: `text`/`image` 以外のブロック型は無視される（:270）。現状 `fire-orchestrator.mjs:632-635` が渡すのは `text`/`image` のみであることを実コードで確認済みなので現時点では問題にならないが、Domain B/C で新しいブロック型が追加された場合の挙動（Claude 頭は SDK にそのまま渡す・Codex 頭は黙って欠落）に非対称性が生じる可能性がある。Gnome 自身も「質問」として記録済み。
3. **`ledgerPath` の既定パス**（non-blocking）: `apps/soul/agent/codex-rollouts.local.json`。Domain B が同じパスを cockpit 側から参照する必要が生じた場合の集約方法は未確定だが、`createCodexSession({ ledgerPath })` で上書き可能な設計になっているため、Domain B 側の設計判断に委ねてよい。

---

## 6. 質問（Orch への申し送り・Gnome の記録を転記）

Gnome の実装報告（`waves/brain-swap/domain-a.md` §6）にある 4 点の「迷った点」のうち、design レビューの観点からは blocking にあたるものは無いと判断した。ただし以下は Domain B 着手前に Orch で方向性を確認しておくとよい:

1. `ledgerPath` の既定パス集約方針（§5-3 のとおり、現状は `options.ledgerPath` で上書き可能なので Domain B が独自に組み立てるか、`brains.mjs` 側に集約するかは設計判断待ち）。
2. `buildInput` の未知ブロック型を無視ではなく throw に倒すべきか（Domain B/C で新しいブロック型が現れた場合の非対称性対策・現時点では実害なし）。

以上、design レーンとしては **PASS**。
