# 多頭化(頭脳差し替え) Domain B レビュー — レーン: spec（契約適合・スコープ・無退行・additive）

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: 実装報告 [../../waves/brain-swap/domain-b.md](../../waves/brain-swap/domain-b.md)。
> 基準: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain B + §4 blocking 基準。
> 方式: Gnome の報告を鵜呑みにせず、実ファイル Read + grep + git 実行 + 独立 `node --test` で全項目を裏取りした。

## 総合判定: **PASS**

blocking 基準（wave-plan §4 #2/#4/#6）に反する事実は見つからなかった。ワイヤ契約は additive のみ・Claude 経路 1 ビット不変・資格情報不可侵・Domain A ファイル不変を確認した。ただし **non-blocking だが重大な指摘が 1 件**（下記 non-blocking §1: 実装報告書 §2 の個別ファイルテスト件数が実測と大きく乖離している）。機能・契約・安全性そのものには影響しないため PASS とするが、報告書の当該記載は訂正が必要。

---

## 検証項目（結果）

### 1. POST /api/brain の契約 — ○
`cockpit-server.mjs:982-1006`。`body.brain !== "claude" && body.brain !== "codex"` で不正値/欠落を弾いて 400（:994-997）。`typeof onSetBrain !== "function"` で未注入を 503（:986-989）。成功時は `onSetBrain(body.brain)` を await（失敗は best-effort で握る）→ `broadcastState()` → `sendJson(res, 200, snapshot())`（:998-1005）。`/api/kill`（:951-981）・`/api/verbosity`（:924-950）と同型の構造・同じコメント規律。テスト 6 種（`cockpit-server.test.mjs:2208-2312`）で 503・snapshot 既定値+未注入対称・codex 切替+SSE state 確認・claude へ戻す・不正値 400・body 欠落 400 を確認済み（自分で実行し全緑）。

### 2. snapshot.brain の additive 性 — ○
`git diff -- cockpit-server.mjs` を自分で取得し全文確認。追加は `brain: typeof brainStatusImpl === "function" ? (brainStatusImpl() ?? null) : null`（:524）の 1 行のみで、`killed` と `audioDevice` の間に挿入。**diff の `-` 行はコメント中のエンドポイント数字 2 箇所（17→18、後述の non-blocking §2 参照）のみ**で、既存の `ears`/`device`/`health`/`appended`/`discarded`/`uptimeMs`/`transcripts`/`channel`/`visionTarget`/`selfFire`/`verbosity`/`killed`/`audioDevice`/`chat` の式・値は 1 バイトも変わっていない。未注入時は `brain:null`（audioDevice/channel と同型のゲート）。

### 3. createBrainHooks / brainChoice store — ○
`cockpit.mjs:348-383` の `createBrainHooks(settings, defaultChoice="claude")` は `createVerbosityHooks`（`cockpit.mjs:328-346`）と同型の構造（`resolveInitialBrain`/`onSetBrain` の 2 メソッド・try/catch 失敗寛容）。`cockpit-settings-store.mjs:161-167` の `getBrainChoice`/`setBrainChoice` は `getVerbosityMode`/`setVerbosityMode`（:154-160）の写経で `asStringOrNull` + `writeMerged` の read-modify-write に正しく乗っている。テスト（`cockpit.test.mjs:524-566`）で未記憶→"claude" フォールバック・defaultChoice 明示・記憶済み優先・未知値フォールバック・onSetBrain 橋渡し・throw 寛容の 6 種を確認（自分で実行し全緑）。

### 4. ensureFireResources の頭分岐 — ○
`cockpit.mjs:482-514`。`const brainDef = BRAINS[currentBrain] ?? BRAINS.claude` で registry lookup、`session = brainDef.create({systemPrompt, onWarning, onInit})` で頭を生成。`BRAINS.claude.create = (options) => createLlmSession(options)`（`brains.mjs:50`）の薄いラッパのため、`currentBrain==="claude"` のときは従来の `createLlmSession({...})` 呼び出しとバイト等価。Anthropic env-guard（`assertSubscriptionAuthEnv`）の呼び出しは `if (currentBrain === "claude")` の中だけに閉じており、既定経路の warnings 出力順序は不変。

### 5. blocking 基準 #2 Claude 頭の無退行 — ○（自分で実行し裏取り済み）
```
$ git diff --stat apps/soul/agent/src/mind/llm-session.mjs apps/soul/agent/src/mind/env-guard.mjs apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/codex-session.mjs
（無出力）
```
`llm-session.mjs` は 1 バイトも変更されていない。`env-guard.mjs`（Domain A の M）・`brains.mjs`/`codex-session.mjs`（Domain A の ??）は Domain B のコミット対象 6 ファイルに含まれておらず、diff --stat も無出力＝Domain B の手が一切入っていない（`env-guard.mjs` は Domain A が sibling 関数 `assertSubscriptionAuthEnvOpenAI` を 57 行 追加した分のみ・下記生出力参照）。既存テスト（cockpit/cockpit-server/cockpit-settings-store の 3 ファイル）は個別実行・全体実行とも全緑（下記生出力）。

### 6. blocking 基準 #4 資格情報の不可侵 — ○
```
grep credentialPath|credentialHealth|readFileSync|readFile\(  cockpit.mjs        → existsSync(def.credentialPath) の1箇所のみ（cockpit.mjs:601）
grep credentialPath|credentialHealth|readFileSync|readFile\(  cockpit-server.mjs → JSDoc コメント2箇所のみ（本文コードなし）。readFile 2箇所は UI アセット/indexHtmlPath 配信用（資格情報と無関係・既存コード）
```
`brainStatus()`（`cockpit.mjs:596-601`）は `existsSync(def.credentialPath)` の存在確認 boolean のみを返す。`auth.json`/`.credentials.json` の中身を open/read する経路はゼロ。`credentialHealth` は boolean としてのみ snapshot に載り、パス文字列自体は snapshot/SSE/ログのどこにも現れない（`brainStatus()` の戻り値は `{brain: currentBrain, credentialHealth: boolean}` のみ）。

### 7. blocking 基準 #6 additive — ○
- 新エンドポイントは `/api/brain` のみ。変更前（`git show HEAD:...`）の実エンドポイント数を自分で数えたところ 18 個（`/` 含む）、変更後は 19 個（`/api/brain` 追加分）。**既存 18 エンドポイントは 1 つも削除/変更されていない**（下記 non-blocking §2 でコメント数字自体のズレを別途指摘）。
- SSE は `broadcast("...")` の呼び出しをすべて grep して 13 種（state/vad/transcript/discard/diagnostic/fire/selfFire/soul/usage/expression/visionCaptured/chatStatus/chatDiagnostic）を確認。`/api/brain` ハンドラは既存の `broadcastState()` を呼ぶのみで新規イベント種別を追加していない。SSE 数 13 は不変。
- `git status` 全体・`git diff --stat` で `apps/runtime-player`・`channel-*-contract`（`apps/runtime-player/src/main/control-channel/contract/*`・`apps/runtime-player/src/preload/channel-bridge-contract.ts`）・`packages/`・root `pnpm-lock.yaml`・`apps/soul/agent/package.json`/`package-lock.json` への変更が無いことを確認（diff --stat 無出力）。soul zone 外の pre-existing 差分（authoring-host・mesh-generation・.tmp/ 等）は brain-swap wave と無関係（セッション開始時点のスナップショットに既出）。

### 8. brainInitialChoice 削除の評価（domain-b.md §6.1） — **削除は妥当（差し戻し不要）**
Gnome の判断根拠を独立に裏取りした:
- (a) **参照ゼロ**: `grep -r "brainInitialChoice" apps/soul/agent discussion` の結果、実コード・テストには一切登場せず、`domain-b.md` 自身の自己申告文中にのみ存在する。削除によって壊れるテスト/呼び出し元は存在しない。
- (b) **snapshot.brain が起動時現況を完全カバー**: `main()` で `let currentBrain = brainHooks.resolveInitialBrain()`（`cockpit.mjs:459`）が起動時に settings から解決され、`brainStatus()` は単に `currentBrain` を読むだけ（サーバ側の別状態保持が不要）。よってサーバ起動直後から `snapshot.brain` は正しい初期値を返す。`verbosityInitialMode`/`selfFireInitialEnabled` が存在する理由は、その値がサーバ側の `fireScheduler` インスタンス生成時に **seed** として必要だから（`cockpit-server.mjs:352-356` の JSDoc に明記）であり、brain にはサーバ側に対応する状態保持先が無い（正本は cockpit.mjs 側の `currentBrain` のみ）。
- (c) **同型フィールドとの一貫性**: `audioDevice`/`channel`/`visionTarget` はいずれも `*InitialChoice` 相当の option を持たず、`*Status()` コールバックのみで現況を運ぶ（`cockpit-server.mjs` の JSDoc :289-318 で確認）。brain もこの 3 者と同型（cockpit.mjs 側が正本を持つ client-side 状態）であり、`brainInitialChoice` を持たないことはむしろこのパターンとの整合性を高める。
- 結論: 未着手・未参照のオプションを実装時に削ぎ落とす判断であり、ワイヤ契約の additive 原則（不要なフィールドを増やさない）にも整合する。将来 SSE 初期化等で真に必要になった際は 1 行 + JSDoc 1 段落で復元可能（domain-b.md 記載どおり）なので、コストは低い。**差し戻し不要・削除を追認する。**

---

## 独立実行した生出力

### node --test（apps/soul/agent 全体、自分で実行）
```
1..814
# tests 814
# suites 0
# pass 814
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1487.3262
```
Gnome 報告の 814/814（fail/cancelled/skipped/todo 全 0）と一致。

### node --test（touched 3 ファイル個別実行、自分で実行・`--test-reporter=tap` でも再確認）
```
$ node --test scripts/cockpit.test.mjs             → 1..43  / # tests 43  / # pass 43  / # fail 0
$ node --test src/cockpit/cockpit-server.test.mjs → 1..92  / # tests 92  / # pass 92  / # fail 0
$ node --test src/cockpit/cockpit-settings-store.test.mjs → 1..32 / # tests 32 / # pass 32 / # fail 0
```
（全緑。ただし件数が domain-b.md §2 の報告=106/121/44 と一致しない。下記 non-blocking §1 参照）

### git diff --stat（自分で実行）
```
$ git diff --stat -- apps/soul/agent/src/mind/llm-session.mjs apps/soul/agent/src/mind/env-guard.mjs apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/codex-session.mjs
（無出力）

$ git diff --stat -- apps/soul/agent/scripts/cockpit.mjs apps/soul/agent/src/cockpit/cockpit-server.mjs apps/soul/agent/src/cockpit/cockpit-settings-store.mjs apps/soul/agent/scripts/cockpit.test.mjs apps/soul/agent/src/cockpit/cockpit-server.test.mjs apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
 apps/soul/agent/scripts/cockpit.mjs                          | 110 +++++++++++++++-
 apps/soul/agent/scripts/cockpit.test.mjs                     | 143 +++++++++++++++++++++
 apps/soul/agent/src/cockpit/cockpit-server.mjs                |  46 ++++++-
 apps/soul/agent/src/cockpit/cockpit-server.test.mjs           | 131 +++++++++++++++++++
 apps/soul/agent/src/cockpit/cockpit-settings-store.mjs        |  13 ++
 apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs   |  83 ++++++++++++
 6 files changed, 519 insertions(+), 7 deletions(-)

$ git diff --stat apps/soul/agent/package.json apps/soul/agent/package-lock.json apps/runtime-player
（無出力）
```
domain-b.md §5 の diffstat と完全一致。

### git status --short -- apps/soul/agent（自分で実行）
```
 M apps/soul/agent/.gitignore
 M apps/soul/agent/scripts/cockpit.mjs
 M apps/soul/agent/scripts/cockpit.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
 M apps/soul/agent/src/cockpit/cockpit-settings-store.mjs
 M apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
 M apps/soul/agent/src/mind/env-guard.mjs
 M apps/soul/agent/src/mind/env-guard.test.mjs
?? apps/soul/agent/src/mind/brains.mjs
?? apps/soul/agent/src/mind/brains.test.mjs
?? apps/soul/agent/src/mind/codex-session.mjs
?? apps/soul/agent/src/mind/codex-session.test.mjs
```
Domain B が触った 6 ファイルは domain-b.md の主張と一致。`env-guard.mjs`/`env-guard.test.mjs`（M）・`brains.mjs`/`brains.test.mjs`/`codex-session.mjs`/`codex-session.test.mjs`（??）は Domain A の成果物で Domain B の diffstat には含まれておらず、Domain B が触っていないことを確認済み。

---

## non-blocking の気づき

1. **【重大・訂正推奨】報告書 §2「触った 3 ファイルの個別再実行」の件数が実測と大きく乖離している**:
   domain-b.md は `node --test scripts/cockpit.test.mjs → # tests 106`・`cockpit-server.test.mjs → # tests 121`・`cockpit-settings-store.test.mjs → # tests 44` と記載しているが、独立実行（`--test-reporter=tap` で再確認・各ファイルの `test(` 呼び出し数を `grep -c` で数えて突合済み）では **43 / 92 / 32** だった。全体テスト（814/814）は独立検証で一致しており、diffstat（6 files, 519 insertions, 7 deletions）や個別ファイルの新規テスト内容（createBrainHooks 6 種・/api/brain 6 種・brainChoice store 4+ 種）はすべて実ファイルと一致することを確認済みなので、**実装自体の無退行・機能の正しさへの影響はない**。しかし報告書に記載された個別ファイルのテスト件数はどう見ても事実と異なり（2 倍以上の水増し）、正確性に重大な疑義がある。原因の推測: 全体実行時の TAP 連番出力（`# Subtest:` が全ファイル分フラットに連続する）のどこかの累積番号を、個別ファイルの件数と読み違えた可能性が高い（実際に試した限り、この推測と辻褄が合う）。Orch は domain-b.md §2 の当該記載を訂正させるか、少なくとも他ドメインの報告書の同種の数字（個別ファイル実行結果）についても今後は独立検算を挟むことを検討されたい。
2. **エンドポイント数コメント「17→18」も実測とズレている（pre-existing・Domain B 起因ではない）**: `git show HEAD:apps/soul/agent/src/cockpit/cockpit-server.mjs` で変更前の実エンドポイント数を数えると（`/` 含む）**18 個**であり、コメントの起点「17」は Domain B 着手前から既に不正確だった。Domain B は `/api/brain` を追加して実際には 18→19 になったが、コメントは pre-existing の「17」を機械的に +1 して「18」としてしまったため、変更後のコメントも実測（19）と 1 ズレている。機能に影響はなく、Domain B が新規に持ち込んだズレでもない（既存の不正確さをそのまま踏襲した形）。将来ドメイン（Domain C 等）でこのコメントに触るタイミングで実測に合わせて訂正することを推奨（今回のブロッキングではない）。

## brainInitialChoice 削除の可否判定（再掲）

**妥当・差し戻し不要**。根拠は上記検証項目 8 参照（(a) 参照ゼロ (b) snapshot.brain が起動時現況を完全カバー (c) audioDevice/channel/visionTarget と同型でむしろ一貫性が高い）。

## 質問（Orch 宛て）

1. 上記 non-blocking §1（テスト件数の報告不一致）をどう扱うか。実装自体は PASS だが、Gnome の報告書の自己検証プロセスに疑義がある。domain-b.md の訂正を Gnome に指示するか、Orch 側で記録に留めて先へ進めるかの判断を仰ぎたい。
2. domain-b.md §6 の質問 2（createBrainHooks テストを 4→6 種に拡張）・質問 3（session let の型注釈を据え置き）は spec レーンの blocking 判定には影響しないため、design/test レーンまたは Orch 裁定に委ねる。
