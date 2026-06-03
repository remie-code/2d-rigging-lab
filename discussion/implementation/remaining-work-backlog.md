# Wave37完了時点の残件リスト

> 状態: 2026-06-03、Wave37完了時点の残件バックログ。

## 目的

この文書は、次wave以降を計画する前に見ておくべき残件をまとめるためのもの。

各waveのfinal reportは「そのwaveで何が実装証明されたか」を記録する。一方、この残件リストは「まだ何ができていないか」「どこに判断ゲートがあるか」「品質面で何を持ち越しているか」を見失わないために置く。

ここにある項目がすべて次wave対象という意味ではない。次waveはこの中から1つの実装境界を選び、1waveで完了できる大きさに切る。

## 更新履歴

- Wave26でRig Control Keyform / Viewer Hardeningは`implementation-proven`になったため、P0候補から外した。
- Wave27では`Mask / clipping / opacity authoring`を選定済み。詳細な実装範囲とOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave27-plan.md`に固定した。
- Wave27で`Mask / clipping / opacity authoring`は`implementation-proven`になったため、P0候補から外した。
- Wave28では`Part / texture / layer tree workflow`を選定し、semantic part hierarchy、drawable part reassignment、existing texture assignment、editor layer selection / lock / editor-hide、Preview / Viewer evidence、fixtures、desktop/mobile e2e persistence smoke まで `implementation-proven` になったため、P0候補から外した。
- Wave29で`Canvas Mesh Editing v1`は`implementation-proven`になった。Wave17のrow/button vertex nudgeを、canvas/SVG selection、multi-vertex translate、semantic Preview / Viewer / Runtime evidence、validator mesh diagnostics、fixtures、desktop/mobile e2eへ拡張した。Topology editor、UV editor、full renderer、pixel oracle、real image bytes、persistent binary storage、parser/archive、external dependency、Cubism compatibilityは含めていない。
- Wave30では`Tutorial-like MVP mini model`を候補から選び、1waveで閉じる範囲として`Tutorial-like MVP Mini Model v0`を計画した。これはrights-clean synthetic modelを使って既存のpart / texture / layer / mesh / mask / rig-control keyform / dynamics / Viewer / Validator workflowを一周させる計画であり、real asset bytes、parser/archive、image decode、full renderer、pixel oracle、Cubism compatibility、public sample distributionは含めない。
- Wave30で`Tutorial-like MVP Mini Model v0`は`implementation-proven`になった。Rights-clean synthetic mini modelを、recipe / operation log / model diff / package materialization / semantic runtime-viewer evidence / validator readiness / guided editor workflow / desktop-mobile save-load e2e まで一周させた。Real asset bytes、parser/archive、image decode、full renderer、pixel oracle、texture sampling correctness、standalone viewer、Cubism compatibility、public tutorial asset distributionは含めていない。
- Wave31では`Package Binary / File I/O Decision + Browser Byte Intake Pilot v0`を選定した。Wave22のmetadata-only binary boundaryを足場に、browser `<input type=file>`でactual bytesを受け、digest / byteLength / mediaType / rights / provenance / availabilityをpackage-local binary boundary、validator、Editor、desktop-mobile e2eへ載せる計画である。PSD parser、PNG/image decode、archive import/export、drag-drop、File System Access API、external dependency、full renderer、pixel oracle、Cubism compatibilityは含めない。
- Wave31で`Package Binary / File I/O Decision + Browser Byte Intake Pilot v0`は`implementation-proven`になった。Browser `<input type=file>`でactual bytesを受け、digest / byteLength / mediaType / rights / provenance / availabilityをpackage-local current-session binary boundary、validator、Editor、desktop-mobile e2eへ載せた。PSD parser、PNG/image decode、archive import/export、drag-drop、File System Access API、external dependency、full renderer、pixel oracle、Cubism compatibility、public asset distribution、persistent binary storage guaranteeは含めていない。
- Wave31完了後にread-only SylphへAC/traceability、実装、asset I/O、品質の4観点で再調査させた。大枠の完了/未完分類は正しいが、`<input type=file>` actual-byte intake完了後の文言、`warpLattice2d`残件、byte-intake direct-call契約、source/test大型化watch itemを更新対象とした。
- Wave32では`WarpLattice2d Rig Control Authoring / Evaluator v0`を選定した。AC-MVP-009を維持する前提で、project-defined `warpLattice2d`のauthoring、`controlPointOffsets` keyform、semantic runtime evaluator、validator diagnostics、Editor / Preview / Viewer workflow、desktop-mobile e2e smokeまでを1waveに切る計画である。Cubism deformer互換、full renderer、pixel oracle、full lattice gizmo、PSD/image/archive、external dependencyは含めない。
- Wave32で`WarpLattice2d Rig Control Authoring / Evaluator v0`は`implementation-proven`になった。Project-defined `warpLattice2d` authoring、`controlPointOffsets` keyform、semantic bilinear evaluator、validator diagnostics、Editor / Preview / Viewer workflow、rights-clean semantic fixture、desktop-mobile e2e save-load reinspectionまで一段閉じた。Cubism deformer互換、full renderer、pixel oracle、full canvas lattice gizmo、PSD/image/archive、File System Access API、external dependency、package manifest/lockfile変更は含めていない。
- Wave33では`Layer Tree Direct Manipulation / Part Tree UX v0`を選定し、implementation-provenになった。Wave28のminimum form-based workflowを足場に、tree上のrename、reparent、empty-leaf part delete、drawable reassignment、texture assignment、selection / lock / editor-hide維持、Preview / Viewer / Validator evidence、fixture、desktop-mobile e2eまでを一段閉じた。Native browser drag-and-drop、multi-select bulk、recursive delete、group transform、renderer/pixel、PSD/image/archive、external dependencyは含めていない。
- Wave34では`Byte Intake Preflight Direct-Call Contract Hardening v0`を選定し、implementation-provenになった。Wave31のcurrent-session byte intake境界を、direct caller / validator / editor sessionが誤用しないように、stale verified summary、missing current-session bytes、requiresReupload、availability mismatchをdeterministicに扱う契約・diagnostics・fixtures・e2e guardへ固めた。Persistent binary storage、archive import/export、parser/image decode、drag-drop、File System Access API、external dependency、Cubism互換、full renderer、pixel oracleは含めていない。
- Wave35では`Browser-Local Persistent Binary Storage v0`を選定し、implementation-provenになった。Wave31/Wave34を足場に、same-origin browser-local IndexedDBへraw bytesを保存し、browser-local reload後にdigest / byteLength検証を通ったbytesだけをno-reupload availableへ復元する契約・Editor workflow・validator diagnostics・desktop/mobile e2eを一段閉じた。Portable archive、File System Access API、drag-drop、parser/image decode、external dependency、Cubism互換、full renderer、pixel oracleは含めていない。
- Wave36では`Project-defined Portable Package Bundle v0`を選定し、implementation-provenになった。Wave31/Wave34/Wave35を足場に、project-defined JSON bundle + base64 byte payloadでactual bytesをexport/importし、validator `portableBundle.*` diagnostics、Editor export/import workflow、desktop/mobile round-trip e2e、fixture/traceability registrationまで一段閉じた。ZIP/archive、File System Access API、drag-drop、parser/image decode、external dependency、Cubism互換、full renderer、pixel oracleは含めていない。
- Wave37では`Package Archive / Filesystem Import-Export Decision Boundary v0`を選定し、implementation-provenになった。Wave36のportable JSON bundleを唯一のsupported transportとして維持し、ZIP/archive、File System Access API、directory picker、drag-drop、native filesystemをnon-supported/future-gatedに固定するcapability contract、package-format boundary guard、validator `transportCapability.*` diagnostics、Editor capability UI、desktop/mobile e2e negative oracleまで一段閉じた。Actual ZIP/archive writer/importer、filesystem API、drag-drop implementation、parser/image decode、external dependency、Cubism互換、full renderer、pixel oracleは含めていない。
- この文書はWave38以降の計画前に、残ったproduct directionと判断ゲートを読むための入口として使う。

## 調査観点

Undineは観点設計と統合だけを担当し、実装状況の読解はread-onlyのSylphへ分けた。これにより、root contextに実装詳細を必要以上に取り込まないようにした。

| 観点 | 調査内容 | 主な問い |
|---|---|---|
| AC / シナリオ / traceability | 受け入れ条件、シナリオ、fixture、wave report | MVPとして未証明の能力は何か |
| 実装 / プロダクト機能 | 現在の実装面とユーザーワークフロー | editor/runtimeは何ができ、何がまだできないか |
| 品質 / source / test | source organization、検証再現性、test構造 | 次waveのgateや並行品質domainに入れるべきものは何か |
| PSD / asset I/O / dependency / rights | PSD、PNG、binary file-set、archive、fixture、demo/public境界 | 実バイトやparserへ進む前に何を決めるべきか |

根拠にした主な文書は、`.agents/skills/implementation-orchestration/SKILL.md`、`discussion/implementation/current-capability-map.md`、Wave20-Wave31のfinal report / review、acceptance / scenario文書、dependency policy、source organization policy、およびfocused source inspection。残件調査ではSylphがsource editを行わずread-onlyで整理した。

## 実装証明済みの大枠

Wave31完了後、以下はimplementation-provenとして扱ってよい。

- foundation packages、contracts、runtime、validator、operation lifecycle、package persistence、editor operation UI、browser-local save/load、AI dry-run/read/approval foundation。
- keyform authoringとruntime keyform evaluation、Grid2D evidence hardening。
- embedded preview、drawable / mesh authoring foundation、draw order / visibility controls、mesh vertex nudge controls、split PNG metadata intake、texture-backed preview、part mapping foundation。
- parser-free PSD metadata/profile intake、package-local binary reference、in-memory file-set boundary。
- Minimum Open Dynamics v1のsemantic runtime slice。
- Private Viewer v0のeditor-internal runtime inspection surface。
- Minimum Rig Control v1のproject-defined `rotation2d` authoring/runtime slice。
- Rig Control Keyform / Viewer Hardening。keyform-to-rigControl product authoring、negative UX、viewer/report hardening、transform recompute coverageはWave26で一段閉じた。
- Mask / Clipping / Opacity Authoring v1。`setMaskRelation` operation、runtime mask relation / opacity evidence、validator composition diagnostics、rights-clean contract fixture、Editor Composition / Mask / Opacity UX、Preview / Viewer observation、desktop/mobile save-load e2e smokeはWave27で一段閉じた。
- Part / Texture / Layer Tree Workflow v1。`createPart` / `updatePart` / `setDrawablePart` / `setDrawableTexture` operation、semantic part hierarchy、drawable part membership、existing texture atlas assignment、editor selection / lock / editor-only hide、validator diagnostics、rights-clean contract fixture、Preview / Viewer evidence、desktop/mobile save-load e2e smokeはWave28で一段閉じた。
- Canvas Mesh Editing v1。canvas/SVG selection、single/multi-vertex translate、semantic Preview / Viewer / Runtime mesh evidence、validator topology diagnostics、contract fixture、desktop/mobile save-load e2e smokeはWave29で一段閉じた。
- Tutorial-like MVP Mini Model v0。rights-clean synthetic mini model recipe、operation log/model diff/package materialization、semantic runtime-viewer evidence、validator readiness、guided editor workflow、desktop/mobile save-load e2e smokeはWave30で一段閉じた。
- Package Binary / File I/O Decision + Browser Byte Intake Pilot v0。browser `<input type=file>` actual-byte intake、package-local current-session byte registration、validator byte availability diagnostics、truthful save/load reupload state、byte-only local sample fixture、desktop/mobile e2e smokeはWave31で一段閉じた。
- WarpLattice2d Rig Control Authoring / Evaluator v0。project-defined `warpLattice2d` authoring、`controlPointOffsets` keyform、semantic runtime evaluator、validator diagnostics、Editor / Preview / Viewer workflow、rights-clean semantic fixture、desktop/mobile save-load e2e smokeはWave32で一段閉じた。
- Layer Tree Direct Manipulation / Part Tree UX v0。explicit controlsによるpart rename、reparent、empty-leaf delete、drawable reassignment、texture assignment、pending-delete preflight、Preview / Viewer / Validator evidence、rights-clean fixture、desktop/mobile save-load e2e smokeはWave33で一段閉じた。
- Byte Intake Preflight Direct-Call Contract Hardening v0。direct-call byte availability contract、validator `byteAvailability.*` diagnostics、editor current-session/reupload truthfulness bridge、direct-call fixtures、desktop/mobile e2e guardはWave34で一段閉じた。
- Browser-Local Persistent Binary Storage v0。same-origin browser-local IndexedDB byte record、digest / byteLength再検証、no-reupload availability restore、`persistentByteStorage.*` diagnostics、desktop/mobile persistent-byte smokeはWave35で一段閉じた。
- Project-defined Portable Package Bundle v0。project-defined JSON bundle、base64 byte payload export/import、digest / byteLength / mediaType verification、validator `portableBundle.*` diagnostics、Editor export/import workflow、desktop/mobile portable bundle round-trip smokeはWave36で一段閉じた。
- Package Archive / Filesystem Import-Export Decision Boundary v0。transport capability contract、package-format boundary guard、validator `transportCapability.*` diagnostics、Editor truthfulness UI、desktop/mobile e2e negative oracleはWave37で一段閉じた。Only `projectDefinedJsonBundleV0` may claim supported; archive/filesystem transports remain non-supported/future-gated.

一方で、Cubism SDK/Core互換、Cubism形式import/export、`.moc3` / `.model3.json` loading、full renderer、pixel oracle、standalone viewer、real PSD parser、image decode、native browser drag-and-drop、multi-select bulk、recursive delete、group transform、File System Access API / directory picker、ZIP/archive import/export、cross-browser-profile/cloud binary persistence、external HTTP/WebSocket/MCP transport、LLM provider integrationは、まだ実装証明されていない。多くは明示的なfuture scopeまたはnon-claimとして扱う。

## P0 / 近いwave候補

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Layer tree follow-up: native drag/drop / multi-select / group transform | Wave33でexplicit controlsによるrename/reparent/empty-leaf delete/direct reassignment/texture assignmentはimplementation-provenになった。一方、native browser drag-and-drop、multi-select bulk operations、group transform、recursive delete/delete-with-reassignは未実装。 | Wave33とは別waveで扱う。先にUX/security/operation semanticsを切り、recursive deleteやdelete-with-reassignを許すかは独立判断にする。 | native drag-and-drop、recursive delete、delete-with-reassignへ広げる場合は必要。 |
| Mesh topology / UV editor expansion | Canvas Mesh Editing v1は完了したが、vertex/edge/face creation/delete、retopology、UV direct edit、atlas packingは未実装。 | Wave29の後続候補。renderer/pixel oracleやreal texture bytesとは別waveで扱う。 | topology/UV直接編集へ進む場合は必要。 |
| Public tutorial / demo asset boundary | Wave30はrights-clean synthetic semantic mini modelまで。公開配布用tutorial asset、demo capture scene、final disclaimer、public/private asset splitは未決。 | 実素材や公開demoへ進む前に、rights policy / fixture policy / preflightを先に決める。 | 必要。 |

## Asset I/O / PSD / Binaryの判断ゲート

ここは気軽に実装へ入らない方がよい。metadata/semantic evidence中心の現在地から、実ユーザー資産、実バイト、dependency、rights、security、fixture policyへ境界が広がる。

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Archive/filesystem/cloud byte portability beyond JSON bundle | Wave37でarchive/filesystem transport boundaryは完了したが、ZIP/archive writer/importer、filesystem import/export、cross-browser-profile/cloud persistenceは未実装。 | Wave37 boundaryとは別waveで扱う。ZIP/archive dependency、File System Access API、cloud/cross-profile persistenceの要否を先に決める。 | 必要。 |
| Drag-drop / File System Access / directory picker implementation | Wave37でdrag-drop / File System Access API / directory pickerはfuture-gated/non-supportedとしてtruthfulに表示・診断できるが、実装はない。 | 追加するならUX/security/storage方針を先に決める。 | 必要。 |
| Package archive import/export implementation | Wave37でZIP/archive capabilityはdependency-gatedとして固定されたが、ZIP/archive writer/importerがない。 | byte intake / JSON bundle / capability boundaryとは別にarchive戦略を決める。ZIP dependencyは承認対象。 | 必要。 |
| PNG decode / texture bytes materialization | texture previewはdeterministicまたはreference-backedで、実PNG bytesのdecode/renderはない。 | Wave31のbyte-intake metadata境界の次に進む場合でも、rights-clean fixture/security policyとimage dependency承認を先に扱う。 | 必要。 |
| Real PSD parser adapter | 現在のPSD pathはtrusted adapter metadataを受けるだけで、bytesをparseしない。 | byte intake、dependency policy、parser license/provenance review後の大きなwaveとして扱う。 | 必要。 |
| PSD raster extraction / compositing | channel decode、compression、effects、masks、Photoshop互換renderingは明示的にunsupported/deferred。 | future scope。おそらく複数wave。 | 必要。 |
| Binary rights/provenance policy | Wave31でcurrent-session bytesのrights/provenance metadataは記録でき、欠落や不整合をvalidatorが検出できる。ただしsource license、redistribution、AI-use、transform-history、public/demo利用の最終ルールは未決。 | real asset import、archive、public demo assetの前にgateとして決める。 | 必要。 |
| Real binary/image fixture policy | Wave31はworkspace-local `test_data/sample_model.psd`をbyte-only inputとして参照するが、fixtureへ実bytesをコピーせず、parser/image oracle/public distributionにも使わない。実画像fixtureやpublic redistributionにはrights-clean policyが必要。 | sample imageやparser fixture投入前に決める。 | 必要。 |
| Media type sniffing / byte security validation | Wave31でactual bytesは受け取れるが、mediaTypeはbrowser-declared/fallback metadataであり、signature sniffやheader decodeはない。 | bytesをparser/decode/security trustへ使う前に追加する。 | byte scope次第。 |
| Demo/public scope for imported assets | demo capture assets、preflight、disclaimer、public/private asset splitが未解決。 | public demo capture前に扱う。内部semantic waveの前提にはしない。 | 必要。 |

## 品質 / 再現性バックログ

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Fresh checkout replay gate | 現在のworktree状態確認とは別に、fresh checkout / CI replay script or workflowがpackage scriptや`.github/workflows`として未整備。fresh checkout replayがない限り、再現性リスクが残る。 | 近いうちにquality gateまたは並行quality domainへ入れる。 | 不要。 |
| `check:source` blind spot hardening | 現guardは`.ts`の`index.ts`とcatch-all名が中心。大型`.mjs` e2e、`.js/.tsx`、行数threshold、責務混在、非catch-all名の巨大ファイルを検出しない。 | threshold合意後に慎重に拡張する。 | thresholdがpolicyなら必要。 |
| Editor workflow/view-model/evidence surface split | 現行policy違反ではないが、次のUI waveでさらに太りやすい。 | 触るwaveで継続的に分割する。 | 不要。 |
| Large source/test watch items | Wave31後からの大型ファイルに加え、Wave33で`apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs`、`apps/editor/src/ui/layer-tree/layer-tree-panel.ts`、`apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts`、`apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts`、`packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts`が大型化した。現guardは通っているが、`.mjs` e2eや大きな UI/test helper は必ずしも止めない。 | 触るwaveで責務分割、helper extraction、test splitを継続する。layer-tree follow-up時は優先的に分割する。 | thresholdをpolicy化するなら必要。 |
| E2E smoke suite decomposition / coverage matrix | smoke testが大型化しており、coverageもsemantic smoke-levelが多い。個別smoke fileはあるが、package scriptsで個別実行できるものは限定的。 | test helper境界、coverage matrix、個別smoke package scriptsをtest-focused waveまたは並行quality domainで扱う。 | 不要。 |
| Traceability summary refresh | Wave30/Wave31の個別traceability行は登録済みだが、AC coverage / module surface coverage / warning fixture reference coverage のsummaryにWave30以降の反映漏れがある。 | traceability-focused doc sync taskとして扱う。 | 不要。 |
| Validator contract doc refresh | Wave21/Wave22のbinary/PSD check IDsやasync binary validation entrypointに加え、Wave31のbyte availability、`requiresReupload`、`byteIntake.unsupportedClaim`、verified summary扱いがcontract docsに十分反映されていない。 | 小さなdoc/contract sync task。 | 不要。 |
| `SourceAssetSchema` discriminant cleanup | kind/profile pairingはvalidatorで守っているが、schema側ではまだ狭められていない。 | package-format migrationがscopeに入る時まで待つ。 | breakingなら必要。 |
| Runtime/viewer evidence naming cleanup | refsやdiff fieldsに過去由来の名前が残る。互換上は問題ないが意味名として古い。 | schema compatibility workまで延期。 | 場合により必要。 |
| Dynamics create-flow atomicity | dynamics group作成が拡張されると、拒否後にoutput parameterが残る可能性がある。 | advanced dynamicsへ進む前に直す。 | 不要。 |

## AI / Validation / Demoバックログ

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| AI repair / diff workflow | read、validate、dry-run、approval、transcriptはあるが、repair candidate generation、natural-language repair、standalone diff、rerun validationがproductizedされていない。 | validator/report surfaceが安定してからbounded AI repair waveへ。 | provider/LLM boundaryを含め必要。 |
| Validator product report / preflight | targeted validatorsは多いが、mesh/mask/rig/dynamics/demo-safe readinessを横断するMVP-wide report/preflightは未完。 | final acceptance runner、public demo、demo-safe capture前のsupport waveとして有効。 | 不要。 |
| Demo-safe preflight / capture | policyはあるが、capture scene、自動preflight、disclaimer、public subsetが未実装/未決。 | viewer/product slicesが固まった後に扱う。 | 必要。 |
| Viewer renderer / standalone viewer / demo capture | Viewerはeditor-internal semantic inspection。full renderer、standalone app、pixel oracle、demo sceneはfuture scope。 | semantic authoring waveには混ぜない。境界変更時だけ扱う。 | 必要。 |

## Wave27-Wave28で完了した範囲

1. **Mask / clipping / opacity authoring**
   Wave27で完了済み。`setMaskRelation`をauthoring operationとして閉じ、runtime evidence、validator diagnostics、contract fixture、editor composition workflow、desktop/mobile save-load e2e smokeまで一周させた。full renderer、pixel oracle、Cubism互換、real asset intake、parser、image decode、archive、persistent binary storage、external dependencyは含めていない。
   根拠: `discussion/implementation/waves/wave27/wave27-final-report.md`

2. **Part / texture / layer tree workflow**
   Wave28で完了済み。part create/update、drawable part reassignment、existing texture atlas assignment、editor selection / lock / editor-only hide、Preview / Viewer semantic evidence、validator diagnostics、contract fixture、desktop/mobile save-load e2e smokeまで一周させた。full drag-and-drop layer tree、full part tree UX、real image bytes、real asset intake、parser、image decode、archive、persistent binary storage、external dependency、Cubism互換、full renderer、pixel oracleは含めていない。
   根拠: `discussion/implementation/waves/wave28/wave28-final-report.md`

## Wave29完了範囲

Wave29は **Canvas Mesh Editing v1** として完了済み。

目的は、Wave17の最小mesh vertex nudgeを、Editor上のcanvas/SVG mesh editing workflowへ進めること。最小scopeは以下。

- Canvas/SVG上でmesh vertexを選択し、単一または複数頂点をtranslateする。
- Existing `moveMeshVertex` operation lifecycleを活用し、dry-run / commit / operation log / model diff / package materializationに残す。
- Runtime / Preview / Viewerにmoved vertices、bounds/hash、topology summary、selection/lock/editor-hide/runtime visibilityのsemantic evidenceを残す。
- Validatorにinvalid triangle index、degenerate triangle、vertexStableIds length mismatch、UV count mismatch、stale selected vertex refsなどのdeterministic diagnosticsを追加または補強する。
- Contract fixtureとdesktop/mobile e2eでsave/load後の再観測まで確認する。

Wave29では、topology editor、UV editor、automatic triangulation、full renderer、pixel oracle、real image bytes、persistent binary storage、parser/archive、external dependency、Cubism compatibilityを扱っていない。これらは引き続き残件またはfuture scopeとして扱う。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave29-plan.md`に固定した。

## Wave30完了範囲

Wave30は **Tutorial-like MVP Mini Model v0** として完了済み。

目的は、これまで個別にimplementation-provenになったsemantic authoring sliceを、Private Prototype内で1体の小さなsynthetic character model制作workflowとして一周させること。完了scopeは以下。

- Rights-clean synthetic mini modelを作成する。外部画像、実PSD/PNG bytes、parser、archive、image decodeは使わない。
- Existing operations / editor workflowsを組み合わせ、part / texture / layer / mesh / mask or opacity / rig-control keyform / dynamicsを横断する。
- Runtime / Preview / Viewerにtutorial readinessと各slice evidenceをAI-readableに残す。
- Validatorにtutorial readiness profile / preflightを追加し、missing sliceやunsupported claimsをdeterministic diagnosticsとして出す。
- Contract fixtureとdesktop/mobile e2eでsave/load後の再観測まで確認する。

Wave30では、public tutorial asset、demo capture scene、full renderer、pixel oracle、persistent binary storage、parser/archive、external dependency、Cubism compatibilityは扱わない。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave30-plan.md`に固定した。完了根拠は`discussion/implementation/waves/wave30/wave30-final-report.md`と`discussion/implementation/reviews/wave30/wave30-clean-integration-review.md`に記録した。

## Wave31完了範囲

**Package Binary/File I/O Decision + Byte Intake Pilot v0**
Wave31で完了済み。最小scopeは`<input type=file>`で任意binaryを受け、既存package-local binary file-setとbinary validatorでdigest / byteLength / mediaType / rights / provenance metadata evidenceを記録し、欠落や不整合を検出するところまで。PSD parser、PNG decode、archive dependency、public demo asset policy、persistent binary storage guaranteeは入れていない。完了根拠は`discussion/implementation/waves/wave31/wave31-final-report.md`と`discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`に記録した。

## Wave32完了範囲

Wave32は **WarpLattice2d Rig Control Authoring / Evaluator v0** として完了済み。

目的は、AC-MVP-009に残っていた`warpLattice2d`の未証明部分を、project-defined semantic rig-controlとして閉じること。完了scopeは以下。

- 2x2を主動線にした`warpLattice2d` authoringを追加する。
- `controlPointOffsets` keyform conventionを固定し、operation log / model diff / package materialization / editor-session evidenceへ載せる。
- Runtimeで`warpLattice2d`をunsupported no-opではなくsemantic bilinear evaluatorとして扱い、affected drawable vertices / bounds / vertexHash / runtime diff / Viewer evidenceへ反映する。
- Validatorでlattice cardinality、domainBounds、restControlPoints、keyform patch shape、runtime/viewer evidenceをdeterministic diagnosticsへ載せる。
- Editorのminimum form workflow、contract fixture、desktop/mobile e2e smokeでcreate -> bind -> keyform -> Preview / Viewer -> save/load再観測を確認する。

Wave32では、Cubism deformer互換、full renderer、pixel oracle、full canvas lattice gizmo、mesh topology/UV editor、PSD parser、PNG/image decode、archive import/export、external dependencyは扱わない。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave32-plan.md`に固定した。
完了根拠は`discussion/implementation/waves/wave32/wave32-final-report.md`と`discussion/implementation/reviews/wave32/wave32-clean-integration-review.md`に記録した。

## Wave33完了範囲

Wave33は **Layer Tree Direct Manipulation / Part Tree UX v0** として完了済み。

目的は、Wave28のminimum form-based layer tree workflowを、Editor上の直接操作に近いtree UXへ育てること。完了scopeは以下。

- Layer tree上のexplicit controlsでpart rename、reparent、empty-leaf part delete、drawable reassignment、texture assignmentを扱える。
- 既存`updatePart`をrename/reparentに使い、削除は新規`deletePart` empty-leaf onlyに限定した。
- Non-empty part delete、same-batch pending-delete target assignment、recursive delete、delete-with-reassignはdeterministic diagnostics / preflight / future scopeに切り分けた。
- Preview / Viewer / Validatorでpart hierarchy、drawable membership、stale/mismatch evidenceを確認できるようにした。
- Rights-clean semantic fixtureとdesktop/mobile e2eでtree edit -> save/load -> Preview / Viewer再観測を確認した。

Wave33では、native browser drag-and-drop、multi-select bulk operations、group transform、recursive delete、full renderer、pixel oracle、Cubism互換、PSD parser、PNG/image decode、archive import/export、external dependencyは扱わない。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave33-plan.md`に固定した。
完了根拠は`discussion/implementation/waves/wave33/wave33-final-report.md`と`discussion/implementation/reviews/wave33/wave33-clean-integration-review.md`に記録した。

## Wave34完了範囲

Wave34は **Byte Intake Preflight Direct-Call Contract Hardening v0** として完了済み。

目的は、Wave31のbrowser actual-byte intakeを足場に、direct callerやvalidator利用者がcurrent-session byte境界を誤用しないようにすること。完了scopeは以下。

- Package-formatでdirect caller向けのbyte availability reportを固定し、available current-session bytes、missing current-session bytes、requiresReupload、stale verified summary、package revision mismatch、binary ref mismatch、digest/byteLength/mediaType mismatchを区別できる。
- Validator-coreでDomain Aのavailability issueを`byteAvailability.*` diagnosticsとしてdeterministicかつAI-readableに返す。
- Editor session / workflowで、current-session bytesがある場合はcurrent-session verification evidenceをpreflightへ渡し、browser-local save/load後はraw bytesがない事実をrequiresReupload / missing current-session stateとして保つ。
- Direct-call fixtureとdesktop/mobile e2e guardで、stale summary、missing current-session bytes、caller-declared reuploadがsilent passにならないことを確認する。

Wave34では、persistent binary storage、archive import/export、PSD parser、PNG/image decode、media signature sniffing、drag-drop、File System Access API、external dependency、Cubism compatibility、full renderer、pixel oracleを扱っていない。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave34-plan.md`に固定した。
完了根拠は`discussion/implementation/waves/wave34/wave34-final-report.md`と`discussion/implementation/reviews/wave34/wave34-clean-integration-review.md`に記録した。

## Wave38以降の推奨選択肢

1. **Package archive / filesystem implementation decision**
   Wave37でdecision boundaryは閉じた。次に進めるなら、ZIP/archive writer/importer、filesystem import/export、File System Access API / directory picker、drag-drop、cloud/cross-profile persistenceのどれを実装対象にするかを決める候補。PSD parserやimage decodeとは分ける。

2. **Mesh topology / UV editor expansion**
   Wave29がCanvas Mesh Editing v1を閉じた後の候補。vertex/edge/face creation/delete、retopology、UV direct edit、atlas packingへ広げる場合は、renderer/pixel oracleやtexture bytesとは別waveで扱う。

3. **AI repair / diff workflow**
   Wave30のtutorial mini modelやvalidator readinessを足場に、repair candidate generation、natural-language repair、standalone diff、rerun validationへ広げる候補。LLM provider / prompt boundary は別判断。

4. **Public tutorial / demo asset boundary**
   Wave30はsynthetic semantic fixtureで閉じた。public tutorial asset、demo capture scene、final disclaimer、preflight自動化へ進むなら、rights-clean policyとpublic/private splitを先に固定する。

5. **Layer tree follow-up: native drag/drop / multi-select / group transform**
   Wave33はexplicit controlsによるdirect manipulationに限定して完了した。native browser drag-and-drop、multi-select bulk、group transform、recursive delete/delete-with-reassignへ進む場合は別waveで扱う。

## 関連wave前に確認すべき判断

1. Wave27のmask / clipping / opacityとWave28のpart / texture / layer tree workflowはsemantic evidenceで閉じた。次にpixel/full rendererへ進むか、引き続きsemantic authoring / editor workflowを優先するか。
2. Wave37のarchive/filesystem decision boundary後、次はactual ZIP/archive import-export / filesystem import-exportへ進めるか、別のeditor workflowへ戻るか。
3. file input拡張を許可する場合、drag-drop / File System Access API / directory pickerまで含めるか。
4. archive import/exportを今project-defined ZIPとして始めるか、browser-local persistenceで当面十分として延期するか。
5. 実PSD/PNG/image fixtureとdemo/public assetに対するrights-clean policyをどこまで厳格にするか。
6. Wave32でproject-defined `warpLattice2d` authoring / evaluator は一段閉じた。次にrig-controlへ進む場合は、canvas lattice gizmo、timeline/multi-control UX、broader properties、direct physics、Cubism deformer互換のどれを扱うかを改めて選ぶ。
7. mediaType signature sniff / header decode / byte security validationをどの段階で入れるか。
8. Wave30のtutorial-like MVP modelはsynthetic mini modelとして完了済み。次にpublic tutorial asset / demo captureへ進む場合、最小仕様とrights policyを改めて決める必要がある。
9. Viewerは当面editor-internal semantic inspectionのままにするか、standalone/full rendererへ進み始めるか。

## 今後の使い方

次wave計画では、この文書と`current-capability-map.md`をセットで読む。Wave29については`discussion/implementation/waves/wave29/wave29-final-report.md`、`discussion/implementation/waves/wave29/_map.md`、`discussion/implementation/reviews/wave29/_map.md`を完了根拠として扱う。Wave30については`discussion/implementation/waves/wave30/wave30-final-report.md`、`discussion/implementation/waves/wave30/_map.md`、`discussion/implementation/reviews/wave30/_map.md`を完了根拠として扱う。Wave31については`discussion/implementation/waves/wave31/wave31-final-report.md`、`discussion/implementation/waves/wave31/_map.md`、`discussion/implementation/reviews/wave31/_map.md`を完了根拠として扱う。Wave32については`discussion/implementation/waves/wave32/wave32-final-report.md`、`discussion/implementation/waves/wave32/_map.md`、`discussion/implementation/reviews/wave32/_map.md`を完了根拠として扱う。Wave33については`discussion/implementation/waves/wave33/wave33-final-report.md`、`discussion/implementation/waves/wave33/_map.md`、`discussion/implementation/reviews/wave33/_map.md`を完了根拠として扱う。Wave34については`discussion/implementation/waves/wave34/wave34-final-report.md`、`discussion/implementation/waves/wave34/_map.md`、`discussion/implementation/reviews/wave34/_map.md`を完了根拠として扱う。Wave35については`discussion/implementation/waves/wave35/wave35-final-report.md`、`discussion/implementation/waves/wave35/_map.md`、`discussion/implementation/reviews/wave35/_map.md`を完了根拠として扱う。Wave36については`discussion/implementation/waves/wave36/wave36-final-report.md`、`discussion/implementation/waves/wave36/_map.md`、`discussion/implementation/reviews/wave36/_map.md`を完了根拠として扱う。Wave37については`discussion/implementation/waves/wave37/wave37-final-report.md`、`discussion/implementation/waves/wave37/_map.md`、`discussion/implementation/reviews/wave37/_map.md`を完了根拠として扱う。Wave38以降は、残ったproduct directionから1つを選び、1waveで完了できる範囲に切る。

実装に入る場合は、引き続きUndine -> Orch-Sylph -> Gnome / Review-Sylphの分離を守る。Orch-Sylphは実装とreviewを別コンテキストへ委譲する調整役であり、source実装を直接担当しない。
