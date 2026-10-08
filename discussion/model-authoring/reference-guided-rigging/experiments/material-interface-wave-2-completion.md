# 素材インターフェース Wave 2 C completion

状態: 正式独立Review Loop 1の技術PASS（headless統合・保存互換の範囲）をOrch受領。root受領待ち。Editor UI読込・比較viewer実操作は未検証、User Gate未実施・未判定。
2026-09-26。対象repo: C:/workspace/remie/code/ai-native-live2d-editor。基準HEAD: a6bfc0429e642cd4c047f154d834cbd3c26ca72c。既存dirtyを保持、commitなし。

Basis: [wave plan](../material-interface-wave-plan.md)、[共通契約](../material-interface-contract.md)、[用途](../material-authoring-interface.md)、[静的調査](../material-ingestion-research.md)、Wave 1 A/B completionと独立Review。

## 担当と変更範囲

Orch-Sylph /root/material_wave2が調整し、別Gnome /root/material_wave2/gnomeがC source/tests/CLI docs、別Review-Sylph /root/material_wave2/reviewが独立評価を担当。Orch自身はsourceを実装しない。implementation-orchestrationとdiscussion-management、discussion/_conventions.mdに従う。適用AGENTSは祖先/対象repo（node_modules除外）に検出なし。旧Astra rig成果は参照せず、second-rigging-6-solの実素材/実rigと既存8769 previewを変更していない。

C所有24ファイルを追加/変更。新規はai-material-command schema/test、hostのrun-material-command、candidate-apply、candidate-operation、comparison-viewer、package-transaction、関連test/fixture、MATERIAL_COMMANDS.md。既存変更はai-interfaceのname/payload/response/executor/index、authoring-core index、host dispatcher。A/B source、共通contracts、root所有plan/map/decisionsは変更なし。

CLI利用: [MATERIAL_COMMANDS.md](../../../../apps/authoring-host/MATERIAL_COMMANDS.md)。正確な24ファイル一覧とSHA-256は本書末尾。Gnome確定版をOrchも24/24一致確認した。

## 実装事実

10個の公開コマンドでextract/register/place/inspect/preview/build/edit/approve/apply/discardを接続した。既存--command-file/stdin envelopeを再利用する。editMaterialCandidateは既存OperationRequestをworking candidateへ向け、deep clone上の通常operation成功とB guard許可の両方を要求する。内容変更時にcandidate revisionを進め、approvalを失効させる。

package path固有の隣接lockをすべてのhost commandで共有し、異なるstateDirectoryからの通常base操作とcandidate applyも排他化する。保存済みbaseをimmutable captureから開き、fingerprintとsessionを同じbytesへ対応させる。apply直前に候補state/revision/approvalとworking exact bytesを再照合する。base変化はstaleとして候補を残す。

applyは通常保存形式のstagingとbase directory交換を行い、candidate pointer保存失敗ではpointerとbaseの両方を復元する。成功後のcleanup失敗はcompleted結果を未反映へ変えない。rollback自体にI/O失敗があった場合は元backupを削除せず復旧pathをエラーに残す。OS crash durability/放置lock回収を保証しない。

全alpha placement previewと本物rendererによるworking mesh/rig previewを区別し、同viewportのBase/Candidate切替HTMLを出力する。material sidecarは素材のrest基準、既存render sidecarは実評価parameter/variantを示す。画像・sidecar・比較viewerは絶対pathで返す。承認済みworking bytesとsaved modelを対応させ、source mapping/atlas staleを検証する。

completedのみexit0、rejected/pendingはexit2、failedはexit1。package busyはmaterial.packageBusyの機械可読rejection。completed applyのみsaved=true/baseChanged=true。公開response schemaはcommand/operation/state/statusの矛盾と空成功payloadを拒否する。

## 暫定レビューでの修正

正式Loop 1前に独立Reviewが実sourceと故障注入から次を検出し、GnomeがC内で修正した。

- 成功後cleanup例外が結果をfailedへ覆す問題と、rollback失敗後に唯一backupを削除する問題。
- public responseが空の成功payload、command/result.operation不一致等を受理する問題。
- package lock競合がunknown/error exit1へ落ちる問題。
- A storeのcurrent pointer更新後lock cleanup失敗でbaseだけ復元され、candidateがappliedのまま残る問題。public applyで独立再現し、旧pointer復元を追加した。
- apply時のworking file-set再hashと、比較元base snapshotのhash/read対応。

試験fixtureの既存perception seedにtexture.filePathとbinaryAssetRef.packageRelativePathの不一致を発見した。C fixture生成時に一致させ、開始baseとapply後を実validatorで確認した。先行fixtureを正式validator証拠に数えない。

## Gnome確定版の検証結果

すべてworkdir=C:/workspace/remie/code/ai-native-live2d-editor。sandboxのesbuild起動等が阻害された場合は許可済host実行を用いた。

| command | 結果 |
| --- | --- |
| pnpm exec vitest run --root apps/authoring-host src/material-roundtrip.test.ts src/material-candidate-apply.test.ts src/run-material-command.test.ts src/material-candidate-operation.test.ts src/material-comparison-viewer.test.ts src/material-transaction-failures.test.ts src/material-atlas-stale.test.ts src/run-authoring-host-command.test.ts src/cli-cross-process.test.ts src/run-render-view-command.test.ts src/validate-package-command.test.ts | 11 files / 31 tests PASS |
| pnpm exec vitest run --root apps/authoring-host src/material-candidate-apply.test.ts | 同revision discard競合1件追加後6 tests PASS。上行との重複除外合計32 tests |
| pnpm exec vitest run packages/ai-interface/src | 19 files / 124 tests PASS |
| pnpm run typecheck:authoring-host | PASS |
| pnpm run typecheck | PASS |
| pnpm run check:deps | PASS |
| node scripts/check-source-organization.mjs --source-root apps/authoring-host --source-root packages/ai-interface --source-root packages/authoring-core | PASS |
| git diff --check（対象変更） | PASS |
| Node実CLI --command-file / stdin inspect | 両方exit0 |
| pnpm run check:source | FAIL: 既知所有外 apps/runtime-player/src/main/physiology/index.ts barrel-only違反のみ |

add/replaceの開始baseとapply後通常再読込に対するruntime/binary validatorはfail=0。source mapping、renderer、mesh/rig編集、approval失効、同revision競合、共有guard、discard/stale/base不変、故障時復元、atlas staleを試験した。実素材の自然さを評価する試験ではない。

## 正式独立Reviewの受領

[独立Review report](../../../implementation/reviews/reference-guided-rigging/material-interface-wave-2.md)をOrchが全文確認し受領。正式Loop 1で技術PASS（headless統合・保存互換）、未解消の修正必須指摘なし。暫定指摘は確定版で解消した。sourceの再変更はない。

独立実行はhost全11 files / 32 tests、AI interface 19 files / 124 tests、合計156 tests PASS。host/root typecheck、deps、担当3範囲sourceguard、対象diff checkがPASS。全repo sourceguardは既知の所有外physiology/index.ts違反のみFAIL。24 source hashはGnome/Orch/Reviewで一致した。

add/replaceの独立往復ではruntime/binary validator fail=0、128×128の実renderer PNG4枚をview_imageで確認。Editor本体のNodeFsBackedDirectoryHandle→openEditorWorkspace→実workspace-fs-storeを通すread-only再読込でも、両モデルrevision12・binary4・warnings0、承認済fingerprint一致、読込前後bytes不変、Candidate rig保持を確認。これはElectron IPC/directory dialogを介さない同consumerの検証であり、画面操作の成功とは別。

独立artifact root: C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-2/review。

- add-4gdd8z/evidence.json と package/：独立追加往復、画像/sidecar/viewer、apply、validator。
- replace-MvW2yc/evidence.json と package/：独立置換往復の同証拠。
- editor-storage-reopen.json：Editor本体storage readerの独立再読込結果。
- cli-independent.json / inspect-command.json：実Node CLI stdinとcommand-fileの両方exit0/saved=false/candidate=applied、stderr空。

同revision競合、package busy、空success応答拒否、approval失効、pointer/base復元を含む故障4経路、旧atlas staleを独立確認。OS crash durability、abandoned lock自動回収は未検証。

## 永続artifacts

一覧: C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-2/implementation/verified-artifacts.json。

- add package: C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-2/implementation/add-82CGHu/package
- replace package: C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-2/implementation/replace-6hsl3B/package

各package siblingのevidence.jsonにextract/placement/working/apply response、画像/sidecar/viewer絶対path、validationを保存した。自作synthetic fixtureであり、rootの実素材制作物ではない。llm-workspaceはgitignoredのためlocal evidenceである。

## 裁量と残件

editMaterialCandidateで通常OperationRequestを包む公開routing、既存capability再利用、素材rest/評価poseの二層sidecar、package隣接lockは共通契約内の技術裁量。未所属control/parameterの既存編集/削除はB guardのfail-closed制約を維持し、create→bind/associate→editを案内する。新素材権利はneeds_review/redistributionAllowed=falseを維持する。

Gnome本人のbrowser/Editor実操作は未実施。独立Review担当は現source Editor build成功と専用Electron起動（PID28612/window67241772、Private 2D Rigging Lab）まで確認した。sky.get_window/get_window_stateのComputer Use callが「Computer Use app approval timed out」で終了したため、通常Open WorkspaceのUI読込・画面上の再読込は未実施/未検証。同じ長時間承認待ちは繰り返さず、root指示でこの残件を維持する。headless/package reopen試験はUI確認の代替PASSではない。正式Review Loop 1はheadless統合・保存互換の確認範囲で技術PASS、未解消の修正必須指摘なし。UI実確認へこの判定を拡張しない。比較viewerのブラウザ実クリックも未実施。専用EditorプロセスPID28612はReviewが終了済み。Accepted User Gate、実素材の造形・配置・再riggingとユーザー判断はrootの責務で未実施。OS crash原子性/abandoned lock回収は未検証。

## 確定版SHA-256
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



