# C5 Domain D clean review: 最終統合の独立検証

> Review-Sylph(clean review・opus)→ Orch-Sylph。ブランチ `feature/2d-rigging-eco-system`、未コミット作業ツリー(C5 全差分)。
> 規範: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §7/§8/§9・Domain A/A-loop2/B/C/D 報告・[c5-followup.md](../../waves/c5/c5-followup.md)。
> 性格: **Gnome 報告を鵜呑みにせず機械ゲートを自分で再実行し、git 差分・docs・人間ゲート手順を実コードで独立に確認した**。個別ドメインの詳細再レビューは行わない(3レーン合格済み)。全体整合・再現・statement 正確性に集中。

---

## 判定: **合格**

C5 全体は整合し、機械ゲートは自分の手元で再現、受け入れ基準§8 を満たし、docs と人間ゲート手順は実コードと一致する。要修正なし。非blocking の軽微所見1件(Domain A 報告のパス誤記)を末尾に記録するが、clean review 対象の Domain D 報告は正しく、合否に影響しない。

---

## 1. 機械ゲートの再現(自分で実行・`pnpm install` 不使用・既存 node_modules)

| ゲート | コマンド | 自分の観測結果 | Domain D 報告との一致 |
|---|---|---|---|
| typecheck | `apps/runtime-player` で `npx tsc --noEmit -p tsconfig.json` | **exit 0・出力なし(clean)** | 一致 |
| 全体テスト | `apps/runtime-player` で `npx vitest run -c vitest.config.ts` | **855 passed / 2 failed / 857 tests・136 files**(exit 1) | **完全一致(855/2)** |
| 特区境界 | repo root で `node scripts/check-soul-zone-boundary.mjs` | **pass**(1244 files・器↔魂 code import なし) | 一致 |
| check:source | repo root で `node scripts/check-source-organization.mjs` | **1 violation のみ** | 一致 |

### 2 fail の内訳(自分で観測・分類)

- `src/main/broadcast-source/browser-source-server.test.ts:150`
- `src/stage/browser-source/browser-source-server-message.test.ts:216`

両者とも diff は `+ "effectiveDynamicsTuning": null`(dynamics-tuning 応答形状の schema drift)。**これ以外の fail はゼロ**(vitest サマリ `2 failed | 855 passed` を自分の端末で確認)。両ファイルは C5 差分集合に不在(§2 で機械確認)。wave plan §8/委任の「既知baseline=Wave21 browser-source系2件」に一致。→ escalate 不要。

### check:source の 1 violation(自分で観測)

`apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`。**これ1件のみ**。physiology/ は C5 差分に不在(§2)なので C5 由来ではなく既知 C3 baseline。**C5 由来の新規 violation はゼロ**。

---

## 2. 無変更確認の追認(git 機械確認・自分で実行)

`git diff --name-only HEAD` + `git ls-files --others` + 個別 status で独立確認。

### 差分集合(自分の観測)

- **tracked 変更 = 20**: control-channel の validation/dispatch/server/server-events/protocol-contract/overlay-store の source+test、contract JSON 2種(envelope-schema・exchange-examples)、reference-driver-sustained-drive.test、autonomous-frame-heart(+ overlay test)、input-subsystem(source+test)、reference-driver.mjs、_map.md。
- **untracked 新規 source = 2**: `slot-curve-state.ts`(Domain A)・`contract/channel-intent-envelope-payload-schema.json`(Domain B)。他 untracked は reviews/waves の docs のみ。
- **全て Domain A/B/C/D スコープ内。スコープ外ファイルは差分に一切現れない。**

### §8 無変更項目(自分で機械確認)

| 対象 | 確認方法 | 結果 |
|---|---|---|
| physiology/・golden 全4種・`headless-slot-resolver.ts`・Runtime Export schema・package-format | `git diff --name-only HEAD \| grep -iE physiology\|golden\|headless-slot-resolver\|runtime-export\|package-format` | **マッチ0(無変更)** |
| Editor ソース | 差分集合に Editor 配下なし | **無変更** |
| `pnpm-lock.yaml` | `git diff --quiet HEAD -- pnpm-lock.yaml` | **UNCHANGED**(exit 0) |
| `apps/soul/package.json` | `test -f` | **ABSENT**(不在) |
| 拒否コード列挙 | `channel-protocol-contract.ts` diff の enum 本体 grep | **6コード不変**。enum 配列に +/- 行なし。diff の追加はスコープ外を参照する JSDoc 2行(`slotValueOutOfRange`/`invalidPayload`/裁定4 明文化)のみ | 
| 実行時 role 分岐 | C5 source diff の追加行を `if (role\|role ===\|"cohost"\|"tracking"` で grep | **マッチ0(新規 role 分岐ゼロ)** |
| supportedKinds | `channel-protocol-contract.ts:32-35` | `["intent.set","intent.envelope"]` = **2 kind(外面)** |

拒否コード enum は `unknownKind`/`invalidPayload`/`unknownSlot`/`slotValueOutOfRange`/`slotNotWritable`/`channelClosed` の6件を実ファイルで目視確認(:54-59)。

---

## 3. 受け入れ基準§8 の全体充足(独立確認)

Domain D 報告§3 チェックリストを、各ドメインの実物(テスト緑・コード)に照らして独立に妥当性確認。機械で確認できる項目はすべて緑:

- **縦貫通・連続性 bound 導出**: store 層・心臓層の continuity property テストが緑(§1 の 855 pass に包含)。bound は `|amplitude|/durationMs × RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE(1.5) × frameIntervalMs`(Domain A 報告§5 + loop2 で re-attack/releaseAll を bound-walk 化)。マジックナンバー不在を Domain A 報告§5 とテスト構造で確認。
- **release 400ms・動く基底**: `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS=400`、release blend `lerp(livingBase(t), releaseFrom, w)`、切断→全スロット releaseAll。テスト緑。
- **単一機械/2 kind**: `slot-curve-state.ts` 単一機械・`supportedKinds` 2件(§2 で実ファイル確認)。
- **C4 後方互換**: set payload schema/型/rejections 無変更(git diff で set 系 schema に変化なし)、旧 set シナリオ維持。スナップ固定テストは release 挙動へ意図的置換(Domain A 報告§4 一覧)。
- **Stage 追従・無退行**: Domain C の追従テスト + C3 Stage テスト2件無変更通過(§1 の緑に包含)。
- **命名規律・拒否不増殖**: curve 系命名(§2)、拒否6件不変(§2)。

すべて機械ゲート緑と整合。矛盾なし。

---

## 4. 人間ゲート手順の正確性(実コードで独立検証・重要)

Domain D 報告§5 の手順を実コードで1つずつ照合。**すべて実行可能で正確**。

| 手順の記述 | 実コード | 一致 |
|---|---|---|
| 起動 `pnpm run dev` | `apps/runtime-player/package.json` scripts.dev = `electron-vite dev --watch` | **一致** |
| `Open Channel` ボタン | `channel-page.tsx:79-80` label="Open Channel" onClick=onOpenChannel | **一致** |
| 起動時 Closed | `channel-page.tsx:18` コメント「the Open/Close switch lives here (起動時Closed)」 | **一致** |
| `Open — no client connected` 状態 | `channel-page.tsx:175` | **一致** |
| Endpoint 行 + `Copy Channel URL` | `channel-page.tsx:87`(Endpoint)・`:91`(Copy Channel URL) | **一致** |
| `Connected (protocol 1)` | `channel-page.tsx:171` `Connected (protocol ${...})` | **一致** |
| port 動的 bind(`channel-bridge-handlers.ts:180`) | 同ファイル:180「The listening port is only known once the server binds」 | **一致(行番号も正確)** |
| ドライバ起動 `node apps/soul/reference-driver/reference-driver.mjs <url>` | reference-driver.mjs:76-80 usage(argv[2]=ws-url)・実パス一致 | **一致** |

### envelopePhase の振り付け(§7 6観察項目への紐づけ・実装照合)

`reference-driver.mjs:120-144` の `envelopePhase` を実読:

| # | 実装(reference-driver.mjs) | 報告§5.1 の記述 | §7 の目玉 |
|---|---|---|---|
| ① | `head-vertical` peak **0.6** / 60·120·90ms | head-vertical 表情ピーク | 目玉②(立上り→保持→減衰) |
| ② | `head-vertical` peak **-0.3**(符号反転)/ 60·120·90ms | 重ねがけ・-0.3 | 目玉③(現在値からの re-attack 連続性) |
| ③ | `body-x` peak **0.5** / 60·**400**·90ms(長 sustain) | body-x 持続駆動→生存中kill | 目玉④(魂殺し→release)・目玉⑤(Stage 追従) |

定数 `ENV_ATTACK_MS=60`/`ENV_SUSTAIN_MS=120`/`ENV_DECAY_MS=90`/`ENV_BODY_SUSTAIN_MS=400`(:52-55)と一致。フロー(:212-219)は envelopePhase を**接続1(`first`)で送信 → `first.close()` で意図的切断 → 再接続(`second`)**を実装しており、「body-x が生存中に kill(目玉④)」の記述と厳密一致(:217 コメント「body-x エンベロープが生存中に kill」)。振り付けは §7 の6観察項目に正しく紐づく。

### decay dip 注記・Channel ページ表示注記(実態照合)

- **decay dip(§5.2)**: `slot-curve-state.ts` の decay が base 非依存に peak→0(Domain A 報告§7-1・loop2§2 テスト4 `sawDipBelowBase` characterization で固定)。報告の「非零 base で一瞬 dip」は実装挙動と一致。美的裁定待ちの位置づけも正確。
- **Channel ページ表示(§5.3)**: `channel-page.tsx:185-190` の `formatEvent` は accepted イベントを **`✓ intent.set …` 固定文字列**で返す(:187)。accepted に kind を載せていないため envelope の accepted も「intent.set」表示。報告の「既知の表示ギャップ・退行ではない(envelope は C5 新規)」は実コードと一致。

---

## 5. docs 整合

- **c5-followup.md 4項目**: (1)decay 意味論 open 論点 = `sawDipBelowBase` 固定と一致(実コード確認済)、(2)peak 符号裁定 = validation 実装(負 peak は `slotValueOutOfRange` 担当)と一致、(3)Channel 表示ギャップ = formatEvent:187 と一致、(4)非blocking coverage 穴 = 記録として妥当。**4項目とも正確**。
- **wave 未 Closed の確認**: `c5-wave-plan.md:7` Status = **「Ready to launch」のまま**(Closed にされていない)。CLOSURE は L0 の領分で、Domain D は触れていない。**正しい**。
- **_map.md 更新**: waves/c5・reviews/c5 行を追加、進捗を「実装完了・機械ゲート緑・人間ゲート待ち(CLOSURE 判定は人間ゲート後に L0)」に更新。「855 pass/2 既知baseline fail」「次は人間ゲート」の記述が自分の観測と一致。**妥当**。
- **軽微コメント修正(`autonomous-frame-heart.ts` :186-190 付近)**: diff を実読。`latestStageMotionSignal` 宣言コメントの "sampled" → "effective (resolved)" への文言修正のみで、コード・型・シグネチャに変化なし。typecheck 緑(§1)で挙動無影響を確認。**Domain D の source 変更はこのコメント1行のみ**という報告と一致。

---

## 6. Subagent Contract(§9)全体遵守

- `pnpm install` 未実行 → lockfile **UNCHANGED**(§2)。
- `apps/soul/package.json` **ABSENT**(§2)。reference-driver.mjs は依存ゼロの standalone。
- ドメインロジック無改変(Domain D の source 変更はコメント1行のみ・§5)。
- Channel ページ表示を**直していない**(formatEvent:187 は固定文字列のまま・followup §3 に記録のみ)。
- 実行時 role 分岐追加ゼロ・拒否列挙不増殖(§2)。

---

## 7. 差分・要修正

**なし。** C5 全体は整合し、機械ゲートは再現、人間ゲート手順は実コードと一致、docs は正確。合否に影響する不一致は発見されなかった。

### 非blocking 所見(記録のみ・修正不要)

- **Domain A 報告§3 のパス誤記**: browser-source fail の1件を `src/stage/broadcast-source/browser-source-server.test.ts` と記すが、実パスは `src/main/broadcast-source/browser-source-server.test.ts`(自分の vitest 出力で確認)。**clean review 対象の Domain D 報告§1 は正しいパスを記載**しており、合否・人間ゲートに影響しない。Domain A 報告の軽微 typo として記録。

---

## 8. 質問

なし。C5 全体は clean review の全観点(機械再現・無変更・§8・人間ゲート手順・docs・§9)を満たす。**次は人間ゲート**(参照ドライバ実駆動プロファイル §7 の6項目。魂殺し→release の観察が目玉)。完全閉鎖(Status: Closed)判定は人間ゲート合格後に L0(Undine)が行う——Domain D はこれを正しく L0 に委ねている。
