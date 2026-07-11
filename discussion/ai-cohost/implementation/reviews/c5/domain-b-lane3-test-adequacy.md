# C5 Domain B レビュー（lane3: test adequacy）: 契約 `intent.envelope` + dispatch + 参照ドライバ

> Review-Sylph（test adequacy レーン）→ Orch-Sylph。読み取り専任（本レポート以外の source 変更なし）。
> 規範: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §6/§8/§10 ・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §2/§5/§7 ・[domain-b-report.md](../../waves/c5/domain-b-report.md)。
> 検証は Gnome 報告を鵜呑みにせず、テストコード・git diff・実行結果を自分で確認した。

## 判定: **合格**

テストは「通ればよい」でなく「正しい性質を証明」している。blocking の三目玉（additive の機械実証・拒否マッピング網羅・持続駆動 envelope 観測）はいずれも実コード/実行で担保を確認した。要修正なし。

---

## test 適合（blocking 観点ごと）

### 1. schema/型/validation の三者同期（byte-sync） — 合格
`channel-protocol-contract.test.ts`（12 tests）が実際に byte-sync を検証:
- envelope schema `slotId.enum` == `runtimePlayerMappingSlotIds` == set schema enum（`toStrictEqual` 三重、L47-59）。TS 語彙と JSON の齟齬を検知できる。
- envelope schema `normalizedRanges` == set schema == `semanticSlotNormalizedRange()` TS 分類器（L144-179）。orphan/欠落 sourceKind も `sourceKindsInUse` 集合突合で落ちる。
- hello == `["intent.set","intent.envelope"]` == happyPath 例の messages[0]（strict、L61-70）。**2 kind の等価**を機械化。
- `envelopePath` 例の request parse（`parseControlChannelRequestEnvelope`）+ accepted builder 一致（L72-108）。
- rejection codes は byte 無変更を `toStrictEqual` で固定（L33-38, 121-141）。

### 2. 拒否マッピングの網羅（blocking） — 合格
`channel-intent-validation.test.ts` の `validateControlChannelIntentEnvelope` describe が報告§3 の各不正を**1件ずつ**カバー:
- invalidPayload: 非オブジェクト（L231）/ slotId 欠落・非文字列・空 `["",42,undefined]`（L280）/ peak 非有限 `["high",NaN,+Inf,null,undefined]`（L240）/ duration 非有限・非数値（L257）/ **負 duration `-1`**（L257 の badDurations に含む、3 duration キー全てで反復）/ 生存ゼロ `attack+sustain+decay=0`（L271）。
- unknownSlot: `left-elbow`（L291）。
- slotValueOutOfRange（クランプ無し）: centered `[1.5,-1.5]`（**正負両側**、L300）+ weight-slot `[1.2,-0.1]`（負も域外、L311）。
- slotNotWritable: disabled/untargeted（L322）+ モデル未ロード null（L331）。

**新コード無しの担保**: source `channel-intent-validation.ts` は `invalidPayload/unknownSlot/slotValueOutOfRange/slotNotWritable` の既存4コードのみ返す（`channelClosed/unknownKind` は dispatch 層）。加えて `contract/channel-protocol-contract.ts` の `runtimePlayerControlChannelRejectionCodes` 配列は git diff で byte 無変更（追加は `supportedKinds` の `intent.envelope` のみ）。裁定4 遵守を機械確認。

### 3. peak 符号のテスト — 合格
- 負 peak `-0.8` が centered slot で**正当に accepted**（`invalidPayload` でない、L209-219）。双方向 envelope の accepted 証拠。
- 範囲外の負 `-1.5` が `slotValueOutOfRange`（L300）。
両方向がテストされ、source（`parseIntentEnvelopePayload` は符号を parse で拒否せず、域は `slotValueOutOfRange` 担当）と整合。**本 lane 委任 §3 の解釈（負 peak accepted・< -1 は域外）に一致**しており、報告§9 裁量1 の懸念は委任基準どおりに解消済み（新たな escalate 不要）。

### 4. dispatch のテスト — 合格
`channel-request-dispatch.test.ts`（10 tests）が分岐ごとに検証:
- envelope accepted → `envelope` write（`overlay` は undefined、L157-179）。
- envelope 拒否 → `envelope` 無し（zeroLife=invalidPayload / peak=5=slotValueOutOfRange、L181-213）。
- not accepting → `channelClosed`（kind 非依存ゲート、L215-231）。
- **set 経路の既存テストは無変更で通過**: git diff 上、当ファイルの削除行ゼロ（req-1〜req-6 の set テストは byte 保持、envelope テストは純追加）。

### 5. additive の機械実証（blocking） — 合格（強い証拠）
- `channel-intent-validation.test.ts`: 差分は import 行 1 行のみ（`validateControlChannelIntentEnvelope` 追加）。**set describe の削除・改変ゼロ**。
- `channel-request-dispatch.test.ts` / `channel-server-events.test.ts`: **削除行ゼロ**（envelope は純追加）。
- `channel-server.test.ts`: 変更は (a) hello 2 kind（additive）、(b) C5 §2.3 の release 意図的置換（C4 即時スナップ → release blend。コメントに理由明記、Domain A の release 一般化に由来）、(c) envelope e2e 追加のみ。set の setOverlay 経路の挙動は保持。
- 古い魂互換（hello 上位互換で 2 kind を告げるだけ・set の request/validation/write は byte-identical）を参照ドライバの旧 4 相（set）が無変更で全 accepted、で実証（§6 テスト）。

### 6. 持続駆動の envelope 観測（blocking） — 合格（強い証拠、自分で実行 pass）
`reference-driver-sustained-drive.test.ts`（1 test、実行 1.5s pass）が observe:
- `intentCount`/`acceptedCount`/`rttMs.count` = **11**、`rejectedCount` 0（L239-246）。
- **envelope ピークがフレームに出た**: body-x（peak 0.5→+15）が `≥5` フレーム多数（L271-274）、head-vertical（peak 0.6→+18）が `|ParamAngleY|≥5`（L275-278）。generator 出力ゼロのスロットなので envelope 経由の縦貫通の一意証拠。
- **release 中の中間値（曲線=非スナップ）**: body-x に `0.1<v<14` の中間フレーム（attack ramp + mid-kill 後の release ease、L284-288）。目玉②/④の機械証人。
- **切断後 base 復帰**: head-horizontal / body-x / head-vertical 全て最終フレーム 0（L292-294）。
- フレーム停滞なし（sequence 単調増加 + 前進 >20、L251-257）・RTT p95 < 100ms（envelope 込み、L247）。
- 契約自己照合: `contractSource === "contract-json"`（L243）。ドライバは hello example 由来の `expectedKinds`（= 2 kind、contract test が strict 等価で担保）を hello が包含するか照合。envelope slot（head-vertical/body-x）も `scenarioSlotIds` で語彙自己照合。

### 7. カバレッジの穴 — 実害なし（下記いずれも非 blocking）
- envelope validation test に、set test の「writable だが現行マッピングに slotId 不在 → slotNotWritable」ケース（set L174）が無い（disabled + null のみ）。ただし `isSlotWritable` は set と共用で当該ケースは set test がカバー済み。envelope 固有ロジックではない。
- 参照ドライバ `loadContract()` は set payload schema と hello example のみ `readFileSync`、envelope payload schema は読まない。`expectedKinds` は hello example 由来のため 2 kind 検証は成立するが、ドライバ自身のチェックは「hello ⊇ expectedKinds」の superset 判定（strict 等価でない）。2 kind の strict 等価は contract test が担保しているため byte-sync は機械化済み。
- delegation §7 の他経路（envelope→set 切替・set→envelope re-attack）はスロット曲線状態機械（Domain A）の連続性責務であり、Domain B の dispatch/validation の関心外。mid-kill タイミングは持続駆動テストが観測済み。Domain B としての穴ではない。

### 8. 決定論性 — 合格
validation/dispatch/contract fixture は時刻/乱数非依存。持続駆動テストは実時計だが `phaseScale` で時間圧縮 + 緩い閾値（RTT p95<100ms・前進>20）で flaky 耐性。port 0（ephemeral）で競合回避。

---

## 差分・要修正
なし。

---

## テスト結果（自分で実行）
Windows/PowerShell、`pnpm install` 不使用（既存 node_modules）。
- `npx vitest run -c vitest.config.ts channel-protocol-contract channel-intent-validation channel-request-dispatch channel-server` → **58 passed / 5 files**（contract 12 / validation 25 / dispatch 10 / server 9 / server-events 2）。
- `npx vitest run -c vitest.config.ts reference-driver-sustained-drive` → **1 passed**（外部プロセス参照ドライバ contractSource=contract-json / 11 accepted / RTT p95<100ms 経由）。
- 全 runtime-player `npx vitest run -c vitest.config.ts` → **854 passed / 2 failed / 136 files**。
- `node scripts/check-soul-zone-boundary.mjs`（repo root から）→ **passed**（1244 files, 器↔魂 code import なし）。

**既知 baseline fail の分離（Domain B 責任外）**: 失敗 2 件は
- `src/main/broadcast-source/browser-source-server.test.ts`
- `src/stage/browser-source/browser-source-server-message.test.ts`
の Wave21 browser-source 系 schema drift。wave plan §8/委任の「既知 baseline = Wave21 browser-source 系2件」に一致。当該ファイルは Domain B 差分に含まれず（git diff 未出現）、新規 fail の混入なし。

（注: 報告§7 は soul-zone スクリプトを `apps/runtime-player` からの相対で記載していたが、実体は repo root の `scripts/check-soul-zone-boundary.mjs`。root から実行して pass 確認。無害な記載差。）

---

## 質問
なし。lane3 test adequacy の観点では合格。peak 符号の解釈は本 lane 委任基準と一致するため escalate 対象ではないが、Domain B 報告§9-4 が指摘する Channel ページ accepted 表示の kind 非依存化（envelope が「intent.set」と表示される件）は Domain C/D の表示配線の課題であり、test adequacy レーンの blocking ではない（観察として Orch-Sylph へ申し送り）。
