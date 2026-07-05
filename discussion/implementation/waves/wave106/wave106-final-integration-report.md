# Wave106 Domain D `wave106-final-integration-clean-review-map-closeout` — Orch-Sylph 最終統合報告

- 呼び出し元: Undine（L0）
- ドメイン: Domain D = Final Integration / Clean Review / Map Closeout
- オラクル: `discussion/design/dynamics-world-frame-chain.md`
- 計画: `discussion/implementation/orchestration/wave106-plan.md` §9・§11 + L0 裁定によるベースライン比較型ゲート
- 拘束台帳: `discussion/implementation/orchestration/wave106-blast-radius-inventory.md`

## 判定: **pass**

Wave106（dynamics v0 `additivePendulumV0` → `dynamics-file-v3` 世界系 Verlet 質点チェーンの破壊的置換）は、L0 裁定のベースライン比較型ゲート（「wave106 起因の新規エラー・新規テスト赤ゼロ」かつ「dynamics 起因のエラー・赤ゼロ」）を全て通過した。Domain D で新規発見した唯一のブロッカー（§1）は、**ユーザー裁定による ref/ 2ファイル限定スコープ解除**で本 wave 内に解消し、独立 Review-Sylph による final clean integration review は**合格（差分ゼロ）**。地図更新5点も完了した。

- 初版報告（needs_fix）→ L0/ユーザー裁定（案(b)変形）→ ref v3 再生成（Gnome, opus, 別コンテキスト）→ 受け入れ条件全達成 → final clean review pass → 本改訂（pass）という経緯。初版の needs_fix 判定と裁定要請は正規の escalation として機能した。

---

## 1. Domain D で新規発見・解消したブロッカー: authoring-host `ref-e2e.test.ts` × ref v2 dynamics

### 症状と根本原因（Orch がベースライン実測で確定）
- wave106 適用状態で `apps/authoring-host/src/ref-e2e.test.ts` が **6/7 赤**。エラーは `"Invalid input: expected \"dynamics-file-v3\""` とその連鎖。
- 破損箇所は `parsePackageDocumentFromFileSet`（`packages/package-format/src/package-file-set.ts:109`）の **package ロード時 throw**。原因データは `ref/model/dynamics.json` の `schemaVersion: "dynamics-file-v2"`（旧 pendulum スキーマ）。裁定#1（migration なし・v2 hard reject）との正面衝突。
- **wave106 起因を実測確定**: clean HEAD `dc9fae9c`（wave106 全変更を `git stash push -u` で退避）では **7/7 pass**、wave106 適用で 6/7 fail。stash は pop で完全復元。

### 台帳の盲点
`wave106-blast-radius-inventory.md:76` は authoring-host を「dynamics 専用コードなし＝無傷」と分類したが、ref-e2e が汎用ロード経路で v2 の ref データを読むことを見落とした。

> **教訓（L0 指示による一般則の記録）**: 「無傷」の判定はコードだけでなく、**そのコードが読むデータにも及ぶ**。スキーマの hard reject 化は、コードを一行も共有しない消費者を、データ経由で破壊しうる。以後の blast-radius inventory は「このコードが読む永続データはどの schemaVersion か」を無傷判定の必須観点に含めること。

### 解消（L0/ユーザー裁定 = 案(b)変形、2026-07-05）
ref/ はユーザー所有物であり、本件は**ユーザー裁定**である:
- **スコープ解除は ref/ 内の2ファイル限定**: `ref/model/dynamics.json`（v3 再生成）+ `ref/manifest.json`（`schemaVersions.dynamics` の1行のみ）。ref/ のその他（テクスチャ・メッシュ・キーフォーム等）は不可侵のまま。
- 実装は分離義務どおり別コンテキストの Gnome（opus）へ委任。報告: `wave106-domain-d-gnome-ref-v3-report.md`（v2→v3 対照表・スキーマ適合確認・AC 実測収録）。

### 採用した翻訳規則（決定論的近似。L0 推奨をそのまま採用、明文記録）
旧4ノブ（length/sway/reactionSpeed/convergenceSpeed）→ v3 の忠実翻訳は原理的に不可能（設計文書の前提）のため、以下の決定論的近似規則を全グループへ機械適用:

| v3 フィールド | 規則 |
|---|---|
| chain.rootOffset | `{x:0, y:0}` 固定（静止で offset=0 を保証） |
| chain.segmentLengths | `[length_v2 × 16]`（cm、N=1） |
| chain.damping | `convergenceSpeed_v2 × 0.6` |
| chain.gravityScale | `1.0` 固定 |
| input.kind | 維持 |
| input.scale | `(invert ? −1 : +1) × influencePercent/100 × (kind=angle: 1.0 / kind=positionX|Y: 3.0)` |
| output.segmentIndex | `1` |
| output.scale | `(invert ? −1 : +1) × strength_v2 / 30` |
| output.limit | 維持 |
| dynamicsGroupId / displayName / enabled / presetId | 維持 |
| sway / reactionSpeed（旧ノブ）・influencePercent / invert / normalization・output kind / strength | 廃止（残置ゼロ） |

適用結果（hair: segmentLengths=[4.8], damping=2.4 / tie: [5.6], 2.4 / 両 output scale=0.016666666666666666）。**翻訳値は較正前提の近似**であり、physical に妥当な揺れの追求は Editor Dynamics Tool での較正（設計 §8/§10 の運用導線）= model-authoring 側の次の閉問題に属する。

### 受け入れ条件（Gnome 実測 + Orch 独立再実行 + Review-Sylph 三重確認）
1. **ref-e2e 7/7 green** ✓（3者それぞれが独立に実行）
2. **静止ポーズ決定論レンダのバイト不変** ✓: `discussion/model-authoring/experiments/ref-render-gate/` は git clean のまま（HEAD `1f072704` とバイト一致）。v3 チェーンは静止で真下静定 → 既存決定論 assert 通過
3. **ref/ 変更の2ファイル局在** ✓: find/mtime で `ref/model/dynamics.json` + `ref/manifest.json` のみ。注記: `ref/` は `.gitignore:6` で ignore されており git diff では追跡不可（検証根拠は find/mtime + ref-e2e green + Gnome 対照表。将来 ref/ を追跡化する場合は検証手段の明示が必要）
4. **validate 診断に dynamics 由来の新規 blocking なし** ✓: counts `{error:97, blocking:0}`、97件は全て mask/rigControl の runtime-evidence 系既存診断（dynamics.\* = 0件）

## 2. Domain A/B/C 報告 + 全レビューレーンの照合（pass）

| ドメイン | 報告書 | 判定 | レビューレーン | 判定 |
|---|---|---|---|---|
| A Core Replacement | `wave106-domain-a-core-replacement-report.md` | pass | physics-spec-compliance / design-development / test-adequacy | 合格 / 要修正2→Gnome-4 で解消 / 要修正2→同左 |
| B Editor Dynamics Tool | `wave106-domain-b-editor-dynamics-tool-report.md` | pass | spec-compliance / test-adequacy | 合格 / 合格 |
| C Player Tuning v2 | `wave106-domain-c-player-tuning-v2-report.md` | pass | spec-compliance / test-adequacy | 合格 / 要修正 D-1→修正ループ15テスト新設で解消 |

レビュー7本 + final clean review の8本すべて `discussion/implementation/reviews/wave106/` に存在（一覧: 同ディレクトリ `_map.md`）。修正ループの解消は Orch と final clean review が独立実測で裏取り済み。

## 3. 旧識別子 grep gate（pass — 生きた残置ゼロ）

`additivePendulumV0` / `dynamics-file-v2` / `sway`(knob) / `reactionSpeed` / `convergenceSpeed` / `previousSourceVelocity` / `runtime-dynamics-pendulum-v1` / `dynamics-pendulum-solver-v1` を packages/apps/fixtures（+ Review-Sylph は ref も）で走査（node_modules・dist 除外、discussion/ の歴史的言及は対象外）。

- production 残置 **0**。ヒットは (a) `param_hair_sway` 等の**部位 ID 命名**（物理描写であって knob ではない）、(b) v2 reject / v1 profile 破棄を検証する**負テストの legacy payload**（`package-document.test.ts:191-220` / `dynamics-tuning-profile-store.test.ts:129-149`）のみ = いずれも正当。
- ref/ の v2 残置（初版報告時の唯一の実データ残置）は §1 の v3 再生成で解消済み。**リポジトリ内の loadable model data に v2 は存在しない**（fixtures は Domain A が全量 v3 化済みを確認）。

## 4. Forbidden-scope diff check（pass）

| 項目 | 結果 |
|---|---|
| `ref/` | 変更はユーザー裁定の2ファイルのみ（gitignore 対象、find/mtime で局在確認）。その他不可侵維持 |
| `packages/render-software/**` / `packages/render-webgl2/**` | 無変更 |
| 新規依存 / lockfile / npm manifest | ゼロ（変更 `package.json` は fixture model-data 1件のみ = `fixtures/contracts/invalid-rigControl-cycle/package.json` の schemaVersion 1行、dependencies キー無変更） |
| `git diff --check` | clean |
| `apps/authoring-host/**` ソース | 無変更（ロード経路の破損は §1 のデータ側修正で解消） |

## 5. check-source-organization / check-dependencies（pass、新規 finding ゼロ）

- `check-source-organization.mjs` → passed（exit 0）
- `check-dependencies.mjs` → exit 0。出力の「pnpm-lock.yaml: Cubism cmo3」は既知の先行偽陽性（lockfile は wave106 無変更 = 定義上 pre-existing、非ゲート）

## 6. Focused テスト・tsc（dynamics 系 = 全 green、Orch 直接実行）

| スコープ | 結果 |
|---|---|
| packages dynamics 系 8ファイル（dynamics-evaluation / dynamics-semantic / dynamics-mutations / create-dynamics-group / dynamics-contract-evidence ×3 / package-document） | **58/58 pass** |
| editor dynamics 系 4ファイル（tool-state / inspector / playback / runtime-screen） | **50/50 pass** |
| player tuning 系 8ファイル（bridge-handlers / request-validation / profile-groups / parser / save-controller / store / state / effective-dynamics-tuning） | **28/28 pass** |
| authoring-host 全体（§1 解消後） | **82/82 pass（15ファイル、ref-e2e 7/7 含む）** |
| root tsc（= packages スコープ） / player tsc / authoring-host tsc | **すべて exit 0** |

final clean review も独立抽出（ref-e2e 7/7 + dynamics focused 44 green + root tsc 0）で再現。

## 7. Pre-existing 台帳（wave106 通過時点の既知 pre-existing 一覧 — 後続 wave の掃き出しリスト）

各項目を Orch が clean HEAD `dc9fae9c` の git stash 実測、または wave106 未変更（git status 0 hit）＋失敗内容の非 dynamics 性で独立検証。final clean review が P1/P4 を抽出再検証。**すべて wave 外 in-flight 作業由来で、wave106 起因ゼロ。**

| # | 内容 | 検証 | 由来 / 掃き出し先 |
|---|---|---|---|
| P1 | packages vitest 赤 **14件/13ファイル**（operation-core 9 + runtime-core 2 + validator-core 3。tutorial recipe×preset 衝突 / variants golden ずれ / createParameter semanticRole / keyform 検証・snapshot baseValue） | stash 実測: clean HEAD で同一14件が赤 | in-flight variant/keyform/tutorial 作業。後続 wave |
| P2 | editor tsc **22 errors/14ファイル**（variant 5 / mesh triangleStableIds・topologyRevision / session exactOptional。dynamics 起因ゼロ = keyword 分類 + 該当行未接触を確認。Domain B は着手前の dynamics 由来 166 errors を全消し・新規ゼロ） | エラー全件分類 + 22件中 wave106 変更ファイルは1つ（その3 errors も mesh 行 618-620、diff は行393 近傍で不交差） | in-flight variant/mesh/session 作業。後続 wave（literal editor tsc exit 0 はこの解消後に回復） |
| P3 | editor テスト赤 **4件**（`diagnostics-jump-actions.test.ts`、entry 名 `"import"→"workspace"` リネーム由来。うち2件はテスト名に dynamics を含むが原因はリネーム） | 実装・テストとも wave106 未変更 | HEAD `6645c2fe` コミット済み。後続 |
| P4 | player テスト赤 **2件**（browser-source 系 `toStrictEqual` shape: `effectiveDynamicsTuning: null` / `activeVariantSelection` の期待値未追随） | 両テストファイル wave106 未変更（Domain C は HEAD `4627bbd3` stash 実測済み） | response contract にフィールドを追加したドメインの追随漏れ。後続 |
| P5 | check-deps「pnpm-lock.yaml: Cubism cmo3」finding | exit 0 非ゲート、lockfile 無変更 | 既知の先行偽陽性。分類継続 |

（初版報告の P6 = ref-e2e 赤6件は wave106 起因であり pre-existing ではなかった。§1 のとおり本 wave 内で解消済みのため台帳から除去。）

## 8. Map Closeout（完了）

1. `discussion/implementation/waves/wave106/_map.md` — 新規作成（Domain 報告一覧 + Notes + Final Gate）
2. `discussion/implementation/reviews/wave106/_map.md` — 新規作成（8レビューの lane/verdict 一覧）
3. `discussion/implementation/orchestration/_map.md` — wave106 行を Final complete / pass へ更新
4. `discussion/design/_map.md` — dynamics-world-frame-chain.md 行を「Accepted / wave106 implemented」へ更新
5. `discussion/design/dynamics-world-frame-chain.md` — 冒頭 Status 行のみ「Accepted / wave106 implemented」へ更新（本文の式・裁定は無変更。実装で確定した細部の追記は L0 が別途行う）

## 9. Final Clean Integration Review（独立 Review-Sylph, opus）

- レポート: `discussion/implementation/reviews/wave106/wave106-final-clean-integration-review.md`
- 判定: **合格（pass、要修正差分なし）**
- 全6観点を自コンテキストで独立再実行・照合（ref-e2e 7/7 / dynamics focused 44 green / root tsc 0 / ref v3 翻訳規則の全数値再計算検算一致 / 廃止フィールドゼロ / render-gate バイト不変 / 旧識別子 production ゼロ / forbidden-scope 無変更 / 台帳 P1・P4 抽出検証 / 7レビュー修正ループ解消の裏取り）
- **ユーザー/L0 裁定3件を certify 対象として明記**: ①ベースライン比較型ゲート ②ref/ 2ファイルスコープ解除（ユーザー裁定）③決定論的近似翻訳規則

## 10. 起動した全子 agentId と閉域結果（規則5）

| agentId | 役割 | 成果物 | 閉域結果 |
|---|---|---|---|
| `a0b041ead6dd10937` | Gnome（ref/ dynamics v2→v3 再生成） | `wave106-domain-d-gnome-ref-v3-report.md` | completed（完了通知受領・成果物回収済み） |
| `a7793be5db761d0a7` | Review-Sylph（final clean integration review） | `wave106-final-clean-integration-review.md` | completed（完了通知受領・成果物回収済み） |

両者とも子エージェントの起動はゼロ（各報告に明記）。**孤児なし・掃除リスト空**（Domain A/B の孫2体の掃除リストは各ドメイン報告に記載済み = 衛生問題のみ）。

## 11. 残課題 / 後続への申し送り

1. **Pre-existing 台帳 P1〜P5 の掃き出し**（§7）。特に P2 の解消が literal な editor tsc exit 0 の回復条件。
2. **ref の dynamics 較正**: 翻訳値（segmentLengths 4.8/5.6cm は設計 §8 の hair 帯 [14]cm と乖離）は決定論的近似であり、Hair Sway の実 rigging・較正は model-authoring 側の次の閉問題（計画 §14 Out of Scope、設計 §8/§10 の運用導線）。tie グループの `presetId: "hair"`（元データ通り維持）の見直しも同枠。
3. **ref/ が gitignore 対象である点**: ref 内変更は git で追跡不可。将来 ref/ を追跡化する運用に変える場合、検証手段（find/mtime 等）の明示が必要（final clean review 質問1）。
4. **Domain B 申し送りの被覆ギャップ**（非 blocking）: 多段 N≥2 の editor 物理出力テスト / 複数 output の editor 経路テスト / settled B項単独検証。N≥2 実運用の wave で回帰リスクとして扱う。

## 12. Basis Coverage（計画 §11 Verification Matrix 全行）

| Requirement | Minimum evidence | 状態 |
|---|---|---|
| 収束点が重力方向（症状治療） | 平衡点テスト①②③（−φ / 0 / −φ、誤差<0.005°） | pass |
| 振り子として物理妥当 | 周期√則（独立再現 ratio 1.0000）+ 減衰単調性 + 拘束剛性 | pass |
| kind が意味を持つ | 角度定常(−φ) vs 並進定常(0) の差 >1° | pass |
| 決定論・固定ステップ不変 | 2回実行一致 + advanceRuntimeState diff ゼロ + 加算合成不変 | pass |
| 旧データ・旧プロファイルが黙って壊れない | v2 reject / 廃止フィールド reject / v1 profile 破棄テスト | pass |
| CLI 経路が生きている | operation dry-run→commit green + **authoring-host 82/82（ref-e2e 7/7 含む）** | pass |
| Editor プレビューで確認できる | Dynamics Tool プレビュー駆動 + settled 新判定テスト | pass |
| 配信時微調整が効く | override 乗数の数値テスト（意味論検算可能） | pass |
