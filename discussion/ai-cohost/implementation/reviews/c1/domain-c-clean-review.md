# C1 Domain C + Wave 全体 最終 clean review — Review-Sylph レポート

> レビュア: Review-Sylph(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。対象: `apps/runtime-player`(pnpm monorepo, Windows / PowerShell)。
> 役割: Domain C の統合作業(検証・無変更確認・docs・手動ゲート手順書)を監査し、加えて wave 全体の最終 clean review。読み取り専任(実装・docs を修正していない)。
> 判定基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §8/§9/§10/§11、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §5/§6/§7、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md)。

## 判定: **合格(clean / PASS)。blocking ゼロ。**

Domain C の主張(typecheck PASS / focused 98 pass / 全体 2 fail・534 pass / baseline 2 件は Wave21 由来で C1 非関与 / 無変更境界 / docs 忠実)を**すべて独立に再現・裏取り**した。wave 全体としても実行時 role 分岐の不在、AC の機械/手動仕分け、レビュー固有確認点を満たす。C1 実装ゲートの**機械検証可能部分は緑で閉じ、残りはパッケージ版手動ゲートへ正しく落ちている**。non-blocking の軽微な docs nit を1件、および将来 wave 向け申し送りの追認を記す。

---

## 観点 A: 検証証拠の妥当性(自分で再実行)

すべて自分の環境で再実行し、Domain C レポートと突合した。`pnpm install` は不実施。

### A1. typecheck(再現 PASS)
```
cd apps/runtime-player; npx tsc --noEmit -p tsconfig.json → TYPECHECK_EXIT=0(出力なし)
```
Domain C 主張(§1.1 TYPECHECK_EXIT=0)と一致。

### A2. focused(再現 98 pass PASS)
```
cd apps/runtime-player; npx vitest run -c vitest.config.ts src/main/profile-slots src/main/role-composition \
  src/main/broadcast-source/browser-source-config-store.test.ts src/main/window-management/window-title.test.ts \
  src/main/window-management/runtime-player-tray-menu.test.ts src/main/window-management/browser-window-options.test.ts \
  src/main/placeholder-action-state.test.ts src/control/control-window-shell.test.ts src/main/stage-view-bridge-handlers.test.ts
→ Test Files 14 passed (14) / Tests 98 passed (98) / FOCUSED_EXIT=0
```
14 ファイル・98 件すべて緑。Domain C §1.3(Domain A 42 + Domain B 56 = 98)と一致。

### A3. 全体スイート(再現 2 fail / 534 pass)
```
cd apps/runtime-player; npx vitest run -c vitest.config.ts
→ Test Files 2 failed | 100 passed (102) / Tests 2 failed | 534 passed (536) / FULL_EXIT=1
```
Domain C §1.4(2 failed / 534 passed / 536)と完全一致。失敗は not-loaded 応答形状の `effectiveDynamicsTuning` ドリフト(`.toStrictEqual({ status: "not-loaded", runtimeExport: null, … })` で受信側に `+ effectiveDynamicsTuning: null`)。

### A4. baseline 2 件の分類が正しいか(独立裏取り = 新規失敗ゼロ)
以下を自分で確認し、**C1 由来ではない**ことを裏取りした:
1. `git diff --name-only | grep browser-source-server` → **該当なし**。両 baseline ファイル(`main/broadcast-source/browser-source-server.ts` / `stage/browser-source/browser-source-server-message.test.ts`)は C1 working diff に**不在**。
2. `git log -1 -- <各ファイル>`: `browser-source-server.ts` の最終変更は **`4627bbd [modify]playerでの物理演算調整機能`**、`browser-source-server-message.test.ts` は `f682ceb [modify]wave18まで`。いずれも C1 の未コミット作業より前の committed ancestor。
3. `git show 4627bbd -- browser-source-server.ts` は `effectiveDynamicsTuning` を **6 箇所追加**(Dynamics/Wave21 系)= 今回の失敗フィールドと一致。**source が新フィールドを足し、対応 test が旧形状のまま**という source-vs-test ドリフトで、C1(スロット基盤/役割合成)とは無関係。
4. 件数整合: 536 件・失敗 2 件で据え置き(新規失敗ゼロ)。

**結論: C1 は回帰ゼロ。baseline 2 件は C1 スコープ外(Runtime Export message schema 側の既存ドリフト、wave plan §10 で改変禁止のため触っていないのが正しい)。**

---

## 観点 B: 無変更境界(自分で git 実行)

`git diff --name-only` / `git status --porcelain` を自分で実行:

| 項目 | 結果 |
|---|---|
| 変更範囲 | **`apps/runtime-player/src/**` + `discussion/**` のみ**(`git diff --name-only \| grep -vE "^apps/runtime-player/src/"` は discussion の 5 ファイルのみ) |
| Editor(`apps/editor/**`) | **無変更**(porcelain にゼロ) |
| `packages/**`(package-format schema) | **無変更**(porcelain にゼロ) |
| Runtime Export schema | **無変更**(export shape は baseline 2 ファイルにあり、両者とも working diff 不在=A4) |
| `pnpm-lock.yaml` | **無変更**(porcelain 空)。`pnpm install` 痕跡なし |

追跡中の source 変更 14 ファイルはすべて `apps/runtime-player/src/`。未追跡は Domain A/B の新規モジュール(`profile-slots/` `role-composition/` `window-title.ts` 等)+ `discussion/ai-cohost/`(waves/reviews 含む)。Domain C レポート §2 の主張と一致。**境界逸脱なし。**

---

## 観点 C: docs の忠実性(最重要 — 実装事実と突合)

Domain C が更新した docs を読み、§7.7 が主張する実装事実を**実ソースで一つずつ確認**した。すべて忠実(誇張・食い違いなし):

| 主張(§7.7 / 確定注記) | 実ソース確認 | 判定 |
|---|---|---|
| 動的タイトル(Control `Runtime Player — <役割> — <model>`、区切り em dash、role=null は素の定数) | `window-title.ts:12,15,25-64` `composeRuntimePlayerControlWindowTitle` = base + role label + model を ` — ` で join、`role!==null` のみ label 挿入 | ✓ 忠実 |
| Header 役割バッジ teal/violet(暫定) | `control-window-shell.tsx:16-17` `trackingHost: teal-* / autonomousHost: violet-*` の class lookup、`:96` は `role===null?null:<badge>` の present/absent のみ | ✓ 忠実(表示専用) |
| トレイツールチップ `Runtime Player — <役割> / <モデル名>` | `window-title.ts:71-84` `composeRuntimePlayerTrayTooltip` が em dash + ` / ` で合成 | ✓ 忠実 |
| 役割選択スタブ = relaunch 方式、状態を disk に書かない | `role-selection-stub.ts:83-88` `app.relaunch({ args: process.argv.slice(1).concat(['--role=<role>']) }) + app.quit()`、状態保持なし・`noLink` ダイアログ | ✓ 忠実 |
| Copy Window Title = 実 OS タイトル配布(破棄時のみ定数フォールバック) | `stage-view-bridge-handlers.ts:564-568` `stageWindow.isDestroyed() ? 定数 : stageWindow.getTitle()` を clipboard へ | ✓ 忠実 |
| per-slot デフォルトポート tracking=17308 / autonomous=17309 | `host-role.ts:61-68` default port = `defaultPort` / `defaultPort+1`(slot 名キー、role キーでない) | ✓ 忠実 |
| 役割ラベル / デフォルトスロット名 | `host-role.ts:32-43` `Tracking Host`/`Autonomous Host`、`tracking-default`/`autonomous-default` | ✓ 忠実 |

### C2. 未合意 UX 方針の非確定(禁止事項)
- アクセント色 teal/violet は §7.7 で「**実装で暫定採用・ユーザーによる最終確定は未**」と明記。✓
- degraded ページ解消は §7.7 / inventory 確定注記で **C4 送り**と明記。✓
- Accepted な UX 定義本文(§1〜§7.6)・棚卸し本文は**書き換えず「追記」に留めている**:§7.7 は新設サブセクション、inventory は末尾「実装後の確定注記」節、wave plan は §13/§14 の新節。いずれも冒頭で「本文を書き換えない」と宣言。✓
- `_map.md` 2 件・実装 map も「実装完了+手動ゲート待ち」「baseline 2 件を除き回帰ゼロ」と正確に、誇張なく更新。✓

### C3. non-blocking 申し送りの記録(将来 wave 拾える形)
wave plan §13 に **N1 console ノイズ / pid 再利用 false-busy / legacy silent catch 診断ログ候補 / 防御テスト補強候補(a〜c)** の 4 件がすべて記録され、正規解(N1→C4 自律 Control UX 等)と非 blocking 根拠付き。§14 に上位判断待ち 7 件。将来 wave が拾える。✓

---

## 観点 D: 手動ゲート手順書の完全性

Domain C レポート §3 の手順書を精査:
- wave plan §8 の 8 項目を**すべて**カバー。加えて追加確認(**太字**)として: 項目2=slot 配下への実書き込み+root 旧データ非破壊、項目3=UDP 不受信/degraded だが shell 生存、項目5=手動ポート設定 UI 不在、項目6=同役割二重起動エラー+既存無傷、項目7=kill 耐性+kill 後即再起動(stale lock 回復)、項目8=relaunch が role-resolved インスタンスを生む/Cancel で無起動。**§8 追加確認の全項目が落ちている。**
- dev では二重起動が userData/dev server を共有し無効 → **パッケージ版必須**を明記(inventory 観点8 と整合)。
- ビルド手順(§3.0)は `pnpm run build` / `pnpm run dist:win`(= `build && electron-builder --win --x64`, target=portable)と具体的。ショートカット作成手順(§3.1)も CLI 引数の付し方まで具体的。
- **不明点を正直に明記**: electron-builder の初回ツール DL(オフライン失敗リスク)、未署名 exe の SmartScreen、正確な exe ファイル名はビルド後に `dist/` 確認、の 3 点を環境依存の不明点として開示。誠実。

**ユーザーがそのまま実施できる完全なチェックリストになっている。** blocking なし。

---

## 観点 E: wave 全体の最終 clean review(横断)

### E1. 実行時 role 分岐の不在(BLOCKING 観点 → 不在を最終確認)
`apps/runtime-player/src` 全域を自分で grep:
- `role===`/`switch(role)` 系ヒットはすべて **null チェック(present/absent)・型/undefined チェック(slot-lock 直列化の optional field)・コメント**のみ。役割**値**での分岐は皆無。
- `trackingHost`/`autonomousHost` リテラルの全消費箇所(非 test): `input-subsystem.ts:177-178`(registrar composer マップ)、`control-window-shell.tsx:16-17`(バッジ色 class マップ)、`host-role.ts:32-66`(label/slot/port マップ)、`bridge-contract.ts:48`(型)。**すべて `Record<role, …>` のテーブルキー**であり、設計が要求する「composition root でのデータ lookup / registrar-set 選択」パターンそのもの。`if (role===...)` 実行時挙動分岐なし。**統合後の最終状態で確認済み。BLOCKING 不成立。**

### E2. §9 Acceptance Criteria の機械/手動 仕分け
| AC 項目 | 閉じ方 | 担保 |
|---|---|---|
| `--role`/`--profile` スキーマ、引数なし=スタブ(記憶なし) | 機械 | `role-launch-resolution.test.ts`(13)、`role-selection-stub.test.ts`(3、disk 非書込は構造担保) |
| 二インスタンス別モデル同時表示 | 手動 | 手順書 項目3 |
| window-state/mapping/dynamics/input/browser-source の slot 分離 | 機械+手動 | 機械=単一 userData 基点差し替え機構 + `browser-source-config-store.test.ts`(7)/`slot-preferred-port.test.ts`(4)、手動=項目4。他 store の直接 2-slot 独立テストは §13(a)で後続(基点機構で担保、non-blocking) |
| legacy 採用・単独等価 | 機械+手動 | `legacy-adoption.test.ts`(5、冪等+非破壊)、手動=項目2 |
| token/port slot 独立・手動ポート設定なし | 機械+手動 | config-store/preferred-port test、手動=項目5 |
| 同一 slot 二重起動=明確エラー・破壊なし | 機械+手動 | `slot-lock.test.ts`(6、二重取得拒否/stale 回復)、手動=項目6 |
| 片方 kill 耐性 | 手動 | 項目7(裁定でパッケージ版手動ゲート化。E2E 新設せず=§10 準拠) |
| `if(role===)` 分岐なし | レビュー | E1 で確認 |
| Editor/package-format/Runtime Export schema 無変更・依存なし・`pnpm install` なし | 検証 | 観点 B |
| テスト/typecheck パス or 失敗を証拠付き分類 | 検証 | 観点 A |

**取りこぼした AC なし。** 機械検証可能な AC は実テストで担保され、パッケージ版でしか閉じない AC(別モデル同時表示・kill 耐性・実機 per-slot 書込・手動ポート不在)は手動ゲートへ正しく仕分けられている。

### E3. wave plan §11 レビュー固有確認点
- 実行時 role 分岐の不在 → E1 で確認。✓
- slot 間 profile/token/port 非漏洩 → 単一 userData 基点差し替え(全 store DI 済み)+ config-store/preferred-port の per-slot テスト。✓(他 store 直接テストは §13(a)後続、non-blocking)
- legacy 非破壊 → `legacy-adoption.test.ts` で元データ非破壊+冪等を担保。✓
- renderer 秘匿漏れなし → role は startup status に `{id, label}` の**表示専用データ**のみ相乗り。token は main の config に留まり renderer へは URL のみ。既存 sanitization 境界を維持。✓
- 引数なし非束縛 → スタブは disk に何も書かず、選択のみで role 決定(§7.6 恒久禁止を構造担保)。✓
- トラッキングホスト等価 → trackingHost=フル入力3レジストラの合成、既存挙動退行なし(focused/全体スイートで既存 test 緑、baseline 2 件のみ既存ドリフト)。✓

レビュー成果物も 6 件(`domain-{a,b}-lane{1,2,3}-*.md`)存在を確認。

---

## blocking 一覧
**なし。**

## non-blocking 指摘
- **N-1(docs nit、Domain C レポート §1.5 項目3)**: 「両 baseline ファイルの**最終変更**は Wave21 コミット `356959c`」と記すが、`browser-source-server.ts` の実際の**最終**変更 commit は `4627bbd [modify]playerでの物理演算調整機能`(356959c より新しい Dynamics/Wave21 系。`effectiveDynamicsTuning` を追加したのはこの 4627bbd)。`356959c` も実在の Dynamics 系 committed ancestor であり、**結論(baseline は Wave21 Dynamics 系ドリフト・C1 非関与・ancestor)は正しい**。引用ハッシュが「最終変更」ではなく一つ前の Dynamics コミットを指しているだけの軽微な不正確さ。受け入れを妨げない。修正指針: 気になれば §1.5 項目3 の `356959c` を `4627bbd`(または「Dynamics 系の committed ancestor 群」)に置換。
- **N-2(既存申し送りの追認)**: wave plan §13 の 4 件(N1 console ノイズ / pid 再利用 false-busy / legacy silent catch 診断ログ / 防御テスト補強 a〜c)はいずれも妥当な後続候補として記録済み。特に §13(a)「他 store(window-state/model-mapping/dynamics-tuning/input-profile/startup-state)の 2-slot 独立性の直接テスト」は、現状「単一 userData 基点差し替え機構 + config-store の独立性テスト」で機構的に担保されるが、直接テストがあると回帰検知が強くなる。後続 or C1 追撃のいずれでも可(non-blocking、レーン3 判定と一致)。

## docs の誤り・誇張
**重大なものなし。** §7.7・inventory 確定注記・両 map・wave plan §13/§14 はいずれも実装事実に忠実で、暫定を暫定と明記し、未実装を未実装と明記し、C4 送りを C4 送りと明記している。唯一 N-1 の軽微なハッシュ不正確さのみ。

---

## wave 全体としての C1 実装ゲート充足の総括

- **機械検証可能な実装ゲートは全緑**: typecheck PASS、focused 98 pass、全体 534 pass(失敗 2 件は C1 非関与の既存 baseline、独立裏取り済み)。回帰ゼロ。
- **設計規律を満たす**: 実行時 role 分岐ゼロ(役割差は composition root のテーブル lookup 一点に集約)、slot 分離・legacy 非破壊・renderer 秘匿非漏洩・引数なし非束縛・トラッキングホスト等価。
- **無変更境界を守る**: Editor / packages / package-format / Runtime Export schema / lockfile 無変更、`pnpm install` なし。
- **docs は実装事実に忠実**で、未合意 UX を勝手に確定せず追記に留め、非 blocking 申し送りと上位判断待ちを将来 wave が拾える形で記録。
- **残るはパッケージ版手動ゲート(ユーザー実施)+ §14 上位判断の裁定**。手順書は完全。

**C1 の source 実装 + 統合作業は clean。機械ゲート合格。手動ゲート・上位判断裁定を経て C1 完全閉鎖に進んでよい。**

---

## 質問(呼び出し元 Orch-Sylph / 上位へ)
1. **Q-R1**: N-1(§1.5 のハッシュ `356959c`→実際は `4627bbd`)は軽微な docs nit。Domain C レポートを修正するか、それとも本レビューでの指摘記録で足りるとして放置するか。**受け入れは妨げない**ので、Orch-Sylph / L0 の判断でよい(私はレビュー専任のため修正していない)。
2. **Q-R2**: Domain C レポート Q-C2(パッケージ版ビルドを自動側で一度通して exe 名を確定するか)/ Q-C3(C1 完全閉鎖 = 手動ゲート合格 + §14 裁定の両方)は上位判断事項。本レビューとしては「手順書は完全・機械ゲートは合格」であり、**ビルド未実行は clean review の合否に影響しない**(手動ゲートはユーザー観測に落ちる設計ゲートのため)と判断した。C1 完全閉鎖の要件確認(手動ゲート + §14 裁定)は L0 で確定されたい。
3. **Q-R3**: wave plan §14 の上位判断待ち 7 件(色最終確定 / busy 文言 / legacy port 正規化 / relaunch 契約拡張 / windowTitle 型 widen / degraded `.catch` / 防御テスト補強)は暫定値で動作中・後続で拾える。C1 受け入れの blocker ではないが、L0(Undine)/ ユーザーの裁定が要る。
