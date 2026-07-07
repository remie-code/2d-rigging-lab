# Mesh Wave 1 Plan: 商用風メッシュ自動生成 v7（中立部品抽出 + v7コア + 世代切替UI）

> パーツ画像からのメッシュ自動生成に、商用風出力特性(マージン付き簡略輪郭・疎な頂点・細部の粗い包み)を持つ v7 新 method を追加する。中立部品の抽出(v6挙動のバイト同一保存)→ v7コア → 世代切替UI → 統合、の順次バッチ。v6系の削除は本waveに含めない(評価合格後の後続wave)。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Mesh Wave 1（mesh-generation トピック内の第1wave）
- Wave name: `mesh-wave1-v7-commercial-like`
- Primary objective:
  - アルゴリズム中立部品の抽出と v6 挙動のバイト同一保存
  - v7 パイプライン新設（膨張 r / DP簡略化 ε / 再サンプル L / 細長領域の内部点抑制 / Lloyd 緩和）と契約登録（V7系統分離）
  - mesh-tool UI に世代トグル（現行既定 v6d-adaptive ⇔ v7）+ 3プリセットを露出
  - モノレポ全体 green・ドキュメント整合・ユーザー目視評価の手順提示

## 2. Planning Gate Result

Planning Gate result: `Proceed`（inventory first を実施済み・充足）。

- 事実調査2本: [current-implementation-survey.md](../../current-implementation-survey.md)（17 method の生態系・工程分解・差分分析）/ [pre-wave-inventory.md](../../pre-wave-inventory.md)（UI露出面・レンダラ前提・export互換・validator検査・自前DP所在・既存テスト地形、file:line 付き）
- ユーザー承認済み（2026-07-07）: 概念設計 Accepted + 4判断（世代トグル+3プリセット / v7診断は provenance のみ / V7系統分離 / ドメイン分割 A-B-C-D）
- Uncertainty: factual low（2調査で変更面確定）/ decision low（設計・4判断固定）/ cost of wrong plan low（追加的変更のみ、v6挙動はバイト同一ゲートで保護）

## 3. Accepted Decisions / Oracles

### 3.1 設計の正（オラクル）

**[concept-design.md](../../concept-design.md) が唯一の正**。特に:

- §2 パイプライン（膨張マスクが起点。以降の全工程は膨張マスクだけを見る）
- §3 不変条件: **被覆保証（絶対条件・膨張で構成的に担保）/ ε < r 結合則 / 決定性（乱数禁止）**
- §4 修正済み判断: 内部点は間隔 R 明示制御付き farthest-point / 穴は初版では全部埋める / 多島は valid 全島をメッシュ化
- §5 実装方針: v7新method / v6ファイルを import しない自己完結 / 中立部品は共有モジュールへ先に抽出
- §6 委任3層優先順位: 統合層は従う / 中立部品は流用可 / **v6系の密度設計・サンプリング方針は設計参照禁止（食い違えば concept-design が勝つ）**

設計に無い判断分岐を見つけたら実装で埋めず escalate（L0 が裁定して設計文書を改訂する）。

### 3.2 ユーザー判断（2026-07-07 確定）

1. **UI切替**: 世代トグル（現行既定 v6d-adaptive ⇔ v7）+ 3プリセットのみ露出。v6削除時にトグルごと外せる薄い作りにする。既定は現行維持（v6d-adaptive）
2. **v7診断**: preview 契約のスキーマ（`model-edit.ts` の `v6Metrics` 固定枠）は**変更しない**。v7 の品質診断は provenance 焼き込みのみ
3. **ID系統**: 契約内の v7 定数・診断ID・フォールバック理由は **V7専用系統として新設分離**（将来の v6一括削除を機械的にするため）
4. **プリセット対応**: 「大きく動く」= `high` / 「標準」= `medium` / 「あまり動かない」= `low`（既存 `MeshDensityHint` 3値に1:1で載せる。enum 変更なし）
5. **既存 baseline fail は本waveで是正する**（2026-07-07 追加判断）: check:deps の fail（lockfile 内の禁止依存クラス言及）と mesh 無関係の横断テスト約12件 fail（rig-control / warp-lattice / tutorial系、pristine baseline で再現確認済み）を Domain R として追加し、Domain D の「モノレポ全体 green」を差分greenでなく真の全体greenで締める

### 3.3 Model Allocation（従来通り）

L0 = fable / Orch-Sylph・Gnome・Review-Sylph = **opus = Opus 4.8（`claude-opus-4-8`）**。`Agent` 呼び出しで `model: "opus"` を明示必須（無指定は親モデル継承の罠）。

## 4. Wave Strategy

```text
Batch 1:
  Domain A: 中立部品抽出（v6挙動バイト同一ゲート）
Batch 2（A 完了後）:
  Domain B: v7 コア（パイプライン + 契約登録 + プリセット導出）
Batch 3（B 完了後、C と R は並列）:
  Domain C: 世代切替 UI（v6/v7 トグル + 3プリセット）
  Domain R: 既存 baseline fail 是正（check:deps + 横断テスト約12件）
Batch 4:
  Domain D: Final Integration / Clean Review / Map Closeout
```

- B は A が確定させる中立モジュールの公開面に依存するため順次
- C は B の method ID・契約確定に依存するため順次
- 各 Orch-Sylph は SKILL.md の分離規則に従う（Orch 自身は実装しない / Gnome 実装 / Review-Sylph レビュー / ループ上限5 / 在席ポーリング）

## 5. Domain A: 中立部品抽出

Domain id: `mesh-wave1-neutral-geometry`

Allowed write scope:

- `packages/authoring-core/src/mesh-geometry/**`（新設。モジュール名に v6/v7 を含めない中立命名）
- 既存 v6系ファイルの **import 切替と委譲のみ**（`mesh-generation-v6-contour-pipeline.ts`, `mesh-generation-v6-alpha-islands.ts`, `mesh-outline-generation.ts`, 各 v6バックエンド）
- 対応するテストファイル一式
- Domain report / review files（`discussion/mesh-generation/implementation/waves/mesh-wave1/`, `.../reviews/mesh-wave1/`）

Forbidden write scope:

- v6 の**数値挙動を変えるあらゆる変更**（純粋な移動+再輸出のみ許可）
- `mesh-generation-contract.ts` の enum / method 一覧（Domain B の領分）
- `apps/**` / 新規外部依存 / lockfile

Required implementation（抽出対象、所在は survey / pre-wave-inventory 参照）:

- アルファマスク演算: 二値化・soft blur・裂け目埋め・ノイズ除去・`expandMask`（**上限8pxクランプは中立版でパラメータ化して解除**。v6経路は既存値を渡して挙動不変）
- 輪郭系: `traceBoundaryLoops`・ループ選択・`sampleBoundaryLoop`（等間隔再サンプル）
- 簡略化: 自前 Douglas-Peucker（`mesh-outline-generation.ts:348-443`）の中立部品化
- 内部点: farthest-point 貪欲選択（間隔 R の明示制御を**追加できる**シグネチャにするが、v6経路の挙動は不変）
- 多島: `mesh-generation-v6-alpha-islands.ts` の中立モジュール化（re-home または re-export）

Required tests / gate:

- **既存テスト全 green、特に v6 決定性回帰14個（`mesh-generation.test.ts`）が座標同一のまま**。これが本ドメインの合格条件の核
- 中立モジュール単体の smoke テスト（最低限。網羅は不要 — 挙動の正は v6 回帰が担う）

Escalate if: 部品が v6 固有ロジックと分離できない / 移動だけで挙動が変わる構造が見つかった場合。

## 6. Domain B: v7 コア

Domain id: `mesh-wave1-v7-core`

Allowed write scope:

- `packages/authoring-core/src/mesh-generation-v7-*.ts`（新設。**v6系ファイルを import しない**。依存は mesh-geometry/ と外部ライブラリのみ）
- `mesh-generation-contract.ts`（V7系統の追記のみ: method ID・source/backend ID・診断ID・フォールバック理由）
- `mesh-generation.ts`（ディスパッチャへの v7 分岐追加のみ）
- 対応するテスト / Domain report / review files

Forbidden write scope:

- v6系ファイルの変更（ディスパッチャ登録を除く）/ `apps/**` / preview スキーマ（`model-edit.ts` の qualityMetrics 枠）/ 新規外部依存 / lockfile / package-format スキーマ

Required implementation（concept-design §2-4 のとおり）:

- method ID: `auto-outline-v7-margin-contour`（V7系統定数として新設）
- 三角形分割: `delaunator` + `@kninnug/constrainautor`（既存依存・v6ファイル非結合）。Lloyd 緩和は内部点のみ移動→再三角形分割で2〜3回
- パラメータ: named constants + 根拠コメント（マジックナンバー禁止）。初期値は工学的出発点とし評価フェーズで調整する前提を明記
  - r = clamp(0.012 × max(texW, texH), 4px, 16px)（全プリセット共通）
  - ε = 0.8r
  - L（=R）: 大きく動く 12px / 標準 18px / あまり動かない 28px（`densityHint` high/medium/low から導出）
- 細長領域の内部点抑制: 距離変換による局所幅 < R 判定（決定的実装）
- 多島: mesh-geometry の島検出で valid 全島を独立サブメッシュ化。穴は全部埋める
- stableId: `vtx_<token>_v7_boundary_<i>` 系（machine-readable 命名規約 [_conventions.md](../../../_conventions.md) §8 準拠）
- フォールバック: v7 blocked 時は既存連鎖（v6d-adaptive 以下）へ接続。V7系統の blocked 理由を契約に追加
- UV は 0..1 にクランプ（validator `mesh.uvCoordinateOutOfBounds` は error）。零面積三角形を作らない

Required tests:

- **被覆保証（本waveの核）**: 不透明ピクセル全点がメッシュ内（点-三角形包含の走査で assert）。細い毛先fixture を含む
- 決定性: 同一入力2回で頂点・三角形・stableId が完全一致
- ε < r: プリセット導出テーブル全行で成立を assert
- 細長抑制: 細長fixture で該当領域の内部点が0になること
- プリセット単調性: L(大きく動く) < L(標準) < L(あまり動かない)、頂点数はその逆順
- UV 全点 [0,1] / 零面積三角形なし / 多島fixture / 穴あきfixture（穴が埋まる）
- 既存挙動の無傷: v6 回帰14個を含む既存テスト全 green

Escalate if: Lloyd 再三角形分割で制約辺の回復が不安定 / 距離変換のコストが許容外 / concept-design に無い判断分岐が必要になった場合。

## 7. Domain C: 世代切替 UI

Domain id: `mesh-wave1-generation-ui`

Allowed write scope:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-state.ts`（既定 method 定数の周辺。3プリセット枠は既存 L48-67）
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`（必要範囲）
- 対応するテスト / Domain report / review files

Forbidden write scope: `packages/**`（契約は B で確定済み）/ 新規依存。

Required implementation:

- 世代トグル: 現行既定（`auto-outline-v6d-adaptive-contour-constrainautor`）⇔ v7（`auto-outline-v7-margin-contour`）の2択。**既定は現行維持（v6側）**
- 3プリセット: 「大きく動く/標準/あまり動かない」を `densityHint` high/medium/low へ写像（表示文言は既存UIの言語慣行に従う）
- トグルは評価用の薄い実装にする: 選択肢を定数2件の配列で持ち、v6削除時に「配列から1行消す+トグルUI撤去」で終わる形。分岐を UI 全体に散らさない
- 17 method の全露出はしない。preview カードへの v7 品質数値表示もしない（provenance のみ）

Required tests: トグルで generateMesh payload の method が切り替わる / プリセットで densityHint が切り替わる / 既定が現行 method のまま / 既存 mesh-tool テストの無傷。

Escalate if: mesh-tool-state の method 定数が想定以上に広く配線されておりトグル化が UI 再設計を要する場合。

## 8. Domain R: 既存 baseline fail 是正（2026-07-07 ユーザー判断で追加）

Domain id: `mesh-wave1-baseline-remediation`

対象は本waveの実装と無関係に baseline で fail している2種:

1. `pnpm run check:deps` の fail（lockfile が禁止依存クラス〔外部リギングランタイム互換系〕に言及、との判定）
2. mesh 無関係の横断テスト約12件（rig-control / warp-lattice / tutorial 系。Domain A/B が pristine baseline〔git stash〕で再現を二重確認済み）

Allowed write scope:

- 診断で特定された fail 起因のソース・テスト（rig-control / warp-lattice / tutorial 系ほか診断結果に従う）
- check:deps が誤検知の場合のチェッカー設定・判定ロジック
- Domain report / review files

Forbidden write scope:

- mesh-generation の v6/v7 実装と mesh-geometry/**（Domain A/B の成果に触れない）
- mesh-tool UI（Domain C が並列稼働中。衝突禁止）
- **依存の追加・削除・lockfile 変更・`pnpm install` は実行禁止**。実依存の除去が必要と診断された場合は、正確な変更計画（対象 package.json・除去手順・影響）を作成して escalate（L0 がユーザーと調整して実行する）

Required behavior:

- まず診断: 12件の fail の正体（回帰か・環境か・仕様変更の追従漏れか）と、check:deps 判定の誘発エントリ・引き込み元・実依存/誤検知の別を file:line 付きで確定
- 是正: テスト fail はユーザー判断を要さない範囲で修正（設計判断が必要なものは escalate）。check:deps は誤検知ならチェッカー側を修正、実依存なら escalate
- Gate: 対象12件が green / 新規 fail ゼロ / mesh 系テスト（v6回帰14個・v7 16件）無傷 / typecheck・check:source pass

Escalate if: fail の是正に仕様・設計のユーザー判断が要る / 依存・lockfile 変更が必要 / fail がユーザーの WIP 由来と診断された場合（勝手に「直す」とWIPを壊すため）。

## 9. Domain D: Final Integration / Clean Review / Map Closeout

Domain id: `mesh-wave1-final-integration`

- モノレポ全体 tsc + 全テストスイート green の確認（**Domain R 是正後の真の全体 green**。check:deps を含む。R で escalate された残件がある場合はユーザー裁定の記録を添えて既知として明示）
- Domain B 申し送りの記録: v7 が統合層ヘルパ `computeMeshQualityMetrics`（V6型参照）に依存している事実を、v6削除（Mesh Wave 2）計画の入力として文書に残す
- クリーンレビュー（concept-design §2-6 と実装の突合、Review-Sylph 独立）
- 実装事実に合わせて関連ドキュメントを更新する。
  - [concept-design.md](../../concept-design.md) の Status を Implemented へ / [mesh-generation/_map.md](../../_map.md) / [implementation/_map.md](../_map.md) / 必要なら root [_map.md](../../../_map.md) の状態行
  - 未決事項の棚卸し（評価基準・keyform追従・穴対応は未決のまま明示維持）
- wave final report（`discussion/mesh-generation/implementation/waves/mesh-wave1/final-report.md`）
- **ユーザー目視評価 gate（wave外）の手順を final report に含める**: 髪など有機的パーツで生成→世代トグルで v6/v7 比較→3プリセット比較→3特徴（マージン付き簡略輪郭 / 疎な頂点 / 毛先の粗い包み）のゲシュタルトを商用参照画像と目視突合→パラメータ初期値の調整要否を判断

## 10. Acceptance Criteria

- v7 method が契約に V7系統として登録され、UI 世代トグルから選択・生成できる
- v7 出力が3特徴を構造的に持つ（テストで: 被覆保証 / 輪郭頂点間隔 ≈ L / 細長領域の内部点0）
- 被覆保証・ε<r・決定性の3不変条件がテストで担保されている
- v6 決定性回帰14個を含む既存テストが全 green（v6 挙動バイト同一）
- v7 実装ファイルが v6系ファイルを import していない
- preview スキーマ・package-format スキーマ・外部依存・lockfile が無変更
- `pnpm install` をエージェントが実行していない
- baseline の既存 fail（check:deps / 横断テスト約12件）が是正済み、または escalate 残件がユーザー裁定付きで明示されている
- 関連ドキュメントが実装事実に整合している

## 11. Out of Scope

- v6系コードの削除（評価合格後の Mesh Wave 2）
- 品質評価の定量化・自動化（目視 gate で開始）
- 穴あきポリゴン対応 / リグ済みパーツ再生成時の keyform 追従
- preview qualityMetrics スキーマ拡張 / 17 method の UI 全露出
- 新規依存・lockfile 変更・`pnpm install`

## 12. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う（Orch 自身は実装しない / Gnome 実装・Review-Sylph レビューの分離 / ループ上限5 / 在席ポーリングによる子待機 / 孤児を残さない / 環境操作は escalate / モデル明示指定）
- 各委任契約に完了成果物パスを必須で含める（Gnome: `discussion/mesh-generation/implementation/waves/mesh-wave1/domain-{a,b,c}-report.md`、Review-Sylph: `.../reviews/mesh-wave1/domain-{a,b,c}-review.md`）
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
- レビュー構成: Domain A / C / R は単一 Review-Sylph、Domain B は2レーン（設計適合=concept-design突合 / テスト妥当性）を別コンテキストで
- Domain R の成果物パス: `discussion/mesh-generation/implementation/waves/mesh-wave1/domain-r-report.md` / `.../reviews/mesh-wave1/domain-r-review.md`
- 設計文書に無い判断分岐を見つけたら実装で埋めず escalate（L0 が裁定して concept-design を改訂する）
