# 素材インターフェース Wave 1 A: host画像・座標・永続化

状態: 独立Review 技術PASS（Loop 2）をOrchが受領。root受領待ち。User Gate未判定。
Basis: material-interface-contract.md と material-interface-wave-plan.md。既存public registry、dispatcher、coreを変更しない。

## C接続API

入口はすべて apps/authoring-host/src/ の直接module import。contractsのDTOを使用する。

| module | export / 入出力 |
| --- | --- |
| material-image-decode.ts | decodeMaterialImage({bytes: Uint8Array, expectedOriginalFileSha256?: string}): MaterialNormalizedImage。verifyMaterialImage(image): void。materialSha256(bytes): string |
| material-placement.ts | resolveMaterialPlacement({placement} または {correspondences}): {placement, fitEvidence?}。MaterialPlacementInput / MaterialFitEvidence型をexport |
| material-package-fingerprint.ts | fingerprintMaterialPackage({directory} または {files: MaterialPackageFile[]}): Promise<string>。MaterialPackageFile={path,bytes}。readMaterialPackageFiles(directory)でexact bytes取得 |
| material-candidate-store.ts | createMaterialCandidate({store,candidate,image})、loadMaterialCandidate({store,candidateId})、saveMaterialCandidate({store,candidate,expectedCandidateRevision,workingFiles?})。各Promise<LoadedMaterialCandidate> |
| material-source-extraction.ts | extractMaterialSource(ExtractMaterialSourceInput): Promise<{sourceContext,artifacts,sidecars}> |
| material-placement-preview.ts | renderMaterialPlacementPreview(RenderMaterialPlacementPreviewInput): Promise<{artifact,sidecar}> |

MaterialCandidateStore={basePackageDirectory,storeDirectory}。LoadedMaterialCandidate={candidate,image,workingPackageDirectory?,workingPackage?}。workingPackageは通常package readerのLoadedAuthoringPackage。
createは呼出側が採番したcandidateId、registered/revision=0を受ける。saveはexpected revisionとimage/base不変を検証する。操作別state遷移・承認権限・revision加算と失効処理はCがcontractsに従って実行する。Aのstoreは承認を与えない。

ExtractMaterialSourceInput={session,packageVersion,drawableId,viewport,basePackageDirectory,artifactDirectory}。
RenderMaterialPlacementPreviewInput={session,candidate,image,viewport,basePackageDirectory,artifactDirectory}。
MaterialViewport型はmaterial-render-artifact.tsからexportし、MaterialViewportSchemaのinfer型。sessionは保存済みdirty=falseでpackage ID/revision一致を要求。Cは読み込みsnapshotとdisk fingerprintを対応させ、処理/apply間の競合をguardする。Aは任意sessionからdisk fingerprintを捏造しない。

MaterialHostErrorはcode/messageを持つ業務診断例外。schema不適合はZodError、I/O障害はNode errorも生じるため、Cはこれらも失敗としてDTO化し、未完了をsuccessへ変換しない。

## 実装上の技術選択

- PNGは既存lock内pngjs 7.0.0をhost直接依存化。decoder前のmaterial-png-validation.tsで全chunkのframing/CRC/基本順序を検査し、元fileとnormalized RGBAをそれぞれSHA-256化する。sRGBはlength=1/intent=0..3、gAMAはlength=4/値45455、cHRMはlength=32/標準sRGB値を要求。色chunkは一種類につき一回、PLTE/IDATより前に限定する。正しいsRGBが併記されても矛盾するgAMA/cHRMは拒否する。pngjsの未知ancillary CRC skipを信頼しない。crop/padなし、透明余白は保持、contentInset=0。ICC/cICPまたは非sRGB gamma/chromaticitiesは変換なしで成功扱いせず拒否。profileなしはsRGBとして解釈する。APNGは拒否。fully transparent画像は描画候補にしない。
- fitは正等方scaleとtranslationの最小二乗。残差/rms/maxを返す。回転、非等方、負scale、coincident source点の自動補正をしない。
- fingerprintは全regular fileをUTF-8 path bytes順に並べ、契約のuint64 big endian framingでhash。JSONを再serializeしない。相対path traversal/重複canonical pathを拒否。WindowsはPowerShell/.NETのReparsePoint属性を下降前に検査し、Node lstatでもリンクを拒否。読取中のfile/dir metadata・children変化を検出する。OS障害やチェック直後の敵対的変更までのatomic snapshotは主張しない。
- storeはbase外にcandidateIdごとのdirectoryを作る。immutable image.rgbaとsnapshot UUIDごとのcandidate.json/通常working packageを保存し、current.jsonをrenameで切替。saveはexclusive write.lock。中断でlockが残る場合の自動回復・crash durabilityは今回未検証。失敗した未参照snapshotが残る可能性があるがbaseを更新しない。
- working file-setはfingerprintと通常package open後のID/revisionを照合してからpointerを切替。loadでも毎回bytes/hashを再検証する。Cはsave後に返るworkingPackageDirectoryを使い、旧snapshotディレクトリを永続パスとして固定しない。
- source画像はraw textureを透過PNG化。source layer boundsとtexture dimensions/contentInsetから全rasterのpixel-edge→stage写像を得る。非等方写像は拒否する。元画像を周囲compositeのcropで代用しない。
- placement previewは既存render-softwareの実raster/alpha mask rendererを用いる。rest authored mesh、Part children順、default variant、runtime visibilityを使い、対象画像はpixel全域のquadへ差替える。mask source/target方向を維持。実rendererの構造順はindex 0が手前。旧meshclipなし。
- rest rig opacityはkeyforms/dynamicsを除いたcloneの既存runtime評価から取得する。評価済みgeometryは採用せず、rest mesh/明示配置は移動しない。新規追加のrigControlIdsもopacityへ反映する。rest変形やkeyed/dynamic変形を新素材へ二重適用しない。

## 補助moduleの理由

material-png-validation.ts: pngjsがskipするancillary chunkも含む全CRCと色宣言検証。Loop 1 Review R1への対処。
material-host-error.ts: C向けcode付き失敗。
material-render-artifact.ts: viewport等方検証・座標sidecar・base外artifact書込。
material-render-context.ts: sourceとplacementで同じrest stack/mask/texture解決を共有。
material-rest-opacity.ts: 既存runtimeの階層opacity規約を再利用。
material-test-fixtures.ts: 自作RGBA＋既存synthetic modelの共有試験素材。実素材や旧Astra成果は使わない。

## 未検証と後続

独立Review 技術PASS（Loop 2）受領済。browser/Editorは操作していない。通常packageのheadless再読込は試験済だが、Editor画面上の保存モデル確認はC。public command接続、作業candidateのbuild、approve/apply/discard、stale/apply競合、実素材の美的選択はAの成果に含めない。技術試験はUser Gate合格を意味しない。

