# Mesh / Rendering Map Freshness Audit

監査基準点は `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`、基準日は 2026-08-08。既存の worktree 変更と監査成果物は変更しない。

## 1. 担当範囲と確認した map

確認対象は次の4 map。

- `discussion/mesh-generation/_map.md`
- `discussion/mesh-generation/implementation/_map.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/mesh-rendering/_map.md`

意味の裏取りとして、Wave68/69/70/71/86/95 の各 `_map.md` と final report、Mesh Wave 1/1.1/1.2/1.3 の report/review、Wave108/109 の report・Git、現行 mesh/render source/test を確認した。

## 2. Map ごとの分類と判定

| Map | 種類 | 判定 | 要旨 |
|---|---|---|---|
| `discussion/mesh-generation/_map.md` | `living-current-state` + topic index | **Partially stale** | v6/v7 併存、v6 default、トグル残置という結論は現在も正しい。一方、Wave1.2/1.3 の完了、Wave108/109 の UV/render 契約、往復2後の評価済み状態が入口に反映されていない。 |
| `discussion/mesh-generation/implementation/_map.md` | `living-index` | **Partially stale** | Wave1.2 は完了済み、Wave1.3 は report/review まで完了済みなのに `Planned`。Wave1 visual gate は往復2で実施済みで、次 action の「評価を実施」「合格後 Wave2」は古い。 |
| `discussion/design/mesh-generation/_map.md` | `living-current-state` + historical design index | **Partially stale** | v6d-adaptive は現行 default mainline、Wave71/86/95 の v6 hardening は現行実装に残る。ただし v6a/b/c や v6d/e/f の一時 selector を「現在の選択面」のように記述する行と、v6/v7 toggle を復活させないという古い語りを更新すべき。Wave108 の非クランプ/Option E 記録自体は正しい。 |
| `discussion/design/mesh-rendering/_map.md` | `living-current-state` + design index | **Partially stale** | Wave108 実装・Option E・非クランプ/透明 padding/LINEAR は正しい。しかし WebGL2 foundation と V4 は Wave67 で既に実装済みで、`次 wave=WebGL2 foundation`/`V4 sidecarを進める` は古い。boundary design の「未コミット・実機 gate 未完」も current Git と後続 Wave109 証跡に対して historical。 |

## 3. stale / 疑わしい記述

### 3.1 `discussion/mesh-generation/_map.md`

- `:16` は `evaluation-log.md` を「往復1 記録済み」とするが、同ファイルには往復2（2026-07-07、ユーザー裁定「v6/v7 は一長一短、topic 保留、toggle 残置」）まで存在する。round-2 の結果を入口に昇格すべき。
- `:22` は implementation を Wave1 完了・目視待ちだけで索引する。Wave1.2 は `8640d12` で完了、Wave1.3 は `45d2734` に report/review が存在し、Wave108/109 は別の mesh-rendering topic として完了済み。
- `:26` の「v6/v7 併存・toggle 残置」は**現行事実**。ただし日付・「目視待ち」理由は往復2後に更新が必要。
- `:35` の「UV clamp 整合」は未決のまま残っているが、Wave108 A1/Option E で解決済み。生成側 clamp は撤去され、padding の正準関数は `mesh-generation-coverage-margin.ts` で実装された（設計 map 自身の `:55` は既に解決後の記述）。
- `:37` の `computeMeshQualityMetrics` と V6 型の後続検討は現行でも残る未決事項であり、削除不要。

### 3.2 `discussion/mesh-generation/implementation/_map.md`

- `:9` の `mesh-wave1-plan.md ... (Planned)` は Wave1 実行完了と矛盾。
- `:20` の Wave1.3 `Planned` は stale。`waves/mesh-wave1.3/domain-g-report.md` と `reviews/mesh-wave1.3/domain-g-review.md` が存在し、review は適合、authoring-host の contentInset remap は現行 source にある。
- `:21`, `:39-40` は「ユーザー目視評価 gate 待ち」「合格後 v6 削除」を現行 next action とするが、`discussion/mesh-generation/evaluation-log.md` 往復2で評価は完了し、結果は v6/v7 一長一短・保留・toggle 残置。Wave2(v6削除) は未着手のままユーザー再裁定待ちである。
- `:35` の統合数値（authoring-core 276 等）は Wave1 当時の実験記録としては正しいが current total ではない。Wave108/109 後の権威値は Wave108 final report の packages 241 files / 1492 tests、Wave109 commit message の packages 1500 green と区別して示すべき。

### 3.3 `discussion/design/mesh-generation/_map.md`

- `:17-19`, `:43-44` は v6a/b/c を Editor 一時比較 selector の現行導線として読むと誤る。Wave68/69 は完了済みの歴史的 backend 実験であり、現行 UI は v6d-adaptive と v7 の2選択。
- `:45` は Wave70 の「temporary algorithm selection UI は外れ」を記録する歴史としては正しいが、Wave1 で復活したのは backend selector ではなく v6/v7 generation-family toggle である。この二つを明示的に区別すべき。
- `:47` の Wave71 adaptive-staggered-band は historical fallback/implementation basis として正しい。
- `:48`, `:52` の v6d-adaptive-contour-constrainautor が current accepted/default mainline という記述は現行 source と一致する（default は `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69-97`）。ただし「algorithm selector UI を復活させない」は generation-family toggle を除く backend selector の意味に限定すべき。
- `:55` の Wave108 Option E（非クランプ UV + size-dependent transparent padding）は現行 source/test と一致し、更新不要。

### 3.4 `discussion/design/mesh-rendering/_map.md` と boundary design

- `discussion/design/mesh-rendering/_map.md:31` の「次 wave の本線 = WebGL2 renderer foundation」は Wave67 の完了証跡（`discussion/implementation/waves/wave67/wave67-final-integration-report.md:18-25`）後では stale。現在は WebGL2 primary + Canvas2D fallback/overlay の実装済み基盤を前提に、実 GPU/pixel parity と Canvas2D sunset条件が残る。
- `:33` の V4 を「sidecar として進める」も Wave67 で `auto-outline-v4-contour-band` が実装済み。品質比較の historical sidecar と表記するのが適切。
- `boundary-transparent-margin-design.md:10-13,133-140` および Wave108 final report `:6,94-97` は Wave108 closeout 時点の「commit 未実施・実機 gate 未完」を記録している。現在の Git では Wave108 実装が `70485f4` にコミットされ、commit subject は `実機atlasRuntime目視gate通過` と記録する。さらに `899cb2e` (Wave109) が非ゼロ contentInset の runtime-export preflight を修正し、export→player 実機確認済みと記録する。したがって「未コミット」は historical qualifier が必要、「gate 未完」は正式な別受入証跡を要求するなら Unverifiable と注記するのが安全。
- Wave108 final report `:78` の `original` 表示を「content が inset/縮小する残課題」とする記述は、後続の `8640d12`（Wave1.2）より前の観測として stale。現行 `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:98-109,120-169` と `canvas-projection.ts:407-420` は contentInset remap を実装し、focused test も pass。残課題として残す場合は「Wave1.2 remap 以前の観測」または現行実機で再現した場合だけに限定する。

## 4. Historical experiment と current implementation の分離

| 時点 | 事実の種類 | 現行への意味 |
|---|---|---|
| Wave68 (`f1d2313`) | 実験結果 / implementation proof: v6a/v6b/v6c sidecar と temporary backend selector、default は v2.6 | 現行 UI の選択肢ではない。候補/backend と provenance の歴史として保持。 |
| Wave69 (`73bd313`) | 実験結果: v6D/v6E/v6F を比較、selector を差し替え、final backend selection は後続判断 | v6D lineage を選ぶ根拠の一部。v6E/v6F selector は現行導線でない。 |
| Wave70 (`49a05102`) | 設計/実装判断: support-ring v6D を通常 route、backend selector を除去 | 現行 v6 lineage の中間点。旧 v6D は registry/fallback/test に残る。 |
| Wave71 (`6b38eeb`) | 実験結果/visual confirmation: adaptive-staggered-band を一時 default | 後続 direct tuning で `auto-outline-v6d-adaptive-contour-constrainautor` が accepted/default mainline になった。 |
| Wave86 (`1cec9d6`) | 実装 hardening: v6D crossing diagnostics + bounded local repair | 現行 v6D 経路の品質/diagnostics に残る。generation-family の選択判断は変えない。 |
| Wave95 (`ad5bb61`) | 実装 hardening: multi-alpha-island V6D generation/diagnostics/provenance | 現行 v6D の multi-island capability。v7 が v6 source を import するという意味ではない。 |
| Mesh Wave 1 (`04e24cd`) | 実装: v7 を新規追加、薄い v6/v7 toggle、default は v6d-adaptive | **current implementation の選択面**。 |
| Mesh Wave 1.2 (`8640d12`) / 1.3 (`45d2734`) | 実装: editor / authoring-host の contentInset UV remap | Wave108 padding を消費する current render/perception behavior。 |
| Wave108 (`70485f4`) / Wave109 (`899cb2e`) | 実装: UV 非クランプ、size-dependent transparent padding/gutter、LINEAR、export preflight fix | v6/v7 の品質比較・default・toggle寿命を変更しない rendering/data contract。 |

## 5. Current implementation facts and evidence

- V6 は9 method/source/backendを contract に登録、V7 は `auto-outline-v7-margin-contour` 1 method を登録している（`packages/authoring-core/src/mesh-generation-contract.ts:7-16,147-162`）。これは「v6が消えた」「v7がdefaultになった」事実ではない。
- Dispatcher は V7 分岐を先に処理し（`packages/authoring-core/src/mesh-generation.ts:142-152`）、V6 全methodを別分岐で処理する（`:154-245`）。v7 実装が v6 method へ暗黙に置換されたわけではない。
- Editor の現行 default は `auto-outline-v6d-adaptive-contour-constrainautor`、toggle は v6/v7 の2要素（`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69-97`）。`mesh-tool-generation-method.test.ts:31-83` は v7 選択、default v6、3 preset→densityHint を固定し、今回 focused run で pass。
- Wave108 D-gen は v6/v7 の layer-local UV clamp を撤去した（`mesh-generation-v6-contour-pipeline.ts:253-267`; `mesh-generation-v7-margin-contour.ts:260-285`）。`maxCoverageMarginSourcePixels` は `packages/authoring-core/src/mesh-generation-coverage-margin.ts:92-99` に正準化され、v7 の r は自然値のまま。
- Render 側は WebGL2 `LINEAR`（`packages/render-webgl2/src/webgl2-textures.ts:38-55`）と premultiplied LINEAR software sampler（`packages/render-software/src/raster/texture-sampler.ts:101-150`）。transparent gutter bake は `texture-atlas-transparent-gutter.test.ts` で実パイプラインを検査する。
- 監査時 focused verification: `pnpm.cmd exec vitest run`（mesh v6/v7、coverage-margin、atlas gutter、runtime export、software sampler、Editor toggle、canvas/viewer remap の10 files）= **10 files / 158 tests passed**。初回 sandbox は esbuild `spawn EPERM`、escalated rerun は exit 0。Wave108 final report の権威 full-package 値は packages 241 files / 1492 tests、Wave109 commit message は packages 1500 green と記録する。

## 6. 情報種別の区別

- **リポジトリ事実**: 現行 source/test、`70485f4`・`899cb2e` の Git 履歴、上記 focused verification。default/toggle、UV 非クランプ、padding、LINEAR はここに属する。
- **設計・方針決定**: v6/v7 を別 method にする、品質評価後に v6削除を検討する、Option E で r を束縛しない、atlasRuntime を runtime 一致の正典とする、など。根拠は concept/design とユーザー裁定。
- **実験・検証結果**: Wave68–71 の backend 比較、Wave86/95 の synthetic/diagnostic hardening、Mesh Wave 1 の test/review pass、`evaluation-log.md` 往復2の「一長一短」。コードの pass は v7 の商用風品質勝利を意味しない。
- **未決**: v6削除の品質基準、toggle の寿命、再開時の Wave2 scope。Wave108 の正式ユーザー gate artifact を commit subject 以上に要求するかも確認余地がある。

## 7. 親 map へ反映すべき短い結論

1. `discussion/mesh-generation/_map.md` は「Wave1/1.1完了・目視待ち」ではなく、**往復2評価済み、v6/v7一長一短、topic保留、v6 default + v7 toggle 残置、Wave2未着手**へ更新する。
2. 同 map の UV clamp 未決を削除し、**Wave108/Option E 解決済み（生成UV非クランプ + size-dependent transparent padding/gutter + LINEAR）**を current fact として残す。Wave109 の export-preflight correction も関連証跡に追加する。
3. `discussion/mesh-generation/implementation/_map.md` の Wave1.3 `Planned`、Wave1 final visual gate pending、次 action の v6削除を修正し、Wave1.2/1.3 report/review とユーザー裁定を索引する。
4. `discussion/design/mesh-generation/_map.md` では Wave68/69 の selector を historical backend experiments と明記し、現行 UI は v6d-adaptive/v7 の generation-family toggle と区別する。
5. `discussion/design/mesh-rendering/_map.md` では Wave67 WebGL2 foundation、Wave108/109 current implementation、残る実 GPU/pixel parity・Canvas2D sunset条件を正しく next action にする。Wave108 report の「未コミット」「original inset residual」は時系列を明記する。
6. root `discussion/_map.md` の mesh hold 記述は結論自体は維持できるが、必要なら Wave108/109 が render contract の完了であり mesh quality verdict を変更しないことを一行 cross-link する。

## 8. 未解決事項 / ユーザー判断点

- v6 を恒常的に残すか、v6/v7 toggle の器だけ残すか、v7品質基準を満たした時に Wave2(v6削除)へ進むかは未決。現行コードは v6を default とし v7を比較可能にする保守的な状態。
- Wave108 の正式な実機 gate 受入を「`70485f4` commit subject + `899cb2e` export→player 実機確認」で完了扱いにするか、別の明示的ユーザー記録を要求するかは判断点。自動検証と clean review は pass。
- `original` preview の residual は現行 Wave1.2 remap source/test と Wave108 report の記述が食い違うため、現行実機で再現するかを必要時に再確認する。

## 9. 調査できなかった範囲

- 凍結 `mouth_u` の実機 atlasRuntime 画面そのものはこの監査では再生していない。Git commit subject と report/テスト、Wave109 の export→player 記録までを確認した。
- v6/v7 の商用風品質を新たに目視比較する作業は行っていない。往復2のユーザー所見を歴史的実験結果として扱い、コード/テスト pass から品質優劣を推定していない。
- 親 map の実更新は監査契約により行っていない。
