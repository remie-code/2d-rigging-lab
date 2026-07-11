# レビュー: C5 追撃 Domain G — レーン1(spec/設計§7改定突合)

担当: Review-Sylph(レーン1) / 日付: 2026-07-11 / ブランチ: `feature/2d-rigging-eco-system`
判定: **合格**
判定基準: wave plan §12 Domain G / 設計討議 §7(裁定3改定) / choppiness診断
検証方法: 対象6ファイルの `git diff` を自分で確認 + 絶対条件を独立に機械確認(soul package.json不在・作業ツリー差分・ドライバdry-run) + 対象テスト隔離実行(31 passed)。Gnome報告は裏取り済みで矛盾なし。

---

## 観点別 確認結果(根拠つき)

### 観点1: set ease-in が §7改定に一致 — 適合
- 定数 `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS = 100` が `slot-curve-state.ts:38` に **curve系命名**(既存 `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS` に倣う)で追加。命名規律(§7末尾: curve側はcurve、envelopeは封筒に譲る)に整合。docstring(:28-37)が「即ステップではなく ease-in」を明記。
- `setOverlay`(`control-channel-overlay-store.ts:88-99`): `attackMs = min(既定100, windowMs)`、`sampleSlotCurve` の attack相 `lerp(startValue, peak, smoothstep(e/attackMs))`(`slot-curve-state.ts:127-133`)で smoothstep ease-in。`startValue = this.#effectiveStart(slotId)`(連続性原則3.1・案B=現在実効値)。
- 退化set= attack(ease-in)→sustain→decay=0→universal release、の単一状態機械に畳む(§7裁定3、契約2 kind不変)を維持。

### 観点2: TTL/release不変(絶対条件) — 適合
- `sustainMs = windowMs - attackMs`(`overlay-store.ts:99`)。`slotCurveDriveEndMs = startAtMs + attack + sustain + decay = startAtMs + windowMs = expiresAtMs`(`slot-curve-state.ts:160-162`)。attackを**前置でなくsustainから差し引く**ことで drive-end=TTL失効時刻を数式的に保証。
- `remainingTtlMs` 不変を専用テストが固定: `activeOverlays(100)=900 / (700)=300 / (1000)=[]`(`overlay-store.test.ts:293-297`)。C4のTTLセマンティクスと同一。
- release不変: `releaseMs = this.#releaseMs`(:97)無改変。decayMs=0で release が peak→動く基底へ直接blend(400ms)。set失効→release blendは既存テストで無退行。
- 短窓クランプ(window<100ms): `attack=min(100,window)=window / sustain=0`。window=40msで attack=40/sustain=0/drive-end=40(=expiresAtMs)、sustain負回避を専用テストが固定(`overlay-store.test.ts:302-315`)。妥当。

### 観点3: 契約無変更(絶対条件) — 適合
- 作業ツリー差分は Domain G の6ファイルのみ。`git status --porcelain -- contract/ physiology/ headless-slot-resolver.ts pnpm-lock.yaml` = **空(無変更)**を独立確認。schema JSON・examples・contract TS・validation・拒否列挙・supportedKinds・kind名(`intent.set`/`intent.envelope`)は一切触れていない。
- ドライバの perceptual経路は既存プリミティブ `sendEnvelope`(`reference-driver.mjs:638-661`)を流用し `kind:"intent.envelope"` payload{slotId,peak,attackMs,sustainMs,decayMs}を送るのみ。新kind・新フィールドなし。intent.set は perceptual に不在(envelope主体)。
- 「契約の形は変えず動きの粗さだけ精緻化」の原則(§7改定)を docstring 3箇所(`slot-curve-state.ts:1-8/28-37/97-104`、`overlay-store.ts:2-8/82-96`)が明記。C4契約fixture(`channel-protocol-contract.test.ts`等)は control-channel隔離実行で緑(Gnome報告、対象外ファイル無変更と整合)。

### 観点4: 知覚シナリオが§12要件に一致 — 適合
- ドライバ dry-run 実出力(自分で実行)を確認: envelope 3節(head-vertical 0.6/attack300、head-vertical −0.4/attack300、body-x 0.5/attack400/sustain1500)+ disconnect。**attack全て[200,400]**、間合いは `PERCEPTUAL_*_MS`=900/1200/900ms の秒オーダー(圧縮30msでない)。
- ①表情ピーク→②重ねがけ(同一head-vertical符号反転re-attack)→③body持続(最長sustain1500=④切断時に生存)→④意図的kill(disconnect)。§12逐語要件に一致。
- CLIはドライバ内で完結(`--scenario`/`--print-timeline`、位置引数URL)。依存ゼロ`.mjs`維持・`apps/soul` package.json**不在を独立確認**(find 0件)。
- 既定(引数なし=compressed)無退行: dry-run compressed出力が従来のset相を保持。持続駆動テスト `reference-driver-sustained-drive.test.ts`(引数なしspawn)=**pass(自分で実行)**。compressedレポート(`reference-driver.mjs:232-244`)に `scenario` フィールド追加なし=出力不変。perceptualレポートは別コードパス。

### 観点5: 意図的置換の妥当性 — 適合(裁定所見つき、下記)

### 観点6: physiology純度・golden・resolver・lockfile・soul package.json不在・role分岐ゼロ — 適合
- 上記の作業ツリー差分空きで機械確認。physiologyのsmoothstepは写経(import無し、`slot-curve-state.ts:78-82`)で既存のまま。`pnpm install`/依存追加/回避工作(`import(変数)`等)の痕跡なし(新規テストはspawn前例、`reference-driver-perceptual-timeline.test.ts:21-24`)。

### 観点7: 既知baseline分類 — 妥当(独立再実行は範囲外)
- Gnome報告のbaseline(Wave21 browser-source系2件 + check:source C3既存1件)はいずれも本タスク未touchファイル(`broadcast-source/`・`physiology/index.ts`)。対象6ファイルの差分に新規failを持ち込む要素はなく、分類は妥当。全体860 passed/2 failedの独立再実行はレーン1(spec突合)範囲外のため未実施だが、対象4テストファイル31件は隔離実行で緑を自分で確認。

---

## 裁量判断: 意図的置換のスコープ(Gnomeの scope question)への裁定所見

**裁定: `autonomous-frame-heart-channel-overlay.test.ts` の2件を Domain G の意図的置換に含める判断は妥当。虚偽の緑化ではない。**

根拠:
1. **指示の射程**: wave plan §12項目1は対象を「『set=即時適用』を固定していた既存テスト」という**クラス**で記述(ファイルホワイトリストではない)。設計§7末尾(命名規律)も「C4の即時スナップを固定している既存テストは意図的置換(引き継ぎ事項)」と**一般指示**。当該2件はまさにこのクラス。
2. **意図保持を差分で確認**: 両件とも `setNow(32)`(e=16ms、旧attack≈0前提でpeak到達)→`setNow(200)`(e=184ms、attack100を越えたsustain深部)へ**サンプル点のみ移動**。
   - 1件目(override追従): 期待値 `eye-blink-left`活性化0=開眼=1 は不変(assertブロック無改変、コメントとsetNowのみ変更)。sustain平坦部=peakで旧即時値と同値。
   - 2件目(Stage追従): 期待 `horizontal:0.9` 不変、`timestampMs` は 32→200(サンプル時刻に整合、値の意味は不変)。「Stageが合成後実効body値に追従(Domain C裁定1)」の意図を保持。
3. **緑化の健全性**: ramp自体は別の新規専用テスト(`overlay-store.test.ts:36-58` ease-in ramp、:1近傍がpeak半分未満をpin)で固定。当該2件はsustain深部を読むため値が不変=意味を変えずに通過しており、失敗の握り潰しではない。

---

## blocking懸念 / 是正指針

**なし。** blocking・非blockingとも spec/設計§7改定突合の観点で差分を検出せず。

軽微所見(非blocking・情報):
- 連続性property(set)テストの導出bound(`overlay-store.test.ts:266-303`)は attack/release/peak/frameInterval/max-slope定数から算出しマジックナンバー無し(§7末尾要件)。sustain→release境界も数式上連続(decay=0で releaseFrom=peak、w=1で value=peak)を差分から確認、bound内。適合。

---

## 判定

**合格。** 要修正差分なし。

human-gate(知覚シナリオでの§7 6項目再実施)は設計どおり人間ゲート専用で、機械テストはタイムラインdry-run + 圧縮持続駆動(無退行)でカバー済み。レーン1として異議なし。
