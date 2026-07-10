# 調査: 自律ホストの生理駆動 Stage Motion — 機構と実現可能性

> Status: 調査完了(Sylph、2026-07-10)。対象=`apps/runtime-player` 現HEAD(C2実装済み)。本文書は research/ 配下=リポジトリ事実の置き場。**事実**はファイル:行で接地し、設計上の見立ては「推測:」を前置する。ソース変更・テスト実行・アプリ起動は行っていない(読み取りのみ)。
> 依頼元: Undine(L0)。論点=ai-cohost C3「視線と頭が生きる」討議中に提起された「自律ホストの idle モーションに Stage Motion(体の向きが変わると画面上の位置も若干動く)を組み込むべきか」。

---

## 1. 要約(先に結論)

- **Stage Motion の純計算器 `composeRuntimePlayerStageMotionTransform` は既に head-less**(トラッキングフレームもキャリブレーションも見ない。正規化済み signed 入力 `horizontalInput`/`depthInput` (-1..1) だけを受ける)。トラッキング結合は薄いラッパ `RuntimePlayerStageMotionRuntime.update` だけに閉じている。**これが生理駆動の最も安い一貫した継ぎ目。**
- **現状の自律ホストでは Stage Motion は「合成されているが不活性」**。パネルは出る(Stage ページ)が、`update()` が `trackingFrame === null || inputProfile === null` で毎回 reset → 常に base transform を返す。ユーザーが Enabled を押しても効果ゼロ。
- 推奨継ぎ目: **候補(c) = 純計算器 `composeRuntimePlayerStageMotionTransform` を再利用し、C3 の姿勢/視線生成器が出す正規化済み activations を Stage 入力として供給する**。偽の TrackingFrame・偽の InputProfile・偽のキャリブレーションを一切作らない。sanitization 境界(Browser Source へは composed transform のみ)はそのまま保たれる。
- 概算コスト: 小〜中(実質 3〜5 ファイル、新規テスト込みで ~1 wave の 1 ドメイン相当)。既定 off は既に構造で担保済み(`enabled: false` がデフォルト)。
- リスク上位: (1) 姿勢 `body.angle`(モデル変形)と Stage offset(表示変位)の**同一信号二重適用で動きが過剰**になる、(2) Stage Motion 設定の意味論が「カメラ/キャリブレーション前提の表示補正」であり自律ホスト(カメラ無し)に混ぜると UX 上の意味が濁る。

---

## 2. 観点別 事実

### 2.1 観点1: Stage Motion 機構の全容

**層の分離(重要)** — Stage Motion は3層に分かれている:

| 層 | ファイル | 責務 | 入力 |
|---|---|---|---|
| 純計算器 | `apps/runtime-player/src/main/stage-motion/stage-motion-transform.ts` | dead-zone / strength / limit / reaction 平滑 / clamp / transform 合成 | **正規化済み signed 数値** `horizontalInput`/`depthInput`(`number \| null`、内部で -1..1 clamp)。**TrackingFrame も calibration も見ない** |
| トラッキング結合ラッパ | `apps/runtime-player/src/main/stage-motion/stage-motion-runtime.ts` | TrackingFrame の head 位置 + InputProfile calibration → 正規化 signed 値に変換して上を呼ぶ | `TrackingFrame`, `InputProfile`, `sessionNeutral` |
| 正規化ヘルパ | `apps/runtime-player/src/main/stage-motion/stage-motion-input.ts` + `input-profiles/input-profile-head-position-normalization.ts` | head positionRaw + calibration.headPositionRaw → -1..1 | calibration 依存 |

- **入力**(現行トラッキング経路): `trackingFrame.head.positionRaw`(`TrackingVector3`)+ `inputProfile.calibration.headPositionRaw`(near/far 明示キャリブレーション含む)。`stage-motion-runtime.ts:55-66`。左右は `normalizeInputProfileHeadPositionHorizontal`、奥行きは `normalizeInputProfileHeadPositionDepth`。どちらも calibration-ready でなければ `null`(`stage-motion-input.ts:11-16`)。
- **計算場所**: main 所有。`RuntimePlayerStageMotionRuntime` は `runtime-player-main.ts:231` で1個生成。フレーム更新は `publishLatestStageMotionDisplayState`(`runtime-player-main.ts:274-293`)が `stageMotionRuntime.update(...)` を呼ぶ。
- **出力の合成規則**(`stage-motion-transform.ts:91-104`):
  - `renderPan.x = baseTransform.pan.x + smoothedOffsetX`
  - `renderZoomScale = baseTransform.zoomScale * max(0.0001, 1 + smoothedScaleDelta)`
  - `pan.y` と `coordinateSpace` は base のまま。base transform は手動 pan/zoom(Window State 保存の `stageView.transform`)。**live offset は base に対する一時オフセットで、保存しない**(設計 doc §4)。
- **配布(Native Stage + Browser Source)**: `stage-motion-transport.ts` の `publishRuntimePlayerStageMotionDisplayState`。
  - Browser Source へは `createRuntimePlayerStageMotionDisplayState` が包む **`stageView.transform`(合成済み transform)のみ**(`stage-motion-transport.ts:41-55`)。raw head 位置・calibration 内部・診断は一切送らない(設計 doc §3, §7)。**これが sanitization 境界。**
  - Native Stage Window へは `deliverToNativeStageWindow`(= `stageViewBridge !== null && !isLocalPreviewLiveRenderSuspended`)のとき `publishDisplayViewTransform`(`runtime-player-main.ts:254-262`)。
- **調整パラメータ**: `RuntimePlayerStageMotionSettings` = `enabled` / `horizontal{strengthPx, limitPx, invert}` / `scale{strength, limit, invert}` / `deadZone` / `reaction`。既定は `window-state-stage-motion-settings.ts:5-19`(**`enabled: false`**, horizontal 80px/limit 120px, scale 0.06/limit 0.1, deadZone 0.03, reaction 8)。
- **手動 pan/zoom との合成**: 上記の通り base(手動、保存)+ live(生理/トラッキング、非保存)。
- **Window State 保存**: `stageMotion.settings` 配下に settings のみ保存(runtime の smoothed offset はメモリのみ)。設計 doc §6、`window-state-stage-motion-settings.ts`。
- **更新トリガ**: `liveParameters.publishFrame` のたびに `publishLatestStageMotionDisplayState({notify:"sampled"})` が呼ばれる(`runtime-player-main.ts:382`)。**自律ホストの 60Hz frame heart も `publishFrame` を叩くので、自律ホストでも毎フレーム Stage Motion update は既に走っている**(ただし入力 null で reset される。2.2 参照)。

### 2.2 観点2: 自律ホストでの現状

- **合成はされるが不活性**。role composition は `composeRuntimePlayerInputSubsystem`(`input-subsystem.ts:212-217`)で trackingHost / autonomousHost を data lookup で選ぶ。自律ホスト = `composeStaticInputSubsystem`(`input-subsystem.ts:165-197`)で、Stage Motion に効く3つの seam を全て空にする:
  - `getLatestTrackingFrame: () => null`(`input-subsystem.ts:174`)
  - `getSessionNeutral: () => null`(`:175`)
  - `getActiveInputProfile: async () => null`(`:176`)
- これらが main で Stage Motion のソースに配線される(`runtime-player-main.ts:435-437`)。したがって自律ホストでは毎フレーム `stageMotionRuntime.update()` が `trackingFrame === null || inputProfile === null` に当たり `reset()` → **常に base transform をそのまま返す**(`stage-motion-runtime.ts:43-53`)。
- **実行時 role 分岐はゼロ**。Stage Motion コードは trackingHost と全く同じ経路を通り、単に入力が null。**器の設計意図(C1 の合成テーブル一点で役割差を表現)を保っている。**
- **トグル(quick toggle)の現状**: 「Wave12 の quick toggle」に相当する専用の素早い on/off UI は**現HEADのソースには見当たらなかった**(`stage-motion-panel.tsx` に quick/toggle/wave12 の文字列なし)。存在するのは Stage ページの Stage Motion パネル内 `Enabled` チェックボックス(`stage-motion-panel.tsx:49-55`)+ `updateStageMotionSettings({enabled})` 経路(`control-window-app.tsx:775-778, 919-922`)。**推測: 依頼文の「Wave12 の quick toggle」は runtime-player 側の別 wave 計画の用語で、現HEADの Stage Motion パネルの Enabled トグルを指すか、未実装。要確認(質問参照)。**
- **Control(degraded)での見え方**: 自律ホストは入力系 IPC(input/mapping/input-profile)を合成に組み込まないため Input/Mapping ページは pending/error(degraded)になる(`discussion/ai-cohost/implementation/screens/c1-role-skeleton.md:171`)。**Stage ページ自体は生存し Stage Motion パネルも描画される**が: (a) `Enabled` を押せても効果ゼロ(2.2 冒頭)、(b) Depth Scale calibration セクションは `inputProfileStatus`(自律では null/degraded)依存(`stage-motion-panel.tsx:27,34`)なのでキャリブレーション導線が不能。つまり**自律ホストでは「押せるが効かない・キャリブ不能」な半端 UI として露出している**。自律ホスト Overview/Control UX の畳み込みは C4 スコープと明記済み(`c1-role-skeleton.md:171`)。

### 2.3 観点3: 生理駆動の実現可能性(継ぎ目候補)

**鍵**: 純計算器 `composeRuntimePlayerStageMotionTransform` が既に「正規化済み signed 値(-1..1)を入れれば composed transform が出る」head-less 部品である(2.1)。C3 の姿勢/視線生成器が出す semantic activations のうち **centered 種(body-x/body-z/gaze)は既に正規化 signed -1..1**(`headless-slot-resolver.ts:20-24` の説明、`semantic-slot-definitions.ts` の `body-x`/`body-z`/`gaze-*`)。つまり Stage の入力契約と生成器の出力契約が**同じ数値域**。偽 TrackingFrame・偽 calibration を作る必要がない。

候補比較は §3 の表を参照。

### 2.4 観点4: トグル可能性(既定 off / C3 ツマミ化)

- **既定 off は既に構造で担保**: `runtimePlayerDefaultStageMotionSettings.enabled = false`(`window-state-stage-motion-settings.ts:6`)。古い Window State も default(off)で load。
- 「実機ゲートで on/off 比較して効かなければ切る」運用にそのまま乗る。生理駆動 Stage Motion を C3 生理プロファイルのツマミの一つ(§6.1 内部スキーマの拡張、または露出は §6.3 の質感語に束ねる)にするのは自然。ただし**既存 Stage Motion `settings.enabled`(表示設定、Window State 保存、カメラ前提)と、C3 生理プロファイルの「姿勢に伴う画面ゆらぎ」ツマミ(生成器設定、seed 決定論の入力)は保存場所も意味論も別**。混ぜるか分けるかは設計判断(質問参照)。
  - 推測: C2 の baseline×modulation 構造(`c2-blink-and-generator-skeleton.md:92-94`)に合わせ、Stage sway 強度を生成器設定側の「基準値」として持ち、既定 0(= off 相当)にするのが C3 の語彙と整合的。

### 2.5 観点5: 意味論とコード上の罠

- **偽 head position でトラッキング経路を駆動する案の歪み**: `RuntimePlayerStageMotionRuntime.update` は `head.positionRaw`(生の TrackingVector3、実測 mm/座標系)を `inputProfile.calibration`(near/far 実測レンジ)で正規化する。ここへ生成値を流すには**偽の TrackingFrame + 偽の InputProfile + 偽の learnedSigns/neutral/min/max** を毎フレーム捏造する必要があり、キャリブレーション座標系の前提を壊す。**候補(a) はこの歪みを踏む。避けるべき。**
- **姿勢 `body.angle` と Stage offset の二重適用**: C3 の `body-z` slot は既に `defaultBodyRotationStrength: 0.25` / `defaultBodyPositionStrength: 0.4`(`semantic-slot-definitions.ts:214-217`)を持ち、リグ側で**体の回転に加えて位置移動まで**変形し得る。同じ姿勢信号で Stage 全体もずらすと、モデル内変形と画面変位が同方向に重なり**動きが過剰・不気味**になる危険。mitigation は Stage 側 strength/limit を小さく既定 0/off にすること。
- **Browser Source 境界**: 候補(b)(c)は同じ transport(`publishRuntimePlayerStageMotionDisplayState`)で同じ composed transform 型を出すので、生の生成値が Browser Source に漏れる経路は生まれない(sanitization 保持)。
- **reset 契約**: `stage-motion-runtime.ts` は入力欠落で `reset()`(smoothed 状態を捨てる)。生理駆動を足すとき、この reset 条件を role 差で分岐させると「実行時 role 分岐ゼロ」原則を破る。**seam(subsystem が供給する override 関数)で表現し、update 内は「override があるか否か」の data 分岐に留めるべき**(§3 推奨実装形)。

---

## 3. 実現可能性評価: 候補比較と推奨

| 観点 | (a) 生成器が head 位置相当を出し既存トラッキング入力点へ供給 | (b) 生理の姿勢基線 `body.angle` から Stage transform を別途導出 | (c) 純計算器 `composeRuntimePlayerStageMotionTransform` を直接再利用し、生成器の正規化 activations を Stage 入力に供給 ★推奨 |
|---|---|---|---|
| 継ぎ目の位置 | `stage-motion-runtime.ts` の TrackingFrame 入力点 | 新規の Stage 導出関数(compose を呼ぶか独自) | subsystem が `getStageMotionDrive(): {horizontal,depth}\|null` を供給、update が override 分岐で `composeRuntimePlayerStageMotionTransform` を呼ぶ |
| 偽データ捏造 | **要**(偽 TrackingFrame+偽 InputProfile+偽 calibration) | 不要 | 不要 |
| 意味論の歪み | **大**(キャリブレーション座標系に生成値) | 小 | 小 |
| 実行時 role 分岐 | 生まない(入力を差し替えるだけ)が捏造層が要る | subsystem seam で回避可 | subsystem seam で回避可(data lookup) |
| sanitization 境界保持 | 保つ(同 transport) | 保つ | 保つ |
| 計算経路の再利用(知識一箇所) | ラッパ経路を丸ごと再利用(ただし捏造込み) | **compose を再利用しないと二重化**。呼べば再利用可 | **compose(dead-zone/limit/reaction/合成)を丸ごと再利用**。トラッキング結合ラッパだけ迂回 |
| 姿勢との自動カップリング | 間接 | あり(同 `body.angle` 信号) | **あり**(同 activations 信号を分岐) |
| 概算規模 | 中〜大(捏造層+テスト) | 中 | 小〜中 |

**推奨: 候補(c)**。理由:
1. head-less な純計算器が既に存在するので、トラッキング結合ラッパ(`stage-motion-runtime.ts`)の TrackingFrame/calibration 要求を迂回でき、偽データ捏造ゼロ。
2. 入力は C3 生成器が出す centered activations(body-x/body-z、任意で gaze-*)を流用でき、**モデル body.angle を駆動するのと同じ信号**なので「体の向きが変わると画面位置も動く」というユーザー意図のカップリングが構造的に保証される。
3. dead-zone/strength/limit/reaction/clamp/transform 合成という「Stage Motion の知識」が一箇所(`stage-motion-transform.ts`)のまま。トラッキング経路と生理経路が同じ compose を通る = C2 で確立した「駆動源に依らず同一リゾルバ/計算器を通す」文法と一致。
4. 役割差は subsystem seam(`getStageMotionDrive` を返す/返さない)で表現でき、`update` 内は override の有無という data 分岐に留まる → 実行時 `if (role===...)` を増やさない。

**推奨実装形(推測、C3 設計時に確定させる)**:
- `RuntimePlayerInputSubsystem` に任意 seam `getStageMotionDrive?: () => { horizontal: number|null; depth: number|null } | null` を追加。trackingHost は未実装/null 返し(既存 TrackingFrame 経路のまま)、autonomousHost は frame heart が保持する最新 posture/gaze activation を -1..1 で返す。
- `RuntimePlayerStageMotionRuntime.update` に「override が非 null なら TrackingFrame/InputProfile 要求をスキップし、override の horizontal/depth を `composeRuntimePlayerStageMotionTransform` に渡す」分岐を1つ足す(reset 契約は override も null のとき従来通り)。
- frame heart(`autonomous-frame-heart.ts`)は現在 activations を tick 内ローカルで消費している(`:113-117`)。姿勢/視線 activation の最新値を subsystem から読めるよう小さな getter を露出。

---

## 4. リスク(再掲・優先順)

1. **二重適用による過剰運動**(§2.5): `body.angle`(特に `body-z` の bodyPosition 変形)+ Stage offset の同方向重畳。→ Stage 側 strength/limit を小、既定 off。実機ゲート必須。
2. **意味論の濁り**: Stage Motion 設定は「カメラ/キャリブレーション前提の表示補正」として設計(doc §2-4)。自律ホスト(カメラ無し)に同じ settings を流用すると、Depth Scale calibration 導線が無意味(§2.2)で UX が混乱。→ C3 生理プロファイル側に独立ツマミを置くか、自律では Stage Motion パネルの calibration セクションを畳む(C4 と協調)。
3. **候補(a) を採ると座標系前提を破壊**(§2.5)。採用しないことを推奨。
4. **半端 UI の放置**: 現状すでに自律ホストで「押せるが効かない」Enabled トグルが露出(§2.2)。生理駆動を足すなら、この Enabled の意味(トラッキング follow か 生理 sway か)を役割ごとに整理しないと二重に紛らわしい。

---

## 5. C3 スコープに含める場合の概算コスト

- 変更ファイル(推測): `stage-motion-runtime.ts`(override 分岐)/ `input-subsystem.ts`(seam 追加、autonomousHost で配線)/ `autonomous-frame-heart.ts`(posture/gaze activation の最新値 getter 露出)/ C3 生理プロファイル設定スキーマ(sway 強度・limit ツマミ、既定 0)/ 各テスト。実質 **3〜5 プロダクトファイル + テスト**。
- 純計算器・transport・window-state は無改変で再利用。sanitization テストは既存が効き続ける。
- 規模感: **C3 の 1 ドメイン(~1 wave 分の 1 レーン)**。C3 本体(サッカード+固視、多時間軸ノイズ、姿勢ドリフト)が body-x/body-z/gaze activation を出す前提が満たされて初めて意味を持つ(= C3 の姿勢/視線生成器に依存)。**先行するのは非効率**: Stage sway は姿勢生成器の下流なので、姿勢ドリフトが実装・美的合格した後に「同じ信号を Stage にも流すか」を実機 on/off で判定するのが自然な順序。
- 既定 off は追加コストなし(構造で担保済み)。

---

## 6. 質問(Undine 経由でユーザー確認したい点)

1. **「Wave12 の quick toggle」の実体**: 現HEADの Stage Motion には Stage ページ内 `Enabled` チェックボックスしか見当たらない(§2.2)。依頼文の quick toggle は (i) この Enabled のこと、(ii) runtime-player 側の別 wave 計画にある未実装トグル、のどちらか。想定を確定させたい。
2. **設定の置き場所**: 生理駆動 Stage sway の on/off・強度を、(A) 既存 `stageMotion.settings`(Window State、表示設定)に相乗りさせるか、(B) C3 生理プロファイル(生成器設定、seed 決定論の入力)側に独立ツマミを新設するか。§2.4/リスク2 の意味論分離を踏まえると (B) が整合的と見るが、ユーザーの意図(「Stage ページで一元管理したい」か「生理の一機能として扱いたい」か)で決まる。
3. **駆動信号の元**: Stage sway を (i) 姿勢 `body.angle`(body-x/body-z)に連動、(ii) 視線 gaze にも連動、(iii) 独立した専用ゆらぎ、のどれで駆動するか。(i) がユーザー発言「体の向きが変わると画面位置も動く」に最も忠実。(iii) は二重適用リスクを避けられるがツマミが増える。
4. **スコープ順序**: 本機能は C3 姿勢生成器の下流(§5)。C3 本体に同梱するか、C3 完了後の実機判定を経て別途足すか。

---

## 付録: 主要ファイル索引(すべて絶対パス)

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-transform.ts`(純計算器・head-less)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-runtime.ts`(トラッキング結合ラッパ)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-input.ts`(正規化ヘルパ)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-transport.ts`(sanitization 境界・配布)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\window-state\window-state-stage-motion-settings.ts`(既定 off・normalize)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\runtime-player-main.ts`(:231-437 Stage Motion 配線と subsystem seam 結線)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(:165-217 自律ホスト inert 合成・seam)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(60Hz 心臓・activations 消費)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\physiology-generator.ts`(意味スロット activations 出力)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\headless-slot-resolver.ts`(activations→parameterValues。centered 種 -1..1 契約)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\semantic-slot-definitions.ts`(:192-219 body-x/body-z)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\control\stage-motion-panel.tsx`(Enabled トグル・calibration 依存)
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\runtime-player\screens\stage-motion-head-position-follow.md`(Stage Motion 設計正典)
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\architecture\physiological-layer-and-envelope.md`(:14-16 視線/姿勢の C3 semantic slot)
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\screens\c1-role-skeleton.md`(:171 degraded と自律 UX の C4 スコープ)
</content>
</invoke>
