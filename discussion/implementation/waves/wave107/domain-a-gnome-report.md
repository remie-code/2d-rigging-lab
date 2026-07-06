# wave107 Domain A（母音リップシンク: 推定器コア）Gnome 実装報告

- 実装者: Gnome（地／実装）
- 呼び出し元: Orch-Sylph（wave107 Domain A `wave107-vowel-core`）
- 日付: 2026-07-06
- 設計オラクル: `discussion/design/vowel-lipsync-mapping.md`
- 一次データ: `test_data/iFaceMocap/vowels/vowel-captures.json`（2026-07-06 採取）

## 結論（一文）

母音リップシンクの推定器コア・5独立 weight スロット・共有推定器のフレーム1回メモ化・ON/OFF トグル（モデル単位 mapping プロファイルへ optional 永続化）・`calibration.vowels` の optional 型定義を実装し、typecheck green・Required test すべて実装済みで green。残る 2 件のテスト失敗は本 Domain 無関係の既存不具合（`effectiveDynamicsTuning`）であることを stash で確認済み。

## 作成ファイル（絶対パス）

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\vowel-lipsync-estimator.ts` — 推定器本体（純関数 + `RuntimePlayerVowelLipsyncState` 状態クラス、既定参照定数、named constants）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\vowel-lipsync-estimator.test.ts` — 推定器単体テスト（キャプチャ再生 / う角点ヒステリシス / 中立ゲート / reset / 特徴抽出）

## 変更ファイル（絶対パス）

推定器の写像層への配線:
- `...\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame.ts` — `CreateRuntimeParameterFrameInput` に `vowelLipsyncEnabled?` / `vowelLipsyncState?` 追加、フレーム1回メモ化 `readVowelEstimate`、`mouth-vowel` case（`createVowelValue`：勝者なら w を既存 `createWeightValue` 経由、他は null で不発行）、トグル OFF 時の vowel スロット短絡
- `...\apps\runtime-player\src\main\live-mapping\semantic-slot-definitions.ts` — `SemanticSlotSourceKind` に `"mouth-vowel"` 追加、`vowelLabel?` フィールド追加、`mouth-vowel-a/i/u/e/o` の5定義追加（group=mouth、targetAliases=`mouth.vowel.*`、defaultStrength=1）
- `...\apps\runtime-player\src\preload\model-mapping-bridge-contract.ts` — `runtimePlayerMappingSlotIds` に5 slotId 追加、`RuntimePlayerMappingStatus` に `vowelLipsyncSupported`/`vowelLipsyncEnabled` 追加、`RuntimePlayerMappingVowelLipsyncUpdateRequest` 型 + API `setVowelLipsyncEnabled` 追加

スロット供給・状態・永続化:
- `...\apps\runtime-player\src\main\live-mapping\live-mapping-state.ts` — `vowelLipsyncEnabledOverride`（null=未設定→既定ON）、`isVowelLipsyncSupported()`/`isVowelLipsyncEnabled()`/`setVowelLipsyncEnabled()`、export ロード・クリアでのリセット、プロファイル復元・スナップショット・getStatus への反映
- `...\apps\runtime-player\src\main\model-mapping-profiles\model-mapping-profile-document.ts` — `ModelMappingProfileDocument.vowelLipsyncEnabled?`（optional、schemaVersion 据え置き）
- `...\apps\runtime-player\src\main\model-mapping-profiles\model-mapping-profile-parser.ts` — `vowelLipsyncEnabled` の optional 読み取り（欠損許容）
- `...\apps\runtime-player\src\main\model-mapping-profiles\model-mapping-profile-slots.ts` — `createModelMappingProfileDocument` に `vowelLipsyncEnabled?` 引数を追加し永続化

トグル IPC 配線:
- `...\apps\runtime-player\src\preload\model-mapping-bridge-channels.ts` — `setVowelLipsyncEnabled` チャネル追加
- `...\apps\runtime-player\src\main\model-mapping-bridge-request-validation.ts` — `readMappingVowelLipsyncUpdateRequest` 追加
- `...\apps\runtime-player\src\main\model-mapping-bridge-handlers.ts` — `vowelLipsyncState?` 注入、`setVowelLipsyncEnabled` ハンドラ登録（未対応モデルは unavailable）、`createRuntimeParameterFrame` へ `vowelLipsyncEnabled`/`vowelLipsyncState` 引き渡し
- `...\apps\runtime-player\src\preload\runtime-player-bridge.ts` — `modelMapping.setVowelLipsyncEnabled` 配線
- `...\apps\runtime-player\src\main\runtime-player-main.ts` — `RuntimePlayerVowelLipsyncState` 生成・注入、bodyFollowState.reset() 併設5箇所で `vowelLipsyncState.reset()` 追加

型:
- `...\apps\runtime-player\src\main\input-profiles\input-profile-document.ts` — `InputProfileCalibration.vowels?`（`InputProfileVowelCalibration` = `references: VowelReferenceVectors` + 採取メタ optional）**型定義のみ**（採取フロー/パーサ対応は Domain B）

UI:
- `...\apps\runtime-player\src\control\mapping-page.tsx` — Semantic Slots パネル Mouth グループ先頭に `VowelLipsyncToggle`（`vowelLipsyncSupported` の時のみ表示）
- `...\apps\runtime-player\src\control\control-window-app.tsx` — `onSetVowelLipsyncEnabled` を MappingPage へ配線

テスト:
- `...\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame.test.ts` — 単一Vowel非ゼロ / トグルOFF不発行 / strength半減の3テスト追加
- `...\apps\runtime-player\src\main\live-mapping\runtime-export-auto-mapping.test.ts` — 5スロット追加に伴う既存アサーション更新（11→16、非body 9→14）
- `...\apps\runtime-player\src\main\live-mapping\live-mapping-state.test.ts` — トグル supported/default/override/復元の4テスト追加
- `...\apps\runtime-player\src\main\model-mapping-profiles\model-mapping-profile-store.test.ts` — トグル永続化round-trip + 旧プロファイル互換の2テスト追加

## Required test 実装状況

1. **キャプチャ再生テスト（核）** — 実装済（`vowel-lipsync-estimator.test.ts`「classifies each captured vowel mean...」）。JSON を `import`（resolveJsonModule 有効を確認）し各ラベル mean を推定器に投入。a→a, i→i, u→u, e→e, o→o, neutral→null を assert。
2. **う の角点** — 実装済（同「holds 'u' at the mouthFunnel/mouthPucker corner points via hysteresis」）。funnel 0.31/0.71 × pucker 0.25/0.61 の4角点で、う確定後にヒステリシスで う に留まることを assert。特に低funnel/低puckerの角点は生argmaxが o に反転する（margin 0.017）ケースを margin 0.05 が吸収。
3. **中立ゲート** — 実装済（同「gates all vowels to null at the neutral rest pose」）。neutral点で winner=null / weight=0。
4. **単一 Vowel 非ゼロ** — 実装済（`runtime-parameter-frame.test.ts`「emits only the winning vowel parameter...」）。母音キーの非ゼロが高々1つ（あ入力で `param_mouth_vowel_a` のみ、他は undefined）。
5. **トグル OFF** — 実装済（同「does not emit any vowel parameterId when vowel lipsync is disabled」）。5母音 parameterId がすべて parameterValues に**存在しない**（undefined）。
6. **strength 経路** — 実装済（同「scales the winning vowel intensity by per-slot strength」）。strength=0.5 で emitted 値が半減（w×strength、default=0）。既存 `createWeightValue` を通す実装。
7. **既存挙動の無傷** — 実装済。既存 `runtime-parameter-frame.test.ts` の 11スロット系テストは全 green のまま（vowel キーは ON かつ vowel スロット供給時のみ出現）。`runtime-export-auto-mapping.test.ts` は5スロット自動列挙に伴う正当なアサーション更新（母音ターゲット無しモデルでは vowel スロットは unmapped で列挙される）。

## テスト結果

- **typecheck**: green（`tsc --noEmit -p tsconfig.json`、エラー0）
- **test:unit**: 459 中 457 passed / 2 failed。
  - 失敗2件は **本 Domain 無関係の既存不具合**:
    - `src/main/broadcast-source/browser-source-server.test.ts`
    - `src/stage/browser-source/browser-source-server-message.test.ts`
  - いずれも差分は `+ "effectiveDynamicsTuning": null`（dynamics tuning / browser-source ドメインの別作業由来）。**私の変更を `git stash` した状態でも同じ失敗が再現する**ことを確認済み。vowel 関連のアサーション失敗は0件。
- 本 Domain 新規/更新テスト（vowel-lipsync-estimator 7 / runtime-parameter-frame +3 / live-mapping-state +4 / store +2 / auto-mapping 更新3）はすべて green。

## 定数の導出根拠（実測 JSON 由来）

出所: `test_data/iFaceMocap/vowels/vowel-captures.json`（採取日 2026-07-06、各ラベル約90フレーム窓平均）。全て `vowel-lipsync-estimator.ts` に named constant + 出自コメントで焼き込み（実行時 JSON 読取りなし）。

- **特徴8次元**（設計 §2.1）: `jawOpen / mouthFunnel / mouthPucker / mouthClose / mouthSmile(L/R平均) / mouthStretch(L/R平均) / mouthLowerDown(L/R平均) / mouthUpperUp(L/R平均)`。
- **既定参照ベクトル** `defaultVowelReferenceVectors`: 各ラベル blendshapes.mean を上記8次元に縮約（L/R平均）してハードコード。
- **次元重み** `vowelDimensionWeights` = 全1.0: 単位重みで6ラベル（中立+5母音）が正しく分離（最小の inter-reference margin は i/e の 0.167）するため再重み付け不要と判定。
- **ゲート閾値** `vowelGateActivityThreshold` = 0.15: 中立の活動量（中立参照との重み付き距離）が 0.0、最小母音「い」が 0.318。0.15 で rest と全母音を明確に分離。
- **ヒステリシスマージン** `vowelHysteresisMargin` = 0.05: う保持中の funnel/pucker 暴れ（実測 funnel 0.31..0.71, pucker 0.25..0.61）の低funnel/低pucker角点で生argmaxが o に 0.017 差で反転する。0.05 のマージンでこの反転を吸収して う を保持。
- **ヒステリシスフレーム数** `vowelHysteresisFrames` = 3: 単フレームのARKitスパイクを棄却しつつ体感遅延（60fpsで約50ms）を出さない。

**強度式**（設計 §2.3）: `w = d(Δ,中立) / (d(Δ,中立) + d(Δ,最近傍母音))` を 0..1 clamp。各母音の mean 点で w≈1.0、中立で 0 を実測で確認。

**「え=あの縮小」の検証**（cos不可の根拠、設計 §2.2）: 0.5×a / 0.25×a の点で最近傍が e になる（方向はaと同一、大きさだけ小さい）ことを計算で確認。距離ベースだから正しく分離、cos 類似では不可能——設計の裁定を実測で追認。

## トグル IPC 配線の判断

**新規チャネル + 新規ハンドラを採用**（既存 `updateSlot` 流用は不採用）。理由:
- トグルは**ドキュメントレベル**（`ModelMappingProfileDocument.vowelLipsyncEnabled`）であり、`updateSlot`（`RuntimePlayerMappingSlotUpdateRequest` は per-slot、`slotId` 必須）とは粒度が合わない。5つの vowel スロットそれぞれに enabled を配るのは母音の相互排他構造（1推定器→argmax）と噛み合わず、意味論的にも document 単位が自然（設計 §3.2「モデル単位 mapping プロファイルへ optional フィールドで永続化」）。
- 追加は Domain A スコープ内（`model-mapping-bridge-channels` / `-contract` / `-request-validation` / `-handlers` / preload bridge）に収まる。新ハンドラは未対応モデル（vowel ターゲット未解決）では `unavailable` を返し、対応モデルでは override 保存 + `vowelLipsyncState.reset()` + プロファイル save スケジュール。

## 裁量判断（設計未定義だが合理的に埋めた箇所）

1. **次元重み = 全1.0**: 設計 §7 は「距離の次元重みを実測から導出（決め打ちにせず調整可能な定数に）」とのみ規定。単位重みで全ラベルが健全なマージンで分離したため 1.0 を採用しつつ、`vowelDimensionVectors` を named constant として残し将来調整可能に。
2. **ヒステリシス N=3 フレーム**: 設計は「連続Nフレーム」とのみ。3 を選択（スパイク棄却と遅延のバランス、根拠コメント付き）。
3. **ゲート下でのstate クリア**: ゲート未満で `confirmedWinner` を null にクリア（口を閉じたら次の母音は再度ヒステリシス確定を要求）。設計の「口閉じ時 母音ゼロ」の意図に沿う。
4. **`vowelLipsyncSupported`**: 「vowel ターゲットを解決できたモデルか」を status に露出（UI トグル表示条件・既定ONの判定に使用）。設計 §3.2「母音ターゲットが解決できたモデルでは ON」の実装として、mouth-vowel スロットのいずれかに target があるかで判定。
5. **override の永続化ポリシー**: ユーザーが明示的にトグルした時のみ profile に `vowelLipsyncEnabled` を書き、未操作（既定ON）の時は書かない（旧プロファイル互換・クリーンさ維持）。復元時に欠損は override=null（既定ON）に解決。
6. **`InputProfileVowelCalibration` の形**: 設計 §4「各 blendshape ベクトル + 採取メタ」に対し、推定器が使う `VowelReferenceVectors`（8次元縮約済み）を `references` に持たせ、`capturedAtIso`/`windowFrameCount`/`windowDurationMs` を optional メタとした。Domain A は型のみ（参照解決 `calibration.vowels?.references ?? 既定` が型的に通ることを担保）。全 blendshape 保持にするか8次元縮約かは Domain B の採取実装で最終決定余地あり（下記 質問参照）。

## 質問・escalate 事項

1. **既存の browser-source テスト2件の失敗（`effectiveDynamicsTuning`）**: 本 Domain 無関係（stash で pre-existing 確認済み）。Forbidden スコープ外の別ドメイン作業由来と判断し**触っていない**。Orch-Sylph 側で別 Domain の in-flight 変更として把握済みか確認されたい（本 Domain の green 判定からは除外している）。
2. **`calibration.vowels` のベクトル粒度**: Domain A では推定器が使う8次元縮約 `VowelReferenceVectors` を `references` に持たせた。Domain B の採取フローが「全 ARKit blendshape を保存し推定器投入時に8次元へ縮約」する設計なら、`InputProfileVowelCalibration` を全 blendshape 保持型に変える余地がある。Domain B とのシーム整合を Orch-Sylph 側で確認されたい（現状は推定器の入力型に直結する8次元縮約で型が閉じている）。
3. **`test_data/` JSON の test import**: テストは `../../../../../test_data/...vowel-captures.json` を直接 import している（resolveJsonModule 有効・vite で解決可能を実機確認）。プロジェクト外パスの import を避けたい方針があれば test-support への転記に切替可能（設計のフォールバック案どおり）。現状は設計 Required test #1 の「JSON を import」に忠実。
