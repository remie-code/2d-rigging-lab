# wave107 Domain B（母音キャリブレーション統合）レビュー

- レビュー担当: Review-Sylph（風／レビュー）
- 呼び出し元: Orch-Sylph（wave107 Domain B `wave107-vowel-calibration`）
- 日付: 2026-07-06
- 設計オラクル: `discussion/design/vowel-lipsync-mapping.md` §4
- wave 計画: `discussion/implementation/orchestration/wave107-plan.md` §6
- Gnome 実装報告: `discussion/implementation/waves/wave107/domain-b-gnome-report.md`

## 判定: **合格**

設計 §4・シーム裁定4点・Required tests・write scope すべて充足。自分でテスト再実行し typecheck green / 影響スイート 55/55 green / 全体 469 passed（失敗2件は指定除外の browser-source `effectiveDynamicsTuning`、wave107 無関係）を確認。要修正・escalate 事項なし。

---

## 1. 設計適合（§4 セクションごと）

| §4 要件 | 適合 | 裏取り |
|---|---|---|
| 永続形 = 生 blendshape 平均ベクトル（全次元）+ 採取メタ | ✅ | `input-profile-document.ts` L100-108: `InputProfileVowelCalibration = { samples: Record<label, Record<blendshapeName, mean>>; capturedAtIso?; windowFrameCount?; windowDurationMs? }`。8次元縮約 `references` を永続形に直置きしていない（Domain A 仮置きからの改訂） |
| 8次元縮約への変換は境界アダプタが担う（live-mapping 型・参照解決は不変、追随1行まで） | ✅ | `input-profile-vowel-references.ts` に `convertInputProfileVowelCalibrationToReferences`。live-mapping 側は参照解決右辺のみ（後述シーム4） |
| optional 追加優先・schemaVersion 据え置き | ✅ | `inputProfileDocumentSchemaVersion = "runtime-player-input-profiles-v1"` 不変。`calibration.vowels?` は optional |
| 既存 prompt 駆動ウィザードに母音セクション追加（中立→あ→い→う→え→お） | ✅ | `input-profile-calibration-sections.ts` L48-55 `vowelPromptKeys`（neutral/a/i/u/e/o）、session `calibrationPromptDefinitions` L156-161 に6本 |
| 窓平均採取（`summarizeSamples` を player 本体へ移植、単一フレーム→窓） | ✅ | `input-profile-vowel-window.ts` `summarizeVowelWindow`。移植元 `capture-vowel-frames.ts` L124-167 と mean/min/max・round4（×10000/round）・sort(localeCompare) が一致。差分は「生 UDP 文字列パース」ではなく「正規化済み `TrackingFrame.blendshapes` を直接集約」で、player 内で持つ型に合わせた正当な適応 |
| 既定参照値のバンドル（較正未実施のフォールバック） | ✅（Domain A 由来） | 参照解決が `calibration.vowels === undefined ? defaultVowelReferenceVectors : convert(...)`。Domain A の既定定数を利用。Domain B は差し替えのみ |
| 採取済み参照の即時反映（再起動不要が望ましい、既存慣行に従う） | ✅ | Gnome 報告どおり既存 `onProfileChanged` 経路（`publishActionResult` → `vowelLipsyncState.reset()` + `getActiveInputProfile` 再読込）に依存。追加配線なし。参照解決がフレーム毎に `calibration.vowels` を読むため、保存後の次フレームで新 vowels がアダプタ経由で推定器に渡る。既存機構への依存は妥当 |

## 2. シーム裁定の遵守（合格の必須4点）

1. **永続形が生ベクトル6ラベル + 採取メタ** — ✅ 上表のとおり。`samples` は全 ARKit 次元の mean 辞書（8次元縮約を直置きしていない）。
2. **消費型 `VowelReferenceVectors`（8次元縮約）不変** — ✅ `vowel-lipsync-estimator.ts` の型 L39-46・`extractVowelFeatureVector` L192-219 に Domain B の変更なし（git diff に estimator の変更行なし。Domain B report・diff とも estimator 無変更）。
3. **変換アダプタが input 側にあり縮約規則が推定器と一致** — ✅
   - `reduceVowelBlendshapeMeans`（L48-52）は生ベクトル辞書から最小 `TrackingFrame` を作り `extractVowelFeatureVector` を**そのまま呼ぶ**。縮約規則（jawOpen/mouthFunnel/mouthPucker/mouthClose pass-through、mouthSmile/Stretch/LowerDown/UpperUp を L/R 平均）が推定器と**機構的に同一**で、重複ロジックなし。
   - 非 vacuous 担保: `input-profile-vowel-references.test.ts` の "reduces raw capture means to the same 8-dim references..." が `test_data/iFaceMocap/vowels/vowel-captures.json` の各ラベル `blendshapes.*.mean` を生ベクトルとして通し、**全6ラベル×全8次元**が Domain A の `defaultVowelReferenceVectors` と誤差 < 1e-4 で一致することを assert（Domain A は round4 焼き込み、アダプタは無丸め L/R 平均のため 1e-4 境界は round4 半ULP + FP 誤差を吸収しつつ規則一致を厳密に証明）。加えて "applies the L/R-average reduction rule..." が L/R 非対称入力で mouthSmile/Stretch/LowerDown/UpperUp のみ平均・他は pass-through を具体値 assert。
4. **live-mapping 変更が「参照解決の追随1箇所（+import）」に厳密に留まる** — ✅
   - `runtime-parameter-frame.ts` の diff はトグル/メモ化/`createVowelValue`/`mouth-vowel` case を含むが、これらは **Domain A 帰属**（Domain A report L21 に明記）。委任指示どおり Domain B 帰属分だけを評価。
   - Domain A の参照解決仮置きは `calibration.vowels?.references ?? defaultVowelReferenceVectors`（Domain A report L39: 仮置き型が `references: VowelReferenceVectors`）。Domain B は永続形改訂に伴い右辺を `calibration.vowels === undefined ? defaultVowelReferenceVectors : convertInputProfileVowelCalibrationToReferences(calibration.vowels)` へ差し替え + アダプタ import 1行。
   - 三項化は「アダプタが非 undefined 引数を要する」ための構文であり、Domain A の `?? default` からの機械的変換。**新規判断分岐ではない**。推定器・スロット定義・評価分岐（`createVowelValue`・argmax・トグル短絡）には Domain B は一切触れていない。→ 裁定どおり追随1箇所 + import 1行に厳密に収束。

## 3. テスト適合（Required test ごと・非 vacuous 確認・再実行）

| Required test | 実装 | 非 vacuous | ファイル / テスト名 |
|---|---|---|---|
| スキーマ roundtrip（vowels 有り） | ✅ | 実ファイル save→別 store read→`toEqual` 完全一致 | `input-profile-store.test.ts` "round-trips a saved profile with vowel calibration" |
| スキーマ roundtrip（vowels 無し） | ✅ | save→read で `vowels` が `undefined` | 同 "round-trips a saved profile without vowel calibration" |
| 窓平均の単体 | ✅ | 3フレームで mean/min/max/frameCount 具体値 / round4（0.1667）/ 空 null / mean-only 射影 | `input-profile-vowel-window.test.ts`（4件） |
| ウィザード節の状態遷移 | ✅ | waiting→needs-more(1/8)→窓充填で ok→advance→全母音 ok→canFinish。加えて full flow で `samples.a.jawOpen===0.6`・`windowFrameCount===8` 等採取値検証 | `input-profile-calibration-session.test.ts` "advances the vowel section prompts..." + 既存 full テスト拡張 |
| 旧プロファイル後方互換 | ✅ | vowels 無し JSON が read-failed にならず profiles.length===1・`vowels` undefined。malformed（"o" 欠損）で vowels のみ drop・`mouth` 生存 | `input-profile-document-parser.test.ts` "loads an old profile..." / "drops malformed..." / "loads a profile with vowel calibration and preserves it verbatim" |
| 変換アダプタ単体（Orch 追加・縮約規則一致） | ✅ | §2-3 のとおり実データ全次元一致 + L/R 平均規則 | `input-profile-vowel-references.test.ts`（2件） |

全テスト具体値 assert で vacuous・トートロジーなし。

**自分で再実行した結果**（作業ディレクトリ `apps/runtime-player`）:
- `pnpm run typecheck`: EXIT 0、エラー0。
- 影響スイート（`src/main/input-profiles/` + `runtime-parameter-frame.test.ts` + 新規2ファイル）: **9 files / 55 tests 全 passed**。
- 全体 `vitest run`: **469 passed / 2 failed（93 files）**。失敗2件は `browser-source-server.test.ts` / `browser-source-server-message.test.ts`（`effectiveDynamicsTuning` 由来、wave107 無関係・指定除外）。それ以外の失敗ゼロ。

## 4. 裁量判断の妥当性（Gnome 裁量5点）

1. **窓収集 = Record 押下ごとに現フレーム加算・閾値到達で mean 化（`vowelWindowFrameCount = 8`）** — 妥当。既存 `recordCalibrationSample` IPC が1押下=1フレーム同期経路である制約に対し、非同期タイマ窓を新設せず既存 UI（Record/Next/Save）にそのまま乗せる最小手。8フレームは ARKit funnel/pucker jitter（設計 §2.3）を均す妥協点として合理。named constant + 出自コメントあり。設計 §4 の「窓平均採取」の趣旨（jitter を均す）を満たす。
2. **`fullCalibrationSectionKeys` 分離（`inputProfileCalibrationSectionKeys` は不変）** — 妥当かつ重要。`inputProfileCalibrationSectionKeys` は section-status 表示・missing-only（head-position のみ許可）にも使われるため、母音を足すと旧プロファイルで vowels が "missing" 扱いになり missing-only calibration-start 挙動を破壊する。母音を full 専用リストにのみ含めた判断は既存挙動を実際に保っている（`input-profile-calibration-start.test.ts` 7件 green + `getMissingInputProfileCalibrationSections` が section-status 由来で母音を含まないことをコードで確認）。
3. **`createVowelCalibrationSpread` は6ラベル全揃い時のみ生成（`hasAllVowelLabels` ガード）** — 妥当。部分採取で壊れた vowels を書かない防御。full flow では6 prompt 全 ok が canFinish 条件なので通常揃うが、防御的ガードは正当。
4. **UI 差分なし（`input-page.tsx` 無変更）** — 妥当。母音 prompt は他 prompt と同じ `RuntimePlayerInputCalibrationPromptSnapshot` で、既存グリッド + Record/Next/Save 経路が自動レンダ・駆動する。`${sampleCount}/${requiredSampleCount}` が 0/8→8/8 で機能。窓採取が「Record 押下ごとに窓へ加算」で単一フレーム Record ボタンに乗るため専用 UI 不要。設計「既存 prompt 駆動ウィザードに母音セクションを追加」に最小忠実。ただし後述の残課題（実 UI 動作はユーザー gate）参照。
5. **アダプタ縮約は `extractVowelFeatureVector` 再利用（下位関数 export ではなく最小フレーム経由ラッパ）** — 妥当。裁定の「下位縮約関数を推定器から export する形は取らない／input 側に閉じる」に沿い、既に export 済みの純関数（`frame.blendshapes` のみ読む）を安全に呼ぶ。縮約規則の重複を避けつつ live-mapping 変更ゼロ。最善手。

### 質問1（`windowDurationMs` 未設定）への評価
妥当。player 採取は「フレーム数窓」であり時間窓でないため `windowDurationMs` を埋めないのは正しい。型に optional で残すのは tools 側キャプチャ / 将来の時間窓採取のための前方互換として合理。設計 §4 の採取メタ「窓長・フレーム数」のうち、フレーム数（`windowFrameCount`）は設定され、実測一次データ再現に十分。修正不要。

### 質問3（`test_data/` JSON の test import）への評価
妥当。Domain A の先例（`vowel-lipsync-estimator.test.ts`）と同一パターン。resolveJsonModule 有効・vitest 解決を実機確認済みで、実データによる非 vacuous 担保に必要。プロジェクト外 import を避けたい方針は現状存在しないため現状維持で問題なし。

## 5. write scope 遵守

`git diff --stat` の全ファイルを Domain A/B report で帰属確認:

- **Domain B 帰属（report L15-31 記載）**: `input-profile-document.ts`（型改訂）/ `input-profile-document-parser.ts` + `.test.ts` / `input-profile-calibration-sections.ts` / `input-profile-calibration-session.ts` + `.test.ts` / `input-profile-bridge-request-validation.ts` / `preload/input-profile-bridge-contract.ts` / `input-profile-store.test.ts` / 新規 `input-profile-vowel-references.ts` + `.test.ts` / `input-profile-vowel-window.ts` + `.test.ts` / `runtime-parameter-frame.ts`（参照解決右辺 + import のみ）。すべて Allowed write scope（`main/input-*` / `preload/input-*` / 対応テスト / runtime-parameter-frame 追随1箇所）内。
- **Domain A 帰属（合算に混入、Domain B 無関係）**: `runtime-parameter-frame.ts` のトグル/メモ化/case、`semantic-slot-definitions.ts`、`live-mapping-state.ts` + `.test.ts`、`runtime-export-auto-mapping.test.ts`、`runtime-parameter-frame.test.ts`、`model-mapping-*`（document/parser/slots/store.test/bridge-handlers/bridge-request-validation/bridge-channels/bridge-contract）、`runtime-player-main.ts`、`preload/runtime-player-bridge.ts`、`control/mapping-page.tsx`、`control/control-window-app.tsx`。
- **Forbidden への抵触なし**: `packages/**`・`apps/editor/**`・`apps/authoring-host/**`・`tools/capture-vowel-frames.ts`・estimator/live-mapping ロジックへの Domain B 変更ゼロ。新規外部依存・lockfile 変更なし。
- `discussion/model-authoring/craft/*`・`design/_map.md` の変更は Domain B のコード実装対象外（model-authoring 側の別作業由来）。Domain B report にも記載なし。Domain B の write scope 判定には無関係。

## 6. 既存挙動の無傷

- 旧プロファイル（vowels 無し）が read-failed にならず読める: パーサ `parseVowelCalibration` が `value === undefined → undefined`（後方互換）。`input-profile-document-parser.test.ts` "loads an old profile without vowel calibration" + `input-profile-store.test.ts` "round-trips ... without vowel calibration" で green 実証。
- malformed vowels（ラベル欠損 / 非数値）は vowels のみ drop し calibration 全体は生存（`parseVowelCalibration` が null 相当を undefined 化、`parseInputProfileCalibration` の conditional spread で vowels のみ落とす）。`mouth` 生存を test で assert。
- 母音を section-status/missing-only に混ぜていない（裁量2）: `inputProfileCalibrationSectionKeys` 不変・`getMissingInputProfileCalibrationSections` は section-status 由来で母音非含有。`input-profile-calibration-start.test.ts` 7件 green。

## 差分・残課題

- **なし（要修正なし）**。
- 参考（wave 外・ユーザー gate）: 設計 §4「採取済み参照の即時反映（再起動不要が望ましい）」の実挙動、および UI 差分なし（裁量4）で母音 prompt が実 UI で 0/8→8/8 駆動される点は、いずれも既存機構への依存で論理上成立しているが、実機 UI 動作の目視確認は Domain C 後のユーザー gate（wave 計画 §5 検証2 / §7）に委ねられる。Domain B のコード・単体テスト範囲では健全。

## 質問（判断に迷った点）

- なし。委任のシーム裁定4点・除外基準がすべて明確で、Domain A/B の帰属も両 report で file:line まで裏取りできたため、判定に曖昧さは残っていない。
