# C5 Domain B レビュー（lane1: spec 適合）: 契約 intent.envelope additive + dispatch + 参照ドライバ拡張

> Review-Sylph（lane1=spec 適合）→ Orch-Sylph。読み取り専任（本レポート以外に source 変更なし）。
> 規範: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §3/§6/§8/§9/§10・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §2/§3.1/§7-4・[c5-planning-inventory.md](../../orchestration/c5-planning-inventory.md) §2.5/§2.6/§4。
> 実装報告（クロスチェック用・鵜呑みにせず自分で差分/テスト確認）: [domain-b-report.md](../../waves/c5/domain-b-report.md)。
> 対象は自分で `git diff HEAD` / Read / テスト実行で確認済み。

## 判定: **合格**

Domain B の契約 additive・validation・dispatch・参照ドライバ拡張は本wave規範に忠実。blocking 観点は全通過。peak 符号解釈は独立検証の結果 **Gnome の裁量は正しい**（下記）。要修正なし。Orch-Sylph へのエスカレーション（非blocking）が 2 件（B-3 の元delegation 矛盾の裁定確認、Channel ページ表示の Domain C 引き渡し）。

---

## spec 適合（blocking 観点ごと）

### 1. additive の忠実性（blocking）— PASS

- `intent.envelope` は additive に追加。`runtimePlayerControlChannelSupportedKinds = ["intent.set","intent.envelope"]`（`channel-protocol-contract.ts:31-34`）。hello は `createControlChannelServerHello` が同定数を載せるため**自動で 2 kind 告知**（メッセージ層無変更）。契約テストが `hello.payload.supportedKinds === ["intent.set","intent.envelope"] === happyPath例` を固定（`channel-protocol-contract.test.ts:57-70`）。
- **intent.set の byte-identical 不変を機械確認**:
  - set payload schema JSON（`channel-intent-set-payload-schema.json`）は `git diff --name-only HEAD` の変更一覧に**現れない**＝未変更。
  - set TS 型 `RuntimePlayerControlChannelIntentSetPayload`（`channel-protocol-contract.ts:115-121`）は diff 上で不変。envelope 型は末尾に追加のみ。
  - set validation（`validateControlChannelIntentSet`/`parseIntentSetPayload`/`parseTtlMs`、`channel-intent-validation.ts:60-139`）は diff 上で不変。envelope 用関数は新規追加のみで共用ヘルパ（`isRecord`/`isMappingSlotId`/`isSlotWritable`/`findSemanticSlotDefinition`）を触っていない。
  - dispatch の set 経路は `dispatchIntentSet` に抽出されたが**外形不変**（validation→accepted+overlay write）。既存 dispatch テスト群が無変更で通過（`channel-request-dispatch.test.ts` 10件 pass）。
- 古い魂（set のみ送る経路）は不変: hello は上位互換で 2 kind を告げるだけ、set の request/validation/write は byte-identical。参照ドライバの旧 4 相（gaze/tilt/resume/reconnect の set）は無変更で維持され全 accepted（持続駆動テストで実証）。
- 既存の `supportedKinds === ["intent.set"]` を固定していたアサーションは、設計どおりの additive 拡張として 2 kind に更新（退行でなく育成。裁定命名規律・inventory §2.5 準拠）。

### 2. 拒否は既存列挙（裁定4・blocking）— PASS

- 拒否コード列挙 `runtimePlayerControlChannelRejectionCodes`（`channel-protocol-contract.ts:53-60`）は**6 コードのまま無変更**（diff に現れない）。新コードゼロ。
- envelope の全不正が既存 4 コードに畳まれている（`channel-intent-validation.ts:171-235`）:
  - 非record / slotId 欠落・非文字列・空 / peak 非有限 / duration 非有限・負値 / 生存ゼロ（合計 <= 0）→ **invalidPayload**（`parseIntentEnvelopePayload`）。
  - slotId 語彙外 → **unknownSlot**。peak 域外（クランプ禁止）→ **slotValueOutOfRange**。書込不可 → **slotNotWritable**。
- 生存ゼロは `attackMs+sustainMs+decayMs <= 0` を parse で null 化して invalidPayload へ畳む（`channel-intent-validation.ts:294-297`）。escalate 不要という裁量は妥当（裁定4 の趣旨=語彙非増殖に合致）。

### 3. peak 符号解釈の妥当性（要重点確認）— **独立検証: PASS（Gnome の裁量は正しい）**

Gnome の解釈「peak の符号は域概念（centered slot -1..1）で `slotValueOutOfRange` の担当。負 peak を invalidPayload にしない」（報告§9-1）を、設計と intent.set 実装に照らして独立検証した。**正しい**と結論する。

- **intent.set との byte-parallel（決定的根拠）**: set の `parseIntentSetPayload` は **value の非有限のみ**を parse 拒否し（`channel-intent-validation.ts:113`）、符号は域チェック（`:72` `value < range.min || value > range.max` → slotValueOutOfRange）が担う。envelope の `parseIntentEnvelopePayload` は peak を**全く同型**に扱う（`:283-285` 非有限のみ拒否、`:207-215` 域チェック → slotValueOutOfRange）。**set の value と envelope の peak の符号扱いは完全に対称**。もし負 peak を invalidPayload にすると、envelope だけ set と非対称になり、set にできる「centered slot の負方向駆動」が envelope にできなくなる。
- **設計整合**: §2「粗い intent.set は契約に残る…両取り」・§3.1「連続性の双方向性（現在の実効値から双方向に立ち上がる）」は、envelope が set と同等の表現力（centered slot の -1..1 全域、負値含む）を持つことを要求する。負 peak を parse 拒否すると head-vertical を下向きに envelope できず、人間ゲート §7 目玉②③（表情ピーク・重ねがけ）が片側に潰れる。Gnome の解釈はこの表現力を保つ唯一の解。
- **裁定4 との整合**: 「形の不正=invalidPayload、値域=slotValueOutOfRange」（§7-4）を素直に適用すると、符号は**値域の一部**（域概念）であり slotValueOutOfRange 側。Gnome は delegation 文言 B-2「peak/attack/sustain/decay 負値→invalidPayload」のうち **負値-reject を duration（attack/sustain/decay）にのみ適用**し、peak の符号は域チェックに委ねた。これは裁定4 の正しい読み。
- **duration との非対称は意図的で正しい**: set の ttlMs は `exclusiveMinimum: 0`（value<=0 invalid、TTL は正でなければ無意味）。envelope の attack/sustain/decay は `minimum: 0`（value<0 invalid、0 は許容）。個別 duration が 0 でも合法（attackMs=0 = 即時 attack の退化ケース）で、生存ゼロは合計チェックが捕捉する。schema がこの差を正しく反映（`channel-intent-envelope-payload-schema.json:36-49` minimum:0 vs set schema exclusiveMinimum:0）。
- **双方向 envelope の end-to-end 実証**:
  - validation テスト: 負 peak -0.8 を centered slot で **accepted**（`channel-intent-validation.test.ts:209-219`）。域外 ±1.5 → slotValueOutOfRange（`:300-309`）。weight slot（mouth-smile）の負値 -0.1 → slotValueOutOfRange（域が 0..1 なので正しく域外、`:311-320`）。
  - 参照ドライバ: envelopePhase ②が `head-vertical` peak **-0.3**（符号反転の重ねがけ、`reference-driver.mjs:130-137`）→ 持続駆動テストで **11 accepted**（負 peak 込みで全受理）。
- **元 delegation の矛盾**: delegation 文 B-2 は「peak 負値→invalidPayload」と「peak 域外→slotValueOutOfRange」を**同時に要求しており内部矛盾**していた。これは実装の選択ミスではなく**spec source（delegation 文言）側の曖昧さ**。Gnome の解決は正しく、Orch-Sylph の暫定判断（妥当）を独立に追認する。→ 質問1 で Undine への裁定確認を推奨。

### 4. 命名規律 — PASS

- C5 payload schema は `channel-intent-envelope-payload-schema.json`（`$id: runtime-player/control-channel/intent-envelope-payload`）。C4 外殻封筒 `channel-envelope-schema.json`（`$id: .../envelope`、メッセージ封筒）と別ファイル・別 $id で分離。両者の "envelope" 衝突は schema description（`channel-intent-envelope-payload-schema.json:5`）と TS 型 docstring（`channel-protocol-contract.ts:133-136`）が明示注記。
- 実在語彙のみ使用。`brow.updown` は `apps/` 全体で **0 件**（grep 確認）。参照ドライバは `head-vertical`/`body-x`（実在 centered slot）で表情ピークを実演。payload schema の slotId enum は語彙レジストリ `runtimePlayerMappingSlotIds` と byte-identical（契約テスト `:47-58` が固定）。

### 5. 参照ドライバの証人性（§7 人間ゲート）— PASS

`reference-driver.mjs` の `envelopePhase`（接続1の切断直前、`:117-152`）が §7 の目玉を体現:
- **目玉②（表情ピーク）**: head-vertical peak 0.6 / 60·120·90ms — 滑らかに立ち上がり・保持・減衰（`:118-124`）。
- **目玉③（重ねがけ re-attack）**: 同一 head-vertical へ peak -0.3（符号反転）を連続送信 — 現在値からの re-attack の連続性を負 peak で双方向実証（`:125-137`）。
- **目玉④（魂殺し=envelope 生存中の切断）**: body-x peak 0.5 / 長 sustain 400ms（`:138-145`）→ 直後に `first.close()`（`:216`）で **body-x envelope が生存中に切断** → サーバ `releaseAll`（Domain A）で全スロット同時 release。
- **旧 set 4 相の維持**: gaze/tilt/resume/reconnect は無変更で残り additive 共存を実証。
- **`expectedKinds` の 2 kind 自己照合**: hello の supportedKinds が両 kind を含むか `connect()` で検証（`:379-386`。missing があれば throw）。expectedKinds は contract-json 経路（happyPath hello から読取、`:287-291`）と fallback 経路（`:302-306`）の両方で `["intent.set","intent.envelope"]`。

### 6. 責務境界（§3.2）— PASS（1 件の非blocking スコープ観察あり）

- Domain B は Domain A の store 曲線ロジックを変更していない。`control-channel-overlay-store.ts`/`slot-curve-state.ts`（Domain A の成果、untracked/変更）に対し Domain B は `setEnvelope`/`releaseAll`/`snapshot` を**呼ぶだけ**。曲線評価・release 実装は Domain A のまま。
- Domain C の Stage snapshot（`autonomous-frame-heart.ts` の snapshot 位置）を変更していない。heart の変更は Domain A のもので Domain B は heart を触っていない。
- `apps/soul` にシナリオ拡張以外の持ち込みなし: package.json 不在（`ls apps/soul` = README.md + reference-driver のみ）、依存追加なし（readFileSync の契約読取のみ）。
- **非blocking スコープ観察**: `channel-server.ts:196/:332` の `clearAll` → `releaseAll(this.#nowMs())` 置換（切断/close 時の release一般化）は、inventory §2.3 上 release一般化の一部で Domain A 寄りの概念だが、実装は server の呼び出し箇所（Domain B のレビュー対象ファイル内）。§2.3「切断→全スロット同時release・即時スナップ排除」に spec 適合しており問題なし。Domain A の `releaseAll` API を呼ぶだけで曲線ロジックは触っていない。

### 7. Subagent Contract（§9）— PASS（git 機械確認）

- 禁止ゾーンへの touch **ゼロ**: `git diff --name-only HEAD -- '*physiology*' '*headless-slot-resolver*' 'pnpm-lock.yaml' '*package.json' '**/runtime-export*' '*package-format*' 'apps/editor/**'` = 空。
- lockfile 無変更（`pnpm install` 未実行・回避工作なし）。`apps/soul/package.json` 不在（standalone `.mjs`）。
- 実行時 role 分岐の新設なし。accepted イベントの `value`（=魂自身が送った peak、`channel-server.ts:314`）以外に renderer へ秘匿/シード/raw スロットを流していない。
- soul zone boundary guard: **passed**（1244 files、器→魂/魂→器 の code import なし）。

---

## 差分・要修正

**なし**（spec レーンの blocking/非blocking 観点で修正要求なし）。

---

## 裁量判断の妥当性（報告§9 の 4 件）

1. **peak 符号=域概念（§9-1）**: **妥当（独立検証済み）**。上記 spec 適合 §3 の通り、intent.set の value と byte-parallel・設計§2/§3.1 の双方向表現力・裁定4 の域/形分類のいずれにも整合。負 peak -0.3 が end-to-end で accepted。元 delegation 文言の内部矛盾を正しく解消した実装。**唯一の付帯事項**は spec source 側（delegation B-2）の矛盾で、実装ではなく裁定文言の訂正が望ましい（質問1）。
2. **生存ゼロ→invalidPayload（§9-2）**: **妥当**。裁定4 通り既存コードに畳めた。新コード不要。
3. **envelope write の時刻非対称（§9-3）**: **妥当**。overlay write は絶対 `expiresAtMs` を dispatch が計算、envelope write は spec のみでサーバが `setEnvelope(…, this.#nowMs())` に受理時刻を渡す（`channel-server.ts:305-311`）。曲線 store が自時計を持つ Domain A 設計に整合し、dispatch を純粋（絶対時刻フリー）に保つ。テスト容易性も担保。
4. **Channel ページ accepted 表示（§9-4）**: スコープ判断は **妥当**。`channel-page.tsx:187` の `formatEvent` は accepted を `"✓ intent.set …"` と**固定表示**（accepted イベントに kind を載せていないため envelope も「intent.set」と誤表示）。`channel-page.tsx` は Domain B の変更対象外（diff に無し）で、退行ではない（envelope は新規）。Domain C（Channel ページ配線）へ正しく引き渡した。→ 質問2 で Domain C/D の対応を確認推奨。

---

## テスト結果（自分で実行）

環境: Windows/PowerShell、`pnpm install` 不使用・既存 node_modules。

- **Domain B 対象**: `npx vitest run -c vitest.config.ts channel-protocol-contract channel-intent-validation channel-request-dispatch channel-server reference-driver-sustained-drive` → **59 passed / 6 files**（contract 12 / validation 25 / dispatch 10 / server 9 / server-events 2 / reference-driver-sustained-drive 1）。報告の「58 + 1」と一致。参照ドライバは外部プロセスで contractSource=contract-json・11 accepted・RTT p95<100ms を自己照合して pass。
- **typecheck**: `npx tsc --noEmit` → **pass（exit 0）**。
- **soul zone boundary**: `node scripts/check-soul-zone-boundary.mjs` → **passed（1244 files）**。
- **既知baseline 分離**: 全体スイート（854 passed / 2 failed）は本レーンで再実行していないが、fail 2 件は Wave21 `browser-source` 系（`browser-source-server.test.ts` 他）で Domain B の変更対象外。当該ファイルは `git diff --name-only HEAD` に現れず（未touch 機械確認済み）、報告の baseline 分離主張は整合。

---

## 質問（Orch-Sylph 経由・非blocking）

1. **delegation B-2 の内部矛盾の裁定確認**: 本 Domain B delegation B-2 は「peak …**負値**→invalidPayload」と「peak が正規化域外→slotValueOutOfRange」を同時要求しており、centered slot（-1..1）では両立不能だった。Gnome は負値-reject を duration に限定し peak 符号を域チェックへ委ねる解釈で解消（設計・set と整合、独立検証で正しいと確認）。これは実装選択ではなく **spec source 側の曖昧さ**なので、Undine による裁定文言の追認・訂正を推奨（将来の delegation/契約ドキュメントの一貫性のため）。**本 Domain B の合否には影響しない**（実装は正しい）。
2. **Channel ページ表示の Domain C 引き渡し**: envelope の accepted が `channel-page.tsx:187` で「intent.set」と誤表示される（accepted イベントが kind 非搭載）。Domain B スコープ外（正しく Domain C へ委譲）。Domain C/D で accepted イベントに kind を additive 追加、または表示を kind 非依存化する対応が入るか、Orch-Sylph の確認を推奨。人間ゲート §7 の目視は画面のリグ挙動が主で表示文字列は副次のため、C5 合否の本体には影響しないが、証人シナリオの観察補助としては直しておく価値あり。
