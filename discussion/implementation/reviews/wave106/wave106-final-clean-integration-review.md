# Wave106 Final Clean Integration Review（独立 Review-Sylph）

- 役割: Review-Sylph（レビュー担当）／ Orch-Sylph（Wave106 Domain D = Final Integration）からのサブエージェント委任
- 読み取り専任 + 検証コマンド実行（テスト / tsc / grep / git diff）。ソース・fixtures・ref・map は無変更。本レポートのみ書き出し。
- 判定基準: `discussion/implementation/orchestration/wave106-plan.md`（§9 / §11）、設計オラクル `discussion/design/dynamics-world-frame-chain.md`、Domain A/B/C 報告 + 7レビュー + Orch 統合報告 + ref-v3 Gnome 報告
- 全所見は Orch/Gnome の主張のオウム返しではなく、Review-Sylph 自身のコンテキストでコマンド再実行・ファイル照合・数値検算した結果である。

## 判定: **合格（pass）**

Wave106（dynamics v0 → dynamics-file-v3 世界系 Verlet チェーン全面置換）の最終統合状態は、L0/ユーザー裁定を織り込んだ**ベースライン比較型ゲート**の下でクリーンに成立している。ref 2ファイルの v3 再生成により、Orch 統合報告が唯一のブロッカーとしていた authoring-host `ref-e2e.test.ts` の赤化は解消され、7/7 green。wave106 起因の新規エラー・新規テスト赤はゼロ、dynamics 起因のエラー・赤もゼロ。旧識別子の生きた production 残置ゼロ。forbidden-scope 無変更。要修正だった3レビューレーンは修正ループで解消され、その解消は独立実測で裏取り済み。

**注記**: Orch 統合報告 `wave106-final-integration-report.md` は現状 needs_fix 表記のままだが、その唯一のブロッカー（§1 の ref v2 hard reject 衝突）はユーザー裁定による ref 2ファイル解除で既に解消されている。本レビューは解消後の状態を検証しており pass。Orch は本レビュー後に統合報告を pass へ改訂し、map closeout（後述 §未達）を行う想定。

---

## 観点1: クリーン統合の実効確認（抽出再実行）

すべて Review-Sylph 自身のコンテキストで実行。

| 検証 | コマンド | 結果 |
|---|---|---|
| ref-e2e | `npx vitest run apps/authoring-host/src/ref-e2e.test.ts` | **7/7 pass**（validatePackage / derived-verified dimensions / render gate PNG×3 決定論 / measurement / Ware group gating / Rodos override / unknown variant reject）exit 0 |
| packages dynamics | `npx vitest run packages/runtime-core/src/dynamics-evaluation.test.ts packages/validator-core/src/dynamics-semantic.test.ts` | **27/27 pass**（dynamics-evaluation 17 + dynamics-semantic 10）exit 0 |
| editor + player dynamics | `npx vitest run .../dynamics-tool-state.test.ts .../effective-dynamics-tuning.test.ts` | **17/17 pass**（dynamics-tool-state 14 + effective-dynamics-tuning 3）exit 0 |
| root/packages tsc | `npx tsc --noEmit` | **exit 0**（error 0） |

→ 観点1 全項目 **適合**。ref-e2e が v3 化後にクリーンに通ること、dynamics コアの物理妥当性テスト・validator・editor state・player tuning が全 green、packages スコープ tsc が exit 0 であることを独立に確認した。

## 観点2: ref v3 再生成の正当性

`ref/model/dynamics.json`（実体を Read）を v3 Zod スキーマ（`packages/package-format/src/model-files.ts` L178-212, L352-356）と対照。

### (a) v3 スキーマ適合 — 適合
- `schemaVersion: "dynamics-file-v3"` ✓
- chain: `rootOffset {0,0}`（Vec2 default）✓、`segmentLengths [4.8]`/`[5.6]`（finite positive, min1）✓、`damping 2.4`（nonnegative）✓、`gravityScale 1`（nonnegative）✓
- inputs: `kind` enum（positionX/angle）✓、`scale` finite（3 / 1）✓
- outputs: `segmentIndex 1`（int ≥1）✓、`scale 0.016666666666666666` finite ✓、`limit 1.2` nonnegative ✓
- ロード実測: ref-e2e 7/7 green = Zod parse 成功が実行経路で裏付けられる。

### (b) 翻訳規則の適用（Review-Sylph 自身で再計算検算）— 適合
委任プロンプト §重要前提3 の規則を数値再計算で検算:
- segmentLengths: `0.3 × 16 = 4.8` ✓（hair）、`0.35 × 16 = 5.6` ✓（tie）
- damping: `convergenceSpeed 4 × 0.6 = 2.4` ✓（両グループ）
- output.scale: `strength 0.5 / 30 = 0.016666666666666666` ✓（JS 一意表現、両グループ同値）
- input.scale: influencePercent 100 / invert false → factor そのもの。positionX = 3.0 ✓、angle = 1.0 ✓（設計 §10 使用例 FaceX→positionX 3.0 / FaceZ→angle 1.0 と整合）
- gravityScale = 1.0 固定 ✓、rootOffset {0,0} 固定（静止で offset=0 を保証）✓

### (c) 廃止フィールド残置ゼロ — 適合
`pendulums` / `influencePercent` / `invert` / `normalization` / `strength` / output `kind` は ref/model/dynamics.json に一切なし（ファイル全体を目視、キーはアルファベット昇順で局在確認）。

### (d) ref/manifest.json 変更が schemaVersions.dynamics 1行相当のみ — 適合（間接確認）
`ref/` は `.gitignore:6` で丸ごと ignore（`git check-ignore -v` で確認）のため git 追跡上の diff は原理的にゼロ。Gnome 報告が find + mtime で「manifest は schemaVersions.dynamics の1行のみ、modelFiles.dynamics のパス参照据え置き」と実測記録。Review-Sylph は git 追跡系（`git status --short -- ref/` = 空）で「予期しない追跡ファイル変更ゼロ」を確認。**質問1参照**（gitignore ゆえ manifest 1行変更を git diff で直接検証できない）。

### (e) render-gate artifacts が git clean = 静止レンダのバイト不変 — 適合
- `git status --porcelain -- discussion/model-authoring/experiments/ref-render-gate/` = **空**
- render-gate PNG は HEAD（`1f072704` wave105）にコミット済み、`git diff --stat HEAD -- .../ref-render-gate/` も空 = バイト不変
- ref-e2e の「renders the user visual gate PNGs deterministically」が green = v3 チェーンが静止で真下静定し既存決定論 assert を通したことの実行裏付け。
- （初期 git status スナップショットで render-gate が M と出ていたのは一時状態で、テスト再生成後に committed とバイト一致へ復帰。現時点 clean。）

→ 観点2 全項目 **適合**。翻訳規則は決定論的近似として正しく機械適用されている。

## 観点3: 旧識別子 grep の独立確認

`grep -rniE "additivePendulumV0|dynamics-file-v2|reactionSpeed|convergenceSpeed|previousSourceVelocity|runtime-dynamics-pendulum-v1|dynamics-pendulum-solver-v1"` を packages/apps/fixtures/ref（node_modules・dist 除外）で走査。加えて knob としての `sway:` を別途走査。

**生きた production 残置ゼロ。** ヒットは2ファイルのみで、いずれも正当な負テスト:
- `packages/package-format/src/package-document.test.ts:191-220`: 「rejects the retired dynamics-file-v2」+ 廃止フィールド付き payload reject を検証する負テスト（`schemaVersion: "dynamics-file-v2"`, `pendulums: [{...sway...reactionSpeed...convergenceSpeed}]`, output `kind`/`strength`/`invert` を故意に構成し `success: false` を assert）
- `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-store.test.ts:129-149`: legacy v1 profile（`sway`/`reactionSpeed`/`convergenceSpeed`）が schemaVersion 厳密一致で `read-failed`・破棄されることを検証する負テスト

`sway` を含む識別子（`dyn_hair_sway` / `param_hair_front_sway_x` / `param_accessory_sway_x` 等）はすべて髪部位の parameter/group ID 命名であり、廃止 knob `sway:` とは別物（正当）。discussion/ の歴史的言及は対象外。

→ 観点3 **適合**。

## 観点4: Forbidden-scope

| 項目 | 結果 |
|---|---|
| `ref/` 追跡変更 | pass（`git status --short -- ref/` = 空。gitignore 対象。実変更は find で2ファイルに局在＝Gnome 実測） |
| `packages/render-software/**` 無変更 | pass（`git status --porcelain` = 空） |
| `packages/render-webgl2/**` 無変更 | pass（同上） |
| lockfile 無変更 | pass（`git status --short -- pnpm-lock.yaml` = 空） |
| root package.json 無変更 | pass（同上） |
| 変更 package.json が fixture model-data のみ | pass（唯一 `fixtures/contracts/invalid-rigControl-cycle/package.json`。diff は `"schemaVersion": "dynamics-file-v2" → "dynamics-file-v3"` の1行のみ、dependencies キー無変更 = npm manifest ではない） |
| authoring-host **ソース** 無変更 | pass（`git status --porcelain -- apps/authoring-host/src/` = 空。ref-e2e.test.ts / perception 系も現状 clean = committed。ロードは packages 経由だが authoring-host src は wave106 未接触） |
| `git diff --check`（whitespace） | clean |

→ 観点4 **適合**。変更は packages（dynamics 層）+ apps/editor（dynamics 系）+ apps/runtime-player（tuning 系）+ 1 fixture model-data + ref 2ファイル（gitignore）+ discussion に局在。

## 観点5: pre-existing 台帳の妥当性（抽出検証、最低2項目）

Orch 統合報告 §7 の台帳から P1・P4 を抽出し、切り分けの根拠を自分で確認した。

- **P1（packages vitest 赤14）**: 代表2件を実測。`npx vitest run packages/validator-core/src/warp-lattice-diagnostics.test.ts packages/operation-core/src/minimal-operation-fixture.test.ts` → 2 failed。失敗内容は **`keyform.unsupportedTargetProperty`（新設 keyform 検証）+ `warpLatticeUnsupportedProperty`** の diff で、**dynamics と完全に無関係**（keyform/warpLattice/rigControl 由来 = Domain A 報告 §残課題(D) と一致）。切り分け根拠（非dynamics性）を確認。
- **P4（player 赤2）**: `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts` を実測 → 1 failed。失敗は `not-loaded` レスポンスの `toStrictEqual` shape mismatch（`activeVariantSelection` / `effectiveDynamicsTuning` フィールド有無不整合）。当該テストファイルは `git status --porcelain` = 空 = **wave106 未変更**。dynamics スキーマ本体の破損ではなく response contract 追随漏れ（別ドメイン由来）。切り分け根拠（未変更 + 非dynamics）を確認。

→ 観点5 **適合**。台帳の pre-existing 分類（wave 外 in-flight 由来）は抽出2項目で妥当。

## 観点6: 報告・レビュー網羅

- Domain A/B/C 報告 + Gnome 報告群 + Orch 統合報告 + ref-v3 Gnome 報告: すべて `discussion/implementation/waves/wave106/` に存在。
- レビュー7本すべて `discussion/implementation/reviews/wave106/` に存在（A: physics-spec-compliance / design-development / test-adequacy、B: spec-compliance / test-adequacy、C: spec-compliance / test-adequacy）。
- 判定整合:

| レビュー | 判定 | 要修正の解消記録 | Review-Sylph 独立裏取り |
|---|---|---|---|
| A physics-spec-compliance | 合格 | — | dynamics-evaluation 17/17 green |
| A design-development | 要修正2（catalog 旧ルール残置 / evaluatorVersions 旧名） | Gnome-4 穴A/穴B で解消（`wave106-domain-a-gnome4-fix-report.md`） | **独立確認**: 旧catalogルール4種=0件、新catalogルール4種（chainSegmentsInvalid/outputSegmentIndexOutOfRange/zeroInputScale/outputScaleZero）登録済み、`additivePendulumV0` 残置=0 |
| A test-adequacy | 要修正2（穴A/B） | 同上 Gnome-4 | 同上 + dynamics テスト全green |
| B spec-compliance | 合格 | — | dynamics-tool-state 14/14 green |
| B test-adequacy | 合格 | — | 同上 |
| C spec-compliance | 合格 | — | effective-dynamics-tuning 3/3 green |
| C test-adequacy | 要修正（D-1: 無効値 sanitize/reject テスト不在） | Domain C 報告 §修正ループで15テスト新設（bridge-request-validation / profile-groups / profile-parser / store） | player tuning focused green |

要修正だった3レーン（A design/dev・A test-adequacy・C test-adequacy）はいずれも各ドメイン報告の修正ループ節で解消記録があり、その解消を Review-Sylph が独立実測で裏取りした（catalog 実状 + focused テスト green）。修正ループ→解消の記録は結果整合。

なお C spec-compliance レビュー L43 に「観点5の解釈（作業ツリー全体で packages クリーン vs Domain C が層を跨がない）」の Orch 確認要請があり、後者の趣旨（Domain C の write scope は apps/runtime-player に限定）で妥当に処理されている。

→ 観点6 **適合**。

---

## 裁量判断の評価

- **翻訳規則の適用正確性**: ref v3 再生成の翻訳規則（segmentLengths ×16 / damping ×0.6 / output.scale ÷30 / input factor angle1.0・position3.0 / gravityScale1.0 / rootOffset0）を数値再計算で全項目検算し、生成データと一致。「決定論的近似・較正前提」という位置づけも設計 §8/§10 の運用導線（Editor プレビューで較正）と整合。旧4ノブの忠実翻訳は原理的に不可能であり、この近似採用は妥当。
- **Domain A 裁量#1（parameter-resolution のアンカー認識ルーティング）**: A physics-spec レビューが §3.5 非抵触を独立追認、加算合成算術は diff ゼロで不変。妥当。
- **Domain B/C の既定値・意味論裁定**（input scale 既定 1.0 / output scale 1/30 / limit=レンジ半分 / Scale接尾辞=乗数）: 各 spec レビューが §9/§10 と照合し妥当と追認。Review-Sylph は focused テスト green でこれらが破綻していないことを確認。

## ユーザー裁定事項（certify 対象として明記）

本レビューは、以下のユーザー/L0 裁定を前提として wave106 を pass と判定する。これらは wave106 の正式ゲート定義の一部として certify する:

1. **ベースライン比較型ゲート**（L0 裁定）: §9 の完了条件は「root/apps tsc 全 exit 0」ではなく「**wave106 起因の新規エラー・新規テスト赤ゼロ かつ dynamics 起因のエラー・赤ゼロ**」。wave 外 in-flight 由来の pre-existing（editor tsc 22 / packages 赤14 / editor 赤4 / player 赤2）は台帳化して後続へ送る。→ Review-Sylph は「wave106 起因・dynamics 起因の赤/エラーゼロ」を独立実測で確認（観点1・5）。**この裁定の下で pass。**
2. **ref/ 2ファイルのスコープ解除**（ユーザー裁定、ref はユーザー所有物）: v3 hard reject が `ref/model/dynamics.json`（v2）と衝突し ref-e2e を 6/7 赤化したため、ユーザー承認のもと `ref/model/dynamics.json`（v3 再生成）と `ref/manifest.json`（schemaVersions.dynamics 1行）に限定修正。ref/ のその他は不可侵のまま。→ Review-Sylph は ref-e2e 7/7 green・廃止フィールド残置ゼロ・render-gate バイト不変を確認。**この裁定の下で pass。**
3. **翻訳規則（決定論的近似、L0 推奨採用）**: chain = {rootOffset:{0,0}, segmentLengths:[length_v2×16], damping:convergenceSpeed_v2×0.6, gravityScale:1.0}、input scale=(invert?−1:+1)×influencePercent/100×(angle1.0/position3.0)、output segmentIndex1・scale=(invert?−1:+1)×strength_v2/30・limit維持。→ Review-Sylph は全数値を再計算検算し一致確認。**この近似規則の採用を certify。**

---

## 差分一覧（要修正）

**なし**（合格）。以下は blocking ではない申し送り:

1. **map closeout が未実施**（Orch の作業、本レビュー後の想定）: `discussion/design/_map.md`（dynamics 行「In discussion / wave 未着手」のまま）、`discussion/design/dynamics-world-frame-chain.md`（Status「In discussion」のまま）、`discussion/implementation/orchestration/_map.md`（wave106 行「Planned」のまま）、`waves/wave106/_map.md` / `reviews/wave106/_map.md` の新規作成、Orch 統合報告の pass 改訂。これらは Orch 統合報告 §8 で「本レビュー（L0 裁定確定）後に一括更新」と保留された項目であり、Review-Sylph（読み取り専任）のスコープ外。Orch が本レビューを受けて実施すべき残作業として申し送る。
2. **pre-existing 台帳 P1-P4 の後続処理**: wave106 スコープ外の in-flight 作業（variant feature golden / keyform 検証 / response contract shape）由来。後続 wave の掃除対象。

## Orch への質問

1. **ref/manifest.json の 1行変更の直接検証手段**: `ref/` は gitignore 対象のため、manifest の変更が「schemaVersions.dynamics 1行のみ」であることを git diff で直接検証できなかった。Review-Sylph は git 追跡系で「予期しない追跡ファイル変更ゼロ」+ Gnome 報告の find/mtime 実測（2ファイルのみ・manifest は1行）を根拠に適合と判定したが、ref/ を将来追跡対象にする運用ではこの検証を明示化する必要がある。現時点の判定には影響しない（ref-e2e 7/7 green がロード成功の実行裏付け）。
2. 本レビューの pass 判定を受けて、Orch 統合報告の pass 改訂 + map closeout（上記差分一覧1）を Orch が実施する理解でよいか。

## 起動した子エージェント

**ゼロ**（全 check を Review-Sylph 自身のコンテキストで実測）。孤児なし・掃除リスト空。
