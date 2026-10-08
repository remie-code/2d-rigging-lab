# 素材インターフェース Wave 1 A completion

状態: 独立Review 技術PASS（Loop 2）をOrchが受領。root受領待ち。User Gate未判定。
2026-09-26。repo C:/workspace/remie/code/ai-native-live2d-editor。
Basis HEAD a6bfc0429e642cd4c047f154d834cbd3c26ca72c。既存dirtyを保持、commitなし。map/plan/decisions、core、CLI/public registryは変更なし。

## 変更と接続

[domain APIと裁量](../material-interface-wave-1-a.md) に入出力型、C責務、失敗経路を記載。
追加: hostの6業務module（source-extraction/image-decode/package-fingerprint/candidate-store/placement/placement-preview）、各test、6補助module（host-error/render-artifact/render-context/rest-opacity/test-fixtures/png-validation）とPNG validation専用test。既存変更はhost package.jsonへのpngjs 7.0.0依存とpnpm-lockの3行のみ。

## 実測

全commandのworkdirは対象repo。

| command | 結果 |
| --- | --- |
| pnpm exec vitest run --root apps/authoring-host src/material-image-decode.test.ts src/material-png-validation.test.ts src/material-placement.test.ts src/material-package-fingerprint.test.ts src/material-candidate-store.test.ts src/material-placement-preview.test.ts src/material-source-extraction.test.ts | PASS、7 files / 56 tests（旧19＋PNG preflight 37）、2026-09-26 18:54 JST |
| pnpm run typecheck:authoring-host | PASS |
| pnpm run typecheck | PASS |
| pnpm run check:deps | PASS |
| node scripts/check-source-organization.mjs --source-root apps/authoring-host | PASS |
| pnpm run check:source | FAIL、既存所有外 apps/runtime-player/src/main/physiology/index.ts barrel-only違反のみ |
| git diff --check -- apps/authoring-host/package.json pnpm-lock.yaml | PASS（LF→CRLF通知のみ） |

検証範囲: PNG straight-alpha・実RGB・alpha tight bounds・透明余白・独立SHA256、hash mismatch/CRC破損/透明画像拒否、解像度と余白の異なる契約fixtureの同stage配置、fit残差/退化/negative/非有限、fingerprint wire-vector/隠しfile/path byte差/junction拒否、candidate metadata/RGBA/通常packageの再読込、raw/working tamper拒否、失敗時旧pointer維持/base bytes不変。実rendererで旧mesh外alpha、occluder、mask target/source、Part挿入位置、default variant/runtime visibility/opacity、rig opacity、inset付きsource写像を確認。

renderer artifactは以下に永続出力（gitignored llm-workspace）。テスト実行時 MATERIAL_ARTIFACT_DIRECTORY を同directoryへ設定した。
C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/artifacts

例（同名jsonが座標sidecar）:
- placement-alpha-preview-0a4ad0f3-2a4c-4ff9-844f-21b84508d888.png
- context-composite-769cff3b-2000-497d-8b92-fb913c79ef6f.png

PNGはpixel assertionを実行し、placement例はview_imageでも確認した。12×12のsynthetic技術fixtureであり造形評価用ではない。browser/Editor未検証。

## 試験中の修正

fingerprint独立期待wireのbyte-length欄に余剰00があり期待値を修正。renderer fixture当初の前後期待が既存front-first構造順と逆だったためfixtureと挿入期待を既存規約へ修正。実装のdraw-order反転は行っていない。rig opacityを保持する追加試験を実装し、親が了承したkeyforms/dynamics除外clone評価で対応。

## Loop 2: Review R1対応

独立Reviewが、pngjsでは未知ancillaryのsRGB CRCがskipされ、破損sRGB宣言によって非sRGB gammaを無変換で受理する問題を再現した。material-png-validation.tsを追加し、色採用前に全chunkのlength/type/framing/CRCと基本順序を検証する。sRGB length/intent、gAMA/cHRM length/許容値、重複、PLTE/IDAT後やIHDR前の誤配置を拒否。正しいsRGBと矛盾するgammaも拒否する。元decode moduleの未検証scanを置換した。

専用test 37ケースはpngjsの独立CRC実装でchunkを組み立て、R1の4再現ケース、正しいsRGB intent 0..3、gamma/chromaticities、破損/重複/誤配置/矛盾/未知ancillary CRC/missing IEND/trailing bytesを検証。全56 tests、host/root型検査、domain source guard、depsを再実行してPASS。sandbox内test起動はesbuild spawn EPERMで起動前に失敗したため、同commandをrequire_escalatedで再実行してPASSを確認。独立Loop 2 Reviewは同じprobeでR1拒否・正常PNG非回帰を確認し、56 tests、host/root型検査、deps、担当source guardを独立実行してPASS。全21対象のSHA-256一致と実PNG/sidecarを確認し、技術PASSを返した。[独立レビュー](../../../implementation/reviews/reference-guided-rigging/material-interface-wave-1-a.md) をOrchが受領。sourceの追加変更はない。

## 残件

Aの修正必須指摘は解消。root受領とmap登録はroot責務。C接続・apply競合/承認state routing・Editor再読込・実素材/User Gateは未実施。Cは同revisionのapprove/discard競合を状態再確認と操作間guardで防ぎ、保存snapshotとdisk fingerprintの対応を統合検証する。ICC等の非対応色profileは診断拒否。OS障害までのatomicity/crash durabilityは未検証。Windows再parse属性検査にPowerShellを使用し、実行不可は失敗として扱う。詳細はdomain文書。

## 最終source SHA-256

以下はLoop 2修正後の作業tree実bytes。独立Review対象版。

| path | SHA-256 |
| --- | --- |
| apps/authoring-host/src/material-candidate-store.test.ts | 6b6b455099d5b54699ccd240e6a5c7f171ecfdbd25c0c6c03ec601523aa793fa |
| apps/authoring-host/src/material-candidate-store.ts | db9dfec8ed807d9a66702f07ae1504314a9ddc74cda7b5743d16895df919dd14 |
| apps/authoring-host/src/material-host-error.ts | 461265795233943cb7c5ec3db89ed74a9ece67756e5d5d8328e9ebc2b233d256 |
| apps/authoring-host/src/material-image-decode.test.ts | 1376dbbb69fae8ba175a778f2f003fb59b6ffc532f4db0e98fa49bfff1376855 |
| apps/authoring-host/src/material-image-decode.ts | 62ba5ebc00206831db4faec53d9c7e2699baf547042480036125ba84d3d34be7 |
| apps/authoring-host/src/material-package-fingerprint.test.ts | 91712c1c3a93c3b03e7bfbaa00b39ae59bd0ddd49e4b5ade34e783a701a9c10c |
| apps/authoring-host/src/material-package-fingerprint.ts | 070f994c4f8d183fac6345fc9cade1391ff6cd67631119ce057154098469b145 |
| apps/authoring-host/src/material-placement-preview.test.ts | 142751d9e55650d763e0e4d116195523277ed5dbdac673e71693369deaa2ec74 |
| apps/authoring-host/src/material-placement-preview.ts | 2cfc78bf08243a7bd1d3a72e15b8baef3796c88fcd93044a55fac592df36f05e |
| apps/authoring-host/src/material-placement.test.ts | 03b03f17be530fce9b229675f8f7451ef1780ac0a1e43c7abcb1835e45b0c5ed |
| apps/authoring-host/src/material-placement.ts | a6a39b2f26906425851f094eec063993b87d71088e16856e90a8d8d45de6329b |
| apps/authoring-host/src/material-png-validation.test.ts | 3a555a6971248344875977bdc581459c5dacb236bdbcf64e7973affe6c13ec55 |
| apps/authoring-host/src/material-png-validation.ts | 3d6ae5bb71b94dc74b13d590a830201ec10076fd26678675ca78d2f096165f22 |
| apps/authoring-host/src/material-render-artifact.ts | 3527376b8254cdecbb5733aceb629011bbb8a1068ea5bbad157329433801be6e |
| apps/authoring-host/src/material-render-context.ts | 9eead81a1425dc09fae33b8f93b100ae5389dc94d437b741152b42da4b504a5a |
| apps/authoring-host/src/material-rest-opacity.ts | b3f2250a3fe1c095fb0279cc9f4c41c4c15135bc9b216c7010390f378f79891b |
| apps/authoring-host/src/material-source-extraction.test.ts | 908eba86aa7aeae926b8786b9f79ba7a6f19d9c1723fdc141f0b6d3a496d5ee0 |
| apps/authoring-host/src/material-source-extraction.ts | cba975120e74f68af2b7e9948ca234a83a62a7a7df8a77b8164781d1e5bf532e |
| apps/authoring-host/src/material-test-fixtures.ts | c648f68582d26f6aaa46a63d70479fb311a2e278cd3ca2e4c2d74b4931294f18 |
| apps/authoring-host/package.json | b3c6fa641ace0b7e45e7b416430855cd5b80151a5f27713ea986a9754ad5204f |
| pnpm-lock.yaml | 7bf43af2483a1ec1366c48b4bebafff17a684e754f97e94d620623f52a58ecb7 |
