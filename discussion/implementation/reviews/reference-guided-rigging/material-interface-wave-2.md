# 素材インターフェース Wave 2 C 独立レビュー

判定: **技術 PASS（正式 Loop 1、headless 統合・保存互換の確認範囲）**。Editor UI の通常読込と比較 viewer のブラウザ実操作は未検証。Accepted User Gate は未実施・未判定であり、この判定で代行しない。

## 対象と根拠

作業 repo は C:/workspace/remie/code/ai-native-live2d-editor。基準 HEAD は a6bfc0429e642cd4c047f154d834cbd3c26ca72c。別コンテキストの Review-Sylph が basis、実 source/diff、独立実行結果を照合した。source/tests は変更していない。本書と review 用 llm-workspace artifact のみ作成。既存 dirty、既存 8769 preview、実制作 workspace、旧 Astra rig 成果に変更・参照なし。

Basis: [wave plan](../../../model-authoring/reference-guided-rigging/material-interface-wave-plan.md)、[共通契約](../../../model-authoring/reference-guided-rigging/material-interface-contract.md)、[用途](../../../model-authoring/reference-guided-rigging/material-authoring-interface.md)、material-ingestion-research.md、material-interface-wave-1-a.md、A/B completion と独立 Review。implementation-orchestration / discussion-management と discussion/_conventions.md を読んだ。祖先および対象 repo に適用 AGENTS.md は検出しなかった（依存内ファイルは適用外）。Accepted User Gate は wave plan の全文を正とし変更していない。

正式対象は末尾の24ファイル。Gnome の source-hashes.json と実 bytes が24/24一致。先行 fixture と修正途中の source に対する確認は、確定版の証拠と分離した。

## 適合と操作責務

- 既存 AI envelope に10素材 command を追加し、host が A/B を接続する。汎用 AiCommandExecutor では host がない command を not_implemented とし、成功を偽装しない。既存 capability を利用し、通常編集は editMaterialCandidate の nested OperationRequest へ明示 routing する。
- extract / register / place / placement比較 / build / 通常mesh・rig編集 / working比較 / approve / apply / 通常package再読込を add・replace 両方で独立実行。素材取得は元texture PNGとcontextを返し、配置は対応点からscale=2へ調整する。source mapping・binary・runtime validatorは保存前後とも fail=0。
- package固有の sibling lock は stateDirectory をまたいで全host commandを排他する。同revisionのdiscard / approve等はstate validatorで再確認し、apply直前およびmetadata commit直前にもcandidate全体を再照合する。競合は非成功、base未保存として返す。
- base・比較用保存base・workingは一度読み取った exact file-set から別snapshotを作り、そのsnapshotをsessionとして開く。fingerprintは同bytesに対応する。applyは承認済working file-setを再hashし、base再検査後にrenameしたbackupのhashも再検査する。外部変更を検出した場合は元bytesを戻しstale候補を保持する。
- 通常operationはdeep cloneへcommitし、既存operationの成功とB guard.allowedの両方を満たす場合のみ採用。共有control/key/parameter削除と対象外変更を拒否する。対象専用control create→bind→edit、parameter create→対象keyform関連付け→editを確認。成功editはcandidate revisionを増やしapprovalを失効する。
- placementは full-alpha-no-old-mesh-clip、workingは evaluated-mesh。128×128でstageRectを統一し、本物software rendererで出力する。素材基準rest metadataと実評価render sidecarを二層で返し、parameter/variant・package revision・対象snapshotを追える。keyed opacityの可視／不可視をpixelで確認し、画像4枚をview_imageで確認した。
- apply成功だけが baseChanged / saved=true。candidate保存はbase保存と区別する。失敗・拒否・破棄・staleではbase bytesを保持。CLI実プロセスのstdin/command-file inspectはexit0、拒否exit2、失敗exit1はhost suiteで検証。pendingを返す現在の業務分岐はないが、public schemaはpendingをokとして受理しない。
- 旧atlas previewのsignatureは素材変更後に一致せず、旧preview applyはfailedになる。stale cacheをfreshと偽装しない。

## 暫定指摘と確定版での解消

正式依頼前の準備レビューで次を指摘した。正式Loop 1の確定版には未解消の修正必須指摘はない。

1. cleanup故障が成功applyをfailedへ変える分岐、およびrollback故障時に唯一のbackupを削除する分岐。確定版では成功後cleanupを成否から分離し、復元失敗時はbackupを残して所在を報告する。独立故障注入を実行。
2. AI responseが空のok payloadやcommand/result.operation矛盾を受理する問題。AiCommandResponseSchemaにcross-field検査を追加。独立probeのemptySuccessAcceptedはtrueからfalseへ変わり、public回帰124件も通った。
3. package-busyがCLIでunknown/error exit1になる問題。確定版はmaterial.packageBusy診断のrejected、saved=false。独立競合試験が通った。
4. candidate current.json確定後のwrite.lock cleanup故障で、baseだけ復元しcandidateがappliedに残る問題。暫定版を独立probeで再現した。確定版はC adapterが旧pointerを復元してからbase rollbackへ進み、独立故障試験では候補全体とbase hashの復元を確認。
5. working再readと承認hashの対応、比較元baseのhashとsession読込間の隙間。確定版はapproved file-set再hashとimmutable captureに統一。sourceとsnapshot試験を照合。

先行perception fixtureのtexture.filePath / binaryAssetRef不一致は実装担当が修正済み。正式検証はvalid base→apply後validator fail=0の確定fixtureだけを使った。

## 独立実行結果

全commandのworkdirは対象repo。正式独立実行は2026-09-26 21:20 JST以降。sandboxの子プロセス制約によりhost実行が必要な試験はrequire_escalatedで実行した。

| command / 確認 | 結果 |
| --- | --- |
| pnpm exec vitest run --root apps/authoring-host src/material-roundtrip.test.ts src/material-candidate-apply.test.ts src/run-material-command.test.ts src/material-candidate-operation.test.ts src/material-comparison-viewer.test.ts src/material-transaction-failures.test.ts src/material-atlas-stale.test.ts src/run-authoring-host-command.test.ts src/cli-cross-process.test.ts src/run-render-view-command.test.ts src/validate-package-command.test.ts | PASS 11 files / 32 tests |
| pnpm exec vitest run packages/ai-interface | PASS 19 files / 124 tests |
| pnpm run typecheck:authoring-host | PASS |
| pnpm run typecheck | PASS |
| pnpm run check:deps | PASS |
| node scripts/check-source-organization.mjs --source-root apps/authoring-host | PASS |
| 同 --source-root packages/ai-interface | PASS |
| 同 --source-root packages/authoring-core | PASS |
| pnpm run check:source | FAIL、既知の所有外 apps/runtime-player/src/main/physiology/index.ts barrel違反のみ |
| git diff --check -- packages/ai-interface packages/authoring-core/src/index.ts apps/authoring-host/src/run-authoring-host-command.ts | PASS |
| 実Node CLIを別processでstdin / --command-file inspect | 両方exit0、success、saved=false、candidate=applied、stderr空 |
| public空ok responseの独立probe | safeParse=false |
| Editor本体Node-backed storage readerによる独立再読込 | add/replaceともrevision12、binary4、warnings0、承認済fingerprint一致、読込前後bytes不変 |
| pnpm --filter @private-2d-rigging-lab/editor run electron:build | PASS |

156 tests合計。全repo総当りは実行していない。全体source guardをPASSとはしない。

## 独立artifactと保存再読込

artifact root: C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-2/review。

- add-4gdd8z/evidence.json と package/: 独立add往復の全response、render artifact、apply、validator。
- replace-MvW2yc/evidence.json と package/: 独立replace往復の同証拠。
- editor-storage-reopen.json: Editorの NodeFsBackedDirectoryHandle → openEditorWorkspace → 実workspace-fs-store によるread-only再読込。Electron IPCとdirectory dialogのみを介さず同consumerを実行。両方にCandidate rigを確認、addは新Drawableを含む3件、replaceはID維持の2件。
- cli-independent.json / inspect-command.json: 実Node CLI stdin / command-fileの独立結果。

目視した実PNG（いずれも128×128、自作synthetic技術fixture）:

- add-4gdd8z/state/material-artifacts/placement-alpha-preview-0fb44546-fab0-4df2-959d-7a68ec0f39a5.png
- add-4gdd8z/state/material-artifacts/working-mesh-rig-preview-d5b343d6-5173-4141-beb6-b422b283f660.png
- replace-MvW2yc/state/material-artifacts/placement-alpha-preview-6357bc54-e36b-44df-8a49-3997a7a72799.png
- replace-MvW2yc/state/material-artifacts/working-mesh-rig-preview-d6e6259f-d19b-4551-be76-5b67214b17e0.png

同位置比較HTML:

- add-4gdd8z/state/material-artifacts/comparison-cbce514a-8e28-42a1-b26d-ba976a662968.html
- replace-MvW2yc/state/material-artifacts/comparison-4358b275-8352-4fab-ad37-4cac0ba43260.html

各evidence.jsonから絶対画像・sidecar pathとcandidate/versionへ辿れる。PNGの目視は素材の自然さの合格を意味しない。

## Editor / browser と未検証

現sourceのElectron build成功後、専用user-data-dirでEditorを起動し、Computer Use list_windowsが「Private 2D Rigging Lab」window id 67241772を返した。次のsky.get_window / get_window_stateで **Computer Use app approval timed out**。通常Open WorkspaceのUI操作、canvas表示、編集可能性の画面上確認は実施できなかった。アプリ起動成功とUI読込成功を混同しない。root指示に従い同じ長時間承認待ちを繰り返していない。

比較HTMLはsourceとartifact・画像寸法・埋込PNGのテストを確認したが、ブラウザ上のBase/Candidateボタンの実クリックは未実施。Editor storage readerの成功もこのUI証拠の代替PASSには数えない。

未検証: Editor UI通常再読込、比較viewer実操作、実素材への適用・造形、Accepted User Gate、OS crash durability、abandoned-lock自動回収。rollback自体のfilesystem故障時には原本backupを保全するが、正常なbase pathへ必ず復元できると主張しない。親はUI残件を保持してユーザー制作へ進む判断を行う。

## 裁量

新しい特殊package形式を作らず、既存OperationRequestをeditMaterialCandidateへ包む方式、既存capabilityとhost rendererを使う方式、rest/evaluation sidecar二層、候補基準baseの永続snapshot、stateDirectoryに依存しないpackage lockは合意範囲内。不要なlive Editor bridge、新GUI編集画面、旧rig自動移行は追加していない。

## 確定版 SHA-256

以下はGnome提示24対象を独立Get-FileHashで照合した作業tree実bytes。別版へこの判定を流用しない。

| path | SHA-256 |
| --- | --- |
| packages/ai-interface/src/ai-material-command.ts | ba6e8b64f09637e0093942d6cf4b7d18511f0f4cdb8d9e9ef95c60856dacba7d |
| packages/ai-interface/src/ai-material-command.test.ts | d7587ed34ee346a36369a21599cb22a4693c1c5ec59bb8e1ac91e94dbb626609 |
| packages/ai-interface/src/index.ts | 12a749a7818015118a605f7aec7b7a82e30f1ed98ce5342ae5da6d0566a22b40 |
| packages/ai-interface/src/ai-command-name.ts | 78c74925cc887239b204c12ba97455896b29f87ce1994fb77e14ccbc7d786e3d |
| packages/ai-interface/src/ai-command-payload.ts | b5251aa2b302d0941011dd9ee8d5ec078962448d711a05081ca7c8d5f53b0b1a |
| packages/ai-interface/src/ai-command-response-payload.ts | 36c5080b1a18e8b5306407ca2d8f4a9d348af2bb2a477c64710e21c2d8b32bfe |
| packages/ai-interface/src/ai-command-response.ts | 1dc5d79e418728aff10726f356c67568f39362d87d8f9eb092697c47a4a6d562 |
| packages/ai-interface/src/ai-command-executor.ts | d20bcc9026de802991ebb98d2ea681a0e4e6b65e61e6be656d80e7026fe9022f |
| packages/authoring-core/src/index.ts | 6a008831852109cc412f71af562028b0e3f36e685b81899185b7c623a396e332 |
| apps/authoring-host/src/run-authoring-host-command.ts | e73f67a28496a45e9a9a2ed2be1bc4d68ff33315c021f255370a98cbab3b45b7 |
| apps/authoring-host/MATERIAL_COMMANDS.md | bb448f709e93d2e0cc775eabd0fdf440251cf6389ff19d59ddb0b1c9ba0ee366 |
| apps/authoring-host/src/run-material-command.ts | 8c1209c2c7f822c2b661971310b523a47d4590aefabbf34b0961d48a2b24018b |
| apps/authoring-host/src/run-material-command.test.ts | cd24c012092bcb309d97399f789f79ffdd96bd47ead55a74b75a1499c7cea53a |
| apps/authoring-host/src/material-package-transaction.ts | ec9ddee4e29503af14c6d5934add1f0ef50c222889d4822e7ac4470a701b974b |
| apps/authoring-host/src/material-candidate-apply.ts | 3eb1faa7ca8013ebf8f109a65b67c4b7653ac207075004e3f0caa1068a688802 |
| apps/authoring-host/src/material-candidate-apply.test.ts | 4faf5967be80f533be92689254a133b05d1327f39162daa292320dd1967ed844 |
| apps/authoring-host/src/material-candidate-operation.ts | 994fcaf557321f578d098e5e13cdd1d240d3b7579db69fa0e7b64dc6dc04221e |
| apps/authoring-host/src/material-candidate-operation.test.ts | 6b82fd6d9e7b3461026819678a1461824f8bbee3d4cc1ede4edce9f680011388 |
| apps/authoring-host/src/material-comparison-viewer.ts | c31c7d5077189c2ccb32779c56213a7a89176990f067542d56f70ca7ebfeca3a |
| apps/authoring-host/src/material-comparison-viewer.test.ts | da3261059b3a30d11ca21279d4dbb20b64851f0ad9a7740668ae871744848393 |
| apps/authoring-host/src/material-roundtrip.test.ts | 032e1478af4aa8f759a6711a6f7bacfba1734373a7464c5291efdf819ae5c77a |
| apps/authoring-host/src/material-command-test-fixtures.ts | d9b98b7a04bc1b7b307dff96564d266659134db859028aaf0388ed75a46e3187 |
| apps/authoring-host/src/material-transaction-failures.test.ts | 00cea1e1fbe8298c46b1fd116c23548d2d1073539768ace5f93e54729f831923 |
| apps/authoring-host/src/material-atlas-stale.test.ts | 84652eb8931475ebc83d9f2ea77d8d32e14bed6f4dfa20fbb0aaeaf76339ca58 |

