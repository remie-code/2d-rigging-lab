# C1 Domain B レビュー — レーン3: test adequacy

> レビュー担当: Review-Sylph(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。
> 対象: `apps/runtime-player`。判定基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §7/§9/§11、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) 観点8。
> レーン: test adequacy(C1 ゲートの機械検証部分が実効か)。spec 突合・design 規律は別レーン。

## 判定: **合格**

§7 Domain B Tests の5項目すべてに対応テストが実在し、assert が本質を突いている。最重要テスト(`input-subsystem.test.ts` の autonomousHost 入力レジストラ不在)は spy ベースで「呼ばれないこと」+ trackingHost 対照 + inert seam を検証しており、存在確認で済ませていない。focused 56 件を自分で実行して pass を確認。Gnome 主張の「全体2失敗=既存 baseline(`effectiveDynamicsTuning`/Wave21 系)、新規失敗ゼロ」を該当2テストの内容確認と件数整合で妥当と評価した。ブロッキングなテスト欠落なし。下記の欠落は全て**パッケージ版手動ゲート(§8)に正しく落ちる項目**か**構造で不変条件が担保され追加テスト不要**な項目で、要修正には当たらない。改善指針は注記として付す。

---

## §7 Tests 網羅マトリクス

| §7 項目 | 対応テスト | 実効性 | 評価 |
|---|---|---|---|
| (a) autonomousHost 合成に UDP リスナー/入力レジストラが存在しない | `role-composition/input-subsystem.test.ts` | **強**: 注入した3レジストラ spy が `not.toHaveBeenCalled()`、`usesTrackingInput===false`、inert seam(null/resolve/`liveParameters.clear`)を検証。trackingHost 対照で3レジストラ各1回 + `usesTrackingInput===true` も検証 | 十分 |
| (b) startup status に role が乗る | `placeholder-action-state.test.ts` | 既定 `role===null` と指定時 `{id,label}` の両方を検証 | 十分 |
| (c) タイトル文字列が役割を含む | `window-management/window-title.test.ts` | **強**: Control/Stage が役割名を含む、モデル名後置、空白モデル名除外、role=null で従来 base への byte 一致フォールバック。トレイ tooltip 書式(`— <role> / <model>`)も同ファイルで検証 | 十分 |
| (d) Header バッジの render(role 別) | `control/control-window-shell.test.ts` | tracking=teal / autonomous=violet の色クラス present、かつ両者が色を共有しないこと(`not.toContain`)を検証。`renderToStaticMarkup` で決定論的 | 十分 |
| (e) 引数なし経路がスタブに到達(自動束縛なし) | `role-composition/role-selection-stub.test.ts`(スタブ挙動)+ Domain A `profile-slots/role-launch-resolution.test.ts`(引数なし→`kind:"no-role"`) | スタブ挙動(選択で relaunch/cancel で quit/選ぶまで束縛なし)は**強**。arg→`no-role` kind は Domain A で検証済。**routing glue(main の `if(kind!=="role-resolved")→スタブ`)のみ未テスト** | 十分(routing glue は手動ゲート §8.8 に落ちる。下記注記) |

---

## 最重要テストの質(観点2: input-subsystem)

**十分・良質**。`input-subsystem.test.ts` は3レジストラを `vi.fn()` で注入し、autonomousHost で `registerInputBridgeHandlers` / `registerInputProfileBridgeHandlers` / `registerModelMappingBridgeHandlers` が**1回も呼ばれないこと**を直接 assert(存在確認ではない)。trackingHost で各1回呼ばれる対照も存在。inert seam の実挙動(`getLatestTrackingFrame()===null`、`getActiveInputProfile()` resolves null、`disconnect()` resolves、`clearLiveParameterFrame()` が `liveParameters.clear` を1回呼ぶ)も検証。

- **UDP receiver factory 未到達の担保**: 直接の assert は無いが、UDP 受信器は `registerInputBridgeHandlers` が登録する connect IPC ハンドラの下流でのみ `createReceiver().start()` される(棚卸し観点5 の接地事実)。当該レジストラが呼ばれないことを assert しているため、receiver factory 未到達は**推移的に担保**される。構造上妥当。(改善余地: receiver factory を deps に注入して未呼び出しを直接 assert すればより明示的だが、必須ではない。)

## スタブテストの質(観点3: role-selection-stub)

**十分**。純オーケストレーション `presentRuntimePlayerRoleSelectionStub` を IO seam 注入でテスト:
- 「選択で relaunch」: `relaunchWithRole("autonomousHost")` 呼出 + quit 不呼出 + outcome を検証 ✓
- 「cancel で quit」: `quit` 1回 + relaunch 不呼出 + `{kind:"cancelled"}` ✓
- 「選ぶまで role に束縛しない」: `chooseRole` を先に1回聞き、null なら relaunch しないことを検証 ✓
- 「ディスク書き込みなし」「記憶を持たない」: **構造で担保**。純関数は IO seam に `chooseRole`/`relaunchWithRole`/`quit` しか持たず、永続化の口が型レベルで存在しない。追加テスト不要と評価。

---

## 自分でのテスト実行結果(再現)

コマンド: `cd apps/runtime-player; npx vitest run -c vitest.config.ts <paths>`(`pnpm install` 不実施)。

### focused(Domain B 対象 + 影響): **56 passed / 8 files** — Gnome 主張と一致

```
✓ runtime-player-tray-menu.test.ts (6)  ✓ placeholder-action-state.test.ts (6)
✓ window-title.test.ts (5)              ✓ role-selection-stub.test.ts (3)
✓ browser-window-options.test.ts (5)    ✓ stage-view-bridge-handlers.test.ts (25)
✓ control-window-shell.test.ts (2)      ✓ input-subsystem.test.ts (4)
Test Files 8 passed (8) / Tests 56 passed (56)
```

### baseline 2 失敗の妥当性: **確認・妥当**

該当2テストを直接実行し、Gnome 主張を検証:
- `broadcast-source/browser-source-server.test.ts` > "serves current Runtime Export payload..." → FAIL
- `stage/browser-source/browser-source-server-message.test.ts` > "accepts the not-loaded response shape" → FAIL
- **両失敗とも diff は `+ "effectiveDynamicsTuning": null`**(Wave21 Dynamics Tune 系)。両ファイルとも Domain B の変更ファイル一覧に**不在**。テスト名・失敗フィールドが Gnome/Domain A 報告と一致。→ 既存 baseline で確定、**Domain B 由来の新規失敗ゼロ**。件数整合(focused 56 pass、全体 536 中 534 pass / 2 fail 据え置き)も矛盾なし。

---

## 機械検証に落ちない部分の切り分け(観点5)

**適切に切り分けられている。偽装なし**:
- **relaunch が実際に role-resolved インスタンスを生む**: テストは `relaunchWithRole` を spy(IO seam)にし、「呼ばれたこと」だけを assert。relaunch が実インスタンスを生むことは**偽装していない**(§8.8 手動ゲートに委譲)。健全。
- **片方 kill 耐性**: プロセス独立性=OS 性質。ユニット層に一切持ち込んでいない(§8.7 手動ゲート)。偽装なし。

---

## フレークリスク(観点6)

**低**。追加テストは全て決定論的:
- 純関数(window-title)、spy 注入(input-subsystem/stub/tray)、`renderToStaticMarkup`(control-window-shell — jsdom render ではなく server-side static。DOM/タイマ非依存で極めて安定)。
- 実 IPC・実 window・実タイマ・時刻依存なし。`placeholder-action-state` は固定 ISO(`1970-...`)。
- React render テストの安定性: 問題なし(static markup + 文字列 contain 判定)。

---

## 欠落テスト一覧(+指針。いずれも非ブロッキング)

1. **no-role → スタブ routing glue が未テスト**(§7(e) の残り半分)。`runtime-player-main.ts` whenReady 内 `if (launch.kind !== "role-resolved") { present stub }` の3行分岐に対応するユニットテストが無い(`runtime-player-main.test.ts` は存在しない=合成ルートは慣例的に未ユニットテスト)。arg→`no-role` kind は Domain A で、スタブ挙動は Domain B でカバー済のため、未カバーは薄い glue のみ。**手動ゲート §8.8「引数なし起動 → 役割選択スタブ」が正しくこれを閉じる**。指針: 必須ではないが、routing 判断を純関数に切り出す(例: `resolveWhenReadyEntry(launch.kind): "stub"|"role-app"`)と機械化できる。要修正には該当せず。

2. **`createRuntimePlayerRoleSelectionStubIo`(Electron-backed IO)が未テスト**。ボタン表→役割の順序 lookup(`orderedRoles[response] ?? null`)、`noLink`、「今後表示しない」チェックの不在が未検証。役割順序変更時の off-by-one を機械検出できない。指針: `dialog`/`app` を注入可能にして「buttons が役割ラベル + Cancel のみ(remember チェックなし)」「button index→役割対応」を assert すると、skeleton §2 の恒久禁止(記憶なし)を IO 層でも固定できる。純オーケストレーションが束縛不変条件を担保しているため非ブロッキング。

3. **Copy Window Title テストの弁別力が弱い**。`stage-view-bridge-handlers.test.ts` の `getTitle` モックが旧定数と同一の `"Runtime Player Stage"` を返すため、実装が `getTitle()`(実 OS タイトル)を読むか旧定数に戻ったかを**テストが区別できない**。指針: モックを役割込みの弁別可能な値(例 `"Runtime Player Stage — Tracking Host — Aqua"`)にし、clipboard がその値を受けることを assert すれば、「実タイトルを配る」という当該変更の本質を突ける。ただし Copy の二体差別性は本質的に §8 手動ゲート寄りのため非ブロッキング。

4. **`browser-window-options` の任意 `title` override 分岐が未テスト**。テストは既定タイトル(従来定数)の維持(回帰ガード)のみ assert し、`title` を渡した override 経路を検証していない。役割タイトルの適用は主に main の `applyWindowTitles`(`setTitle`)と `createRuntimePlayerWindows` 経由で、その glue も未テスト。compose 関数(window-title.test.ts)が役割タイトル文字列を検証済のため実害小。指針: `createControlWindowOptions(preload, bounds, {title})` に role タイトルを渡し `options.title` に反映されることを1件足せば配線が閉じる。非ブロッキング。

---

## 質問(呼び出し元 Orch-Sylph / 上位判断)

1. 上記欠落1(no-role→スタブ routing glue)を「手動ゲート §8.8 で閉じる」で確定してよいか。それとも Domain C までに routing を純関数へ切り出して機械化を求めるか。レーン3 としては手動ゲート委譲で C1 スコープ上妥当と判断しているが、C1 AC §9「対象テストがパス、または失敗が具体的証拠つきで分類」の趣旨からは routing の機械化を Domain C の宿題に積む選択もあり得る。
2. 欠落3(Copy Window Title の弁別力)は、二体でタイトルが異なることが §8.5 手動ゲート対象であることを踏まえ、テスト強化を Domain C 任意タスクとするか、現状据え置きとするか。
