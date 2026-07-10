# C2 planning gate inventory: 「身体が呼吸する(まばたきゴール)」コード接地棚卸し

> Status: 調査完了(Sylph、2026-07-10)。読み取りのみ・ソース無変更。
> 対象: `apps/runtime-player`(C1 実装済み・現 HEAD + 作業ツリー、コミット 0603d05 反映済み)。
> basis: [architecture/c2-blink-and-generator-skeleton.md](../../architecture/c2-blink-and-generator-skeleton.md)(Accepted, 特に §3.3 の未検証2項目) / [architecture/physiological-layer-and-envelope.md](../../architecture/physiological-layer-and-envelope.md)(§5 生成器の packages 居住) / [research/runtime-player-input-integration.md](../../research/runtime-player-input-integration.md) / [c1-wave-plan.md](c1-wave-plan.md) §4・[c1-planning-inventory.md](c1-planning-inventory.md)
> Verdict: **needs_design**(§末尾。先行判断3件。ただし実装基盤は概ね ready で、判断は狭く追跡可能)

事実と推測を区別する。行番号は調査時点。「推測:」を付けたもの以外はコード上の事実。

---

## 観点1【必須】: 写像機構の「頭無し」再利用性

**リポジトリ事実**

- C1 の自律ホスト合成は入力3レジストラ(input / input-profile / model-mapping)を**組み立てない**。`composeStaticInputSubsystem`(`role-composition/input-subsystem.ts:150-166`)は全メソッドが inert(`publishLatestParameterFrame: async () => {}`、`setRuntimeExportPayload: async () => {}` 等)。役割選択は `runtimePlayerInputSubsystemComposers`(同 173-179)の data lookup 一点、実行時 `if(role)` 無し。
- 写像の中身は**入力系レジストラから独立に純粋**に動く:
  - Auto Mapping の生成 `createAutoMappingSlots(payload)`(`live-mapping/runtime-export-auto-mapping.ts:10`)は **payload だけの純関数**。UI・renderer・calibration・profile store に非依存。入力は `payload.artifacts.model.inputManifest.externalInputParameterIds` と `parameters`(同 55-68)。まぶたは `targetAliases:["eye.left.open"]/["eye.right.open"]`(`semantic-slot-definitions.ts:79,89`)を preset alias / parameterId / displayName の順で解決(`runtime-export-auto-mapping.ts:105-134`)。
  - 発火タイミング: `mappingState.setRuntimeExportPayload()`(`live-mapping/live-mapping-state.ts:88-118`)内で `createAutoMappingSlots` を無条件に呼ぶ。**Runtime Export ロード時に自動で auto-map が確定**する(`runtime-player-main.ts:465` `onRuntimeExportLoaded` → `inputSubsystem.setRuntimeExportPayload` 経由)。ユーザー操作の「Regenerate Auto Mapping」ボタン(`model-mapping-bridge-handlers.ts:155`)は再生成の手動口にすぎず、初回 auto-map には不要。
  - スロット→パラメータ解決 `createRuntimeParameterFrame()`(`live-mapping/runtime-parameter-frame.ts:44`)も純関数。renderer/IPC に非依存。
- profile store(`ModelMappingProfileStore`)との関係: `modelMappingBridge.setRuntimeExportPayload` は `profileStore.loadProfile(payload)` を **await するが**(`model-mapping-bridge-handlers.ts:76-83`)、profile が無ければ auto-map スロットのまま(`live-mapping-state.ts:100-105`「No saved profile; using Auto Map」)。**profile store は省略可能**(`RegisterModelMappingBridgeHandlersInput.profileStore?` は optional、`model-mapping-bridge-handlers.ts:30,62,76`)。
- renderer ページへの依存: model-mapping bridge は `ipcMain.handle` 群(`model-mapping-bridge-handlers.ts:152-246`)と `webContents.send(statusChanged)`(258-268)を持つが、これらは Control ページの Mapping UI 用。**フレーム生成経路(`publishLatestParameterFrame`)自体は renderer 応答を待たない**。ただし Control shell が Mapping ページ不在を許容するかは C1 で既に解決済み(自律ホストは入力3レジストラ無しで起動している=実機で成立)。

**「頭無し」で写像を復帰させる依存関係(事実+推測)**

- **事実**: 意味スロット→パラメータの写像に本当に要るのは (a) `createAutoMappingSlots(payload)` が返す slots、(b) スロット→値変換ロジック(`createRuntimeParameterFrame` 内の `createWeightValue` 等)の2つだけ。入力UDP・キャリブレーションUI・Input/Mapping ページのいずれも、この2つの**動作**には不要。
- **事実(重要な障害)**: しかし `createRuntimeParameterFrame` の**入力契約は TrackingFrame + InputProfile 前提**(`CreateRuntimeParameterFrameInput.trackingFrame: TrackingFrame`・`inputProfile: InputProfile` はいずれも非オプショナル、`runtime-parameter-frame.ts:26-29`)。まぶた値は `trackingFrame.blendshapes.eyeBlink_L/R` を calibration 範囲で正規化して得る(同 147-164)。**意味スロット値の `Record` を直接受ける口は存在しない。** → 観点2で詳述。
- **推測**: 自律ホストで写像を「頭無し」に復帰させる最小配線は「model-mapping レジスタラ全体の復帰」ではなく、「Auto Mapping slots の生成 + スロット値変換の頭無し再利用」に絞れる。model-mapping bridge の IPC ハンドラ群(updateSlot / regenerateAutoMapping 等)は自律ホストに不要で、これらを組み込むと C2 が Mapping UI を自律ホストに持ち込む方向へずれる。

**含意**: 写像の**知識(B: どの parameterId がまぶたか)は `createAutoMappingSlots` が payload から純粋に供給できる**。復帰コストは軽い。主コストは「写像の**適用**口が TrackingFrame 形状で、意味スロット値を受けない」構造ギャップ(観点2の先行判断)側にある。

---

## 観点2【必須】: 素の既定での写像挙動 / 生成器の挿入点

**リポジトリ事実(まぶたスロットの既定)**

- `eye-blink-left/right` の既定: `defaultInvert: true`, `defaultStrength: 1`(`semantic-slot-definitions.ts:82-83,92-93`)、target alias `eye.left.open`/`eye.right.open`。
- 変換 `createWeightValue`(`runtime-parameter-frame.ts:337-353`): `activation`(0..1)→ `invert ? 1-activation : activation` → `target.min + targetActivation*(max-min)` → `default + (targetValue-default)*strength`。最後に `clamp(value, target.min, target.max)`(同 110-114)。
- **`invert:true` の意味**: blendshape `eyeBlink` は「1=閉じ」。invert により activation=0(目開き)→ targetActivation=1 → target.max(=開き)、activation=1(全閉)→ targetActivation=0 → target.min(=閉じ)。つまり**まぶたスロットは「blink 活性度(0=開/1=閉)」を入力として期待し、target.min=閉/target.max=開へ写す**という前提で既定が組まれている。strength=1 なので target 全域を使う。
- キャリブレーション・ユーザー補正が無い素の状態: blink 経路が calibration に触るのは `readRangeActivation(blendshape, calibration.eyes.blinkLeftMin, ...Max)`(`runtime-parameter-frame.ts:148-155`)の **TrackingFrame→activation 変換のみ**。activation を外から与えるなら calibration は不要。`invert`/`strength`/`clamp` の既定は**スロット(auto-map)側にあり calibration に依存しない**。→ 素の既定でまぶた写像は「blink 活性度 → target.min..max 全域、invert:true」で**まともに振る舞える**(まばたきに必要な閉/開の対応が既定で正しい向き)。
- `createRuntimeParameterFrame` の TrackingFrame 依存: まぶた以外も同様に blendshape / head rotation / eye euler を読む(`createSlotParameterValue`, 133-205)。フレームは `sourceFrameTimestampMs: input.trackingFrame.timestampMs`(119-130)でタイムスタンプを TrackingFrame から取る。

**生成器が TrackingFrame を偽造せずに済む挿入点(事実+推測)**

現状コードから、意味スロットフレーム(`eye.*.open` 活性度)を写像で解決する挿入点は2択で、いずれも**新規シーム抽出を要する**:

- **Option A(TrackingFrame 偽造・非推奨)**: 生成器が `trackingFrame.blendshapes.eyeBlink_L/R` を合成し、default calibration の `InputProfile` を添えて `createRuntimeParameterFrame` に渡す。**事実**: 汎用の「default InputProfile(default calibration 付き)」factory は見当たらない(`input-profile-document.ts` は `createEmptyInputProfileDocument()`=空 profiles のみ、126-131)。calibration 既定を別途用意する必要があり、生成器が顔面筋(eyeBlink)を演じる=research doc §7 の (a) 非推奨経路そのもの。C2 doc の問い「偽造せずに済む挿入点はどこか」に反する。
- **Option B(頭無し活性度リゾルバ抽出・設計が志向する形)**: `createWeightValue`/`createCenteredTargetValue`(現在 `runtime-parameter-frame.ts` 内の**非 export プライベート関数**)を「{slotId → 活性度} + slots → `parameterValues`」の頭無しリゾルバとして切り出し export する。生成器は `eye.*.open` の活性度(0..1)を出し、auto-map slots(観点1)経由で parameterId へ解決。calibration も TrackingFrame も不要。research doc §7 (b) セマンティック層注入と整合、C2 doc §3(i)「生成器は(A)振る舞いだけ持ち(B)身体知識は写像層」を満たす。
  - **事実(このシームは未存在)**: 現状 `createRuntimeParameterFrame` は「slots をループし sourceKind で分岐して活性度を計算 → 変換」を一体で行う(78-131)。活性度を外部から差し込む口が無いため、変換段(createWeightValue 系)の抽出リファクタが要る。これが観点1で述べた「主コスト」の実体。
  - **推測**: 抽出は局所的(変換関数は既に slot と activation だけを引数に取る形。`createWeightValue(runtime-parameter-frame.ts:337)` は `{slot, activation}` のみ依存)。TrackingFrame 依存は活性度計算段(readRangeActivation)に隔離されており、変換段は既に頭無しに近い。破壊的でない切り出しが見込める。

**含意**: 素の既定は**まばたきに対して正しい向きで振る舞う**(先行検証項目 §3.3-2 は肯定的)。ただし C2 doc §3 の「生成器は意味スロットで喋り既存写像層で解決」を偽造なしに実現するには、写像層の**適用シームを新設(Option B)**する必要がある。これは設計が既に方向を決めた事項の具体化だが、「どのシームを切るか」は先行判断(Verdict-1)。

---

## 観点3: フレーム供給の契約 / 自律ホストの心臓

**リポジトリ事実(現行フレーム経路)**

- フレーム型 `RuntimePlayerLiveParameterFrame` は `parameterValues: Record<parameterId, number>` + `sequence` + `producedAtIso` + `sourceFrameTimestampMs` + `runtimeExport:{packageId,packageRevision,loadedAtIso}`(`runtime-parameter-frame.ts:119-130`)。
- 供給口 `liveParameters.publishFrame(frame)`(合成ルートの wrap、`runtime-player-main.ts:375-399`)は **Stage window IPC と `browserSourceServer.publishLiveParameterFrame` の両方**へ送り、`publishLatestStageMotionDisplayState({notify:"sampled"})` も呼ぶ(381-384)。
- sequence 単調性: `sequence: ++liveFrameSequence`(`model-mapping-bridge-handlers.ts:52,115`)。フレーム源が単調増加を担保。
- **「フレームが来なければ dynamics も進まない」(確定)**: Stage renderer は `deltaTimeMs = lastLiveSourceTimestampMs===null ? 0 : max(0, liveFrame.sourceFrameTimestampMs - lastLiveSourceTimestampMs)`(`stage/stage-renderer/static-stage-canvas-renderer.ts:601-603`)、`frameIndex: liveFrame.sequence`(613)、`deltaTimeMs` をランタイム評価に渡す(`runtime-evaluation/runtime-export-pose-evaluator.ts:82,141`)。**dynamics(髪・体の二次揺れ)の時間前進は live frame 到着時のみ、delta は frame の `sourceFrameTimestampMs` 差分**。フレームが止まれば dynamics も止まる。
- フレーム適用ガード: `canApplyLiveParameterFrame(frame, payload)`(`static-stage-canvas-renderer.ts:51,340-342`)。生成器フレームも**ロード中 payload と一致する `runtimeExport` identity を刻む必要**がある(packageId/revision/loadedAtIso)。自律ホストは `onRuntimeExportLoaded(payload)`(`runtime-player-main.ts:462`)で payload を保持済みなので stamp 可能。

**C1 の静止表示がフレームを出しているか(確定)**

- **出していない**。自律ホスト `composeStaticInputSubsystem.publishLatestParameterFrame` は no-op(`input-subsystem.ts:157`)、`onRuntimeExportLoaded` 内 `inputSubsystem.clearLiveParameterFrame()`(`runtime-player-main.ts:469`)で live frame を消す。静止表示は `browserSourceServer.publishRuntimeExportLoaded(payload, variantSelection, dynamicsProfile)`(470-474)で**モデルを default pose ロードするだけ**。live parameter frame は流れない。
- **含意**: C2 で自律ホストがまばたきするには、**フレーム源をゼロから足す**。現行は「静止 = フレーム無し」なので、C2 は「フレーム源=生成器」の新設が本体。

**main プロセスのタイマー駆動の前例・制約(事実+推測)**

- **事実**: 現行のフレーム源はすべて**イベント駆動**(UDP 受信 `onTrackingFrame` → `publishLatestParameterFrame`、`input-subsystem.ts:90`)。**周期タイマーでフレームを吐く前例は無い**。main の `setInterval/setTimeout` 使用箇所は診断スロットル・save debounce・window-state・browser-source session 等の**補助用途のみ**(`input-diagnostics-throttle.ts`、`*-save-controller.ts`、`window-state-controller.ts`、`broadcast-source/browser-source-session.ts` 等)で、いずれもフレーム心臓ではない。
- **推測**: 自律ホストの生成器クロックは main の `setInterval`(例 30〜60Hz)で `parameterValues` を生成し `liveParameters.publishFrame` を叩く形が最も既存経路と整合。`sourceFrameTimestampMs` は生成器内部の単調時計(`Date.now()` か注入 `nowMs`)で採番し、`sequence` を単調増加させれば下流 dynamics の delta 計算がそのまま成立する。**注意点(推測)**: Electron main の `setInterval` はレンダラ描画と非同期。rAF 合流は Stage renderer 側(browser 環境)が担うため、main のタイマー精度は「概ね一定間隔でフレームを供給する」程度で足り、厳密な vsync 同期は不要。ただしタイマーのライフサイクル(quit 時 dispose)を `will-quit`/`disconnect` に結線する必要がある(観点6)。

---

## 観点4: 生成器モジュールの置き場

**リポジトリ事実**

- physiological-layer doc §2「生成の機構(ノイズ、イベントスケジューラ、合成規則)」は「**第二段で Editor のアイドルプレビューと共有されるため、Player アプリのコードではなく packages 側に住む必要がある**(§5)」と明言。§5 は「同じ生成器+同じエンベロープ+同じシード → Editor と Player が同じ動き」を fixture 契約テストで検証する等価性文化を要求。§6 未決「生成器の置き場所となる package の特定(既存 package か新設か)は実装計画時に決める」。
- c2-blink doc は置き場を再言明していない(§1「生成器の骨格はレパートリー拡張可能に切る」のみ)。
- 既存 packages(`packages/*/package.json`、10個): contracts / runtime-core / package-format / validator-core / operation-core / ai-interface / render-core / render-webgl2 / authoring-core / render-software。**「振る舞い/生理生成」に該当する既存 package は無い**(runtime-core はモデル評価=keyform/dynamics 適用であって振る舞い生成ではない)。
- 決定論の素材(観点5)は packages 内に既にある(hash ベース seeded jitter 等)。

**含意(事実+推測)**

- **事実**: 生成器を physiological-layer §5 に忠実に置くなら**新規 package(または既存 package への新モジュール)**。新 package 追加は pnpm workspace 配線(`pnpm-workspace.yaml` / lockfile)に触れる可能性が高い。C1 は `pnpm install` とロックファイル編集を契約で禁止していた(C1 wave-plan §10)。C2 でも同じ禁止が効くなら、新 package 追加は契約と衝突し得る。
- **推測(整合する置き場の選択肢)**:
  1. 新 package `packages/physiology-core`(仮)。§5 に最も忠実だが workspace 配線コスト・`pnpm install` の是非を先に裁定要。
  2. 既存 package(例 `runtime-core`)内の新サブモジュールとして生成器を置き、依存追加なしで workspace 変更を避ける。§5 の「packages 側に住む」は満たすが、runtime-core の責務(モデル評価)と生成器(振る舞い)の責務分離が濁る。
  3. **C2 限定で apps/runtime-player 内に置き、第二段(Editor 共有)で packages へ移す**。§5「第二段で作り直しが要らないため最初から想定して作る」に**反する方向**(移設が後で発生)。ただし C2 スコープはまばたきのみで Editor プレビュー不在のため、当面の実害は無い——設計思想との不整合として記録(下記不整合1)。
- 純粋・決定論のためテスト可能性はどの置き場でも保たれる(Electron 不要)。

---

## 観点5: 決定論の流儀 / fixture テスト

**リポジトリ事実**

- リポジトリの決定論乱数の流儀は**ステートフル PRNG クラスではなく hash ベースの seeded 関数**。前例: `static-stage-canvas-renderer.ts:950-988`(`hashUnit(seed,row,column,channel)` を `Math.imul`/xor/`>>> 0` で構成、`deterministicJitter(seed,...)`)、`mesh-outline-v3-envelope-generation.ts`(`seed`/`hashUnit`/`imul`)、`mesh-outline-v2/v2.5/v4` 系も同様。整数 seed → 単位区間値の純粋写像。
- 決定論的な「設定→値列」生成の前例: `authoring-host/src/perception/parameter-sweep.ts:23-45`(`computeSweptParameterValues`= graph+parameterId+steps → 決定的な値列。純関数・endpoints 厳密)。
- fixture テストの流儀: `packages/**/*-fixture.test.ts` が多数(`validator-core/src/*-contract-evidence-fixture.test.ts`、`runtime-core/src/dynamics-contract-evidence-fixture.test.ts`、`runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts` 等)。vitest ベース、package 単体で Electron 不要。
- store/bridge のテスト流儀は別途 `mkdtemp`+DI 注入(C1 棚卸し観点8)だが、生成器は I/O を持たない純関数なので該当しない。

**含意(事実+推測)**

- **推測**: 生成器の「種+設定 → 意味スロット列」fixture は、生成器が住む **package の純粋 unit/fixture テスト**(`*-fixture.test.ts` 流儀)として書くのが流儀に最も合う。hash ベース seed 関数(既存 `hashUnit` 様式)を採れば、まばたきのポアソン的間隔・二連確率・非対称イージングを seed から決定的に導出でき、C2 の機械ゲート「同じ種と設定 → 同じ意味スロット列」がそのまま fixture 化できる。ツマミ設定値(平均頻度・ばらつき・二連確率・開閉速度等、c2-blink §6.1)も fixture 入力に含める(C2 doc §5「設定を変えても決定論は保たれる」)。
- **事実**: seed をユーザーに露出しない(C2 doc §5)ため、seed の生成元(セッション内部で決定)は生成器の外(合成ルート or 自律ホスト composer)で決め、生成器へは注入する形が決定論テストと両立する。

---

## 観点6: 合成の型 / 生成器サブシステムの差し込み

**リポジトリ事実**

- C1 が確立した合成の型: `role -> composer` の `Record`(`runtimePlayerInputSubsystemComposers`, `input-subsystem.ts:173-179`)を合成ルート一点(`composeRuntimePlayerInputSubsystem(launch.role, deps)`, `runtime-player-main.ts:418`)で引く data lookup。実行時 role 分岐なし。seam 型 `RuntimePlayerInputSubsystem`(`input-subsystem.ts:24-39`)が「入力側から要る全メソッド」を集約。
- 自律ホスト composer は現状 inert(観点3)。seam には `disconnect()`(quit 時 flush、`runtime-player-main.ts:498`)、`clearLiveParameterFrame`、`setRuntimeExportPayload` 等がある。生成器はこれらの延長に自然に載る位置。
- 共有リソース: `liveParameters`(publishFrame 経路)、`liveMappingState`、runtime export payload(`onRuntimeExportLoaded`)はいずれも composer に `deps` として渡り済み(`input-subsystem.ts:45-59`, `runtime-player-main.ts:418-434`)。生成器が必要とする素材(auto-map slots・payload・liveParameters・クロック)は seam の deps 経由で揃う。

**含意(事実+推測)**

- **推測(実行時 role 分岐を生まない差し込み方)**: 2 択。
  1. **既存 seam の autonomousHost composer を「inert」から「生成器駆動」へ差し替え**。`composeStaticInputSubsystem` を「生成器クロックを起動し `liveParameters.publishFrame` を叩き、`setRuntimeExportPayload` で auto-map slots を確定、`disconnect` でクロック停止」する composer に置換。role→composer テーブルは不変。trackingHost 側は完全に無変更。**C1 の型に最も素直に載る。**
  2. seam を「入力サブシステム」と「フレーム源サブシステム」に分け、後者を `Record<role, frameSourceComposer>` で別テーブル化。分離は綺麗だが seam を1本増やす。C2 スコープ(まばたきのみ)では 1 の方が小さい。
- いずれも**役割差は合成一点の data lookup のまま**で、実行時 `if(role)` を導入しない(C1 の blocking 規律を維持)。
- **注意(推測)**: 生成器 composer は「auto-map slots を保持する頭無し写像」(観点1)と「意味スロット活性度リゾルバ」(観点2 Option B)を内部に持つ。trackingHost の model-mapping bridge(IPC ハンドラ付き)とは別実装になる——両者が Option B のリゾルバ(頭無し変換段)を**共有**すれば、写像の二重化(C2 doc §3.1 保護2)を避けられる。この共有点の設計が観点1・2 の先行判断と結ぶ。

---

## C2 計画への含意(ドメイン分割の示唆・主コスト)

**推奨ドメイン分割(推測。すべて C1 の合成型を継承)**

1. **D-A: 頭無し写像シームの抽出(主コスト・最初)** — `createRuntimeParameterFrame` から「意味スロット活性度 + slots → parameterValues」の頭無しリゾルバ(観点2 Option B)を非破壊抽出し export。trackingHost 経路は等価維持(退行禁止)。auto-map slots は既存 `createAutoMappingSlots` を再利用。観点1/2。
2. **D-B: 生理生成器(まばたき骨格)** — シード決定論の生成器(c2-blink §6.1 の内部スキーマ、baseline×modulation 構造 §6.4)を、置き場裁定(Verdict-2)に従い実装。純関数+fixture テスト(観点5)。振る舞い知識(A)のみ、身体知識(B)は持たない。観点4/5。
3. **D-C: 自律ホストのフレーム心臓** — main プロセスの生成器クロック(30〜60Hz)を autonomousHost composer に結線(観点6-1)。生成器 → 頭無しリゾルバ(D-A)→ `liveParameters.publishFrame`。sequence/timestamp 単調、runtimeExport identity stamp、quit 時 dispose。観点3/6。
4. **D-D: 統合・機械ゲート・docs** — 固定シード fixture(種+設定→意味スロット列)の回帰、typecheck/対象テスト、静止→まばたきの手動美的ゲート、docs 更新。

**主コストの所在**

- **軽い**: auto-map の頭無し供給(既存純関数)、合成一点への差し込み(C1 型が既に data lookup)、決定論の素材(既存 hash seed 流儀)、フレーム供給口(`liveParameters.publishFrame` が Stage+Browser Source 両対応済み)。
- **重い/新規**: (i) 写像適用シームの抽出(現状 TrackingFrame 形状、意味スロット値を受けない=D-A のリファクタ)、(ii) フレーム心臓の新設(周期タイマー駆動フレーム源の前例が無い=D-C)、(iii) 生成器の置き場と workspace 影響(新 package か既存内か=Verdict-2)。
- **素直に載る部分**: 役割差=合成一点、seam の inert→生成器駆動置換、まぶた既定の向き(invert:true が正しい)、決定論 fixture の書き方、フレーム identity/sequence の既存契約。
- **構造と非整合な部分**: (a) 写像の適用口が TrackingFrame 前提で意味スロット値の Record を受けない、(b) 現行「静止=フレーム無し」でありフレーム心臓が皆無、(c) 生成器の理想置き場(packages)が C1 の `pnpm install`/lockfile 禁止契約と衝突し得る。

---

## ドキュメント間の不整合(黙って上書きしない指摘)

1. **生成器の置き場: physiological-layer §5 vs C2 の Player スコープ**。§5 は「生成機構は packages 側に住む必要がある」「Player 消費側は最初から四層を想定して作る(第二段で作り直しが要らないため)」と断定。一方 C2 は apps/runtime-player(まばたきのみ、Editor プレビュー不在)のゲート。C2 の実装場所を apps 内に置くと §5 の「作り直し回避」精神に反し将来移設が発生する。packages へ最初から置くと C1 の `pnpm install`/lockfile 禁止契約(C1 wave-plan §10)と衝突し得る。→ Verdict-2 で要決。
2. **「既存写像層で解決」の口が存在しない**: C2 doc §3・§3.2 は「生成器は意味スロットのフレームを出し既存の意味スロット→パラメータ写像層で解決する」「継ぎ目は normalized tracking frame 以降を再利用」と記すが、実コードの写像適用点 `createRuntimeParameterFrame` は **normalized tracking frame(TrackingFrame)を入力に取り、意味スロット値の Record を受けない**。「再利用する継ぎ目」は概念上存在するが、意味スロット値を注入する API シームは未実装。§3.3-1 の「頭無しに回るか」への答えは「回るが、そのための適用シーム抽出が前提」。→ Verdict-1 で要決(設計方向は §3 で決定済み、具体シームが未定)。
3. **§3.2「tick はフレーム駆動」の含意の非対称**: research doc §4 と一致(確定)だが、現行自律ホストは「フレーム無し=静止」であり、C2 doc §3.2「生成器=基底フレーム源」を成立させるにはフレーム心臓の新設が必須。doc は「決定と整合」と記すが、整合の**実装的空白**(周期フレーム源が皆無)を明示していない。記録に留める(設計判断ではなく事実の補足)。

いずれも既存ドキュメント本文は変更していない。解消は設計者(Undine/Salamander)の領域。

---

## リスクと未知(調査で確定できなかったこと)

- **default InputProfile/calibration の不在**: Option A(TrackingFrame 偽造)を採る場合に要る「default calibration 付き InputProfile」factory が見当たらない(`createEmptyInputProfileDocument` は空)。Option B なら不要のため実害は Option 選択に依存。
- **main タイマーのフレーム精度・負荷**: 30〜60Hz の `setInterval` で毎フレーム auto-map slots ループ + parameterValues 生成 + IPC/WS 送信する負荷は実機未計測(推測)。Browser Source WS の毎フレーム送信は既存(トラッキング時と同レート)なので新規リスクは main 側の生成コストのみ。
- **二連まばたき・非対称イージングの意味スロット表現**: 生成器が「イベント(離散)」と「イージング途中値(連続)」の両方を毎フレーム意味スロット活性度に落とす必要がある(c2-blink §6.1 形状ツマミ)。意味スロットは活性度スカラー1本(`eye.*.open` 0..1)なので表現力は足りる(推測)が、C2 doc §6.2「左右のずれは固定=両目同時」を活性度2本(left/right)で同値供給する運用を設計で確認要。
- **workspace 配線の可否**: 新 package 追加が `pnpm install` を要するか(lockfile 更新)は未確認。既存 package 内モジュールなら回避可能。

---

## Verdict: **needs_design**

実装基盤は概ね **ready**: auto-map は payload の純関数、合成は C1 が data-lookup 一点に確立、フレーム供給口は Stage+Browser Source 両対応済み、決定論の hash-seed 流儀と fixture テスト流儀が既存。差し込み点はいずれも既存の関数境界・seam に沿う。しかし以下の**先行判断3件**が wave 計画に先行して必要(いずれも架空でなく、既存ドキュメントが未決/概念のみとして残す事項の具体化):

1. **写像適用シームの形(観点1/2、不整合2)**: C2 doc §3 が決めた「生成器は意味スロットで喋り既存写像層で解決」を偽造なしに満たす具体シーム。現 `createRuntimeParameterFrame` は TrackingFrame 形状で意味スロット値を受けない。**Option B(頭無し活性度リゾルバの非破壊抽出)**を採るという明示裁定が要る(Option A の TrackingFrame 偽造は doc の問い自体が退けている)。trackingHost 経路の等価維持(退行禁止)を前提に、抽出したリゾルバを trackingHost/autonomousHost で共有するか否かも決める(写像二重化回避 §3.1)。
2. **生成器の置き場と workspace 影響(観点4、不整合1)**: physiological-layer §5「packages 側に住む」を C2 時点で満たすか(新 package or 既存 package 内モジュール=`pnpm install`/lockfile 禁止契約との両立)、それとも C2 は apps/runtime-player 内に置き第二段で移設するか(§5 の作り直し回避に反する)。
3. **フレーム心臓の駆動契約(観点3/6)**: 生成器クロックのレート(例 30〜60Hz)、`sourceFrameTimestampMs`/`sequence` の採番元、runtimeExport identity stamp、quit 時 dispose の結線点(seam `disconnect` 延長)。周期フレーム源の前例が無いため、契約(特にアイドル時も継続供給する不変条件、research §7 (iv))を先に固定する。

これら3件が決まれば、ドメイン D-A(写像シーム抽出)→ D-B(生成器)→ D-C(フレーム心臓)→ D-D(統合・fixture ゲート)は上記の素直な差し込み点に沿って直ちに wave 化できる(実装難度は D-A/D-C が中、D-B/D-D が低〜中)。役割差は C1 の合成一点を継承し、実行時 role 分岐は導入しない。

---

## 質問(ユーザー/上位判断が必要な点)

- **Q1(写像シーム)**: 写像適用は Option B(`createWeightValue` 系を「意味スロット活性度 + slots → parameterValues」の頭無しリゾルバとして抽出・export)で確定してよいか。抽出リゾルバを trackingHost の model-mapping と共有する(二重化回避)方針でよいか。
- **Q2(置き場)**: 生成器を (1) 新 package、(2) 既存 package(例 runtime-core)内モジュール、(3) 当面 apps/runtime-player 内(第二段で packages 移設)のどれに置くか。(1) は `pnpm install`/lockfile 更新の許可が要る(C1 では禁止だった)——C2 でこの禁止を解くか。
- **Q3(フレームレート)**: 自律ホスト生成器クロックのレートは 30Hz / 60Hz いずれを既定とするか。`sourceFrameTimestampMs` は実時計(`Date.now`)採番でよいか(決定論 fixture は生成器の意味スロット列で担保し、送信タイムスタンプは決定性境界外=research §6 と整合、という理解でよいか)。
- **Q4(左右同値)**: C2 doc §6.2「両目同時・固定」を、意味スロット `eye.left.open`/`eye.right.open` へ**同一活性度を供給**する運用で実現する理解でよいか(生成器は片目差を出さない)。
- **Q5(まぶた既定の向き)**: 素の既定 `defaultInvert:true`/`defaultStrength:1` はまばたき(閉/開)に対し正しい向きで振る舞う(観点2)。この既定に**生成器は「blink 活性度(0=開/1=閉)」を出す**契約でよいか(activation の 0/1 の意味を写像の invert 既定に合わせる)。それとも生成器は「開度(1=開)」で喋り、リゾルバ側で意味を吸収するか——活性度の極性の置き場を裁定要。
