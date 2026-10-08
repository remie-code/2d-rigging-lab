# C3 Domain C レビュー(レーン2: design / development)

> Review-Sylph、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> 判定基準: Gnome 実装報告 `waves/c3/domain-c-physiology-page-profile.md`、Domain A/B 報告、`c3-planning-inventory.md` §2.3-2.5、`c3-wave-plan.md` §4.3/§6/§9。
> 方式: 対象ファイルを自分で読み、複製元 Dynamics Tune と突き合わせて検証。テストは再実行していない(コード読解ベース)。

## 判定: 要修正

設計・実装品質は全体として堅牢で、provider 参照契約・availability の data 表現・並列複製・stale/parse・additive・sanitization はいずれも設計意図どおり成立している。ただし **Stage Presence の Strength スライダーが機能しない(実行時に必ず validation-error になり、値を書き込めない)** 確定バグが1件あり、これは Domain C 自身のスコープ(config フィールドの設定・永続化)の欠落であるため 要修正 とする。それ以外は合格。

---

## 要修正(確定バグ)

### F1. Stage Presence Strength スライダーが state 側で拒否される — UI から strength を設定・永続化できない

**症状(実行時)**: Physiology ページの Stage Presence「Strength」スライダーをドラッグすると、main が `Error: Physiology section stagePresence has no tone sliders.` を投げ、bridge が `validation-error` を返す。strength override は一切書き込まれず、既定 0.3 のまま固定され、プロファイルにも保存されない。Domain D が読む `stagePresence.strength` は永久に既定値のままになる。

**経路(file:line)**:
- `control/physiology-page.tsx:288-294` — Strength スライダーが `onUpdateTone({ section: "stagePresence", field: "strength", tone })` を発火(汎用 tone 経路)。
- `preload/physiology-bridge-request-validation.ts:8-14,56-62` — `readSection` は `stagePresence` を許可(`PHYSIOLOGY_SECTION_IDS` に含む)、`field="strength"` も通過。バリデーションは素通り。
- `main/physiology-bridge-handlers.ts:107-120` — `updateTone` ハンドラが `physiologyState.updateTone(command)` を呼ぶ。
- `main/physiology-profiles/physiology-state.ts:132-149,403-415` — `updateTone` → `assertNumericField` が `NUMERIC_SECTION_IDS`(=`{blink,gaze,head,posture}`、`stagePresence` を含まない)で **throw**。

つまり strength は `updateTone` 経路で必ず弾かれるのに、state には strength を書く別メソッドが存在しない(`setStagePresenceEnabled` は enabled のみを書く。`physiology-state.ts:151-164`)。strength override が生まれ得るのはプロファイル読込時(`applyProfileLoadResult` → `this.overrides = loadResult.profile.overrides`)だけで、**アプリ実行中に override を作る手段がない**。

**なぜテストが緑なのに漏れたか(テスト間のマスキング)**:
- `physiology-page.test.ts:128-133` は `onUpdateTone` が `{section:"stagePresence",field:"strength",tone:0.4}` で呼ばれることのみを `vi.fn()` で検証 → 実 state に到達しない。
- `physiology-state.test.ts` の stagePresence テスト(133-148)は enabled トグルのみ。`updateTone` に `section:"stagePresence"` を渡すケースが無い。
- 両者を繋ぐ integration/handler テストが strength について無いため、UI 側の「発火する」と state 側の「拒否する」が別々に緑になり、機能欠落が露見しない。

**修正指針(実装は Gnome へ)**: 次のいずれか。
- (A) 推奨 — enabled と対称に **`setStagePresenceStrength(strength)` を新設**(state のメソッド + `physiology-bridge-channels.ts` に channel + validation `readPhysiologyStagePresenceStrengthRequest` + `physiology-bridge-contract.ts` の API + `physiology-page.tsx` の Strength スライダーの dispatch 差し替え + `control-window-app.tsx` の配線)。state 側は `this.overrides = { ...this.overrides, stagePresence: { ...this.overrides.stagePresence, strength: clampUnit(strength) } }` として `bumpRevision()`。`setStagePresenceEnabled` と同型でマージ挙動も一致。
- (B) 最小 — state の `updateTone` で `section==="stagePresence" && field==="strength"` を特別扱いし `overrides.stagePresence.strength` にマージ(`assertNumericField` の前で分岐)。バリデーション/契約/UI は現状のまま流用できるが、`assertNumericField` の意味論と衝突するので分岐が読みにくくなる。(A) の方が既存 enabled 経路と対称で保守的。
- いずれの場合も **回帰テストを追加**: state で `updateTone`/新メソッド経由の strength 書込→`getStatus().sections(stagePresence).tones.strength` と `getPhysiologyConfig().stagePresence.strength` に反映、`sectionHasOverride` が true、reset で復帰。可能なら bridge-handlers でスライダー→state→status の一気通貫を1本。

---

## 合格した観点(検証済み)

### 1. provider 参照契約(核) — 合格
`physiology-state.ts:289-295` `getPhysiologyConfig()` は revision キャッシュ(`cachedConfig`/`cachedConfigRevision`)。override 変化=`bumpRevision()`(全 mutating op が呼ぶ: updateTone/setStagePresenceEnabled/resetSection/setRuntimeExportPayload/clearRuntimeExport)まで **同一参照**、変化時のみ `physiologyOverridesToConfig` で **新オブジェクト**。revision 初期 0 / cache 初期 -1 で初回は必ず構築。`physiology-state.test.ts:33-59` が `toBe`/`not.toBe` を固定。既定(空 override)は常にフル4系統 + stagePresence を返す(`physiology-tone-config.ts:232-249`、test:41-45)。heart の参照比較再構築(Domain A)がそのまま噛む前提を満たす。

### 2. 生理有無の data 表現 + 順序解決 — 合格
`input-subsystem.ts:40,148-150,199-202` で `providesPhysiology: boolean` を `usesTrackingInput` と同列の data marker として追加(static=true / tracking=false)。role 問い合わせなし。`runtime-player-main.ts:428-431` で state を compose **前**に生成し `isAvailable: () => physiologyAvailable`(遅延 getter)を注入、`:465` で compose **後**に `physiologyAvailable = inputSubsystem.providesPhysiology` を確定。`getStatus()` は呼出時に `isAvailable()` を評価(`:298`)するので順序は正しく解決され、role 分岐に化けていない。bridge は両ロールで無条件登録(`:466`)、renderer は `status.available` で空状態②へ分岐(`physiology-page.tsx:158-167`)。

### 3. 並列複製の質 — 合格
store/save-controller/state は Dynamics Tune の型を忠実に写しつつ、stale を単純化(`dynamicsSignatureHash` / `parameterSignatureHash` 不使用、identity = fingerprint + schemaVersion のみ)。`physiology-export-identity.ts` は `createSafePackageId` を再利用しつつ model 非依存の fingerprint(packageHash 由来、無ければ packageId+revision フォールバック)。save-controller の debounce/flush/saveNow は Dynamics 流儀と一致(maxFlushPasses、pendingSave 直列化、saved 後の再スケジュール)。共通化を避けた 裁定4 は妥当(stale 意味論が異なるため無理な抽象化より写経が保守的)。

### 4. stale/parse の堅牢性 — 合格
schemaVersion 不一致 → parser が `ok:false`(`physiology-profile-parser.ts:39-44`)→ store `read-failed`。fingerprint identity 不一致 → store reject(`physiology-profile-store.ts:135-145,172-179`)。corrupt JSON → `read-failed`(`:109-121`)。二 export/二スロット独立は `physiology-profile-store.test.ts:117-163` で構造的に成立(fingerprint パス分離 + userData ルート分離)。state 側 `applyProfileLoadResult`(`physiology-state.ts:352-395`)は schema 由来なら "stale"、他 read-failed は "load-warning"、いずれもツマミは普遍既定へフォールバックし黙って適用しない。
- 注記(非ブロッキング): stale と load-warning の区別が `warningMessages.some(m => m.includes("schema version"))` という文字列一致に依存(`:367-369`)。表示ラベルの分岐にのみ影響し、フォールバック挙動自体は同一なので load-bearing ではないが、将来メッセージ文言を変えると分類が崩れる脆さがある。定数化 or parser 側で reject 種別を enum で返す方が堅い(任意)。

### 5. stagePresence additive — 合格
`physiology-config.ts:77-84` で `stagePresence?` を optional 追加、`PhysiologyStagePresenceConfig` 型を追加。`DEFAULT_PHYSIOLOGY_CONFIG`(blink-only)/`DEFAULT_FULL_PHYSIOLOGY_CONFIG`(4系統)いずれも stagePresence を持たず不変(`:88-106`)。behavior fan-out `createPhysiologyBehaviorsFromConfig`(`:147-172`)は stagePresence を完全に無視。よって Domain A/B テスト・blink golden に触れない purely additive。provider が生成する config には stagePresence が常に載る(`physiology-tone-config.ts:241-247`)が、これは provider の config でありDEFAULT 群でも fan-out 対象でもないため無影響。

### 6. sanitization / 純度 — 合格
`physiology-tone-config.ts` は Electron/時計/乱数なしの純データ変換(anchoredLerp/clamp のみ)。bridge が renderer へ渡す `PhysiologyStatus` は質感語 tone・section id・profileStatus・runtimeExport の公開メタ(packageId/revision/modelDisplayName/loadedAtIso、Dynamics と同等)のみで、シード・raw スロット・`profileFilePath` 等の私的パスは main に留まる。永続化3部品のうち store が fs、save-controller が Date を持ち、純粋層(tone-config/parser)から分離。

### 7. 既存退行 — 合格(コード読解による)
`runtime-player-main.ts:479-546` の runtime export lifecycle(changing/loaded/cleared)と quit flush に physiology を Dynamics と並列に配線(flush → clear → publishStatus)。debounce/flush 経路は Dynamics 同型。Dynamics Tune 本体・既存 bridge 群・control-window-app の他ページには手を入れていない(physiology は追加のみ、diagnostics 除外は `control-window-app.tsx:675` の union 追加1点)。報告の baseline 2件(browser-source-server)は本 Domain 対象外・untouched。テスト再実行はしていないため退行「なし」はコード読解の範囲での確認。

### 8. 拡張性・単純化 — 合格(ただし F1 が申し送りを機能的に未完成にする)
Domain D への申し送り(`PhysiologyConfig.stagePresence: {enabled, strength}` を provider config から読む)は型・配線として構造的に成立。ただし **F1 のため strength は実行時に既定 0.3 から動かせない** ので、F1 を直すまで Domain D は「ユーザーが変更できない strength」を読むことになる(申し送りは構造的には成立、機能的には未完成)。デッドコード・不要な重複は見当たらない。

---

---

## F1 再確認(ループ2回目、2026-07-11)

> Gnome の F1 修正(state 一点の最小修正、私の推奨とは別アプローチ)を実ファイルで軽量再確認。**判定: 合格(F1 解消・退行なし)。**

Gnome は私が推奨した専用 `setStagePresenceStrength`(state+channel+contract+bridge+dispatch)ではなく、**strength を既存の汎用 tone 経路に統一する state 一点修正**を採用。結論として、この選択は私の推奨より API 表面が小さく、strength を他 tone スライダーと同一経路に揃える点でむしろ好ましい。指摘は正しく解消され、新たな退行はない。

### 検証結果(6観点すべて合格)
1. **F1 解消 — 合格**: `physiology-state.ts:127-153` の `updateTone` が受け口を `assertNumericField`→`assertToneField`(`:407-418`)へ緩和。`PHYSIOLOGY_SECTION_TONE_FIELDS["stagePresence"]=["strength"]` なので strength を許可し、stagePresence 分岐(`:134-142`)が `{ ...this.overrides.stagePresence, strength: tone }` を書いて `bumpRevision()`。既存の `physiologyOverridesToConfig`/`resolveEffectiveSectionTones`/`sectionHasOverride`/`resetSection` は無改修で strength を扱うため、`getStatus`→`getPhysiologyConfig`・debounce 自動保存・restore・Reset すべてに strength が乗る。以前の validation-error は消えた。
2. **受け口緩和の安全性 — 合格**: `assertToneField` は `PHYSIOLOGY_SECTION_TONE_FIELDS[section].includes(field)` のみ。緩和されたのは「stagePresence を categorically 拒否していた」1点だけで、各 section の field ホワイトリストは維持。blink/gaze/head/posture は緩和前と同一(未知 field は従来どおり拒否)。`updateTone({section:"blink",field:"strength"})` も `updateTone({section:"stagePresence",field:"enabled"})` も per-section リストで弾かれる。PhysiologySectionId 5種すべてに配列エントリがあり `[section]` は undefined にならない。意図しない field 書込・範囲逸脱なし。
3. **enabled/strength 独立性 — 合格**: stagePresence 分岐は `...this.overrides.stagePresence` を spread してから strength を上書き(enabled 保存)、`setStagePresenceEnabled`(`:155-168`)は逆に strength 保存。`physiology-state.test.ts:160-176` が `{enabled:true, strength:0.6}` の共存と Reset 両者復帰を固定。片方更新が他方を消さない。
4. **provider 参照契約の維持 — 合格**: strength 変化も `bumpRevision()` を通るので revision キャッシュがミス→新オブジェクト。`physiology-state.test.ts:154-157` が strength 変更で `not.toBe(before)` かつ以後安定を固定。heart 再構築前提を保つ。
5. **退行なし — 合格**: 変更は `updateTone` の分岐追加と `assertNumericField→assertToneField` 改名・`NUMERIC_SECTION_IDS` 削除に局所化。非 stagePresence section は else 枝(`readNumericFamily`/`writeNumericFamily`)で従来と完全同一。tone-config/config/fan-out/golden・Domain A/B・Dynamics Tune は不変。
6. **追加テストの実効性 — 合格(マスク穴を実際に塞ぐ)**:
   - `physiology-bridge-handlers.test.ts:118-143` — **実 `RuntimePlayerPhysiologyState`** を bridge 経由でページの実リクエスト形 `{section:"stagePresence",field:"strength",tone:0.7}` で駆動し、`result==="ok"`(非 validation-error)+ `getPhysiologyConfig().stagePresence.strength===0.7` を固定。**旧バグコードなら validation-error で必ず落ちる** → UI 発火と state 拒否が別々に緑になっていた穴を直接塞ぐ。モックでなく実 state を使っている点を確認済み。
   - `:145-185` debounce coalescing — `CountingPhysiologyProfileStore` で窓内3 edit→`saveCount===1`・最終値のみ保存。edit 毎 save 実装を落とせる。
   - `:187-201` 未知 section→validation-error(受け口 gate の維持)。
   - `physiology-state.test.ts:133-176` — F1 回帰(state 書込→config 反映+参照契約)・enabled/strength 独立・Reset 復帰。

### 注記(非ブロッキング)
- 未知 **field(有効 section 内)** が `assertToneField` で拒否されるパスは新規テストの明示対象ではない(未知 **section** は `:187-201` でカバー)。ロジックは自明・低リスクで blocker ではないが、厳密には `updateTone({section:"stagePresence",field:"enabled",tone:1})` 等の拒否を1本足すと per-section field gating の意図がテストで固定される(任意)。

---

## 質問(Orch-Sylph へ)
- F1 について: Strength スライダーを Domain C で機能させる(設定・永続化する)前提で合っているか確認したい。報告 §2.5「UI + config フィールドはここ、駆動は Domain D」および page テスト(strength を dispatch する期待)から **Domain C で書込・永続まで担うのが意図** と解釈し 要修正 とした。もし「Domain C ではスライダーを置くだけで値の書込は Domain D」という設計なら、その場合でも現状はドラッグで validation-error を出す(無害な no-op ですらない)ため、少なくとも「Domain D 未実装の間は disabled にする」等の対処は必要。意図の確認を求む。
