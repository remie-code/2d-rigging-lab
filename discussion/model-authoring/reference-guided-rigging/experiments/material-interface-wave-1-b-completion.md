# 素材インターフェース Wave 1 B completion

状態: **独立Review技術PASS（正式Loop 1）受領済、root受領待ち**。2026-09-26。Accepted User Gateは未判定。
作業repo: C:/workspace/remie/code/ai-native-live2d-editor。基準HEAD: a6bfc0429e642cd4c047f154d834cbd3c26ca72c。既存dirtyを保持、commitなし。

Basis: [wave plan](../material-interface-wave-plan.md)、[共通契約](../material-interface-contract.md)、[用途](../material-authoring-interface.md)、[静的調査](../material-ingestion-research.md)。
独立検証の詳細: [Review report](../../../implementation/reviews/reference-guided-rigging/material-interface-wave-1-b.md)。

## 実装と所有

Orch-Sylph /root/material_wave1_bが調整、別Gnomeがsource/tests、別Review-Sylphがbasis/code/diff/独立testを担当した。Orch自身はsourceを実装せず、旧Astra rig成果も参照していない。

- 新規source: packages/authoring-core/src/material-{candidate-build,source-mapping,drawable-add,drawable-replace,geometry-reset,impact-analysis,validation}.ts。
- 新規tests/fixture: 同directoryのmaterial-{candidate-build,impact-analysis}.test.ts、material-test-fixtures.ts。
- 限定追加所有: packages/authoring-core/src/mesh-generation.tsのresolveDrawableTextureBytes無padding raster寸法解決。texture.dimensions宣言があれば優先し、未宣言時のみ従来stage bounds fallbackを保つ。scale≠1で既存alpha-aware再meshがfallbackする不具合を直した。Orchが必要性とA/C競合なしを確認して割当し、rootへ通知した。
- 検証専用追加所有: packages/validator-core/src/material-candidate-integration.test.ts。authoring-coreからvalidator-coreへの依存禁止を緩めず、validator側から追加/置換後を検証する配置をOrchが割当、root通知済。
- 既存public index/registry、contracts、validator production、root所有plan/map/decisionsは変更なし。本completionをOrch、review文書をReview-Sylphが作成した。

## 結果

buildはsession/candidate/RGBAを最初のawait前にcloneし、SHA-256・descriptor・state・base ID/revision・alphaを照合する。成功時だけworkingSessionを返す。source/layer/provenance/rights/texture/binary refsを整合追加し、失敗時に入力session/bytesへ部分更新を残さない。

addは既存Partへの構造挿入、rig membership、向き付きmask、visibility/opacityを明示値で設定する。replaceはlogical Drawable IDとmesh ID、名前、Part位置、order、mask、variant、既存rigを維持し、対象だけを新source mappingへ移す。旧共有texture/bytesは保持する。対象直属geometry keyformsを実graphから求め、申告集合が完全一致するときだけresetする。

新meshは配置後content全域を覆う編集可能な2三角形grid。旧画像bboxへ押し込めず、拡張alphaを含み、通常alpha-aware再meshとvertex編集が可能。旧key/topology自動移行や自然な変形値の算出は行わない。

guardは操作前後graphを比較し、control子孫、keyform対象、parameter/dynamics参照から影響Drawableを追跡する。共有control/key/parameter削除、対象外geometry/source/bytes等の変更を拒否する。対象専用controlの削除に伴う共有親の対象branch再接続は許すが、共有親の属性と他branch順序を保護する。add後に生まれた共有関係もimpactへ返す。

## C接続用API

既存authoring-core indexは未変更。Cが以下をpublic exportする。

```ts
// material-candidate-build.ts
buildMaterialCandidate(
  session: AuthoringSession,
  candidate: MaterialCandidate,
  normalizedImage: MaterialNormalizedImage
): Promise<MaterialCandidateBuildResult>

// union:
{ status: "completed", workingSession: AuthoringSession,
  impact: MaterialImpact, diagnostics: DiagnosticDto[] }
| { status: "rejected", impact?: MaterialImpact, diagnostics: DiagnosticDto[] }

// material-impact-analysis.ts
analyzeMaterialImpact(session: AuthoringSession, intent: MaterialIntent): MaterialImpact

guardMaterialCandidateOperation(
  before: AuthoringSession, after: AuthoringSession, drawableId: DrawableId
): MaterialCandidateOperationGuardResult
// { allowed: boolean, impact: MaterialImpact, diagnostics: DiagnosticDto[] }
```

buildはbase packageRevisionを保持する。Cはbase fingerprintを確認し、通常保存file-setへserializeしてsaved revision/fingerprintとcandidate working stateを確定する。coreはdisk fingerprint、保存完了、承認を偽装しない。RGBA digest検証にWeb Cryptoを使用する。

通常mesh/rig operationは必ずdeep cloneに実行し、通常operation成功かつguard.allowed=trueの場合だけ採用する。Cは同じ導線でcandidate revision更新とapproval失効を行う。guardは既存operation validationの代替ではない。

空control/parameterは新規create時のみ許可される。既存の無所属要素はbase由来とcandidate由来を区別できないため保護する。Cの操作順はcontrol: create→対象bind→edit、parameter: create→対象keyform関連付け→edit。未bindのcandidate新規要素を再編集/削除するには起源scopeの追加設計が必要で、現APIでは拒否する。

## 技術裁量

- 新素材sourceは既存split-png-set-v1を再利用し、provenance.assetKind=aiEdit、generated-material、元画像hash/RGBA hash/placementを記録する。PSD未加工由来を偽装しない。
- 契約に権利許諾情報がないためrightsはneeds_review、redistributionAllowed=false。権利承認を推測しない。
- 既存rig graphの単一直属親制約に従い、addの重複/複数direct rig parentは拒否する。
- contentInsetとalpha bboxを区別し、content pixel-edge→stage boundsとcontent-local UVを整合させる。

## 検証とレビュー

正式Loop 1確定版についてblocking findingなし。確定前の準備Reviewでscaled再mesh、fixture参照整合、専用control削除の過剰拒否、add共有impactを指摘し修正済。正式独立実行は2026-09-26 18:45–18:46 JST付近。全commandのworkdirは上記repo。

| command | 結果 |
| --- | --- |
| pnpm exec vitest run packages/authoring-core/src/material-candidate-build.test.ts packages/authoring-core/src/material-impact-analysis.test.ts packages/validator-core/src/material-candidate-integration.test.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-boundary-margin.test.ts packages/authoring-core/src/dependency-boundary.test.ts | 独立PASS、実在5 files/96 tests。誤記したboundary-margin fileは選択されず、次行の正しいtestを追加実行 |
| pnpm exec vitest run packages/authoring-core/src/mesh-generation-coverage-margin.test.ts | 独立PASS、1 file/5 tests。合計6 files/101 tests |
| pnpm run typecheck | 独立PASS |
| pnpm run check:deps | 独立PASS |
| node scripts/check-source-organization.mjs --source-root packages/authoring-core | 独立PASS |
| node scripts/check-source-organization.mjs --source-root packages/validator-core | 独立PASS |
| git diff --check -- packages/authoring-core/src/mesh-generation.ts | 独立PASS |

素材testsは18件。関連mesh77件、coverage margin5件、依存境界1件を合わせて101件。実validator integrationはvalid base→add/replace、通常runtime評価、binary index/bytesを検証した。最初のsandbox実行はesbuild spawn EPERMで起動前失敗、承認済host実行で完了した。

全体sourceguardは再実行しておらず、既知の所有外runtime-player/physiology/index.ts barrel違反を解消したとは主張しない。full repository総当りは実施していない。

## 残件と受領範囲

rootによるWave 1受領・map登録、Aとの接続、Cのpublic API/CLI・通常rig routing・approval失効・同viewport renderer比較・apply/discard/stale・保存後Editor再読込・atlas stale検証が残る。browser/実renderer画像/Editor実操作とOS障害時disk原子性はこのdomainで未検証。実素材の造形とUser Gateはroot/ユーザーが判断する。Bの技術PASSで制作往復の合格を代行しない。

## 確定版SHA-256

独立Review対象の作業tree実bytes。source変更なしでOrchも全12件を再照合済（12/12一致）。以下のsource版以後の変更は再検証対象。

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

