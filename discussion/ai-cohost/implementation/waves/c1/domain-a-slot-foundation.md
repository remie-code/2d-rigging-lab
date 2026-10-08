# C1 Domain A: スロット基盤 — 実装レポート

> 実装者: Gnome(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。
> Source of truth: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §3/§4/§6/§10、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §5/§6、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md)。

## 判定: **completed**

Domain A の全要件(引数パース / スロット検証 / userData 基点差し替え / スロットロック+stale 回復 / legacy 採用 / per-slot config token・port)を実装し、focused test を追加。typecheck 通過。新規テスト 42 件すべて pass。全体スイートの 2 件の失敗は **Domain A と無関係の既存 baseline 失敗**(証拠は下記)。escalate 該当なし。

---

## 作成 / 変更ファイル

### 新規(すべて `apps/runtime-player/src/main/profile-slots/`)

| ファイル | 役割 | 純粋性 |
|---|---|---|
| `host-role.ts` | 役割型・ラベル表・既定スロット名・既定ポート表(すべて data lookup) | 純粋 |
| `slot-name.ts` | スロット名検証(空白なし・パス injection 拒否・予約名拒否) | 純粋 |
| `slot-name.test.ts` | 上記テスト | — |
| `slot-paths.ts` | `slotName → <userData>/slots/<slotName>` 導出(検証つき) | 純粋 |
| `role-launch-resolution.ts` | argv パース + 起動解決(Domain B へ渡す契約) | 純粋 |
| `role-launch-resolution.test.ts` | 上記テスト | — |
| `slot-lock.ts` | スロットロック取得/解放/stale 回復(同期 fs) | fs |
| `slot-lock.test.ts` | 上記テスト | — |
| `legacy-adoption.ts` | legacy 既定データの冪等・非破壊採用 | fs |
| `legacy-adoption.test.ts` | 上記テスト | — |
| `slot-preferred-port.ts` | 空きポート採番 + port plan → factory | net |
| `slot-preferred-port.test.ts` | 上記テスト | — |

### 変更(既存)

- `apps/runtime-player/src/main/broadcast-source/browser-source-config-store.ts`
  — 任意オプション `createPreferredPort?: () => number | Promise<number>` を追加。**初回 create 時のみ**呼ばれ、既定は従来通り固定ポート(未指定時は挙動不変)。`#createDocument` を async 化。schema・token 形式・保存形式は無変更。
- `apps/runtime-player/src/main/broadcast-source/browser-source-config-store.test.ts`
  — createPreferredPort(同期/非同期)と **二スロット独立性**(別 token・別 preferredPort・別ファイル・相互非汚染)のテストを追加。
- `apps/runtime-player/src/main/runtime-player-main.ts`
  — `startRuntimePlayerMain()` の**同期先頭**(`app.whenReady` 登録前)にスロット基盤を配線。詳細下記。

---

## 各要件の実装と設計判断

### 1. 起動引数パース(`--role` / `--profile`)

- `parseRuntimePlayerRoleArguments(argv)` が `--role=<v>` と `--role <v>`(空白区切り)両形式を走査。`--profile` も同様。
- 妥当な role: `trackingHost` / `autonomousHost`。profile 省略時は `defaultSlotNameForRole(role)`(trackingHost→`tracking-default`, autonomousHost→`autonomous-default`)。
- エラー判定: 未知 role 値 / role 値欠落 / profile 値欠落 / **role なしで profile だけ**(→ error)。
- **role なし(引数なし)= `no-role`** を返し、**どの役割/スロットにも束縛しない**。userData 差し替え・ロック・legacy 採用を一切行わず、現行どおり root userData で起動する(= 今日の無引数起動と挙動等価)。Domain B がここにスタブを差す(seam)。「次回から」記憶は持たない(状態を一切書かない)。

### 2. スロット名検証(`slot-name.ts`)

- パターン `^[A-Za-z0-9][A-Za-z0-9_-]*$`(先頭英数字、以降 英数字/`_`/`-`)。
- これで **`.` を全面禁止**(→ `.` `..` トラバーサル不能)、パス区切り `/` `\`、ドライブ/スキーム `:`、空白、先頭 `.`/`-` を拒否。長さ上限 64。Windows 予約名(CON/PRN/AUX/NUL/COM1-9/LPT1-9)を大小無視で拒否。純関数。
- `deriveRuntimePlayerSlotUserDataPath` は結合前に再検証し、不正名なら throw(多層防御)。

### 3. userData 基点差し替え(棚卸し観点2の方式を採用)

- `startRuntimePlayerMain()` の**同期先頭**で `defaultUserDataPath = app.getPath("userData")` を捕捉 → 解決 → role-resolved 時に **`app.setPath("userData", slotUserDataPath)` を app ready 前に一度**呼ぶ。
- 全 store は `{ userDataPath }` DI 済みのため **store 改修ゼロ**で全成果物がスロット内に連動。`app.getPath("userData")` の 6 箇所は変更不要(差し替え後の値を返す)。
- wave plan §4.1 が明示的に指示した方式そのもの。app ready 前呼び出しの制約は escalate 条件だが、**設計が明示指定した手順**であり判断の余地がないため escalate せず実装(裁量/リスク欄に記録)。

### 4. スロットロック + stale 回復(`slot-lock.ts`)

- スロットディレクトリ内 `slot.lock` に `{ pid, role, acquiredAtIso }` を記録。取得は **同期・アトミック**(`openSync(path, "wx")` = 排他作成)。ready 前に fail-fast できる。
- **二重取得拒否**: `EEXIST` 時に既存 pid の生存を確認し、生存中なら `{ ok:false, reason:"busy", owner }`。runtime-player-main はこれを受けて明確なエラーダイアログ(スロット名非露出)を出し quit。
- **stale 回復方式(設計判断)**: 生存確認は `process.kill(pid, 0)` を採用。ESRCH(存在せず)= stale、EPERM(存在するが権限なし)= 生存扱い。Windows/Node でも動く標準手法で、Electron/Windows で追加依存やネイティブ機構が不要。異常終了で残った pid が死んでいれば `wx` の再試行前に unlink して**自動再取得**(有界リトライ)。**採用理由**: (a) 追加依存なし・純 Node、(b) OS プロセスハンドルを跨いで参照しない(不変条件「相互関与ゼロ」に整合)、(c) `flock` 系はクロスプラットフォームで挙動差が大きく Windows では信頼できない。
  - unparseable/自 pid 残骸の lock も stale とみなし再取得(検証不能な lock が永久にスロットを塞ぐのを防ぐ)。
  - `release()` は**自 pid 所有時のみ** unlink(他インスタンスが再取得済みの lock を消さない)。二重解放ガードあり。`app.once("will-quit")` で release。
- 単一インスタンスロック(`app.requestSingleInstanceLock`)は**置いていない**(スロットロックが代替。N 体運用と整合)。

### 5. legacy 採用(`legacy-adoption.ts`)

- `tracking-default` スロット(= `adoptsLegacyDefaults` フラグ true)の初回のみ、root userData 直下の既知 store 群を**スロット内へコピー**。対象: `window-state` / `browser-source` / `model-mapping-profiles` / `dynamics-tuning-profiles` / `input-profiles` / `startup-state`(各ディレクトリごと `fs.cp` 再帰コピー。ディレクトリ丸ごとなので内部ファイル名差は無関係)。
- **冪等**: `.legacy-adopted.json` マーカーで再実行を no-op 化(マーカー存在で即 `already-adopted`)。二回目は元データを書き換えても slot に触れない(テスト済み)。
- **非破壊**: 元データを削除・変更しない(コピーのみ)。slot 側に既存があれば上書きせず skip(多層防御)。
- **`slots/` 自己包含の回避**: コピー対象を既知エントリの**ホワイトリスト**に限定。slot は `<root>/slots/<name>` にあり root の子だが、`slots` は対象外なので自己再帰コピーは起きない(テスト済み)。
- **escalate 判断**: 既知 store ディレクトリは決定論的で、レイアウト差で判断が要る場面は生じなかった(fresh install で対象ゼロ → マーカーだけ書いて完了。異常ではない)。よって escalate 不要。
- 採用の起動時失敗は best-effort catch(元データ無傷 = データ損失なし、slot が空で始まる degraded のみ。マーカー未書き込みなので次回再試行)。

### 6. per-slot Browser Source config(token / preferredPort)

- userData 基点差し替えにより config store は**自然に per-slot**(別ファイル)。token は各スロット初回に自動生成(既存 `createToken` そのまま)。
- **preferredPort 既定**:
  - `tracking-default` = 17308(`runtimePlayerBrowserSourceDefaultPort`)、`autonomous-default` = 17309。**スロット名キーの表** `runtimePlayerDefaultSlotPreferredPorts`(役割キーではない)。
  - それ以外の新スロット = `findFreeLoopbackPort()` で**空きポート自動採番**し config に永続化。
- 注入: 解決結果の `preferredPort` plan(`{mode:"fixed",port}` | `{mode:"auto-assign"}`)を `createPreferredPortFactory` で factory 化し config store に渡す。factory は**初回 create 時のみ**呼ばれる(以降は永続値を再利用 = 冪等)。
- **手動ポート設定 UI は作らない**。EADDRINUSE 時の揮発ポート降格は既存 `browser-source-server.ts` の挙動を**そのまま維持**(未変更)。preferredPort はあくまで「希望」で、採番と実 bind の競合はサーバ側の降格が吸収する。
- **legacy 採用との整合**: tracking-default が legacy `browser-source/` をコピーしている場合、config は既存(legacy token+port)として読まれ factory は呼ばれない → **従来 token/port を保持(等価)**。fresh install 時のみ factory が 17308+新 token を生成。

---

## テスト実行

コマンド(ワークスペース既存流儀。`pnpm install` 不実施):

```
cd apps/runtime-player
npx tsc --noEmit -p tsconfig.json          # typecheck
npx vitest run -c vitest.config.ts <paths> # focused
npx vitest run -c vitest.config.ts         # full suite
```

### typecheck: PASS(出力なし・exit 0)

### focused(Domain A 対象):

```
✓ src/main/profile-slots/slot-name.test.ts (7 tests)
✓ src/main/profile-slots/slot-preferred-port.test.ts (4 tests)
✓ src/main/profile-slots/slot-lock.test.ts (6 tests)
✓ src/main/broadcast-source/browser-source-config-store.test.ts (7 tests)
✓ src/main/profile-slots/legacy-adoption.test.ts (5 tests)
✓ src/main/profile-slots/role-launch-resolution.test.ts (13 tests)

Test Files  6 passed (6)
     Tests  42 passed (42)
```

検証内容の対応: スロット名検証(不正名・パス注入拒否)/ ロック(取得・解放・二重取得拒否・stale 回復・unparseable 回復・他者再取得時の解放安全)/ userData 基点導出(slotName→path、純関数)/ legacy 採用の冪等性・非破壊・fresh・自己包含回避 / per-slot config(二スロットが別 token/別 preferredPort/別ファイル/相互非汚染)/ 引数→解決の対応(役割/既定スロット/port/legacy フラグ)。

### 全体スイート:

```
Test Files  2 failed | 96 passed (98)
     Tests   2 failed | 517 passed (519)
```

**失敗 2 件は Domain A と無関係の既存 baseline 失敗**:
- `src/main/broadcast-source/browser-source-server.test.ts` > "serves current Runtime Export payload to authorized Browser Source clients"
- `src/stage/browser-source/browser-source-server-message.test.ts` > "accepts the not-loaded response shape"

いずれも Runtime Export メッセージの **`effectiveDynamicsTuning` フィールド**(Wave21 Dynamics Tune 系)に関する差分で、私が触れていない `browser-source-server.ts` / stage 側メッセージ検証の問題。**証拠**: 私のソース変更 3 ファイル(config-store.ts / runtime-player-main.ts / config-store.test.ts)を `git stash` した状態で同 2 テストを実行しても**同一の 2 件が失敗**(`2 failed | 20 passed`)。よって Domain A は**回帰ゼロ**。

> Runtime Export / package-format スキーマには触れていないため、この既存失敗は Domain A のスコープ外。Domain C のモノレポ検証で baseline として明示すること。

---

## Domain B への引き継ぎ(契約)

### 引数解決結果の受け渡し契約

`resolveRuntimePlayerSlotLaunch({ argv, defaultUserDataPath })` → `RuntimePlayerSlotLaunch`(`role-launch-resolution.ts`):

```ts
type RuntimePlayerSlotLaunch =
  | { kind: "role-resolved";
      role: "trackingHost" | "autonomousHost";  // ← Domain B の合成選択キー
      slotName: string;
      defaultUserDataPath: string;
      slotUserDataPath: string;
      isDefaultSlot: boolean;
      adoptsLegacyDefaults: boolean;
      preferredPort: { mode:"fixed"; port:number } | { mode:"auto-assign" }; }
  | { kind: "no-role" }    // ← Domain B の役割選択スタブが受ける
  | { kind: "error"; message: string };
```

- `startRuntimePlayerMain()` 内に `const launch: RuntimePlayerSlotLaunch` として既に解決済み・スコープ内にある。Domain B はこの **`launch` を読む**だけで役割別合成を組める(再パース不要)。
- **合成一点(役割別レジストラ組み立て)を差す場所**: `runtime-player-main.ts` の `app.whenReady().then(async () => {...})` 本体。入力系 3 レジストラ(`registerInputBridgeHandlers` 行 ~286 / `registerInputProfileBridgeHandlers` ~300 / `registerModelMappingBridgeHandlers` ~316)を **`launch.role` で「組み立てる/組み立てない」の選択**にする(自律ホストは入力系を組み立てない)。`if (role===...)` の**実行時分岐ではなく、レジストラ集合の選択**として表現すること(wave plan §4.3 / §11 blocking)。
- startup status role 伝搬: `createStartupStatus()`(`placeholder-action-state.ts:27`)に `role` を足して `launch.role` を渡す(既存 pull に相乗り、新チャネル不要)。renderer は表示のみに使う。
- 役割ラベルは `runtimePlayerHostRoleLabels`(`profile-slots/host-role.ts`)を再利用(タイトル/Header バッジ/トレイツールチップの `Tracking Host` / `Autonomous Host`)。data lookup なので role 分岐にならない。
- ダイアログ文言 `runtimePlayerHostRoleLabels[launch.role]` を busy メッセージで使用中(下記 裁量欄参照)。

### 注意(Domain B が触る同一ファイル)

- `runtime-player-main.ts` は Domain A/B で所有が重なる。私の変更は関数**先頭のスロット配線**と whenReady **本体先頭の legacy 採用** + config store の `createPreferredPort` spread + will-quit の `slotLock?.release()` のみ。既存合成ロジックは無改変。Domain B はこの上に役割別合成を積むこと。

---

## 裁量判断(設計未定義を合理的に埋めた箇所)

1. **busy ダイアログ文言**: wave plan の例は「A Tracking Host with this profile is already running.」。a/an の文法差を避け、両役割で自然な `This profile is already in use by a running ${label}.` を採用(スロット名非露出は満たす)。Domain B/C で最終文言を調整可。
2. **スロット名規約**: 「空白なし・パス injection 拒否」以上の具体規約が未定義のため、`^[A-Za-z0-9][A-Za-z0-9_-]*$` + 予約名 + 長さ 64 を採用(ドット全面禁止でトラバーサル封じ)。既定スロット名は満たす。
3. **非既定スロットの port 採番**: 「空きポート自動採番」の具体アルゴリズム未定義のため `net` の port 0 bind で空き取得。永続後は再利用(冪等)、実 bind 競合はサーバ既存の EADDRINUSE 降格が吸収。
4. **legacy 採用対象**: 棚卸し観点2の既知 6 store ディレクトリをホワイトリスト化(ディレクトリ丸ごとコピー)。
5. **採用失敗時**: crash させず best-effort(元データ無傷・マーカー未書きで次回再試行)。
6. **lock 記録に role を含める**: 診断用。busy owner 情報として返すが UI 露出は Domain B 判断。

---

## 質問(ユーザー/上位判断が必要・実装で埋めなかったもの)

1. **`app.setPath("userData")` の ready 前挙動(Electron 42)**: wave plan §4.1 の明示指示どおり実装したが、実機(パッケージ版)での確定は未実施(Domain C の手動ゲート / パッケージ版でのみ検証可能)。機械テストでは Electron 起動を要するため検証していない。手動ゲートで「扉1起動 → legacy 復元」を確認する際に、slot 配下(`<userData>/slots/tracking-default/`)へ実際に書かれることを併せて確認されたい。
2. **busy ダイアログ文言の最終形**(上記裁量1)。Domain B の身元表示 UX と整合させるべきか。
3. **legacy `browser-source` config のポート**: legacy config が 17308 以外の preferredPort を永続していた場合、それがそのまま tracking-default に引き継がれる(等価優先)。役割既定 17308 に正規化すべきかは未定義 → 現状は**等価優先で legacy 値保持**とした。要確認なら escalate 対象。

---

## Subagent Contract 遵守の自己確認

- **`pnpm install` 未実施**。回避工作なし(新規モジュールは node builtins + 既存 `browser-source-url` のみ import。新規依存ゼロ、lockfile 無変更)。
- **Editor ソース / package-format schema / Runtime Export schema 無変更**。触れたのは `apps/runtime-player/src/main` 配下のみ。config schema(`runtime-player-browser-source-config-v1`)は無変更(オプション追加は保存フォーマットに影響せず、既定は従来挙動)。
- **Runtime Export immutability 保持**(該当コードに未接触)。
- **実行時 `if(role===...)` 分岐なし**。role 値はレジストラ選択キー(Domain B)/ラベル表 lookup /ロック記録にのみ使用。Domain A の分岐は `launch.kind`(resolved/no-role/error = 供給フェーズの弁別)と、data property(`adoptsLegacyDefaults` bool / port plan)のみで、trackingHost と autonomousHost が**挙動分岐する箇所は存在しない**。
- **既存挙動の退行なし**: 無引数起動は現行どおり root userData で起動(等価)。config store は createPreferredPort 未指定時に従来固定ポート(挙動不変)。EADDRINUSE 降格・Wave10/11/12/17/18/19/20/21/22/23 系に未接触。全体スイートの 2 失敗は baseline(証拠つき)。
- **無関係/並行変更の revert なし**(`git stash` は検証のため一時使用し即 pop、ワークツリー現状維持)。
- **決定論的箇所に focused test**(42 件追加)。
- **ドメイン想定外の共有ファイル**: `browser-source-config-store.ts` の 1 オプション追加のみが profile-slots 外への接触。これは「per-slot preferredPort 既定を役割/スロットで分ける」要件(wave plan §6 要件6)の実現に必要で、後方互換(既定挙動不変)。本レポートで明示報告。
