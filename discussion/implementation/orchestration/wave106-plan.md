# Wave 106 Plan: Dynamics World-Frame Chain（dynamics-file-v3 全面置換）

> dynamics v0（`additivePendulumV0`、入力値を平衡点とするバネ系）を、世界系 Verlet 質点チェーン（重力固定・kind 認知・単位ベースノブ）へ破壊的に置換する。物理の正は設計文書に固定済みであり、本 wave は「診断済み・設計確定の実装委任」型。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave106
- Wave name: `dynamics-world-frame-chain`
- Primary objective:
  - `dynamics-file-v3` 新スキーマ（入力 scale 一本化 / チェーン {rootOffset, segmentLengths[], damping, gravityScale} / 出力 {segmentIndex, scale, limit} 複数解禁）への置換
  - ソルバ `stepDynamics` を世界系 Verlet + 拘束射影（設計文書 §3 の式が正）へ全面書き換え
  - 平衡点の物理的正しさ（角度保持 → θ_local=−φ / 並進保持 → 0）を**数値テストで固定**（v0 に存在しなかった物理妥当性テストの新設）
  - Editor Dynamics Tool / runtime-player tuning profile v2 の新ノブ対応（モノレポ全層が同 wave で整合）

## 2. Planning Gate Result

Planning Gate result: `Inventory first` — 完了済み。

- Inventory: 破壊半径の全量台帳（Sylph, opus）を [wave106-blast-radius-inventory.md](wave106-blast-radius-inventory.md) に固定済み
- ユーザー確認済み（2026-07-04）: 破壊的置換の承認（「君の思い描くあるべきすがたにおきかえよう」）/ 判断要7件の裁定 / input scale 一本化・微分推定廃止・segmentIndex・profile v2 語彙の4細部
- Uncertainty: factual low（ソルバ単一・状態非永続・移行機構不在まで確認済み）、decision low（式レベルで設計固定）、cost of wrong plan medium（フィクスチャ21件 + テスト約30件の書き換えを伴う）

## 3. Accepted Decisions / Oracles

### 3.1 物理・スキーマの正（オラクル）

**[../../design/dynamics-world-frame-chain.md](../../design/dynamics-world-frame-chain.md) が唯一の正**。特に:

- §3 の式（座標系 y-down / g0=980 / アンカー姿勢 / Verlet + 根→先1パス子のみ射影 / 出力写像 / リセット / settled）は**一字一句が仕様**。実装者の解釈で式を変えない。曖昧に見えたら escalate（L0誤訳対策として式を設計文書に置いた経緯があるため、式の再解釈は事故の温床）
- §4 スキーマ、§5 命名表（`dynamics-file-v3` / `runtime-dynamics-chain-v1` / `dynamics-chain-solver-v1` / `worldFrameChainV1` / tuning profile v2）、§6 裁定表、§7 validator 改廃、§8 プリセット初期値、§9 profile v2 語彙
- マイグレーションは**書かない**（裁定 #1）。旧 v2 データ・旧 v1 プロファイルは schemaVersion 厳密一致で reject / 自動破棄
- 固定ステップ + アキュムレータ機構（`advanceRuntimeState` / fixedStepMs / maxSubSteps）と `parameter-resolution` の加算合成の**枠組みは不変**
- 決定論の維持: 純関数・固定ステップ・射影1パス固定・乱数なし。同一入力2回実行の完全一致テストは v0 同等に維持

### 3.2 破壊半径の拘束台帳

[wave106-blast-radius-inventory.md](wave106-blast-radius-inventory.md) を各ドメインの拘束台帳とする。委任時、担当スコープの該当節を委任文に含めること。**無傷と確認済み**の節（CLI・加算合成枠組み・固定ステップ機構・状態非永続）に触れる変更が必要に見えた場合は実装せず escalate。

### 3.3 Model Allocation（従来通り）

L0 = fable / Orch-Sylph・Gnome・Review-Sylph = **opus = Opus 4.8（`claude-opus-4-8`）**（`Agent` 呼び出しで `model: "opus"` を明示必須。無指定は親モデル継承の罠）。

## 4. Primary Basis

- [../../design/dynamics-world-frame-chain.md](../../design/dynamics-world-frame-chain.md)（物理・スキーマ・命名の正）
- [wave106-blast-radius-inventory.md](wave106-blast-radius-inventory.md)（触るべき全箇所の台帳、行番号付き）
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`（固定ステップ意味論。不変部分の確認用）
- `discussion/design/screen-design/components/dynamics-tool.md`（v0 UI 仕様。演算節は本 wave で Superseded 注記を入れる）
- `discussion/implementation/waves/wave81/`（前回の dynamics 全面置換の前例）
- `.claude/skills/implementation-orchestration/SKILL.md`（ハンドリング規則 1-8。artifact-wait は wave105 で実証済みの標準プロトコル）

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Core Replacement（packages 全層 + fixtures）
Batch 2（A 完了後、並列）:
  Domain B: Editor Dynamics Tool 対応
  Domain C: runtime-player Tuning Profile v2
Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

- B / C は A のスキーマ確定に依存し、相互には独立（並列可）
- Domain A は大きい（6 packages + fixtures 21 + テスト約20）。Orch-A は **Gnome を2段に分けて順次実装してよい**（推奨分割: Gnome-1 = package-format / contracts / runtime-core = スキーマ+状態+ソルバ+evidence 投影とそのテスト、Gnome-2 = authoring-core / operation-core / validator-core / ai-interface / fixtures 一式）。1 Gnome のコンテキストに全量を詰めない

## 6. Domain A: Core Replacement

Domain id: `wave106-core-replacement`

Allowed write scope:

- `packages/package-format/src/**`（model-files の v3 スキーマ、runtime-export の契約/能力リテラル）
- `packages/contracts/src/**`（runtime-state の particles 化、runtime-diff の dynamicsChanges 置換）
- `packages/runtime-core/src/**`（dynamics-evaluation 全面書換、snapshot / snapshot-comparison / state-compatibility / initial-state / normalized-runtime-graph）
- `packages/authoring-core/src/**`（runtime-graph-dynamics / dynamics-mutations）
- `packages/operation-core/src/**`（payloads/dynamics、create/update/delete-dynamics-group）
- `packages/validator-core/src/**`（dynamics-semantic の改廃 = 設計 §7）
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`（文言・requiredInputs のみ）
- `fixtures/**`（台帳の21ファイル。決定論的再生成であること）
- Domain A report / review files（`discussion/implementation/waves/wave106/`, `discussion/implementation/reviews/wave106/`）

Forbidden write scope:

- `apps/editor/**`、`apps/runtime-player/**`（B / C の領分。**A 完了時点で monorepo 全体の tsc が割れているのは想定内**とし、A の完了条件は packages スコープのテスト green + packages 内 tsc green とする）
- `apps/authoring-host/**`（CLI は無傷が確認済み。壊れたら escalate）
- 新規外部依存 / lockfile / `pnpm install`（escalate。回避工作も禁止）

Required implementation（設計文書 §3-§7 の全項目。特に）:

- ソルバ: §3.2 アンカー姿勢（kind 別合成、rest = パラメータ default）→ §3.3 Verlet（指数減衰 → 位置保存 → 積分 → 根→先1パス子のみ射影、縮退時真下）→ §3.5 出力（atan2(d.x, d.y)、θ_local = θ_world − φ、clamp ±limit）
- リセット §3.4（真下整列・速度ゼロ）、dt=0 据え置き
- 状態: `particles: [{x,y,px,py}]` + tick + resetCounter。previousSource 系の完全撤去
- evidence: solverKind `worldFrameChainV1`、stateSummary `{particleCount, maxParticleSpeed, tipAngleLocalDeg}`、diff の dynamicsChanges 同期
- validator 改廃は §7 の通り（新設4 / 廃止3 / 改定1 / 維持6）

Required tests（新設の物理妥当性テストが本 wave の核）:

- **平衡点テスト（症状の直接固定）**: ①角度入力を φ に保持して十分ステップ → 全出力の θ_local が −φ に収束（許容誤差明記）②positionX/Y 入力を保持 → θ_local が 0 に収束 ③複合（角度+並進同時保持）→ −φ に収束
- **振り子周期テスト**: N=1、微小初期変位で周期 ≈ 2π√(L/(g0·gravityScale))（±数%）。gravityScale 変化で周期が √ 則に従うこと
- **減衰単調性**: damping > 0 で振幅包絡が単調減少。damping=0 でエネルギーが発散しない（Verlet の安定性）
- **決定論**: 同一入力2回実行の完全一致（v0 テストの移植）
- **拘束剛性**: 全ステップで各セグメント長が L_i と一致（射影の正しさ）
- **多段 + segmentIndex**: N=2 で出力2本（segmentIndex 1/2）が独立に正しい角を返す
- スキーマ: v3 受理 / v2 reject / 廃止フィールド付き payload reject。validator 新旧ルールの発火テスト
- operation ライフサイクル（dry-run→commit）、fixtures の決定論再生成、既存テストの書き換え（台帳の分類を参照）

Escalate if:

- 設計文書の式に複数解釈が生じた場合（**式を選ばず必ず escalate**）
- `parameter-resolution` / `advanceRuntimeState` / authoring-host の変更が必要に見えた場合
- fixtures 再生成で意図しない差分（dynamics 以外のバイト差）が出る場合

## 7. Domain B: Editor Dynamics Tool 対応

Domain id: `wave106-editor-dynamics-tool`

Allowed write scope:

- `apps/editor/src/**`（dynamics-tool-state / dynamics-tool-inspector / viewer-runtime-playback の settled 再設計 / 関連テスト）
- `discussion/design/screen-design/components/dynamics-tool.md`（演算節 189-204 と Cardinality / Quick Tune 節へ「Superseded by design/dynamics-world-frame-chain.md」注記 + 新ノブ対応の最小更新）
- Domain B report / review files

Forbidden write scope: `packages/**`（スキーマは A で凍結済み。不足があれば escalate）、`apps/runtime-player/**`、`apps/authoring-host/**`

Required implementation:

- インスペクタ: chain セクション（rootOffset x/y、segmentLengths リスト編集、damping、gravityScale）、input 行（kind、scale）、output 行（segmentIndex、scale、limit）への置換
- プリセット4種を設計 §8 の値へ置換（出力既定 scale ≈ 0.0333 = 「1.0 = 30°」起点）
- Quick Tune: 新語彙で再構成。**フィールド選定は player v2 語彙（outputScale/limit/damping/gravityScale/lengthScale）と整合させることを条件に裁量可**（裁量内容は報告に明記）
- settled 判定: 設計 §3.7（最大質点速度 + 出力オフセット変化）で `isViewerRuntimePlaybackStateSettled` と閾値定数を再設計。idle throttle の挙動維持（settled で止まり、入力変化で起きる）をテストで固定
- draft バリデーション・clone/compare・プレビュー駆動の新状態型対応

Required tests: dynamics-tool-state / inspector / viewer-runtime-screen 系の書き換え + settled 新判定の単体テスト + 既存テスト非退行

Escalate if: 新スキーマで UI 表現が根本的に決まらない編集項目が出た場合（例: segmentLengths リスト編集の UX が既存部品で組めない）

## 8. Domain C: runtime-player Tuning Profile v2

Domain id: `wave106-player-tuning-v2`

Allowed write scope:

- `apps/runtime-player/src/**`（bridge-contract / effective-dynamics-tuning / dynamics-tuning-profiles 一式 / bridge-request-validation / control ページ / 関連テスト）
- Domain C report / review files

Forbidden write scope: `packages/**`、`apps/editor/**`、`apps/authoring-host/**`

Required implementation:

- profile schemaVersion `runtime-player-dynamics-tuning-profile-v2`、override 語彙 `{enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale?}`（設計 §9）
- `outputScale` は出力 scale への乗数、`lengthScale` は全セグメント長への乗数として `applyDynamicsTuningToGroup` を書き換え
- 旧 v1 プロファイルは version 検証で自動破棄（既存 parser の厳密一致機構をそのまま利用。移行コード禁止 = 裁定 #2）
- signature の署名対象を新スキーマフィールドへ更新
- control UI（dynamics-tune ページ）のフィールド置換

Required tests: tuning 系テスト一式の書き換え + 「v1 プロファイルが黙って捨てられ、既定値で動く」テスト + override 適用の数値テスト（乗数の意味論）

Escalate if: preload/IPC 境界の契約変更が bridge 以外へ波及する場合

## 9. Domain D: Final Integration / Clean Review / Map Closeout

Domain id: `wave106-final-integration-clean-review-map-closeout`

Wave105 Domain B と同型。Required checks:

- Domain A/B/C report + 全レビューレーンの存在・pass
- focused テスト: runtime-core / contracts / package-format / operation-core / validator-core / authoring-core / ai-interface / editor（dynamics 系）/ runtime-player（tuning 系）/ authoring-host（無傷確認）
- root tsc + apps tsc（editor / runtime-player / authoring-host）全 exit 0
- check-source-organization / check-dependencies（既知先行偽陽性の分類継続、新規 finding ゼロ）/ `git diff --check`
- Forbidden-scope diff check（`ref/` 無変更、render-* 無変更、新規依存ゼロ、旧識別子 `additivePendulumV0` / `dynamics-file-v2` / `sway` / `reactionSpeed` の残置 grep = fixtures 履歴以外ゼロ）
- 最終統合報告書 / 独立 Review-Sylph による final clean integration review / waves・reviews・orchestration の `_map.md` 更新
- design/_map.md の dynamics-world-frame-chain.md 行を Accepted / implemented へ更新

## 10. Review Policy

- **Domain A: 3レーン**（すべて Review-Sylph, opus）
  - **Physics / Spec Compliance**: 実装式と設計 §3 の一字一句照合（積分順序・射影の子のみ移動・atan2 引数順・θ_local の符号）。平衡点テストの許容誤差が意味を持つ値であること。**テストをオウム返しでなく独立に検算**（例: 周期式を自分で計算して期待値を照合）
  - **Design / Development**: 命名表 §5 の完全適用、廃止フィールドの完全撤去（grep）、加算合成・固定ステップ枠組みの不変、境界非緩和
  - **Test Adequacy**: Required tests の実効性、fixtures 差分が意図した範囲に局在すること
- **Domain B / C: 各2レーン**（Spec Compliance + Test Adequacy。design/dev 観点は Spec レーンに含める）

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| 収束点が重力方向（ユーザー症状の治療） | 平衡点テスト①②③（角度→−φ / 並進→0 / 複合→−φ） |
| 振り子として物理的に妥当 | 周期テスト（√則）+ 減衰単調性 + 拘束剛性 |
| kind が意味を持つ | 角度入力と並進入力で定常挙動が異なることのテスト |
| 決定論・固定ステップ不変 | 2回実行一致 + advanceRuntimeState 無変更の diff 確認 |
| 旧データ・旧プロファイルが黙って壊れない | v2 reject テスト + v1 プロファイル破棄テスト |
| CLI 経路が生きている | operation dry-run→commit テスト + authoring-host テスト無傷 |
| Editor プレビューで確認できる | Dynamics Tool プレビュー駆動テスト + settled 新判定テスト |
| 配信時微調整が効く | override 乗数の数値テスト |

## 12. Expected Persistent Artifacts

- `discussion/implementation/waves/wave106/wave106-domain-{a,b,c}-*-report.md`、`wave106-final-integration-report.md`、`_map.md`
- `discussion/implementation/reviews/wave106/`（A 3本 + B/C 各2本 + final clean review）、`_map.md`
- 更新済み `discussion/design/dynamics-world-frame-chain.md`（Status → Accepted / implemented、実装で確定した細部の追記があれば）

## 13. Subagent Contract

- 共通義務は wave105 §11 と同一（分離・model 明示・スコープ厳守・Basis Coverage Self-Report・install 禁止 + 回避工作禁止・孤児ゼロの閉域手順）
- artifact-wait プロトコル（規則1-2）は標準運用: 委任契約に完了成果物パスを必須で含め、PowerShell 在席ループで待ち、ターン内でドメインループを完走する
- Gnome への委任文には設計文書 §3 の該当式を**転記でなくパス参照**で渡し、「式の解釈に迷ったら escalate（式を選ばない）」を明記すること

## 14. Out of Scope

- 風・外乱入力（設計 §11 の将来項目）
- Hair Sway パラメータの実 rigging（model-authoring 側の次の閉問題。本 wave はエンジンのみ）
- Editor Dynamics Tool の UX 再設計（フィールド置換を超える改善）
- `.physics3.json` / Cubism Physics 互換（恒久的非目標）
- 旧 v2 データのマイグレーション（裁定 #1）
