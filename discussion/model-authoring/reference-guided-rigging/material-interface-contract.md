# 素材インターフェース共通契約

状態: 技術独立Review PASS（Loop 3）、root受領待ち、User Gate未判定。2026-09-26。準備domainの技術契約。業務実装の完成・User Gate合格を意味しない。
Basis: [wave plan](material-interface-wave-plan.md)、[合意した用途](material-authoring-interface.md)、[静的調査](material-ingestion-research.md)。
変更範囲は contracts の追加schema/validator/fixture と本書・completion。A/B/C業務module、既存dispatcher、Editorは未実装。

## 1. 既存repositoryの確認事実

- packages/package-format/src/model-graph.ts: ModelGraphSchema.coordinateSystem は canvas-y-down-v1。pixel-edgeの左上原点・右向きX/下向きYと向きは一致するが、単位は同一とは仮定しない。
- packages/package-format/src/texture-atlas.ts: TextureContentInsetSchema と TextureAtlasEntrySchema。dimensionsはpadding込みraster、contentInsetはraster内のcontent領域。alphaのtight bboxそのものではない。
- packages/package-format/src/source-manifest.ts: SourceLayerSchema.bounds と mappedDrawableIds。source画像のlocal pixel座標とstage boundsは別の量。
- apps/authoring-host/src/perception/render-scene-adapter.ts: createPerceptionRenderScene はstage mesh verticesと layer-local-top-left-0-1-v1 UVを使い、textureのdimensions/contentInsetでcontent UVをrasterへremapする。
- packages/authoring-core/src/runtime-graph-drawables.ts: createRuntimeDrawOrder は part-children-order.ts の flattenDrawableIdsByPartOrder を使う。単一baseDrawOrder数値の変更だけでは構造順を表現できない。
- packages/authoring-core/src/authoring-session.ts: AuthoringSession は packageIdentity / packageRevision / graph / binaryAssets を保持。cloneAuthoringSessionで作業候補を分離できる。
- packages/authoring-core/src/workspace-open.ts、workspace-save.ts、apps/authoring-host/src/package-directory-io.ts が通常packageの再読込・保存経路。候補の作業物も同じopen-model-package-v1を用いる。
- packages/authoring-core/src/mesh-generation.ts の createGeneratedMeshForDrawable、rig-control-mutations.ts、keyform-mutations.ts が既存再mesh/rig編集の接続先。新しい特殊モデル形式を作らない。
- packages/validator-core/src/part-texture-layer-diagnostics.test.ts は drawable-texture-source-layer-mismatch を検査する。Bはsource/layer/textureを整合更新し、validatorを緩めない。
- apps/authoring-host/src/run-authoring-host-command.ts はstateDirectoryをpackageDirectory内に置くことを拒否する。candidate store/working package/artifactはbase package外へ配置する。
- apps/authoring-host/src/authoring-host-response.ts はsuccess/rejected/errorをexit code 0/2/1へ写す。Cは未完了をsuccessへ変換しない。

以上は静的照合であり、素材変更・実renderer・保存再読込の実証は後続waveで行う。

## 2. 共通entrypointとDTO

すべて @private-2d-rigging-lab/contracts の既存index.tsから追加exportする。package-format、ai-interface、fs、PNG decoderに依存しない。既存のIDs、FiniteNumber/Vec2/Rect、TargetRef、Diagnosticを再利用する。format側schemaはcontractsへ逆依存できないため、必要な小さなprojectionを定義する。

| ファイル | 公開契約 |
| --- | --- |
| packages/contracts/src/material-coordinates.ts | MaterialPixelPointSchema / StagePointSchema / PixelRectSchema / StageRectSchema / PlacementSchema / CorrespondenceSchema / FitEvidenceSchema |
| packages/contracts/src/material-image.ts | MaterialImageDescriptorSchema、MaterialNormalizedImageSchema、MaterialSha256Schema |
| packages/contracts/src/material-intent.ts | MaterialIntentSchema、MaterialInsertionSchema、MaterialImpactSchema |
| packages/contracts/src/material-candidate.ts | MaterialCandidateSchema、MaterialCandidateIdSchema、MaterialPackageVersionSchema、MaterialRestPoseSchema、MaterialApprovalSchema、MaterialCandidateActionSchema、materialPackageVersionsEqual |
| packages/contracts/src/material-artifacts.ts | MaterialImageArtifactSchema、MaterialCoordinateSidecarSchema、MaterialSourceContextSchema、MaterialViewportSchema、MaterialAbsolutePathSchema |
| packages/contracts/src/material-operation-result.ts | MaterialOperationResultSchema |
| packages/contracts/src/material-contract-fixtures.ts | createMaterialImageFixture、createMaterialCandidateFixture |

fixtureはA/Bがpublic入口から共用できる。compact: 4×4、alpha square=(1,1,2,2)、scale=2、translation=(9,9)。wide: 10×8、alpha square=(3,2,4,4)、scale=1、translation=(8,9)。いずれもstage alpha rect=(11,11,4,4)になる一方、画像全体のstage幅は8と10。新画像全体を旧bboxへfitしないことを数値で確認する。自作RGBAでありPNG decoder fixtureではない。毎回新しいbufferを返す。

## 3. 座標・画像・restの固定

source-image-pixel-edge-v1は画像全体の左上edge=(0,0)、右下edge=(width,height)。ピクセル中心は(i+.5,j+.5)。rest-stage-canvas-y-down-v1はモデルrestのstage座標。変換は xStage=scale*xPixel+translation.x、yStage=scale*yPixel+translation.y、finite scale>0。回転、非等方scale、透視、bbox自動fitは契約外。対応点残差の単位はstageであり造形の自然さスコアではない。

normalized imageはtop-to-bottom、srgb、straight-alpha-v1のRGBA8。descriptorは元入力file SHA-256と正規化RGBA SHA-256を別に保持する。width*height*4とbyteLengthを一致させ、safe integerを要求する。hostは元fileをdecode前にhashし、normalized bytesをhashする。受領側はbytes/hashを検証する。共通validatorはhash書式、長さ、alpha実数・tight boundsとbytesを照合するが、暗号hashそのものは算出しない。

alpha.boundsはalpha>0の最小pixel-edge矩形、fully transparentならnull。nonTransparentPixelCountはalpha>0、translucentPixelCountは0<alpha<255。fully transparent descriptor自体は表現可能だが、A/Bは描画可能な候補を作れない場合に診断し成功扱いしない。
contentInsetは人工storage paddingの厚さ。正規化で画像をcrop/padしない通常PNG入力は全辺0とし、元からある透明余白をinsetへ付け替えない。content regionは(inset.left,inset.top,width-left-right,height-top-bottom)、alpha boundsはその内側。SourceLayerStageBoundsは画像全体やalpha bboxと無条件に同一視しない。Bが通常textureへ変換する際にはpixel/stage変換とcontent UVの関係を保ち、source bounds/mesh boundsとinsetの整合を検証する。

MaterialRestPoseはundeformed-rest、keyedDeformation=false、dynamics=false。素材の基準姿勢であり、rig preview時の評価姿勢をrestと偽装しない。working previewの評価parameter/variant等の詳細は既存render sidecarと併記する。素材が中間姿勢である場合を勝手にrest扱いして二重変形しない。

## 4. version/fingerprintと候補state

candidateIdは永続 material_*、operationIdは既存 op_*。basePackageはpackageId、packageRevision、contentFingerprint、fingerprintVersion=material-package-content-v1を全て持つ。

fingerprint v1は次のbyte-exact算法をA/Cで共用する（準備で算法実装はしない）。
1. 保存package directory内の全regular fileを再帰的に収集する。manifest/model/source/texture/binary/index/provenance/rights/operations log/atlasを含む。隠しfileも除外しない。symlink/reparse traversal、重複canonical pathは拒否する。
2. 相対pathを区切り "/" のUTF-8へ変換する。大文字小文字・Unicode・JSON空白を変更しない。path bytesの昇順で並べる。JSONの再serializeはしない。
3. SHA-256入力はUTF-8 "material-package-content-v1\n"、uint64 big-endian file count、各fileについて uint64 big-endian path byte length + path bytes + uint64 big-endian file byte length + file bytes。digestはlowercase hex 64桁。
4. package外のworkspace/editor未保存session、candidate metadata/store、working package、preview artifactsはbase hashの対象外。mtimeや絶対directory名も対象外。package内にcandidate等を置いて除外する運用は禁止。
5. working package fingerprintにも同一算法を使い、候補を通常packageとしてserializeした正確なbytesを対象とする。Bは純粋file-setへ生成し、A/Cが永続化/hashする。変更中snapshotを取らず、Cのapply再検証と書込間の競合も拒否する必要がある。

| state | 必須情報・遷移 |
| --- | --- |
| registered | image/rest/placement/intent/base/provenance。作業package・approvalなし |
| working | workingPackage必須。approvalなし |
| approved | workingPackageとapproval必須。approvalはcandidateRevisionとworking package版/hashに一致 |
| applied | 上記にappliedPackage必須。base論理IDを維持しsaved revisionがbaseより進む。終端 |
| stale | observedBasePackage必須、baseとは異なる。workingPackageがあれば保持。approvalなし |
| discarded | 終端。元base変更なし |

placeはactive候補からregisteredへ戻り、旧working packageとapprovalを無効にして再buildを必要とする。buildはregistered/working/approvedからworkingへ、editはworking/approvedからworkingへ進む。内容を変更するplace/build/editではcandidateRevisionを増分し承認を削除する。approveはworkingからapprovedへ、同じrevisionとworking package fingerprintを承認記録へ拘束する。再riggingの通常commandも必ずeditと同じ失効処理を通す。承認者識別はapprovedByであり、schema parseは承認権限を与えない。ユーザーへ内部検証を依頼するゲートは追加しない。

applyはapprovedだけを受け、candidate revisionと観測baseのID/revision/fingerprintを再照合する。baseが変化した場合はstaleとして候補を残し、baseへ書かない。staleのinspect/preview/discardは可能だが、再base/rebase機能は今回作らず新candidateを登録する。discardはどの非終端stateからでも可能。failureでbaseへ部分変更を残さない。OS障害までの原子性は後続実測なしに主張しない。MaterialCandidateActionSchemaはこれらの前提条件を検査するだけでstateを変更しない。

## 5. 追加・置換と共有参照の安全

addは新drawableId、displayName、parentPartId、insertion(first/last/before/after+Part/Drawable sibling)、rigControlIds、maskBindings（maskRelationIdとrole=maskSource/target）、runtimeVisibility、defaultOpacityを必須とする。空配列は明示的に所属なし。parentPartIdは構造、rigControlIdsは運動所属であり代用しない。BはID非衝突、siblingが指定Partの直接child、参照実在、mask/rig整合をgraphに対して検証する。今回は既存Partへ追加し、Part作成は既存操作を使う。

replaceはdrawableIdを維持し、geometryReset.scope=target-direct-geometry-keyformsとresetするkeyformSetIdsを明示する。Bは指定集合が実際の対象直属geometry keyformsと一致することを検証し、対象外/共有keysetの削除を拒否する。無条件の全keyform resetや旧rigの自動移行をしない。既存deformerは保持し、texture/source/layer/generated provenanceを新規記録して対象mappingを更新する。旧共有textureを上書きしない。対象外参照、名前、Part位置、構造描画順、visibility、mask、variant所属を維持する。

MaterialImpactはpreserved/reset/created、sharedReferences、refusedDeletionsとaffectedDrawableIdsを返す。既存deformer改変はfalse固定。Bの影響分析はgraphを根拠とし、申告DTOだけを信頼しない。共有control/key/parameter一括削除は拒否する。Cがcandidateへ既存rig commandを通す際にもBの同じguardを必須適用する。既存deleteRigControl等をそのまま通す抜け道を作らない。対象専用制御の明示再編集は許容する。

## 6. artifact/result

全画像は絶対image pathと絶対sidecar pathを返す。source-textureは元textureの透過PNG、context-compositeは固定stage viewportの周囲合成。crop合成を原本の代わりにしない。completed extractはresult.sourceContextを必須とし、artifacts内のsource-textureとcontext-compositeがcontext内の絶対path/sidecarと一致することを検証する。MaterialSourceContextはmesh/Part/rig/mask/variant refs、元画像写像、sourceLayerStageBoundsも返す。

placement-alpha-previewは新alpha全域を既存Part構造順へ仮合成し、旧meshでclipしない。coverage=full-alpha-no-old-mesh-clip。working-mesh-rig-previewは通常packageの実mesh/rig評価、coverage=evaluated-meshでworking package版/hash必須。候補previewにはcandidateId/revisionを添える。旧/新は同じMaterialViewportのstageRect/output dimensionsを使う。

sidecar.imageToStageは返したartifact PNGのpixel-edge→stage写像でviewportと一致する。素材そのもののpixel-edge写像はmaterialPlacementへ別記する。source-textureの場合、viewportは当該texture全体に対応するstage矩形。倍率は等方とし、縦横のpixels-per-stageを一致させる。固定viewportは画像がstage外へ伸びた場合も比較側で同一にする。

completed previewはpreviewContext（artifactとinline sidecar）を必須とする。artifactはplacement-alpha-previewまたはworking-mesh-rig-previewであり、result.artifacts内のkind/絶対path/sidecar pathと一致する。sidecarはartifact kind、candidateId/revision、base package版に一致し、working previewではcandidateが保持するworkingPackageの版/hashとも一致する。source-textureやcontext-compositeだけではpreview成功にならない。discarded候補はpreview成功にできない。

MaterialOperationResultのstatusはcompleted/pending/rejected/failed。未完了はdiagnostics必須、changedTargets空、baseChanged=false。completedでもregister/buildはbase保存完了を意味しない。baseChanged=trueはcompleted applyだけ。build/apply成功はrefusedDeletionsのないimpact必須。失敗診断とcompletedの併存、candidateId/base版の食い違い、operationとstateの矛盾をvalidatorが拒否する。CはcompletedだけをCLI success/exit 0へ、pending/rejectedを非成功/exit 2へ、failedをerror/exit 1へ写す。savedはbaseChangedに一致させ、candidate保存をbase保存と誤認させない。失敗前にcandidateIdを採番できなかった場合はnullを使い、捏造しない。

## 7. A/B/C所有一覧（次waveの予約。準備では作成しない）

### A: host画像/I/O

新規moduleは apps/authoring-host/src/ 直下。各moduleと同名 .test.ts はAの独立tests。既存public registry/export/dispatcherは編集しない。

| module | entrypoint/責務 |
| --- | --- |
| material-source-extraction.ts | extractMaterialSource: loaded read-only session + Drawable + viewport → source/context PNG、MaterialSourceContext |
| material-image-decode.ts | decodeMaterialImage: original bytes → MaterialNormalizedImage（PNG decoderとSHA-256検証） |
| material-package-fingerprint.ts | fingerprintMaterialPackage: directoryまたはfile-setの上記byte-exact fingerprint |
| material-candidate-store.ts | create/load/save candidate。storeはbase外、metadata+normalized bytes+通常working packageを永続化 |
| material-placement.ts | resolveMaterialPlacement: explicit placementまたはcorrespondences → placement + numerical fit evidence |
| material-placement-preview.ts | renderMaterialPlacementPreview: base snapshot + candidate + RGBA + viewport → full-alpha artifacts/sidecar |

Aはpackages/authoring-coreを変更しない。decoder追加が必要なら apps/authoring-host/package.json と pnpm-lock.yaml はA所有（Cが同時変更しない）。fixtureはcontractsのpublic入口を使用する。AはCへこれら関数と実際のinput/output型を渡す。

### B: pure core候補作成/影響検査

新規moduleは packages/authoring-core/src/ 直下。各moduleと同名 .test.ts はB所有。既存index/public dispatcherは編集しない。Aのdecoder/storeに依存しない。

| module | entrypoint/責務 |
| --- | --- |
| material-candidate-build.ts | buildMaterialCandidate: AuthoringSession + MaterialCandidate + MaterialNormalizedImage → cloned working session + MaterialImpact + diagnostics |
| material-source-mapping.ts | 新source/layer/provenance/rights/texture/binary refsの通常packageへの整合 |
| material-drawable-add.ts | addのPart構造/order/motion/mask/visibilityとID検証 |
| material-drawable-replace.ts | 論理Drawable維持、source更新、再mesh可能なgeometry構築 |
| material-geometry-reset.ts | 対象直属geometry keyform集合の厳密照合・reset |
| material-impact-analysis.ts | analyzeMaterialImpact、guardMaterialCandidateOperation。共有関係を走査し削除を拒否 |

buildMaterialCandidateのresultはbase sessionを変更せず、成功時working sessionを返す。disk fingerprintや保存版の確定をcoreが偽装しない。A/CがserializeしてworkingPackage版/hashを確定した後、MaterialCandidate state=workingを保存する。Bは失敗時入力session/bytes不変を試験する。既存mutation部品は内部importで利用する。既存sourceの修正が必須なら所有外変更としてOrch/rootへ調整依頼する。

### C: public統合・制作往復

新規所有module:
- packages/ai-interface/src/ai-material-command.ts、ai-material-command.test.ts（public payload/result schema）
- apps/authoring-host/src/run-material-command.ts、run-material-command.test.ts（A/B adapterと候補版確定）
- apps/authoring-host/src/material-candidate-apply.ts、material-candidate-apply.test.ts（承認/stale/apply/discardと保存）
- apps/authoring-host/src/material-candidate-operation.ts、material-candidate-operation.test.ts（通常mesh/rig操作のcandidate routing、B guard、approval失効）
- apps/authoring-host/src/material-comparison-viewer.ts、material-comparison-viewer.test.ts（同viewport画像切替artifact）
- apps/authoring-host/src/material-roundtrip.test.ts（保存再読込・renderer・失敗/discard/stale統合）
- apps/authoring-host/MATERIAL_COMMANDS.md（CLI利用文書）

Cだけが編集する既存共有file:
- packages/ai-interface/src/index.ts
- packages/ai-interface/src/ai-command-name.ts
- packages/ai-interface/src/ai-command-payload.ts
- packages/ai-interface/src/ai-command-response-payload.ts
- packages/ai-interface/src/ai-command-response.ts
- packages/ai-interface/src/ai-command-executor.ts
- packages/ai-interface/src/ai-command-host.ts
- packages/ai-interface/src/ai-capability.ts
- packages/authoring-core/src/index.ts（B entrypointの公開）
- apps/authoring-host/src/run-authoring-host-command.ts
- apps/authoring-host/src/authoring-host-command-host.ts
- apps/authoring-host/src/authoring-host-response.ts
- apps/authoring-host/src/cli.ts、cli-arguments.ts
- 上記既存fileに対応する既存tests（共有registry互換をCが検証）

packages/contracts/src/index.tsは準備担当の追加exportのみを現時点で所有する。受領後の共有契約変更はroot/Orch-Contractへ報告してから調整する。C以外は既存public export/dispatcherへ統合しない。新packageは作らない。通常operation-coreのoperation catalogに新素材業務を直接埋め込まず、Cのhost command経由でA/Bを接続する。

## 8. コマンド案と後続検証

既存AI command envelopeとCLI --command-file/stdinを再利用し、名称案は extractMaterialSource / registerMaterialCandidate / setMaterialPlacement / previewMaterialCandidate / buildMaterialCandidate / approveMaterialCandidate / applyMaterialCandidate / discardMaterialCandidate。通常mesh/rigは candidateIdを付けたCのroutingでworking packageへ向け、baseへ向けない。get/inspect候補はpreviewまたは専用read payloadで取得できるようCが確定する。これは名称案であり現在registryには未登録。

A: decode/alpha/対応点退化、異なるresolution/透明余白、persistent restore、base不変、旧mesh外の新alpha表示。
B: add/replace、拡張画像再mesh、source mismatch解消、正確なgeometry reset、共有texture/rig/variants保持、故障時入力不変。
C: source取得→register→place→比較→build→通常mesh/rig→比較→approve→apply→Editor再読込、およびadd/discard/stale拒否。本物renderer、atlas stale、session/disk境界を検証する。

準備ではfit/intake/mutation/render/apply実装も実素材評価も行っていない。技術PASSとUser Gateは別。Accepted User Gate全文はwave planを正とし、一切変更しない。rootがユーザーへ造形結果を提示し判断を受ける責務は移さない。
