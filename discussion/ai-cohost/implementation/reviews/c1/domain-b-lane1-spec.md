# C1 Domain B レビュー — レーン1: spec compliance

> レビュア: Review-Sylph(レーン1 = spec compliance / Orch-Sylph からの委任)。日付: 2026-07-10。
> 判定基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §3/§4.3/§7/§9、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §1/§2/§6/§7、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) 観点3/5/6。
> 対象: `apps/runtime-player`(Gnome 実装レポート [domain-b-role-composition-identity.md](../../waves/c1/domain-b-role-composition-identity.md) の主張を差分・テストで自己検証)。
> スコープ: **spec compliance のみ**。design 規律(合成一点の厳密性)/ test adequacy は別レーンに委ねる。

## 判定: **合格(spec compliant)** — blocking 逸脱なし

Domain B が担う仕様(役割別合成 / autonomousHost 入力系不在 / 静止表示 / startup status role 伝搬 / 身元表示 / 役割選択スタブ / UI 語彙)は wave plan と skeleton の要求をいずれも満たす。実装は差分とテスト(focused 26 件を実行し全 pass を確認)で裏づけられており、Gnome の主張に spec 上の誇張は見当たらない。非 blocking の申し送り 3 点のみ(後述)。

---

## 観点ごとの適合状況

### 観点1: 役割別合成(trackingHost=フル / autonomousHost=入力系なし) — **仕様どおり**

- `role-composition/input-subsystem.ts`: 役割差は `runtimePlayerInputSubsystemComposers: Record<role, composer>` の **data lookup 一点**で表現。`composeRuntimePlayerInputSubsystem(launch.role, deps)`(`runtime-player-main.ts:877`)が引くのみで、実行時 `if (role===...)` 分岐なし(wave plan §4.3 / §9 の blocking 観点をクリア)。
- **trackingHost = 挙動等価**: `composeTrackingHostInputSubsystem`(input-subsystem.ts:70-140)は旧 `runtime-player-main.ts` の入力3レジストラ組み立て(`registerInputBridgeHandlers` / `registerInputProfileBridgeHandlers` / `registerModelMappingBridgeHandlers`)と circular seam・`onInputReset`/`onProfileChanged` 副作用を逐語移設。旧コードと突合し、`bodyFollowState.reset()`/`vowelLipsyncState.reset()`/`stageMotionRuntime.reset()`/republish/`publishLatestParameterFrame` の順序・呼び出しが一致することを確認。退行を示す差分は無し。
- **autonomousHost = 入力系レジストラ不在**: `composeStaticInputSubsystem`(input-subsystem.ts:150-166)は登録関数を一切呼ばず全 seam を inert 化。`input-subsystem.test.ts:103-115` が3レジストラ spy の **未呼び出し**(`not.toHaveBeenCalled()`)と `usesTrackingInput===false` を検証。**UDP リスナー/入力 IPC ハンドラは合成に到達しない**(受信器 factory 自体が呼ばれない)。wave plan §3.1「input / input-profile / model-mapping を組み込まない」と精密一致。

### 観点2: 静止表示・生理層の先取り不在 — **仕様どおり**

- autonomousHost は runtime export loaded で `inputSubsystem.setRuntimeExportPayload`(no-op)の外側にある `browserSourceServer.publishRuntimeExportLoaded`(`runtime-player-main.ts:929`)により **default pose の静止モデル**を Browser Source に配る。live parameter frame を産まない(`publishLatestParameterFrame` は inert)。
- 呼吸等の生理層(C2)は未実装。差分に呼吸/揺れ生成器の類は一切なし。wave plan 裁定6「C1 の自律ホストは静止(default pose)表示で足りる」/ §7 Escalate 条件「静止表示のための生理層先取りは C2」を遵守。**スコープ逸脱なし**。

### 観点3: startup status への role 伝搬 — **仕様どおり**

- `RuntimePlayerStartupStatus.role: RuntimePlayerHostRoleIdentity | null`(`runtime-player-bridge-contract.ts:47-53`)を追加。`createStartupStatus(role?)`(placeholder-action-state.ts:28)が乗せ、`registerPlaceholderBridgeHandlers({ windows, role })`(placeholder-bridge-handlers.ts:19-26)が既存の `getStartupStatus` pull ハンドラで返す。**新チャネルを増やしていない**(wave plan §4.3 の要求どおり相乗り)。
- renderer は `control-window-app.tsx:585` の `role={startupStatus?.role ?? null}` の **1 箇所で表示専用に受け渡すのみ**(grep で role 参照はこの 1 行だけ)。挙動分岐に使っていない。contract のコメントも「MUST use for display only and never branch behaviour」と明記。

### 観点4: 身元表示(§7.2/§7.4) — **仕様どおり**

- **ウインドウタイトルに役割名**: `window-title.ts` の純関数 `composeRuntimePlayerControl/StageWindowTitle` が `Runtime Player — Tracking Host` / ロード後 `… — <model>` を合成。窓創建 options(`browser-window-options.ts` の任意 `title`、`runtime-player-windows.ts` へ伝搬)と title controller(`runtime-player-main.ts:624-645` の `applyWindowTitles`/`setLoadedModelName`)で反映。Stage reopen(`onStageWindowReopened`→`applyWindowTitles()`)でモデル名を再付与。
- **Header 役割バッジ(文字+色の二重)**: `control-window-shell.tsx:20-32` の `ControlWindowRoleBadge` = 文字 `role.label` + `roleBadgeAccentClassName`(tracking=teal / autonomous=violet)。Header 先頭(Monitor アイコンの前、shell.tsx:96)に配置。**static style lookup で挙動分岐でない**。skeleton §7.2「文字+色の二重」を満たす。
- **トレイツールチップ**: `composeRuntimePlayerTrayTooltip` = `Runtime Player — <役割> / <モデル名>`(window-title.ts:71-84、skeleton §7.4 の記法どおり)。`runtime-player-tray-menu.ts` が `getToolTip` を初期化+`refresh()` 両方で `setToolTip`。
- **モデル名は既存表示のまま**: Header の `Model <status>` ピルは無改変(実質インスタンス識別を相乗り)。
- **トレイ役割色ドットは未実装 = 正しい**: tray 差分は `getToolTip` 追加のみで、トレイアイコン(`trayIcon`)は無改変。wave plan §3.2「トレイアイコンの役割色ドットは本 wave スコープ外」に精密準拠。**スコープ逸脱なし**。

### 観点5: 引数なし=最小役割選択スタブ — **仕様どおり**

- `role-selection-stub.ts`: 素の `dialog.showMessageBox`(type=question)で役割を聞くのみ。ボタン=役割ラベル表由来 + Cancel(`noLink`)。
- **「次回から/今後表示しない」チェックが無い**: buttons 配列は `[...roleButtons, "Cancel"]` のみで、記憶用アフォーダンスなし(skeleton §2 恒久禁止を遵守)。detail 文言も「This choice is not remembered — you will be asked again next time」と no-memory を明示。
- **選択を記憶しない/暗黙束縛しない**: `presentRuntimePlayerRoleSelectionStub` は状態を持たずディスクに何も書かない(構造的担保)。cancel=quit、選択時のみ `--role=<chosen>` で relaunch。no-role 経路は `runtime-player-main.ts:592-600` で **早期リターン**し、window/slot/lock/legacy 採用を一切行わず root userData のまま(現行無引数起動と等価)。どの役割にも暗黙束縛しない。
- **玄関完全版の先取りなし**: カード UI / Create shortcut / Autonomous only リンクは実装されていない(skeleton §7.6 の要素は差分に一切なし)。**スコープ逸脱なし**。

### 観点6: UI 語彙(§7.1) — **仕様どおり**

- `runtimePlayerHostRoleLabels = { trackingHost: "Tracking Host", autonomousHost: "Autonomous Host" }`(host-role.ts:32-35、Domain A 資産を読取再利用)を全表示面(タイトル/バッジ/トレイ/スタブ/busy ダイアログ)が data lookup で共有。英語語彙が一貫。

### 観点7: AC 突合(§9、Domain B 分) — **満たす**

| AC(§9) | 状況 |
|---|---|
| 引数なしは役割選択スタブ(記憶なし) | ✓ 観点5 |
| 二インスタンスが別モデルを同時表示(autonomous=静止表示の機構) | ✓ 観点2(機構は成立。packaged 手動ゲートで最終確認 — Domain C) |
| 実行時 `if (role===...)` 分岐が存在しない | ✓ 観点1、renderer 観点3 |
| トラッキングホスト合成が現行と挙動等価 | ✓ 観点1(逐語移設) |
| Editor / package-format / Runtime Export schema 無変更・新規依存なし | ✓ 触れたのは `runtime-player/src` のみ。`RuntimePlayerHostRoleIdentity` は startup/placeholder の**内部 IPC contract**であり Runtime Export/package-format schema ではない(runtime-export-bridge-contract / package-format 無接触を確認) |
| 対象テスト・typecheck パス | ✓ focused 26 件を再実行し全 pass。全体スイートの失敗2件は Domain A 報告の既存 baseline(`effectiveDynamicsTuning`/Wave21)と一致 |

---

## 観点8: degraded Control ページ判断の spec 評価 — **spec 的に妥当(C1 で塞ぐ必要なし)**

Gnome の判断「autonomousHost の Control Input/Mapping ページが degraded(IPC reject)でも shell が生存するので escalate 不要、自律 Control UX は C4」は **spec に照らして妥当**であり、blocking ではない。根拠:

1. **wave plan §7 の escalate 条件を満たさない**: escalate 条件は「Control shell が入力系ページの**欠如を合成レベルで許容できない**構造の場合」。Gnome は shell が生存(React ツリーは startup status ベースで描画済み、reject が tree を落とさない)することを確認しており、**許容できている**。したがって escalate は wave plan 自身の条件上 不要。
2. **ページを畳む/隠す実装こそ spec 違反になる**: autonomousHost で Input/Mapping ページを非表示化するには renderer 側に「役割で表示を分岐する」実行時 role 分岐が要る。これは skeleton §1・wave plan §9 の恒久禁止(実行時 `if(role===...)`)に真っ向から反する。**degraded のまま残すのが C1 の spec 的正解**。
3. **wave plan §3.2 が明示的に C4 へ委譲**: 「自律ホスト版 Overview の画面設計は C4(の UX 定義時)」。degraded ページの畳み方/差し替えは UX 磨きの領分で、C1 スコープ外。
4. **C1 の AC が degraded ページの機能性を要求しない**: §9 の受け入れ基準は「二体が別モデル同時表示 / 状態非混在 / kill 耐性 / 合成一点」。autonomous の Control 入力系ページが動くこと・隠れることはどの AC にも含まれない。C1 ゲートは Browser Source 経由の映像(静止表示)で成立し、Control 窓は配信に映らない操縦席(skeleton §7 前提)。

→ **degraded ページは C1 の受け入れ範囲内**。C1 で塞ぐべきではなく、C4 へ正しく申し送られている。**非 blocking**。

---

## 逸脱一覧

**blocking**: なし。

**non-blocking(申し送り / 確認推奨)**:

1. **degraded Control ページの生存の実機確認**(観点8): 「reject で renderer が白画面化しない」は runtime 挙動の主張(spec ではなく lane2/3 寄り)。wave plan §8 手動ゲート項目3(自律ホスト起動→静止表示)がクラッシュを捕捉するため C1 では手動ゲートで担保可。**Domain C の docs 更新で degraded ページの事実を注記**すること(Gnome 引き継ぎ2 と整合)。修正指針: 追加実装は不要、Domain C の手動ゲート観測と skeleton §7 反映で足りる。

2. **役割選択スタブの relaunch 契約**(`role-selection-stub.ts:83-88`): `app.relaunch({ args: process.argv.slice(1).concat(['--role=<role>']) })`。C1 の「記憶しない/暗黙束縛しない」は満たすが、将来 `--profile` を選ばせる玄関完全版でこの args 構成の拡張が要る(Gnome 質問2)。C1 spec 上は問題なし。修正指針: C1 では変更不要、後続 wave の契約設計時に再訪。

3. **タイトルとトレイのモデル名区切りの不統一**(`window-title.ts`): タイトルは em dash(` — `)、トレイは skeleton §7.4 記法どおり ` / `。skeleton は §7.4 で「/」を明示、タイトルは区切り未指定なので **spec 違反ではない**(意図的な使い分け)。修正指針: 現状維持で spec 適合。統一するかは UX 裁量。

---

## 裁量判断の妥当性

- **バッジ/タイトルのアクセント色(tracking=teal / autonomous=violet)**: skeleton §7.2 は「役割ごとのアクセント色/文字+色の二重」を要求するが具体色は未定義。§7.2 の要件(色による周辺視補助 + 文字による意味)は満たしており、spec 上は適合。最終色はユーザー/UX 磨き wave の裁量(Gnome 質問1)。**妥当**。
- **Copy Window Title が実 OS タイトルを配る変更**(`stage-view-bridge-handlers.ts:557-571`): skeleton §7.2「既存の Copy Window Title がそのまま区別可能なタイトルを配る」を能動的に満たす変更で、trackingHost の「挙動等価」とは矛盾しない(入力/トラッキング pipeline の等価性を指すもので、身元表示の追加は §7 が要求する Domain B の本旨)。**妥当**。
- **contract `windowTitle` リテラル型の据え置き**(表示 base は静的、配布は実タイトルの二層): 最小変更方針で spec に反しない。表示側の動的化は C4 と併せて判断可(Gnome 質問5)。**妥当**。

---

## 質問(Orch-Sylph / 上位判断向け)

1. degraded Control ページの手動ゲート観測(白画面化しないこと)は Domain C の §8 ゲートに明示的に含める前提でよいか。lane1 としては「C1 spec 上 degraded 許容」で確定だが、実機生存の確証は手動ゲート依存である点を Orch-Sylph が Domain C へ確実に渡す必要がある。
2. アクセント色(teal/violet)は本 wave で確定扱いか、UX 磨き wave まで暫定扱いか(spec 適合には影響しないが、docs 反映の確定度に関わる)。

---

## 結論

Domain B は spec compliance レーンで **合格**。役割合成の背骨(合成一点・実行時 role 分岐の不在)、autonomousHost の入力系完全不在、静止表示、startup status role 伝搬、身元表示(タイトル/文字+色バッジ/トレイツールチップ、役割色ドット不在)、記憶なし役割選択スタブ、英語 UI 語彙のすべてが wave plan §3/§4.3/§7/§9 と skeleton §1/§2/§6/§7 に適合。degraded Control ページの裁量判断も spec 的に妥当で C1 で塞ぐ必要はない。blocking 逸脱なし、非 blocking の申し送り 3 点(いずれも Domain C / 後続 wave 向け)。
