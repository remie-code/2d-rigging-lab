# Current Capability Map

> Status: 2026-05-30 時点の実装状況マップ。
> Purpose: 次Wave計画前に、製品・システムとして「何を作るつもりで、何ができていて、何がまだ足りないか」を読むための入口。Wave別 changelog ではない。

## 1. Product Intent / Intended Capability

| 項目 | 現在の意図 |
|---|---|
| 主対象 | 個人利用の **Private 2D Rigging Lab / Prototype**。権利クリーンな2D素材を、独自形式・独自UI・独自runtimeで可動モデル化する実験環境。 |
| MVPの中心 | rights-clean layered character art -> private GUI editor -> project-defined model package -> private runtime / viewer -> validator / AI assistant -> demo-safe capture の一周。 |
| 作らないもの | Cubism互換製品ではない。Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading、`.model3.json` / `.moc3` 等の検査・読み込み・変換は行わない。 |
| Track分離 | Private Prototypeが実装本体。Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subset は混ぜない。 |
| AIの役割 | 人間のGUI制作を置き換えるのではなく、dry-run、diff、validation、repair suggestion、provenance確認で制作判断を補助する。 |
| Transport境界 | Runtime / editor / AI command foundation はあるが、HTTP / WebSocket / MCP 等の外部transportは Future scope。MVP境界が変わるまで実装しない。 |

## 2. Implemented Capabilities

| 領域 | 現在できていること | 根拠 / 注意 |
|---|---|---|
| Monorepo / package基盤 | `packages/*`、`apps/editor`、contract fixtures、typecheck / source guard / e2e smoke の実行基盤がある。 | Wave 0-7 summaries、`rg --files apps packages fixtures`。 |
| Contract / DTO | ID、diagnostic、package info、runtime state、runtime sequence、model diff、runtime diff、validation diff、artifact refs などの共有contract基盤がある。 | Wave 1、`packages/contracts/src/*`。 |
| Package / model format | project-defined package、manifest、model graph、asset/model file paths、drawable / mesh / parameter / keyform / rigControl / dynamics 用schema基盤がある。 | Wave 2、`packages/package-format/src/*`、`fixtures/contracts/minimal-valid-package`。 |
| Authoring / operation lifecycle | authoring session、`createParameter`、`addKeyform`、`addKeyformGrid2d`、dry-run / commit、operation log、operation evidence の基盤がある。 | Wave 3、Wave 11、`packages/authoring-core`、`packages/operation-core`。 |
| Runtime / validation evidence | operation結果にruntime snapshot / validation report / artifact refs を結び、package-relative artifactとしてmaterializeする基盤がある。 | Wave 4-5、`packages/runtime-core`、`packages/validator-core`、`packages/operation-core`。 |
| Persistence | package file set、operation log JSONL、generated artifact paths、browser-local project save/load/reset、operation log hydration、AI transcript persistence がある。 | Wave 5、Wave 7、Wave 9。OS filesystem / archive import/exportではない。 |
| Editor UI | Vite + vanilla TypeScript の browser editor があり、sample package、parameter list、`createParameter` form、operation / evidence / package panels、project storage、AI approval / transcript panelsを表示できる。Wave 14で embedded preview panel、preview slider、runtime-projected SVG visual/summaryを実装済み。Wave 15で generated drawable / mesh authoring form、drawable list、result summary、preview observation、save/load persistence smokeも実装済み。 | Wave 6-9、Wave 14-15、`apps/editor`。Wave 15はneeds-fix loop後のfinal verificationまで通過し implementation-proven。 |
| AI command foundation | transport-independent `ai-interface`、in-process editor AI host、dry-run / approval / commit、transcript、`inspectModel` / `inspectTarget` / `validatePackage` read commandsがある。 | Wave 8-10。LLM providerや外部transportは未実装。 |
| Keyform authoring | `addKeyform` / `addKeyformGrid2d` のoperation handler、authoring mutation、registry/lifecycle、editor evidence、AI `addKeyform` regressionがある。 | Wave 11。 |
| Keyform runtime evaluation | Wave 12で runtime-visible keyform evaluation foundation が入り、effective parameter resolution、linear 1D / Grid2D sampling、mesh/drawable target application、snapshot `keyformSamples`、runtime-visible evidence fixtureがある。 | Wave 12。重要な到達点。 |
| Runtime state / deterministic evaluation | initial `RuntimeStateDto`、state compatibility、runtime snapshot、snapshot comparison、dynamics state/evidenceの基礎がある。 | `packages/runtime-core/src/*` の focused inspection。製品UI上の完全なviewer workflowとは別。 |
| Runtime diff / Grid2D evidence hardening | Wave 13で runtime diff dedicated fields、Grid2D fixture/evidence、diagnostic regressions、AI/editor `addKeyformGrid2d` runtime-visible evidence が pass。 | Wave 13。Editor / viewer 上の visible preview workflow とは別。 |
| Verification posture | Wave 8-15 は final report上、typecheck / tests / source guard / e2e / diff check / clean review が pass。Wave 14では sample-aware regression、Wave 15では operation lifecycle regression の needs-fix loop後にfinal rerunで通過。 | 各Wave final report。Wave 15 completion は [waves/wave15/wave15-final-report.md](waves/wave15/wave15-final-report.md) に記録済み。 |

## 3. Partially Implemented / Foundation Exists But Product Workflow Is Incomplete

| 領域 | あるもの | まだ製品ワークフローとして不足しているもの |
|---|---|---|
| GUI authoring全体 | Browser editor、`createParameter`、project persistence、AI approval panels、embedded preview、generated drawable / deterministic mesh authoring vertical slice。Wave 15でGUIからrights-clean generated drawable / meshを作成し、preview / persistence / evidenceで確認する一周が implementation-proven。 | PSD / split PNG import、real texture pipeline、part/texture authoring、full mesh editor、draw order editor、mask/clipping editor、rig control authoring、dynamics authoring、canvas上の直接操作は未完または未検証。Wave 15の到達点は generated drawable slice であり、汎用drawable/texture制作環境ではない。 |
| Private Viewer / editor preview | Runtime core、snapshot/evidence、runtime diff、Grid2D evidenceはある。Wave 14で editor embedded preview panel、preview-only slider、runtime-projected SVG visual/summary、desktop/mobile smoke は implementation-proven。 | 残るviewer gapは、editor内embedded previewではなく、独立した private viewer UI、full renderer / texture pipeline、renderer adapter、demo capture用viewer surface。これらは未完または未検証。 |
| Rig control | format / graph / runtime graph adapter / keyform target kindとしての基盤はある。 | Wave 12 residualにより、`rigControl` keyform target application は future scope。GUIでのrig control制作も未完または未検証。 |
| Dynamics | schema、runtime state、snapshot、state compatibility、computed dynamics系の基礎はsource上にある。 | AC-MVP-010/012/013が求める髪・服・小物のMinimum Open Dynamics v1を、GUI authoring -> preview -> viewer -> validator -> diff/evidence で一周した証拠はこのマップ作成時点では未確認。 |
| Validator | package schema、runtime load/evidence、validation report/artifacts、fixture regressionsはある。 | MVP全域、特に mesh / mask / rig hierarchy / dynamics / demo-safe分類の完全な製品レポートは未完または要確認。 |
| AI assistant | deterministic command host、read/validate/dry-run/approval/commit、transcript persistenceはある。 | LLM provider、prompt template、natural-language repair、repair candidate generation/ranking、standalone `getDiff`、`rerunValidation` は未実装。 |
| Package durability | Browser-local save/load/reset はある。 | OS filesystem picker、archive writer、project import/export、storage failureの明示UIは future work。 |
| Demo-safe capture | track方針とdemo policy文書はある。 | 実際のcapture scene、素材、preflight自動検査、最終disclaimer、配信可能な画面セットは未実装または未決。 |

## 4. Not Implemented / Future Scope

| 種別 | 内容 |
|---|---|
| 明示的な非目標 | Cubism SDK/Core利用、Cubism形式 import/export、既存Cubism model loading、Cubism Editor UI reproduction、Cubism Viewer compatibility。これは「未実装の欠落」ではなく、現在方針で作らないもの。 |
| 外部接続 | HTTP / WebSocket / MCP transport、LLM provider integration、外部caller向けadapter。Wave 8-12で繰り返し Future scope とされている。 |
| 公開・配布 | Future SDK、Future integration surface、Future streaming app、OBS output、plugin system、marketplace / registry、public sample distribution、code/binary distribution。 |
| 高度な物理・animation | Cubism Physics互換、direct vertex physics、direct rigControl physics output、cloth simulation、collision、IK、timeline bake、AI automatic dynamics tuning、timeline animation editor、motion export、lip sync、video editor。 |
| 完成素材・法務判断 | 配信用素材、capture scene、最終disclaimer、法務/特許クリア判断、最初にLive2Dへ提案する機能テーマ。 |
| Future Public Clean Subset | 将来公開する場合の最小subset設計とrights/dependency review。現在MVP外。 |

## 5. Evidence / Where To Verify

| 確認したいこと | 入口 |
|---|---|
| 現在の製品方針 | [../concept/modified_concept.md](../concept/modified_concept.md) |
| MVPの成功条件 / 非目標 | [../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../acceptance-criteria/03_MVP_Acceptance_Criteria.md) |
| 実装Wave全体の入口 | [_map.md](_map.md) |
| Orchestration plan一覧 | [orchestration/_map.md](orchestration/_map.md) |
| Editor UI / persistenceの到達点 | [waves/wave6/wave6-final-report.md](waves/wave6/wave6-final-report.md), [waves/wave7/wave7-final-report.md](waves/wave7/wave7-final-report.md) |
| AI command / approval / read validation | [waves/wave8/wave8-final-report.md](waves/wave8/wave8-final-report.md), [waves/wave9/wave9-final-report.md](waves/wave9/wave9-final-report.md), [waves/wave10/wave10-final-report.md](waves/wave10/wave10-final-report.md) |
| Keyform authoring / runtime evaluation / Grid2D evidence | [waves/wave11/wave11-final-report.md](waves/wave11/wave11-final-report.md), [waves/wave12/wave12-final-report.md](waves/wave12/wave12-final-report.md), [waves/wave13/wave13-final-report.md](waves/wave13/wave13-final-report.md) |
| Editor embedded preview foundation | [waves/wave14/wave14-final-report.md](waves/wave14/wave14-final-report.md), [waves/wave14/integration-review.md](waves/wave14/integration-review.md) |
| Source-level spot check | `packages/contracts`, `packages/package-format`, `packages/authoring-core`, `packages/operation-core`, `packages/runtime-core`, `packages/validator-core`, `packages/ai-interface`, `apps/editor`, `fixtures/contracts` |

## 6. Next-Wave Candidates And Decision Points

| 候補 | 目的 | 判断ポイント |
|---|---|---|
| Editor / viewer product workflow expansion | Wave 15のgenerated drawable / mesh sliceを足場に、MVPの大きな未完領域であるGUI authoringとviewer確認をさらに進める。 | 次に、rights-clean asset/texture/part flow、mesh editing、draw order editing、mask/clipping、rig control、dynamics、standalone viewer/renderer のどれへ進むか。 |
| Project import/export wave | browser-local persistenceから、package archive / filesystem import/exportへ広げる。 | MVP評価でbrowser-local storageを十分とみなすか、早めに実ファイルの出入口を作るか。 |
| AI repair / diff wave | AI assistantを「観測と承認」から「修復候補提示」へ進める。 | 先にruntime/model/validation diff contractを十分に安定させる必要がある。 |
| Dynamics workflow verification wave | Minimum Open Dynamics v1を、authoring -> runtime -> validator -> evidenceで製品的に証明する。 | 既存sourceのdynamics基盤をどこまでMVP完了証拠として扱えるか、追加実装か検証整理かを先に決める。 |

未決の大きな判断:

- Wave 15後、`Private Viewer` を editor内previewとして段階的に育てるか、別viewer app/surfaceとして切り出すか。
- MVPの次の「一周」証拠を、runtime keyform fixture中心にするか、実際の小さな可動キャラクター制作workflow中心にするか。

Assumptions / uncertainties:

- このマップは指定文書とfocused source tree inspectionに基づく。広範なコードレビューはしていない。
- 「未完または未検証」は、Wave final reportと現在の入口文書だけでは製品ワークフロー完了を断定できなかった領域を指す。
