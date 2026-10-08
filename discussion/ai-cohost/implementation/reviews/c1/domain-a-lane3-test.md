# C1 Domain A レビュー — レーン3: test adequacy

> レビュー担当: Review-Sylph(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。
> 対象: `apps/runtime-player`。レーン: **test adequacy**(機械検証部分が実効か)。spec 突合・design 規律は別レーン。
> 判定基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §6/§9/§11、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) 観点8。
> 検証対象(Gnome 主張): [domain-a-slot-foundation.md](../../waves/c1/domain-a-slot-foundation.md)。

## 判定: **合格**(要修正なし。非ブロッキングの推奨補強を数点付す)

wave plan §6 の必須テスト項目はすべて対応テストが実在し、assert が本質を突いている。敵対ケース(パストラバーサル・予約名・stale lock・legacy 二回目 no-op・自己包含回避・二スロット相互非汚染)の網羅が強い。焦点テスト 42 件の pass を自分で再現し、Gnome 主張の「全体 2 失敗 = baseline」も stash 再現で確認した。手動ゲート項目(片方kill耐性・`app.setPath` ready前挙動)は偽装ユニット化されておらず正しく分離。欠落は defense-in-depth の周辺のみで、C1 機械ゲートの実効性を損なわない。

---

## 自分でのテスト実行結果

環境: Windows/PowerShell、`pnpm install` 不実施(既存 devDeps で回った)。

| 実行 | コマンド | 結果 |
|---|---|---|
| focused(Domain A) | `npx vitest run -c vitest.config.ts src/main/profile-slots src/main/broadcast-source/browser-source-config-store.test.ts` | **6 files / 42 tests pass**(Gnome 主張と一致) |
| baseline 2 失敗(現状) | `... src/main/broadcast-source/browser-source-server.test.ts src/stage/browser-source/browser-source-server-message.test.ts` | **2 failed / 20 passed**。失敗内容は `effectiveDynamicsTuning` フィールド差分(Wave21 Dynamics Tune の Runtime Export message shape) |
| baseline 再現(Domain A 変更を `git stash`) | 上と同一2ファイル | **2 failed / 20 passed**(同一の失敗)。stash pop で作業ツリー復元済み |

**baseline 判定の妥当性**: 失敗2ファイル(`browser-source-server.test.ts` / `browser-source-server-message.test.ts`)は Domain A の変更対象(`browser-source-config-store.ts/.test.ts` / `runtime-player-main.ts` / 新規 `profile-slots/`)に含まれない。失敗の中身は Runtime Export ペイロードの `effectiveDynamicsTuning` に関する source-vs-test ドリフトで、スロット基盤とは無関係。Domain A 変更を除いても同一失敗が出るため、**Domain A は回帰ゼロ**。Gnome の主張を検証・支持する。

---

## テスト網羅マトリクス(wave plan §6 各項目 → 対応テスト・実効性)

| §6 必須項目 | 対応テスト | 実効性の評価 |
|---|---|---|
| スロット名検証(不正名・パス injection 拒否) | `slot-name.test.ts`(7) | **十分**。空/非文字列/空白/`..` `.` `../evil` `a/b` `a\b` `/abs` `C:name` `slots/../secret` `.hidden` `-leading` `with.dot`/Windows 予約名(大小無視)/長さ上限を敵対網羅。値検証あり(緩くない)。 |
| ロック: 取得/解放/二重取得拒否/stale 回復 | `slot-lock.test.ts`(6) | **十分**。取得+owner record 値検証、alive 中の二重取得拒否(reason=`busy`・owner.pid 検証)、release 後再取得、dead pid の stale 回復(新 pid で record 上書き検証)、unparseable 回復、他者再取得済み lock を release で消さない安全性。`isProcessAlive`/`nowIso` 注入で決定論的。 |
| userData 基点導出(スロット名→パス) | `role-launch-resolution.test.ts`(`slotUserDataPath === join(root,"slots",name)` を複数ケースで assert) | **十分(ただし dedicated test なし)**。純導出 slotName→path は解決テストで値検証される。`slot-paths.ts` 単体の防御 throw は未テスト(下記欠落1)。 |
| legacy 採用の冪等性・元データ非破壊 | `legacy-adoption.test.ts`(5) | **十分**。コピー+marker(スロット側の値まで検証)、元データ非破壊、二回目 no-op(source を書換えても slot 不変を値検証)、fresh install(copiedEntries=[]+marker+二回目 no-op)、`slots/` 自己包含回避。 |
| per-slot config: 二スロットが別 token/別 preferredPort | `browser-source-config-store.test.ts`(7、特に "keeps token and preferred port independent across two slots") | **十分・最強**。別 token・別 port・別ファイルパス・相互非汚染(slotA ファイルに他 token が現れないことまで検証)。createPreferredPort の同期/非同期・fresh 時のみ呼ばれる(persist 後 reuse)も別テストで担保。 |
| Runtime Export / package-format 無変更 | (positive test 不能)既存 "persists and reuses token" が schemaVersion 含む document 形状を厳密検証 / baseline 分析 | **妥当**。「変更していない」は正のユニットに落ちない性質。config schema 不変は既存の厳密 document assert で間接担保。schema 差分の最終確認は Domain C の diff 検証責務(正しく委譲)。 |
| (追加)引数パース・起動解決 | `role-launch-resolution.test.ts`(13) | **十分**。`--role=`/空白区切り両形式、no-role、未知 role・role 値欠落・profile 単独=error、role→既定スロット/legacy/port plan、custom=auto-assign+legacy なし、port はスロット名キー(role キーでない)、path-injection profile=error。 |

**合成ルート整合の確認**: `runtime-player-main.ts` の配線(`resolveRuntimePlayerSlotLaunch` L82 / `acquireRuntimePlayerSlotLock` L105 / `app.setPath` L121 / `adoptRuntimePlayerLegacyDefaults` L128 / `createPreferredPortFactory` L152 / `slotLock?.release()` L521)は、テスト済みの純関数を**そのまま**呼んでいる。テストは実コードパスの純ロジックを覆っており、乖離した別ロジックのテストではない。

---

## 欠落テスト一覧(すべて非ブロッキング / defense-in-depth 周辺)

いずれも §6 必須項目は別テストで満たされており、C1 機械ゲートは成立する。以下は堅牢性補強の推奨(要修正ではない)。

1. **`slot-paths.ts` の防御 throw が未テスト**。`deriveRuntimePlayerSlotUserDataPath` は不正名で throw する多層防御を持つが、`resolveRuntimePlayerSlotLaunch` が事前検証して error を返すため、`../evil` テストは derive の throw に到達しない。resolve 側の検証を将来外すと derive の最後の砦が黙って回帰し得る。**指針**: `expect(() => deriveRuntimePlayerSlotUserDataPath({ defaultUserDataPath:"/x", slotName:"../evil" })).toThrow()` の2行を追加。
2. **`legacy-adoption` の `skippedExistingEntries`(コピー先が既存なら上書きせず skip)が未テスト**。非破壊の第二の砦。**指針**: slot 側に事前に `window-state/` を置いてから adopt を呼び、`skippedExistingEntries` に載る&既存値が上書きされないことを assert。
3. **`slot-lock` の周辺分岐が未テスト**: (a) `release()` 二重呼び出しの no-op ガード、(b) `maxAttempts` 枯渇時の `busy` 返却、(c) 自 pid 残骸(`lastOwner.pid === pid`)の再取得。いずれも unparseable/stale テストで隣接パスは覆われる。**指針**: 低コストなので (a) だけでも追加推奨(二重 release で例外/二重 unlink が起きないこと)。

---

## 手動ゲート分離の妥当性(観点4 / §1.5)

- **片方kill耐性**: ユニット化されていない。`slot-lock` は実プロセス kill ではなく `isProcessAlive` 注入で pid 死活を検証しており、「プロセス独立性」を偽装検証していない。stale 回復(pid 死活検出)と kill 耐性(OS プロセス独立)を正しく別物として分離。**妥当**。
- **`app.setPath("userData")` の ready 前挙動**: Electron 実機依存として手動ゲート/質問に回され、偽のユニットで塗り固められていない。**妥当**。
- **合成ルートの組み立て**(setPath 実行・startup での lock 取得・whenReady での adoption・port factory 注入・will-quit release)は機械検証されていない。個々の純部品は検証済みだが**アセンブリ自体は Electron 手動ゲートのみ**。これは wave plan §1.5(Electron E2E ハーネス新設せず)と整合し、Domain A のテスト欠落ではなく Domain C 手動ゲートの責務。ただし「二スロットで実際に別ファイルに書かれる」ことは §11 の分離不変条件の核なので、Domain C 手動ゲート手順で slot 配下(`<userData>/slots/<name>/`)への実書き込み確認を必須にすべき(Gnome 質問1 と同旨)。

---

## フレークリスク

- **決定論的(注入で固定)**: `slot-lock`(isProcessAlive/nowIso 注入)、`legacy-adoption`(nowIso 注入、逐次 fs、並行なし)、`role-launch-resolution`(純関数)、`config-store`(token 注入)。フレーク源なし。
- **唯一の実ポート bind**: `slot-preferred-port.test.ts` は `findFreeLoopbackPort` の性質上、実際に `127.0.0.1` へ port0 bind→close→(再bind検証)する。
  - "returns distinct ports across calls": 同時オープン2ソケットへカーネルが別 ephemeral port を割り当てる前提。衝突確率は事実上ゼロ。**低リスク**。
  - "returns a usable free loopback port": free port 取得→close→同 port 再 bind の間に他プロセスが同 port を奪う TOCTOU が理論上あるが確率極小。**低リスク・許容**(free-port-finder のテストに内在する不可避性。実 bind 競合はサーバ側 EADDRINUSE 降格が吸収する設計で、テストの意図とも整合)。
- 総合: **フレーク実害の懸念なし**。実ポートを触るのは上記1ファイル2ケースのみで、性質上不可避かつ低確率。

---

## 質問(上位判断が必要)

1. 欠落テスト1〜3(defense-in-depth 補強)は Domain A で追加させるか、それとも「非ブロッキング・Domain C か後続 wave で拾う」とするか。レーン3 判定としては**合格(要修正なし)**とし、補強は推奨に留めている。
2. 合成ルートのアセンブリ(setPath / lock / adoption / port factory / release の結線)が機械未検証である点を、Domain C 手動ゲート手順書に「slot 配下への実書き込み確認」「同スロット二重起動→busy ダイアログ&既存無傷」「二体で別 port/token」を**必須チェック**として明記させるべきか(現状 wave plan §8 の手動ゲートに概ね含まれるが、slot ディレクトリ実体確認は Gnome 質問1 の粒度で追記が望ましい)。
