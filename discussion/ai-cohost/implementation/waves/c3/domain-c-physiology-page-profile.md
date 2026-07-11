# C3 Domain C 実装報告: `cohost-c3-physiology-page-profile`

> 実装: Gnome(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> source of truth: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §4.3/§6/§9、[c3-physiology-profile.md](../../screens/c3-physiology-profile.md)(全面)、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §6、[c3-planning-inventory.md](../../orchestration/c3-planning-inventory.md) §2.3/§2.4/§2.5、Domain A [§6 申し送り](domain-a-noise-and-config-seam.md)・Domain B [§4/§8 Q1](domain-b-gaze-head-posture-behaviors.md)。
> Status: 実装完了・対象テスト/typecheck パス・blink golden 2本不変・Domain A/B 不変。escalate なし。質問なし。

---

## 1. 要約

Domain C 全スコープを実装した: 永続化3部品(store / state / save-controller の並列複製)+ 質感語→内部素子写像(範囲正規化込み)+ Physiology bridge(両ロール登録・生理有無を data)+ Physiologyページ(5セクション・空状態2つ)+ provider 配線(runtime-player-main 1行 + subsystem の `providesPhysiology` data marker)。Domain A の config seam(`physiologyConfigProvider`)の供給源を実 Physiology state に差し替え、autonomousHost が **設定なしで視線・頭・姿勢が生きる**(既定 = `DEFAULT_FULL_PHYSIOLOGY_CONFIG` 土台)。実行時 `if(role===)` 分岐ゼロ。blink golden 2本・Domain A/B テスト・Dynamics Tune(Wave21)は不変。

## 2. 設計判断

### 2.1 永続化3部品の並列複製 + stale 意味論の単純化(裁定4)
`apps/runtime-player/src/main/physiology-profiles/` に Dynamics Tune の型を**写して**新設(共通化しない):
- **store** (`physiology-profile-store.ts`): fingerprint パス `<userData>/physiology-profiles/<safePackageId>/<fingerprint>.json`。load 状態 missing/loaded/read-failed。userData は `runtime-player-main.ts:129` でスロット配下へリダイレクト済み → 構造でスロット内配置(UX §4)。
- **save-controller** (`physiology-profile-save-controller.ts`): debounce 既定750ms・scheduleSave/flush/saveNow。**Saveボタン無し**(自動保存のみ)。Dynamics の debounce/flush ロジックを形どおりコピー。
- **state** (`physiology-state.ts`): revision 追跡・tone override map・profileStatus(default/restored/stale/unsaved/saving/saved/save-failed/load-warning/unavailable)。
- **stale の単純化(裁定4)**: Physiology のツマミは**モデル非依存の普遍語彙**なので `dynamicsSignatureHash` 相当は**不要**。identity = **export fingerprint(packageHash 由来、model 非依存)+ schemaVersion** のみ。stale = ①別 export = 別 fingerprint ファイル(パス分離)②schemaVersion 不一致 reject(parser)③fingerprint identity 不一致 reject。`physiology-export-identity.ts` は `createSafePackageId` を再利用しつつ **parameterSignatureHash を持たない**(model 非依存)。

### 2.2 質感語→内部素子の写像 + 範囲正規化(Orch 裁定)
`physiology-tone-config.ts`(**純粋データ変換**、Electron/時計/乱数なし):
- スライダーは正規化 tone `[0,1]`。`anchoredLerp` は **t=0.5 midpoint を厳密に普遍既定へ**写す(0.5 で `atZero+(atHalf-atZero)*1 = atHalf` 厳密)。→ 全既定 tone の config が blink/gaze/head/posture 普遍既定と一致(テストで `DEFAULT_*_BASELINE` と deep-equal)。**「Reset → 普遍既定」と「default-ON = full physiology」が同一構成**。
- §6 対応表どおり: Blink Frequency→meanBlinkIntervalMs(逆)/ Calmness→intervalJitterRatio(逆=ばらつきの逆)/ Crispness→close+openDuration の共通係数(開閉のきびきび)/ Quirk→doubleBlinkProbability。Gaze cameraFocus/restlessness/dwellMs。Head sway/follow。Posture drift/restlessness。露出しない blink 定数(minRefractory/hold/closeDepth)は既定を保持。
- **範囲正規化(この写像層の責務)**: 各レンジの端点が質感を壊さないよう設定。**特に head Follow は tone 1 → 内部 follow 1.0 に上限**。gain=0.6·follow=0.6<1 なので `|follow|<|gaze|`(全部は向かない)が保たれる(テストで `0.6·follow<1` を固定)。sway/drift/cameraFocus 等は 0..1.2 等、非負・下限拘束を尊重。
- Stage Presence strength は正規化 tone をそのまま config へ(既定 0.3、Domain D が読む)。

### 2.3 provider 配線(Domain B Q1 への回答実装)
- Physiology state の `getPhysiologyConfig()` が `physiologyOverridesToConfig(overrides)` を返す。**土台は常にフル4系統**(空 override = `DEFAULT_FULL` 相当 + `stagePresence`)→ autonomousHost が設定なしで生きる。
- **参照契約**: config を revision でキャッシュ。ツマミが動く(override 変化→revision++)まで**同一参照**、変化時のみ**新オブジェクト**。heart の参照比較再構築(Domain A)がそのまま噛む(state テストで `toBe`/`not.toBe` を固定)。
- `runtime-player-main.ts` の `composeRuntimePlayerInputSubsystem` 呼び出しに `physiologyConfigProvider: () => physiologyState.getPhysiologyConfig()` を**1行追加**。autonomousHost composer のみ heart に配線、trackingHost は無視(Domain A の合成テーブル1点。実行時 role 分岐なし)。
- `PhysiologyConfig` に **optional `stagePresence`** フィールドを追加(additive)。behavior fan-out は無視(Domain D 駆動)。`DEFAULT_PHYSIOLOGY_CONFIG`/`DEFAULT_FULL_PHYSIOLOGY_CONFIG` は不変(Domain A/B テスト・golden 保全)。

### 2.4 bridge の「生理有無」data 表現(実行時 role 分岐なし)
- subsystem interface に data marker **`providesPhysiology: boolean`** を追加(`usesTrackingInput` と同列の data)。static composer=true / tracking composer=false。「生理サブシステムの実体有無」を data で表現。
- main は compose 後に `physiologyAvailable = inputSubsystem.providesPhysiology` を確定し、state の `isAvailable()` 遅延 getter へ供給(state は provider closure のため compose 前に生成が必要 → 遅延 getter で順序解決)。
- bridge を**両ロールで登録**(subsystem の外・main 直下、Dynamics 同型)。`getStatus` が `available` を data で返す: autonomousHost=true / trackingHost=false。renderer も main も `if(role===)` を書かず、renderer は `status.available` で空状態②へ分岐。runtime export load/unload/change/quit に配線(flush/clear/publishStatus)。sanitization: 質感語 config と status のみ renderer へ(シード・raw スロット・私的パスを流さない)。

### 2.5 ページ構造 + 空状態2つ(UX §2/§6)
`control/physiology-page.tsx`(先例 `dynamics-tune-page.tsx`)+ nav に `Physiology`(`Dynamics Tune` の隣、`control-window-shell.tsx`)+ bridge 配線(`control-window-app.tsx`)。
- セクション: **Blink / Gaze / Head / Posture / Stage Presence**。各セクションに `Reset`(override 無しは disabled)。
- **Stage Presence のみトグル(既定 Off)+ Strength スライダー**。UI + config フィールドはここ、駆動は Domain D。
- **スライダーは全て質感語**(spec 配列駆動)。**数値 readout・ms/Hz/確率・波形・数値入力欄なし**(UX §3/§5)。UI 語彙は英語。**プレビューボタン不在**・生理全体 OFF スイッチ無し。
- **空状態①**(Runtime Export 未ロード): 「Physiology comes alive once a Runtime Export is loaded.」。**空状態②**(trackingHost `available:false`): 「This host has no physiology; the body is driven by tracking.」の一文ページ(nav からは消さない=C1 劣化ページ方式)。

## 3. 作成/変更ファイル(絶対パス)

### 新規作成(source)
- `...\apps\runtime-player\src\preload\physiology-bridge-channels.ts`
- `...\apps\runtime-player\src\preload\physiology-bridge-contract.ts`(質感語 status/override/api・schemaVersion)
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-tone-config.ts`(**純粋写像 + 範囲正規化**)
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-profile-document.ts`
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-export-identity.ts`
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-profile-parser.ts`
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-profile-store.ts`
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-state.ts`
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-profile-save-controller.ts`
- `...\apps\runtime-player\src\main\physiology-bridge-handlers.ts`
- `...\apps\runtime-player\src\main\physiology-bridge-request-validation.ts`
- `...\apps\runtime-player\src\control\physiology-page.tsx`

### 新規作成(test)
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-tone-config.test.ts`(6)
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-profile-store.test.ts`(7: parse/save・stale 拒否・**二 export/二スロット独立**・corrupt)
- `...\apps\runtime-player\src\main\physiology-profiles\physiology-state.test.ts`(8: provider 参照契約・既定=full・restore/stale・reset・availability data)
- `...\apps\runtime-player\src\main\physiology-bridge-handlers.test.ts`(4: **生理不在 available:false**・present・debounce save・validation)
- `...\apps\runtime-player\src\control\physiology-page.test.ts`(6: 空状態2つ・スライダー/セクション Reset・**数字非露出**・トグル)

### 変更(既存)
- `...\apps\runtime-player\src\main\physiology\physiology-config.ts`(optional `stagePresence` + `PhysiologyStagePresenceConfig` 追加。DEFAULT 群不変・fan-out 不変)
- `...\apps\runtime-player\src\main\physiology\index.ts`(`PhysiologyStagePresenceConfig` export 追加)
- `...\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(`providesPhysiology` data marker を interface + 両 composer に追加)
- `...\apps\runtime-player\src\main\runtime-player-main.ts`(physiologyState/store 生成・provider 1行・availability 確定・bridge 両ロール登録・runtime export lifecycle + quit flush 配線)
- `...\apps\runtime-player\src\preload\runtime-player-bridge-contract.ts`(`physiology: RuntimePlayerPhysiologyApi`)
- `...\apps\runtime-player\src\preload\runtime-player-bridge.ts`(physiology API 露出 + 購読 helper)
- `...\apps\runtime-player\src\control\control-window-shell.tsx`(nav に `physiology`)
- `...\apps\runtime-player\src\control\control-window-app.tsx`(state・bridge 購読・route dispatch・action runner・diagnostics panel 除外)

**触れていない**(スコープ厳守): blink golden 2本・`headless-slot-resolver.ts`・`body-follow-state.ts`・`semantic-slot-definitions.ts`・browser-source-server・Editor / package-format / Runtime Export schema / lockfile。`pnpm install` 未実行、新規依存なし。Domain A/B の physiology/ 生成器・heart・config seam を退行させていない(stagePresence 追加は purely additive)。

## 4. テスト結果

コマンド:
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run
```
結果: **119 files / 708 tests → 706 passed / 2 failed**。

- 2 failed = **既知 baseline**(`src/stage/browser-source/browser-source-server-message.test.ts` の Wave21 `effectiveDynamicsTuning` 由来。Domain A/B 報告が申し送った browser-source-server 系2件)。**私の変更対象外**(browser-source は git status 上 untouched)。他の失敗なし。
- Domain C 対象(明示実行): `physiology-profiles`(21)+ `physiology-bridge-handlers`(4)+ `physiology-page`(6)+ `role-composition`(input-subsystem 9 / autonomous-frame-heart 13 / role-selection-stub 3)= **56 passed**。
- **blink golden 2本不変**: `git diff --stat -- '*golden*.json'` 空。`blink-behavior-fixture.test.ts`(4)+ Domain A 退行ゲート `physiology-config.test.ts`(4)= 8 passed(明示確認)。
- **Domain A/B 不変**: role-composition・physiology 生成器/coupling 群パス(既存契約・golden 無変更)。Dynamics Tune(Wave21)・既存 Control ページ・bridge 群パス。

typecheck:
```
pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck   # tsc --noEmit
```
結果: **パス(エラーなし)**。`exactOptionalPropertyTypes: true` 対応で optional は条件スプレッド構築。

## 5. 裁量判断
1. 質感語 tone は **`[0,1]` 正規化 + anchoredLerp(0.5=既定)**。「Reset=既定」「default-ON=full」を同一構成にし、テストで `DEFAULT_*_BASELINE` と deep-equal 固定。
2. Head Follow の内部上限を **1.0**(gain 0.6<1)に設定=質感条件 `|follow|<|gaze|` の範囲正規化。他レンジも下限拘束尊重(非負)。
3. `providesPhysiology` を subsystem の data marker として新設(`usesTrackingInput` と同列)。「生理サブシステムの有無」を role 問い合わせでなく data で表現。
4. state の availability は**遅延 getter 注入**(state は provider closure のため compose 前に生成が必要、availability は compose 後確定 → 順序を getter で解決。role 分岐ではない)。
5. `PhysiologyConfig.stagePresence` は **optional additive**。DEFAULT 群・fan-out を変えず Domain A/B テスト・golden を保全。Domain D が読む。
6. 写像層は **physiology-profiles/ 内の純粋モジュール**(physiology/ 純度スキャン対象外だが Electron/時計/乱数を持たない純データ変換)。永続化3部品(main 側、fs/Date OK)とは分離。
7. profile identity は fingerprint(packageHash 由来)一本で match。model 非依存(parameterSignatureHash 不使用)。

## 6. 質問 / escalate / blocked
- **質問なし**。Domain B Q1(既定を `DEFAULT_FULL_PHYSIOLOGY_CONFIG` 土台にする)は本 Domain の provider 供給源実装で回答済み(§2.3)。
- **escalate / blocked なし**。既存 Control shell はページ追加を構造的に受けた(nav union + 配列 + route dispatch の1点ずつ)。`headless-slot-resolver.ts` 変更不要。
- **申し送り(Domain D)**: `PhysiologyConfig.stagePresence: {enabled, strength}` を provider の config から読める。strength は正規化 `[0,1]`(既定 0.3)、enabled 既定 false。UI(トグル+strength スライダー)は Physiology ページに設置済み、駆動(姿勢信号→Stage transform 供給)は Domain D スコープ。

---

## 7. F1 修正追記(レビュー Lane2 検出、ループ2回目、2026-07-11)

### F1(確定バグ): Stage Presence Strength スライダーが機能しない
- **原因**: `physiology-page.tsx` は strength を汎用 `onUpdateTone`(tone スライダー経路)で発火するが、`physiology-state.ts` の `updateTone` が `NUMERIC_SECTION_IDS`(stagePresence 非含）で `assertNumericField` を throw → bridge が `validation-error` を返し strength override が state/config/永続化に届かず既定 0.3 固定。Domain D が読む `stagePresence.strength` が永久に既定のままだった。
- **なぜ緑だったか**: ページテストは `vi.fn()` でコールバック発火のみ検証(実 state 未到達)、state テストは stagePresence を enabled トグルしかテストせず、「UI 発火」と「state 拒否」が別々に緑になりバグをマスクしていた。

### 修正方針(採用: state 一点の最小修正)
Lane2 は enabled 対称の専用 `setStagePresenceStrength`(state+channel+contract+bridge+dispatch)を推奨したが、**strength は本質的に tone スライダー**でありページは既に汎用 tone 経路(`onUpdateTone`)で正しく dispatch している。バグは state が受け口で拒否していた1点のみ。したがって **`physiology-state.ts` だけを直す**最小・低リスクの修正を採用した(新 channel/contract/API/preload/ページ dispatch は不要=表面積最小、strength を他 tone スライダーと同一経路に統一)。Orch 確定の設計意図(strength 値変更→state override→provider config→永続化 が Domain C 責務、駆動のみ Domain D)は完全に満たす:
- `updateTone` に stagePresence 分岐を追加(`enabled` を保存したまま `strength` を書く。異種 override レコードを型安全に更新)。
- 受け口 gate を `assertNumericField`(NUMERIC_SECTION_IDS)→ `assertToneField`(`PHYSIOLOGY_SECTION_TONE_FIELDS[section].includes(field)`)へ緩和。stagePresence の唯一の slider "strength" を許可、未知 field は従来どおり拒否。
- 既存の `physiologyOverridesToConfig` / `resolveEffectiveSectionTones` / `sectionHasOverride` / `resetSection` は既に stagePresence.strength を扱えるため無改修。→ **debounce 自動保存・restore・Reset・provider 参照契約が strength にもそのまま適用**。

### 追加テスト(回帰 + マスク解消 + 非blocking)
- **F1 回帰(state)**: `updateTone({section:"stagePresence",field:"strength",tone})` → `getStatus` の stagePresence.strength 反映 + `getPhysiologyConfig().stagePresence.strength` 反映 + **参照契約(変化時のみ新参照)** を固定。加えて enabled と strength が独立 override であること・Reset で両者既定復帰を固定。
- **UI→handler→state integration(マスク解消)**: bridge に**実 state**でページの実リクエスト形 `{section:"stagePresence",field:"strength",tone:0.7}` を通し、`validation-error` にならず config に到達することを固定(UI 発火と state 拒否が別々に緑になる穴を塞ぐ)。
- **Stage Presence トグルの視覚反映(Lane3 穴5)**: `stagePresenceEnabled` が checkbox の `checked` に反映されることをアサート(off/on 両方)。
- **debounce coalescing(Lane3 Q1、非blocking)**: 窓内の連続3 edit → **saveCount === 1**(最終値のみ保存)を固定。edit 毎 save 実装を落とせる。

### 変更/追加ファイル(F1)
- 変更: `...\apps\runtime-player\src\main\physiology-profiles\physiology-state.ts`(`updateTone` stagePresence 分岐 + `assertToneField` へ緩和、`NUMERIC_SECTION_IDS` 削除)
- テスト追加: `...\physiology-profiles\physiology-state.test.ts`(+2)、`...\main\physiology-bridge-handlers.test.ts`(+2)、`...\control\physiology-page.test.ts`(+1)
- **触っていない**: physiology-page.tsx / bridge contract / preload / control-window-app(strength は既に正しい汎用 tone 経路。新 API 表面を増やさない)。blink golden・Domain A/B・Dynamics Tune 等は F1 でも不変。

### F1 修正後の検証
- typecheck: **パス**。
- Domain C 対象(明示実行): physiology-profiles + physiology-bridge-handlers + physiology-page = **36 passed**(state 10 / store 7 / tone-config 6 / bridge 6 / page 7)。
- 全体: `pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run` → **711 passed / 2 failed(713)**。2 failed は既知 Wave21 `effectiveDynamicsTuning: null` shape 由来の `browser-source/browser-source-server{,-message}.test.ts`(私の変更対象外)。この live-server テスト群は flaky で失敗数が 2〜3 で揺れるが、**原因は一律 Wave21 baseline、physiology テストは一度も失敗しない**。blink golden 2本不変(`git diff --stat -- '*golden*.json'` 空)。
