# レビューレポート: 素材インターフェース共通契約

- 判定: 技術PASS（準備domainのみ）。
- 最終レビュー: Loop 3 / 上限5。Loop 1でR1-R3、Loop 2でR4を指摘し、最終版で全て解消した。
- Reviewer: 独立Review-Sylph。Gnome/Orchとは別コンテキスト。source実装・修正はしていない。
- 対象repository: C:/workspace/remie/code/ai-native-live2d-editor。基準HEAD a6bfc0429e642cd4c047f154d834cbd3c26ca72c。
- Accepted User Gateはwave planを正として変更していない。本PASSは制作結果や自然さに対するユーザーの判断を代行しない。
- PASS後の事務更新: domain契約のstatus記載のみ更新し、契約内容/sourceは不変。source 11件のhash不変と更新後domain hashを再照合した。completion/reviewの状態・hash表も整合更新。

## 根拠と範囲

basisは material-interface-wave-plan.md の共通契約1-10、material-authoring-interface.md、material-ingestion-research.md、discussion/_conventions.md、指定implementation-orchestration skill。既存contracts primitive/ID/diagnostic、package-formatのmodel/texture/binary/source schema、authoring session・既存mutation、operation/AI export入口、hostの保存とresponse境界を限定照合した。旧Astra rig成果は参照していない。

新規material source 7件・tests 3件、既存contracts/index.tsの7 export追加、domain契約文書を実読した。新規fileはuntrackedのためgit diffだけに依存せず実file全文を確認。既存indexのdiffは追加exportのみ。completionの検証記録・hash表も照合した。A/B/C業務実装、実素材適用、browser/Editorは対象外。

## 設計適合

| 共通契約 | 確認内容 |
| --- | --- |
| 1 座標 | pixel-edgeとrest-stageをliteralタグで分離。stageのcanvas-y-down-v1を既存schemaで確認。正の有限等方scaleとtranslationのみを表現する。 |
| 2 余白とcontent | image全体、人工storage contentInset、alpha tight bboxを区別。異なる解像度/透明余白のfixtureが同じstage alpha矩形になる一方、画像全体幅は異なる。 |
| 3 取得 | SourceContextはsource texture/context composite、mesh/Part/rig/mask/variant、写像を持つ。completed extractは正しい両artifact、path、source context、base版が必要。 |
| 4 候補とbytes | 永続candidate ID、base ID/revision/fingerprint、元fileとRGBAのhash、寸法/alpha/rest/placement/intentを保持。実bytesの長さ・alpha tight bbox/countを純粋validatorで照合。hash算出とfs/decodeは後続host責務として明記。 |
| 5 置換 | 論理Drawable維持、対象直属geometry reset集合、既存deformer保持、共有削除拒否を明示。正確なreset集合/source mapping/対象外保持はBがgraphから検証する責務として固定。 |
| 6 再構築 | workingは通常model package。impactは保持/reset/生成/共有/拒否対象を返す。Bの共有削除guardをCの通常rig command経路にも適用する責務を明記。 |
| 7 新規追加 | Part構造挿入とrig所属を分離。maskBindingsのroleでmaskSource/targetを明示。ID/参照実在・alphaを描画するmesh構築はBの後続検証。 |
| 8 比較 | placement全alphaとworking実mesh/rigをkind/coverageで区別。artifact pixel→stage写像はviewportと整合し、素材placementと別field。preview結果は専用artifact/sidecarと候補・base・working版を照合。 |
| 9 反映 | base/working/applied版を区別。approvalは候補revisionとworking fingerprintへ拘束。stale/terminal/未承認applyを拒否。編集時承認失効、fingerprint v1、候補保存先分離とCの競合検証を文書で固定。 |
| 10 出力 | operation/candidate ID、base版、状態、変更対象、絶対画像/sidecar path、機械診断を保持。未完了は診断必須・変更なし。baseChangedはcompleted applyだけ。 |

contractsは既存ID/primitive/TargetRef/Diagnosticを再利用し、package-format/authoring-core/fsへの逆依存を追加しない。format側の小さいprojectionをcontractsへ定義する裁量は合理的。暗号digest計算とgraph横断参照検証をschema parseの成功と同一視しない制限が明記されている。

## 指摘と修正確認

| 指摘 | 最終確認 |
| --- | --- |
| R1: extract成功がsource contextなし・誤kind画像1枚で通る | sourceContext接続、base版照合、元素材/contextの両artifact/path必須化。欠落/別kind/版不一致のnegative testsを確認。 |
| R2: addのmaskRelationIdsだけではmask側/target側が不明 | maskBindings={maskRelationId, role}へ変更。roleなし拒否testと文書を確認。 |
| R3: sidecarで素材placementと出力画像写像が混在 | imageToStageとmaterialPlacementを分離。viewportの縦横倍率/原点と出力写像を照合するvalidatorとnegative testsを確認。 |
| R4: preview成功がsource-textureだけで通る | previewContext必須、preview専用kind、returned path、candidate ID/revision/base版、working版/hashを照合。未作成working/別版等のnegative testsを確認。 |

R1とR4は独立のread-only実行probeで修正前の不正成功を再現した。最終版では追加されたnegative testsを含め独立実行PASS。未解消の準備scope指摘はない。

## 独立検証

すべて明示workdirを対象repositoryに設定。最終限定vitest実行は2026-09-26 14:22 JST付近。最初のsandbox実行はesbuild spawn EPERMで起動不可となったため、承認されたhost実行で検証した。

| command | 結果 |
| --- | --- |
| pnpm exec vitest run packages/contracts/src/material-image.test.ts packages/contracts/src/material-candidate.test.ts packages/contracts/src/material-operation-result.test.ts | PASS: 3 files / 27 tests (9+4+14) |
| pnpm run typecheck:root | PASS: tsc --noEmit、exit 0 |
| pnpm run check:deps | PASS: Dependency guard passed |
| node scripts/check-source-organization.mjs --source-root packages/contracts | PASS: Source organization guard passed |
| git diff --check -- packages/contracts/src/index.ts | PASS。LF/CRLF通知のみ |
| pnpm run check:source | FAIL: apps/runtime-player/src/main/physiology/index.ts の既存barrel-only違反1件 |
| completion hash表とGet-FileHash SHA256の独立照合 | 12 / 12一致 |

全体source guardの失敗fileはgit diff/statusに差分がなく、今回変更から発生していないことを独立確認した。全体guard PASSとは報告しない。所有外fileを修正していない。

## 所有境界と後続の受領条件

domain契約文書のA/B/C予約moduleに重複はない。C所有の既存共有file14件が実在することを確認した。Aはhost画像/decode/store/placement、Bはpure core build/mapping/reset/impact、CはAI/CLI/通常rig routing/apply/viewer/save統合を所有する。A/Bは既存public registry/indexを変更せず、Cが統合する。契約変更はroot/Orch-Contractへ調整する。

後続検証として、A/Cは実digest計算と保存後fingerprintの一致、Aはdecode/対応点fit/描画artifact、Bはgraph実在/正確なreset集合/共有参照/入力不変、Cは実renderer・stale競合・承認失効・保存再読込・Editor互換を実証する必要がある。これら業務未実装を本準備domainの不合格理由へ戻さない。OS障害までの原子性、実素材の自然さ、User Gateの合格は確認していない。

## 最終レビュー対象SHA-256

実作業treeのbytesを独立採取。completionの12件と一致。この表のsourceまたはdomain契約の内容が変わる場合は、関連再検証が必要。

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

