# Wave31完了後の残件リスト

> 状態: 2026-06-02、Wave31完了後の残件バックログ。

## 目的

この文書は、次wave以降を計画する前に見ておくべき残件をまとめるためのもの。

各waveのfinal reportは「そのwaveで何が実装証明されたか」を記録する。一方、この残件リストは「まだ何ができていないか」「どこに判断ゲートがあるか」「品質面で何を持ち越しているか」を見失わないために置く。

ここにある項目がすべて次wave対象という意味ではない。次waveはこの中から1つの実装境界を選び、1waveで完了できる大きさに切る。

## 更新履歴

- Wave26でRig Control Keyform / Viewer Hardeningは`implementation-proven`になったため、P0候補から外した。
- Wave27では`Mask / clipping / opacity authoring`を選定済み。詳細な実装範囲とOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave27-plan.md`に固定した。
- Wave27で`Mask / clipping / opacity authoring`は`implementation-proven`になったため、P0候補から外した。
- Wave28では`Part / texture / layer tree workflow`を選定し、semantic part hierarchy、drawable part reassignment、existing texture assignment、editor layer selection / lock / editor-hide、Preview / Viewer evidence、fixtures、desktop/mobile e2e persistence smoke まで `implementation-proven` になったため、P0候補から外した。
- Wave29で`Canvas Mesh Editing v1`は`implementation-proven`になった。Wave17のrow/button vertex nudgeを、canvas/SVG selection、multi-vertex translate、semantic Preview / Viewer / Runtime evidence、validator mesh diagnostics、fixtures、desktop/mobile e2eへ拡張した。Topology editor、UV editor、full renderer、pixel oracle、real image bytes、file picker/parser/archive、external dependency、Cubism compatibilityは含めていない。
- Wave30では`Tutorial-like MVP mini model`を候補から選び、1waveで閉じる範囲として`Tutorial-like MVP Mini Model v0`を計画した。これはrights-clean synthetic modelを使って既存のpart / texture / layer / mesh / mask / rig-control keyform / dynamics / Viewer / Validator workflowを一周させる計画であり、real asset bytes、file picker/parser/archive、image decode、full renderer、pixel oracle、Cubism compatibility、public sample distributionは含めない。
- Wave30で`Tutorial-like MVP Mini Model v0`は`implementation-proven`になった。Rights-clean synthetic mini modelを、recipe / operation log / model diff / package materialization / semantic runtime-viewer evidence / validator readiness / guided editor workflow / desktop-mobile save-load e2e まで一周させた。Real asset bytes、file picker/parser/archive、image decode、full renderer、pixel oracle、texture sampling correctness、standalone viewer、Cubism compatibility、public tutorial asset distributionは含めていない。
- Wave31では`Package Binary / File I/O Decision + Browser Byte Intake Pilot v0`を選定した。Wave22のmetadata-only binary boundaryを足場に、browser `<input type=file>`でactual bytesを受け、digest / byteLength / mediaType / rights / provenance / availabilityをpackage-local binary boundary、validator、Editor、desktop-mobile e2eへ載せる計画である。PSD parser、PNG/image decode、archive import/export、drag-drop、File System Access API、external dependency、full renderer、pixel oracle、Cubism compatibilityは含めない。
- Wave31で`Package Binary / File I/O Decision + Browser Byte Intake Pilot v0`は`implementation-proven`になった。Browser `<input type=file>`でactual bytesを受け、digest / byteLength / mediaType / rights / provenance / availabilityをpackage-local current-session binary boundary、validator、Editor、desktop-mobile e2eへ載せた。PSD parser、PNG/image decode、archive import/export、drag-drop、File System Access API、external dependency、full renderer、pixel oracle、Cubism compatibility、public asset distribution、persistent binary storage guaranteeは含めていない。
- この文書はWave32以降の計画前に、残ったproduct directionと判断ゲートを読むための入口として使う。

## 調査観点

Undineは観点設計と統合だけを担当し、実装状況の読解はread-onlyのSylphへ分けた。これにより、root contextに実装詳細を必要以上に取り込まないようにした。

| 観点 | 調査内容 | 主な問い |
|---|---|---|
| AC / シナリオ / traceability | 受け入れ条件、シナリオ、fixture、wave report | MVPとして未証明の能力は何か |
| 実装 / プロダクト機能 | 現在の実装面とユーザーワークフロー | editor/runtimeは何ができ、何がまだできないか |
| 品質 / source / test | source organization、検証再現性、test構造 | 次waveのgateや並行品質domainに入れるべきものは何か |
| PSD / asset I/O / dependency / rights | PSD、PNG、binary file-set、archive、fixture、demo/public境界 | 実バイトやparserへ進む前に何を決めるべきか |

根拠にした主な文書は、`.agents/skills/implementation-orchestration/SKILL.md`、`discussion/implementation/current-capability-map.md`、Wave20-Wave28のfinal report / review、acceptance / scenario文書、dependency policy、source organization policy、およびfocused source inspection。初期の残件調査ではSylphがsource editを行わずread-onlyで整理した。Wave28についてはfinal verificationがpassしており、clean integration review path は Domain H 後続gateとして登録済み。

## 実装証明済みの大枠

Wave30完了後、以下はimplementation-provenとして扱ってよい。

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

一方で、Cubism SDK/Core互換、Cubism形式import/export、`.moc3` / `.model3.json` loading、full renderer、pixel oracle、standalone viewer、real PSD parser、image decode、file picker、archive import/export、actual binary upload、external HTTP/WebSocket/MCP transport、LLM provider integrationは、まだ実装証明されていない。多くは明示的なfuture scopeまたはnon-claimとして扱う。

## P0 / 近いwave候補

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Mesh topology / UV editor expansion | Canvas Mesh Editing v1は完了したが、vertex/edge/face creation/delete、retopology、UV direct edit、atlas packingは未実装。 | Wave29の後続候補。renderer/pixel oracleやreal texture bytesとは別waveで扱う。 | topology/UV直接編集へ進む場合は必要。 |
| Public tutorial / demo asset boundary | Wave30はrights-clean synthetic semantic mini modelまで。公開配布用tutorial asset、demo capture scene、final disclaimer、public/private asset splitは未決。 | 実素材や公開demoへ進む前に、rights policy / fixture policy / preflightを先に決める。 | 必要。 |

## Asset I/O / PSD / Binaryの判断ゲート

ここは気軽に実装へ入らない方がよい。metadata/semantic evidence中心の現在地から、実ユーザー資産、実バイト、dependency、rights、security、fixture policyへ境界が広がる。

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Persistent binary byte round-trip | Wave31でactual bytesのcurrent-session intakeは完了したが、browser-local reload後にraw bytesは永続化されずreuploadが必要。 | archive/filesystem/project import-export戦略と分けて決める。IndexedDB/base64/localStorageなどの方針は独立判断。 | 必要。 |
| File picker / drag-drop boundary | Wave31で`<input type=file>`は完了したが、drag-drop、File System Access API、directory pickerは未実装。 | 追加するならUX/security/storage方針を先に決める。 | 必要。 |
| Package archive import/export | browser-local save/loadはあるが、package archive writer/importerがない。 | byte intakeとは別にarchive戦略を決める。ZIP dependencyは承認対象。 | 必要。 |
| PNG decode / texture bytes materialization | texture previewはdeterministicまたはreference-backedで、実PNG bytesのdecode/renderはない。 | byte intakeとrights-clean fixture policyの後に回す。 | 必要。 |
| Real PSD parser adapter | 現在のPSD pathはtrusted adapter metadataを受けるだけで、bytesをparseしない。 | byte intake、dependency policy、parser license/provenance review後の大きなwaveとして扱う。 | 必要。 |
| PSD raster extraction / compositing | channel decode、compression、effects、masks、Photoshop互換renderingは明示的にunsupported/deferred。 | future scope。おそらく複数wave。 | 必要。 |
| Binary rights/provenance gate | metadataはあるが、実bytes/archiveにはsource、license、redistribution、AI-use、transform-historyのルールが必要。 | real asset import waveの前にgateとして決める。 | 必要。 |
| Real binary/image fixture policy | fixtureは意図的に実PSD/PNG bytesを避けている。実画像fixtureにはrights-clean policyが必要。 | sample imageやparser fixture投入前に決める。 | 必要。 |
| Media type sniffing / byte security validation | validatorは宣言metadata/digestを見ているが、signature sniffやheader decodeはない。 | actual bytesが入る時に追加する。 | byte scope次第。 |
| Demo/public scope for imported assets | demo capture assets、preflight、disclaimer、public/private asset splitが未解決。 | public demo capture前に扱う。内部semantic waveの前提にはしない。 | 必要。 |

## 品質 / 再現性バックログ

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Fresh checkout replay gate | 直近waveはshared uncommitted workspaceで検証されている。fresh checkoutまたはreplay gateがない限り、再現性リスクが残る。 | 近いうちにquality gateまたは並行quality domainへ入れる。 | 不要。 |
| `check:source` blind spot hardening | 現guardは`.ts`の`index.ts`とcatch-all名が中心。一般的なfile growthや大型`.mjs` smoke fileを検出しない。 | threshold合意後に慎重に拡張する。 | thresholdがpolicyなら必要。 |
| Editor workflow/view-model/evidence surface split | 現行policy違反ではないが、次のUI waveでさらに太りやすい。 | 触るwaveで継続的に分割する。 | 不要。 |
| E2E smoke suite decomposition / coverage matrix | smoke testが大型化しており、coverageもsemantic smoke-levelが多い。 | test helper境界とcoverage matrixを、test-focused waveまたは並行quality domainで扱う。 | 不要。 |
| Validator contract doc refresh | Wave21/Wave22のbinary/PSD check IDsやasync binary validation entrypointがcontract docsに十分反映されていない。 | 小さなdoc/contract sync task。 | 不要。 |
| `SourceAssetSchema` discriminant cleanup | kind/profile pairingはvalidatorで守っているが、schema側ではまだ狭められていない。 | package-format migrationがscopeに入る時まで待つ。 | breakingなら必要。 |
| Runtime/viewer evidence naming cleanup | refsやdiff fieldsに過去由来の名前が残る。互換上は問題ないが意味名として古い。 | schema compatibility workまで延期。 | 場合により必要。 |
| Dynamics create-flow atomicity | dynamics group作成が拡張されると、拒否後にoutput parameterが残る可能性がある。 | advanced dynamicsへ進む前に直す。 | 不要。 |

## AI / Validation / Demoバックログ

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| AI repair / diff workflow | read、validate、dry-run、approval、transcriptはあるが、repair candidate generation、natural-language repair、standalone diff、rerun validationがproductizedされていない。 | validator/report surfaceが安定してからbounded AI repair waveへ。 | provider/LLM boundaryを含め必要。 |
| Validator product report / preflight | targeted validatorsは多いが、mesh/mask/rig/dynamics/demo-safe readinessを横断するMVP-wide report/preflightは未完。 | demoまたはtutorial-like integration前のsupport waveとして有効。 | 不要。 |
| Demo-safe preflight / capture | policyはあるが、capture scene、自動preflight、disclaimer、public subsetが未実装/未決。 | viewer/product slicesが固まった後に扱う。 | 必要。 |
| Viewer renderer / standalone viewer / demo capture | Viewerはeditor-internal semantic inspection。full renderer、standalone app、pixel oracle、demo sceneはfuture scope。 | semantic authoring waveには混ぜない。境界変更時だけ扱う。 | 必要。 |

## Wave27-Wave28で完了した範囲

1. **Mask / clipping / opacity authoring**
   Wave27で完了済み。`setMaskRelation`をauthoring operationとして閉じ、runtime evidence、validator diagnostics、contract fixture、editor composition workflow、desktop/mobile save-load e2e smokeまで一周させた。full renderer、pixel oracle、Cubism互換、file picker、parser、image decode、archive、actual binary upload、external dependencyは含めていない。
   根拠: `discussion/implementation/waves/wave27/wave27-final-report.md`

2. **Part / texture / layer tree workflow**
   Wave28で完了済み。part create/update、drawable part reassignment、existing texture atlas assignment、editor selection / lock / editor-only hide、Preview / Viewer semantic evidence、validator diagnostics、contract fixture、desktop/mobile save-load e2e smokeまで一周させた。full drag-and-drop layer tree、full part tree UX、real image bytes、file picker、parser、image decode、archive、actual binary upload、external dependency、Cubism互換、full renderer、pixel oracleは含めていない。
   根拠: `discussion/implementation/waves/wave28/wave28-final-report.md`

## Wave29完了範囲

Wave29は **Canvas Mesh Editing v1** として完了済み。

目的は、Wave17の最小mesh vertex nudgeを、Editor上のcanvas/SVG mesh editing workflowへ進めること。最小scopeは以下。

- Canvas/SVG上でmesh vertexを選択し、単一または複数頂点をtranslateする。
- Existing `moveMeshVertex` operation lifecycleを活用し、dry-run / commit / operation log / model diff / package materializationに残す。
- Runtime / Preview / Viewerにmoved vertices、bounds/hash、topology summary、selection/lock/editor-hide/runtime visibilityのsemantic evidenceを残す。
- Validatorにinvalid triangle index、degenerate triangle、vertexStableIds length mismatch、UV count mismatch、stale selected vertex refsなどのdeterministic diagnosticsを追加または補強する。
- Contract fixtureとdesktop/mobile e2eでsave/load後の再観測まで確認する。

Wave29では、topology editor、UV editor、automatic triangulation、full renderer、pixel oracle、real image bytes、file picker/parser/archive、external dependency、Cubism compatibilityを扱っていない。これらは引き続き残件またはfuture scopeとして扱う。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave29-plan.md`に固定した。

## Wave30完了範囲

Wave30は **Tutorial-like MVP Mini Model v0** として完了済み。

目的は、これまで個別にimplementation-provenになったsemantic authoring sliceを、Private Prototype内で1体の小さなsynthetic character model制作workflowとして一周させること。完了scopeは以下。

- Rights-clean synthetic mini modelを作成する。外部画像、実PSD/PNG bytes、file picker、parser、archive、image decodeは使わない。
- Existing operations / editor workflowsを組み合わせ、part / texture / layer / mesh / mask or opacity / rig-control keyform / dynamicsを横断する。
- Runtime / Preview / Viewerにtutorial readinessと各slice evidenceをAI-readableに残す。
- Validatorにtutorial readiness profile / preflightを追加し、missing sliceやunsupported claimsをdeterministic diagnosticsとして出す。
- Contract fixtureとdesktop/mobile e2eでsave/load後の再観測まで確認する。

Wave30では、public tutorial asset、demo capture scene、full renderer、pixel oracle、actual binary upload、file picker/parser/archive、external dependency、Cubism compatibilityは扱わない。

詳細なdomain splitとOrch-Sylph並列投入方針は`discussion/implementation/orchestration/wave30-plan.md`に固定した。完了根拠は`discussion/implementation/waves/wave30/wave30-final-report.md`と`discussion/implementation/reviews/wave30/wave30-clean-integration-review.md`に記録した。

## Wave31完了範囲

**Package Binary/File I/O Decision + Byte Intake Pilot v0**
Wave31で完了済み。最小scopeは`<input type=file>`で任意binaryを受け、既存package-local binary file-setとbinary validatorでdigest / byteLength / mediaType / rights / provenanceを証明するところまで。PSD parser、PNG decode、archive dependency、public demo asset policy、persistent binary storage guaranteeは入れていない。完了根拠は`discussion/implementation/waves/wave31/wave31-final-report.md`と`discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`に記録した。

## Wave32以降の推奨選択肢

1. **Full layer tree / part tree UX expansion**
   Wave28のminimum form-based workflowを足場に、drag-and-drop reorder、rename/delete/reparent completeness、multi-select bulk operations、group transform、または canvas/tree direct manipulation へ広げる候補。real image decodeやrenderer workとは分ける。

2. **Package archive / persistent binary storage decision**
   Wave31のcurrent-session byte intakeを足場に、package archive writer/importer、filesystem import/export、browser persistence strategy、binary storage policyを決める候補。PSD parserやimage decodeとは分ける。

3. **Mesh topology / UV editor expansion**
   Wave29がCanvas Mesh Editing v1を閉じた後の候補。vertex/edge/face creation/delete、retopology、UV direct edit、atlas packingへ広げる場合は、renderer/pixel oracleやtexture bytesとは別waveで扱う。

4. **AI repair / diff workflow**
   Wave30のtutorial mini modelやvalidator readinessを足場に、repair candidate generation、natural-language repair、standalone diff、rerun validationへ広げる候補。LLM provider / prompt boundary は別判断。

5. **Public tutorial / demo asset boundary**
   Wave30はsynthetic semantic fixtureで閉じた。public tutorial asset、demo capture scene、final disclaimer、preflight自動化へ進むなら、rights-clean policyとpublic/private splitを先に固定する。

## 関連wave前に確認すべき判断

1. Wave27のmask / clipping / opacityとWave28のpart / texture / layer tree workflowはsemantic evidenceで閉じた。次にpixel/full rendererへ進むか、引き続きsemantic authoring / editor workflowを優先するか。
2. Wave31のbyte-intake pilot後、次はpersistent binary storage / archive import-exportへ進めるか、別のeditor workflowへ戻るか。
3. file input拡張を許可する場合、drag-drop / File System Access API / directory pickerまで含めるか。
4. archive import/exportを今project-defined ZIPとして始めるか、browser-local binary byte intake後まで延期するか。
5. 実PSD/PNG/image fixtureとdemo/public assetに対するrights-clean policyをどこまで厳格にするか。
6. Wave30のtutorial-like MVP modelはsynthetic mini modelとして完了済み。次にpublic tutorial asset / demo captureへ進む場合、最小仕様とrights policyを改めて決める必要がある。
7. Viewerは当面editor-internal semantic inspectionのままにするか、standalone/full rendererへ進み始めるか。

## 今後の使い方

次wave計画では、この文書と`current-capability-map.md`をセットで読む。Wave29については`discussion/implementation/waves/wave29/wave29-final-report.md`、`discussion/implementation/waves/wave29/_map.md`、`discussion/implementation/reviews/wave29/_map.md`を完了根拠として扱う。Wave30については`discussion/implementation/waves/wave30/wave30-final-report.md`、`discussion/implementation/waves/wave30/_map.md`、`discussion/implementation/reviews/wave30/_map.md`を完了根拠として扱う。Wave31については`discussion/implementation/waves/wave31/wave31-final-report.md`、`discussion/implementation/waves/wave31/_map.md`、`discussion/implementation/reviews/wave31/_map.md`を完了根拠として扱う。Wave32以降は、残ったproduct directionから1つを選び、1waveで完了できる範囲に切る。

実装に入る場合は、引き続きUndine -> Orch-Sylph -> Gnome / Review-Sylphの分離を守る。Orch-Sylphは実装とreviewを別コンテキストへ委譲する調整役であり、source実装を直接担当しない。
