# Wave106 Domain D — Gnome 実装報告: ref/ dynamics データ v2→v3 再生成

- 役割: Gnome（実装）／ Orch-Sylph（Wave106 Domain D = Final Integration）からのサブエージェント委任
- 対象: `ref/model/dynamics.json`（`dynamics-file-v2` → `dynamics-file-v3` 再生成）と `ref/manifest.json`（バージョン文字列参照更新のみ）
- 正典: `discussion/design/dynamics-world-frame-chain.md` §4（スキーマ）/ §8（プリセット帯）、`packages/package-format/src/model-files.ts` の Zod スキーマ（L352–356, L178–212）
- 結論: **受け入れ条件 1〜4 すべて達成。escalate 事象なし。** 変更は許可スコープの2ファイル + 本報告書のみ。

---

## 1. 採用した翻訳規則（明文）

L0 推奨規則を**そのまま**採用した（変更なし）。決定論的・検証可能な近似翻訳を1つ定めて全グループへ機械適用した。生成は scratchpad の使い捨てスクリプト（`gen-v3.mjs`、リポジトリには残さず）で行い、出力を手動で確認して書き込んだ。キー順は既存 v2 ファイルの正準（全オブジェクトでキーをアルファベット昇順）に一致させた。

### chain（グループごとに1本、旧 `pendulums[0]` の後継）
- `rootOffset = { x: 0, y: 0 }`（静止で offset=0 を保証するため。§3.4/§4）
- `segmentLengths = [ length_v2 × 16 ]`（cm、単一セグメント N=1）
- `damping = convergenceSpeed_v2 × 0.6`
- `gravityScale = 1.0`

### input（`kind` 維持、`influencePercent`/`invert`/`normalization` を scale 一本に畳み込み）
- `scale = (invert ? −1 : +1) × (influencePercent / 100) × factor`
  - `factor = 1.0`（kind=angle）/ `3.0`（kind=positionX|Y）
  - 設計 §10 使用例（FaceZ ±10 deg → `angle, scale 1.0`／FaceX ±1.0 正規化 → `positionX, scale 3.0`）に整合

### output（`kind`/`strength`/`invert` を廃止、`segmentIndex` 新設）
- `segmentIndex = 1`
- `scale = (invert ? −1 : +1) × (strength_v2 / 30)`（invert は scale 符号に畳み込み。単位 = パラメータ単位/deg、§8 の「1.0=30°」起点に整合）
- `limit` 維持

### 維持したフィールド
- `dynamicsGroupId` / `displayName` / `enabled` / `presetId`（v3 スキーマでも存続する既存フィールド）

### 残置しなかった廃止フィールド（§4 廃止一覧に準拠）
- chain 側: `pendulums`（length/sway/reactionSpeed/convergenceSpeed の4ノブ配列）
- input 側: `influencePercent` / `invert` / `normalization`
- output 側: `kind` / `strength` / `invert`

### 決定論の担保
- 全数値は有限小数または JS 標準 `JSON.stringify` の安定表現。`strength/30 = 0.5/30` は JS で一意に `0.016666666666666666` に評価され（round-trip 安定を確認済み）、両グループとも同値。
- キー順はアルファベット昇順に正規化（既存ファイルと同一の正準）。→ 再生成しても同一バイト列。

---

## 2. v2 → v3 変換前後の対照表

### グループ `dyn_hair_dynamics`（presetId=hair, displayName="Hair Dynamics", enabled=true）

chain:

| v2 pendulum | 値 | → v3 chain | 値 | 算出 |
|---|---|---|---|---|
| length | 0.3 | segmentLengths | [4.8] | 0.3 × 16 |
| convergenceSpeed | 4 | damping | 2.4 | 4 × 0.6 |
| （sway 0.75 / reactionSpeed 14）| — | — | 廃止 | — |
| — | — | gravityScale | 1.0 | 固定 |
| — | — | rootOffset | {x:0, y:0} | 固定 |

inputs（全て influencePercent=100, invert=false）:

| parameterId | kind（維持）| factor | → scale |
|---|---|---|---|
| param_face_angle_x | positionX | 3.0 | 3 |
| param_body_angle_x | positionX | 3.0 | 3 |
| param_face_angle_z | angle | 1.0 | 1 |
| param_body_angle_z | angle | 1.0 | 1 |

outputs:

| v2 (kind=angle, strength=0.5, invert=false, limit=1.2) | → v3 |
|---|---|
| parameterId=param_hair_front_sway_x | parameterId=param_hair_front_sway_x |
| — | segmentIndex=1 |
| strength 0.5 | scale = 0.5/30 = 0.016666666666666666 |
| limit 1.2 | limit 1.2（維持）|

### グループ `dyn_tie_dynamics`（presetId=hair, displayName="tie Dynamics", enabled=true）

chain:

| v2 pendulum | 値 | → v3 chain | 値 | 算出 |
|---|---|---|---|---|
| length | 0.35 | segmentLengths | [5.6] | 0.35 × 16 |
| convergenceSpeed | 4 | damping | 2.4 | 4 × 0.6 |
| （sway 0.75 / reactionSpeed 12）| — | — | 廃止 | — |
| — | — | gravityScale | 1.0 | 固定 |
| — | — | rootOffset | {x:0, y:0} | 固定 |

inputs（全て influencePercent=100, invert=false）:

| parameterId | kind（維持）| factor | → scale |
|---|---|---|---|
| param_body_angle_x | angle | 1.0 | 1 |
| param_body_angle_z | angle | 1.0 | 1 |

outputs:

| v2 (kind=angle, strength=0.5, invert=false, limit=1.2) | → v3 |
|---|---|
| parameterId=param_accessory_sway_x | parameterId=param_accessory_sway_x |
| — | segmentIndex=1 |
| strength 0.5 | scale = 0.5/30 = 0.016666666666666666 |
| limit 1.2 | limit 1.2（維持）|

トップレベル: `schemaVersion` = `dynamics-file-v2` → `dynamics-file-v3`。

### スキーマ適合確認（`packages/package-format/src/model-files.ts`）
- segmentLengths: `finite positive`（4.8 / 5.6 > 0）✓、`min(1)` 要素 ✓
- damping: `finite ≥ 0`（2.4）✓ / gravityScale: `finite ≥ 0`（1.0）✓
- input.scale: `finite`（1 / 3）✓
- output.segmentIndex: `int ≥ 1`（1）✓ / output.scale: `finite` ✓ / output.limit: `finite ≥ 0`（1.2）✓
- `unstableSettings`（§7 新基準 `damping>60 || segmentLengths.some(L<0.1) || N>16 || gravityScale>10`）にはどの値も抵触しない → warning も出ない見込み。

---

## 3. 受け入れ条件 1〜4 の実測結果

### AC#1 — ref-e2e 7/7 green ✓
コマンド: `npx vitest run apps/authoring-host/src/ref-e2e.test.ts`
結果: **Test Files 1 passed / Tests 7 passed（0 failed）**。7本すべて green（validatePackage / derived-verified dimensions / render gate PNG×3 / measurement / Ware group gating / Rodos override / unknown variant reject）。
（変更前は §背景のとおり v2 hard reject で 6/7 赤。v3 化により `parsePackageDocumentFromFileSet` の throw が解消。）

### AC#2 — 静止ポーズ決定論レンダのバイト不変 ✓
コマンド: `git status --short -- discussion/model-authoring/experiments/ref-render-gate/`
結果: **空**（差分なし）。ref-e2e 実行後も gate PNG/JSON artifacts は commit 済みクリーンのまま。v3 チェーンは静止で rootOffset=0 → 質点は真下静定 → 既存の決定論 assert が通り artifacts にバイト差なし。**escalate 不要。**

### AC#3 — ref/ diff の局在 ✓
コマンド: `git status --short -- ref/`
結果: **空**。
補足（重要な機構）: `ref/` は `.gitignore:6` で丸ごと ignore されている（`git check-ignore -v ref/model/dynamics.json` → `.gitignore:6:ref/`）。よって git 追跡上の diff は原理的に発生せず、AC#3 は「予期しない追跡ファイル変更が出ない」意味で満たされる。
実変更の局在は**ファイルシステム上**で二重確認: `find ref/ -type f -mmin -20` の出力は `ref/manifest.json` と `ref/model/dynamics.json` の**2ファイルのみ**。テクスチャ/メッシュ/キーフォーム/パラメータ等は未変更。manifest は `schemaVersions.dynamics` の1行のみ変更（他キー不変、`modelFiles.dynamics` のパス参照は据え置き）。

### AC#4 — validatePackage 診断状況の観察 ✓（新規 dynamics blocking なし）
ref-e2e 1本目の validate counts: `{"info":0,"warning":0,"error":97,"blocking":0}`。
失敗チェックの内訳を使い捨てプローブ（`checks[].checkId` を集計、実行後に即削除しツリークリーンを確認）で厳密に列挙:

| checkId | 件数 | severity | dynamics 由来か |
|---|---|---|---|
| rigControl.runtimeEvidenceMissing | 88 | error | 否 |
| rigControl.warpLatticeUnsupportedProperty | 6 | error | 否 |
| mask.runtimeEvidenceMissing | 3 | error | 否 |
| **dynamics.\*** | **0** | — | — |

- **dynamics 由来の失敗チェックは 0 件、blocking も 0 件。** 97 errors は全て mask/rigControl の runtime-evidence 系（ref に runtime snapshot が無いことに起因する既存の非 blocking 診断）で、本 v3 化とは無関係。
- 参照パラメータ（param_face_angle_x 等）は `ref/model/parameters.json` の `parameters: []`（空配列）に対し dangling だが、これは v2 時点から同一 parameterId で存在した**既存条件**であり、`dynamics.driverMissing/inputMissing/outputMissing` は失敗チェックとして surface しなかった（blocking なし）。診断が記録されること自体は §3.5 / 委任条件より fail 条件ではない。

---

## 4. 変更ファイル一覧

許可スコープ内の2ファイル + 本報告書のみ。それ以外（packages / apps / fixtures / 他 discussion / ref 内の他ファイル）は一切未変更。`pnpm install`・新規依存・回避工作なし。

1. `ref/model/dynamics.json` — v3 全再生成（gitignore 対象）
2. `ref/manifest.json` — `schemaVersions.dynamics` の値のみ `dynamics-file-v2` → `dynamics-file-v3`（gitignore 対象）
3. `discussion/implementation/waves/wave106/wave106-domain-d-gnome-ref-v3-report.md` — 本報告書（新規、追跡対象）

scratchpad の生成スクリプト（`gen-v3.mjs`）と AC#4 用の使い捨て vitest プローブは実行後に破棄済み。リポジトリには残していない（プローブ削除後 `git status --short` で当該パスがクリーンであることを確認）。

---

## 5. 質問・懸念

1. **プリセット帯とのズレ（要 L0/Undine 判断、ただし本タスク受け入れには影響なし）**: L0 規則 `length_v2 × 16` は hair グループで segmentLengths=[4.8]cm を生む。設計 §8 の hair プリセット帯は [14]cm。翻訳規則は「決定論的近似」であり §8 は「較正前提の初期値」なので受け入れ条件は満たすが、**physical に妥当な揺れ挙動を得たい場合、後日 Editor Dynamics Tool プレビューでの較正が前提**（§8/§10 の運用導線どおり）。委任の翻訳規則を literal に適用しており、ここで帯へ寄せる調整は行っていない（規則の一貫性優先）。判断が必要なら報告として上げる。

2. **presetId="hair" のまま（tie グループ含む）**: v2 では tie グループも `presetId: "hair"`（元データの通り）。委任「presetId 維持」に従いそのまま維持した。tie に `ribbon` / `rigidAccessory` 等がより適切という設計意図があれば別途指示を要するが、本タスクスコープ外と判断。

3. **ref/ が gitignore 対象である点**: AC#3 の「diff 局在」は git 追跡ベースでは自明成立（ref/ 全体 ignore）。実質的な局在は find ベースで2ファイルに限定と確認済み。将来 ref/ を追跡対象にする運用へ変える場合、この検証手段（find + mtime）を明示する必要がある。

以上。escalate 事象なし。受け入れ条件 1〜4 達成。
