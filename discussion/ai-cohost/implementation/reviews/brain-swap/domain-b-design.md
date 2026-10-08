# Domain B（選択の配線: cockpit + cockpit-server）レビュー — design レーン

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: `apps/soul/agent/scripts/cockpit.mjs` / `apps/soul/agent/src/cockpit/cockpit-server.mjs` / `cockpit-settings-store.mjs` ほか Domain B 成果物一式。
> 基準: [brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §4 blocking 基準（主眼 #2 Claude 無退行・#7 KILL 頭非依存）。
> 方法: Gnome の実装報告（`waves/brain-swap/domain-b.md`）は裏取り対象として読み、判断は実コード精読・`git diff`・自分での `node --test` 実行に基づく。

## 総合判定: **PASS**

blocking #2（Claude 頭の 1 ビット無退行）・#7（KILL 頭非依存）ともに、独立検証で成立を確認した。ワイヤ契約 additive・資格情報の不可侵（design 面）も確認できた。一方で、**実装報告書 §2 の「node --test 実行結果」に記載された個別ファイルの絶対テスト数が、独立再実行の結果と大きく食い違っている**ことを発見した。これは blocking 基準のいずれにも直接該当しないが、報告書の自己検証ログの信頼性にかかわる重大な指摘として §6 に独立して記載する。

---

## 1. 【最重要 blocking #2】Claude 経路のバイト等価 — 独立検証

`git diff` で `ensureFireResources` の変更前後を自分で確認した（`apps/soul/agent/scripts/cockpit.mjs`）。

**変更前**:
```js
if (session == null) {
  const { warnings } = assertSubscriptionAuthEnv(process.env);
  for (const warning of warnings) {
    process.stderr.write(`[cockpit] WARN: ${warning}\n`);
  }
  session = createLlmSession({
    systemPrompt: FIRE_SYSTEM_PROMPT,
    onWarning: (w) => process.stderr.write(`[cockpit] WARN: ${w}\n`),
    onInit: (init) => process.stderr.write(...)
  });
}
```

**変更後**:
```js
if (session == null) {
  const brainDef = BRAINS[currentBrain] ?? BRAINS.claude;
  if (currentBrain === "claude") {
    const { warnings } = assertSubscriptionAuthEnv(process.env);
    for (const warning of warnings) {
      process.stderr.write(`[cockpit] WARN: ${warning}\n`);
    }
  }
  session = brainDef.create({
    systemPrompt: FIRE_SYSTEM_PROMPT,
    onWarning: (w) => process.stderr.write(`[cockpit] WARN: ${w}\n`),
    onInit: (init) => process.stderr.write(...)   // 一字一句無変更
  });
}
```

独立検証の結論: **`currentBrain === "claude"` のとき、この分岐はバイト等価である**。根拠:

1. **registry ラッパの等価性を自分で確認**: `apps/soul/agent/src/mind/brains.mjs:50` の `claude: { create: (options) => createLlmSession(options), ... }` を実際に読んだ。純粋な引数透過ラッパであり、`brainDef.create({systemPrompt, onWarning, onInit})` は `createLlmSession({systemPrompt, onWarning, onInit})` と同一引数・同一呼び出しに解決される。
2. **env-guard の呼び出しと出力順序が不変**: `if (currentBrain === "claude")` の中身は `assertSubscriptionAuthEnv(process.env)` → `warnings` を同じ `process.stderr.write` フォーマットで出力、という従来と同一コード。`const brainDef = ...` の lookup は `BRAINS`（`Object.freeze` された純粋な static オブジェクト参照）を引くだけで副作用が無く、env-guard より前に置かれても実行順序上の意味は変わらない。
3. **onWarning/onInit クロージャ本体が無変更**: diff 上、この2つの無名関数は1文字も変わっていない。
4. **Codex 経路は cockpit 側で Anthropic guard を通さない**: `currentBrain === "codex"` のときは `if (currentBrain === "claude")` ブロックがスキップされ、`codex-session.mjs:353-360` 内部で `assertSubscriptionAuthEnvOpenAI` が独立に走る設計を実コードで確認した（Domain A 無変更ファイル）。Anthropic guard が誤って Codex に適用される経路は無い。

**担保**: 既存 cockpit テスト（後述 §5 のとおり独立実行で 43 本全緑・うち claude 頭の eager 生成経路を含む既存分は無退行）。

結論: **blocking #2 は満たされている**。

---

## 2. snapshot の既存キー不変性

`cockpit-server.mjs` の `snapshot()`（:500-535）全体を自分で読んだ。追加は `brain:` の1キーのみで、`killed` と `audioDevice` の間に additive で挿入されている。他の全キー（`ears`/`device`/`health`/`appended`/`discarded`/`uptimeMs`/`transcripts`/`channel`/`visionTarget`/`selfFire`/`verbosity`/`killed`/`audioDevice`/`chat`）は式・値ともに1バイトも変わっていないことを目視で確認した。

---

## 3. 切替意味論（brain-swap.md §9 (a')）

`onSetBrain`（cockpit.mjs）の実コード:
```js
const onSetBrain = async (choice) => {
  brainHooks.onSetBrain(choice); // 永続化
  currentBrain = choice;          // 状態正本の更新
  if (session != null) {
    try { await session.dispose(); } catch { /* best-effort */ }
    session = null;
  }
  process.stdout.write(...)
};
```
「永続化 → currentBrain 更新 → 現 session を dispose → null」という §9 の記述と完全一致する順序を確認した。`dispose()` は `try/catch` で握られており、失敗しても `session = null` に進む（best-effort）。次回 `ensureFireResources()` が `currentBrain` を見て新頭を生成する構造（inventory §2-1 のホットスワップ経路）と一致する。

`POST /api/brain` ハンドラ（cockpit-server.mjs:982-1005）は `onSetBrain` を `await` してから `broadcastState()` + `snapshot()` を返す。これは「HTTP レスポンス自体が dispose 完了を待つ」ことを意味するが、**in-flight の `ask()` 自体は別 Promise であり `POST /api/brain` の処理とは独立してブロックされない**ことを §4 のテストで確認した（non-blocking 所見として §7 に記載）。

---

## 4. 【blocking #7】KILL 状態が切替を跨いで生存

- `apps/soul/agent/scripts/cockpit.mjs` 全体を `killed`/`onSetKill` で grep したが**ヒットなし**。`onSetBrain` は `brainHooks.onSetBrain` / `currentBrain` / `session` のみに触れ、KILL 状態には一切アクセスしない。
- KILL の正本は `cockpit-server.mjs:457` の `let killed = false`（サーバ側クロージャ変数）にあり、`POST /api/kill` ハンドラ（:951-）のみが更新する。新設した `POST /api/brain` ハンドラ（:982-1005）を読んだが、`killed` への参照は無い。
- 検問所（NG ワード / KILL チェック）は `fire-orchestrator.mjs`（Domain B 変更対象外）の `processAskedReply` 内に固定であり、`git diff --stat` で `fire-orchestrator.mjs` が Domain B により無変更であることも確認した。

**結論: blocking #7 は満たされている**——安全弁は頭の外にあるという構造を Domain B は一切崩していない。

---

## 5. 切替×in-flight テストの妥当性（domain-b.md §3-2）

`cockpit.test.mjs` の新規テスト「brain 切替×in-flight」を読んだ。実装コードから直接 export されている **`createSessionProxy`（cockpit.mjs:208、実 read-path 本体）をそのまま使用**している。既存の `createSessionProxy` テスト3本（同ファイル:244-299、Domain B 以前から存在）と同一のパターン（fake `ensureFireResources`/`getSession` を注入する最小ハーネス）を踏襲しており、このリポジトリの既存の慣習と整合する。

テスト内の `ensureFireResources`/`onSetBrain` ヘルパは、main() 内の実装をそのまま呼べない（`main()` はモジュール非公開でテスト不可）ための同型再実装だが、実装側の実コード（cockpit.mjs:483-514 の `ensureFireResources`、:576-591 の `onSetBrain`）と突き合わせ、以下の骨格が一致することを確認した:
- `session == null` のときだけ新頭を生成する
- `onSetBrain` は `currentBrain` を更新し、`session != null` なら `dispose()` → `session = null`

頭生成内部のロジック（`BRAINS` lookup・env-guard 分岐）自体はこのテストでは再現されていないが、それは §1 で扱う既存の claude eager 生成テスト群の責務であり、切替×in-flight テストの責務（dispose→null→次発火で新頭、かつ切替が in-flight をブロックしない）と役割分担が取れている。**弱いテストではなく、責務分離された妥当なテスト**と判断した。

---

## 6. brainStatus の健全性（blocking #4 design 面）

```js
const brainStatus = () => {
  const def = BRAINS[currentBrain] ?? BRAINS.claude;
  return { brain: currentBrain, credentialHealth: existsSync(def.credentialPath) };
};
```
`existsSync` の1呼び出しのみ。`readFileSync`/`open` 等の中身読み込みは cockpit.mjs 全体を通じて `brainStatus` 周辺に存在しない。credentialPath 自体も snapshot に載らない（`brain`/`credentialHealth` の2キーのみ）。

---

## 7. brainInitialChoice 削除の設計妥当性（domain-b.md §6.1）

Gnome は委任文の指示（`brainInitialChoice: currentBrain` を additive で渡す）から意図的に逸脱し、`brainInitialChoice` を削除している。論理を実コードで裏取りした:

- `cockpit-server.mjs` を grep した結果、`audioDeviceInitialChoice`・`channelInitialUrl`・`visionTargetInitial` の類は**存在しない**。これらは status callback（`audioDeviceStatus`/`channelStatus`/`visionTargetStatus`）のみで起動時現況を運ぶ設計であることを確認した。
- 一方 `verbosityInitialMode`（:352, :428, :1246）は実在し、`fireScheduler` 生成時に verbosity の初期値として直接 seed されている（:1246 `verbosity: verbosityInitialMode`）。つまり **verbosity だけは server 側（fireScheduler）が状態を保持するため初期値が必要**という非対称性が実コードで裏付けられた。
- brain の状態正本は cockpit.mjs 側の `currentBrain` のみであり、server 側に brain の状態保持先は無い。`brainStatus()` が `{brain, credentialHealth}` を毎回運ぶため、起動時現況の欠落は無い。

Gnome の論理（brain は audioDevice/channel/visionTarget と同型で `*InitialChoice` 不要、verbosity は例外）は実コードと整合しており、**設計判断として妥当**と判断した。ただし、委任文からの明示的な逸脱であるため、最終可否は Orch 裁定に委ねる（§9 に質問として記載）。

---

## 8. 自分で実行した `node --test`

**全体（`apps/soul/agent`）**:
```
1..814
# tests 814
# pass 814
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
ベースライン 797 → 814（+17）は独立再現できた。

**触った3ファイルの個別再実行**:
```
$ node --test scripts/cockpit.test.mjs
# tests 43 / pass 43 / fail 0
$ node --test src/cockpit/cockpit-server.test.mjs
# tests 92 / pass 92 / fail 0
$ node --test src/cockpit/cockpit-settings-store.test.mjs
# tests 32 / pass 32 / fail 0
```
全緑で回帰ゼロ。ただし絶対数について §9 の重大な指摘を参照。

---

## 9. 重大な指摘（non-blocking だが独立して強調）: 実装報告書の個別テスト数が事実と異なる

domain-b.md §2「node --test 実行結果」は、個別ファイルの実行結果を次のように報告している:
```
node --test scripts/cockpit.test.mjs → # tests 106
node --test src/cockpit/cockpit-server.test.mjs → # tests 121
node --test src/cockpit/cockpit-settings-store.test.mjs → # tests 44
```
しかし §8 のとおり、**私が独立に同じコマンドを実行した結果は 43 / 92 / 32 であり、事実と一致しない**（2倍以上の乖離）。

根拠をさらに詰めた: `git show HEAD:<file> | grep -c '^test('` でベースライン（変更前）のトップレベル `test()` 呼び出し数を数えると 36 / 86 / 28 であり、現在の絶対数（43/92/32）との差分は **+7 / +6 / +4** — これは domain-b.md が主張する新規追加テスト数（createBrainHooks 6 種+切替×in-flight 1 種=7、POST /api/brain 6 種、brainChoice 4 種）と完全に一致する。つまり:
- **新規追加数の主張は正しい**
- **全体テストスイートの合計（797→814、+17）も独立再現できた**
- しかし **個別ファイルの絶対テスト数（106/121/44）という「自己実行・生の末尾」と明記された数字は、実際の実行結果ではない**（36+7=43 が真の値であり、106 ではない）

コード自体の正しさ（§1-7 の独立検証）はこの発見と独立に成立しており、総合判定を PASS から動かす実害は見つからなかった。しかし「自分で実行し確認した」と明記された生ログが実際の出力と一致しないのは、レビューの前提（Gnome の説明を鵜呑みにしない）そのものが必要である証左であり、Orch には強く申し送る。今回は全ての blocking 項目を私自身が独立再検証したためこのレーンの結論には影響しないが、他レーン（spec/test）のレビュアにも同様の独立確認を推奨する。

---

## 10. non-blocking の気づき

1. **`POST /api/brain` のレスポンス遅延**（non-blocking）: ハンドラが `await onSetBrain(choice)` してから 200 を返すため、`session.dispose()` が重い頭（例: Codex の rollout 削除+workingDirectory 削除）だと HTTP レスポンス自体は遅延しうる。ただし in-flight の `ask()` はこの await と別 Promise であり、切替自体をブロックする実害は無い（§5 で確認）。
2. **`brainInitialChoice` 削除は Orch 裁定待ち**（§7 参照・委任文からの明示的逸脱）。

---

## 11. 質問（Orch への申し送り・Gnome の記録を転記 + レビュー独自分）

1. **`brainInitialChoice` 削除を追認するか**（domain-b.md §6.1 転記）: Gnome は「server が読まない dead option」と判断し削除した。design レビューとしては論理は妥当と判断したが、委任文の字面からの逸脱であるため Orch 裁定が必要（差し戻す場合は cockpit.mjs 側1行+cockpit-server JSDoc 1段落を戻すだけで済む・現状これを参照するテストは無い）。
2. **§9 の実装報告書テスト数の不一致について、Gnome に訂正を求めるか**: コードの正しさへの影響は無いと判断したが、報告書の正確性のプロセス上の問題として、Orch から Gnome へフィードバックすることを推奨する。

以上、design レーンとしては **PASS**。
