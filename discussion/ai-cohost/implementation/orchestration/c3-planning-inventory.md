# C3 planning gate inventory: 視線と頭が生きる(コード接地棚卸し)

> Status: 調査完了(Sylph、2026-07-11)。対象=`apps/runtime-player` 現HEAD(C2完全閉鎖済み、コミット `2386d4f` 以降)。**読み取りのみ**(ソース変更・テスト実行・アプリ起動なし)。基盤設計=[../../architecture/c3-gaze-head-posture.md](../../architecture/c3-gaze-head-posture.md)(Accepted)、UX=[../screens/c3-physiology-profile.md](../screens/c3-physiology-profile.md)(Accepted)、Stage Motion=[../../research/stage-motion-for-autonomous-idle.md](../../research/stage-motion-for-autonomous-idle.md)。
> 事実はファイル:行で接地。設計上の見立ては「推測:」を前置。C2棚卸しと同じ構造。
> 依頼元: Undine(L0)。本文書は最終報告の裏付け。Verdict は §5、先行判断すべき論点は §6。

---

## 1. 要約(先に結論)

- **C3の構造適合性は C2より良い**。C2は頭無しリゾルバを新設する必要があった(意味スロット値を受け取る口が不在だった)が、C3が使う連続値スロット(gaze/head/body)は**既に同じリゾルバ `resolveSemanticSlotParameterValues` が -1..1 signed 契約で解決しており、等価性 golden で退行が固定済み**。生成器が出す -1..1 が写像層をそのまま通る「口」は既にある。
- **主コストは4点**: (A) 生成器骨格に「層状ノイズ/ホーム-バネ」「離散イベント(サッカード・姿勢組み替え)」の振る舞いクラス追加 + 平滑ノイズ/バネ用の決定論ヘルパ新設(現状 `deterministic-hash.ts` は点サンプル `hashUnit` のみ、平滑補間・バネ積分は無い)。(B) **ツマミ→走行中生成器への即時反映経路が現HEADに存在しない**(フレーム心臓は起動時 seed だけを受け、生成器 config を差し替える口が無い)——C3の最大の新規プラミング。(C) Physiology プロファイル永続化(Dynamics Tune persistence をテンプレに並列複製)。(D) Physiology ページ + bridge + main handler(Dynamics Tune を先例に、ただし autonomousHost 専有 + trackingHost 空状態)。
- **Stage Motion供給シーム**(観点6)は前回調査(stage-motion research)で候補c確定済み。今回**Wave12 quick toggle の実体を特定**: Live Controller の "Motion Safety > Stage Motion On/Off" ボタンで、Stage ページの Enabled チェックボックスと**同一の `stageMotion.settings.enabled`(Window State、表示設定)を切り替える二重アクセスの近道**。生理駆動とは無関係の既存トグル。
- **Verdict: `needs_design`**(先行判断 §6 が5点。特に「ツマミの即時反映アーキ」「body-follow-state と決定論 fixture 境界の交差」「Physiology config を autonomous frame heart へ届ける seam の位置」は wave 分割前にユーザー/Undine 裁定が要る)。骨格適合性そのものは高く、裁定さえ済めば実装は素直。

---

## 2. 観点別リポジトリ事実

### 2.1 観点1: 生成器骨格の拡張コスト

**`PhysiologyBehavior` 契約は連続値 -1..1 を素直に表現できる(事実)**:
- `behavior-class.ts:23-25` `SemanticSlotActivationContribution = Readonly<Record<string, number>>`。値域の型制約は**無い**(単なる `number`)。docstring は blink を 0..1 と述べるが(`:19-22`)、型・生成器のマージ(`physiology-generator.ts:68-80`)は値をそのまま透過し clamp しない。**gaze/head/body の -1..1 連続角度系は型契約上そのまま乗る**。
- `sample(input: {seed, logicalTimeMs})` の純関数契約(`behavior-class.ts:56-62`)は連続ノイズにも適合。連続層状ノイズは logical time で評価する純関数なので、blink のような forward-only cursor すら不要(O(1) 評価)。離散イベント(サッカード・姿勢組み替え)は blink と同じ event-walk + cursor パターン(`blink-behavior.ts:280-337` の `walkBlinkTo`/`INITIAL_BLINK_CURSOR`)を**構造ごと流用可能**。

**決定論(hash-seed)と乱歩/多層ノイズの両立(事実+推測)**:
- 現状の決定論プリミティブは `deterministic-hash.ts` の `hashUnit(seed,index,channel)`(点サンプル [0,1]、`:55-64`)、`hashStringToSeed`、`mixSeeds`。**平滑ノイズ(補間)・バネ積分・多層合成のヘルパは存在しない**(§終盤 grep: physiology/ 内の `smoothstep` は `blink-behavior.ts:207` のローカル1個のみ)。
- 推測: 設計§1.2「ホームへのバネ付き滑らかな乱歩の層重ね」は、(i) 整数時刻ラティスで `hashUnit` を引き smoothstep 補間する value-noise を作り、(ii) 時間軸の違う3層を振幅比で合成、(iii) ホームへ引く項を足す、で決定論のまま構築できる。バネを「dt に依存する状態積分」で書くと**フレームレート依存 = 純関数性が崩れる**ため、**time の閉形式関数(積分済みの減衰乱歩)として書くのが C2 の純関数 fixture 規律と整合**。新規ヘルパは小さいが「決定論のまま滑らかさを作る」設計判断を1つ要する(§6-1)。
- サッカード(離散着地点抽選 + 固視時間分布)は blink の event-walk と同型。着地点の「重み付き空間バケツ抽選」(設計§1.1)は `hashUnit` の別 channel で実装可能。

**規模感**: 振る舞いクラス3種(gaze/head/posture)+ 平滑ノイズヘルパ + fixture。生成器 body(`physiology-generator.ts`)は無改変で behaviors 配列に足すだけ(`:48` `config.behaviors ?? [createBlinkBehavior()]`、拡張点は設計どおり機能)。

### 2.2 観点2: 対象スロットの写像既定

**スロットは全て存在し、-1..1 系で正しく動く(事実、`semantic-slot-definitions.ts`)**:

| スロット | target | sourceKind | defaultInvert | defaultStrength | 備考 |
|---|---|---|---|---|---|
| `gaze-horizontal` | eyeball.x | gaze-centered | false | 1 | `:96-105` |
| `gaze-vertical` | eyeball.y | gaze-centered | false | 1 | `:106-116` |
| `head-horizontal` | face.angle.x | head-centered | false | 1 | `:42-52` |
| `head-vertical` | face.angle.y | head-centered | false | 1 | `:53-63` |
| `head-tilt` | face.angle.z | head-centered | false | 1 | `:64-74` |
| `body-x` | body.angle.x | body-x | false | **0.35** / smoothing 0.75 | `:192-203` |
| `body-z` | body.angle.z | body-z | false | **1** / smoothing 0.75 / rot 0.25 / pos 0.4 | `:204-219` |

- **センター0の双方向スロットは正しく機能(事実)**: `createCenteredTargetValue`(`headless-slot-resolver.ts:137-157`)は normalized を [-1,1] に clamp し、`>=0` は default→max、`<0` は default→min へ写す。**0 = target.default(中立)**。生成器が center=0 の -1..1 を出せば、視線・頭・体は各既定位置を中心に双方向へ振れる。gaze/head は defaultStrength 1・invert false でそのまま。
- **C2 の eye-blink と違う注意点(事実)**:
  1. blink は weight 種(`createWeightValue`、0..1、`:159-175`)で min↔max へ張る。gaze/head/body は centered 種で**default を軸に非対称**に張る。生成器の極性語彙が異なる(blink: 0=開/1=閉 の片側 vs gaze/head/body: 0=中立の両側)。
  2. **body slot の smoothing state(観点で指名された点)**: `body-x`/`body-z` だけ `applyBodySmoothing`(`:203-217`)を経由し、`RuntimePlayerBodyFollowState.apply`(`body-follow-state.ts:14-35`)を通る。これは **slotId ごとの状態を持つ EMA**(`next = prev + (target-prev)*(1-smoothing)`、`:30-31`)で、**dt でなく呼び出し回数に依存**する frame-rate 依存の平滑器。
     - **重要な交差点**: フレーム心臓の tick は `resolveSemanticSlotParameterValues({slots, activations})` を **`bodyFollowState` 無しで**呼んでいる(`autonomous-frame-heart.ts:114-117`)。ゆえに現状 body slot が来ても**un-smoothed で解決**(`headless-slot-resolver.ts:212-216` の `?? targetValue`)。C3で body を駆動する時、この stateful EMA を経由させると **生成器出力が「累積状態依存 = 非純関数」になり、C2 の決定論 fixture 属性(seed+config+time→slot列 が pure)を body 列について破る**。→ 設計判断(§6-2): body 平滑は (a) 生成器内部の決定論バネで完結させ body-follow-state を通さない(fixture 境界を清潔に保つ、推奨)か、(b) タイムスタンプ/sequence と同じく「fixture 境界外の runtime 段」と割り切る。
  3. **body-z は slot.invert/slot.strength を無視**(`headless-slot-resolver.ts:123-133` は invert:false, strength:1 をハードコード)。実効の体運動量は下流の rotation 0.25 / position 0.4 で決まる。→ 生成器が body-z に full -1..1 を出しても最終変位は小さい。姿勢ドリフト(小振幅)には好都合。
- **推測**: gaze/head は stateless pure(body-follow-state を通らない)なので、fixture で raw activation を pin するのは C2 と全く同じ形で済む。

### 2.3 観点3: プロファイル永続化の再利用

**Dynamics Tune persistence は完成度の高い再利用テンプレ(事実)**:
- 三部品: `DynamicsTuningProfileStore`(store。fingerprint パス `<root>/<safePackageId>/<fingerprint>.json`、load 状態 missing/loaded/read-failed、identity 照合、`dynamicsTuning-profiles/` サブディレクトリ、`dynamics-tuning-profile-store.ts:34-161`)/ `DynamicsTuningProfileSaveController`(debounce 既定750ms、scheduleSave/flush/saveNow、多段状態遷移、`dynamics-tuning-profile-save-controller.ts:30-168`)/ `RuntimePlayerDynamicsTuningState`(revision 追跡、override map、profileStatus= default/restored/stale/load-warning/unsaved/saving/saved/save-failed、`dynamics-tuning-state.ts:39-377`)。
- **stale 拒否**は `dynamicsSignatureHash` 不一致で発火(`dynamics-tuning-state.ts:315-329`)。identity 照合は packageHash 優先 fallback で id+revision+parameterSignatureHash(`dynamics-tuning-profile-store.ts:163-182`)。
- **保存先は既にスロット scoped(事実)**: `app.setPath("userData", launch.slotUserDataPath)`(`runtime-player-main.ts:129`)で userData がスロット配下へリダイレクト済み。store は `app.getPath("userData")` を使う(`:407-408`)ので、**同じパターンを踏めば Physiology プロファイルも自動でスロット userData 配下**(UX §4「スロット内」を構造で満たす)。

**切り方(推測)**: **並列複製**を推奨、**共通化は限定的**。理由:
- save-controller は `RuntimePlayerDynamicsTuningState` の具体メソッド(`canSaveTuningProfile`/`needsTuningProfileSave`/`createTuningProfileSnapshot` 等)に密結合。ジェネリック化は interface 抽出が要り、C3で1回しか再利用しないなら過剰。
- **stale の意味論が違う**: Dynamics Tune は「同一 export でも dynamics 定義が変わったら無効」を `dynamicsSignatureHash` で判定。Physiology のツマミは**モデル非依存の普遍語彙**(頻度・落ち着き等、UX §3/設計§6)で、export の parameter/dynamics に紐付かない。ゆえに Physiology の stale は「別 export をロードしたら別 fingerprint ファイル」= **fingerprint パス分離だけで足り、dynamicsSignatureHash 相当は不要**(schemaVersion 不一致 reject のみ)。→ **Physiology 版はより単純な identity(export fingerprint + schemaVersion)で store/state を新設**するのが素直。save-controller の debounce/flush ロジックは形をコピー。

### 2.4 観点4: Control ページ追加の型

**Dynamics Tune が完全な先例(事実)**:
- nav 追加: `control-window-shell.tsx:34-54` の `ControlWindowPage` union + `controlWindowPages` 配列に1行(`"dynamics-tune"`/`{id,label}`)。Physiology は `"physiology"` を追加。
- ページ本体: `dynamics-tune-page.tsx`(スライダー spec 配列駆動、空状態3種、`:345-365` EmptyState)。Physiology はセクション(Blink/Gaze/Head/Posture/Stage Presence)+ Reset ボタン + Stage Presence トグルの純表示。**質感語スライダーのみ**(UX §3、工学数字禁止)。
- bridge 配線: `control-window-app.tsx` に status state(`:100-101`)、`connectControlWindowDynamicsTuningStatusBridge`(`:642-659`、getStatus + onStatusChanged 購読)、update/reset/retry ハンドラ(`:661-690`)、ページ dispatch(`:892-`)。
- main handler: `registerDynamicsTuningBridgeHandlers`(`runtime-player-main.ts:438-445`)を runtime export load/unload/change/quit に配線(`:449-503`)。**両ロールで登録される**(Dynamics は export 属性なので role 非依存)。

**autonomousHost 専有 + trackingHost 空状態(観点で指名された要点、事実+推測)**:
- **degraded の既定パターン**: 自律ホストは input/mapping/input-profile registrar を合成しない(`input-subsystem.ts:165-197`、seam は全て inert)ので Input/Mapping ページは pending/error(degraded)になる(stage-motion research §2.2 / c1-role-skeleton.md:171)。**Physiology は逆向き**——autonomousHost にのみ実体があり、trackingHost で空。
- **role を挙動分岐に使わない空状態の出し方(事実の裏付け)**: renderer は startup status の role を**表示専用**に持つ(`control-window-app.tsx:585` `role={startupStatus?.role ?? null}`)。UX §6.2 は「role で nav を消す工事はしない、C1 の劣化ページ方式」を明示。→ **推奨形(推測)**: Physiology bridge を**両ロールで登録**し、その `getStatus` が「生理サブシステムの有無」を **data で返す**(trackingHost = `{ available:false }` 相当)。ページは `available:false` を見て「This host has no physiology; the body is driven by tracking.」の一文ページを描く(UX §6.2)。**renderer も main も `if(role===...)` を書かず、bridge が返す data で分岐**——C1/C2 の規律を保つ。
- **bridge が autonomousHost で「素直に通る」か(事実)**: 自律 subsystem は bridge を1つも登録しないが、Physiology bridge は Dynamics Tune と同じく**subsystem の外(main 直下)で登録**すればよい。ただし **Physiology の実体(生成器 config)は autonomous frame heart の中**にあり、これは autonomous subsystem に封じられている(§2.5)。→ bridge(main 直下)から heart(subsystem 内)へ config を届ける seam が要る = 観点5の核。**推測: Physiology state を両ロール共通で main に持ち、subsystem 合成 deps に「physiology config provider」を渡し、autonomousHost だけがそれを heart に配線、trackingHost は無視**——これで role 差は合成テーブル1点のまま。

### 2.5 観点5: ツマミ→生成器設定の反映経路

**現HEADに走行中反映の口は無い(事実、これがC3の最大新規プラミング)**:
- フレーム心臓 `start(input)` は `payload/slots/seed` のみ受け(`autonomous-frame-heart.ts:41-48`)、`createGenerator({ seed })` を **config.behaviors 無し**で呼ぶ(`:152`)→ 生成器は**既定 behaviors(blink のみ)**で構築(`physiology-generator.ts:48`)。生成器・振る舞いクラスは config を**構築時にクロージャで捕捉**(`createBlinkBehavior(config)` `:375`)。
- **走行中に config を差し替える口は存在しない**。heart に `updateConfig` は無く、subsystem interface(`input-subsystem.ts:29-44`)にも生理 config 用メソッドは無い。seed は payload identity から導出(`autonomous-frame-heart.ts:175-181`)。
- **決定論 fixture との関係(事実)**: C2 の fixture は「seed+config+time→slot列 が pure」(設計 c2 §5、`blink-behavior-fixture.test.ts`)。**ツマミ変更 = config 変更 = fixture 入力の変更**。config vN と vN+1 は各々別の決定論列で、静的 fixture で個別に pin できる。走行中の差し替え(heart が config を swap し generator を再構築)は fixture 境界の**外**の runtime 挙動で、別途「config 変更後の次 tick が新 config を反映する」テストで固定する。

**設計余地(推測)**:
- 生成器/振る舞いは (seed, config, time) の純関数なので、**config 変更時に generator を作り直す**のが最も清潔(再構築コストは小、次 tick から新 config)。forward-only cursor は epoch から再計算されても logicalTime での結果は不変(`blink-behavior.ts:387-389` の rewind 契約と同性質)なので、再構築で一瞬の不連続が出るのは「跳んだ」ように見え得る——設計判断(§6-3): 再構築時に位相を保つか許容するか。
- 必要な新規 seam: (a) heart に `updateConfig(config)` か、tick 毎に `getConfig()` を読む口。(b) subsystem deps に physiology config provider(Physiology state)。(c) Physiology bridge の update → state → provider → heart。**Blink 知識も影響**: UX §2 の画面は **Blink セクション(Frequency/Calmness/Crispness/Quirk)も含む**——C2 は blink を普遍既定値のみで実装(UI 無し)だったが、C3で初めて blink baseline を profile 駆動 + 即時反映にする。つまり blink behavior も config provider 経由に載せ替える(gaze/head/posture と同じ経路)。

### 2.6 観点6: Stage Motion供給シーム(確認)+ Wave12 quick toggle 実体

**候補c の実装点は現HEADで健在(事実、stage-motion research 再確認)**:
- 純計算器 `composeRuntimePlayerStageMotionTransform`(head-less、正規化 -1..1 入力のみ)は無改変で再利用可。生成器の centered activations(body-x/body-z、任意で gaze)を供給する seam を subsystem に足す(research §3 推奨形)。既定 off は `runtimePlayerDefaultStageMotionSettings.enabled=false` で構造担保。詳細は [../../research/stage-motion-for-autonomous-idle.md](../../research/stage-motion-for-autonomous-idle.md) §2-5。

**Wave12 quick toggle の実体を特定(前回残問の解決、事実)**:
- **= Live Controller ページの "Motion Safety" パネル内ボタン**(`live-controller-page.tsx:117-137`)。`aria-label="Toggle Stage Motion"`、表示 "Stage Motion On/Off"、`onUpdateStageMotionSettings({ enabled: !stageMotionEnabled })` を呼ぶ。読む状態は `stageState?.stageMotion.settings.enabled`(`:70-71`)。
- **これは Stage ページの Stage Motion パネル `Enabled` チェックボックスと同一の Window State フィールド `stageMotion.settings.enabled` を切り替える二重アクセスの近道**(表示設定トグル)。生理駆動とは無関係。→ research §6 の質問1(quick toggle が Enabled のことか別 wave の未実装か)の答えは **「Live Controller の Motion Safety ボタン = Stage ページ Enabled と同じ設定への quick access」**。新規トグルではない。
- **含意**: 生理駆動 Stage sway を足す場合、この既存 `settings.enabled`(カメラ/表示前提)と混同させないため、UX §2 の Stage Presence トグル(生理プロファイル側)は**別フィールド・別意味論**にすべき(research §2.4/リスク2、設計§5 裁定2 と一致)。現状 autonomousHost では `settings.enabled` を押しても効果ゼロ(input null で毎 tick reset、research §2.2)——生理駆動を足すまで自律ホストの Motion Safety/Stage Enabled は「押せるが効かない」半端 UI のまま。

### 2.7 観点7: fixture 拡張の形

**C2 fixture 方式(事実)**: `blink-behavior-fixture.test.ts`(固定 16ms×900frame の golden、同種同列・異種異列)+ `physiology-generator.test.ts` + cursor 等価性テスト。golden は blink 活性度スカラー1列(0..1)。

**連続値系への拡張(推測)**:
- 視線・頭・体は複数スロット(gaze x/y, head x/y/z, body x/z = 最大7列)× 連続値。900frame 全列 golden にすると **blink の~7倍 + 連続値の桁数**で golden が肥大。
- **推奨: サンプリング検証 + 属性検証の併用**。(i) 少数の代表 logical time でのスナップショット golden(全列)、(ii) 分布属性テスト(サッカードの固視時間分布・最短不応期・着地点ホーム重み、多層ノイズの合成周期が30秒窓で検出されないこと=設計§1.2 ゲートの機械化、C2 の `enumerateBlinkEvents` `:343-367` に相当する enumerate 系を各離散振る舞いに用意)。(iii) 決定論の芯は「同 seed+config+time→同値」を数点で pin(全列 900frame は不要)。
- **golden 肥大の実務的手当て**: フル 900frame golden は blink 1列に留め(C2 資産維持)、gaze/head/body は代表時刻スナップショット + 属性で担保。→ 「30秒眺めて機械ループに見えない」の**機械側代理指標は「合成周期の非検出」属性テスト**が本命(fixture 全列 golden ではゲートを直接は守れない)。

---

## 3. C3計画への含意(ドメイン分割の示唆、主コスト)

**ドメイン分割の示唆(推測。設計§7・§2「新語彙は層状ノイズとホーム/バネの2つだけ」と整合)**:
- **Domain 視線(サッカード+固視)**: gaze behavior class(離散イベント= blink event-walk 流用)+ 着地点分布 + gaze スロット写像(既存、stateless)。単体で「目が生きる」を美的判定。
- **Domain 頭(多時間軸ノイズ)**: head behavior class(平滑ノイズヘルパ新設 + 3層合成 + ホーム-バネ)+ head スロット(既存)。**目頭協調(結合1)**は視線 domain 完了後にカップリング追加。
- **Domain 姿勢(ドリフト+組み替え)**: posture behavior class(遅い1層ノイズ + 稀な離散組み替え)+ body スロット(**body-follow-state 交差の裁定が前提**、§2.2/§6-2)。
- **Domain ツマミ/永続化/画面**: Physiology state + store + save-controller(Dynamics Tune 並列複製)+ bridge + main handler + Physiology ページ + **config 即時反映 seam(§2.5、最大の新規)**。Blink 露出もここ。
- **Domain Stage Presence(最終・任意)**: 設計§5 裁定どおり姿勢 domain の下流。姿勢が美的合格してから on/off 実機判定。既定 off。research の候補c実装(subsystem seam + heart getter + override 分岐)。

**主コスト順(推測)**:
1. **ツマミ即時反映アーキ**(§2.5)——現HEADに口が無い、新規 seam 3点 + 生成器再構築設計 + blink 載せ替え。C3 で最も設計荷重が高い。
2. **平滑ノイズ/バネの決定論ヘルパ + 多層合成**(§2.1)——新規だが小、ただし「決定論のまま滑らか」の設計判断1つ。
3. **離散振る舞いクラス3種**——blink event-walk の型を流用でき、構造コストは中。
4. **永続化 + bridge + ページ**——Dynamics Tune テンプレで低リスク。
5. **fixture 拡張**——golden 肥大回避のためサンプリング+属性へ設計変更(§2.7)。

**C2より軽い点**: 頭無しリゾルバは新設不要(C3 の全スロットが既に同一リゾルバで -1..1 解決、退行 golden 済み)。合成テーブル・フレーム心臓・sanitization 境界・seed 導出は無改変再利用。

---

## 4. リスクと未知

1. **body-follow-state と決定論 fixture の交差**(§2.2-2): body slot を stateful EMA に通すと生成器出力が非純関数化し fixture 境界が濁る。→ 生成器内部バネで完結させるか、fixture 境界外と割り切るかの裁定が必要(§6-2)。放置すると「body 列の golden が不安定」or「二重平滑で過緩慢」。
2. **即時反映アーキの位置**(§2.5, §2.4): Physiology config を autonomous frame heart(subsystem 内)へ届ける seam の設計を誤ると、role 分岐が runtime に漏れる(C1/C2 規律違反)。→ 合成テーブル1点 + data provider で表現する形を先に確定(§6-3)。
3. **決定論のまま「滑らか」を作る**(§2.1): バネを dt 積分で書くとフレームレート依存 = 非純関数。閉形式の減衰乱歩で書く必要。ヘルパ設計の未知。
4. **30秒ゲートの機械側代理**(§2.7): 「機械ループに見えない」を fixture 全列 golden では直接守れない。合成周期の非検出という属性テストの設計が未知(閾値・窓・検出手法)。
5. **Stage sway 二重適用**(§2.6, research §4): body.angle リグ変形 + Stage offset の同信号重畳で過剰運動。既定 off・strength 小で手当て、実機 on/off 判定必須。Domain 順序を守れば先行リスクは低い。
6. **未知: 生成器再構築時の位相不連続**(§2.5): ツマミを動かした瞬間に generator 再構築で活性度が跳ぶと「機械が再起動した」印象。位相保持の要否は美的判定待ち。

**発見したドキュメント矛盾/ギャップ(黙って直さず列挙)**:
- **設計§6 の内部素子対応表に Blink 行が無い**が、UX §2 の Physiology 画面には Blink セクション(Frequency/Calmness/Crispness/Quirk)が存在。Blink の質感語→内部素子対応は C2 設計 §6.1/§6.3 に散在。**矛盾ではないが、C3 実装は「Blink も Physiology ページで初めて UI 露出 + 即時反映対象になる」ことが設計§6 表だけ見ると見落とされる**。wave 計画で Blink 露出を明示的にスコープに含めること。
- **UX §4「四層優先順位の三段目(Player側プロファイル補正)」と、C3 の実効が「普遍既定値への直接補正」である旨**は同 §4 内で自己補足済み(パッケージ宣言不在)。矛盾ではないが、Physiology profile の identity/stale 設計(§2.3)がこの「補正のみ」性質に依存する(dynamicsSignatureHash 相当が不要な根拠)ので、wave 計画で明記推奨。

---

## 5. Verdict

**`needs_design`**。

骨格の構造適合性は高い(観点1・2 は良好、C2 より軽い)。しかし wave 分割前に**§6 の先行判断5点**、特に (i) ツマミ即時反映アーキの位置と形、(ii) body-follow-state と決定論境界の交差、(iii) Physiology config を frame heart へ届ける seam、が未確定で、これらは複数ドメインに波及するため wave 計画の前提になる。裁定が済めば実装は素直で、C2 の資産(リゾルバ・心臓・永続化テンプレ・fixture 方式)を大きく再利用できる。

---

## 6. 先行判断すべき論点(wave 計画前にユーザー/Undine 裁定)

1. **決定論のまま滑らかさを作る方式**: 層状ノイズ/ホーム-バネを (a) 閉形式の減衰乱歩(time の純関数、フレームレート非依存、推奨)で書くか、(b) 別方式か。純関数 fixture 規律(C2 §5)を守る前提での確認。
2. **body 平滑と fixture 境界**: body slot を (a) 生成器内部の決定論バネで完結させ `body-follow-state` を通さない(fixture 境界を清潔に保つ、推奨)か、(b) タイムスタンプ/sequence と同じく fixture 境界外の runtime 段として `body-follow-state` を経由させるか。後者なら body 列は golden から除外し属性のみで担保。
3. **ツマミ即時反映の seam 位置と生成器再構築**: Physiology state(main、両ロール共通)→ subsystem 合成 deps の config provider → autonomousHost のみ heart へ配線、という形(role 差を合成テーブル1点に留める)でよいか。config 変更時に generator を再構築する(位相不連続を許容 or 位相保持する)か。Blink baseline もこの経路に載せ替える点の確認。
4. **Physiology プロファイルの stale 意味論**: export fingerprint パス分離 + schemaVersion reject のみ(dynamicsSignatureHash 相当は不要、モデル非依存の普遍語彙ゆえ)でよいか。store/state は Dynamics Tune の並列複製(共通化しない)でよいか。
5. **30秒ゲートの機械側代理指標**: 「機械ループに見えない」を、合成周期の非検出(多層ノイズの周期性が30秒窓で検出されない)という属性テストで機械化する方針でよいか。fixture は blink=フル golden 維持 + gaze/head/body=代表時刻スナップショット+分布属性、という配分(golden 肥大回避)でよいか。

---

## 7. 質問(Undine 経由でユーザー確認したい点)

1. **Stage Presence のスコープ順序**(設計§5 裁定1 の再確認): Stage sway は C3 本体に同梱するが「姿勢 domain が美的合格してから on/off 実機判定、効かなければ切る」を最終 domain として最後に置く、で確定か。先行実装しない(姿勢生成器の下流)方針でよいか。
2. **Blink 露出の C3 スコープ確定**(§4 矛盾): C2 で UI 無し(普遍既定値のみ)だった Blink を、C3 Physiology ページで Frequency/Calmness/Crispness/Quirk として露出 + 即時反映対象にする、で確定か(UX §2 はそう読めるが設計§6 表に Blink 行が無い)。
3. **自律ホストの「押せるが効かない」Stage Motion 半端 UI**(§2.6): C3 で生理駆動 Stage sway を足すまで、Live Controller "Motion Safety" と Stage ページ Enabled は autonomousHost で無効のまま(正規解は C4)。C3 では触らない、で確定か。

---

## 付録: 主要ファイル索引(絶対パス)

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\behavior-class.ts`(振る舞いクラス契約・値域無制約)
- `...\apps\runtime-player\src\main\physiology\physiology-generator.ts`(生成器 body・拡張点)
- `...\apps\runtime-player\src\main\physiology\blink-behavior.ts`(event-walk/cursor/エンベロープの流用元)
- `...\apps\runtime-player\src\main\physiology\deterministic-hash.ts`(hashUnit 点サンプル。平滑ノイズ無し)
- `...\apps\runtime-player\src\main\live-mapping\headless-slot-resolver.ts`(-1..1 centered 解決・body 平滑経由)
- `...\apps\runtime-player\src\main\live-mapping\semantic-slot-definitions.ts`(gaze/head/body スロット既定)
- `...\apps\runtime-player\src\main\live-mapping\body-follow-state.ts`(stateful EMA・fixture 交差点)
- `...\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(心臓・config 反映口の不在)
- `...\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(合成テーブル・seam・bodyFollowState 未配線)
- `...\apps\runtime-player\src\main\dynamics-tuning-profiles\dynamics-tuning-profile-store.ts`(永続化テンプレ store)
- `...\apps\runtime-player\src\main\dynamics-tuning-profiles\dynamics-tuning-profile-save-controller.ts`(debounce/flush テンプレ)
- `...\apps\runtime-player\src\main\dynamics-tuning-profiles\dynamics-tuning-state.ts`(revision/stale/status テンプレ)
- `...\apps\runtime-player\src\main\runtime-player-main.ts`(:129 slot userData、:406-503 Dynamics Tune 配線、:418 subsystem 合成)
- `...\apps\runtime-player\src\control\control-window-shell.tsx`(:34-54 nav)
- `...\apps\runtime-player\src\control\control-window-app.tsx`(:642-690 bridge 配線先例)
- `...\apps\runtime-player\src\control\dynamics-tune-page.tsx`(ページ先例)
- `...\apps\runtime-player\src\control\live-controller-page.tsx`(:117-137 Wave12 quick toggle 実体=Motion Safety ボタン)
</content>
</invoke>
