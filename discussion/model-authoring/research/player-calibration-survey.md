# 調査: player キャリブレーション機能の現状（母音キャプチャの受け皿になり得るか）

- 調査者: Sylph（風／調査）
- 依頼元: L0（Undine / Fable）
- 日付: 2026-07-06
- 種別: 事実調査（設計提案なし）。事実は file:line 証跡付き。推測は「推測」と明記。
- 対象リポジトリ: `C:\workspace\remie\code\ai-native-live2d-editor`
- 前提調査: `discussion/model-authoring/research/player-ifacialmocap-survey.md`

---

## 結論（一文）

**player のキャリブレーションは二層構造。「永続キャリブレーション（InputProfile）」＝ウィザードで頭回転/目/口/頭位置の neutral・min・max・学習符号を採り `userData/input-profiles/ifacialmocap/profiles.json` に保存するもの、「セッション中立（sessionNeutral）」＝Look Forward ボタン一発で今のフレームを neutral スナップショットとして保持する揮発値。いずれも「単一ポーズの単一/窓なしフレーム値」しか採らず、母音のような『複数ポーズの blendshape ベクトルを保存する』構造は持たない。母音キャプチャを乗せるには (a) InputProfileCalibration スキーマに新セクション、(b) CalibrationSession の prompt/評価に母音ラベル、(c) sessionNeutral 同様の揮発捕捉、のいずれかの拡張点があるが、現状『採るのは 1 ポーズ = 1 スカラー/1ベクトル、母音の 6 ラベル別 blendshape ベクトルは既存構造に無い』。**

---

## 1. キャリブレーションの種類と内容

player には **2 種類**の「中立/範囲」保持がある。

### 1-A. 永続キャリブレーション = `InputProfileCalibration`

- 定義: `apps/runtime-player/src/main/input-profiles/input-profile-document.ts:15-61`
- 全フィールド（現物スキーマ）:

| 領域 | フィールド | 内容 | 行 |
|---|---|---|---|
| 頭回転 | `headRotationEulerDeg.neutral/min/max` | euler(x,y,z) の中立と範囲 | :16-19 |
| 頭回転 | `.learnedSigns.{faceLeft,faceRight,lookUp,lookDown,tiltLeft,tiltRight}` | 各動作の軸+符号（学習した正方向） | :20-27 |
| 頭位置（任意） | `headPositionRaw.neutral/min/max` | 位置 raw の中立と範囲 | :29-32 |
| 頭位置 | `.learnedSigns.{bodyLeft,bodyRight,bodyNear,bodyFar}` | 体の左右/前後の軸+符号 | :33-38 |
| 目 | `eyes.neutral/min/max` | 視線 euler の中立と範囲 | :41-43 |
| 目 | `eyes.blinkLeftMin/Max, blinkRightMin/Max` | 左右まばたきの min/max スカラー | :44-47 |
| 目 | `eyes.learnedSigns.{eyesLeft,eyesRight,eyesUp,eyesDown}` | 視線方向の軸+符号 | :48-53 |
| 口 | `mouth.jawOpenMin/Max` | 口開閉スカラーの min/max | :55-57 |
| 口 | `mouth.smileMin/Max` | 微笑スカラーの min/max | :58-59 |

- **口は `jawOpen` と `mouthSmile` の 2 スカラー範囲のみ。母音や口形（pucker/funnel 等）のフィールドは存在しない**（:55-60）。
- InputProfile 全体: `profileId, displayName, source:"ifacialmocap", transport:"udp", createdAtIso, updatedAtIso, calibration`（:63-71）。
- デフォルト値（Temporary Defaults）: `input-profile-defaults.ts:23-60`。例: `mouth.jawOpenMin=0, jawOpenMax=0.8, smileMin=0, smileMax=0.7`（:53-58）。

### 1-B. セッション中立 = `RuntimePlayerInputSessionNeutralSnapshot`

- 定義: `apps/runtime-player/src/preload/input-profile-bridge-contract.ts:29-38`
- 全フィールド（すべて任意）: `capturedAtIso`（必須）, `frameTimestampMs`（必須）, `headRotationEulerDeg?`, `headPositionRaw?`, `leftEyeEulerDeg?`, `rightEyeEulerDeg?`, `jawOpen?`（スカラー）, `mouthSmile?`（スカラー）。
- 生成: `input-session-state.ts:344-366`（`createSessionNeutralSnapshot`）。**最新の 1 フレーム**から各フィールドを引き写すだけ。`jawOpen` は生 blendshape 値、`mouthSmile` は `mouthSmile_L/R` 平均（:378-397）。
- **揮発**（メモリ保持のみ、ファイル保存なし）。`RuntimePlayerInputSessionState.sessionNeutral` フィールドに載る（:48, 95-97, 121）。接続再開/idle 化で消える（`setListening` が `latestTrackingFrame=undefined`、sessionNeutral は明示リセットされないが接続跨ぎで意味を失う）。

### 区別（永続 vs セッション）

- **永続**= ウィザードで能動的に複数ポーズを採り min/max/学習符号を確定 → ファイル保存 → 次回起動でも残る。
- **セッション**= Look Forward ボタン 1 回で今の姿勢を「今日の座り位置の neutral」として上書き。写像時に**永続 neutral より優先**される（後述 §4）。永続は保存されずセッション終了で失われる。

---

## 2. 取得フロー（UI 操作 → 何が採取されるか）

### 2-A. Look Forward（セッション中立の即時捕捉）

- UI: `input-page.tsx:245-251` の「Look Forward」ボタン（Crosshair アイコン）。`lookForwardAvailable` で活性制御。
- IPC: `onLookForward` → `input-profile-bridge-channels` の `lookForward` → main `input-profile-bridge-handlers.ts:105-116` → `input.inputState.captureLookForward(nowMs())`。
- 採取実体: `input-session-state.ts:99-127`。**最新 1 フレーム**（`latestTrackingFrame`）をそのまま `createSessionNeutralSnapshot` でスナップショット化。**平均化なし・窓なし・単一フレーム**。フレーム未受信なら `unavailable`。

### 2-B. Calibration ウィザード（永続プロファイル生成/更新）

- UI ボタン群（`input-page.tsx:252-278`）:
  - 「Run Missing Only」= `startCalibration({mode:"missing-only"})`（:252-262）
  - 「Full Calibration」= `startCalibration({mode:"full"})`（:263-272）
  - セクション別「Calibrate/Recalibrate」= `startCalibration({mode:"section", section})`（:234-239）。**現状セクション別は頭位置(left-right / near-far)のみ**（`input-profile-calibration-start.ts:57-97`、頭回転/目口のセクション別更新は未サポート）。
- 進行 UI（`input-page.tsx:283-338`）: プロファイル名入力、Progress（completed/total）、現在 prompt、prompt 一覧、そして操作ボタン **Record Sample / Next Prompt / Save Profile / Cancel**。
- IPC → main: `input-profile-bridge-handlers.ts`
  - start `:117-137` → `createInputProfileCalibrationSessionStart`（`input-profile-calibration-start.ts:35-139`）が mode に応じ prompt 列を決めて `InputProfileCalibrationSession` を生成。
  - recordSample `:143-161` → `getLatestTrackingFrame()` を渡し `session.recordSample(frame)`。
  - advancePrompt `:162-179` → `session.advancePrompt()`。
  - finish `:180-236` → `createProfile`（新規）or `createUpdatedProfile`（頭位置更新）→ `store.saveProfile`。
- **prompt 列**（`input-profile-calibration-session.ts:95-114`, `input-profile-calibration-sections.ts:19-46,131-156`）: `look-forward`（必ず先頭, `:135`）→ head-rotation セクション(face-left/right, look-up/down, tilt-left/right) → eyes-mouth セクション(eyes-left/right/up/down, blink, **open-mouth, smile**) → head-position セクション(left/right/near/far)。**母音 prompt は無い。口は open-mouth と smile の 2 種のみ**（:34-36）。
- **採取の平均化**: なし。各 prompt は**単一フレームのスカラー/ベクトルを閾値判定 → min/max を都度拡張**する方式。
  - neutral（look-forward）: 1 フレームを `this.neutral` に格納、range を初期化（`:239-253`, `createInitialRange :870-889`）。**単一フレーム。窓平均なし。**
  - 各方向 prompt: フレームごとに `expandRange`（min/max を Math.min/max で広げる `:891-917`）、`evaluatePromptSample` が「中立からの差分が閾値超え」を判定（:638-743）。安定サンプルが `stableSamplesRequired=2` 回（口/目の方向以外）連続で必要（:30, 285-300）。**採取は「窓平均」ではなく「複数フレームにわたる min/max 蓄積 + 安定回数カウント」**。
  - 閾値定数: `directionalSampleThresholdDeg=5`, `eyeDirectionalSampleThresholdDeg=3`, `positionSampleThresholdRaw=0.05`, `blinkSampleThreshold=0.35`, `mouthOpenSampleThreshold=0.2`, `smileSampleThreshold=0.18`（:24-29）。
- **Record Sample は手動トリガ**（ボタン押下ごとに 1 回 `recordSample`）。連続自動サンプリングではない（IPC は押下 1 回 = 1 サンプル、`input-profile-bridge-handlers.ts:143-161`）。

### 関与ファイル一覧（フロー）

```
UI: input-page.tsx（ボタン）
 → preload: input-profile-bridge-channels.ts / input-profile-bridge-contract.ts（API 契約）
 → main: input-profile-bridge-handlers.ts（IPC ハンドラ, セッション寿命管理）
    ├ input-session-state.ts（Look Forward = captureLookForward）
    ├ input-profile-calibration-start.ts（セッション生成・mode 分岐）
    ├ input-profile-calibration-session.ts（prompt 進行・サンプル評価・profile 生成）
    ├ input-profile-calibration-sections.ts（セクション⇔prompt 対応・readiness 判定）
    ├ input-profile-defaults.ts（Temporary Defaults 値）
    └ input-profile-store.ts（永続化）
```

---

## 3. 保存（永続化スキーマとパス）

- 保存クラス: `InputProfileStore`（`input-profile-store.ts`）。
- **保存パス**: `<userData>/input-profiles/ifacialmocap/profiles.json`（`:41-46`、テスト `input-profile-store.test.ts:17-24` が同パスを検証）。**トラッキングソース（ifacialmocap）ごと**にディレクトリが切られる。モデルごと・グローバルではなく「入力ソース単位」。
- **保存単位**: 1 ファイル内に**複数プロファイルの配列** + `activeProfileId`。ドキュメント型 `InputProfileDocument`（`input-profile-document.ts:73-77`）: `{ schemaVersion, activeProfileId?, profiles: InputProfile[] }`。
- **バージョニング**: `schemaVersion = "runtime-player-input-profiles-v1"`（`input-profile-document.ts:3-4`）。パーサ `input-profile-document-parser.ts` がこの版で検証（読取失敗時は `read-failed` → Temporary Defaults にフォールバック `input-profile-bridge-handlers.ts:257-262`）。
- 保存形式: `JSON.stringify(document, null, 2)`（整形 JSON、`input-profile-store.ts:170-177`）。保存時 `activeProfileId` は保存プロファイルに設定（`:62-85`）。
- **セッション中立（sessionNeutral）は保存されない**（メモリのみ、§1-B）。

---

## 4. 消費（保存値が写像評価でどう使われるか）

- 写像入口: `createRuntimeParameterFrame`（`runtime-parameter-frame.ts:28-75`）。`sessionNeutral` と `inputProfile.calibration` を各スロット評価に渡す（:44-48）。
- **口（mouth-open）の意味論**（`:108-116`）:
  ```
  activation = readRangeActivation(
    blendshapes.jawOpen,
    sessionNeutral?.jawOpen ?? calibration.mouth.jawOpenMin,   // ← min（下端）
    calibration.mouth.jawOpenMax                                // ← max（上端）
  )
  ```
  - `readRangeActivation`（`:458-473`）= `clamp((value - min) / (max - min), 0, 1)`。**min→0, max→1 の線形正規化**。母音は未対応（case が無い、§前提調査）。
  - **重要**: mouth-open では `sessionNeutral.jawOpen` は **min（下端 = 閉口基準）** として使われる。neutral が「範囲下端」を意味する（centered ではない）。
- **口（mouth-smile）**（`:117-125`）: 同様に `sessionNeutral?.mouthSmile ?? calibration.mouth.smileMin` を min、`calibration.mouth.smileMax` を max とする線形正規化。
- **頭回転/視線（centered 系）の意味論**（`readCenteredNormalizedValue :198-239`）: neutral/min/max の役割が口とは**異なる**。
  - `neutral = sessionNeutral ?? profileNeutral`（:220）。sessionNeutral 優先。
  - `signedCurrent = (current - neutral) * positiveDirection`。
  - min/max は neutral からの正負レンジ（`signedProfileMin/Max = (profileMin/Max - profileNeutral)*dir`）に変換され、正側は positiveRange・負側は negativeRange で割る → **[-1,1] の双方向正規化**（:222-238）。ここでの neutral は「中心（0 になる点）」。
  - まばたき（blink-left/right）は範囲正規化（口と同じ readRangeActivation, `:91-107`）で `calibration.eyes.blink*Min/Max` を使う（sessionNeutral は関与しない）。
- **学習符号の消費**: `getHeadPositiveSign / getGazePositiveSign`（`:425-456`）が `learnedSigns.faceRight/lookUp/tiltRight/eyesRight/eyesUp` を正方向として取り、無ければ `definition.fallbackPositiveSign`。body-z の位置成分は `headPositionRaw.learnedSigns.bodyRight` を使う（`:373-407`）。
- **まとめ（neutral/min/max の役割は 2 系統）**:
  - **weight 系（口・まばたき）**: min=活性 0 の基準、max=活性 1 の基準。sessionNeutral は min を差し替える（口のみ）。
  - **centered 系（頭・視線）**: neutral=0 点、min/max=neutral 起点の正負レンジ。sessionNeutral は neutral を差し替える。

---

## 5. 拡張面（母音別参照フレームを乗せる場合の既存構造の列挙）

「母音別の参照フレーム（6 ラベル × 口形 blendshape ベクトル）を追加保存する」際に**既に存在する**部品（事実列挙のみ、設計はしない）。

### 5-A. スキーマの拡張点

- `InputProfileCalibration`（`input-profile-document.ts:15-61`）に新セクション（例: 母音参照）を足す形が構造上ある。現状は `headRotationEulerDeg / headPositionRaw? / eyes / mouth` の 4 セクション。**`mouth` は 4 スカラー（jawOpenMin/Max, smileMin/Max）のみ**で、母音ベクトルを入れる場所は無い（新規追加が必要）。
- `schemaVersion` は単一定数（v1）。**マイグレーション/多版パーサは未実装**（`input-profile-document-parser.ts` は v1 のみ検証、非該当は read-failed）。母音を足すと版上げが必要になる（推測）。
- `RuntimePlayerInputSessionNeutralSnapshot`（`input-profile-bridge-contract.ts:29-38`）は「単一ポーズの blendshape スカラー（jawOpen, mouthSmile）」を任意で持つ。**母音は「複数ポーズ × 複数 blendshape」なのでこのスナップショット 1 枚には収まらない**（構造が単一ポーズ前提）。

### 5-B. 採取フローの再利用可能部品

- **prompt 駆動ウィザード基盤**が既にある: `InputProfileCalibrationSession`（prompt 列生成・進行・per-prompt サンプル評価・profile 組み立て、`input-profile-calibration-session.ts` 全体）。母音 6 ラベルを prompt として足せる骨格が存在。
  - prompt 定義表 `calibrationPromptDefinitions`（:95-114）と key 型 `RuntimePlayerInputCalibrationPromptKey`（`input-profile-bridge-contract.ts:40-58`）に列挙を足す形。
  - セクション⇔prompt 対応表 `getCalibrationPromptKeysForSections`（`input-profile-calibration-sections.ts:131-156`）。
- **blendshape 読み取り部品**: `readCalibrationFeatureValues`（`input-profile-calibration-session.ts:821-834`）は現状 jawOpen/mouthSmile/blink/head/eye のみ抽出。**pucker/funnel/stretch 等の口形 blendshape は未抽出**（母音用に抽出対象拡張が要る）。
- **窓平均採取の既存実装は tools 側にある**: `apps/runtime-player/tools/capture-vowel-frames.ts` の `summarizeSamples`（:124-167）が「duration 窓で全 blendshape の mean/min/max を集計」する。**player 本体のキャリブレーションは窓平均を持たず**、この窓平均ロジックは tools のみ（player へ移すには移植が要る）。tools は 6 ラベル（neutral/a/i/u/e/o, :27-34）を対話 prompt で採り `test_data/iFaceMocap/vowels/*.json` に保存（player の userData には保存しない）。
- **Look Forward 型の揮発捕捉**: `captureLookForward`（`input-session-state.ts:99-127`）= 「今のフレームをスナップショット」。母音を「その場で 1 ポーズ捕捉」する簡易経路のモデルになり得る部品（単一フレームだが）。

### 5-C. UI の置き場

- 入力キャリブレーション UI は `input-page.tsx` の「Input Profile」パネル（:176-280）と「Input Calibration」パネル（:283-338）。ボタン追加や prompt 行追加の置き場が既にある。
- セクション別再キャリブUI（`CalibrationSectionRow` :343-376）は現状「頭位置のみ Recalibrate ボタン表示」（:353-355）。母音セクションを足すならこの分岐に載る構造（推測）。

### 5-D. 保存の置き場

- 母音参照を**永続化するなら** `InputProfileStore` の `profiles.json`（プロファイル内 calibration）に相乗りする経路が唯一の既存永続ストア（§3）。**モデル単位ではなく入力ソース単位**である点に注意（母音の口形はモデル非依存だが、写像先パラメータはモデル依存 = 相性の判断材料）。
- tools は別系統（`test_data/iFaceMocap/vowels/`）で player の永続ストアとは無関係。

---

## 6. 事実 vs 推測の分離

- 事実（file:line 済み）: §1〜§4 全体、§5 の「何が存在するか」の列挙。
- 推測（明記）:
  - schemaVersion 版上げ必要性（母音追加時）— パーサが v1 単一検証である事実からの帰結。
  - sessionNeutral が接続跨ぎで意味を失う点 — `setListening` が latestTrackingFrame をクリアする事実からの帰結（sessionNeutral 自体の明示リセットコードは未確認）。
  - 母音セクションが CalibrationSectionRow 分岐に載る — UI 構造からの類推。

## 7. 未解明点 / L0 への質問

1. **母音の写像先はモデル依存だが、保存は入力ソース単位（profiles.json）**。母音参照フレーム（口形ベクトル自体はモデル非依存）を「入力プロファイル」に置くのが自然か、別ストア（モデル単位 or 中立な vowel-reference ファイル）が要るかは方針判断（本調査は事実確認のみ）。
2. player 本体キャリブレーションは**窓平均を持たない**（min/max 蓄積 + 安定回数方式）。母音は tools 側で窓平均採取済み。母音を player 内製にする場合、tools の `summarizeSamples` 窓平均を移植するか、既存の単発サンプル方式に合わせるかは設計判断。
3. `input-profile-document-parser.ts` の中身（新フィールドの後方互換の効き方）は本調査で未精読。母音フィールド追加時の read-failed 挙動の確認は要すれば追加調査可。
