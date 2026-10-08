# C1 Domain A レビュー — レーン1: spec compliance

> レビュアー: Review-Sylph(spec compliance レーン、Orch-Sylph 委任)。日付: 2026-07-10。
> 対象: `apps/runtime-player` の Domain A(スロット基盤)実装。
> 突合基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §3/§4/§6/§9、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §5/§6、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md)。
> レビュー方法: 対象ファイルを自分で読解、focused test を自分で実行(42 pass)、baseline 2 失敗を独立に再現・原因確認。Gnome レポートの主張は鵜呑みにせず差分で裏取り。

## 判定: **合格(pass)**

Domain A のスコープにある spec 要件は 6 観点すべてで満たされている。逸脱・未実装は無し。blocking 指摘なし。non-blocking の観察と上位判断待ちの質問を末尾に列挙する。

---

## 観点ごとの仕様適合状況

### 1. 起動引数スキーマ — **仕様どおり**

- `--role=trackingHost|autonomousHost --profile=<slotName>` 両形式(`--flag=value` と `--flag value` 空白区切り)をパース。`role-launch-resolution.ts:32-58, 60-103`。
- profile 省略時 `<role>-default`(`tracking-default` / `autonomous-default`)。`host-role.ts:40-47`、`role-launch-resolution.ts:154-157`。
- 不正 role(未知値 / 値欠落)、不正 slotName(パス注入含む)、`--profile` 単独指定は明確な `error` を返す。`role-launch-resolution.ts:66-96, 159-165`。path 注入は `slot-name.ts:18` のパターンで拒否(`.` 全面禁止でトラバーサル不能)、`slot-name.test.ts:33-49` で `..` `../evil` `a/b` `a\b` `/abs` `C:name` `slots/../secret` `.hidden` を網羅。
- 引数なし = `no-role`。`runtime-player-main.ts` の `role-resolved` ブロックを一切通らず、userData 差し替え・ロック・legacy 採用を行わない(`runtime-player-main.ts:76-129` は `launch.kind === "role-resolved"` ガード下のみ)。**どの役割にも暗黙束縛しない** = c1-role-skeleton §2 の恒久禁止に適合。状態を書かないので「次回から」記憶も持たない。`launch` は `startRuntimePlayerMain()` スコープ内に解決済みで、Domain B のスタブがこれを読める seam が成立。

### 2. スロット解決 / userData 基点差し替え — **仕様どおり**

- 実効 userData 基点 = `<default userData>/slots/<slotName>`。`slot-paths.ts:17-33`(結合前に再検証する多層防御)。
- app ready **前**の差し替え。`startRuntimePlayerMain()` の同期先頭で `defaultUserDataPath` を捕捉 → 解決 → `app.setPath("userData", launch.slotUserDataPath)` を `app.whenReady()` 登録より前に呼ぶ。`runtime-player-main.ts:77-118`。これは wave plan §4.1 が明示指定した方式そのもの。
- store 改修なしで全成果物連動。userData 基点の差し替えは 1 点のみで、全 store は `{ userDataPath }` DI 済み(inventory 観点2)。実際、broadcast-source config store 以外の store コードは無改変(`git diff --stat` で確認)。config store の変更は port 用の任意オプション追加であって userData 基点には無関係。legacy 採用は捕捉済みの `launch.defaultUserDataPath`(旧基点)を正しく参照。

### 3. スロットロック — **仕様どおり**

- 所有表明: `<slot>/slot.lock` に `{pid, role, acquiredAtIso}` をアトミック作成(`openSync(path, "wx")`)。`slot-lock.ts:118-181`。
- 取得失敗時の明確なエラー: busy 時に `This profile is already in use by a running ${label}.` をダイアログ表示して quit。`runtime-player-main.ts:107-114`。**スロット名は露出していない**(spec は露出必須としない → 適合)。
- stale lock 回復手段あり: `process.kill(pid, 0)` で生存確認、死 pid・自 pid 残骸・unparseable lock を stale とみなし unlink して有界リトライ。`slot-lock.ts:54-67, 140-166`。`slot-lock.test.ts:86-120` で死プロセス回復と unparseable 回復を検証。`release()` は自 pid 所有時のみ unlink(他者再取得済みを消さない)。`slot-lock.ts:183-207`、`slot-lock.test.ts:122-147`。
- 単一インスタンスロックを置いていない: `app.requestSingleInstanceLock` は追加されていない(inventory 観点1 のグレップ 0 件、diff にも無し)。N 体運用と整合。

### 4. legacy 採用 — **仕様どおり**

- tracking-default 初回のみ発火。`adoptsLegacyDefaults = slotName === "tracking-default"`(`role-launch-resolution.ts:177`)、main は `launch.adoptsLegacyDefaults` ガード下でのみ採用実行(`runtime-player-main.ts:120-128`)。
- 既知 store 群 6 個をコピー: `window-state` / `browser-source` / `model-mapping-profiles` / `dynamics-tuning-profiles` / `input-profiles` / `startup-state`。`legacy-adoption.ts:21-28`。wave plan §4.2 の列挙(window-state / model-mapping / dynamics-tuning / input profiles / browser-source config / startup-state)と完全一致。
- 冪等: `.legacy-adopted.json` マーカーで再実行 no-op。`legacy-adoption.ts:60-62`、`legacy-adoption.test.ts:121-156`(元データ改変後の 2 回目が no-op、slot は v1 のまま)。
- 元データ非破壊: コピーのみ、slot 側既存は skip。`legacy-adoption.test.ts:97-119`。`slots/` 自己包含回避もホワイトリストで担保、`legacy-adoption.test.ts:183-204` で検証。

### 5. per-slot token / port — **仕様どおり**

- token はスロット初回生成: config store が per-slot 別ファイルで初回 create 時に token 生成。`browser-source-config-store.ts:70-114`。
- preferredPort 既定: tracking-default=17308 / autonomous-default=17309。`host-role.ts:61-68`(`runtimePlayerBrowserSourceDefaultPort`=17308、autonomous=+1=17309)。**スロット名キーの表**であって役割キーではない(role 分岐回避)。`role-launch-resolution.test.ts:130-148` が「port はスロット名でキーされ役割ではない」を明示検証。
- それ以外は自動採番: `findFreeLoopbackPort()`(port 0 bind)。`slot-preferred-port.ts:12-36`、`role-launch-resolution.ts:135-142`。
- 手動ポート設定 UI 無し: 追加されていない(diff で確認)。preferredPort は factory から初回 create 時のみ注入され、以降は永続値再利用。`browser-source-config-store.ts:61-63, 106-114`、`runtime-player-main.ts:148-157`。
- EADDRINUSE 揮発降格の維持: `browser-source-server.ts` は無改変(`git diff --stat` に含まれない)。降格ロジックはそのまま。

### 6. AC 突合(§9)— Domain A 担当部分は満たされる

| AC(§9) | Domain A の担い | 判定 |
|---|---|---|
| `--role`/`--profile` スキーマ動作、引数なし=スタブ(記憶なし) | 引数解決 + no-role passthrough(スタブ本体は Domain B) | ✓ 機械テスト済み |
| 二インスタンス別モデル同時表示(パッケージ版) | 手動ゲート + Domain B 合成 | Domain A 対象外(正しく手動へ委譲) |
| window-state/mapping/tuning/input/browser-source config のスロット分離 | userData 基点差し替えで機械的に分離 | ✓(config store は二スロット独立性テスト済み。他 store は単一基点差し替え機構で連動。後述 non-blocking 参照) |
| legacy 採用で既存データ引き継ぎ・単独運用従来等価 | legacy 採用 + fresh install 等価 | ✓ |
| token/port スロットごと独立・手動設定不要 | per-slot config、自動採番 | ✓ |
| 同一スロット二重起動は明確なエラー(破壊なし) | スロットロック busy | ✓ |
| 片方killでもう片方止まらない | プロセス独立性(単一ロック不在・相互参照ゼロ) | 手動ゲート(Domain C)、Domain A は基盤成立 |
| 実行時 `if(role===...)` 分岐なし | launch.kind(供給フェーズ弁別)と data property のみ | ✓(後述) |
| Editor/package-format/Export schema 無変更・新規依存なし・pnpm install なし | — | ✓ diff で確認 |
| 対象テスト・typecheck パス、失敗は証拠付き分類 | — | ✓ 独立検証済み(下記) |

機械テストと手動ゲートの切り分けは妥当。プロセス独立性(kill 耐性)と実機 `app.setPath` 挙動はユニット層に落ちない性質であり、手動ゲート(Domain C)へ回すのは inventory 観点8 とユーザー裁定 §1.5 に整合。

---

## 実行時 role 分岐の不在(spec AC + レビュー固有 blocking 観点)

新規コード + main 差分を通読した限り、trackingHost と autonomousHost が**挙動分岐する `if (role === ...)` は存在しない**。role 値の使途は (a) Domain B の合成選択キーとしての持ち回り、(b) ラベル表 lookup(`runtimePlayerHostRoleLabels[launch.role]`、`host-role.ts:32-35`)、(c) ロック記録の診断フィールドのみ。Domain A 内の分岐は `launch.kind`(role-resolved / no-role / error = 供給フェーズ弁別)と data property(`adoptsLegacyDefaults` bool、port plan)に限られる。**適合。**(design レーンが深掘りするが、spec AC 該当分は満たす。)

---

## テスト・typecheck の独立検証

- focused test を自分で実行: `profile-slots` 全 + `browser-source-config-store.test.ts` = **42 pass**(6 files)。Gnome の主張と一致。
- 全体スイートの 2 失敗を独立に再現し原因確認: `browser-source-server.test.ts`(Runtime Export payload)と `stage/browser-source/browser-source-server-message.test.ts`(not-loaded response shape)の 2 件で、いずれも差分 `+ "effectiveDynamicsTuning": null`(Wave21 Dynamics Tune のペイロード形状)。**この 2 ファイルは `git diff --stat` の変更リストに含まれず、Domain A は未接触**。よって Domain A に起因しない baseline 失敗と確認。Gnome の分類は正確。
  - 補足: 完全な baseline 確定(master との突合)は Domain C のモノレポ検証で行うのが筋。本レーンは「Domain A の変更ファイルがこの 2 テストに触れていない」ことまでを diff で確定した。

---

## 裁量判断の妥当性評価

Gnome レポート §裁量判断の 6 項目を評価:

1. **busy ダイアログ文言**(`This profile is already in use by a running ${label}.`): 妥当。a/an 文法差を避けつつ両役割で自然、スロット名非露出という spec 制約を満たす。最終文言調整は Domain B/C で可。
2. **スロット名規約**(`^[A-Za-z0-9][A-Za-z0-9_-]*$` + 予約名 + 長さ 64): 妥当。spec は「空白なし・パス injection 拒否」以上を未定義。ドット全面禁止でトラバーサルを根で封じており、既定スロット名も通る。過剰に厳しくない。
3. **非既定スロットの port 採番**(net port 0 bind): 妥当。spec の「自動採番」を満たし、実 bind 競合はサーバ既存の EADDRINUSE 降格が吸収する設計と整合。
4. **legacy 採用対象のホワイトリスト**: 妥当。§4.2 の列挙と一致。ディレクトリ丸ごとコピーで内部ファイル名差に非依存。
5. **採用失敗時 best-effort catch**: 概ね妥当だが下記 non-blocking で 1 点補足。
6. **lock 記録に role を含める**: 妥当(診断用、UI 露出は Domain B 判断)。

---

## non-blocking 観察(spec 逸脱ではないが記録)

1. **他 store のスロット分離に対する機械テストが config store のみ**: window-state / model-mapping / dynamics-tuning / input / startup-state のスロット分離は「単一 userData 基点差し替え」機構(inventory 接地事実)に依拠し、Domain A は per-store の二スロット独立テストを追加していない。config store のみ二スロット独立テストあり。spec 上は「機構で連動」で足り逸脱ではないが、**test adequacy レーンが「基点差し替え → 全 store 連動」を担保する何らかの検証(統合点テスト等)の要否を判断すべき**。本レーンからは spec 適合として合格扱い。
2. **legacy 採用の全エラー silent catch**(`runtime-player-main.ts:123-127` の `.catch(() => undefined)`): fresh install で対象ゼロは正常だが、この catch は cp の途中失敗など**異常な legacy レイアウト起因の例外も無言で握り潰す**(マーカー未書きで次回再試行 = degraded-but-safe)。ホワイトリスト方式なので「採用マッピングの判断」は発生せず §4.2 の escalate 条件は成立しないが、「黙って推測しない」精神からは、少なくとも診断ログを残す検討余地あり。データ損失は無い(元データ非破壊)ため non-blocking。
3. **busy 判定前に空 slot ディレクトリを作成**: `acquireRuntimePlayerSlotLock` が busy 検出前に `mkdirSync(slotUserDataPath)` する(`slot-lock.ts:130`)。取得失敗時も空スロットディレクトリが残る。データは書かれず害は無い。cosmetic。

---

## 質問(上位判断が必要 — Gnome の質問を spec レーンとして追認・補足)

1. **legacy `browser-source` config のポート正規化**(Gnome Q3): legacy 採用で tracking-default が旧 config(旧 token + 旧 preferredPort)を引き継ぐ場合、role 既定 17308 へ正規化せず「等価優先で legacy 値保持」としている。旧既定は 17308 固定だったため実害は想定しにくいが、spec の「preferredPort 既定 tracking-default=17308」と「単独運用従来等価(既存 OBS URL 維持)」は legacy 継承時に後者が優先される、という解釈でよいか要確認。**本レーンの評価: 等価優先が spec の「従来等価」意図に合致し妥当。正規化は不要と考えるが最終裁定は L0。**
2. **`app.setPath("userData")` の ready 前挙動(Electron 42)**(Gnome Q1): wave plan §4.1 明示指示どおり実装。ユニット層では Electron 起動を要するため未検証。Domain C 手動ゲートで「扉1起動 → `<userData>/slots/tracking-default/` へ実書き込み + legacy 復元」を確認する必要がある。これは inventory リスク欄にも挙がった既知の手動検証項目で、spec 上の欠落ではない。
