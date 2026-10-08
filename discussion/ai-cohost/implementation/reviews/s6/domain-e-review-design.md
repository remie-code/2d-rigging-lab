# S6 追撃 Domain E レビュー（design/設計品質レーン）

> レビュアー: Review-Sylph（Orch-Sylph 委任）。判定対象: `fire-orchestrator.mjs` の抽出リファクタ
> （`askWithVision`/`fireNormalCore` の 2 コア抽出）が既存経路（手動 Fire・手動視覚 Fire・silence・
> barge-in）の意味を変えていないか。読み取り専任・唯一の書き込みは本ファイル。

## 判定: **PASS（blocking なし）**

抽出リファクタは既存経路の外形・診断発行順序・戻り値・状態機械を変えていない。preferred の劣化経路も
二重受理・二重 append を起こさず、二重 idle は冪等ゆえ無害。usage 計器は正直（劣化/未設定時に
`vision:false`）。器コード・lockfile・契約 JSON は不変、全テスト緑（518/518）。

---

## 1. 抽出無退行の検証（コードで確認）

### 1-1. `fireNormalCore(alreadyAccepted:false)` と旧 `fire()` 通常経路の同一性

`git diff -- apps/soul/agent/src/mind/fire-orchestrator.mjs` を実際に読んだ。旧 `fire()` 内のインライン
実装（空窓ガード → `emit(onFire,{accepted:false,reason:"empty-window"})` → `setState("thinking")` →
`emit(onFire,{accepted:true,...})` → `session.ask` → `processAskedReply(vision:false)` → catch
`fireError` → finally `setState("idle")`）が、**1 行も意味を変えずに** `fireNormalCore` へ切り出され、
呼び出し側は `return fireNormalCore(buffer, { alreadyAccepted: false });` の 1 行に置き換わっているのみ。
diff の該当ブロックは純粋な「移動」であり、条件式・emit 順序・catch/finally の中身に差分はない。
`alreadyAccepted` 分岐は新規受理時（`false`）は全て無条件実行されるため、手動 Fire・preferred 対象未設定
のいずれでも旧経路と完全に同じ外形になる。

### 1-2. `askWithVision` 抽出後の `fireVision`（手動視覚/silence）

同様に diff を確認。旧 `fireVision` 内の「キャプチャ成功後」のインライン実装
（`onVisionCaptured` emit → `formatFireInjection` → 画像先行 `contentBlocks` 組み立て → `session.ask`
→ `processAskedReply(vision:true, {..., vision:true})`）がそのまま `askWithVision(buffer, captured, title)`
へ切り出され、`fireVision` 側は `return await askWithVision(buffer, captured, title);` の 1 行に置換。
- 対象未設定中止（`vision-no-target` + `fireVisionError{kind:"no-target"}`）
- キャプチャ失敗中止（`vision-capture-failed` + `fireVisionError{kind,message}`）
- thinking 遷移・accept emit・catch `fireError`・finally idle

はすべて `fireVision` 本体に残ったまま変更なし。「見えなければ中止」の 1 ビットは触れられていない。

### 1-3. `firePreferred` の劣化経路（§8 質問 3 の対象）

コードを読んで以下を確認した（`fire-orchestrator.mjs:641-677`）:

1. 対象未設定 → `fireNormalCore(buffer, {alreadyAccepted:false})` を **そのまま return**（新規受理経路。
   空窓なら `emit(onFire,{accepted:false,reason:"empty-window"})`、非空なら `emit(onFire,{accepted:true,
   injectedChars,includedCount,atMs})` を **1 回だけ** 発行）。`vision` フィールドの付かない通常の accept
   イベントになり、手動 Fire と区別が付かない形（ドキュメント §2-1 の記載と一致）。
2. 対象あり → `setState("thinking")` + `emit(onFire,{accepted:true,vision:true,atMs})` を **先に 1 回だけ**
   発行してから `captureImpl` を呼ぶ。
   - 失敗 → `emit(onDiagnostic,{type:"fireVisionDegraded",kind,message})` → `fireNormalCore(buffer,
     {alreadyAccepted:true})`。この経路では `fireNormalCore` 内の `if (!alreadyAccepted) { setState("thinking");
     emit(onFire,...) }` ブロックは **スキップされる**（`alreadyAccepted===true`）ため、accept は
     firePreferred 側の 1 回のみ。空窓時も `alreadyAccepted:true` のため `onFire` を出さず
     `{fired:false,reason:"empty-window"}` を返すだけ ── **二重受理なし**を確認。
   - `processAskedReply` は `fireNormalCore` から `vision:false` で 1 回だけ呼ばれる ── **二重 append なし**
     （`processAskedReply` 自体が buffer.append を高々 1 回しか行わない構造であることは §1-4 で確認済み）。
3. finally: `firePreferred` 自身の finally が `setState("idle")` を呼び、劣化経路では **その手前で
   `fireNormalCore` の finally も `setState("idle")` を呼んでいる**（二重）。`setState` は
   `if (state === next) return;` で早期リターンする冪等実装（`fire-orchestrator.mjs:228-232`）なので、
   2 回目の `setState("idle")` は emit すら発生しない。**二重 idle は構造的に無害**（コードで確認、
   :674 のコメントの主張と一致）。

### 1-4. barge-in（interrupt）との相互作用

`processAskedReply`（fire-orchestrator.mjs:297-408）は `askWithVision` 経由でも `fireNormalCore` 経由でも
**完全に同一の関数**を通る。speak 後の再生実区間追跡（`currentPlayback` の設定・自然完了タイマ・
`interrupt()` による `resolve`）は `processAskedReply` 内部にのみ実装されており、vision フラグや呼び出し元
（fireVision/fireNormalCore/askWithVision のどれ経由か）によって分岐する箇所はコード上どこにも無い。
`interrupt()`（:417-500）も `currentPlayback`（モジュールスコープの単一変数）を見るだけで、どの発火モード
から来たかを一切区別しない。したがって **preferred 経由の speak 中でも interrupt は理論上ではなくコード
構造上同一に効く**。ただし `fire-orchestrator.test.mjs` に preferred 経由の speak 中に `interrupt()` を
明示的に呼ぶ専用テストは見当たらなかった（`grep` で確認、11 本の新規テストは §4-1 の分岐固定のみ）。
既存の barge-in テスト（Domain B・通常 Fire/手動視覚 Fire 経由）が `processAskedReply` の共有経路を
固定しているため無退行の担保としては十分と判断するが、**preferred 経由の barge-in 専用テストが無いのは
テストカバレッジ上の隙間**として non-blocking で指摘する（§下記）。

### 1-5. usage 計器の正直性

`processAskedReply` 冒頭（:298-301）で `emit(onUsage, {usage: asked.usage, vision})` の `vision` は
呼び出し元が渡した第三引数そのもの。`fireNormalCore` は常に `false` を渡す（:574）。`askWithVision` は
常に `true` を渡す（:537）。劣化/対象未設定は必ず `fireNormalCore` を経由するため `vision:false` で通知
される。成功時のみ `askWithVision` 経由で `vision:true`。**見ていないのに true と言うコードパスは存在
しない**ことをコードで確認した。

### 1-6. cockpit-server.mjs の出し分け

`onFireRequest` は `req.kind === "silence" ? fire({vision:true}) : fire({vision:"preferred"})` の三項の
みで、SSE `broadcast("selfFire", {kind, fired, reason})` の形は変更前と同一（cockpit-server.mjs:958-985）。
additive フィールドなし。薄い出し分けのみで、コメントが裁定内容に更新されている。

---

## 2. 自分で実行したチェック（生数字）

```
cd apps/soul/agent && node --test
# tests 518
# pass  518
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

```
git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' \
  pnpm-lock.yaml apps/soul/agent/package.json
→ 出力なし（器コード・契約 JSON・lockfile・package.json すべて不変）
```

```
node scripts/check-soul-zone-boundary.mjs
→ Soul zone boundary guard passed: 1342 source files scanned; no 器→魂 imports and no 魂→器 code imports.
```

`cockpit-server.test.mjs` の diff も確認: 変更は宣言どおり 1 アサーションのみ
（`assert.equal(lastFireOptions, undefined)` → `assert.deepEqual(lastFireOptions, {vision:"preferred"})`、
コメント更新込み）。他のアサーション・テストケースの追加/削除なし。

---

## 3. blocking / non-blocking

**blocking: なし。**

**non-blocking（申し送り）:**
1. §8 質問 3（劣化フォールバックの受理タイミング齟齬）: 「vision:true で受理 → 実は画像なしに劣化」という
   一瞬の履歴齟齬はコード上確認したとおり実在するが、意図的設計判断（反応の即時性優先）であり、二重受理・
   二重 append のような構造的欠陥ではない。UI 表現の妥当性は Domain D/UX 領分の判断に委ねるのが適切。
2. §8 質問 1（診断型名 `fireVisionDegraded` / `{kind,message}` を既存 `kind` フィールドに相乗り）: 既存
   broadcast 経路を汚さない設計として妥当。cockpit.html 側の専用表示要否は UI 判断であり本レーンの対象外。
3. preferred 経由で speaking 中に `interrupt()` が呼ばれる専用の縦検証テストが `fire-orchestrator.test.mjs`
   に見当たらない（§1-4）。コード構造上は `processAskedReply` 共有により無退行と判断できるが、テストで
   明示的に固定されていれば将来の変更に対する回帰検知力が上がる。テストレーンへの申し送り候補。
4. §8 質問 4（cockpit-server の timer 依存 turn-end/silence 分岐が結線層テストで未固定）: orchestrator 層
   で全分岐が fake 固定済みという分業自体は妥当であり、本レーンでは blocking としない。

---

## 4. 器・依存不変の確認

- `apps/runtime-player/**`・`packages/**`・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`:
  `git diff --stat` 出力なし（実行して確認済み）。
- `fire-scheduler.mjs`（Domain C）・`barge-in.mjs`/barge-in 本体（Domain B）・`src/voice/**`・`src/eyes/**`・
  cockpit.html・cockpit.mjs・settings-store: コード上 import して契約を消費するのみで、ファイル自体への
  変更は diff に含まれていないことを確認。
- `.tmp/facex-*` には一切触れていない（本レビューでも読み書きしていない）。

---

## 5. 総評

抽出（`askWithVision`/`fireNormalCore` の 2 コア共有化）は「新しい ask 経路を書き足さず、既存インライン
実装をそのまま切り出して再利用する」という設計方針どおりに実装されており、diff を実際に読んでも
意味変更が混入していないことを確認できた。preferred の劣化フォールバックは accept の再 emit を条件分岐
で明示的に防いでおり、二重 idle も `setState` の冪等性により構造的に無害。usage 計器は vision フラグを
呼び出し元の実態（画像を渡したか否か）に忠実に紐付けており、「見ていないのに見たと言わない」という
裁定③の要求を満たしている。barge-in との相互作用は共有関数経由のため理論上も構造上も無退行だが、
preferred 経由の interrupt 専用テストが無い点は non-blocking の申し送りとして記録した。
