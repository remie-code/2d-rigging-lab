# Wave104 Final Integration Report: Perception and Measurement Command Surface

- Domain id: `wave104-final-integration-clean-review-map-closeout`（Domain D）
- Status: **final complete / pass**
- Orchestrator: Orch-Sylph（opus）/ Final clean reviewer: Review-Sylph（opus, 独立コンテキスト）
- Date: 2026-07-03
- Source of truth: [../../orchestration/wave104-plan.md](../../orchestration/wave104-plan.md) §9-§11（§3.4 の 2026-07-03 改訂、§8 conditional 追記 2 件、§9 の `typecheck:authoring-host` 必須昇格を含む）
- Final clean review: [../../reviews/wave104/wave104-final-clean-integration-review.md](../../reviews/wave104/wave104-final-clean-integration-review.md) — verdict **`pass`**、ブロッキング finding ゼロ
- Baseline 注記: Wave104 の作業は全て未コミット。HEAD = `2f80ca0a [modify]wave103まで.`。本 wave の実変更範囲 = working tree（`git status --short` の M + untracked、HEAD 比較）。`master...HEAD` は wave103 以前の履歴を含むためスコープ判定に不使用。

## 1. Wave 全体の成果

Wave104 `perception-measurement-command-surface` は、model-authoring トピック「LLM に 2D モデルを作らせる」武器製造の第 2 波・最終波として、Wave103 の「手」（authoring-host CLI）と「網膜」（render-software）に **知覚・測量・検証のコマンド面** を配線し、`ref/`（配信実証済み実モデル）の e2e で全経路を実証した。

### Domain A: Perception Command Core（pass、レビュー 3 レーン全 pass、修正ループ 1 回）

- 知覚経路コア: AuthoringSession → NormalizedRuntimeGraph → `evaluateViewerRuntimeSnapshot` → RenderScene → PNG の全経路（**Runtime Export 非経由**、L0 裁定 1 のとおり runtime-core 評価を正とする）。
- `renderView` コマンド: 3 形態のフレーミング（省略=モデル全体 bounds / 明示 stageViewport / drawableFocus）、sweep コンタクトシート（セル↔パラメータ対応表付き）、機械可読サイドカー（packageRevision / 解決済みビュー変換 / parameterOverrides — stale 画像判定事故の構造的防止 + 画像↔stage 座標の翻訳器）。
- ai-interface には純 zod スキーマ + 新 capability `render` のみ追加（L0 裁定 3。renderer/FS 依存ゼロ、boundary allowlist 無変更）。
- 決定論: 同一パッケージ状態 + 同一リクエスト → バイト同一 PNG（2 回実行バイト一致テストで実証）。テクスチャは session binaryAssets（raw RGBA8）から直接供給、byteLength 厳密検証付き。
- 評価済み bbox ヘルパ（`evaluated-bounds.ts`）を公開し Domain C が再利用。
- 修正ループ 1 回: Test Adequacy レーンの blocking（変形反映テストの構造的検証不足）→ フィクスチャに opacity keyform 追加 + テスト強化 + 負の検証（keyform 無効化 → fail → 復元）で解消、fresh Review-Sylph 再検証 pass。
- 報告書: [wave104-domain-a-perception-command-core-report.md](wave104-domain-a-perception-command-core-report.md)

### Domain B: Read Integration / Validate / Chores（pass、レビュー 3 レーン全 pass、環境問題の再検証 2 本）

- 孤立していた `ai-read-command.ts`（完成済み read 機構）を executor に正式統合（L0 裁定 2）: `readHost` 注入で `executeAiReadCommand` にディスパッチ、transcript 記録・capability チェックは共有機構に一元化（二重記録なし）、未注入時は legacy not_implemented fallback。承認ライフサイクル（dryRun/commit）系は無変更・非緩和。
- `validatePackage` host 実装: validator-core の個別バリデータ群 + `buildValidationReport` 集約、CLI から exit code / JSON 応答で到達可能。
- Wave103 小骨 2 本回収: state-dir パッケージ内誤用ガード（決定論的 reject、A-3）、render-software 範囲外 triangle index 専用テスト（B-1、テストのみ・描画コード無変更）。
- 初回レビューの needs_fix 2 件は同一の**環境問題**（workspace 依存 4 件追加が lockfile 未反映で root からの vitest 実行不能）であり、コード欠陥は 3 レーンとも未検出。L0 統制の install 後、再検証 2 本で pass 確定。
- 報告書: [wave104-domain-b-read-integration-validate-chores-report.md](wave104-domain-b-read-integration-validate-chores-report.md)

### Domain C: Measurement + ref e2e（pass、レビュー 3 レーン全 pass、escalate 1 回 + 型修正ループ 1 回）

- `inspectEvaluatedGeometry`（capability `read`）: 評価済み bounding box / 頂点 / warp 格子制御点座標の測量コマンド。Domain A の評価アダプタ・bbox ヘルパを共有（§3.3「同じ経路・同じアダプタ」）。数値テストは独立計算/既知座標ベースでオウム返しでない（クリーンレビュー §8 が精読確認）。
- §8 conditional 1 適用: runtime-core `EvaluatedRigControlDto` に optional `evaluatedControlPoints` を additive 追加（内部計算済み値の狭い公開のみ、評価挙動変更ゼロ、縮退代替は不要と判定）。
- **escalate → §3.4 改訂 → 検証付き導出**（下記 §3）: ref の per-layer texture 126 個全件が明示 dimensions を持たない事実への対処。改訂梯子で **126/126 全件 derived-verified 厳密一致解決**（`toHaveLength(126)` で vacuous pass 排除）。
- ref e2e スモーク（4 tests、`ref/` read-only）: validatePackage 到達（診断は fail 条件にしない）/ derived-verified 126 全件 / rest 全体像 + 顔 + 目元の 3 PNG render + 決定論（別ディレクトリ再 render バイト一致）/ 測量スモーク（bbox 有限値・目⊂顔の厳密包含）/ 実行時間記録。
- ユーザー目視 gate 成果物を `discussion/model-authoring/experiments/ref-render-gate/` に出力（PNG 3 + サイドカー 3 + ref-measurement-gate.json + README。README にマスクソース通常描画の注意書き付き）。
- 報告書: [wave104-domain-c-measurement-ref-e2e-report.md](wave104-domain-c-measurement-ref-e2e-report.md)

## 2. Escalate と L0 裁定の経緯（本 wave 内 3 件）

計画時の L0 裁定 3 件（§3.1: runtime-core 評価を正 / ai-read-command 正式統合 / renderView は host 実装 + 純 zod スキーマ）に加え、実行中に以下 3 件の L0 裁定が発生した:

1. **§3.4 改訂（検証付き導出）**: Domain C Gnome の escalate（ref の per-layer texture 126 個全件が明示 `dimensions` 非保持 → 当時の §3.4 では ref render が決定論的 reject）を受け、L0 が解決梯子を拡張 — ①明示 dimensions 最優先 ②パッケージ内の正式境界情報（rest mesh bounds）から候補導出し **`byteLength === w*h*4` 厳密一致時のみ採用** ③採用源種別（declared / derived-verified）をサイドカーに記録。「黙った推定の禁止」不変量は保存（無検証採用経路は存在しない — クリーンレビュー §6 がコード監査で確認）。§8 に conditional 追記 2（`texture-resolution.ts` + テストの狭い拡張のみ）。
2. **`typecheck:authoring-host` の必須チェック昇格（§9 改訂）**: root tsc は apps/ を対象にしないため、app 単位の型健全性（`npx tsc --noEmit -p apps/authoring-host/tsconfig.json`）を Domain D 必須チェックに昇格。Domain C の型エラー 10 件は L0 裁定により閉域前の狭い型修正ループで解消（挙動不変・検証強度不変を fresh Review-Sylph が再検証）。
3. **格子制御点の conditional 追記（§8 conditional 1）**: Domain A 実装時の発見（評価済み warp 格子制御点が public snapshot 非公開）を受け、runtime-core への「狭い export 追加のみ」を justification 付き conditional として追記。Domain C が選択肢 1（additive optional export）で採用、非破壊性を clean HEAD 比較（stash 二重確認）で実証。

## 3. Domain D チェック結果（§9 Required checks）

Orch-Sylph 実行分。独立の Review-Sylph も final clean review 内で主要チェックを再現している（同 §11）。

| チェック | 結果 |
|---|---|
| Domain A-C report + レビュー 9 レーン存在・pass | pass（全 12 アーティファクト冒頭 verdict を原本確認。needs_fix 3 件は全て再検証セクション追記で pass 確定済み） |
| authoring-host focused（`npx vitest run --root apps/authoring-host`） | pass — **12 files / 51 tests**（ref e2e 4 tests 含む） |
| ai-interface focused | pass — **17 files / 107 tests**（既存 88 非退行 + A 7 + B 6 + C 6。boundary テスト無変更・pass） |
| render-software focused | pass — **7 files / 37 tests**（既存 33 + B-1 4） |
| runtime-core focused | **126 passed / 2 failed** — 2 failed は分類 2 の既知先行（下記 §4-2） |
| ref e2e | pass — 4 tests（authoring-host suite 内。validate / derived-verified 126 / render 決定論 / 測量包含） |
| `npx tsc --noEmit`（root） | pass（exit 0） |
| `npx tsc --noEmit -p apps/authoring-host/tsconfig.json`（**§9 昇格済み必須**） | pass（exit 0） |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | finding 1 件のみ = 既知の先行偽陽性（分類 1、下記 §4-1）。**Wave104 由来の新規 finding ゼロ** |
| `git diff --check HEAD` | pass（whitespace error なし） |
| Forbidden-scope diff check | pass（下記 §5。禁止スコープへの変更ゼロ、ref/ 無変更） |

## 4. Undine 確定分類の適用結果（5 件すべて独立裏取り済み）

1. **`check-dependencies.mjs` の fail**: finding は `pnpm-lock.yaml` **line 2486**（`tinyspy@3.0.2` の sha512 integrity ハッシュ内の部分文字列 `cmo3`）1 件のみ。Wave104 の lockfile diff（+12 行）に `cmo3` は不含。**Wave104 由来の新規 finding ゼロ**。非ブロッキング確定（ガード修正は別タスク化済み・継続）。
2. **runtime-core の 2 failed（`runtime-grid2d-keyform-fixture` / `wave30-tutorial-mini-model-contract-fixtures`）**: **clean HEAD 起因の既知先行失敗（Domain C 再検証レーンが stash 二重実験で独立実証済み — 監査証跡としてここに明記する）**。Wave104 の runtime-core 変更は `rig-control-evaluation.ts` の additive optional export（`evaluatedControlPoints`）のみで、failing test（commit outcome / tutorial contract）と論理的に独立。`test:unit` 全体の先行 18 failed も同じ clean HEAD 起因分類の継続。Wave104 focused テスト対象は全通過であり、Wave104 由来の新規 fail ゼロ。
3. **`pnpm-lock.yaml` の変更（M, +12 行）**: authoring-host への workspace importer 登録のみ（`render-core` / `render-software` / `runtime-core` / `validator-core` の 4 件、全て `link:../../packages/*`）。外部 registry / resolution / version 追加行ゼロを diff 全文で確認。**新規外部依存ゼロ**。L0 統制の install 由来（Domain B §3 の経緯）。
4. **ルート `package.json`**: working tree（HEAD 比較）の追加は `test:ref-e2e` script **1 行のみ**（Domain C 分）。`test:authoring-host` / `typecheck:authoring-host` は wave103 コミットに既存。scripts 以外の変更なし。（注: 計画時の「Domain A/B/C 各 1 本」という想定に対し、実際の Wave104 純増は 1 本。判定影響なし）
5. **`discussion/model-authoring/**` / `.claude/skills/**` の変更**: Undine（L0）の運用文書・議論成果物（`evaluation-and-read-path-survey.md` / `_map.md` / SKILL.md）。wave スコープ外・非ブロッキング。`experiments/ref-render-gate/` は Domain C allowed scope の成果物でもある。

## 5. Forbidden-scope diff check（変更ファイル全数分類の根拠）

- `apps/editor` / `apps/runtime-player` / `packages/render-webgl2` / `packages/operation-core` / `packages/validator-core/src` / `packages/package-format/src`: **全て 0 changes**（`git status` パス別確認。クリーンレビュー §5 でも独立実証）。
- **`ref/` 無変更**: `git status --porcelain ref/` 空。ref e2e の stateDirectory は tmpdir 配下。加えて Domain D の focused テスト実行（ref e2e 再実行）後も `ref-render-gate/` 内ファイルに M が発生しない = 生成物が byte-identical に再現される**決定論の実地証拠**。
- **boundary 非緩和**: `packages/ai-interface/package.json` 無 diff（依存 5 本のまま、render 系依存なし）、boundary テスト無変更。
- **承認ライフサイクル非緩和**: `ai-approval-policy.ts` / `ai-command-transcript.ts` / `ai-operation-command.test.ts` 無 diff。executor の dryRun/commit 経路は read 統合と分離（クリーンレビュー §4）。
- **共有ファイルの三者統合整合**（A+B+C が触った `ai-command-executor.ts` / `authoring-host-command-host.ts` / `run-authoring-host-command.ts` / `tsconfig.json`）: renderView = capability gate のみで host 正規経路へ委譲（プレースホルダはスキーマ充足のみ）、read 系 = readHost ディスパッチ、inspectEvaluatedGeometry = read 経路合流。tsconfig paths / app package.json deps / lockfile importer の 4 件が一致。クリーンレビュー §2 が精読確認。

## 6. 最終クリーンレビュー

- アーティファクト: [../../reviews/wave104/wave104-final-clean-integration-review.md](../../reviews/wave104/wave104-final-clean-integration-review.md)
- 実施: 独立コンテキストの Review-Sylph（opus、read-only）。Orch-Sylph の要約に依存せず、ソース精読・`git diff HEAD` 全数精査・focused テスト再実行（authoring-host 51 / ai-interface 107）・§11 Verification Matrix 全行の裏取りで独立検証。
- Verdict: **`pass`**、ブロッキング finding ゼロ。分類 1-5 の適用も独立判断で妥当。
- レビューの質問 Q1（分類 2 の裏取り粒度: runtime-core 2 failed の clean HEAD 起因を Domain C の stash 二重確認報告に依拠してよいか）は **L0 が「その粒度で確定」と裁定**。推奨どおり本報告書 §4-2 に監査証跡を明記した。
- 修正要求: なし（狭い修正の Gnome 委任は不要だった）。

## 7. 残リスク（すべて非ブロッキング。クリーンレビュー §13 の 6 分類）

1. **ユーザー目視 gate 未実施（wave 外・最重要の次アクション）**: `ref-render-gate/` の PNG 3 枚は生成済みだが、描画正しさの人間判定（判定梯子最上段の初回行使、§3.5）は wave の技術 gate と独立。**wave 完了後にユーザーへ目視承認を依頼する必要がある。** README の注意書き（マスクソース通常描画 = Wave103 承認済み WebGL2 忠実セマンティクス。白目/マスク層が見えても renderer 疑義とは限らない）を判定の参考にすること。
2. **サイドカー絶対パス（C-DEV-N-01）**: `packagePath` / `pngPath` がマシン絶対パス。PNG バイト決定論には非抵触だが、別マシン再生成でサイドカー JSON は変わる（ポータビリティの記録事項）。
3. **ref validatePackage strict = error 97 件（C-NB-1）**: 実運用モデルと validator の乖離データ。fail 条件外（§3.5 どおり記録対象）。内訳分類（validator 偽陽性か ref 実欠陥か）は将来の model-authoring トピック。
4. **derived-verified の整数 mesh bounds 前提（C-NB-2）**: 非整数 bounds のモデルは `missingDimensions` reject で顕在化（黙って推定しない正しい挙動）。将来 reject が頻発する場合は梯子拡張の再検討余地。
5. **Domain A non-blocking 6 件**: sweep 二重計算 / not_implemented プレースホルダ / スキーマ命名 / margin 式構造同一 / sweep テスト steps=4 単一等。将来の堅牢化候補。
6. **プロセス所見（Domain B §5）**: Gnome が workspace 依存追加で install 必要時に escalate せず代替配線で凌ぎ、blocking 2 件 + 再検証 2 本のコストが発生。**今後の Gnome 委任文に「依存追加で install が必要になる場合は代替配線で回避せず escalate せよ」を明示**すると再発防止（wave 成果物への影響なし）。
- （別件・ガード保守、継続）`check-dependencies.mjs` の sha512 ハッシュ内部分文字列偽陽性（cmo3、line 2486）。別タスク化済み。

## 8. 閉問題 01 への引き継ぎ（wave 完了後の model-authoring 実験フェーズへ）

Wave103+104 で武器製造は完了し、閉問題 01（eyeball-x）の実験実行に必要な能力面が揃った:

1. **手**: authoring-host CLI（load → dry-run → 自動承認 → commit → save、`createEndsCenter` 単独実行実証済み、state-dir ガード付き）。
2. **目**: `renderView`（rest / parameterOverrides / drawableFocus / sweep コンタクトシート + サイドカー）。ref での実モデル動作実証済み。**ただし描画正しさのユーザー目視承認が実験開始の前提 gate**（§7-1）。
3. **巻尺**: `inspectEvaluatedGeometry`（評価済み bbox / 頂点 / warp 格子制御点。ref 実測値は `ref-render-gate/ref-measurement-gate.json`）。
4. **健診**: `validatePackage`（profile 指定可、CLI 到達可能）。
5. **翻訳器**: サイドカーの resolvedView（pixelsPerStage / stageViewport）で画像上の相対判断をモデル座標の操作量へ翻訳可能（README に変換式と例）。
6. **craft 蒸留候補**: Domain C の実務で確立したパターン — ①「view 省略 → 全体像 → drawableFocus → 明示 viewport」の段階的接近 ②サイドカーの packageRevision 照合による stale 判定 ③測量値と render の突き合わせ（bbox 包含関係の sanity）④マスクソース通常描画の目視判定上の注意 — は実験フェーズの操作 craft として蒸留する価値がある。
7. 制約の継承: parameter の min/default/max は相異なる値が前提（同値は duplicateKey reject、Wave103 引き継ぎ）。ref の parameters は空（sweep は合成フィクスチャで検証済み）。

## 9. Expected Persistent Artifacts（§12 照合）

| Artifact | 状態 |
|---|---|
| wave104-domain-{a,b,c} report（3 枚） | 存在 / 全 pass |
| wave104-final-integration-report.md | 本文書 |
| waves/wave104/_map.md | 作成済み |
| reviews/wave104/wave104-domain-{a,b,c}-{spec-compliance,design-development,test-adequacy}-review.md（9 枚） | 存在 / 全 pass（needs_fix 3 件は再検証追記で解消済み） |
| reviews/wave104/wave104-final-clean-integration-review.md | 存在 / pass |
| reviews/wave104/_map.md | 作成済み |
| discussion/model-authoring/experiments/ref-render-gate/（PNG 3 + サイドカー 3 + measurement JSON + README） | 存在 / ユーザー目視 gate 待ち |
| orchestration/_map.md の Wave104 エントリ更新 | 実施済み（planned → final complete / pass） |
