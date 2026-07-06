# Wave 107 Plan: Vowel Lipsync Mapping（母音リップシンク写像スロット + キャリブレーション統合）

> runtime-player の写像層に母音（あいうえお）推定スロット5本を追加し、ARKit blendshape から `param_mouth_vowel_*` を駆動する。方式は nearest-reference（実測参照フレームへの重み付き距離 + argmax + ヒステリシス）。追加的変更のみ——既存の 1 スロット = 1 パラメータ機構・strength 機構・保存形式は作り替えない。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave107
- Wave name: `vowel-lipsync-mapping`
- Primary objective:
  - 共有母音推定器（純関数 + per-frame 状態）と weight スロット `mouth-vowel-a/i/u/e/o` の新設
  - リップシンク ON/OFF トグル（OFF = 母音 parameterId 不発行、設計 §3.2）
  - キャリブレーションへの母音参照セクション追加（optional・窓平均採取ウィザード節）
  - 実測キャプチャ再生の決定論テスト（分類一致・ヒステリシス・ゲート）

## 2. Planning Gate Result

Planning Gate result: `Proceed`（inventory は調査3本で充足済み）。

- 事実調査: [research/player-ifacialmocap-survey.md](../../model-authoring/research/player-ifacialmocap-survey.md) / [player-calibration-survey.md](../../model-authoring/research/player-calibration-survey.md) / [player-mapping-strength-survey.md](../../model-authoring/research/player-mapping-strength-survey.md)——断絶点・変更面・strength 意味論・1:1 制約まで file:line 付きで確定済み
- ユーザー承認済み（2026-07-06）: 設計 Accepted「dynamicsと同じ流れだ」+ トグル要件
- Uncertainty: factual low（3調査で変更面確定）/ decision low（設計固定）/ cost of wrong plan low（追加的変更のみ、既存挙動の破壊なし）

## 3. Accepted Decisions / Oracles

### 3.1 設計の正（オラクル）

**[../../design/vowel-lipsync-mapping.md](../../design/vowel-lipsync-mapping.md) が唯一の正**。特に:

- §2 方式（特徴8次元の中立差分 / 重み付き距離の最近傍——**cos 類似は採用不可の実測根拠あり** / 強度 w の式 / ゲート / ヒステリシス=マージン+連続Nフレーム）
- §3 スロット設計: **5独立 weight スロット + 上流の共有推定器（フレーム1回メモ化）**。1 スロット = 1 parameterId の既存契約は変更禁止。「単一 Vowel 非ゼロ」は argmax の構造で保証
- §3.2 トグル: OFF = parameterValues に母音キーを**載せない** + 推定器短絡。既定 = 母音ターゲット解決時 ON。モデル単位 mapping プロファイルへ optional フィールド
- §4 キャリブレーション: `calibration.vowels` は **optional 追加で schemaVersion 据え置きを優先**。窓平均採取は `apps/runtime-player/tools/capture-vowel-frames.ts` の `summarizeSamples` を移植
- 一次データ: `test_data/iFaceMocap/vowels/vowel-captures.json`（既定参照ベクトルの出所。同梱定数の生成元として出自をコメントで残す）
- 閾値・重み・ヒステリシス定数の初期値は実測 JSON から導出し、根拠コメント付きの named constants にする（マジックナンバー禁止）

### 3.2 Model Allocation（従来通り）

L0 = fable / Orch-Sylph・Gnome・Review-Sylph = **opus = Opus 4.8（`claude-opus-4-8`）**（`Agent` 呼び出しで `model: "opus"` を明示必須。無指定は親モデル継承の罠）。

## 4. Wave Strategy

```text
Batch 1:
  Domain A: 推定器コア + スロット + トグル + 既定参照 + 再生テスト
Batch 2（A 完了後）:
  Domain B: キャリブレーション統合（ウィザード母音節 + 窓平均 + 永続化）
Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

- B は A が定義する `calibration.vowels` 型と推定器の参照解決（calibration ?? 既定値）に依存するため順次
- 各 Orch-Sylph は SKILL.md の分離規則に従う（Orch 自身は実装しない / Gnome 実装 / Review-Sylph レビュー / ループ上限5）

## 5. Domain A: 推定器コア + スロット + トグル

Domain id: `wave107-vowel-core`

Allowed write scope:

- `apps/runtime-player/src/main/live-mapping/**`（推定器新規モジュール / semantic-slot-definitions への5スロット追加 / runtime-parameter-frame への sourceKind case + メモ化 + 状態 / 既定参照定数）
- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts` ほか preload 契約（トグルフィールドの optional 追加が必要な範囲）
- `apps/runtime-player/src/main/model-mapping-profile-document.ts` 等（mapping プロファイルへの optional トグル永続化）
- `apps/runtime-player/src/main/input-profile-document.ts`（`calibration.vowels` の **optional 型定義のみ**——採取フローは Domain B）
- `apps/runtime-player/src/control/mapping-page.tsx`（トグル UI。mouth グループ近傍）
- 対応するテストファイル一式
- Domain report / review files（`discussion/implementation/waves/wave107/`, `discussion/implementation/reviews/wave107/`）

Forbidden write scope:

- `packages/**`（エンジン層は無変更。必要に見えたら escalate）
- `apps/editor/**`・`apps/authoring-host/**`・`tools/capture-vowel-frames.ts`（読取りは可）
- 新規外部依存 / lockfile

Required implementation:

- 推定器: 設計 §2 の式のとおり（特徴抽出 → 中立差分 → 重み付き距離 → argmax + ヒステリシス + ゲート → 勝者と w）。純関数 + 明示的状態オブジェクトで単体テスト可能に。参照解決は `calibration.vowels ?? 既定参照`
- スロット: `mouth-vowel-a/i/u/e/o`（group=mouth、weight 系、targetAliases=`mouth.vowel.*`）。評価 case は「メモ化された推定結果の勝者が自分なら w、他は 0」のみ
- トグル: §3.2 の意味論。OFF で母音キー不発行・推定器短絡。UI は Semantic Slots の mouth グループ近傍に1トグル
- 既定参照: 実測 JSON の mean 値から生成した定数（生成元パスと採取日をコメントで明記）

Required tests:

- **キャプチャ再生テスト（本 wave の核）**: 実測 JSON の各ラベル mean 点を推定器に与え分類一致を assert / う の min/max 角点がヒステリシス込みで う に留まる / 中立点で全母音 0（ゲート）
- 単一 Vowel 非ゼロ: 任意フレームで parameterValues の母音キーは高々1つ非ゼロ
- トグル OFF: parameterValues に母音 parameterId が**存在しない**こと
- strength 経路: 既存 `createWeightValue` を通ること（w×strength の値検証1点）
- 既存挙動の無傷: 既存 11 スロットのテストが全て green のまま

## 6. Domain B: キャリブレーション統合

Domain id: `wave107-vowel-calibration`

Allowed write scope:

- `apps/runtime-player/src/main/input-*`（プロファイル永続化・ウィザードセッション・bridge handlers）
- `apps/runtime-player/src/preload/input-*` 契約（optional 追加）
- `apps/runtime-player/src/control/input-page.tsx` ほか採取 UI
- 対応するテスト / Domain report / review files

Forbidden write scope: Domain A のコア（live-mapping 配下）への変更は最小参照に留める（推定器の参照解決シームは A が確定済み）。packages/** 禁止。

Required implementation:

- ウィザードに母音セクション（中立→あ→い→う→え→お、prompt 駆動の既存基盤に追加）
- **窓平均採取**: `summarizeSamples` 相当（窓収集 + mean/min/max + フレーム数）を player 本体へ移植
- `calibration.vowels` への保存（optional・schemaVersion 据え置き。既存プロファイルの読込互換を維持）
- 採取済み参照があれば推定器が即座に使うこと（再起動不要が望ましいが、既存プロファイル反映機構の慣行に従う）

Required tests: スキーマ roundtrip（vowels 有り/無し両方の読込）/ 窓平均の単体 / ウィザード節の状態遷移 / 旧プロファイル（vowels 無し）の後方互換。

## 7. Domain C: Final Integration / Clean Review / Map Closeout

Domain id: `wave107-final-integration`

- モノレポ全体 tsc + 全テストスイート green の確認
- クリーンレビュー（設計 §2〜§4 と実装の突合、Review-Sylph 独立）
- 設計文書 Status を Implemented へ / design/_map.md・関連 _map の閉栓 / wave final report（`discussion/implementation/waves/wave107/`）
- 実機確認はユーザー gate（wave 外）: 母音発話での切替・ちらつき・トグル・strength

## 8. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の規則に従う（コンテキスト宣言 / 分離 / ループ上限5 / 早期脱出 = ユーザー判断が要る設計漏れの検出時）
- Orch-Sylph はレビュー合格後に完了報告。報告には作成/変更ファイル・テスト結果・レビューレポートパスを含める
- 設計文書に無い判断分岐を見つけたら実装で埋めず escalate（L0 が裁定して設計文書を改訂する）
