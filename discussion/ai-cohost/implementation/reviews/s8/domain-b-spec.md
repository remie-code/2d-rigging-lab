# S8 Domain B レビュー — spec 適合レーン

> レビュアー: Review-Sylph（spec 適合レーン・読み取り専任）
> 対象: `apps/soul/agent/src/cockpit/cockpit-server.mjs` / `view-logic/control.mjs` / `ui/control-bar.mjs` / `ui/app.mjs` / `ui/styles.mjs` / `apps/soul/agent/scripts/fire-hotkey.ahk`
> 判定基準: [s8-wave-plan.md](../../orchestration/s8-wave-plan.md) §Domain B・§1、[s8-planning-inventory.md](../../orchestration/s8-planning-inventory.md) §2-2・§1-2 裁定 3/7

## 判定: **合格**

機械ゲート（`node --test` 全緑）を独立再実行で確認。`apps/soul/agent` を cwd にフルスイートを実行し、Gnome 報告と同一の結果（738 → 751、+13 net）を得た。

```
1..751
# tests 751
# suites 0
# pass 751
# fail 0
# cancelled 0
```

Domain B 対象 3 ファイル（`cockpit-server.test.mjs`・`cockpit-ui.test.mjs`・`view-logic/control.test.mjs`）のみを直接指定して再実行しても 136/136 緑（部分独立確認）。

## spec チェックリスト（✓/✗ + 根拠）

### 1. POST /api/kill（明示指定・トグル禁止）— ✓

`cockpit-server.mjs:934-963`。

- orchestrator 未注入は `503 { error: "kill control not available" }`（:936-939、`/api/fire` の :807-809 型と同型のゲート）。
- `typeof body.killed !== "boolean"` は `400 { error: "killed must be a boolean" }`（:944-947）。body 欠落（`{}` → `body.killed === undefined`）も同じ経路で 400 になることを実測確認（後述テスト参照）。
- サーバはトグルしていない: `killed = body.killed;`（:948）で受け取った boolean をそのまま代入するのみ。反転演算子・前状態参照は一切なし。
- `/api/self-fire`(:886-905) 写経であることをコメント(:935-936, :941-942)で明記。`broadcastState()` → `sendJson(res, 200, snapshot())` の順序も self-fire/verbosity と同型。

テスト: `cockpit-server.test.mjs:236-341`（未注入 503／snapshot 初期値／`{killed:true}`成功+SSE／`{killed:false}`成功／非 boolean 400／body 欠落 400／born-killed）の 7 件で個別に実測確認済み。

### 2. snapshot に killed 露出 — ✓

`snapshot()` 内 `killed: killed`（cockpit-server.mjs:507、`selfFire`/`verbosity` の隣）。GET `/api/state` はこの `snapshot()` をそのまま返す（:768-770 付近）ため反映される。SSE `state` イベントも `broadcastState()` が `broadcast("state", snapshot())`（:540）を呼ぶため同じオブジェクトが乗る。

テスト: `:248-257`（GET /api/state に `killed:false` 初期値）、`:266-281`（POST 後の GET 反映 + SSE `state` イベントに `killed:true` が乗ることを `client.waitFor` で直接観測）。

### 3. キル状態の正本はサーバ側一つ — ✓

`cockpit-server.mjs` 全体を `killed` で grep し、代入箇所が `let killed = false;`（宣言・:442）と `killed = body.killed;`（POST /api/kill ハンドラ内・:948）の 2 箇所のみであることを確認した（他の出現は読み取りまたはコメント）。書き手は POST /api/kill ハンドラのみであり、要求どおり単一の正本。

### 4. 生成時 + 遷移時の両方伝播 — ✓

- 生成時: `fireOrchestratorFactory(...)` 呼び出しの hooks に `initialKilled: killed`（:1166）。テスト `:332-341`（born-killed: サーバ起動直後 `initialKilledSeen === false` を fake factory で捕捉）で確認。
- 遷移時: POST /api/kill ハンドラが `killed` の値に応じて `await fireOrchestrator.kill()` または `fireOrchestrator.revive()` を呼ぶ（:952-957）。テスト `:259-301` で `kill()`/`revive()` の呼び出し回数を実測確認。

両方の伝播経路が実装・テストの双方で裏付けられている。

### 5. KILL ボタン活性化 — ✓

`control-bar.mjs` の `KillSwitch`（旧: `disabled` 固定の no-op ボタン）は `{view, onClick}` props を受け取る活性化済みコンポーネントに変更された（:493-500）。`ControlBar` 内 `onClickKill`（:533-552）は `nextKilled = !killView.killed` を明示計算し `POST /api/kill {killed: nextKilled}` を送る。通常時は「■ KILL」ボタン→クリックで `{killed:true}`、キル中は「◆ 復帰」ボタン＋「殺し中」status→クリックで `{killed:false}`。一クリックで revive が送信される構造を確認した。

テスト: `cockpit-ui.test.mjs:386-412`（`KillSwitch` vnode の `killed=false`/`killed=true` 両状態・`disabled` 属性が付かないこと・onClick 素通し）で vnode レベルの検証あり。`ControlBar` 本体は hooks を使うため vnode 走査の対象外（`SelfFirePill` 等の既存部品も同じ制約・:441 コメントに明記された既存の慣行）で、`onClickKill` 自体の統合テストは無いが、これは既存の `onToggleSelfFire` にも適用されている同一パターンであり Domain B 固有の欠落ではない。

### 6. キル中はバーが視覚的に「殺し中」— ✓

`ControlBar` のトップ要素 class が `"control-bar" + (killView.killed ? " killing" : "")`（:556）で切り替わる。`styles.mjs` に `.control-bar.killing { border-color: var(--down); box-shadow: 0 0 0 1px var(--down) inset; }`（:592-595）追加。`KillSwitch` 自体も `.kill-switch.killed` で背景反転（:586-589）。

テスト: `cockpit-ui.test.mjs:420-422`（`COCKPIT_CSS` に `.control-bar .kill-switch.killed` と `.control-bar.killing` の両クラスが存在することを直接 assert）。人間ゲート「操縦席にキル状態が見える」は class 名・CSS 内容の両面から満たされていると判断できる。

### 7. ^!k = kill 専用 — ✓

`fire-hotkey.ahk:42` `^!k:: KillSoul()`。`KillSoul()`（:52-65）は常に `req.Send('{"killed":true}')` のみを送信し、`revive`/`{"killed":false}` を送るコードパスは存在しない（grep 済み・ハードコード文字列リテラル）。既存 `FireSoul`/`FireVision` と同型で `http://127.0.0.1:` + `CockpitPort` 定数（:26 で宣言済み）に限定、`try/catch` で失敗を無通知に握る（:53-64）。コメント（:56-58, :40-41）にも「kill 専用・revive は送らない」の明記あり。

### 8. 16→17 コメント追随 — ✓

`cockpit-server.mjs` 内「16 エンドポイント×13 SSE」を grep すると、diff 対象の 2 箇所（旧 :279 相当の JSDoc・旧 :1014 相当の静的アセット節コメント）が両方とも「17 エンドポイント×13 SSE」に更新されている。他に「16」表記の残存箇所なし。

実数による独立検証:
- API ハンドラ分岐（`method === "..." && pathname === "..."`）を数えると POST /api/kill 追加後で 18 本（GET `/` を含む）。棚卸し文書 §2-2 が「16 エンドポイント×13 SSE」は機械カウントでなく手動更新の慣行と明記しているため厳密な数式一致より増分の正しさを検証した——今回の diff で新設された分岐は `/api/kill` の 1 本のみであり、16→17 の +1 更新は増分として正しい。
- SSE ユニークイベント名（`broadcast("...", ...)` の第一引数）を数えると `state, diagnostic, vad, transcript, discard, soul, fire, expression, visionCaptured, usage, selfFire, chatStatus, chatDiagnostic` の 13 種で新規イベントは追加されていない（`killed` は既存 `state` イベントの snapshot に相乗り）。13 不変を実数で確認した。

## 追加確認: Gnome 報告の質問 2 件への意見

### 質問 1: `snapshot.killed` を常に boolean（既定 false・null 非許容）にした非対称性

**blocking ではない。裁量許容と判断する。** wave 計画・棚卸し文書のいずれも「snapshot に killed 露出」としか要求しておらず、null 許容/非許容の指定はない。`selfFire`/`verbosity` の null は「scheduler 未生成 = 機能自体が存在しない」ことを表す設計であるのに対し、`killed` はサーバ自身が持つ boolean 正本であり、orchestrator の有無に関わらず「今キル状態か」という問いに常に答えられる、という設計理由も一貫している。人間ゲート要件（操縦席にキル状態が見える・一クリック復帰）にもこの裁量は影響しない。

### 質問 2: KillSwitch を「1 ボタン + 明示 boolean 送信」の controlled component にした実装形

**blocking ではない。裁量許容と判断する。** 裁定 7「ホットキーは殺す専用（トグルにしない）」は文脈上ホットキー（`^!k`）についての制約であり、操縦席 UI のボタン設計への言及ではない。wave 計画 §Domain B の文言「通常時=押すと kill、キル中=バー全体が視覚的に「殺し中」と分かる状態+復帰ボタン(一クリック revive)」も、「復帰のための操作口が一クリックで存在する」ことを要求しているだけで、KILL 用と復帰用が別 DOM 要素であることまでは要求していない。API 契約としての「明示指定・トグル禁止」は、サーバ側が受け取った boolean をそのまま設定するだけで反転ロジックを持たない実装（:948）により厳格に満たされている。UI 側が 1 ボタンの controlled component（`selfFireToggleView`/`VerbositySelect` と同型）である点は、既存様式との一貫性を優先した妥当な選択。

## まとめ

spec チェックリスト 8 項目全て ✓。`node --test` 独立再実行で 751/751 緑（Domain B 3 ファイル単独でも 136/136 緑）を確認。Gnome 報告の質問 2 件はいずれも blocking ではなく裁量許容と判断した。

## 質問（Orch-Sylph への確認事項）

特にブロッキングな不足情報はなかった。念のため 1 点:

- `ControlBar` 内 `onClickKill`（`nextKilled` の明示計算ロジック）自体を直接叩く統合テストは存在しない（vnode レベルの `KillSwitch` テストのみ）。これは既存の `onToggleSelfFire`/`onChangeVerbosity` にも同様に適用されている構造的制約（`ControlBar` が hooks を使うため vnode 走査の対象外という既存の慣行）であり、Domain B 固有の欠落ではないと判断し spec 適合レーンでは blocking としなかったが、test 品質レーンで別途評価が必要であれば申し送る。
