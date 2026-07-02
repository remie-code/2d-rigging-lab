# Wave104 Domain B — Test Adequacy Review

Verdict: pass

- Reviewer: Review-Sylph (Test Adequacy レーン)
- Domain: `wave104-read-integration-validate-chores`
- 観点: テストが要件を実証しているか（オウム返し・実装依存の空テストでないか）
- Source of truth: `discussion/implementation/orchestration/wave104-plan.md` §7 Required tests / §11 Verification Matrix (Domain B 行)

## サマリ

Domain B の Required test 5 項目すべてに対応するテストが存在し、いずれも実証強度が十分（実挙動を assert し、report 内容・ピクセル値・capability 区別まで検証、vacuous pass 防止の sanity assert あり）。既存テストファイルは一切改変されておらず（git status で全て `M` / `??` の対象外）、非退行の「基準が緩められていない」ことが構造的に実証された。全レーンのテストを自ら実行し、申告値と一致することを確認した。blocking finding なし。

## テスト実行結果（自己実行、申告値と照合）

| スイート | 実測 | 申告 | 判定 |
|---|---|---|---|
| `packages/ai-interface`（root config） | 101 passed / 16 files / 0 failed | 94 passed（既存88非退行） | 一致（下記注記） |
| `apps/authoring-host`（app-local config） | 37 passed / 9 files / 0 failed | 26 passed | 一致（下記注記） |
| `packages/render-software`（root config） | 37 passed / 7 files / 0 failed | 37（既存33 + B-1 4） | 完全一致 |

注記（申告値との差分は不整合ではなく内訳の範囲取りの差）:

- ai-interface 101 = 既存 88 + read-integration 新規 6 + render-view 新規 7（後者は Domain A 所有）。申告 94 は render-view 7 を除いた Domain B 視点の数と整合。0 failed で 88 非退行成立。承認ライフサイクル系（`ai-codex-proposal-approval-lifecycle` 6 / `ai-operation-command` 11）も全 pass。
- authoring-host 37 = Domain B 所有 18（validate-package-document 3 + validate-package-command 4 + state-directory-guard 11）+ 既存 8（closed-problem-01 1 + run-authoring-host-command 5 + cli-cross-process 2）+ Domain A 所有 render-view 系 11。**Domain B + 既存 = 26 で申告と完全一致**。承認ライフサイクル非退行の証拠として `cli-cross-process`（dry-run approval carry / commit refusal）も pass。

実行上の注意（環境問題ではない）: `apps/authoring-host` は `pnpm install`-linked ではなく、`apps/authoring-host/vitest.config.ts` が workspace パッケージを TS entrypoint に alias する。root から `npx vitest run apps/authoring-host/...` を実行すると root config が使われ alias が効かず `Cannot find package '@private-2d-rigging-lab/validator-core'` で collect 失敗する。app ディレクトリ内で実行すれば正しく解決し全 pass する。これはテスト側の欠陥ではなく実行方法の問題。

## Required tests → 対応テスト → 実証強度 マッピング

### §7-1 統合後の executor テスト（`packages/ai-interface/src/ai-executor-read-integration.test.ts`）

| Required 観点 | 対応テスト | 実証強度 |
|---|---|---|
| host 未実装メソッドで not_implemented | "returns not_implemented for a supported read command the host does not implement"（getEditorState）/ "...for getOperationLog..." | 強。validateOnlyReadHost（validatePackage のみ実装）に対し getEditorState / getOperationLog が not_implemented を返すことを実挙動で確認。ai-read-command.ts の optional メソッド分岐（L109-113, L191-193）を直撃 |
| capability 不足で permission_denied（read/validate 区別） | "returns permission_denied when validatePackage lacks the validate capability" | 強。validatePackage を capabilities `["read"]` で叩き permission_denied を確認。validatePackage は `validate`、他 read は `read` という区別（ai-read-command.ts L62-65 `hasRequiredReadCapability`）を実証。**ただし下記 non-blocking 参照** |
| validatePackage 実装済みで ok | "dispatches validatePackage through the read host and returns ok" | 強。ok + reportId + report.profile/packageRevision まで toMatchObject |
| read host 未注入時の挙動 | "falls back to legacy not_implemented when no read host is configured" | 強。readHost 省略時に executor 側 legacy payload（reportId `val_ai_operation_executor_not_implemented`）へ落ちることを確認。ai-command-executor.ts L125-130 の分岐を直撃 |
| transcript 記録（二重記録なし） | "records read-command responses in the executor's transcript exactly once" | 強。`filter(...validatePackage).toHaveLength(1)` で厳密に 1 回のみを assert。executor が transcript を read 機構へ渡し二重記録しないこと（ai-command-executor.ts L135 のコメント設計）を実証 |
| PSD import plan 4 コマンドが not_implemented のまま | このファイルには無し | non-blocking finding 参照（別ファイルで担保） |

### §7-2 validatePackage テスト

document 層（`apps/authoring-host/src/validate-package-document.test.ts`）:

| Required 観点 | 対応テスト | 実証強度 |
|---|---|---|
| 健全パッケージで pass 相当 report | "produces a passing report for a healthy synthetic package" | 強。schemaVersion / validatorVersion / profile / packageId / counts.error===0 / counts.blocking===0 / evidence まで assert。「report が返る」だけの弱いテストではない |
| profile が payload に従う | "honors the payload profile and packageRevision override" | 強。profile===editorIncremental, packageRevision===42 |
| 既知欠陥フィクスチャで該当診断 | "reports a drawable that references a missing source asset" | **強（オウム返しでない）**。健全 fixture の先頭 drawable の sourceAssetId を存在しない id に改変注入し、`checkId === "ref.drawableSourceMissing"` を含む checks が >0、summary.status==="fail"、counts.error>0 を assert。checkId / status / severity 相当まで踏み込んでおり、バリデータの検出能力を実証している |

command 層（`apps/authoring-host/src/validate-package-command.test.ts`、CLI/host 経路）:

| Required 観点 | 対応テスト | 実証強度 |
|---|---|---|
| CLI/host 経由で ok + report | "returns an ok response with a validation report for a healthy synthetic package" | 強。aiCommandStatus ok / reportId===report.reportId / schemaVersion / profile / counts / evidence まで assert |
| 副作用なし（validate は dry-run/commit しない） | "validates without dry-running, committing, or writing to the package directory" | 強。正規化スナップショット before/after 一致 + saved===false |
| capability gate | "returns permission_denied when the session lacks the validate capability" | 強 |
| transcript 永続化記録 | "records the validatePackage response in the persisted transcript" | 強。state-dir の command-transcript.json を実読し validatePackage / commandId 含有を確認（read 経路が他経路同様に記録することを実証） |

CLI exit code / JSON 到達は state-directory-guard.test.ts の CLI テスト（下記 §7-4）でも別途担保。

### §7-3 非退行

| Required 観点 | 実証 |
|---|---|
| ai-interface 既存 88 非退行 | git status で既存 `.test.ts`（ai-read-command / ai-operation-command / ai-psd-import-plan-command 等）は `M` にも `??` にも現れず**完全無改変**。diff --stat のテストファイル該当ゼロ。実行 0 failed。基準緩和なし |
| 承認ライフサイクル非退行 | `ai-codex-proposal-approval-lifecycle`（6）/ `ai-operation-command`（11）/ `cli-cross-process`（dry-run approval carry・commit refusal）全 pass。ai-command-executor.ts の dryRun/commit/approval ロジック（L168-238）は無改変で read 分岐が追加されただけ（switch に read case 追加、既存 case は不変）。ai-read-command.ts の変更は getEditorState/getOperationLog を optional 化する拡張のみで capability・承認の緩和なし |

### §7-4 state-dir ガード（`apps/authoring-host/src/state-directory-guard.test.ts`）

| ケース類型 | 対応テスト | 実証強度 |
|---|---|---|
| reject: 同一ディレクトリ | "rejects a state directory equal to the package directory" | 強 |
| reject: 子孫（浅い/深い） | "rejects a state directory nested inside..."（`/repo/pkg/state`, `/repo/pkg/deep/nested/state`） | 強 |
| reject: 相対表記ゆらぎ | "normalizes relative segments before comparing"（`../pkg/state` → inside, `../sibling` → outside 両方向） | 強 |
| 許容: 兄弟 | "allows a sibling state directory" | 強 |
| 許容: prefix 共有だが非 nested | "allows a state directory whose name shares a prefix but is not nested"（`/repo/pkg-state` が `/repo/pkg` 内と誤判定されない） | 強。境界ケースを的確に突く |
| 許容: 親ディレクトリ | "allows a parent directory as the state directory" | 強 |
| CLI 引数パーサ層 | "rejects --state-dir inside/equal to --package-dir" + "accepts ... outside" | 強 |
| 直接エントリ層（IO 前 reject） | "rejects ... before doing any IO"（fixture 不要で reject を確認） | 強。ガードが load 前に走ることを実証 |
| CLI exit code | "returns exit code 1 and an error outcome ..."（stdout に "must live outside" 含有） | 強。exit code + outcome + メッセージまで |

reject / 許容の両方を網羅し、prefix 共有・相対正規化・Windows パスの誤検知境界まで踏み込んでいる。実装（state-directory-guard.ts、`relative` + `..`/absolute-like 判定）と一対一対応。

### §7-5 / B-1 範囲外 triangle index（`packages/render-software/src/raster/out-of-range-triangle-index.test.ts`）

| ケース類型 | 対応テスト | 実証強度 |
|---|---|---|
| index >= vertexCount | "skips a triangle whose index is >= vertexCount, drawing nothing"（`[0,1,3]`, vertexCount=3） | 強。4x4 全ピクセル（64 要素）が空キャンバスと一致 |
| 負 index | "skips a triangle with a negative index, drawing nothing"（`[0,-1,2]`） | 強。ピクセルレベル一致 |
| 全 index 無効 | "skips a triangle whose every index is out of range"（`[5,6,7]`） | 強 |
| 有効+無効混在 | "renders only the valid triangle when a valid and an out-of-range triangle coexist" | **最も強い**。valid のみ描画 vs valid+out-of-range を byte 比較で一致確認。かつ **valid が実際に非空を描くことを sanity assert**（`.not.toEqual(emptyCanvas())`）して vacuous pass（両方空で自明成立）を防止 |

専用テストとして負 / 範囲超過 / 全無効 / 混在を決定論的にピクセルレベル assert。被験ロジック drawable-rasterizer.ts L60-71（`i<0 || i>=vertexCount` で continue）を直撃。実証強度は模範的。

## Findings

### Blocking

なし。

### Non-blocking

1. **PSD import plan 4 コマンドの not_implemented 検証が Domain B 統合テストファイルに無い**（計画 §7-1 末尾「PSD import plan 系 4 コマンドが従来どおり not_implemented のまま」）。`ai-executor-read-integration.test.ts` はこの 4 コマンドを直接検証しない。ただし ai-command-executor.ts L117-121 で PSD 系は明示的に `#unsupportedReadCommand`（not_implemented）へルーティングされ、read host を通さない設計であり、既存 `ai-psd-import-plan-command.test.ts`（無改変・8 tests pass）と `ai-command-schema.test.ts` が該当領域を担保。executor 統合が PSD 経路を not_implemented のまま素通りさせることの明示的な回帰テストがあると network 完成度が上がるが、既存テストで実質担保されており blocking にはしない。

2. **validate/read capability 区別のネガティブ対称ケースが弱い**（§7-1）。「validatePackage を read capability で叩くと permission_denied」は検証済みだが、その逆「非 validatePackage read コマンド（getEditorState 等）を validate capability のみで叩くと permission_denied」の対称ケースは統合テストに無い。`hasRequiredReadCapability` の分岐（validatePackage→validate / それ以外→read）の片側のみの検証。ただし ai-read-command 単体テスト（`ai-read-command.test.ts`、無改変・11 tests）で read 機構本体の capability 区別が既に担保されている想定であり、統合層での二重検証は必須ではない。non-blocking。

3. **state-dir ガードの Windows case-insensitive 分岐がテスト未網羅**。実装 state-directory-guard.ts L37-38 は win32 で `toLowerCase()` 比較（`C:\Pkg` と `c:\pkg\state` を nested と認識）するが、テストは大文字小文字混在の drive パスケースを持たない。プラットフォーム依存で CI 網羅が難しい点は理解できるが、コメントで宣言された挙動の実証が欠ける。低優先度の non-blocking。

## Undine (L0) 裁定の適用

- 裁定1（authoring-host 全体 typecheck exit 2 は Domain A 由来、blocking にしない）: 本レーンは型検査でなくテスト妥当性が観点。適用の必要は生じなかった。
- 裁定2（共有ファイルの Domain A 変更・Domain A テストは判定対象外）: `perception/` 配下の render-view 系テスト、`run-render-view-command.test.ts`、`perception-fixtures.ts` は判定から除外。root config 実行時に perception 系が `Cannot find package` で failed したのは Domain A 所有かつ実行方法起因であり Domain B 判定に影響させない。

## 質問

なし。判定に必要な情報は source of truth と自己実行で揃った。

## 検証したファイル

テスト:
- `packages/ai-interface/src/ai-executor-read-integration.test.ts`
- `apps/authoring-host/src/validate-package-document.test.ts`
- `apps/authoring-host/src/validate-package-command.test.ts`
- `apps/authoring-host/src/state-directory-guard.test.ts`
- `packages/render-software/src/raster/out-of-range-triangle-index.test.ts`

被験実装:
- `packages/ai-interface/src/ai-command-executor.ts`（read dispatch L104-136 / renderView capability gate / PSD ルーティング L117-121）
- `packages/ai-interface/src/ai-read-command.ts`（optional メソッド化 diff / capability 区別 L62-65）
- `apps/authoring-host/src/state-directory-guard.ts`
- `apps/authoring-host/src/validate-package-document.ts`
- `packages/render-software/src/raster/drawable-rasterizer.ts`（L60-71 範囲外 index skip）

補助確認:
- `git status` / `git diff --stat`（既存テスト無改変の実証）
- `apps/authoring-host/vitest.config.ts`（workspace alias 機構）
- `apps/authoring-host/package.json` diff（新規 workspace 依存 4 件追加、install-linked でないが vitest alias で解決）
