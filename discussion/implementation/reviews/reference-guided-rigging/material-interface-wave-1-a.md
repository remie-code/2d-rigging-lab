# 素材インターフェース Wave 1 A 独立レビュー

- Loop: 2 / 最大5
- 判定: 技術PASS（Loop 2）。R1解消を独立probeと全56 testsで確認。User Gateは未判定。
- 対象repo: C:/workspace/remie/code/ai-native-live2d-editor
- 基準HEAD: a6bfc0429e642cd4c047f154d834cbd3c26ca72c
- Gnomeとは別contextのReview-Sylphによるsource/basis/diff/独立実行確認。source未編集。他担当dirtyを保持。
- implementation-orchestration、discussion-management、discussion/_conventions.mdを適用。適用AGENTSはrepo/祖先に検出なし。旧Astra成果は未参照。

## Basis・判定範囲

material-interface-wave-plan.md、material-interface-contract.md、material-authoring-interface.md、material-ingestion-research.md、experiments/material-interface-contract-completion.mdを参照。契約が固定したAの6業務責務、同prefix helpers/tests、host依存追加のみを対象とした。技術判定とAccepted User Gateは別であり、Gate全文の意味・rootの実素材/造形判断責務を変更していない。

## R1履歴: 壊れたsRGB chunkで色空間検証を回避する（Loop 2で解消）

対象: apps/authoring-host/src/material-image-decode.ts のchunk scan（sRGB検出とgamma判断）。

`type === "sRGB"`だけでsrgb=trueにし、chunk payload length、rendering intent、CRCを検証していない。pngjs 7.0.0 のlib/parser.jsはsRGB/cHRMを既知chunkとして扱わず、未知ancillary chunkをCRC込みでskipする（同file 82–95行）。したがって`PNG.sync.read(...,{checkCRC:true})`ではこのscanが信頼する色宣言を保証できない。

Loop 1の独立メモリprobe実測（修正前）:

| 入力（1×1 RGBA=200,100,50,128） | 結果 |
| --- | --- |
| sRGB payload=00、CRC=00000000 | ACCEPTED srgb |
| sRGB payload length=0、正しいCRC | ACCEPTED srgb |
| gAMA=100000、sRGBなし | REJECTED: PNG gamma is not sRGB |
| gAMA=100000 + sRGB payload=00/CRC=00000000 | ACCEPTED srgb、bytes無変換 |

非sRGB gammaを持つ入力が、破損sRGB宣言を付けるだけで無変換のsrgbとして成功する。これは「非sRGB色profileは診断拒否」とするdomain裁量と、normalized imageのsrgb意味を守れていない。

修正指針: 色判断前にchunk framing/CRCを自前検証するか、全該当chunkを検証するdecoderを使用する。sRGBはlength=1、intent=0..3を検証する。gAMA/cHRMも規定lengthと許容値を確定してから採用し、不正/重複/誤配置された色宣言で拒否を回避させない。少なくとも上記4ケースと正しいsRGB/gAMAの非回帰テストを追加する。source implementationはGnomeへ戻す。

再現実行: PowerShell here-stringを`node --input-type=module`へpipe。既存Vite createServer(configFile=apps/authoring-host/vitest.config.ts, middlewareMode=true)のssrLoadModuleでmaterial-image-decode.tsを読み、pngjs PNG.sync.writeで1×1PNGを作成。IHDR直後（offset 33）にlength/type/data/CRCのchunkをBuffer.concatで挿入。CRCはpngjs/lib/crcのcrc32、破損時は0。gAMAの4byte big endian値を100000、sRGB payloadを[0]とした。probe用source fileは作成していない。

## 確認できた適合

- PNG: raw RGB/straight translucent alpha、透明余白、alpha tight bounds、元file/RGBA hash分離、RGBA tamper・画像CRC・empty-alpha拒否の通常経路。
- 配置: compact/wide public fixtureが異なるresolution/余白でも同stage alpha矩形へ一致。等方最小二乗残差、coincident/negative/nonfinite拒否。
- fingerprint: 契約prefix、uint64 BE count/path/file framing、UTF-8 path byte順。隠しfile、case/Unicode/JSON whitespaceのbyte差、同file-set順序独立、junction拒否を確認。
- store: registered revision0から保存・復元。immutable image/base、expected revision比較、exclusive lock、working exact file-set hashと通常package再読込。RGBA/working改竄拒否、失敗時旧pointer維持、base bytes不変。
- source取得: 元RGBAを透過PNGへ戻す。storage insetとsource boundsからpixel-edge写像を復元。実context renderer、関連texture/mask refs、非等方拒否、入力不変。
- preview: render-softwareで旧mesh外の新alpha、occluder、既存target mask、追加target/maskSource、Part構造挿入順、default variant/runtime visibility/defaultOpacityをpixel検証。sidecarのartifact pixel mappingとmaterial placement、候補ID/revision/base版の分離を確認。
- rest opacity: keyforms/dynamicsを除くcloneの既存runtime評価からopacityだけ採用。authored mesh/明示配置へrest transformsを二重適用しない。replace/add双方のrig opacityと入力不変を検証。

## Loop 1 独立実行

全shellで明示workdir=C:/workspace/remie/code/ai-native-live2d-editor。2026-09-26 18:46 JST以後に実行。

| command | 結果 |
| --- | --- |
| pnpm exec vitest run --root apps/authoring-host src/material-image-decode.test.ts src/material-placement.test.ts src/material-package-fingerprint.test.ts src/material-candidate-store.test.ts src/material-placement-preview.test.ts src/material-source-extraction.test.ts | PASS 6 files / 19 tests |
| pnpm run typecheck:authoring-host | PASS |
| pnpm run typecheck | PASS |
| pnpm run check:deps | PASS |
| node scripts/check-source-organization.mjs --source-root apps/authoring-host | PASS |
| git diff --check -- apps/authoring-host/package.json pnpm-lock.yaml | PASS（LF/CRLF通知のみ） |
| pnpm run check:source | FAIL: 既知所有外runtime-player/src/main/physiology/index.ts barrel違反のみ |
| node --input-type=module（上記色metadata probe） | R1再現 |

既存tracked差分はhost package.jsonのpngjs 7.0.0追加とlock importer 3行のみ。新規sourceはuntrackedなので全対象を直接読んだ。

## Renderer artifact確認

独立実行時にMATERIAL_ARTIFACT_DIRECTORYをrepo内`llm-workspace/material-interface-wave-1-a/review-artifacts`へ設定。以下は実在PNGをview_imageで確認し、同runのpixel assertionsとsidecarを照合した。

- C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/review-artifacts/artifacts/placement-alpha-preview-2c993ca4-f90c-40fe-88ea-112edcb6d31d.png と同名json
- C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/review-artifacts/artifacts/source-texture-1febae18-bb57-41cb-b2ab-e6bdb30febd3.png と同名json
- C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/review-artifacts/artifacts/context-composite-1d8f7472-5067-4c9f-a6e9-94ea428b8920.png と同名json

12×12等のsynthetic fixture。画像目視は小画像の外形確認であり、色/座標/alphaの根拠は独立実行pixel assertion。baseFingerprint=aa…のfixtureを使用しており、実saved packageとrenderer snapshotを対応付けるCのend-to-end証拠ではない。browser/Editorは未操作・未検証。root/user tabへ干渉なし。

## 裁量・後続責務

- pngjs選定、非sRGB profile拒否、UUID snapshot/current pointer、既存software renderer利用、rest opacityのclone評価は契約内の技術裁量。R1を除き妥当。
- storeは業務state machineを所有しない。state/revision増分・approval失効・stale/apply競合guardはC。saveは同revision保存を許すため、expected revisionだけで同revisionのapprove/discard競合まで解消したとは主張できない。Cは操作間競合・状態再確認を担う必要がある。
- sessionのID/revision/dirtyとsidecar版は照合するが、Aがsessionからdisk fingerprintを捏造しない。保存snapshotとの対応と競合guardはCの統合試験で確認する。
- 中断時lock回収、crash durability、OS障害までの原子性は未検証。これらを今回のPASS根拠に数えない。
- R1修正後のhash更新・独立再試験をLoop 2で完了。Aの未解決指摘なし。User Gate/自然さ判定は未実施。

## Loop 2 解消確認・独立実行

material-png-validation.ts/.test.tsの追加とdecode側の呼出変更を直接確認。全chunk framing/CRCを色判断前に検証する。sRGB length/intent、gAMA/cHRMの規定lengthとsRGB許容値、色chunk重複・位置、IDAT/IEND順序を検査する。別CRC実装で組み立てた37追加テストは失敗を隠しておらず、正常sRGB intent0..3/gAMA/cHRM、未profile画像の非回帰を含む。保守的に矛盾gammaを拒否する裁量は、変換なしで不明な色空間を受理しない方針と整合する。

Loop 1と同じメモリprobeを再実行した結果:

| 入力 | Loop 2結果 |
| --- | --- |
| bad-srgb-crc | REJECTED: PNG sRGB CRC mismatch |
| bad-srgb-length | REJECTED: sRGB requires one rendering intent byte in 0..3 |
| non-srgb-gamma-no-srgb | REJECTED: PNG gamma is not sRGB |
| non-srgb-gamma-bad-srgb-crc | REJECTED: PNG gamma is not sRGB |
| valid-srgb | ACCEPTED srgb、RGBA [200,100,50,128] |

2026-09-26 18:56 JST以後、全commandは対象repo明示workdir。独立再実行:

| command | 結果 |
| --- | --- |
| pnpm exec vitest run --root apps/authoring-host src/material-image-decode.test.ts src/material-png-validation.test.ts src/material-placement.test.ts src/material-package-fingerprint.test.ts src/material-candidate-store.test.ts src/material-placement-preview.test.ts src/material-source-extraction.test.ts | PASS 7 files / 56 tests |
| pnpm run typecheck:authoring-host | PASS |
| pnpm run typecheck | PASS |
| pnpm run check:deps | PASS |
| node scripts/check-source-organization.mjs --source-root apps/authoring-host | PASS |
| git diff --check -- apps/authoring-host/package.json pnpm-lock.yaml | PASS（LF/CRLF通知のみ） |
| node --input-type=module（同じVite loaderの独立probe） | R1拒否・正常PNG非回帰PASS |
| Get-FileHash -Algorithm SHA256（completionの全21対象） | 21/21一致 |

全体sourceguardの既知runtime-player barrel違反はLoop 1で独立確認済み。Loop 2で全体PASSへ変更していない。

Loop 2 testsが新たに出力した実PNGをview_image、JSONをGet-Contentで確認。以下は実在絶対pathで、各同名jsonがsidecar。実pixel assertionは全56 testsに含まれる。

- C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/review-loop2/artifacts/placement-alpha-preview-05563cad-51a5-4a39-a35b-9400bd2c99b2.png
- C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/review-loop2/artifacts/source-texture-a95fee46-e585-4ca1-b6d1-cf84ae071b71.png
- C:/workspace/remie/code/ai-native-live2d-editor/llm-workspace/material-interface-wave-1-a/review-loop2/artifacts/context-composite-463e687e-5234-4d9f-93ea-3c5794e46249.png

Aの修正必須指摘は解消。後続Cのstate routing/競合/実saved snapshot対応/Editor再読込、browser、実素材/User Gate、crash durabilityは引き続き未検証。技術PASSはこれらの完了を意味しない。

## Loop 2 最終対象SHA-256

Gnome completionの全21 fileを独立Get-FileHashで一致確認。対象ソースを変更した場合は、この判定へ新しい版を混在させず再確認する。

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

