# Current Capability Map

> Status: 2026-05-31 / Wave 23 完了時点の実装状況マップ。
> Purpose: 次Wave計画前に、製品・システムとして「何を作るつもりで、何ができていて、何がまだ足りないか」を読むための入口。Wave別 changelog ではない。

## Wave 23 Update

Wave 23 is completed / implementation-proven. Domains A-F completed with pass completion/review artifacts, Domain G final verification passed, and clean integration review passed with no findings.

The implemented capability is Minimum Open Dynamics v1 as a deterministic, parameter-driven vertical slice:

- `createDynamicsGroup` can author a minimal dynamics group through dry-run / commit, operation log, target refs, model diff, and package materialization.
- Runtime-core can evaluate deterministic scalar dynamics from authored input parameters, project computed dynamics output into effective parameters, and record dynamics state/output in runtime snapshots and diffs.
- Validator-core reports deterministic AI-readable diagnostics for dynamics parameter relation, producer gaps, duplicate output targets, unsafe settings, output range/clamp evidence, and runtime evidence gaps.
- Editor UI can create/update a minimal dynamics group, run/reset preview, and show computed output, runtime evidence/diff, and validator diagnostics.
- Contract fixtures prove operation result, runtime snapshot/diff, validation report, edge diagnostics, and editor-facing evidence for the Minimum Open Dynamics v1 workflow.
- Desktop/mobile e2e smoke verifies dynamics creation, preview run/reset, browser-local save/load, preview rerun after load, and persisted authored dynamics state.
- No Cubism Physics compatibility, direct vertex physics, file picker, parser, asset I/O expansion, image decode, actual binary upload, archive import/export, external dependency, or package manifest/lockfile change was added.

## Wave 22 Update

Wave 22 is completed / implementation-proven. Domains A-G completed with pass completion/review artifacts, Domain H final verification passed, and clean integration review passed with no blocking or high findings.

The implemented capability is a real asset I/O boundary foundation, not real asset import:

- Package-format can represent package-local binary asset entries/references with digest, byte length, media type, storage status, rights, and provenance metadata.
- A mixed in-memory package file-set can hold text entries and binary entries, compute/compare SHA-256 digest metadata, and report missing/mismatch issues.
- Source/texture metadata can persist package-local binary refs through PSD adapter metadata and split PNG metadata paths without parsing or decoding image bytes.
- Validator-core can report missing package-local bytes, byte length/digest/media type mismatch, binary asset ID/reference mismatch, and binary rights/provenance gaps.
- Rights-clean deterministic JSON byte fixtures prove package-local binary reference, package/operation/validator evidence, and digest behavior without adding PSD/PNG/image files.
- Editor Source Intake and browser e2e display binary availability, missing bytes, and storage unsupported states truthfully and preserve binary refs through browser-local save/load metadata.
- No real PSD parser, image decode, OS/browser file picker, archive import/export, filesystem I/O, actual binary upload, external parser/image/archive dependency, or real PSD/PNG/image fixture bytes were added.

## Wave 21 Update

Wave 21 is completed / implementation-proven. The parser-free PSD adapter/profile boundary now has structured profile persistence:

- `psd-source-v1` source assets can persist structured `layered-character-psd-profile-v1` adapter evidence, canvas, groups, source layers, unsupported features, adapter diagnostics, compatibility policy, and source layer texture/part relation metadata.
- `importPsdSourceAsset` materializes trusted adapter metadata into `sourceAsset.psdProfile` while preserving flattened `diagnostics` and `sourceLayer.unsupportedFeatures` compatibility fields.
- Validator, contract fixtures, editor Source Intake, AI source-asset inspection, and browser e2e now read or verify the structured profile and keep split PNG metadata intake compatibility covered.
- No real PSD parser, file picker, PSD/image decode, raster extraction, binary package storage, external PSD/image dependency, or dependency manifest change was added.

Remaining major gaps are real PSD parser support, PSD/package binary storage, real PNG/PSD decode, raster preview extraction, OS file picker, binary archive import/export, full atlas packing, UV editing, pixel-level render oracle, canvas/WebGL rendering, and standalone viewer texture rendering.

## Wave 20 Update

Wave 20 is completed / implementation-proven. The system now has a parser-free PSD adapter/profile import boundary:

- Adobe official PSD spec coverage and the rights-cleared `test_data/sample_model.psd` characterization are recorded as Wave 20 basis artifacts.
- `importPsdSourceAsset` can commit only when a trusted adapter supplies `layered-character-psd-profile-v1` metadata; missing adapter results remain deterministic diagnostics.
- PSD source profile metadata, source layers/groups, texture preview references, texture IDs, target part IDs, rights/provenance, operation log, source manifest evidence, validator diagnostics, and browser save/load persistence are covered.
- Editor Source Intake supports manual PSD adapter/profile metadata entry without OS file picker, PSD parser, image decode, raster extraction, or Photoshop-compatible rendering claims.
- Synthetic contract fixtures and desktop/mobile E2E smoke verify the PSD adapter/profile path, preview truthfulness, createDrawable/generateMesh flow, and persistence.
- No external PSD/image parser dependency, dependency manifest change, PSD binary fixture, image decode, or raster extraction was added.

Remaining major gaps are real PSD parser support, PSD/package binary storage, real PNG/PSD decode, raster preview extraction, OS file picker, binary archive import/export, full atlas packing, UV editing, pixel-level render oracle, canvas/WebGL rendering, and standalone viewer texture rendering.

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
| Package / model format | project-defined package、manifest、model graph、asset/model file paths、drawable / mesh / parameter / keyform / rigControl / dynamics 用schema基盤がある。Wave 18で optional `texture-atlas-v1` DTO と source manifest / provenance / rights の file-set materialization を split PNG source intake evidence へ接続した。Wave 20で parser-free PSD adapter result から `psd-source-v1` / `layered-character-psd-profile-v1` source profile evidence を materialize できるようになった。Wave 21で adapter / canvas / group / layer / unsupported feature / diagnostic / compatibility policy を structured `psdProfile` として永続化できるようになった。Wave 22で package-local binary asset entry/reference、digest、byte length、media type、storage status、rights/provenance hooks、text+binary in-memory file-set boundary が追加された。 | Wave 2、Wave 18、Wave 20-22、`packages/package-format/src/*`、`fixtures/contracts/minimal-valid-package`、`fixtures/contracts/imported-source-package-evidence-preview-consistency`、`fixtures/contracts/psd-import-happy-path`、`fixtures/contracts/psd-unsupported-layer`、`fixtures/contracts/binary-asset-package-local-reference`。Wave 22はmetadata/in-memory boundaryであり archive/filesystem persistence ではない。 |
| Source asset / rights / provenance intake | Wave 18で metadata-backed `split-png-fallback-v1` の source asset / layer metadata / rights / provenance を GUI から登録し、package source manifest、provenance、rights records、operation log、package file set、validator evidenceへ残せる。Wave 20で manual/profile-driven PSD adapter metadata も source profile、layer/group metadata、texture preview、texture ID、target part、rights/provenance、unsupported feature diagnostics として残せる。Wave 21で PSD metadata は structured profile と flattened compatibility fields の両方で保持される。Wave 22で source asset / texture atlas metadata が package-local binary refs、storage status、digest/byte/media metadata、rights/provenance hooks を保持できる。Blocked rights、missing provenance、missing texture reference、PSD unsupported feature、adapter diagnostics、structured/flattened mismatch、binary missing bytes / mismatch / provenance gap は deterministic diagnostics / validation checks として観測できる。 | Wave 18-22、`packages/authoring-core/src/source-asset-mutations.ts`、`packages/authoring-core/src/binary-asset-references.ts`、`packages/operation-core/src/operations/import-split-png-source-asset.ts`、`packages/operation-core/src/operations/import-psd-source-asset.ts`、`packages/validator-core/src/validators/asset-rights.ts`、`packages/validator-core/src/validators/psd-source-profile.ts`、`packages/validator-core/src/validators/binary-assets.ts`、`apps/editor/src/ui/source-assets`。Metadata/adapter-result/binary-ref only であり、PNG/PSD decode、actual bitmap rendering、PSD raster extraction、actual upload ではない。 |
| Authoring / operation lifecycle | authoring session、`createParameter`、`addKeyform`、`addKeyformGrid2d`、`createDrawable`、`generateMesh`、`setDrawOrder`、`setRuntimeVisibility`、`moveMeshVertex`、`importSplitPngSourceAsset`、`importPsdSourceAsset`、`setRightsMetadata`、`createDynamicsGroup`、dry-run / commit、operation log、operation evidence の基盤がある。 | Wave 3、Wave 11、Wave 15-23、`packages/authoring-core`、`packages/operation-core`。Wave 18で split PNG source import と rights metadata update が supported operation になった。Wave 20で `importPsdSourceAsset` は adapter result present の場合に commit 可能になった。Wave 21で adapter result から structured `psdProfile` を materialize できる。Wave 23で Minimum Open Dynamics v1 group creation が supported operation になった。PSD binary parser ではない。 |
| Runtime / validation evidence | operation結果にruntime snapshot / validation report / artifact refs を結び、package-relative artifactとしてmaterializeする基盤がある。Wave 16で drawable draw order / runtime visibility の runtime diff dedicated fields と validation / operation evidence regression が追加された。Wave 17で mesh vertex edit 後の runtime snapshot vertices / bounds / vertex hash と runtime diff `drawableChanges` を evidence fixture で確認できる。Wave 18で source asset rights / provenance / drawable provenance / visible drawable texture reference の validator oracle と imported-source package evidence fixture が追加された。Wave 20で PSD unsupported feature、PSD layer provenance、texture preview relation、source-layer mapping の validator evidence が追加された。Wave 21で structured PSD profile diagnostics、adapter diagnostics、flattened fallback mismatch、non-PSD profile mismatch の evidence が追加された。Wave 22で binary missing bytes、byte length/digest/media type mismatch、binary asset ID/reference mismatch、binary rights/provenance gaps の validator evidence が追加された。Wave 23で dynamics runtime state/output、snapshot/diff、computed parameter projection、semantic diagnostics、runtime evidence gaps が evidence として確認できる。 | Wave 4-5、Wave 13、Wave 16-23、`packages/runtime-core`、`packages/validator-core`、`packages/operation-core`。Wave 22の binary-aware validation は async entrypoint であり existing sync validator path は互換維持。Wave 23の dynamics は Minimum Open Dynamics v1 であり Cubism Physics互換ではない。 |
| Persistence | package file set、operation log JSONL、generated artifact paths、browser-local project save/load/reset、operation log hydration、AI transcript persistence がある。Wave 16で drawable layer order と runtime visibility の save/load smoke が追加された。Wave 17で mesh vertex coordinate と `moveMeshVertex` operation log の browser-local save/load smoke が追加された。Wave 18で source manifest / provenance / rights / drawable relation の browser-local save/load smoke が追加された。Wave 21で structured PSD profile の browser-local save/load projection と contract fixture persistence が確認された。Wave 22で package-local binary refs が browser-local save/load を metadata として survive することを確認した。 | Wave 5、Wave 7、Wave 9、Wave 16-18、Wave 21-22。OS filesystem / archive import/export / actual binary uploadではない。 |
| Editor UI | Vite + vanilla TypeScript の browser editor があり、sample package、parameter list、`createParameter` form、operation / evidence / package panels、project storage、AI approval / transcript panelsを表示できる。Wave 14で embedded preview panel、preview slider、runtime-projected SVG visual/summaryを実装済み。Wave 15で generated drawable / mesh authoring form、drawable list、result summary、preview observation、save/load persistence smokeを実装済み。Wave 16で drawable list から runtime visibility hide/show と layer move up/down を実行し、preview / operation log / package file set / save-load で確認できる。Wave 17で generated mesh の vertex row から `+X` 等の nudge を実行し、preview SVG polygon、operation log、package file set、save-load で確認できる。Wave 18で Source Intake panel から split PNG manifest / layer / rights / provenance metadata を登録し、imported source layer を existing createDrawable / generateMesh workflow に渡せる。Wave 20で Source Intake に manual PSD adapter/profile metadata mode が追加され、PSD source layer を existing createDrawable / generateMesh / preview / save-load workflow に渡せる。Wave 21で structured PSD profile summary、evidence、AI inspection projection、post-load projection を表示できる。Wave 22で Source Intake が source/texture binary refs、stored/missing/unsupported storage、digest/byte/media metadata、rights/provenance を metadata-only として表示できる。Wave 23で Dynamics panel から minimal dynamics group を作成/更新し、preview run/reset、computed output、runtime evidence/diff、validator diagnostics を確認できる。 | Wave 6-9、Wave 14-23、`apps/editor`。Wave 23はDomain A-G、final verification、clean integration reviewを通過し implementation-proven。PSD/binary mode は parser-free / metadata-only であり file picker/parser/decode/upload ではない。Dynamics は Minimum Open Dynamics v1 であり Cubism Physics互換ではない。 |
| AI command foundation | transport-independent `ai-interface`、in-process editor AI host、dry-run / approval / commit、transcript、`inspectModel` / `inspectTarget` / `validatePackage` read commandsがある。 | Wave 8-10。LLM providerや外部transportは未実装。 |
| Keyform authoring | `addKeyform` / `addKeyformGrid2d` のoperation handler、authoring mutation、registry/lifecycle、editor evidence、AI `addKeyform` regressionがある。 | Wave 11。 |
| Keyform runtime evaluation | Wave 12で runtime-visible keyform evaluation foundation が入り、effective parameter resolution、linear 1D / Grid2D sampling、mesh/drawable target application、snapshot `keyformSamples`、runtime-visible evidence fixtureがある。 | Wave 12。重要な到達点。 |
| Runtime state / deterministic evaluation | initial `RuntimeStateDto`、state compatibility、runtime snapshot、snapshot comparison、dynamics state/evidenceの基礎がある。 | `packages/runtime-core/src/*` の focused inspection。製品UI上の完全なviewer workflowとは別。 |
| Runtime diff / Grid2D evidence hardening | Wave 13で runtime diff dedicated fields、Grid2D fixture/evidence、diagnostic regressions、AI/editor `addKeyformGrid2d` runtime-visible evidence が pass。 | Wave 13。Editor / viewer 上の visible preview workflow とは別。 |
| Dynamics workflow | Wave 23で Minimum Open Dynamics v1 の authoring operation、deterministic runtime sequence、snapshot/diff/evidence、validator diagnostics、editor preview run/reset、fixture evidence、desktop/mobile save-load smoke が implementation-proven。 | [waves/wave23/wave23-final-report.md](waves/wave23/wave23-final-report.md), [reviews/wave23/wave23-clean-integration-review.md](reviews/wave23/wave23-clean-integration-review.md)。Cubism Physics互換、direct vertex physics、cloth/collision/IK、timeline bake、file picker/parser/asset I/O expansion は含まない。 |
| Verification posture | Wave 8-23 は final report上、typecheck / tests / source guard / e2e / diff check / clean review が pass。Wave 14では sample-aware regression、Wave 15では operation lifecycle regression、Wave 16では layer controls persistence smoke、Wave 17では mesh vertex edit vertical slice の needs-fix / escalation 解消後にfinal rerunで通過。Wave 18では source intake e2e / persistence smoke、Wave 19では texture-backed preview / part mapping smoke、Wave 20では PSD adapter/profile intake / persistence smoke と parser-free truthfulness scan、Wave 21では structured PSD profile persistence / split PNG compatibility smoke / parser-free scan まで通過した。Wave 22は binary boundary final verification が pass。Wave 23は typecheck / unit / e2e / source guard / dependency guard / diff check / manifest diff / forbidden-scope scan / clean integration review が pass。 | 各Wave final report。Wave 22 completion は [waves/wave22/wave22-final-report.md](waves/wave22/wave22-final-report.md) と [reviews/wave22/wave22-clean-integration-review.md](reviews/wave22/wave22-clean-integration-review.md) に記録済み。Wave 23 completion は [waves/wave23/wave23-final-report.md](waves/wave23/wave23-final-report.md) と [reviews/wave23/wave23-clean-integration-review.md](reviews/wave23/wave23-clean-integration-review.md) に記録済み。 |

## 3. Partially Implemented / Foundation Exists But Product Workflow Is Incomplete

| 領域 | あるもの | まだ製品ワークフローとして不足しているもの |
|---|---|---|
| GUI authoring全体 | Browser editor、`createParameter`、project persistence、AI approval panels、embedded preview、generated drawable / deterministic mesh authoring vertical slice。Wave 15でGUIからrights-clean generated drawable / meshを作成し、preview / persistence / evidenceで確認する一周が implementation-proven。Wave 16で複数 drawable の最小 layer workflow として、一覧から draw order move up/down と runtime visibility hide/show を操作し、preview / persistence / evidence で確認できる。Wave 17で generated mesh の単一 vertex row を deterministic に nudge し、preview / persistence / runtime evidence で確認できる。Wave 18で metadata-backed split PNG source intake から imported source layer を選び、既存 createDrawable / generateMesh / save-load へ進める一周が implementation-proven。Wave 20で manual PSD adapter/profile metadata から imported source layer を existing createDrawable / generateMesh / preview / save-load workflowへ進める一周が implementation-proven。Wave 21でそのPSD metadataが structured profile として保存・再表示される。Wave 22で source/texture binary refs の availability/missing/unsupported 状態を metadata-only として保存・表示できる。Wave 23で minimal dynamics group authoring と preview run/reset が save-load smoke まで implementation-proven。 | Real PSD parser、real PNG/PSD bytes intake、real texture pipeline、actual binary upload、archive/file import-export、part/texture authoring、full mesh editor、canvas drag、multi-vertex edit、UV / topology edit、full layer tree、drag-and-drop reorder、mask/clipping editor、opacity editor、rig control authoring、advanced dynamics graph/timeline/collision controls、canvas上の直接操作は未完または未検証。Wave 22の到達点は binary asset reference/storage boundary and metadata persistence であり、actual PSD/PNG bitmap rendering ではない。Wave 23の到達点は Minimum Open Dynamics v1 であり、Cubism Physics互換や高度な物理simulationではない。 |
| Private Viewer / editor preview | Runtime core、snapshot/evidence、runtime diff、Grid2D evidenceはある。Wave 14で editor embedded preview panel、preview-only slider、runtime-projected SVG visual/summary、desktop/mobile smoke は implementation-proven。 | 残るviewer gapは、editor内embedded previewではなく、独立した private viewer UI、full renderer / texture pipeline、renderer adapter、demo capture用viewer surface。これらは未完または未検証。 |
| Rig control | format / graph / runtime graph adapter / keyform target kindとしての基盤はある。 | Wave 12 residualにより、`rigControl` keyform target application は future scope。GUIでのrig control制作も未完または未検証。 |
| Advanced dynamics / physics | Minimum Open Dynamics v1 は Wave 23 で implementation-proven。 | Cubism Physics互換、direct vertex physics、cloth/collision/IK、timeline bake、full graph editor、automatic tuning、direct rigControl physics output は未実装かつ非目標または future scope。 |
| Validator | package schema、runtime load/evidence、validation report/artifacts、fixture regressions、Minimum Open Dynamics v1 diagnostics はある。 | MVP全域、特に mesh / mask / rig hierarchy / advanced dynamics / demo-safe分類の完全な製品レポートは未完または要確認。 |
| AI assistant | deterministic command host、read/validate/dry-run/approval/commit、transcript persistenceはある。 | LLM provider、prompt template、natural-language repair、repair candidate generation/ranking、standalone `getDiff`、`rerunValidation` は未実装。 |
| Package durability | Browser-local save/load/reset はある。Wave 22で binary refs と storage status は browser-local metadata として保存・再読込できる。 | OS filesystem picker、archive writer、project import/export、actual binary upload、actual binary archive persistence は future work。 |
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
| Real PSD / image intake | Actual PSD parser、PSD channel decode、PNG/image decode、raster extraction、Photoshop-compatible compositing、OS/browser file picker、archive import/export、actual binary upload、image/parser/archive dependency selection。Wave 20-21 はPSD parser-free metadata path、Wave 22 は binary asset reference/storage metadata boundary に限定しており、これらを意図的に実装していない。 |

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
| Drawable / layer / mesh vertex editing workflow | [waves/wave15/wave15-final-report.md](waves/wave15/wave15-final-report.md), [waves/wave16/wave16-final-report.md](waves/wave16/wave16-final-report.md), [waves/wave17/wave17-final-report.md](waves/wave17/wave17-final-report.md) |
| Split PNG source asset / rights / provenance intake | [waves/wave18/wave18-final-report.md](waves/wave18/wave18-final-report.md), [reviews/wave18/wave18-integration-review-and-final-report-review.md](reviews/wave18/wave18-integration-review-and-final-report-review.md) |
| Texture-backed preview / source layer part mapping | [waves/wave19/wave19-final-report.md](waves/wave19/wave19-final-report.md), [reviews/wave19/wave19-integration-review-and-final-report-review.md](reviews/wave19/wave19-integration-review-and-final-report-review.md) |
| Parser-free PSD adapter/profile intake | [waves/wave20/wave20-final-report.md](waves/wave20/wave20-final-report.md), [reviews/wave20/wave20-clean-integration-review.md](reviews/wave20/wave20-clean-integration-review.md) |
| Structured PSD profile persistence | [waves/wave21/wave21-final-report.md](waves/wave21/wave21-final-report.md), [reviews/wave21/wave21-clean-integration-review.md](reviews/wave21/wave21-clean-integration-review.md) |
| Binary asset reference/storage metadata boundary | [waves/wave22/wave22-final-report.md](waves/wave22/wave22-final-report.md), [waves/wave22/_map.md](waves/wave22/_map.md), [reviews/wave22/wave22-clean-integration-review.md](reviews/wave22/wave22-clean-integration-review.md)。 |
| Minimum Open Dynamics v1 vertical slice | [waves/wave23/wave23-final-report.md](waves/wave23/wave23-final-report.md), [waves/wave23/_map.md](waves/wave23/_map.md), [reviews/wave23/wave23-clean-integration-review.md](reviews/wave23/wave23-clean-integration-review.md)。 |
| Source-level spot check | `packages/contracts`, `packages/package-format`, `packages/authoring-core`, `packages/operation-core`, `packages/runtime-core`, `packages/validator-core`, `packages/ai-interface`, `apps/editor`, `fixtures/contracts` |

## 6. Next-Wave Candidates And Decision Points

| 候補 | 目的 | 判断ポイント |
|---|---|---|
| Package binary archive/file I/O decision | Wave 22のbinary asset reference/storage metadata boundaryを足場に、actual binary bytes の archive/filesystem/browser intake と package persistence を設計する。 | file picker / archive / filesystem / dependency approval をどこまで許可するか。PSD parserへ進む前にこの境界を固めるか。 |
| Real texture pipeline expansion | Wave 19-22 の texture preview / adapter metadata / binary ref path を、rights-clean actual PNG bytes/decode/materializationへ広げる。 | PSD raster extractionより先に、PNG texture bytesとpackage-local binary asset lifecycleを実バイトで証明するか。依存関係承認が必要。 |
| Editor / viewer product workflow expansion | Wave 15のgenerated drawable / mesh slice、Wave 16の最小 layer controls、Wave 17の最小 mesh vertex nudge、Wave 18のmetadata-backed split PNG source intake、Wave 20-21のparser-free PSD adapter/profile intake and structured persistence、Wave 22のbinary ref/missing bytes UX、Wave 23のMinimum Open Dynamics v1 を足場に、MVPの大きな未完領域であるGUI authoringとviewer確認をさらに進める。 | 次に、full mesh editor、mask/clipping、opacity editing、full layer tree、rig control、advanced dynamics controls、standalone viewer/renderer のどれへ進むか。 |
| Project import/export wave | browser-local persistenceから、package archive / filesystem import/exportへ広げる。 | MVP評価でbrowser-local storageを十分とみなすか、早めに実ファイルの出入口を作るか。Wave 22はactual archive/file I/Oを未実装。 |
| AI repair / diff wave | AI assistantを「観測と承認」から「修復候補提示」へ進める。 | 先にruntime/model/validation diff contractを十分に安定させる必要がある。 |
| Rig control authoring/runtime vertical slice | Rig control を authoring から runtime-visible behavior へ接続する。 | Direct physics output に広げず、既存 keyform/runtime/dynamics contract と衝突しない最小導線を選ぶか。 |

未決の大きな判断:

- Wave 23後、real PSD parserへ進む前に、actual binary byte intake / file picker / archive import-export / image dependency policy を実装 wave として進めるか。
- `Private Viewer` を editor内previewとして段階的に育てるか、別viewer app/surfaceとして切り出すか。
- MVPの次の「一周」証拠を、runtime keyform fixture中心にするか、実際の小さな可動キャラクター制作workflow中心にするか。

Assumptions / uncertainties:

- このマップは指定文書とfocused source tree inspectionに基づく。広範なコードレビューはしていない。
- 「未完または未検証」は、Wave final reportと現在の入口文書だけでは製品ワークフロー完了を断定できなかった領域を指す。
