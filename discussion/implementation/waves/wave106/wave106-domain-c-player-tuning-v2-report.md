# Wave106 Domain C `wave106-player-tuning-v2` — Orch-Sylph 最終報告

- 呼び出し元: Undine（L0）
- ドメイン: Domain C = runtime-player Dynamics Tuning Profile v2
- オラクル: `discussion/design/dynamics-world-frame-chain.md`（§9 tuning profile v2 / §5 命名 / §6 裁定 #2）
- 拘束台帳: `discussion/implementation/orchestration/wave106-blast-radius-inventory.md`（apps/runtime-player 節）
- 前提: Domain A（Core Replacement）pass 済み。packages 全層は dynamics-file-v3 へ置換済みで未コミットで作業ツリーに同居。

## 判定: **pass**

apps/runtime-player の dynamics tuning profile を dynamics-file-v3 / profile v2 語彙（`runtime-player-dynamics-tuning-profile-v2`、override `{enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale?}`）へ全面書き換え。tsc exit 0、tuning/dynamics 関連テスト全 green、既存赤は着手前と同一の2件のみ（Domain C 起因ゼロ）。2レビュー（Spec Compliance 合格 / Test Adequacy 要修正→修正ループで解消）。

## ループ回数

- Gnome 実装: 初回実装1回（Gnome-C `ac50d93112aad2a59`）+ 修正ループ1回（同 agentId を SendMessage でコンテキスト継続）= 実質2ループ。
- レビュー: 2レーン並列1回 + Orch 直接独立検証（tsc / grep / 追加テスト実行 / 既存赤の git stash 実測）。

## 変更ファイル（すべて `apps/runtime-player/src/**` スコープ内。packages / editor / authoring-host 無変更）

### 本体ソース
- `preload/dynamics-tuning-bridge-contract.ts` — schemaVersion literal → `runtime-player-dynamics-tuning-profile-v2`、`RuntimePlayerDynamicsTuningGroupOverride` を v2 語彙 `{enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale?}` へ、`RuntimePlayerDynamicsTuningValues` を v2 観測量へ
- `stage/runtime-evaluation/effective-dynamics-tuning.ts` — `applyDynamicsTuningToGroup` / `cloneDynamicsGroup` を新スキーマ（chain / inputs{scale} / outputs{segmentIndex,scale,limit}）+ v2 乗数意味論へ
- `stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts` — `createDynamicsGroupMap` を `NormalizedDynamicsGroup` 新形へ（台帳未列挙だが effective-dynamics-tuning の下流・apps スコープ内・packages 無変更で解消、escalate 不要と裁定）
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-groups.ts` — createExportedValues / applyGroupOverride / sanitizeGroupOverride / outputSummary の kind 表示を v2 化
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-parser.ts` — `parseGroupOverride` を v2 フィールドへ（v1 は schemaVersion 厳密一致で自動 `ok:false`、既存機構を利用＝移行コードなし）
- `main/dynamics-tuning-profiles/dynamics-tuning-signature.ts` — 署名対象を新スキーマ（inputs{parameterId,kind,scale} / chain{rootOffset,segmentLengths,damping,gravityScale} / outputs{parameterId,segmentIndex,scale,limit}）へ。solver 節据え置き、ソート決定性維持（outputs は parameterId→segmentIndex）
- `main/dynamics-tuning-bridge-request-validation.ts` — `readDynamicsTuningGroupUpdateRequest` を v2 フィールドへ（IPC 検証）
- `stage/browser-source/browser-source-server-message.ts` — `readDynamicsTuningGroupOverride`（Browser Source IPC の override パーサ）を v2 化（台帳未列挙だが apps スコープ内・契約型は bridge-contract で凍結済み・波及ゼロ、旧語彙残置は実質破損のため修正）
- `control/dynamics-tune-page.tsx` — スライダー spec を v2（outputScale / lengthScale / limit / damping / gravityScale）へ、ラベル・aria-label 更新

### 型追従・ロジック不変（Gnome が編集不要と確認）
- `dynamics-tuning-profile-document.ts` / `dynamics-tuning-state.ts` / `dynamics-tuning-profile-store.ts` / `dynamics-tuning-profile-save-controller.ts` は import 型経由で自動追従、ロジック不変。

### テスト（新語彙・新スキーマ化 + 新設）
初回23ファイル書き換え + 修正ループで4テストファイル追加:
- 新設 `main/dynamics-tuning-bridge-request-validation.test.ts`（無効値 reject 7）
- 新設 `main/dynamics-tuning-profiles/dynamics-tuning-profile-groups.test.ts`（sanitize drop + 症状連結 5）
- 新設 `main/dynamics-tuning-profiles/dynamics-tuning-profile-parser.test.ts`（無効値 null 化 + warning 3）
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-store.test.ts`（v1 破棄テスト + D-2 の end-to-end 既定値連結 assert 追記）
- override 乗数の数値テスト（`effective-dynamics-tuning.test.ts`）、v2 語彙化（dynamics-tune-page / control-window-app.dynamics-tune / dynamics-tuning-state / save-controller / bridge-handlers / default-pose-evaluation / evaluation-cache / variant-visibility / stage-scene / directory-loader / browser-source 系）

## テスト・tsc 結果（Orch 独立検証済み）

| スコープ | 結果 |
|---|---|
| `npx tsc --noEmit -p apps/runtime-player/tsconfig.json` | **exit 0**（着手前 dynamics 起因エラー多数を全消し） |
| 中核 tuning テスト（初回） | 21/21 pass |
| adapter 経由評価系 | 51/51 pass |
| 修正ループ追加4ファイル | 19/19 pass（Orch が直接 vitest 実行で確認） |
| runtime-player 全体 | **441 pass / 2 fail**（total 443） |

- **tsc 検証スコープ注記**: 完了条件が指定する `apps/runtime-player/tsconfig.json` がそのまま存在し、そのプロジェクト単位で exit 0 を確認。最小包含の追加検証は不要だった。

### 既存赤2件の切り分け（Orch が git stash で HEAD ベースライン実測）
- `main/broadcast-source/browser-source-server.test.ts`（"serves current Runtime Export payload ..."）
- `stage/browser-source/browser-source-server-message.test.ts`（"accepts the not-loaded response shape"）

両者は `toStrictEqual` の shape mismatch で、`not-loaded` レスポンスに実装が `effectiveDynamicsTuning: null` を含めるがテスト期待値が未追随、という**フィールド有無**の不整合。原因フィールドは HEAD 版（コミット `4627bbd3`）に既に存在し Gnome の diff に追加はない。**作業ツリー全体を `git stash push -u` して HEAD 状態で当該2テストを実行し、同一に2 fail することを Orch が実測確認**（stash pop で復元済み）。Domain C 起因ではなく、Domain C の変更（override 語彙のフィールド名置換）はこの2赤と独立。Spec / Test Adequacy 両レーンも独立に同結論。**Domain C では触らず残置**（response contract に `effectiveDynamicsTuning` を追加した別ドメインの追随タスク）。

## レビュー判定（2レーン、`discussion/implementation/reviews/wave106/`）

| レーン | レポート | 判定 |
|---|---|---|
| Spec Compliance（design/dev 含む） | `wave106-domain-c-spec-compliance-review.md` | **合格**（override 語彙 §9 完全一致・乗数意味論忠実・移行コードなし=裁定#2・旧語彙残置ゼロ・packages 無変更・命名§5・signature 更新・境界バリデーション整合を全観点で確認。裁量判断も妥当と追認） |
| Test Adequacy | `wave106-domain-c-test-adequacy-review.md` | **要修正（D-1）→ 修正ループで解消**（override 乗数の数値テスト・v1破棄テスト・v2語彙化は合格水準。D-1=無効値 reject/sanitize が validation/sanitize/parser 3層で不在→修正ループで15テスト新設。D-2=v1破棄→既定値の end-to-end 連結→store.test.ts に追記。既存赤2件は blocking にせず） |

- Test Adequacy レポートは判定時点（要修正）の記録として保存。D-1/D-2 の解消は本報告書とGnome報告「## 修正ループ（D-1/D-2）」節に記録。

## 裁量判断（Orch 追認済み）

1. **意味論裁定「Scale 接尾辞＝乗数、それ以外＝置換」**: §9 は outputScale/lengthScale を「乗数」と明記するが limit/damping/gravityScale の適用法は非明示。命名の自然な読みとして `outputScale`=各 output.scale への乗算、`lengthScale`=全 segmentLengths への乗算、`limit`/`damping`/`gravityScale`/`enabled`=置換（`override.X ?? 基準`）と裁定。数値テスト（scale 0.5×2=1.0、[12,6]×1.5=[18,9]、置換系は素通し）で検算固定。Spec レーンが §9 の自然な読みとして妥当と追認。
2. **outputSummary の kind 扱い**: 新スキーマの output に `kind` が無いため outputSummary の kind を `segment ${segmentIndex}`（例 `"segment 1"`）へ。`RuntimePlayerDynamicsTuningParameterRef.kind: string` を維持（optional 化せず）。
3. **スライダー範囲**: 乗数系 outputScale/lengthScale = 0.1〜3/step0.05（恒等元 1.0 中央付近）、置換系 limit 0〜2、damping 0〜60、gravityScale 0〜10（§7 unstableSettings 上限を参照）。
4. **表示値の基準**: 乗数系=恒等元 1.0、置換系=実効値（limit=outputs[0].limit / damping=chain.damping / gravityScale=chain.gravityScale / enabled=group.enabled）。バリデーション: Scale 系=正数、置換系（数値）=非負、enabled=boolean。
5. **署名 outputs ソート鍵**: 旧 kind 消滅につき parameterId→segmentIndex の 2 段ソートで決定性維持。
6. **台帳未列挙の2ファイル修正**（runtime-export-runtime-graph-adapter.ts / browser-source-server-message.ts）: いずれも apps/runtime-player/src スコープ内・packages 無変更・IPC 契約型は bridge-contract で凍結済みで波及ゼロ。旧語彙のまま残すと実質破損のため修正。escalate 不要と裁定。

## escalate 判定

なし。§9 の意味論は上記裁定で全て解決、preload/IPC 境界の契約変更は bridge-contract 内に閉じ他 app/packages へ波及せず、packages 変更・pnpm install・新規依存・回避工作いずれもなし。

## 残課題 / 他ドメイン引き継ぎ

1. **既存赤2件（browser-source 系 `effectiveDynamicsTuning: null` shape 不整合）**: 着手前 HEAD `4627bbd3` 由来。response contract に `effectiveDynamicsTuning` フィールドを追加したドメインのテスト期待値未更新が原因。Domain C 起因ゼロ・未 touch。Domain D の最終統合 or 別途で当該2テストの期待値を追随させるべき既存問題（`browser-source-server.test.ts` / `browser-source-server-message.test.ts`）。
2. **表示関数の多重防御（実バグではない・任意改善）**: `dynamics-tuning-profile-groups.ts` の `createDynamicsTuningGroupStatuses` は受け取った overrides を非 sanitize で `applyGroupOverride`（表示用 effectiveValues）へ渡す。実運用ではこの関数への overrides は必ず state 側（updateGroup / getEffectiveProfile / restore）で sanitize 済みで、乗算経路（effective-dynamics-tuning→adapter）にも無効値は到達しないため「負値素通り→符号反転」は発火しない。テストは実運用経路（sanitize 済み空マップ→恒等）を固定。多重防御（表示関数も防御的 sanitize）を望むなら別タスク。Domain C 完了条件には非該当。

## 起動した全子 agentId と閉域結果

| agentId | 役割 | 成果物 | 閉域結果 |
|---|---|---|---|
| `ac50d93112aad2a59` | Gnome-C（実装 + 修正ループを SendMessage で継続） | `wave106-domain-c-gnome-report.md`（修正ループ節含む） | completed（TaskStop: not running 確認） |
| `a6c0113b39f580e9c` | Review-Sylph Spec Compliance | `wave106-domain-c-spec-compliance-review.md` | completed（TaskStop: not running 確認） |
| `aecef7087b29d4921` | Review-Sylph Test Adequacy | `wave106-domain-c-test-adequacy-review.md` | completed（TaskStop: not running 確認） |

**孤児なし。** 3子とも completed 状態で TaskStop 照合済み（生存タスクゼロ）。孫エージェントの起動は各子の報告になく、掃除リストは空。

### 子との連絡についての注記（L0 へ）
修正ループは Gnome-C を SendMessage（agentId 指定）で再開しコンテキストを継続できた。ただし Gnome 側の最終メッセージに「`Sylph` 名への SendMessage が届かない」旨の記述があった（Gnome が親へ返信を試みた形跡）。これは規則3「子から親への SendMessage は届かない」の実測どおりで、Gnome の成果物ファイル追記は正しく回収できているため実害なし。

## Basis Coverage（設計 → 実装 → 検証。計画 §11 の該当行）

| 検証項目 | 最小 evidence | 状態 |
|---|---|---|
| 旧プロファイルが黙って壊れない | v1 プロファイル破棄テスト（schemaVersion 厳密一致で read-failed / null → 既定値クローンで動く end-to-end） | pass |
| 配信時微調整が効く | override 乗数の数値テスト（outputScale 2×0.5=1.0 / lengthScale 1.5×[12,6]=[18,9] / 置換系素通し、取り違え検出可） | pass |
| v2 の新不変条件（Scale 系 positive-only） | 無効値 reject/sanitize テスト（validation throw / sanitize drop / parser null化+warning の3層） | pass（修正ループで新設） |
| tsc 健全性 | `apps/runtime-player/tsconfig.json` exit 0 | pass |
| 非退行 | 全体 441 pass / 2 fail（2 は着手前 HEAD 由来既存赤、git stash 実測） | pass |
| 旧語彙残置ゼロ | grep（sway/reactionSpeed/convergenceSpeed/tuning 文脈 strength/pendulum/profile v1 literal が非テスト source ゼロ） | pass |
