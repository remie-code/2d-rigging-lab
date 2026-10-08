# wave107 Domain B（母音キャリブレーション統合）ドメイン報告

- オーケストレーター: Orch-Sylph（wave107 Domain B `wave107-vowel-calibration`）
- 呼び出し元: Undine
- 設計オラクル: `discussion/design/vowel-lipsync-mapping.md`（特に §4）
- wave 計画: `discussion/implementation/orchestration/wave107-plan.md`（Domain B）
- 状態: 完了（レビュー合格・ループ1回）

## シーム（L0 確定・設計 §4 反映済み）

- `calibration.vowels` の永続形は**生の blendshape 平均ベクトル（全次元）+ 採取メタ**に改める（Domain A の8次元縮約 `references` 直置きから変更）。
- Domain A が定義した `InputProfileVowelCalibration.references: VowelReferenceVectors`（8次元縮約）は**推定器側の消費型として不変**。永続形→消費型の変換アダプタを input 側に置く。
- `runtime-parameter-frame.ts:58` の参照解決（`calibration.vowels?.references ?? defaults`）は「参照解決の追随1行まで」可。それ以上が必要なら escalate。

## ループ記録

- **ループ1**: Gnome 実装 → Review-Sylph レビュー → **合格**。1回で収束。
  - Gnome 報告: `discussion/implementation/waves/wave107/domain-b-gnome-report.md`
  - レビューレポート: `discussion/implementation/reviews/wave107/domain-b-vowel-calibration.md`

## 成果サマリ

作成:
- `apps/runtime-player/src/main/input-profiles/input-profile-vowel-references.ts`（境界アダプタ: 生ベクトル6ラベル→8次元縮約 `VowelReferenceVectors`。`extractVowelFeatureVector` 再利用で縮約規則を推定器と機構的に一致）+ `.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-vowel-window.ts`（窓平均採取: `summarizeSamples` 移植の正規化済み `TrackingFrame` 版）+ `.test.ts`

変更:
- `apps/runtime-player/src/main/input-profiles/input-profile-document.ts`（`InputProfileVowelCalibration` を生 blendshape 平均6ラベル + 採取メタ保持型へ改訂。schemaVersion 据え置き）
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts`（vowels の optional 読取り: 欠損=後方互換、不正=vowels のみ drop）+ `.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts`（母音 prompt/section 追加）
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts`（母音セクション + 窓採取）+ `.test.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`（section validation に vowels 追加）
- `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`（prompt/section key 追加）
- `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts`（roundtrip テスト）
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`（**参照解決の追随のみ**: import 1 + 解決サイト1）

テスト: typecheck green / 影響スイート 55/55 green / 全体 469 passed・2 failed（既存 in-flight `effectiveDynamicsTuning` のみ、wave107 無関係で除外）

シーム裁定: 4点すべて遵守（永続形=生ベクトル、消費型不変、アダプタ縮約規則一致を実データテストで担保、live-mapping 追随1箇所）
