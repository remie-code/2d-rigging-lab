# wave107 Domain B（母音キャリブレーション統合）Gnome 実装報告

- 実装者: Gnome（地／実装）
- 呼び出し元: Orch-Sylph（wave107 Domain B `wave107-vowel-calibration`）
- 日付: 2026-07-06
- 設計オラクル: `discussion/design/vowel-lipsync-mapping.md`（特に §4）
- シーム裁定: L0 確定済み（設計 §4 反映）。永続形＝生 blendshape 平均ベクトル6ラベル + 採取メタ。8次元縮約は境界アダプタが担う。

## 結論（一文）

永続スキーマを「生 blendshape 平均ベクトル6ラベル + 採取メタ」保持型へ改訂し、生ベクトル→8次元縮約 `VowelReferenceVectors` の境界アダプタ（`extractVowelFeatureVector` を再利用して縮約規則を推定器と機構的に一致）・`summarizeSamples` 相当の窓平均採取（正規化済み `TrackingFrame` 版）・ウィザードの母音セクション（中立→あ→い→う→え→お、窓平均採取）・パーサの optional 読取り（後方互換 + 不正 vowels のみ drop）・参照解決の追随（アダプタ経由）を実装。schemaVersion 据え置き（`runtime-player-input-profiles-v1`）。typecheck green・Required test すべて実装済みで green。既知の pre-existing 失敗2件（`effectiveDynamicsTuning`）を除き失敗0。

## 作成ファイル（絶対パス）

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\input-profiles\input-profile-vowel-references.ts` — 境界アダプタ。生ベクトル6ラベル→8次元縮約 `VowelReferenceVectors`。`extractVowelFeatureVector` を再利用（縮約規則の推定器一致を機構で担保）。`hasAllVowelLabels` ガードも提供
- `...\apps\runtime-player\src\main\input-profiles\input-profile-vowel-references.test.ts` — アダプタ単体テスト（Orch 追加・必須）
- `...\apps\runtime-player\src\main\input-profiles\input-profile-vowel-window.ts` — 窓平均採取（`summarizeSamples` 移植、正規化済み `TrackingFrame.blendshapes` 版）。mean/min/max/frameCount + round4
- `...\apps\runtime-player\src\main\input-profiles\input-profile-vowel-window.test.ts` — 窓平均単体テスト

## 変更ファイル（絶対パス・私の編集のみ）

- `...\apps\runtime-player\src\main\input-profiles\input-profile-document.ts` — `InputProfileVowelCalibration` を生ベクトル保持型へ改訂（`samples: Record<label, Record<blendshapeName, mean>>` + `capturedAtIso`/`windowFrameCount`/`windowDurationMs` optional）。`InputProfileVowelLabel`/`inputProfileVowelLabels`/`InputProfileVowelBlendshapeMeans` を追加。Domain A が置いた `VowelReferenceVectors` import を除去（live-mapping への型依存を永続層から切り離し）
- `...\apps\runtime-player\src\main\input-profiles\input-profile-document-parser.ts` — `parseVowelCalibration`/`parseVowelBlendshapeMeans` 追加。`parseInputProfileCalibration` に conditional spread で `vowels` を optional 追加。欠損=後方互換、不正=vowels のみ drop（calibration 全体は生存）
- `...\apps\runtime-player\src\main\input-profiles\input-profile-calibration-sections.ts` — `vowelPromptKeys` 定義 + `getCalibrationPromptKeysForSections` に `case "vowels"` 追加
- `...\apps\runtime-player\src\main\input-profiles\input-profile-calibration-session.ts` — 母音セクション実装。full 用 `fullCalibrationSectionKeys`（`inputProfileCalibrationSectionKeys` + `"vowels"`。既存 array 不変）、母音 prompt 定義6本（`requiredSampleCount = vowelWindowFrameCount = 8`）、`vowelWindows` 窓バッファ、`recordVowelWindowSample`（Record 押下ごとに現フレームを窓に足し閾値到達で ok）、`createVowelCalibrationSpread`（6ラベル全て揃った時のみ conditional spread で `calibration.vowels` 生成）、`getVowelLabelForPrompt`、`evaluatePromptSample` に母音 case（防御的・非到達）
- `...\apps\runtime-player\src\main\input-profile-bridge-request-validation.ts` — `readCalibrationSection` に `"vowels"` 追加
- `...\apps\runtime-player\src\preload\input-profile-bridge-contract.ts` — `RuntimePlayerInputCalibrationPromptKey` に `vowel-neutral/-a/-i/-u/-e/-o` 追加、`RuntimePlayerInputCalibrationSectionKey` に `"vowels"` 追加
- `...\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame.ts` — **参照解決の追随のみ**。import 1行 + 参照解決サイト1箇所（`.references` 直読み → アダプタ呼び出し。永続形に `.references` が無くなったための最小差し替え）
- `...\apps\runtime-player\src\main\input-profiles\input-profile-document-parser.test.ts` — vowels roundtrip/後方互換/malformed-drop の3テスト + `createVowelCalibration` helper
- `...\apps\runtime-player\src\main\input-profiles\input-profile-store.test.ts` — vowels 有り/無し save→read round-trip の2テスト
- `...\apps\runtime-player\src\main\input-profiles\input-profile-calibration-session.test.ts` — full 母音採取アサーション追加 + 母音セクション状態遷移テスト追加。`recordCurrentPrompt` を snapshot の `requiredSampleCount` 駆動に変更（窓8/directional2/forward1 を統一）、`createBlendshapes` に母音別 jawOpen 付与

## UI（Required implementation #6）

`input-page.tsx` は既存の prompt 一覧グリッド + Record/Next/Save 経路が母音 prompt を自動的にレンダ・駆動する（母音 prompt は他 prompt と同じ `RuntimePlayerInputCalibrationPromptSnapshot`。`${sampleCount}/${requiredSampleCount}` 表示が 0/8→8/8 で機能）。窓採取は「Record 押下ごとに現フレームを窓に加算」で既存の単一フレーム Record ボタンにそのまま乗るため、専用 UI は追加せず（設計の「既存 prompt 駆動ウィザードに母音セクションを追加」に最小で忠実）。→ input-page.tsx への差分は不要と判断。

## Required implementation 実装状況

1. **永続スキーマ改訂** — 済。`InputProfileVowelCalibration` を生 blendshape 平均ベクトル6ラベル（`samples`）+ 採取メタ（`capturedAtIso`/`windowFrameCount`/`windowDurationMs` optional）へ変更。schemaVersion 据え置き。`vowels` は `InputProfileCalibration` の optional。
2. **パーサ** — 済。`vowels` の optional 読取り。欠損許容（後方互換）、不正データは vowels のみ drop し calibration 全体は生存（`parseInputProfileCalibration` の流儀に準拠）。
3. **変換アダプタ** — 済。`convertInputProfileVowelCalibrationToReferences` を input 側新規モジュールに。縮約は `extractVowelFeatureVector`（`TrackingFrame` 引数）に生ベクトル辞書から作った最小フレームを通して再利用 → 縮約規則（pass-through 4次元 + L/R 平均 4次元）が推定器と**機構的に同一**であることを保証。
4. **窓平均採取** — 済。`summarizeVowelWindow`（`summarizeSamples` 移植、正規化済み `TrackingFrame.blendshapes` の窓集約版。生文字列ではなく player 内のパース済みフレームを扱う）。mean/min/max + frameCount、round4。ウィザードは Record 押下ごとに現フレームを窓に加算し `vowelWindowFrameCount`(=8) 到達で prompt 完了。
5. **ウィザード母音セクション** — 済。prompt key 6本・section key `"vowels"`・section⇔prompt 対応・prompt 定義を追加。full calibration に母音セクションを追加（`fullCalibrationSectionKeys`）。採取した6ラベル生ベクトルを `createProfile` の `calibration.vowels` に載せる。
6. **UI** — 済（上記のとおり既存 prompt 経路に自然に乗せ、差分不要と判断）。
7. **参照解決の追随1行** — 済。`runtime-parameter-frame.ts` の参照解決サイトをアダプタ経由に差し替え（import 1 + 解決サイト1）。live-mapping ロジックは無変更。
8. **採取済み参照の即時反映** — 済（既存慣行に完全依存）。`input-profile-bridge-handlers.ts` の `publishActionResult` が全アクション後に `onProfileChanged?.()` を呼び、`runtime-player-main.ts` の `onProfileChanged` が `vowelLipsyncState.reset()` + `getActiveInputProfile` 再読込を行う。finishCalibration 保存後にこの経路が発火し、次フレームからアダプタ経由で新 vowels が推定器に渡る（再起動不要）。追加配線なし。

## Required test 実装状況（テスト名付き・vacuous でない）

- **スキーマ roundtrip（vowels 有り/無し）** — `input-profile-store.test.ts`
  - "round-trips a saved profile with vowel calibration"（save→別 store で read→`calibration.vowels` が `toEqual` で完全一致）
  - "round-trips a saved profile without vowel calibration"（vowels 無しで save→read、`vowels` が `undefined`）
- **窓平均の単体** — `input-profile-vowel-window.test.ts`
  - "computes per-blendshape mean/min/max and the frame count over a window"（3フレームで mean/min/max/frameCount を具体値検証）
  - "rounds means to four decimals like the capture tool"（0.16666...→0.1667）
  - "returns null for an empty window"
  - "projects a summary to a mean-only vector"（`toVowelBlendshapeMeans`）
- **ウィザード節の状態遷移** — `input-profile-calibration-session.test.ts`
  - "advances the vowel section prompts through waiting -> ok and enables finish"（waiting→1フレームで needs-more(1/8)→窓充填で ok→advance→全母音 ok→canFinish=true）
  - 既存 "records guided prompt ranges and learned signs" に母音採取を追加し `calibration.vowels.samples.a.jawOpen === 0.6` 等を assert（採取値が profile に載ることの検証）
- **旧プロファイル後方互換** — `input-profile-document-parser.test.ts`
  - "loads an old profile without vowel calibration (backward compatible)"（vowels 無し JSON が read-failed にならず profiles.length===1、`vowels` undefined）
  - "drops malformed vowel calibration while keeping the rest of the profile"（"o" 欠損の vowels → vowels のみ drop、`mouth` は生存）
- **変換アダプタの単体（Orch 追加・必須）** — `input-profile-vowel-references.test.ts`
  - "reduces raw capture means to the same 8-dim references as the Domain A default fixtures"（`test_data/iFaceMocap/vowels/vowel-captures.json` の各ラベル `blendshapes.*.mean` を生ベクトルとしてアダプタに通し、全ラベル×全8次元が `defaultVowelReferenceVectors` と一致（Domain A の round4 焼き込みに対し差 < 1e-4）→ 縮約規則が推定器と同一である証明）
  - "applies the L/R-average reduction rule for symmetric features"（L/R 非対称入力で mouthSmile/Stretch/LowerDown/UpperUp が L/R 平均、他は pass-through）

いずれも vacuous でない（具体値 assert）。

## テスト結果

- **typecheck**: green（`tsc --noEmit -p tsconfig.json`、EXIT 0、エラー0）
- **vitest（runtime-player 全体）**: 471 中 **469 passed / 2 failed**
  - 失敗2件は委任で除外指定された既存不具合（`effectiveDynamicsTuning`、wave107 無関係）:
    - `src/main/broadcast-source/browser-source-server.test.ts`
    - `src/stage/browser-source/browser-source-server-message.test.ts`
  - 私の変更はこれら broadcast/stage browser-source ファイルに触れていない。差分は `+ "effectiveDynamicsTuning": null`（別ドメイン由来）。
- **影響スイート単独実行**: input-profiles 7ファイル + runtime-parameter-frame + 新規2ファイル = 9 files / 55 tests 全 green。

## シーム裁定の遵守状況

- **永続形の形**: `InputProfileVowelCalibration = { samples: Record<InputProfileVowelLabel, Record<blendshapeName, mean>>; capturedAtIso?; windowFrameCount?; windowDurationMs? }`。生 blendshape 平均ベクトル（全次元）を6ラベル分保持 + 採取メタ。8次元縮約 `references` は永続形に持たない（裁定どおり）。
- **消費型 `VowelReferenceVectors`（8次元縮約）は不変**: `vowel-lipsync-estimator.ts` の型・`extractVowelFeatureVector` は無変更。
- **アダプタの縮約規則一致**: `reduceVowelBlendshapeMeans` は生ベクトル辞書から最小 `TrackingFrame`（blendshapes のみ）を作り `extractVowelFeatureVector` を**そのまま呼ぶ**。よって縮約規則（jawOpen/mouthFunnel/mouthPucker/mouthClose pass-through、mouthSmile/mouthStretch/mouthLowerDown/mouthUpperUp を L/R 平均）は推定器と機構的に同一で、重複ロジックも無い。テスト "reduces raw capture means to the same 8-dim references..." が JSON 実データで一致を担保。
- **追随1行の実際の差分**: `runtime-parameter-frame.ts` の参照解決を
  - 旧（Domain A 仮置き）: `input.inputProfile.calibration.vowels?.references ?? defaultVowelReferenceVectors`
  - 新: `calibration.vowels === undefined ? defaultVowelReferenceVectors : convertInputProfileVowelCalibrationToReferences(calibration.vowels)`
  - + import 1行。永続形に `.references` が無くなったための最小差し替えで、live-mapping ロジックは無変更。三項化は「アダプタが非 undefined 引数を要する」ための最小構文（新規判断分岐ではない）。

## 裁量判断（how 下位・根拠付き）

1. **窓収集方式 = Record 押下ごとに現フレームを窓バッファに加算し閾値到達で mean 化**（`vowelWindowFrameCount = 8`）。理由: 既存 `recordCalibrationSample` IPC が1押下=1フレーム同期経路（`getLatestTrackingFrame` は最新1フレームのみ、連続購読 API 無し）であるため、非同期タイマ窓は既存基盤を作り替える。Record を8回押す方式は既存 UI（Record/Next/Save）にそのまま乗り、専用 UI 不要。8フレームは ARKit の funnel/pucker per-frame jitter（設計 §2.3）を均しつつ操作負荷が小さい妥協点。named constant + 出自コメント。
2. **母音セクションを `inputProfileCalibrationSectionKeys` に足さず、full 専用 `fullCalibrationSectionKeys` を新設**。理由: 既存 array は section-status 表示・missing-only（head-position のみ許可）にも使われる。母音を足すと旧プロファイルで vowels が "missing" 扱いになり missing-only calibration-start が非 head-position missing section を "unavailable" で弾く既存挙動を破壊する。full にだけ母音を含め、section-status/missing-only は不変とした。→ 既存挙動の無傷を優先。
3. **`createVowelCalibrationSpread` は6ラベル全て揃った時のみ vowels を生成**（`hasAllVowelLabels` ガード）。部分採取で壊れた vowels を書かない。full flow では6 prompt 全 ok が canFinish 条件なので通常揃うが、防御的に。
4. **UI 差分なし**（上記 UI 節）。既存 prompt 経路が母音を自動処理するため。
5. **アダプタ縮約は `extractVowelFeatureVector` 再利用**（下位関数 export ではなく最小フレーム経由のラッパ）。裁定が「下位関数を推定器から export してもらう形は取れない」「生ベクトル辞書から8次元を作る縮約関数を input 側に自前で実装するのが安全」と指示。`extractVowelFeatureVector` は既に export 済みの純関数で `frame.blendshapes` のみ読むため、input 側から安全に呼べる（live-mapping への変更不要）。縮約規則の重複を避けつつ input 側に閉じる最善手と判断。

## 質問・escalate 事項

1. **`windowDurationMs` 未設定**: 永続メタに `windowDurationMs` を optional で用意したが、player 側の窓採取は「フレーム数窓」（Record 押下回数）であり時間窓ではないため、採取時に埋めていない（`windowFrameCount` のみ設定）。設計 §4 の採取メタは「窓長・フレーム数」を挙げるが、player 内採取が時間窓でない以上 `windowDurationMs` は意味を持たない。型には残し（tools 側キャプチャや将来の時間窓採取が使えるよう）、player 採取では未設定とした。問題あれば指摘されたい。
2. **既存 browser-source テスト2件の失敗**: 委任どおり除外・無変更（wave107 無関係の `effectiveDynamicsTuning` 由来、別ドメイン in-flight）。本 Domain の green 判定から除外。
3. **`test_data/` JSON の test import**: アダプタテストは Domain A の先例どおり `../../../../../test_data/...vowel-captures.json` を直接 import（resolveJsonModule 有効・vitest 解決を実機確認）。プロジェクト外 import を避けたい方針があれば test-support 転記に切替可能。

以上、Allowed write scope 内に収まり（input-* / preload input-* / runtime-parameter-frame の追随1箇所のみ）、Forbidden（packages/**・editor・authoring-host・capture-vowel-frames.ts・estimator/live-mapping ロジック・新規依存）に一切触れていない。
