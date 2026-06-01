# Wave25後の残件リスト

> 状態: 2026-06-01、Wave25完了後の残件バックログ。

## 目的

この文書は、次wave以降を計画する前に見ておくべき残件をまとめるためのもの。

各waveのfinal reportは「そのwaveで何が実装証明されたか」を記録する。一方、この残件リストは「まだ何ができていないか」「どこに判断ゲートがあるか」「品質面で何を持ち越しているか」を見失わないために置く。

ここにある項目がすべて次wave対象という意味ではない。次waveはこの中から1つの実装境界を選び、1waveで完了できる大きさに切る。

## 調査観点

Undineは観点設計と統合だけを担当し、実装状況の読解はread-onlyのSylphへ分けた。これにより、root contextに実装詳細を必要以上に取り込まないようにした。

| 観点 | 調査内容 | 主な問い |
|---|---|---|
| AC / シナリオ / traceability | 受け入れ条件、シナリオ、fixture、wave report | MVPとして未証明の能力は何か |
| 実装 / プロダクト機能 | 現在の実装面とユーザーワークフロー | editor/runtimeは何ができ、何がまだできないか |
| 品質 / source / test | source organization、検証再現性、test構造 | 次waveのgateや並行品質domainに入れるべきものは何か |
| PSD / asset I/O / dependency / rights | PSD、PNG、binary file-set、archive、fixture、demo/public境界 | 実バイトやparserへ進む前に何を決めるべきか |

根拠にした主な文書は、`.agents/skills/implementation-orchestration/SKILL.md`、`discussion/implementation/current-capability-map.md`、Wave20-Wave25のfinal report / review、acceptance / scenario文書、dependency policy、source organization policy、およびfocused source inspection。Sylphはsource editを行わず、今回の残件調査ではtest再実行もしていない。

## 実装証明済みの大枠

Wave25時点で、以下はimplementation-provenとして扱ってよい。

- foundation packages、contracts、runtime、validator、operation lifecycle、package persistence、editor operation UI、browser-local save/load、AI dry-run/read/approval foundation。
- keyform authoringとruntime keyform evaluation、Grid2D evidence hardening。
- embedded preview、drawable / mesh authoring foundation、draw order / visibility controls、mesh vertex nudge controls、split PNG metadata intake、texture-backed preview、part mapping foundation。
- parser-free PSD metadata/profile intake、package-local binary reference、in-memory file-set boundary。
- Minimum Open Dynamics v1のsemantic runtime slice。
- Private Viewer v0のeditor-internal runtime inspection surface。
- Minimum Rig Control v1のproject-defined `rotation2d` authoring/runtime slice。

一方で、Cubism SDK/Core互換、Cubism形式import/export、`.moc3` / `.model3.json` loading、full renderer、pixel oracle、standalone viewer、real PSD parser、image decode、file picker、archive import/export、actual binary upload、external HTTP/WebSocket/MCP transport、LLM provider integrationは、まだ実装証明されていない。多くは明示的なfuture scopeまたはnon-claimとして扱う。

## P0 / 近いwave候補

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Rig-control hardening | Wave25は`rotation2d`のcreate/bindとsemantic Viewer evidenceまで。keyform-to-rigControl product authoring、追加negative UX、viewer/report hardening、transform recompute coverageが薄い。 | 次wave候補として最も自然。`warpLattice2d` full evaluatorを含めずsemantic hardeningに閉じるのが安全。 | `warpLattice2d`まで含めるなら必要。 |
| Mask / clipping / opacity authoring | package/runtimeの足場はあるが、product workflow、editor controls、validator evidence、fixture materializationが未完。 | rig-control hardeningの次点、または代替の強い次wave候補。 | semantic scopeに閉じるなら大きな判断は不要。 |
| Part / texture / layer tree workflow | source layer mappingとtexture-backed previewはあるが、part/texture authoring、full layer tree、lock/hide/select、multi-select workflowは未完。 | 実画像decodeと混ぜず、editor workflow waveとして切る。 | MVP範囲次第で必要。 |
| Mesh editor completion | generated meshとvertex row nudgeはあるが、canvas drag、multi-vertex edit、topology、UV editor、invalid triangle workflowは未完。 | renderer workと混ぜず、mesh editor単独waveにする。 | MVP meshの深さを決める必要あり。 |
| Tutorial-like MVP mini model | 個別sliceは増えているが、blink/brow/mouth/face/body/arm/hair dynamicsを1つのGUI制作fixtureで通す証拠がない。 | mask/part/mesh/rigの残件が狭まった後のintegration wave向き。 | 最小モデル仕様が必要。 |

## Asset I/O / PSD / Binaryの判断ゲート

ここは気軽に実装へ入らない方がよい。metadata/semantic evidence中心の現在地から、実ユーザー資産、実バイト、dependency、rights、security、fixture policyへ境界が広がる。

| 残件 | 残っている理由 | 推奨扱い | ユーザー判断 |
|---|---|---|---|
| Actual binary byte intake | Wave22はmetadataとin-memory boundaryまで。editor uploadやpersistent byte round-tripはない。 | 進めるなら、既存binary validatorを使った小さなBrowser File API byte-intake pilotから始める。 | 必要。 |
| File picker / drag-drop boundary | production source intakeに`FileReader`、`showOpenFilePicker`、file inputがない。 | まず`<input type=file>`中心。File System Access APIやdrag-dropは後回し。 | 必要。 |
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

## 次waveの推奨選択肢

1. **Rig-control hardening**  
   Wave25の直後で最も摩擦が少ない。外部dependencyを増やさず、semantic authoring / runtime / validator / viewer evidenceに閉じられる。推奨scopeはkeyform-to-rigControl product authoring、negative UX、validator/runtime evidence hardening、Viewer report hardening。full `warpLattice2d`は明示判断がない限り除外。

2. **Mask / clipping / opacity authoring**  
   見えるMVP composition gapを閉じにいける。rendererやpixel oracleに踏み込まず、semantic runtime evidenceとvalidator fixture、editor workflowで切れる。

3. **Package Binary/File I/O Decision + Byte Intake Pilot v0**  
   real assetsを優先するならこちら。ただし最小scopeは`<input type=file>`で任意binaryを受け、既存package-local binary file-setとbinary validatorでdigest / byteLength / mediaType / rights / provenanceを証明するところまで。PSD parser、PNG decode、archive dependency、public demo asset policyは入れない。

## 関連wave前に確認すべき判断

1. Rig-control hardeningに`warpLattice2d` full evaluatorを含めるか、`rotation2d` / semantic hardeningに閉じるか。
2. asset I/Oはdecision-onlyから始めるか、minimal actual binary byte-intake pilotまで進めるか。
3. file inputを許可する場合、`<input type=file>`に限定するか、drag-drop / File System Access APIまで含めるか。
4. archive import/exportを今project-defined ZIPとして始めるか、browser-local binary byte intake後まで延期するか。
5. 実PSD/PNG/image fixtureとdemo/public assetに対するrights-clean policyをどこまで厳格にするか。
6. editor end-to-endを証明するtutorial-like MVP modelの最小仕様は何か。
7. Viewerは当面editor-internal semantic inspectionのままにするか、standalone/full rendererへ進み始めるか。

## 今後の使い方

次wave計画では、この文書と`current-capability-map.md`をセットで読む。そこから1つのproduct directionを選び、1waveで完了できる範囲に切る。

実装に入る場合は、引き続きUndine -> Orch-Sylph -> Gnome / Review-Sylphの分離を守る。Orch-Sylphは実装とreviewを別コンテキストへ委譲する調整役であり、source実装を直接担当しない。
