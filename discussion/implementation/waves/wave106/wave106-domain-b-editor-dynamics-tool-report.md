# Wave106 Domain B `wave106-editor-dynamics-tool` — Orch-Sylph 最終報告

- 呼び出し元: Undine（L0）
- ドメイン: Domain B = Editor Dynamics Tool 対応（apps/editor を dynamics-file-v3 へ全面対応）
- オラクル: `discussion/design/dynamics-world-frame-chain.md`（§3 物理 / §3.5 出力写像 / §3.7 settled / §4 スキーマ / §7 validator 改廃 / §8 プリセット / §9 player v2 語彙）
- 計画: `discussion/implementation/orchestration/wave106-plan.md` §7
- 拘束台帳: `discussion/implementation/orchestration/wave106-blast-radius-inventory.md`（apps/editor 節）
- Domain A 引き継ぎ: `wave106-domain-a-core-replacement-report.md`（新 API の形 + 旧診断2件の引き継ぎ）

## 判定: **pass**

apps/editor の dynamics ツールを dynamics-file-v3（世界系 Verlet 質点チェーン、`worldFrameChainV1`）へ全面対応。分離義務を遵守し、実装は Gnome（別コンテキスト）、レビューは Review-Sylph 2レーン（別コンテキスト、並列）へ委任。両レビューレーンが合格。

## ループ回数

- 実装 Gnome: 1回（`completed` 返却、修正ループ不要）
- レビュー: 2レーン並列1回（両 pass、修正ループ不要）
- 合計ループ: 1（needs_fix 発生せず収束）

## 変更 / 作成ファイル

### 実装 src（4ファイル、apps/editor/src のみ）
- `features/editor-session/model/dynamics-tool-state.ts` — v0→v3 全面改修（draft 型を chain/scale/segmentIndex 化、プリセット §8 値、新 validator、preview 型を anchor 化、clone/compare v3 化）
- `workspace/panels/dynamics-tool-inspector.tsx` — UI 改修（Pendulum→Chain セクション新設: rootOffset x/y + segmentLengths リスト編集 + damping + gravityScale、Quick Tune を player v2 語彙化、Inputs/Outputs v3 化）
- `workspace/viewer/viewer-runtime-playback.ts` — settled 判定 §3.7 再設計（質点速度 + 出力オフセット変化。公開シグネチャ維持）
- `features/editor-session/model/parameter-manager-projection.ts` — dynamics 出力 detailLabel を `output.kind`（撤去）→ `segment ${segmentIndex}` へ

### テスト（新規1 + 書換13）
- 新規: `workspace/viewer/viewer-runtime-playback.test.ts`（settled 新判定単体、物理状態を独立構成）
- 全面書換: `dynamics-tool-state.test.ts`（14）、`dynamics-tool-inspector.test.ts`（5）、`viewer-runtime-screen.test.ts`（27、settled/idle 統合）、`canvas-projection.test.ts`、`editor-session-context-history.test.ts`
- 値差し替え（v3 化）: `editor-diagnostics-state.test.ts` / `parameter-definition-commands.test.ts` / `parameter-manager-projection.test.ts` / `app-bar.test.ts` / `diagnostics-screen.test.ts` / `workspace-toolbox.test.ts` / `parameter-manager-screen.test.ts` / `viewer-render-source.test.ts`

### 設計ドキュメント注記
- `discussion/design/screen-design/components/dynamics-tool.md` — §3.2 / §5.2.2 / §9 / §12 に「Superseded by design/dynamics-world-frame-chain.md（dynamics-file-v3）」注記 + 新ノブ最小整合

Forbidden スコープ（`packages/**` / `apps/runtime-player/**` / `apps/authoring-host/**`）は未接触（Spec レビューが git status で独立確認）。install / 回避工作なし。

## テスト・tsc 結果（Orch 独立検証済み）

| スコープ | 結果 |
|---|---|
| dynamics 関連テスト（state14/inspector5/playback4/screen27 + canvas/projection 他） | **全 green（focused 50+ tests、Gnome 集計で 105）** |
| editor 全体 focused run（`npx vitest run apps/editor`） | 435 tests: 431 pass / 4 fail |
| editor tsc（`npx tsc --noEmit -p apps/editor/tsconfig.json`） | 22 errors（exit 1） |

### tsc exit 0 ゲートの扱い（**Undine への最重要申し送り**）

計画 §7 の完了条件は文言上「tsc exit 0」だが、**Orch が独立に stash 検証**した結果、残 22 errors はすべて Domain B スコープ外の pre-existing であり、B 起因ゼロと確定した:

- **ベースライン測定**: `git stash push -- apps/editor`（editor 変更のみ退避、packages は Domain A 版のまま、runtime-player は Domain C 作業中のため未接触）で editor 未移行状態を実測 → **187 errors、うち 166 が dynamics 由来**（`computeDynamicsSource` 廃止・`output.kind`・v0 state リテラル・pendulum/normalization 等）。stash は pop で完全復元済み（stash list 空を確認）。
- **移行後**: 22 errors。dynamics キーワード（dynamic/chain/pendulum/segment/particle/damping/gravity/normalization/influence/strength/sway/angularVelocity/previousSource）を含む error は実質ゼロ（唯一 `viewer-runtime-screen.tsx:431` が message 中に `dynamicsGroups: Record<...>` を含むが、これは `RuntimeStateDto` 型の展開表示で、実体は exactOptionalPropertyTypes による `state?` 受け渡し問題。当該 .tsx 本体は working-tree 未変更＝ B 未接触）。
- **結論**: Domain B は 166 の dynamics tsc エラーを解消し、**新規 error をゼロ導入**。残 22 は variant feature（`variant-selection-resolution.ts` 等、作業ツリーに未コミットで乗っている in-flight 作業）+ mesh（triangleStableIds/topologyRevision）+ session（AuthoringSession exactOptional）の pre-existing 型エラー。**これらは Domain B の編集対象ファイルではない**（22 error のうち B が変更したファイルは `viewer-render-source.test.ts` のみで、そこの 3 error は mesh createMesh の pre-existing。B は同ファイルの dynamics error を消した）。

editor の literal tsc exit 0 は、この variant/mesh/session の pre-existing 群を誰かが解消するまで達成されない。**これは Domain B の領分ではなく、Domain D の apps-tsc-exit-0 ゲート時に variant/mesh 系 pre-existing として分類・処理すべき事項**（Domain A 報告書 §残課題 (B) variants golden 未更新と同根の in-flight variant 作業）。

### editor テスト 4 failed の切り分け

残 4 failed はすべて `workspace/diagnostics/diagnostics-jump-actions.test.ts`（`setActiveEntry("import")` を期待するが実装が `"workspace"` を渡す entry 名リネーム由来）。**Gnome が git stash で着手前状態を実測し同一に 4 failed を確認**、加えて **Test Adequacy レビュアーが独立に**「実装 `diagnostics-jump-actions.ts` もテストも working-tree 未変更（HEAD `6645c2fe` 由来）、mesh/deformer/dynamics/duplicate 横断で dynamics スキーマ固有アサーションは1つも壊れていない」ことを確認。**B 起因ゼロ**。

## レビュー判定（2レーン、`discussion/implementation/reviews/wave106/`）

| レーン | レポート | 判定 |
|---|---|---|
| Spec Compliance（design/dev 含む） | `wave106-domain-b-spec-compliance-review.md` | **合格**（要修正差分なし。7観点全適合。UI×§4 厳密一致、プリセット §8 一致、settled×§3.7 照合で **anchor 経路を runtime-core まで追跡し θ_local=θ_world−φ 厳守＝症状再発温床なしを確認**、廃止識別子 grep 残置ゼロ、Domain A 引き継ぎ旧診断2件の置換確認、validator §7 整合、Quick Tune §9 語彙一致、packages 無変更） |
| Test Adequacy | `wave106-domain-b-test-adequacy-review.md` | **合格**（要修正差分なし。新診断の正/負アサーション実効、stepDynamics 整合を `toEqual` 厳密固定、anchor 経由出力を手計算で独立固定、§8 プリセット固定、**settled/idle テストがオウム返しでなく独立構成した物理状態・観測可能な RAF 挙動を固定**していることを検算で確認） |

## 裁量判断（Orch 追認、両レビュアーが妥当と評価）

1. **input scale 既定 = 1.0**（`DEFAULT_INPUT_ANGLE_SCALE`、kind=angle）。設計 §10 の FaceZ→scale 1.0 を保守的既定に採用。パラメータ種別から scale を推測する材料がないため固定値。Spec レビュー: §10 と矛盾なし。
2. **output 既定 scale = 1/30**（`DEFAULT_OUTPUT_SCALE_PER_DEG`、6桁正規化 = 0.033333）。§8 脚注「パラメータ 1.0 = 30°」起点。
3. **output 既定 limit = レンジ半分**（`(max−min)/2`）。§8 が limit 具体値を UI 較正前提で未定としているため、「default から片側エッジまで offset が到達でき過剰クランプしない」合理的既定として選定。両レビュアー: 裁量の範囲内で妥当。
4. **Quick Tune = player v2 の5語すべて**（§9: outputScale / lengthScale = 乗数、limit / damping / gravityScale = 直接値）。`applyQuickTuneDraftToGroup` で `output.scale * outputScale`・`segmentLengths.map(L=>L*lengthScale)` を適用。live-delta セマンティクス（乗数は commit 後に 1.0 リセット）。**player v2 語彙と完全整合**（Spec レビューが §9 と照合し一致確認）。commit payload は `{dynamicsGroupId, chain, outputs}`（旧 pendulums なし）。
5. **preview 型の再設計（source→anchor）**: `DynamicsToolPreviewEvaluation` の旧スカラー `{source, rawSource}` を撤去し `anchor: DynamicsAnchorPose`（§3.2 φ_deg + world pin）へ置換。世界系チェーンにスカラー "source" は存在せず、出力は頭フレーム角（§3.5）で読むため必然。preview 出力は必ず `computeDynamicsOutputOffsetsWithAnchor(group, state, sampled.source.anchor)` で算出し θ_local=θ_world−φ を厳守（anchor 無しで particles から角を出す経路は不在）。両レビュアー: 設計原理に忠実、症状再発温床なし。
6. **settled 閾値**: `PARTICLE_SPEED_EPSILON = 1.0` cm/s（dt≈0.01667s で 1 フレーム変位 ≈0.017cm、segmentLengths 6〜18cm に対し約0.1〜0.3% = サブピクセル運動相当）、`OUTPUT_OFFSET_DELTA_EPSILON = 0.001` パラメータ単位（可視スライダ精度 recommendedUiStep 0.01〜0.1 以下）。両レビュアー: 恣意的でなく §3.7 の意図に沿う。出力オフセット変化項は前フレーム particles を px,py から復元して差分を取り、追加状態なしで output 変化を捕捉。

## escalate 判定

なし。新スキーマで既存部品（NumberField + Add/削除ボタン）で組めない編集項目は出ず（segmentLengths リスト編集は実装可能）、packages 変更・install の必要なし。

## 残課題 / 申し送り

### Undine / Domain D への引き継ぎ（Domain B スコープ外）
1. **editor tsc の残 22 errors（非 dynamics・pre-existing）**: variant feature（in-flight、未コミットで作業ツリーに乗る）+ mesh（triangleStableIds/topologyRevision）+ session（AuthoringSession exactOptional）由来。Domain B は 166 の dynamics error を解消し新規ゼロだが、literal な editor tsc exit 0 はこの variant/mesh/session 群を解消するまで達成されない。**Domain D の apps-tsc-exit-0 ゲート時に variant/mesh 系 pre-existing として分類・処理**すべき（Domain A 報告 §残課題 (B) variants golden と同根）。
2. **editor テスト 4 failed（`diagnostics-jump-actions.test.ts`）**: entry 名 `"import"→"workspace"` リネーム由来、HEAD `6645c2fe` 時点でコミット済みの pre-existing、dynamics 無関係。Domain D または別途で処理。

### 被覆ギャップ（Test Adequacy レビュアー申し送り、即 fail ではない）
- **多段 N≥2 の editor 物理出力テスト無し**（segmentIndex≥2 の角読み）。設計 §11 で「多セグメント実運用検証は未決」、計画 §14 で Out of Scope。スキーマ・ソルバは runtime-core 側（Domain A）で対応済み。editor は単一 segment/output 前提で v3 対応の最小を実装。**Orch 裁量: 本 wave スコープ内。次 wave 申し送り**（N≥2 実運用時の回帰リスクとして記録）。
- **複数 output の editor 経路テスト無し**（draft/preview は outputs[0] 固定）。上と同じく次 wave 申し送り。
- **settled (B)項（output-offset-delta）単独検証無し**（"changing" ケースは速度項が支配的で B 項が分離検証されていない）。B 項は実装済み・統合テスト済み。**Orch 裁量: settled の実効性は速度項＋統合挙動で足りると判断。分離テストは次 wave 申し送り**（settled 判定を触る際の回帰リスクとして記録）。

これらギャップは両レビュアーが「即 fail ではない」と評価し、修正差分の指示はゼロ。計画 §14 Out of Scope（多セグメント N≥2、複数 output の実運用）と整合するため、Orch は修正ループを起こさず pass と判定した。

## 起動した全子 agentId と閉域結果（規則5）

| agentId | 役割 | 成果物 | 閉域結果 |
|---|---|---|---|
| `a2986e92b280908cc` | Gnome（editor v3 実装 + テスト） | `wave106-domain-b-gnome-report.md` | completed（TaskStop: No task found = 生存なし） |
| `ae722e4fdee8d2120` | Review-Sylph Spec Compliance | `wave106-domain-b-spec-compliance-review.md` | completed（TaskStop: not running 確認済み） |
| `a4e196333bbbcfbd4` | Review-Sylph Test Adequacy | `wave106-domain-b-test-adequacy-review.md` | completed（TaskStop: not running 確認済み） |

**掃除リスト（Undine / ユーザーへ）**: Gnome（`a2986e92b280908cc`）が **inspector UI テスト書換のために孫サブエージェント1体**を起動した（Gnome 報告 §委任）。この孫は 5/5 green で完遂を Gnome が確認済みだが、Orch からも Undine からも観測・停止できない（規則5: 孫は L0 から不可視）。UI 上に生存表示が残る場合はユーザーの手動停止でのみ閉じられる。**作業ツリーへの影響はなく衛生問題のみ。急がなくてよい**。Orch の直接の子3体はすべて閉域済み（孤児なし）。

## Basis Coverage（設計 → 実装 → 検証）

| 検証項目（計画 §7 / §11 Editor 行） | 最小 evidence | 状態 |
|---|---|---|
| UI フィールドが §4 スキーマ（chain/input/output）を表示・編集 | inspector Chain/Input/Output セクション + draft 型が payload DTO 再利用（Spec レビュー観点1） | pass |
| プリセット4種が §8 の値 | `DYNAMICS_TOOL_PRESETS` + `dynamics-tool-state.test.ts` "§8 preset chain values"（Spec レビュー観点2） | pass |
| Quick Tune が player v2 語彙（§9）と整合 | `QUICK_TUNE_FIELDS` = outputScale/limit/damping/gravityScale/lengthScale、乗数/直接値の適用（Spec レビュー観点6） | pass |
| settled が §3.7 で再設計・idle throttle 挙動維持 | `isViewerRuntimePlaybackStateSettled`（質点速度+出力変化）+ `viewer-runtime-playback.test.ts`（rest→true/swing→false/pre-min→false）+ screen 統合（restart-from-idle）（両レビュー） | pass |
| §3.5 θ_local=θ_world−φ を壊さない（症状再発防止） | preview/settled とも anchor 経路（`...WithAnchor`/`...FromGraph`）、runtime-core まで追跡確認（Spec レビュー観点3） | pass |
| 廃止フィールド・旧診断の editor 残置ゼロ | grep 実装コード残置ゼロ、Domain A 引き継ぎ旧診断2件（normalizationInvalid/outputStrengthZero）置換（Spec レビュー観点4） | pass |
| draft バリデーション §7 語彙整合 | 新設4/改定 unstableSettings/維持診断（Spec レビュー観点5） | pass |
| draft/clone/compare/preview の新状態型対応 | v3 clone/compare + undo/redo v3 payload テスト（Test Adequacy §2.4） | pass |
| dynamics 関連テスト全 green | focused 全 green（両レビュー独立実行） | pass |
| 既存 editor テスト非退行 | 431/435、残4は pre-existing（B起因ゼロ、二重切り分け） | pass |
