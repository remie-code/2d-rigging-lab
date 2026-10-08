# C1 Domain A レビュー — レーン2: design/development compliance

> レビュア: Review-Sylph(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。
> レーン: design/development compliance(合成一点規律・既存アーキテクチャ整合)。spec 突合と test adequacy は別レーン。
> 判定基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §4/§10/§11、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §1/§5、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md)、[runtime-player-model-host-roles.md](../../../architecture/runtime-player-model-host-roles.md) §4。
> 検証根拠: 対象ファイル全読 + `git diff`(config-store.ts / runtime-player-main.ts)+ 横断 grep(role 実行時分岐・import 依存)。Gnome レポートの主張は独立に確認済み。

## 判定: **合格(要修正なし)**

design/development compliance の全観点で blocking なし。合成一点規律・既存アーキテクチャ整合・不変条件・退行なし・Subagent Contract・秘匿境界いずれも満たす。裁量判断も設計指示の範囲内で妥当。non-blocking 指摘 3 件と質問 2 件を下記に記す。

---

## 観点ごとの評価

### 1. 実行時 role 分岐の不在(BLOCKING 観点) — 合格

- `apps/runtime-player/src/main` 全域を grep。挙動を role 値で分岐する `if (role === "trackingHost")` 系は**存在しない**。ヒットしたのは (a) host-role.ts のコメント(禁止事項の明文化)、(b) slot-lock.ts:110/134 の `record.role === "string"` / `options.role === undefined`。後者は lock レコードの**任意 role フィールドの型ガード**であり、trackingHost/autonomousHost で挙動が分岐する箇所ではない(role は診断用に文字列として書き込むだけ)。
- role 値の用途は 3 つに限定され、いずれもデータ操作:
  - **ラベル lookup**: `runtimePlayerHostRoleLabels[launch.role]`(host-role.ts:32、table lookup)。
  - **既定スロット名/既定ポート導出**: `defaultSlotNameForRole` / `runtimePlayerDefaultSlotPreferredPorts`(いずれも **slotName キー**の data table。役割キーですらない箇所あり)。
  - **ロック記録**: 診断メタとして pid/role を JSON 保存。
- 合成フェーズの弁別は `launch.kind`(`role-resolved` / `no-role` / `error`)で行われ、これは「起動をどう供給するか」の選択であって実行時分岐ではない。role-resolved 内の派生も `adoptsLegacyDefaults`(bool)・`preferredPort` plan(discriminated union)といった **data property** で表現され、trackingHost と autonomousHost が挙動分岐する行は一行もない。
- runtime-player-main.ts:150 の `...(launch.kind === "role-resolved" ? {...} : {})` は kind 弁別であり role 分岐ではない。合格。

### 2. 合成一点規律 — 合格

- 差し替え 4 種がすべて composition root(`startRuntimePlayerMain`)一点に閉じている:
  - **userData 基点**: 同期先頭 `app.setPath("userData", launch.slotUserDataPath)`(runtime-player-main.ts:121)。
  - **legacy 採用**: whenReady 本体先頭(:125-132)。
  - **port**: config store へ `createPreferredPort` を spread(:150-156)。
  - **lock**: 冒頭 acquire(:105)/ will-quit release(:521)。
- store 群への侵襲的改修は `browser-source-config-store.ts` **一箇所のみ**。内容は (a) 任意オプション `createPreferredPort?` 追加、(b) `#createDocument` を async 化。**schema(`runtime-player-browser-source-config-v1`)・token 生成・保存形式・parse ロジックは無変更**(diff で parse/schema 部に接触なし)。既定挙動不変(未指定時 `() => runtimePlayerBrowserSourceDefaultPort` = 17308)。
- この 1 touch は wave plan §6 要件6(per-slot preferredPort 既定を役割/スロットで分ける)の実現に必須で、config store が「初回 create 時のみ port を決める」性質上、生成時に port を注入する factory 方式が最小侵襲。**冪等性(初回のみ factory 実行、以降は永続値再利用)も保たれている**。後方互換の範囲内で妥当。合格。

### 3. 既存アーキテクチャ整合 — 合格

- **`{ userDataPath }` DI 尊重**: config store 生成は既存 DI パターンを維持し `userDataPath: app.getPath("userData")` を渡す(:149)。setPath 後の値が返るため全 store が slot 内に連動。store 側改修ゼロ。inventory §2 の「基点一点差し替え」方式に忠実。
- **app.setPath ready 前呼び出し**: startRuntimePlayerMain 同期先頭(whenReady 登録前、:121)。inventory §2 の推測配置と一致。既存 `app.getPath("userData")` の 6 箇所はすべて whenReady 内(:81 の default 捕捉を除く)で、setPath 後に評価されるため衝突しない。default 捕捉(:81)は setPath 前に実行され legacy 元パスを正しく保持。初期化順との衝突は認められない。
- **will-quit ロック解放と quit 直列化の整合**: `slotLock?.release()` は既存 `app.once("will-quit")` の末尾に追加(:521)。`RuntimePlayerQuitController` は `before-quit` を横取りして非同期 flush 後に `app.quit()` を呼び、will-quit はその後段。release は同期 `rmSync` で flush 処理に割り込まない。既存 will-quit 内の他 dispose(tray/server stop)と同列の追加であり、quit 直列化を乱さない。合格。

### 4. 不変条件の維持 — 合格

- **実行時相互関与ゼロ**: 正常な二体並走(別スロット)では、ロック取得は `openSync(wx)` が EEXIST を起こさず成功するため、他プロセスへの参照は**一切発生しない**。フレーム/ポート/userData/生死が互いに触れない不変条件(skeleton §5-1)を保持。
- **stale lock 回復と `process.kill(pid, 0)`**: pid 存在確認は**同一スロットの二重要求時(EEXIST)にのみ**走る、取得時の一回きりの検査。signal 0 はシグナルを送らず存在確認のみで相手プロセスに影響ゼロ(不変条件2「クラッシュは連鎖しない」に抵触しない)。ランタイム中に相手を監視し続けるループは無い。「他プロセスのハンドルを跨いだ継続的参照」ではなく「ロック所有権判定のための一過的存在確認」であり、不変条件の趣旨に合致。ESRCH→stale 回復、EPERM→生存扱い(安全側)、unparseable/自 pid→回復、の分岐も妥当(slot-lock.ts:54-67,149-165)。
- **release の所有権ガード**: `release()` は現 lock の pid が自 pid のときのみ unlink(slot-lock.ts:195-197)。他インスタンスが再取得済みの lock を消さない。二重解放ガードもあり。異常終了(kill)時は will-quit 不発で lock が残るが、これは次回起動の stale 回復で吸収する設計であり意図どおり。合格。

### 5. 退行なし — 合格

- **トラッキングホスト合成の等価性**: `--role=trackingHost` 起動時、slot `tracking-default` へ移行し legacy 採用で既存データをコピー。config は採用済み legacy config(既存 token/port)として読まれ factory は呼ばれず、**従来 token/port を保持**(config-store は既存があれば create しない)。合成本体(入力系レジストラ等)は無改変。挙動等価。
- **無引数起動の等価性**: `no-role` → setPath なし・lock なし・legacy 採用なし・createPreferredPort spread なし → root userData + 既定 17308 で起動。**現行と完全等価**。skeleton §2「引数なし=役割への暗黙束縛の禁止」も満たす(no-role は何にも束縛されない。picker stub 自体は Domain B の seam)。
- **既存挙動への影響なし**: browser-source-server.ts 未変更 → EADDRINUSE 揮発ポート降格・Browser Source primary path 不変。config store 変更は port の**生成元**だけで schema/token 経路に非接触。Wave10/11/12/17-23 系コードに未接触。合格。

### 6. Subagent Contract 遵守(§10) — 合格

- **新規依存ゼロ**: profile-slots の import は node builtins(`node:fs` / `node:fs/promises` / `node:path` / `node:net`)+ 既存 `../broadcast-source/browser-source-url`(`runtimePlayerBrowserSourceBindAddress` / `runtimePlayerBrowserSourceDefaultPort`、いずれも既存 export)のみ。config-store.ts は **import 追加ゼロ**(diff 確認)。
- **lockfile 無変更**: `git status` に `pnpm-lock.yaml` 変更なし。`pnpm install` 痕跡なし。
- **Editor/package-format/Runtime Export schema 無変更**: 変更は `apps/runtime-player/src/main` 配下に限定(`git diff --stat` = 3 ファイル + profile-slots 新規)。Runtime Export 関連コードに未接触。
- **無関係 revert なし**: diff は追加のみ、既存ロジック削除なし。合格。

### 7. renderer への秘匿漏れ — 合格

- Domain A 範囲で token/私的パス/rawトラッキングを renderer へ流す**新経路は無い**。config store の変更は port 生成元のみで sanitization 境界に非接触。lock ファイル(pid/role/path)は slot ディレクトリ内の on-disk データで renderer 非露出。startup status への role 伝搬は Domain B スコープ(本 Domain では未実装)。既存 sanitization 境界を維持。合格。

---

## blocking 一覧

**なし。**

---

## non-blocking 指摘

1. **pid 再利用による false-busy(slot-lock.ts:54-67, 150-153)**: Windows で pid 再利用が起きた場合、死んだ owner の pid が無関係プロセスに再利用されると `process.kill(pid,0)` が true を返し、正当な再起動が "busy" として拒否され得る。安全側(生きた lock を奪わない)ではあるが、owner record の `acquiredAtIso` を使った boot-time / max-age フォールバックは実装されていないため、稀に手動 lock 削除が必要になる。wave plan が要求した「stale lock 回復」は pid が真に死んだ通常ケースで満たされており blocking ではない。将来堅牢化候補として Domain C 手動ゲートで挙動を確認されたい。
2. **legacy 採用の silent catch(runtime-player-main.ts:131 `.catch(() => undefined)`)**: 採用途中の IO 失敗(権限エラー等)を無音で握り潰す。非破壊(元データ無傷)・マーカー未書き込みで次回再試行という設計は妥当だが、失敗が診断ログにも残らない。wave plan §4.2 の escalate 条件は「レイアウト差で採用マッピングに判断が要る場合」であり、ホワイトリスト・ディレクトリ丸ごとコピー方式では該当せず escalate 不要の判断は正しい。ただし degraded 起動を検知可能にする診断ログ追加が望ましい(Domain C 検討)。
3. **`#createDocument` の async 化(browser-source-config-store.ts)**: 現状 `#createDocument` の呼び出し元は `getOrCreateConfig`(既に async)のみで問題ないが、将来この private を同期文脈から呼ぶコードが加わると型エラーになる。config store が「初回 create 時に factory を await する」性質になった点を Domain B/C は認識しておくこと(現時点の退行リスクは無し。typecheck pass 済み)。

---

## 裁量判断の妥当性

- **busy ダイアログ文言**(`This profile is already in use by a running ${label}.`): wave plan §4.1 の「スロット名を必須としない」を満たし、a/an 文法差も回避。妥当。最終文言は Domain B の身元表示 UX と整合させる余地あり(質問1参照)。
- **スロット名規約**(`^[A-Za-z0-9][A-Za-z0-9_-]*$` + 予約名 + 長さ64): ドット全面禁止で `.`/`..` トラバーサルを封じ、パス区切り・スキーム colon・空白を拒否。deriveRuntimePlayerSlotUserDataPath でも再検証(多層防御、slot-paths.ts:21)。設計未定義部分を安全側で埋めており妥当。
- **非既定スロットの port 採番**(port 0 bind → kernel 採番、slot-preferred-port.ts): 永続後再利用で冪等、実 bind 競合はサーバ既存降格が吸収。妥当。
- **app.setPath ready 前呼び出しを escalate せず実装**: wave plan §4.1 が方式を明示指定しており判断の余地がないため escalate 不要とした Gnome の判断は正当。ただし実機挙動は機械テストで検証不能(質問2 = Gnome の質問1 と同旨)。
- **legacy `slots/` 自己包含の回避**: コピー対象を既知 6 エントリのホワイトリストに限定し、`slots` を対象外とすることで自己再帰コピーを構造的に排除。root 直下走査ではなく明示エントリ列挙のため安全(legacy-adoption.ts:21-28)。妥当。

---

## 質問(上位判断が必要・本レビューで裁定しない)

1. **busy ダイアログ文言の最終形**(Gnome 質問2 と同): Domain B の役割バッジ/身元表示 UX 語彙(`Tracking Host` / `Autonomous Host`)と整合させるべきか。design 観点では現文言に不備なし。UX 統一は Domain B/C の裁量。
2. **`app.setPath("userData")` の ready 前挙動(Electron 42)**(Gnome 質問1 と同): 機械テストでは Electron 起動を要するため未検証。design 上は inventory §2 推測 + wave plan §4.1 明示指示に忠実で配置に問題なし。実機確定は Domain C のパッケージ版手動ゲート(扉1起動 → `<userData>/slots/tracking-default/` への書き込み確認)に委ねる。本レーンとしては design compliance の合格判定を覆す材料ではない。
