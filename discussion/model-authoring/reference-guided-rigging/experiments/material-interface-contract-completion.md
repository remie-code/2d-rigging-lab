# 素材共通契約 準備completion

状態: 技術独立Review PASS（Loop 3）受領済。rootの準備受領待ち。User Gate判定は未実施。
日付: 2026-09-26。作業repo: C:/workspace/remie/code/ai-native-live2d-editor。
基準HEAD: a6bfc0429e642cd4c047f154d834cbd3c26ca72c。既存dirtyを保持。commitは作成していない。

## 実装内容

[共通契約/所有一覧](../material-interface-contract.md) に詳細を固定した。
[独立レビューレポート](../../../implementation/reviews/reference-guided-rigging/material-interface-contract.md) はLoop 3の技術PASS、独立27 tests、全12対象hash照合を記録している。
新規sourceは packages/contracts/src/material-{coordinates,image,intent,candidate,artifacts,operation-result,contract-fixtures}.ts。
新規testsは packages/contracts/src/material-{image,candidate,operation-result}.test.ts。
既存source変更は packages/contracts/src/index.ts の7件追加exportのみ。
文書は material-interface-contract.md とこのcompletionのみ。plan/map/accepted decisions、業務intake、モデルmutation、CLI、viewer、既存他者fileは変更していない。

pixel-edgeとrest stageをタグ分離、正の等方scale＋translationを有限値検証。RGBA descriptorと実bytesの寸法/長さ/alpha tight bboxを照合。candidateを状態別schemaにし、approvalを候補revisionとworking packageのID/revision/content fingerprintへ拘束。失敗/未完了とbase更新成功が矛盾しないresult validatorを追加した。

A/B共用fixtureは自作のcompact4×4とwide10×8。解像度/透明余白/画像全体幅が異なるが、明示写像で同じstage alpha rectになる。PNG decode/fit/intakeアルゴリズムは含めない。hashはfixture bytesに対してtestで検算する。

## レビュー修正履歴

Loop 1のR1-R3はLoop 2で解消確認。Loop 2のR4もLoop 3で解消し、独立Review技術PASSを受領した。
- R1: completed extractのsourceContextを必須化。元source-textureとcontext-compositeの両artifactの絶対path/sidecarをresultと照合。欠落、別kind、版不一致のnegative tests。
- R2: addのmaskBindingsはmaskRelationIdとrole=maskSource/targetを必須とし、方向不明なmembershipを拒否。
- R3: sidecar.imageToStageを出力PNGのpixel-edge→stageとしてviewportと照合。素材配置はmaterialPlacementへ分離。誤ったscale/欠落のnegative tests。

- R4: completed previewに専用artifactとinline coordinate sidecarを必須化。candidate ID/revision/base版、working previewの作業package版/hash、returned artifacts内のpath一致を検証。source画像だけ・sidecar欠落・別候補・別作業版・working packageを持たないstateを拒否するtestsを追加。

## 実行した検証

全て明示workdir=C:/workspace/remie/code/ai-native-live2d-editor。
最終source検証 2026-09-26 14:21 JST付近。

| command | 結果 |
| --- | --- |
| pnpm exec vitest run packages/contracts/src/material-image.test.ts packages/contracts/src/material-candidate.test.ts packages/contracts/src/material-operation-result.test.ts | PASS、3 files / 27 tests (9+4+14) |
| pnpm run typecheck | PASS、root tsc --noEmit、exit 0 |
| pnpm run check:deps | PASS、Dependency guard passed |
| pnpm run check:source | FAIL、既存所有外 apps/runtime-player/src/main/physiology/index.ts のbarrel-only違反1件 |
| node scripts/check-source-organization.mjs --source-root packages/contracts | PASS、Source organization guard passed |
| git diff --check -- packages/contracts/src/index.ts | PASS（LF→CRLF通知のみ） |

check:source失敗fileはgit diff空、HEADにも同内容が存在することを確認。素材契約に起因する失敗として扱わず、既存全体guard failureを隠さない。対象外修正はしていない。テストは実制作や自然さの検証ではない。browser/Editor操作はこの準備domainで行っていない。

## 最終対象SHA-256

hashは作業treeの実bytes。独立Reviewはこの版を対象とする。将来の改行正規化もhashを変えるため、内容変更時は再採取する。

| path | SHA-256 |
| --- | --- |
| packages/contracts/src/material-artifacts.ts | d859718e3372818a5def39115532da382f05eb2fbac9a8713f75a891bb9bc27f |
| packages/contracts/src/material-candidate.test.ts | 7eb3f86aa72fd6d2ef8ace898e3cec37a44d31721a71baeb12823405f9dd2195 |
| packages/contracts/src/material-candidate.ts | 4aea209f11355f825864bc91881265ae9faeccad1d7c6284b12b9b6385550375 |
| packages/contracts/src/material-contract-fixtures.ts | 9b6762cc377644dee3c872b34aee4d6ebb6b3398963c3d2618ec0abfac76ac96 |
| packages/contracts/src/material-coordinates.ts | 07a4029544f0022bed6b69e3a6315227941f561c39034835a16b86501d255b2e |
| packages/contracts/src/material-image.test.ts | ea06947bd9bf60fdefd3a7989088cdf7b3f61a74b7ac0d73d23b074b7de34bed |
| packages/contracts/src/material-image.ts | 96860eca30848056a5b95f86b4a7934fea26286934d3d42518cdc2b29bc420e0 |
| packages/contracts/src/material-intent.ts | 345fdd275340b44b0269165f67069061346cc39f22c9686e6a5ca054fbdfde52 |
| packages/contracts/src/material-operation-result.test.ts | 1d243b0daaa43a246a69c3fe4b039078c285586b7e2a138920cdc179195227ab |
| packages/contracts/src/material-operation-result.ts | 99aae73068a857a759f6a7ebbc20c36a59346cce7ea7f18989954937fc034f56 |
| packages/contracts/src/index.ts | 6fd39d942ac390342277bed88c2208544f6fec290b58d71e506c4a827a1f7c92 |
| discussion/model-authoring/reference-guided-rigging/material-interface-contract.md | 7a7f2069560d690cde21b6ef28bf0aaee4a08356cfb049f49cdf7bc91b96ad73 |

## 技術裁量

- 既存contractsのID/primitive/TargetRef/Diagnosticを再利用し、package-formatへの逆依存は追加しない。
- schemaとvalidatorを意味別6moduleに分割し、public fixtureを別moduleにした。新packageなし。
- hash算法・対象範囲をbyte-exact package全regular fileで固定。候補とworkspace stateはbase外へ置く。実hash算法はA/Cの後続実装。
- storage contentInsetとalpha bbox、source placementとartifact mappingを別概念として明示。
- approval/stateの綴りとnegative validation、mask role、structural sibling指定はplan意味を保つ技術具体化。
- Bの共有削除guardをCの通常rig操作導線にも適用する責務を明記。

## 残件・制限

独立Review技術PASSは受領済。rootの準備受領、root所有map登録は未完了。A/B/C業務module、decode、fit、fingerprint算出、graph referential validation、clone mutation、renderer、保存再読込、stale競合guard、実素材/User Gateは後続wave。
共通validatorは暗号hashの書式を検査するがdigestは算出しない。graphの参照実在や正確なreset集合、共有関係はBの責務。OS障害までのdisk原子性は主張しない。
