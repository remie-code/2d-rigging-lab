# 素材インターフェース Wave 1 B 独立レビュー

判定: **技術 PASS（正式 Loop 1）**。2026-09-26。User Gate は未判定。実装と別コンテキストの Review-Sylph によるコード照合・独立実行結果であり、造形の自然さや制作往復のユーザー受領を代行しない。

## 対象と根拠

作業 repo: C:/workspace/remie/code/ai-native-live2d-editor。基準 HEAD: a6bfc0429e642cd4c047f154d834cbd3c26ca72c。既存 dirty を保持し、source/tests は変更していない。本書だけをレビュー担当が作成した。旧 Astra rig 成果は参照していない。

Basis: [wave plan](../../../model-authoring/reference-guided-rigging/material-interface-wave-plan.md)、[共通契約](../../../model-authoring/reference-guided-rigging/material-interface-contract.md)、[用途](../../../model-authoring/reference-guided-rigging/material-authoring-interface.md)、[静的調査](../../../model-authoring/reference-guided-rigging/material-ingestion-research.md)、[準備 completion](../../../model-authoring/reference-guided-rigging/experiments/material-interface-contract-completion.md)。discussion-management と discussion/_conventions.md に従い、実装事実・実行結果・後続事項を分離した。

レビュー対象は packages/authoring-core/src/material-*.ts の10ファイル、追加割当された mesh-generation.ts の無padding寸法解決変更、packages/validator-core/src/material-candidate-integration.test.ts の計12ファイル。既存 public index/registry/validator production は変更なし。mesh-generation の既存source差分は、宣言済み raster dimensions を優先し、未宣言時だけ従来の stage bounds fallback を残す限定変更である。

## 所見と解消確認

正式 Loop 1 の確定版について blocking finding はない。確定前の準備レビューで次を共有し、最終版で解消を確認した。

- scale≠1 の候補で既存再meshの無padding経路が stage bounds を pixel寸法に使っていた。texture.dimensions 優先へ限定修正され、拡張画像・scale=3 の alpha-aware-rgba 再mesh試験を独立実行した。
- 初期テストの mask fixture に self-mask があり、schema parseだけでは参照整合の根拠が不足していた。validator側に、有効なbaseを実validatorで確認してからadd/replace後を再検証する2試験を追加した。依存境界を緩めず検証を配置した。
- 共有親の下の対象専用controlを既存deleteRigControlで削除すると、親の対象branch接続変更までguardが拒否していた。対象専用branch以外のedge順序・親・変形fieldを固定したprojectionで比較するようになり、専用control削除許可と共有pivot変更拒否を確認した。
- addのimpactが変更前graphしか見ず、新たなrig共有を報告しなかった。add後graphからsharedReferencesを再計算し、他Drawableを含むcontrolへの追加で報告されることを確認した。

## 設計・契約との適合

- buildは最初のawaitより前にsession、candidate、normalized imageをdeep cloneする。RGBA SHA-256、descriptor、候補state、base ID/revision、alphaを照合する。失敗時にworkingSessionを返さず、入力session/bytesへ部分変更を残さない。遅いrig/mask/sibling失敗、hash/descriptor/stale/transparent入力の試験を確認した。
- addは明示Partの直接childへのbefore/after/first/last挿入を既存Part順序関数で扱い、構造順とdraw orderを同期する。rig membership、向き付きmask binding、visibility、opacityを反映する。既存rig graphの単一直属親規則に従い、重複または複数の直接parent指定を拒否する。
- replaceはDrawable ID、mesh ID、Part位置、名前、visibility/order、mask/variant、既存rigを維持する。新source/layer/provenance/rights/texture/binary refsを整合登録し、旧mappingから対象だけを外す。共有旧texture/bytesを書き換えない。
- contentInsetを人工paddingとして扱い、contentのpixel edgeをscale/translationでstageへ写す。初期meshはcontent全体の編集可能なgridで、旧meshへ新alphaをclipしない。拡張画像・非1 scale・contentInset・UV・通常再mesh/vertex編集の試験を確認した。旧key移行や自動造形は追加していない。
- reset集合は実graphの対象直属mesh/drawable geometry keyformsから求め、宣言集合の完全一致を要求する。重複、不足、opacity等の余分なkeyを拒否し、他target/shared keyの指定も集合照合と影響分析で拒否する。既存control keyformsは保持する。
- guardはbefore/afterの実差分と、nested control、1D/2D keyform parameter逆参照、dynamics output経由の影響Drawableを調べる。共有control/key/parameter削除を拒否し、影響IDを返す。対象外geometry、構造、mask、bytes、source等を保護する。対象専用controlの作成・bind・編集・削除は既存mutationを用いた試験で確認した。
- 実validator integrationでは通常package schema、runtime evaluation、binary asset index/bytesを用い、addと共有textureからの拡張置換を検証した。参照validatorは緩和していない。rightsは契約がlicense grantを含まないためneeds_reviewとして記録する。

## 独立実行証拠

すべて明示 workdir=C:/workspace/remie/code/ai-native-live2d-editor。確定版の実行は2026-09-26 18:45–18:46 JST付近。

| command | 独立結果 |
| --- | --- |
| pnpm exec vitest run packages/authoring-core/src/material-candidate-build.test.ts packages/authoring-core/src/material-impact-analysis.test.ts packages/validator-core/src/material-candidate-integration.test.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-boundary-margin.test.ts packages/authoring-core/src/dependency-boundary.test.ts | PASS、実在5 files/96 tests。指定中のmesh-generation-boundary-margin.test.tsは存在せず選択されなかったため、次行で正しいmargin testを補完 |
| pnpm exec vitest run packages/authoring-core/src/mesh-generation-coverage-margin.test.ts | PASS、1 file/5 tests。合計6 files/101 tests |
| pnpm run typecheck | PASS、tsc --noEmit |
| pnpm run check:deps | PASS、Dependency guard passed |
| node scripts/check-source-organization.mjs --source-root packages/authoring-core | PASS |
| node scripts/check-source-organization.mjs --source-root packages/validator-core | PASS |
| git diff --check -- packages/authoring-core/src/mesh-generation.ts | PASS |

最初の暫定版Vitest sandbox実行はesbuildのspawn EPERMで起動前に失敗した。その後は承認済みhost実行で独立検証を完了した。暫定94 testsの結果は確定版101 testsの代わりに数えていない。

全repository source guardは再実行していない。既知の所有外 apps/runtime-player/src/main/physiology/index.ts barrel違反は本レビューで解消しておらず、全体guard PASSとは主張しない。全repo総当り、browser/Editor実操作、disk applyは本domainで実施していない。

## 技術裁量と C への接続条件

buildMaterialCandidateはasyncでWeb Cryptoを使用するpure core入口。成功時はworkingSession/impact/diagnosticsを返すが、disk fingerprint、保存revisionの確定、candidate state/approvalの変更は行わない。A/Cが保存file-setをserialize/hashし、base version/fingerprintを確認して候補を管理する。

guardMaterialCandidateOperation(before, after, drawableId)は、通常operationをdeep clone上で成功させてから呼び、allowed=trueの場合だけcloneを採用する。既存operationのvalidationを置換しない。Cはこのguardとapproval失効を必ず同じ導線へ接続する必要がある。

空のcontrol/parameterは新規create時のみ許可される。次operationでも未所属の既存要素は、base由来の無関係な要素と区別できないため編集/削除を拒否する。Cの通常順序はcontrolならcreate→対象bind→edit、parameterならcreate→対象keyform関連付け→editとなる。未bindのcandidate新規要素を再編集/削除するUXまで必要なら、candidate起源scopeの設計・検証を別途要する。この制限は共有保護のfail-closed挙動であり、無所属要素の所有を推測して許可しない。

## 未実施・後続事項

Cでpublic API/CLI接続、通常rig command routing、同viewport renderer比較、stale/apply/discard、保存後Editor再読込、古いatlas cacheのstale扱いを統合検証する。Bのtechnical PASSはそれらやOS障害時の原子性を証明しない。実素材の造形とAccepted User Gateの判断はroot/ユーザーの責務であり未実施。

## 確定版 SHA-256

下表は独立実行対象の作業tree実bytes。Gnomeから受領したbuild/impact/mesh-generation/validator integrationの代表4hashと一致した。改行を含む内容変更時は再照合が必要。

| path | SHA-256 |
| --- | --- |
| packages/authoring-core/src/material-candidate-build.test.ts | ca59b968b90420f15ae7f76ea79476dfd314c052a94ea3af1d4815f118069b95 |
| packages/authoring-core/src/material-candidate-build.ts | c3264dd4758cdc8fcad58cf5b5283b7cf2722f2551a3bdff5206c1947ec2ea88 |
| packages/authoring-core/src/material-drawable-add.ts | b59970296f5318a17b705cfd191b2cea169809da4917f026cd65473317467e23 |
| packages/authoring-core/src/material-drawable-replace.ts | 54da0b2953359a69a6cc2b16e6c702332a83cdf5e7a2900893f394ddde6c9b11 |
| packages/authoring-core/src/material-geometry-reset.ts | 5d31f28c600877a0df5db019b64ad0babb2c043578ee2fd4ca57ff92477fb425 |
| packages/authoring-core/src/material-impact-analysis.test.ts | f0e08ceb2164efd6ad63829ebf3edf4b4d785d97f787da6d5690f876db2f2e0c |
| packages/authoring-core/src/material-impact-analysis.ts | cf1a614c9593a1daacd1f77065dcfe94370d0f5d074236c9e9b4aed80ec992e5 |
| packages/authoring-core/src/material-source-mapping.ts | e412827f1d973e6e78b7cae2cb1cf43d59a73a35380004e267a6c318c5897ee9 |
| packages/authoring-core/src/material-test-fixtures.ts | ab03466cc9ae2896f89ba751fab91a7cb1d1c348c01197cf70d5df93db760b1a |
| packages/authoring-core/src/material-validation.ts | aa2fcb4df4655bbf3180a7ae4eb829ff74da14457da95d83c4b97b79bf4e6b7d |
| packages/authoring-core/src/mesh-generation.ts | d8e72421d51dad60d9016ad552330d516b8ddc8e4dfc8a3afd9ddc449c69db82 |
| packages/validator-core/src/material-candidate-integration.test.ts | c61afc0d5eb83bc75980b57ee47dd9e13b502c0630543dfee737790fd06fd738 |

