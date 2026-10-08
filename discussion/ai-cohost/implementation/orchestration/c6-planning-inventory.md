# C6 planning gate inventory: 口が話せる(モーラ契約と時間仮説)コード接地棚卸し

> Status: 調査完了(Sylph、2026-07-11)。対象=`apps/runtime-player` 現HEAD(**C5完全閉鎖済み**、コミット `a3a0b58`)+ 特区 `apps/soul`(参照ドライバ)。**読み取りのみ**(ソース変更・テスト実行・`pnpm install`・アプリ起動なし)。
> 基盤設計=[../../architecture/c6-mouth-phoneme-timeline.md](../../architecture/c6-mouth-phoneme-timeline.md)(Accepted、モーラ契約案c・時間仮説・比較ゲート)。親=[../../architecture/c5-composition-and-envelopes.md](../../architecture/c5-composition-and-envelopes.md) §6(前方互換を予約)。事実接地=[../../research/runtime-player-input-integration.md](../../research/runtime-player-input-integration.md) §2(凸ブレンド不変条件 Σvowel=s=mouth.open)。
> 事実はファイル:行で接地。設計上の見立ては「推測:」を前置。C5棚卸し([c5-planning-inventory.md](c5-planning-inventory.md))と同じ構造。
> 依頼元: Undine(L0)。Verdict は §5、先行判断すべき論点は §6、質問は §7。

---

## 1. 要約(先に結論)

- **C5が予約した前方互換(c5設計§6「C6はタイムスタンプ付きエンベロープ断片の列として本機構の上に載る」)は、器の骨格としては半分だけ効く。** 効く半分: 心臓tick(壁時計60Hz、`autonomous-frame-heart.ts:45`/`:309`)が毎tick `getChannelOverlay(wallNowMs, activations, prevResolved)` を呼び、これが `store.snapshot(nowMs, ...)` を叩いてマージseam `{ ...activations, ...overlay }`(`:237`)へ流す——この**「壁時計nowMsで毎tick評価してRecordを合成する」評価cadenceがそのままタイムライン再生の心臓になる**。smoothstep写経(`slot-curve-state.ts:79-82`)・release-to-living-base・切断releaseAll も再利用可。
- **効かない半分(C6の真の新規、2点に偏る)**:
  1. **タイムライン=将来時刻つき目標列の再生機構が現行storeに無い**。現行storeの1エントリは「受信即開始の**単一目標**」`SlotCurveState`(`slot-curve-state.ts:59-69`)で、`setEnvelope` は `startAtMs` から即 attack を始める(`control-channel-overlay-store.ts:118-132`)。モーラ列(`{timeMs,vowel,s}[]`)の「t=140msでこの母音へ折れる」という**スケジュール概念がどこにも無い**(§2.2)。
  2. **6スロット連動の相補クロスフェードが現行の「スロット独立」機械と噛み合わない**。storeは `Map<slotId, SlotCurveState>`(`:67`)で各スロットが**独立**の1曲線。凸不変条件 Σvowel=s=mouth.open を**構造で**保証するには5母音+mouth.openを**1つの進行度から連動導出**する必要があり(§2.3)、独立スロット機械の素直な拡張では出ない。
- **主コスト(§3)**: 上記2点を担う **「口グループ・タイムライン評価器」**の新設が荷重のほぼ全て。これは per-slot `SlotCurveState` 機械とは**別種のstoreエントリ**(6スロットをグループ所有し、モーラ列+経過時間から6値を連動評価する)。ただし新設は評価器の内部のみで、**外周(心臓cadence・マージseam・release・契約additive・参照ドライバ)はC5資産をそのまま流用**。C5棚卸しが「storeの時間発展化」1点に集約されたのに対し、C6は「storeに**グループ時間評価器**を足す」1点に集約される。
- **契約(`intent.speech`)は C5 の `intent.envelope` 追加と**ほぼ同型だが1点だけ新しい**: payloadが**配列(モーラ列)**になるため、C4/C5が一度も持たなかった「可変長payload」が入り、**タイムライン長の上限(DoS)という新しいvalidation観点**が生じる(§2.5)。既存validationは全て固定形(単一slot)で、配列長caps の前例が無い。
- **母音スロットの経路は接地済み・チャネル駆動は既存の同じドアを通る(§2.1)**: 5母音(`mouth-vowel-a/i/u/e/o`)+`mouth-open` は語彙・リゾルバともに実在し(`semantic-slot-definitions.ts:138-191`/`:117-126`)、`intent.envelope` schema enum にも既に載る(`channel-intent-envelope-payload-schema.json:23-27`)。トラッキングの母音推定器の出力 `s×weight` は結局ただの活性化値で、リゾルバ `createVowelTargetValue`(`headless-slot-resolver.ts:185-201`)を通る。**チャネルが書く母音活性化も同じリゾルバを通る**ので、既存の口形ブレンドと同じ表現力を持つ。
- **Verdict: `needs_design`**(§5)。C5前方互換で外周は接地しているが、**口グループ評価器の内部形が未確定**で、その前提として §6 の先行判断5点——(i)**タイムライン再生の載せ方**(グループ評価器 vs per-slot時間相 vs その他)、(ii)**相補クロスフェードの単一進行度導出の具体式**、(iii)**グループ評価器 vs per-slot曲線の同一スロット競合の調停**、(iv)**タイムライン長上限とvalidation語彙**、(v)**s縮小係数/attack≈モーラ長の置き場と既定値**——がドメイン分割の前提になる。裁定が済めば実装は素直で、C5資産を大きく再利用できる。

---

## 2. 観点別リポジトリ事実

### 2.1 観点1: 母音スロットの実態(語彙・既定・リゾルバ・推定器写像)

**5母音+口スロットの実在(事実、`semantic-slot-definitions.ts`)**:
- `mouth-vowel-a/i/u/e/o`(`:138-191`): group=`mouth`、sourceKind=`mouth-vowel`、targetAliases=`mouth.vowel.{a..o}`、`defaultInvert:false`・`defaultStrength:1`、各 `vowelLabel` 付き。
- `mouth-open`(`:117-126`): sourceKind=`mouth-open`、alias `mouth.open`、invert:false・strength:1。
- `mouth-smile`(`:128-136`): sourceKind=`mouth-smile`、alias `mouth.smile`。**母音グループとは別スロット**(情動側、C6の口グループには入らない)。

**トラッキングの母音推定器→スロット写像(事実)**:
- 推定器出力 `VowelEstimate = { s, weightByVowel }`(`vowel-lipsync-estimator.ts:58-61`): `s`=開き強度(0..1)、`weightByVowel`=5母音のsoftmax凸ブレンド(Σ=1)。
- 写像層(`runtime-parameter-frame.ts`): 各母音スロットの活性化 = `s × weightByVowel[v]`(`:270`、Σ=s)、`mouth-open` の活性化 = `s`(`:180-182`)。**Σvowel = s = mouth.open が推定器の構造で成立**(研究§2の不変条件)。per-vowel strength は正規化前に一度だけ畳まれ(`:55`/`:72`)、末尾で再適用しない。
- **含意(事実→設計)**: 「この母音・この強度」は最終的に**6個の活性化値**にすぎない。リゾルバ `createVowelTargetValue`(`headless-slot-resolver.ts:185-201`)は活性化を `target.min..max` へ**線形写像**(strength/default pivot を掛けない=二重計上回避、`:184` コメント)。mouth-open は `createWeightValue`(`:159-175`、strength/default pivot あり)。**両パスとも同じリゾルバ**を通る(`resolveSemanticSlotParameterValues`)。

**チャネル駆動が同じ経路を通れるか(事実)**:
- 自律ホストの心臓は `resolveSemanticSlotParameterValues({ slots, activations: resolvedActivations })`(`autonomous-frame-heart.ts:255-258`)を直接呼ぶ。**`vowelLipsyncEnabled` ゲート(`runtime-parameter-frame.ts:94`)は写像層側の話で、心臓リゾルバには無い**。→ **チャネルが `mouth-vowel-a` 活性化を書けば、心臓リゾルバがそのまま母音パラメータを出す**(トグル不要)。凸不変条件を活性化レベルで守れば既存の口形ブレンドと同一表現力(研究§2の含意そのもの)。
- **不変条件は活性化レベルで持つ(事実の帰結)**: リゾルバは母音とmouth-openで**別の写像曲線**を掛ける(前者線形・後者pivot付き)ので、活性化で Σvowel=s=mouth.open でも**パラメータ値は単純一致しない**。これは正常(不変条件は意味/活性化レベルの契約)。C6の口グループ評価器も**活性化レベルで凸不変を出せば足りる**。

**自動マッピングの前提(事実、gate依存)**:
- `createAutoMappingSlots(payload)`(`runtime-export-auto-mapping.ts:10-50`)は16スロット全定義をmapし、各スロットは**モデルに一致target(alias/表示名)があるときだけ `enabled`**(`:26`)。→ **C6ゲートには、ロードするテストモデルが `mouth.vowel.*` と `mouth.open` のリグパラメータを external-input として持つことが前提**。無ければチャネルの母音書込は `slotNotWritable`(§2.5)で拒否される。→ §4リスク・§7質問。

### 2.2 観点2【最重要】: タイムライン再生のC5機械への載せ方

**現行storeは「受信即開始の単一目標」前提(事実)**:
- `#curves = new Map<string, SlotCurveState>()`(`control-channel-overlay-store.ts:67`)。1スロット=1曲線状態。
- `SlotCurveState`(`slot-curve-state.ts:59-69`)= `{ startAtMs, startValue, peak, attackMs, sustainMs, decayMs, releaseMs, forcedRelease?… }`。**単一目標**(peak 1個)への attack→sustain→decay→release。
- `setEnvelope(slotId, spec, startAtMs)`(`:118-132`)= `startAtMs` から**即** attack 開始。`setOverlay`(`:95-111`)= set の退化曲線。**どちらも「今から始まる1目標」で、将来時刻キューを持たない**。
- `sampleSlotCurve(curve, nowMs, livingBase)`(`:106-152`)は `e = nowMs - startAtMs` の経過を相へ写像する**純関数**。時計を持たず、呼ばれた `nowMs` で評価する。

**心臓tick(壁時計)でのスケジュール評価点(事実)**:
- 心臓は `setInterval(tick, 1000/60)`(`autonomous-frame-heart.ts:45`/`:309`)で毎tick `wallNowMs = now()`(`:215`)を取り、`getChannelOverlay(wallNowMs, activations, lastResolvedActivations)`(`:235`)→ `store.snapshot(nowMs, baseValues, prevResolved)`(`input-subsystem.ts:244-245`)を呼ぶ。
- `snapshot`(`control-channel-overlay-store.ts:175-194`)は**毎tick全エントリを `nowMs` で評価**して live Record を返し、完了(`done`)エントリを prune。→ **「壁時計nowMsで毎tick再評価する場所」は既に存在する**。タイムラインのスケジュール評価はこの `snapshot(nowMs)` の中に自然に入る(モーラ列の相対 `timeMs` を `nowMs - timelineStartAtMs` と突き合わせる)。器側の別timerは不要。

**載せ方の候補(推測、これが§6先行判断①)**:
- **候補(iii) 口グループ・タイムライン評価器(推奨・最有力)**: storeに **per-slot `SlotCurveState` とは別種のエントリ**「speech timeline」を持たせる。`setSpeech(moras, startAtMs)` で受け、`snapshot(nowMs)` 内で `elapsed = nowMs - startAtMs` から**現在のモーラ区間 [i,i+1] と進行度 p を求め、6スロット値を連動評価**(§2.3の相補式)して live Record に載せる。時間仮説(attack≈モーラ長=区間長)が**区間長から動的に**出る(§2.4)。**心臓cadence・マージseam・release は無改造で再利用**。新規は評価器の内部数学のみ。
- **候補(ii) `SlotCurveState` に timeline 相を足す**: per-slot曲線を目標列に拡張。だが**1モーラは最大6スロットを同時に動かす**ので、per-slot列では相補クロスフェード(グループ性)を表現できない。→ 凸不変を構造で持てない。不採用寄り。
- **候補(i) 器内スケジューラがモーラ時刻ごとに `setEnvelope` を発火**: サーバ or storeが timer でモーラごとに per-slot envelope を起こす。だが (a) 器側の第二timerを増やす(心臓が既に唯一のframe source、`autonomous-frame-heart.ts:19-20`「SOLE frame source」思想と衝突)、(b) 6スロットを別々の envelope で起こすと**相補性が偶然頼み**になる(§2.3)。不採用寄り。
- **推測の結論**: **候補(iii)**。C5前方互換が約束した「本機構の上に載る」は、cadence/seam/release の**外周**については真だが、**タイムライン再生本体とグループ相補は per-slot `SlotCurveState` の素直な延長では出ず、別種のグループ評価器の新設が要る**。「作り直さない」の対象は外周であって評価器本体ではない。

### 2.3 観点3【最重要】: 6スロット連動の相補クロスフェード(凸の構造保証)

**問題(事実+設計)**: 凸不変条件 Σ(5母音) = s = mouth.open を**検証でなく構造で**保証せよ(c6設計§2)。現行storeは各スロット独立の `SlotCurveState`(`:67`)なので、5母音+mouth.openを別々の曲線で書くと**Σが偶然 mouth.open に一致する保証が無い**(浮動小数の脆さ、c6設計§2「案b不採用」の理由)。

**単一進行度からの相補導出(推測、§6先行判断②)**:
- モーラ列 `[{t_i, v_i, s_i}]`。区間 [t_i, t_{i+1}] の途中 `nowMs` で進行度 `p = smoothstep((nowMs - t_i)/(t_{i+1} - t_i))`(0→1)。
- 開き強度 `s(nowMs) = lerp(s_i, s_{i+1}, p)` を **mouth.open 活性化**に。
- 母音重み: `vowel[v_i] = s(nowMs)·(1-p)`、`vowel[v_{i+1}] = s(nowMs)·p`、他母音=0。
- **構造的帰結**: `Σvowel = s(nowMs)·((1-p)+p) = s(nowMs) = mouth.open`。**単一の進行度 p と単一の s(nowMs) から凸不変が恒等的に出る**(独立スロット×2の偶然の相補ではなく、1つの p の補数 (1-p):p で分配する構造的相補)。同一母音連続(v_i=v_{i+1})の縮退も安全(重みが合算されるだけ)。
- **undershootが時間から湧く(c6設計§3.2)**: 区間長が短い(高速モーラ)と p が1に届く前に次区間へ折れる=各母音頂点に途中までしか登れない=混合が自然発生。定常ブレンド表を持たない。
- **座らせ方(推測)**: この評価は「口グループ」を**1エントリ**として持つ評価器の内部(§2.2候補iii)。per-slot独立機械の**上に**グループ評価器を座らせ、`snapshot` が「グループ評価器の6値 + per-slot曲線の残りスロット」を1 Recordに合成。

**per-slot曲線との競合(推測、§6先行判断③)**:
- `snapshot` は最終的に1つの `slotId → value` Record を返しマージseam `{ ...activations, ...overlay }`(`autonomous-frame-heart.ts:237`)に載る。**同一スロット(例 `mouth-vowel-a`)にグループ評価器と per-slot `setEnvelope` の両方が値を持つと、どちらが勝つか未定義**。cleanな解: グループ評価器がアクティブな間は6母音スロットを**専有**し、per-slot曲線は残りスロットのみ(mouth-smile等)。この専有/調停をstore内で1箇所に決める必要がある。→ §6-③。

### 2.4 観点4: 時間仮説のパラメータ(attack≈モーラ長、s縮小係数、連続性bound)

**attack≈モーラ長(推測)**: §2.3の相補式では**クロスフェード区間長 = モーラ間隔 `t_{i+1}-t_i`** がそのまま attack に相当する(固定 attackMs を持たない)。→ **attackはモーラ列から動的に導出**され、payloadに attack フィールドは不要(c6設計§3.2「attack≈モーラ長」の実装的帰結)。C5の `intent.envelope` が明示 attackMs を持つのと対照的。

**s縮小係数(普遍既定)の置き場(推測)**: 発話時に100%形(キャリブレーション到達形)まで開かない縮小係数(c6設計§3.2)は、**非露出の普遍定数**として `slot-curve-state.ts` の既存定数群(`RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS=400` `:26`、`…DEFAULT_SET_ATTACK_MS=100` `:38`)に倣い、グループ評価器の隣に置くのが素直(例 `RUNTIME_PLAYER_SPEECH_OPEN_SCALE`)。各モーラの `s` に一律乗算。露出しない(C5のrelease/attack既定と同じ流儀)。

**連続性boundの導出(事実→推測)**: C5は `RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE=1.5`(`slot-curve-state.ts:46`、smoothstep導関数 `6x(1-x)` の最大)から per-tick step を導出し性質テスト化(C5 domain-a報告§5)。C6グループ評価器も**隣接tick差 ≤ maxSlope × (Δs or Δweight)/区間長 × frameInterval** で同型に導出可。ただし**区間長がモーラごとに可変**なので、bound は「最短モーラ区間」から導く(最短区間ほど傾き大)。マジックナンバー不在の流儀は維持できる。→ §7質問(最短モーラ区間の下限をvalidationで持つか)。

### 2.5 観点5: 契約追加(`intent.speech` kind)

**additive extension の型が既に接地(事実、C5で二度目の追加が完了済み)**:
- supportedKinds は const 配列 `["intent.set", "intent.envelope"]`(`channel-protocol-contract.ts:32-35`)。→ **`"intent.speech"` を足すだけ**で hello が自動告知(`channel-protocol-messages` 経由、参照ドライバが `expectedKinds` で自己照合、`reference-driver.mjs:521-525`/`:613-620`)。
- dispatch は kind分岐が既に2分岐(`channel-request-dispatch.ts:108-111`: `intent.envelope` / `intent.set`)。→ **`intent.speech` 分岐 + `dispatchIntentSpeech` + `ControlChannelSpeechWrite` 型**を足す(`:41-49` の `ControlChannelEnvelopeWrite` が雛形)。
- 契約JSONは4枚: `channel-envelope-schema.json`(外殻・supportedKinds `:7`)、`channel-intent-set-payload-schema.json`、`channel-intent-envelope-payload-schema.json`、`channel-exchange-examples.json`。byte-sync検証 `channel-protocol-contract.test.ts`(`:30` supportedKinds、`:55`/`:172` payload schema)が**TS↔JSONの両更新を強制**。→ **`channel-intent-speech-payload-schema.json` 新規 + TS型 `RuntimePlayerControlChannelIntentSpeechPayload` + 4枚のsupportedKinds/examples更新 + テスト拡張**。
- 心臓/store配線: サーバ `#handleClientMessage`(`channel-server.ts:275-325`)が `dispatch.envelope` を `setEnvelope` へ流す形(`:303-316`)。→ **`dispatch.speech` を `store.setSpeech(moras, this.#nowMs())` へ流す1分岐**を足す(setEnvelope分岐と同型)。

**validation の追加コスト(推測)**:
- 新規 `validateControlChannelIntentSpeech`(`channel-intent-validation.ts:199-247` の envelope版が雛形)。モーラ列 `[{timeMs, vowel, s}]` を検証:
  - payload parse → `invalidPayload`(非record、`timeline` 非配列、**空配列**、`timeMs` 非単調/負、`vowel` が `a/i/u/e/o` 外、`s` 非有限)。`parseDurationMs`(`:296`, 非負)/`parseTtlMs`(`:129`, value<=0)が前例。
  - `s` 域外(0..1) → `slotValueOutOfRange`(mouth-vowel域は `channel-intent-envelope-payload-schema.json:61` の `mouth-vowel { min:0, max:1 }` を流用、`semantic-slot-normalized-range.ts`)。
  - 6母音スロット(`mouth-vowel-*`+`mouth-open`)の**書込可否をグループで検証** → `slotNotWritable`(§2.1のgate依存)。**slotIdはpayloadに無く固定6スロット**なので、`isMappingSlotId` の per-slot 検証ではなく「6スロット全writable」の新形。
- **【新観点】タイムライン長の上限(DoS)**: **既存validationは全て固定形(単一slot)で、配列長caps の前例が皆無**。`intent.speech` は初の**可変長payload**で、巨大 `timeline`(数万モーラ)が心臓の毎tickスキャンを重くしうる。→ **最大モーラ数 or 最大タイムライン総時間の上限をvalidationに足す**(超過→`invalidPayload`、クランプ禁止の規律。c6設計はこの上限に言及なし)。→ §6-④/§7。

**新規rejection codeの要否(推測)**: C5は「新codeを足さず既存列挙に畳む」を裁定済み(`channel-intent-validation.ts:158-177` 裁定4)。C6も**同流儀で足りる想定**(形不正=`invalidPayload`、s域外=`slotValueOutOfRange`、非writable=`slotNotWritable`)。ただし「タイムライン長超過」を `invalidPayload` に畳むか独立codeにするかは明示裁定が要る。→ §6-④。

### 2.6 観点6: fixture音素列と参照ドライバ

**現行ドライバ(事実、`reference-driver.mjs`)**:
- `intent.set`(`sendIntent :623-637`)と `intent.envelope`(`sendEnvelope :638-661`)の両kindを送る。CLI: URLは位置引数、`--scenario=compressed|perceptual`(`:94`/`:262-273`)、`--print-timeline`(`:99-103`、WS不要のdry-run印字)。
- シナリオは純データ関数: `buildCompressedScenario()`(`:280-325`)/`perceptualSections()`(`:333-368`)/`compressedSections()`(`:371-398`)。`buildTimeline(scenarioName)`(`:401-410`)が印字用に射影。
- 契約自己照合: `loadContract()`(`:503-542`)が契約JSONの `slotId enum` と hello の `supportedKinds` を読み、送るslotId/期待kindを照合。依存ゼロ `.mjs`、`readFileSync`は許可(§6.2、`check-soul-zone-boundary.mjs`)。

**C6での拡張(推測)**:
- `sendSpeech(timeline)`(`sendEnvelope :638-661` が雛形、`{ v:1, id, kind:"intent.speech", payload:{ timeline } }`)。RTT計測は replyTo相関を流用。
- **fixture音素列(モーラ列)の置き場**: 参照ドライバに `speechSections()`(例「こんにちは」相当の `[{timeMs:0,vowel:"o",s:.6},{timeMs:140,vowel:"a",s:.8},…]`)。**音素→母音写像は魂側(スコープ外、c6設計§6)だが、fixtureモーラ列の作成例は参照ドライバに含めてよい**(c6設計§6明記)。`--scenario=speech` を `parseScenarioFlag`(`:262-273`)に足し、`buildTimeline` に speech節を追加。**圧縮/perceptual シナリオの実行経路・出力・exit codeは不変**(C5 domain-G の無退行流儀を踏襲)。
- **契約 examples への fixtureモーラ列**: `channel-exchange-examples.json` に `intent.speech` の happy-path例を1つ足すのが素直(byte-sync test が拾う)。

### 2.7 観点7: 比較ゲートの実務(トラッキング/自律 二体並置)

**二体並置は接地済み(事実)**: C1で二役(`trackingHost`/`autonomousHost`)が composer table で選択可(`input-subsystem.ts:305-311`)。同一フレーズを (a)トラッキングホストでユーザーが実発話、(b)自律ホストで fixtureモーラ列駆動、で並べる(c6設計§5)。

**器側の特別支援は不要(事実で確認)**:
- (a)トラッキング側: **母音推定器が既に稼働**(`runtime-parameter-frame.ts:60-77`)。ただし**`vowelLipsyncEnabled` が true でないと母音スロットが出ない**(`:94` の toggle OFF は母音parameterIdを出さない)。→ **比較(a)側は vowel lipsync を有効にする必要がある**(モデル設定依存、実演前提)。「決まったフレーズを言う」のはユーザーの実演(c6設計§5)。
- (b)自律側: §2.1の通りチャネル駆動の母音活性化が心臓リゾルバをそのまま通る。**器側の新支援は C6 本体(intent.speech + グループ評価器)のみで足り、比較ゲート専用の器工事は不要**(c6設計§5の想定を確認)。
- 両ホストとも同じ `resolveSemanticSlotParameterValues` → 同じStage/Browser Source sanitization境界。並置は既存インフラで成立。

### 2.8 観点8: release/優先との整合(終端・切断で口が閉じる)

**生理の口=デフォルト閉口(事実で確認)**: **physiology/ に mouth/vowel の生成は一切無い**(grep空: `apps/runtime-player/src/main/physiology` に mouth 参照0件)。→ 生成器は口スロットの活性化を**産まない**。storeの `#livingBase(slotId)`(`control-channel-overlay-store.ts:239-242`)は基底欠如時 **0**。→ **release先(生きた基底)は mouth=0(閉口)**。C2の「静止時基本閉口」と一致。

**終端・切断のrelease経路(事実→推測)**:
- 切断: サーバ `#handleClientClose` → `store.releaseAll(nowMs)`(`channel-server.ts:333`/`:199`)。`releaseAll`(`control-channel-overlay-store.ts:149-163`)は全 live 曲線を現在値からの forced release(`forcedReleaseAtMs`/`forcedReleaseFromValue`)へ一斉遷移、`sampleSlotCurve` が 400ms で livingBase(=0)へ blend(`slot-curve-state.ts:111-119`)。→ **口グループ評価器も同じ forced-release 扱いを実装すれば、途中切断で口がすっと閉じる**(生きた基底へ)。
- タイムライン終端: 最後のモーラ以降、グループ評価器は「駆動終了」→ 6母音スロットを livingBase(=0)へ release。**per-slot曲線の decay終端→release→base(`:144-151`)と同型の終端処理をグループ評価器に持たせる**。→ 発話後に口が自然に閉じる(生理の口へ復帰)。
- 優先: チャネル駆動がスロット単位で生成器に勝つ(C5規則)。**口スロットは生成器が何も産まない**ので競合が無く、グループ評価器の値がそのまま出る(c6設計§4「発話中の口スロットはチャネルが生成器に勝つ」が自動成立)。

---

## 3. C6計画への含意(ドメイン分割の示唆、主コスト)

**ドメイン分割の示唆(推測、設計の二層=契約/合成 と整合)**:
- **Domain 契約(intent.speech additive)**: `"intent.speech"` を supportedKinds に追加(4枚のJSON+TS)+ `channel-intent-speech-payload-schema.json`(モーラ列schema)+ TS型 + `validateControlChannelIntentSpeech`(モーラ列検証・**タイムライン長上限**・6スロットwritable)+ dispatch分岐 + `ControlChannelSpeechWrite` + `channel-exchange-examples.json` の speech例 + `channel-protocol-contract.test.ts` byte-sync拡張。rejectionは既存列挙流用(§2.5、長上限の扱いは§6-④)。**依存が浅く並行可能だが、可変長payload/長上限が新観点**。
- **Domain 口グループ・タイムライン評価器(C6の核)**: storeに per-slot `SlotCurveState` と**別種のグループエントリ**を新設 + `setSpeech(moras, startAtMs)` + `snapshot(nowMs)` 内のスケジュール評価(現在モーラ区間+進行度)+ **単一進行度からの相補6値導出**(§2.3、凸不変を構造保証)+ **attack≈モーラ長(区間長から動的)**+ **s縮小係数(普遍定数)**+ グループ評価器の forced-release/終端release(§2.8)+ **グループ vs per-slot 同一スロット調停**(§2.3/§6-③)+ 決定論fixture(store層)+ 連続性性質テスト(区間可変boundの導出、§2.4)。**store内の新設だが外周(心臓cadence・マージseam)は無改造**。§6-①②③⑤の裁定が前提。
- **Domain 参照ドライバ + fixture音素列 + 比較ゲート証人**: `sendSpeech` 追加 + `speechSections()`(こんにちは相当のモーラ列)+ `--scenario=speech` + `buildTimeline`/`--print-timeline` 拡張 + ドライバ単体タイムラインテスト(C5 `reference-driver-perceptual-timeline.test.ts` が雛形)。圧縮/perceptual無退行絶対。人間ゲート(二体並置)の証人役。

**主コスト順(推測)**:
1. **口グループ・タイムライン評価器**(§2.2/§2.3/§2.4/§2.8)——C6設計荷重のほぼ全て。**per-slot機械の延長では出ない新種の評価器**(タイムライン再生+グループ相補)。相補数学(単一進行度)自体は素直だが、per-slot曲線との調停・store内の共存形が設計荷重。
2. **契約 intent.speech + validation + dispatch分岐**(§2.5)——additive型は接地、構造は素直。**新規は可変長payloadとタイムライン長上限**(C4/C5に前例なし)。
3. **参照ドライバ + fixtureモーラ列 + 比較ゲート**(§2.6/§2.7)——`sendSpeech` と振り付け、無退行維持。器側の比較専用支援は不要(確認済み)。

**C5/C3からの再利用(事実)**: 心臓の壁時計60Hz cadence + `getChannelOverlay(nowMs, baseValues, prevResolved)` seam(`autonomous-frame-heart.ts:235-237`)・マージseam `{ ...activations, ...overlay }`・store共有配線(`input-subsystem.ts:233/244/277`)・smoothstep写経(`slot-curve-state.ts:79-82`)・release-to-living-base + releaseAll(`control-channel-overlay-store.ts:149-163`)・additive契約(supportedKinds const・dispatch分岐・byte-sync test・hello自動告知)・rejection列挙 + semantic範囲分類器・母音スロット語彙 + リゾルバ `createVowelTargetValue`(`headless-slot-resolver.ts:185-201`)・参照ドライバ骨格(RTT/hello/契約自己照合/`--print-timeline`/`--scenario`)・特区境界機構(`check-soul-zone-boundary.mjs`)は全て流用可。**C6の真の新規は「グループ・タイムライン評価器(スケジュール再生+単一進行度の相補)」1本と「可変長payload/長上限」**——前者は既存storeへの新種エントリ、後者は既存validationへの新観点。

---

## 4. リスクと未知

1. **タイムライン再生機構がper-slot機械の素直な延長で出ない(§2.2、最重要)**: C5前方互換は cadence/seam/release の**外周**を接地したが、タイムライン再生本体+グループ相補は**新種のグループ評価器**を要する。「作り直さない」の射程を外周に限定して読む必要がある。→ §6-①。
2. **相補クロスフェードの単一進行度導出(§2.3)**: Σvowel=s=mouth.open を構造保証する式(§2.3の推測式)が設計討議に明記されていない。器がグループ評価器で恒等的に満たす具体式を先に固める必要がある。→ §6-②。
3. **グループ評価器 vs per-slot曲線の同一スロット競合(§2.3)**: 発話中に `mouth-vowel-a` へ `intent.envelope` が来た場合等の調停が未定義。グループ専有 or 優先規則。→ §6-③。
4. **可変長payloadとタイムライン長上限(§2.5)**: C4/C5は固定形payloadのみで、配列長capsの前例が無い。巨大timelineのDoS的負荷への上限とvalidation語彙(超過を `invalidPayload` に畳むか)が未定義。→ §6-④/§7。
5. **s縮小係数・attack≈モーラ長の既定値と最短モーラ区間の下限(§2.4)**: 縮小係数の具体値(露出しない普遍既定)、連続性boundを導く最短区間の下限(高速モーラのスパイク上限)が未定義。→ §6-⑤/§7。
6. **ゲート前提: テストモデルの母音リグ(§2.1/§2.7)**: `mouth.vowel.*`+`mouth.open` を external-input で持つモデルが無いと、チャネル母音書込が `slotNotWritable`。トラッキング比較側は `vowelLipsyncEnabled` 有効化も要る。→ §7質問。
7. **未知: fixtureモーラ列の具体(§2.6)**: 「こんにちは」相当のモーラ列(timeMs/vowel/s)の具体値は参照ドライバ拡張時に確定。設計§5は方法(二体並置)を述べるのみ。
8. **決定論fixtureの置き場(推測)**: グループ評価器は store層の純関数(現行 `snapshot` も純)にでき、「モーラ列+tick列→6値の出力列」を store単体で固定できる(C5同様、心臓統合層で連続性性質テスト)。fake timer不要。低リスク。

**発見したドキュメント矛盾/ギャップ(黙って直さず列挙)**:
- **c6設計§7「vowelスロットの現状」等の観点列挙は、C5で `intent.envelope` が母音スロット(`channel-intent-envelope-payload-schema.json:23-27`)まで含めて追加済みである事実を織り込んでいない**。C6は「母音スロットへ書く経路」自体は新設不要(§2.1)——新設はタイムライン再生とグループ相補のみ。設計討議の「相乗り」記述はこの区別(母音経路は既存流用/タイムライン+相補は新規)を明示していない。
- **c6設計§2の相補式が未記載**: 「凸×凸のクロスフェードは凸」とあるが、器がグループ評価器で恒等的に満たす**具体的な進行度分配式**(§2.3)は討議に無い。実装前に固める先行判断。
- **タイムライン長上限への言及が無い(c6設計)**: 可変長payloadは C6 初。DoS/検証観点が設計討議に不在(§2.5/§4-4)。
- **attackフィールドの有無**: c6設計§3.2「attack≈モーラ長」は、`intent.speech` payloadに attack を持たせず**モーラ間隔から動的導出**する含意(§2.4)。C5 `intent.envelope` が明示 attackMs を持つのと対照的で、契約形状の差として明示が要る。
- **名前衝突の連鎖注意(事実)**: C4「envelope(封筒)」/ C5「envelope(曲線)」に続き、C6で「timeline」「speech」「curve」が増える。`slot-curve-state.ts` は per-slot曲線、C6のグループ評価器は別モジュール名(例 `speech-timeline-state`)にし、C5命名規律(curve系 vs envelope)を延長する規律が要る。

---

## 5. Verdict

**`needs_design`**。

C5が「storeの時間発展化」を完了し、心臓の壁時計60Hz cadence・`getChannelOverlay` seam・マージseam・smoothstep写経・release-to-living-base・additive契約(二度の kind追加が完了)・母音スロット語彙+リゾルバ・参照ドライバ骨格を残したおかげで、**C6の外周(タイムライン評価のcadence・合成・release・契約追加・比較ゲート)は極めて高く接地している**。しかしC5の前方互換が約束した「本機構の上に載る」は**外周に限って真**であり、C6の核である (1)**将来時刻つき目標列の再生機構**と (2)**5母音+mouth.openを単一進行度から連動させる相補クロスフェード**は、per-slot独立の `SlotCurveState` 機械の素直な延長では出ず、**別種の「口グループ・タイムライン評価器」の新設**を要する。加えて **intent.speech は C4/C5 が持たなかった可変長payloadを初めて持ち込み、タイムライン長上限という新しいvalidation観点**を生む。wave分割の前に §6 の先行判断5点——(i)タイムライン再生の載せ方、(ii)相補クロスフェードの単一進行度導出式、(iii)グループ vs per-slot 調停、(iv)タイムライン長上限とvalidation語彙、(v)s縮小係数/attack導出の置き場と既定値——がグループ評価器の内部形とドメイン分割の前提になり未確定。裁定が済めば実装は素直で、C5/C3資産を大きく再利用できる。

---

## 6. 先行判断すべき論点(wave計画前にユーザー/Undine裁定)

1. **タイムライン再生の載せ方**(§2.2、最重要): **候補(iii) 口グループ・タイムライン評価器(store内に per-slot `SlotCurveState` とは別種のグループエントリを新設し、`snapshot(nowMs)` 内でモーラ区間+進行度を評価)** で確定か。それとも (ii) per-slot曲線への timeline相追加、(i) 器内スケジューラが per-slot envelope をモーラごとに発火、のいずれか。推奨は(iii)(相補性の構造保証・心臓の唯一frame source思想との整合)。この裁定がグループ評価器の存在形とstore内部モデルを決める。
2. **相補クロスフェードの単一進行度導出式**(§2.3/§6-①前提): `vowel[v_i]=s(t)(1-p)` / `vowel[v_{i+1}]=s(t)p` / `mouth.open=s(t)=lerp(s_i,s_{i+1},p)`、`p=smoothstep(区間内進行)` で Σvowel=s=mouth.open を恒等成立させる形で確定か。境界(モーラ列先頭の立ち上がり・末尾の終端・同一母音連続・単一モーラ)の扱いも併せて。
3. **グループ評価器 vs per-slot曲線の同一スロット調停**(§2.3): 発話中に `mouth-vowel-*` へ per-slot `intent.envelope`/`intent.set` が来た場合、**グループ評価器が6母音スロットを専有**(per-slotは無視/拒否)か、後着優先で橋渡しか。store内の合成規則を1箇所で決める。
4. **タイムライン長上限とvalidation語彙**(§2.5/§4-4): 可変長payloadのDoS対策として**最大モーラ数 or 最大タイムライン総時間の上限**を持つか(推奨: 持つ)。超過を**既存 `invalidPayload` に畳む**か、独立rejection codeを additive に足すか(C5裁定4「新code増やさない」の延長で invalidPayload 推奨)。空タイムライン・非単調timeMs・未知vowel labelの扱いも同時に。
5. **s縮小係数・attack導出・最短モーラ区間の下限**(§2.4): s縮小係数を非露出の普遍定数(release/attack既定と同じ流儀、`slot-curve-state.ts` 隣)として置く方針と具体値。attackを**モーラ間隔から動的導出**(payloadに attack を持たせない)で確定か。連続性boundを導くための最短モーラ区間の下限をvalidationに持つか(高速モーラのスパイク上限)。

---

## 7. 質問(Undine経由でユーザー確認したい点)

1. **テストモデルの母音リグ前提**(§2.1/§2.7/§4-6): C6ゲート(自律ホストの発話)には、ロードするモデルが `mouth.vowel.a/i/u/e/o` と `mouth.open` を external-input リグパラメータとして持つことが前提(無ければチャネル母音書込が `slotNotWritable`)。**この語彙を満たすテストモデルは手元にあるか**。トラッキング比較側(a)は加えて `vowelLipsyncEnabled` を有効化した状態での実発話が要る——この設定の実演でよいか。
2. **fixtureモーラ列の具体フレーズ**(§2.6/§4-7): 参照ドライバに置く fixture音素列は「こんにちは」相当のモーラ列(例 `o/a/…` の {timeMs,vowel,s})でよいか。比較ゲートで並置する**決まったフレーズの指定**があれば(ユーザーが実演で言うフレーズと一致させる)。s の縮小前の基準値(各モーラの開き強度)の目安も。
3. **タイムライン長上限の具体値**(§2.5/§6-④): 最大モーラ数(例 256)/最大総時間(例 30秒)等、DoS上限の希望値はあるか。C5機械ゲートの数値化に必要(超過→拒否、クランプ禁止)。
4. **s縮小係数の具体値・命名**(§2.4/§6-⑤): 発話時の開き上限を決める普遍縮小係数(露出しない)の目安値(例 0.7〜0.85)の希望はあるか。C6グループ評価器の命名(`slot-curve-state` と衝突しない `speech-timeline-*` 系)で進めてよいか(C5命名規律の延長)。

---

## 付録: 主要ファイル索引(絶対パス)

**口グループ・タイムライン評価器 / store(観点2/3/4/8、C6の核)**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\control-channel-overlay-store.ts`(:67 `#curves` per-slot Map[別種グループエントリの新設対象]・:95 setOverlay・:118-132 setEnvelope[setSpeech雛形]・:149-163 releaseAll[グループforced-release雛形]・:175-194 snapshot[nowMsスケジュール評価点]・:239-242 livingBase[口=0=閉口])
- `...\apps\runtime-player\src\main\control-channel\slot-curve-state.ts`(:59-69 SlotCurveState[単一目標・per-slot]・:79-82 smoothstep写経・:106-152 sampleSlotCurve[純評価]・:111-119 forced-release・:26/:38/:46 普遍定数[s縮小係数の置き場流儀])

**心臓cadence / マージseam(観点2、無改造で流用)**:
- `...\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(:45 60Hz・:215 wallNowMs・:235 getChannelOverlay呼び出し[スケジュール評価cadence]・:237 マージseam[不変]・:255-258 心臓リゾルバ[vowelLipsyncゲート無し]・:309 setInterval)
- `...\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(:233-234 store生成・:244-245 getChannelOverlay配線[snapshot供給]・:277 getControlChannelOverlayStore共有)

**母音スロット / リゾルバ / 推定器(観点1/7)**:
- `...\apps\runtime-player\src\main\live-mapping\semantic-slot-definitions.ts`(:117-126 mouth-open・:128-136 mouth-smile[グループ外]・:138-191 mouth-vowel-a/i/u/e/o[vowelLabel付き])
- `...\apps\runtime-player\src\main\live-mapping\headless-slot-resolver.ts`(:107 mouth-vowel分岐・:159-175 createWeightValue[mouth-open]・:185-201 createVowelTargetValue[線形写像・strength非再適用]=チャネル母音も通る同じドア)
- `...\apps\runtime-player\src\main\live-mapping\vowel-lipsync-estimator.ts`(:58-61 VowelEstimate{s,weightByVowel}=Σ=s)
- `...\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame.ts`(:94 vowelLipsyncEnabledゲート[写像層のみ]・:180-182 mouth-open=s・:270 母音活性化=s×weight[Σvowel=s=mouth.open])
- `...\apps\runtime-player\src\main\live-mapping\runtime-export-auto-mapping.ts`(:10-50 createAutoMappingSlots[targetありで enabled=母音リグ前提])

**契約 additive(観点5)**:
- `...\apps\runtime-player\src\main\control-channel\contract\channel-protocol-contract.ts`(:32-35 supportedKinds const[speech追加点]・:41-49 rejection列挙・:140-146 IntentEnvelopePayload型[speech型の雛形])
- `...\apps\runtime-player\src\main\control-channel\contract\channel-envelope-schema.json`(:7 supportedKinds[外殻・speech追加点])
- `...\apps\runtime-player\src\main\control-channel\contract\channel-intent-envelope-payload-schema.json`(:23-27 母音slot enum・:61 mouth-vowel域[0..1]=speech schema の雛形)
- `...\apps\runtime-player\src\main\control-channel\contract\channel-protocol-contract.test.ts`(:30 supportedKinds byte-sync・:55/:172 payload schema byte-sync=speech追加時に両更新)
- `...\apps\runtime-player\src\main\control-channel\channel-intent-validation.ts`(:199-247 validateControlChannelIntentEnvelope[speech validationの雛形]・:296 parseDurationMs[非負]・:282 zero-life拒否[空/長上限の前例])
- `...\apps\runtime-player\src\main\control-channel\channel-request-dispatch.ts`(:108-111 kind分岐[speech分岐追加点]・:41-49 ControlChannelEnvelopeWrite[SpeechWrite雛形]・:147-181 dispatchIntentEnvelope[dispatchIntentSpeech雛形])
- `...\apps\runtime-player\src\main\control-channel\semantic-slot-normalized-range.ts`(mouth-vowel域[s域チェックに流用])

**サーバ / release(観点5/8)**:
- `...\apps\runtime-player\src\main\control-channel\channel-server.ts`(:131 nowMs・:199/:333 releaseAll[切断→口閉じる]・:303-316 setEnvelope配線[setSpeech配線点]・:275-325 handleClientMessage[speech分岐追加点])

**参照ドライバ / fixture音素列(観点6/7)**:
- `...\apps\soul\reference-driver\reference-driver.mjs`(:94/:262-273 --scenario[speech追加点]・:99-103 --print-timeline・:333-368 perceptualSections[speechSections雛形]・:401-410 buildTimeline・:638-661 sendEnvelope[sendSpeech雛形]・:503-542 loadContract[契約自己照合])
- `...\apps\runtime-player\src\main\control-channel\reference-driver-perceptual-timeline.test.ts`(ドライバ単体タイムラインテスト=speechドライバテストの雛形)
- `...\scripts\check-soul-zone-boundary.mjs`(特区一方向依存の機械検証)

**physiology(観点8、口を産まない確認)**:
- `...\apps\runtime-player\src\main\physiology\`(mouth/vowel 参照0件=生成器は口活性化を産まない→release先=口0=閉口)
