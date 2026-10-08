# Wave 103 Plan: Headless Authoring Host Foundation

> Wave103 は「Fable に 2D モデルを作らせる」挑戦（[../../model-authoring/_map.md](../../model-authoring/_map.md)）の武器製造第 1 波。LLM がヘッドレスで operation を実行するためのホスト CLI と、知覚経路の核となる決定論的ソフトウェアラスタライザを、互いに独立な 2 ドメインとして建造する。知覚コマンド面・測量コマンド・Validate 入口は Wave104 に送る。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave103
- Wave name: `headless-authoring-host-foundation`
- Primary objective:
  - open-model-package-v1 をディスクから読み、ai-interface 経由で operation を dry-run → 自動承認 → commit し、ディスクへ保存し直すワンショット CLI ホストを新設する。
  - RenderScene を GL / DOM / ネイティブ依存なしに決定論的にラスタライズし PNG バイト列を返す純 TS レンダラを新設する。
  - Editor / Runtime Player の挙動は変更しない。
  - renderView コマンド、コンタクトシート、測量コマンド、validatePackage ディスパッチは対象外（Wave104）。

## 2. Planning Gate Result

Planning Gate result: `Inventory then discuss` — 完了済み。

- Inventory: Sylph 調査 5 本（操作面 A/A2、知覚経路 B、host 実装探索 A3、Export 変換パス B2）を実施し、結果は
  [../../model-authoring/closed-problems/01-eyeball-x/api-requirements.md](../../model-authoring/closed-problems/01-eyeball-x/api-requirements.md) と
  [../../model-authoring/research/perception-path-survey.md](../../model-authoring/research/perception-path-survey.md) に確定済み。
- Discuss: ユーザー決定済みの分岐 — ①ヘッドレスホストは ai-interface 層経由（案 A）+ dry-run を機械的検証ゲートとして再解釈（エラー診断なし → 自動承認） ②純 TS ソフトウェアラスタライザ採用（ネイティブ GL 依存は不採用） ③ワンショット CLI 形態（ディスク = 唯一の真実） ④wave 2 分割 ⑤エージェント別モデル配分表。

Uncertainty:

- factual: low。5 本の調査で操作面・ライフサイクル・欠落部品は証拠パス付きで確定済み。
- decision: low。上記 5 分岐すべてユーザー合意済み。
- cost of wrong plan: medium-high。ラスタライザ（Domain B）は本 wave 唯一の R&D であり、失敗すると Wave104 以降の知覚設計が変わる。だからこそ独立ドメインとして早期に建て、wave gate を直後に置く。

## 3. Accepted Decisions / Oracles

### 3.1 Host Semantics（ユーザー合意済み）

Required:

- ホストはワンショット CLI: 1 コマンド = 1 プロセス。パッケージを load → コマンド実行 → save して終了する。**制作セッション中、ディスク上のパッケージが唯一の真実**（[../../model-authoring/premises/operating-policies.md](../../model-authoring/premises/operating-policies.md)）。
- operation 実行は ai-interface の `AiCommandExecutor` を経由する。`dryRunOperation` → 承認 → `commitOperation` の 2 段階は維持する。
- 承認は**自動承認ポリシー**: dry-run の結果にブロッキング診断が無ければ機械的に承認する。承認セレモニーではなく**機械的検証ゲート**として運用する（ユーザー決定）。承認ポリシーは将来特定の操作クラスを人間承認に戻せる「ダイヤル」構造を保つ。
- dry-run と commit は別プロセス呼び出しを跨げること。承認状態・transcript は**パッケージディレクトリの外**（CLI 引数で指定する state ディレクトリ）に永続化する。
- `ai-interface` の dependency-boundary（`package-format` / `node:fs` 等の import 禁止、`dependency-boundary.test.ts:44-62`）は維持する。fs / package-format との接続はホスト側の責務。
- コマンド payload では、schema が許す限り明示的な id を渡す運用を可能にする（決定論のため）。

Forbidden:

- operation-core を直接叩いて ai-interface 層を迂回する経路をホストの正規経路にする。
- 承認チェックの無効化・commit のワンショット化（ライフサイクル改変）。
- パッケージディレクトリ内への transcript / 承認状態 / 一時ファイルの書き込み。

### 3.2 Rasterizer Semantics（ユーザー合意済み）

Required:

- 純 TS ソフトウェアラスタライザ。DOM / WebGL / ネイティブ依存なし。PNG エンコードは `node:zlib`（標準ライブラリ）+ 純 TS チャンク構築で行い、**新規外部依存ゼロ**。
- 入力: RenderScene（render-core の純データ）+ 明示的なビュー指定（モデル空間の viewport 矩形 + 出力ピクセルサイズ）。出力: RGBA8 バッファおよび PNG バイト列。
- **完全決定論**: 同一 scene + 同一ビュー指定 → バイト同一の出力。プラットフォーム・実行回数に依存しない。
- 描画意味論は既存 WebGL2 レンダラに合わせる: draw order、テクスチャサンプリング（accepted `NEAREST`）、不透明度、マスク関係。
- ビュー指定 API は Wave104 のビュー変換サイドカー（画像 px ↔ モデル空間の対応記録）にそのまま流用できる形にする。

Forbidden:

- headless-gl 等のネイティブ GL 依存の導入。
- 既存 `render-webgl2` の描画挙動変更。
- アンチエイリアス等、決定論を損なう「見栄え」機能の先行実装。

### 3.3 Model Allocation（ユーザー合意済み）

[../../model-authoring/premises/model-allocation-policy.md](../../model-authoring/premises/model-allocation-policy.md) と
[../../model-authoring/research/delegation-calibration-log.md](../../model-authoring/research/delegation-calibration-log.md) を必須 basis とする。

| 役割 | モデル |
|---|---|
| L0 Undine（wave 管理・最終判断） | fable（セッションモデル） |
| L1 Orch-Sylph（全ドメイン） | opus |
| L2 Gnome（Domain A / Domain B） | opus |
| L2 Review-Sylph（全レーン） | opus |
| 補助的な狭い機械的調査（Orch-Sylph が必要とした場合のみ） | sonnet（狭い問い + アンカーパス + git 考古学禁止を委任文に含めること） |

**すべての Agent 呼び出しで `model` パラメータを明示指定すること。** 無指定は親モデルを継承する（L0 から無指定で呼ぶと fable 枠を消費する罠がある）。

### 3.4 Fixtures / Rights

- テストフィクスチャは rights-clean な合成データのみ（既存規約通り）。`ref/` は本 wave のテスト対象にしない（Wave104 の e2e スモークで扱う）。

## 4. Primary Basis

Model-authoring basis（本 wave の発注元）:

- [../../model-authoring/premises/operating-policies.md](../../model-authoring/premises/operating-policies.md)
- [../../model-authoring/premises/model-allocation-policy.md](../../model-authoring/premises/model-allocation-policy.md)
- [../../model-authoring/closed-problems/01-eyeball-x/api-requirements.md](../../model-authoring/closed-problems/01-eyeball-x/api-requirements.md)
- [../../model-authoring/research/perception-path-survey.md](../../model-authoring/research/perception-path-survey.md)
- [../../design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)
- [../../development_convention/schema-and-id-conventions.md](../../development_convention/schema-and-id-conventions.md)

Known source facts from inventory（証拠パスは basis 文書内）:

- `packages/ai-interface/src/ai-command-executor.ts` — `execute()`。dryRun（`dryRunEdit` capability）→ 承認記録 → commit（`approvedDryRunCommandId` 必須、無ければ `needs_approval`）。
- `packages/ai-interface/src/ai-command-host.ts:3-6` — `AiOperationCommandHost` は `dryRunOperation` / `commitOperation` の 2 メソッド。実装は全リポジトリに存在しない（テストの Fake のみ）。
- `packages/ai-interface/src/ai-approval-policy.ts` — 承認ポリシーの既存箱（`InMemoryAiApprovalPolicy`）。
- `packages/operation-core/src/operation-registry.ts` — operation handler 登録。各 handler は `dryRun()` / `commit()` を持つ。
- `packages/operation-core/src/operations/` — `generateMesh` / `createWarpDeformer` / `createParameter` / `editKeyformKey`（`createEndsCenter` 含む）/ `setMaskRelation` 等、閉問題 01 の全操作が実在。
- `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts` — Editor のパッケージディレクトリ IO は File System Access API 依存（ブラウザ専用）。Node fs 版はどこにも無い。
- `packages/runtime-core/src/viewer-evaluation.ts:158` — `evaluateViewerRuntimeSnapshot`。`parameterOverrides` → 頂点含むスナップショット。contracts + zod のみに依存。
- `packages/render-core/src/renderer-backend.ts:17-20` — `RendererBackend.render(): void`。読み出し口が型レベルに無い。
- `packages/render-webgl2/src/webgl2-context.ts:8-115` — `WebGl2Like` 抽象。`readPixels` 未定義。
- リポジトリ内に PNG エンコーダ / コンタクトシート合成は存在しない。

## 5. Wave Strategy

```text
Batch 1（並列・相互独立）:
  Domain A: Headless Authoring Host CLI
  Domain B: Software Rasterizer Foundation

Batch 2:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A（ホスト: package-format / ai-interface / operation-core の配線）と Domain B（ラスタライザ: render-core の意味論実装）は書き込みスコープが交差せず、完全並列可能。
- 両者を接続する知覚コマンド面（renderView 等）は Wave104 で行う。接続を本 wave に含めると、R&D リスク（Domain B）が配線作業を人質に取るため分離する。

## 5.1 Domain Design

| Batch | Domain | Dependency | Gnome model | Purpose |
|---|---|---|---|---|
| 1 | A. Headless Authoring Host CLI | なし（既存 packages のみ消費） | opus | ディスク上のパッケージに対する load → dry-run → 自動承認 → commit → save のワンショット CLI |
| 1 | B. Software Rasterizer Foundation | なし | opus | RenderScene → RGBA8 → PNG の決定論的純 TS レンダラ |
| 2 | C. Final Integration / Clean Review | Domain A・B の pass または明示的 escalation | —（review 中心） | 契約・境界・テスト・禁止スコープの最終検証と記録 |

## 6. Domain A: Headless Authoring Host CLI

Domain id: `wave103-headless-authoring-host-cli`

Purpose:

- LLM（および任意の外部プロセス）が Editor GUI なしで open-model-package-v1 に operation を実行できる最初の正規経路を作る。

Allowed write scope:

- `apps/authoring-host/**`（新規: CLI 本体、Node fs パッケージディレクトリ IO、host 実装、state 永続化）
- `packages/ai-interface/src/**` — 自動承認ポリシー実装とそのテストに限る狭い追加。dependency-boundary テストは維持すること
- ルート `package.json` — scripts 追加のみ（依存追加は禁止）
- Domain A report / review files（`discussion/implementation/waves/wave103/`, `discussion/implementation/reviews/wave103/`）

Conditional write scope requiring explicit report justification:

- `packages/package-format/src/**` / `packages/authoring-core/src/**` — パッケージ読み込み → AuthoringSession 構築に必要な狭い read 側ヘルパーの追加のみ。挙動変更は escalate
- `packages/operation-core/src/**` — 型互換の狭い追加のみ。operation 挙動変更は escalate

Forbidden write scope:

- `apps/editor/**`、`apps/runtime-player/**`
- `packages/render-*/**`、`packages/runtime-core/**`、`packages/validator-core/**`
- ai-interface の承認チェック緩和・ライフサイクル改変・dependency-boundary 緩和
- パッケージディレクトリ内への非 package-format ファイル書き込み
- 新規外部依存 / lockfile 変更

Required implementation:

- ワンショット CLI: コマンド JSON（ファイルパスまたは stdin）を受け、JSON 応答を stdout に返す。終了コードは成功 / 拒否 / エラーを区別する
- open-model-package-v1 ディレクトリの Node fs load / save（manifest の modelFiles 全種 + バイナリアセット。Editor の browser IO と同じパッケージ構造を読み書きする）
- `AiOperationCommandHost` 実装: AuthoringSession を構築し operation-core registry 経由で dryRun / commit
- 自動承認ポリシー: ブロッキング診断なし → 承認。承認状態と transcript を `--state-dir`（パッケージ外必須）に永続化し、プロセスを跨ぐ dry-run → commit を成立させる
- transcript: 発行コマンド・dry-run 診断・承認判定・commit 結果を記録する（craft 蒸留と実験採点の証拠）

Required tests（rights-clean 合成フィクスチャ）:

- load → save 往復がパッケージを保存する（時刻等の非決定フィールドは正規化し、その一覧を報告に明記）
- `createParameter` の dry-run → 自動承認 → commit → save → reload で結果が残る
- 不正 payload の dry-run が診断を返し、承認されず、commit が `needs_approval` で拒否される
- dry-run と commit を**別プロセス呼び出し**で跨いでも承認状態が引き継がれる
- 閉問題 01 スモーク: 小型合成パッケージ（texture-backed drawable 2 枚 + 白目相当）に対し `generateMesh` → `createWarpDeformer` → `createParameter` → `editKeyformKey (createEndsCenter)` → `setMaskRelation` を CLI 経由で通す。**このとき keyform set 未存在からの `createEndsCenter` 単独実行が動作するかを最優先で実証する**（api-requirements.md の未確認事項）
- 決定論: 同一フィクスチャ + 同一コマンド列 2 回 → 正規化後のパッケージ JSON が一致
- transcript / 承認状態がパッケージディレクトリ外に書かれている

Escalate if:

- パッケージ load → AuthoringSession 構築に package-format / authoring-core の挙動変更が必要になる
- 自動承認が ai-interface のライフサイクル契約と両立しない
- `createEndsCenter` の単独新規作成が実際には動作しない（operation 側修正は本 wave のスコープ外 → 報告して判断を仰ぐ）
- バイナリアセット（raw RGBA テクスチャ）の load 形態が Editor 保存物と一致しない

## 7. Domain B: Software Rasterizer Foundation

Domain id: `wave103-software-rasterizer-foundation`

Purpose:

- 知覚経路の欠落部品「RenderScene → 実ピクセル → PNG」を、依存ゼロ・完全決定論で埋める。

Allowed write scope:

- `packages/render-software/**`（新規: ラスタライザ、PNG エンコーダ、テスト、golden フィクスチャ）
- `packages/render-core/src/**` — 読み出し可能なレンダラ契約（例: pixels を返す render 関数型）の狭い追加のみ。既存 `RendererBackend` の変更は escalate
- ルート `package.json` — scripts 追加のみ
- Domain B report / review files

Forbidden write scope:

- `packages/render-webgl2/src/**` の挙動変更（型互換の狭い追加も、必要なら justification 必須の conditional とせず escalate する）
- `apps/**`、`packages/runtime-core/**`、`packages/operation-core/**`、`packages/ai-interface/**`
- 新規外部依存 / lockfile 変更（`node:zlib` は標準ライブラリであり依存に数えない）
- アンチエイリアス・フィルタリング等の accepted `NEAREST` を超える描画機能

Required implementation:

- RenderScene + ビュー指定（モデル空間 viewport 矩形、出力幅・高さ）→ RGBA8 バッファの純 TS ラスタライズ:
  - テクスチャ付き三角形の塗り（`NEAREST` サンプリング）
  - draw order 準拠
  - 不透明度（drawable / 評価済み opacity）
  - マスク関係（mask drawable による target クリップ）の意味論
- RGBA8 → PNG バイト列（`node:zlib`、固定圧縮設定で決定論）
- ビュー指定 ↔ ピクセルの座標変換を公開 API として明示（Wave104 のサイドカーで再利用する）

Required tests:

- 単色三角形 / テクスチャ付き四角形 / 不透明度 / マスク / draw order の golden テスト（バイト一致、複数回実行で不変）
- 既知のモデル空間座標が期待ピクセルに写る（ビュー変換の正確性）
- 生成 PNG が正しい PNG としてデコード可能（幅・高さ・ピクセル一致）
- 空シーン・退化三角形・viewport 外形状の各エッジケースが決定論的に処理される
- 参考性能計測（typical scene の描画時間を報告に記録。ブロッキング基準にはしない）

Escalate if:

- WebGL2 レンダラのブレンド / マスク意味論が読み取りから一意に定まらない（premultiplied alpha の扱い等）— 独自解釈で進めず報告する
- render-core の契約追加が既存 backend 実装の変更を要求する
- マスク実装が評価済みスナップショットに無い情報を要求する

## 8. Domain C: Final Integration / Clean Review

Domain id: `wave103-final-integration-clean-review-map-closeout`

Dependencies: Domain A・B の `pass`、または明示的な `needs_fix` ループ解決。

Allowed write scope:

- `discussion/implementation/waves/wave103/**`、`discussion/implementation/reviews/wave103/**`
- implementation maps の status 更新
- final clean review が要求する狭い source / test 修正のみ

Required checks:

- Domain A / B の report と 3 レビューレーンが存在し pass である
- focused テスト（authoring-host、ai-interface、render-software、render-core）が通る
- `pnpm typecheck`（または既知の無関係失敗の明示的分類）
- `node scripts/check-source-organization.mjs` / `node scripts/check-dependencies.mjs`
- `git diff --check`
- Forbidden-scope diff check: Editor / Player 挙動変更なし、render-webgl2 変更なし、新規依存なし、パッケージディレクトリ内への state 書き込みなし、承認ライフサイクル緩和なし

## 9. Review Policy

Domain A / B それぞれに独立レビューレーン 3 本（すべて Review-Sylph, model: opus）:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Domain A の Spec Compliance が明示確認すること:

- dry-run → 自動承認 → commit のライフサイクルが executor 契約通りで、承認チェックが緩和されていない
- 自動承認は「ブロッキング診断なし」の場合に限られている
- state / transcript がパッケージ外に永続化され、プロセス跨ぎで機能する
- 閉問題 01 の 5 operation スモークと `createEndsCenter` 単独実証が含まれる
- ai-interface の dependency-boundary テストが緩和されていない

Domain B の Spec Compliance が明示確認すること:

- 依存ゼロ（`node:zlib` のみ）・DOM / GL 参照ゼロ
- golden テストが決定論（複数回実行・バイト一致）を実証している
- ビュー変換 API が公開され、テストで座標対応が実証されている
- マスク / draw order / 不透明度の意味論テストが存在する
- render-webgl2 が無変更である

Design / Development Review（共通）: source organization policy、schema-and-id 命名規約（machine-readable id は camelCase）、依存ポリシー、責務境界（ai-interface 純ロジック層の維持 / render-core 契約の最小性）。

Test Adequacy Review（共通）: required tests の全項目が実装され、欠落がある場合は blocking。

## 10. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| CLI がディスクパッケージに operation を実行できる | Domain A 01 スモークテスト |
| dry-run → 自動承認 → commit がプロセスを跨いで成立 | Domain A 2 プロセステスト |
| 不正操作は履歴に入る前に拒否される | Domain A 不正 payload テスト |
| `createEndsCenter` 単独新規作成の可否 | Domain A スモーク内の明示アサーション |
| RenderScene → PNG が依存ゼロ・決定論で得られる | Domain B golden テスト + 依存 grep |
| ビュー変換の正確性 | Domain B 座標対応テスト |
| マスク / draw order / opacity 意味論 | Domain B 意味論テスト |
| Editor / Player / render-webgl2 無変更 | Domain C forbidden-scope diff check |
| 新規依存ゼロ | Domain C dependency guard |

## 11. Expected Persistent Artifacts

- `discussion/implementation/waves/wave103/wave103-domain-a-headless-authoring-host-cli-report.md`
- `discussion/implementation/waves/wave103/wave103-domain-b-software-rasterizer-foundation-report.md`
- `discussion/implementation/waves/wave103/wave103-final-integration-report.md`
- `discussion/implementation/waves/wave103/_map.md`
- `discussion/implementation/reviews/wave103/wave103-domain-{a,b}-{spec-compliance,design-development,test-adequacy}-review.md`
- `discussion/implementation/reviews/wave103/wave103-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave103/_map.md`

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Orch-Sylph 自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
- **Agent 呼び出しでは `model` を必ず明示指定する**: Gnome = opus、Review-Sylph = opus。補助的な狭い機械調査のみ sonnet 可（狭い問い + アンカーパス + git 考古学禁止を委任文に含める）。
- Wait for all started children. Do not close or interrupt running children.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase. Do not revert unrelated changes. Work only in allowed scope.
- Do not run `pnpm install`. Do not add dependencies.
- Domain A: 承認ライフサイクルを緩和しない。パッケージ内に state を書かない。ai-interface の境界テストを維持する。
- Domain B: DOM / GL / ネイティブ API を参照しない。決定論を最優先し、迷ったら escalate。
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`. Remain read-only unless explicitly delegated a narrow fix.
- Treat dependency/lockfile changes, approval-lifecycle relaxation, in-package state writes, and render-webgl2 behavioral changes as blocking.

## 13. Orchestration Policy

This wave must follow `.claude/skills/implementation-orchestration/SKILL.md`.

- Undine (L0, fable): owns wave plan, dependency graph, user questions, final decision. Must not implement. Must wait for every started subagent; treat slow children as working, not failed.
- Orch-Sylph (L1, opus): owns exactly one domain loop. Delegates implementation to Gnome and review to independent Review-Sylphs. Loop limit 5; early-escape on user-decision gaps.
- Gnome (L2, opus): implements within allowed scope with tests.
- Review-Sylph (L2, opus): reviews from artifacts and source; produces assigned lane report file.

## 14. Out of Scope

- renderView / コンタクトシート / サイドカー生成コマンド（Wave104）
- 測量（評価済みジオメトリ照会）コマンド（Wave104）
- `validatePackage` ディスパッチ接続（Wave104）
- `ref/` を用いた e2e スモーク（Wave104）
- 閉問題 01 の実験実行そのもの（wave 外・model-authoring トピックの実験フェーズ）
- Editor UI / Runtime Player の変更、PSD import の自動化
- 常駐ホストプロセス / サーバ / 外部 transport（HTTP / WebSocket / MCP）
- アンチエイリアス、`NEAREST` を超えるテクスチャフィルタ
- 新規外部依存、Cubism 互換
