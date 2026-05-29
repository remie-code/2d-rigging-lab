# Wave 10 Plan: AI Read / Inspection / Validation Command Foundation

## 状態

- Status: Draft
- 対象wave: Wave 10
- 実行単位: 1 wave
- 想定起動条件: ユーザーが Wave 10 実行を明示したとき

## 目的

Wave 10 では、Wave 8-9 で整備した AI コマンド基盤と承認UIを前提に、AI assistant が現在MVP内で使う読み取り系コマンドを拡張する。

外部HTTP/WebSocket/MCP transport は扱わない。`Open External API` は現行MVP外の Future 領域であり、ここで先に進めると Undine / Orch-Sylph の文脈と実装責務が拡散するため。

このwaveの中心は次の3つ。

1. `inspectModel`
2. `inspectTarget`
3. `validatePackage`

`dryRunOperation` がすでに diff を返せるため、独立した `getDiff` / `rerunValidation` / `createRepairCandidate` は Wave 10 の主対象にしない。必要な型上の将来拡張点は残してよいが、実装完了条件には含めない。

## 根拠

- `discussion/design/module-contracts/ai-command-contract.md`
  - AI command は transport-independent な契約である。
  - HTTP/WebSocket/MCP adapter は command semantics を持ち込んではならない。
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md`
  - AI assistant はモデル構造の把握、操作コマンド、diff、検証、修復提案に到達する必要がある。
- `discussion/scenarios/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md`
  - SC-AGENT-001 はモデル/ランタイム構造の inspection を求める。
  - SC-AGENT-002 は dry-run / diff / repair flow を求めるが、Wave 10 では既存 dry-run diff を壊さず inspection と validation の土台を足す。
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/221_Open_External_API.md`
  - 外部API、plugin、automation server は Future と明示されている。
- `discussion/development_convention/source-file-organization-policy.md`
  - 巨大な単一 `index.ts` や catch-all file を避け、単一責務ファイルに分割する。

## 非目標

- 外部HTTP API server の追加
- WebSocket server の追加
- MCP server / tool adapter の追加
- plugin / automation server 対応
- LLM prompt / natural language layer の追加
- canvas hit-test / viewport / selection command
- runtime playback sequence command
- repair candidate generation
- approval UI の大改修
- mutating operation catalog の拡張

## 実装方針

`packages/ai-interface` は transport も DOM も持たない。Wave 10 でも `dependency-boundary.test.ts` の境界を維持する。

`apps/editor` 側では、inspection と validation の実装を `editor-ai-command-host.ts` に直接肥大化させない。先に projector / adapter の単一責務ファイルを作り、最後に host wiring だけを統合する。

`index.ts` は barrel-only に留める。command schema、response schema、executor、editor projector、validation projector は責務単位で分ける。

## Wave 10 ドメイン分割

### Domain A: AI read command contract foundation

- Orch-Sylph: `wave10-ai-read-command-contract`
- 並列性: 最初に単独実行
- 主な責務:
  - `inspectModel` / `inspectTarget` / `validatePackage` の command name、payload、response schema を追加する。
  - `executeAiReadCommand` の dispatch と host interface を拡張する。
  - `packages/ai-interface` 内の unit test を追加する。
  - transport / DOM / filesystem 依存を入れない。
- 想定write範囲:
  - `packages/ai-interface/src/ai-command-name.ts`
  - `packages/ai-interface/src/ai-command-payload.ts`
  - `packages/ai-interface/src/ai-command-response-payload.ts`
  - `packages/ai-interface/src/ai-read-command.ts`
  - `packages/ai-interface/src/**/*inspect*.ts`
  - `packages/ai-interface/src/**/*validation*.ts`
  - `packages/ai-interface/src/**/*.test.ts`
- 完了条件:
  - 新commandの payload / response parse test が通る。
  - 未対応commandは明示的に失敗する。
  - `pnpm exec vitest run packages/ai-interface/src` が通る。

### Domain B: Editor inspection projector

- Orch-Sylph: `wave10-editor-inspection-projector`
- 並列性: Domain A 完了後、Domain C と並列可能
- 主な責務:
  - editor current state / package document から `inspectModel` response を生成する pure projector を作る。
  - parameter など現在実装済みの target kind を中心に、AIが参照しやすい `TargetRef` 一覧を返す。
  - `inspectTarget` で指定 target の詳細を返す。
  - 巨大な document dump は返さず、AI operation に必要な最小構造に絞る。
- 想定write範囲:
  - `apps/editor/src/ai-command-host/editor-ai-inspection-projector.ts`
  - `apps/editor/src/ai-command-host/editor-ai-inspection-projector.test.ts`
- 完了条件:
  - fixture / current state から安定した target list が生成される。
  - 存在しない target は command error として扱える情報を返せる。
  - app側unit test が通る。

### Domain C: Editor validation projector

- Orch-Sylph: `wave10-editor-validation-projector`
- 並列性: Domain A 完了後、Domain B と並列可能
- 主な責務:
  - current package / runtime evidence から `validatePackage` response を生成する projector を作る。
  - 既存 `validator-core` の report DTO を使い、AI interface 独自の検証意味論を増やさない。
  - validation profile は Wave 10 では小さく始める。必要なら `editorIncremental` / `strict` などの列挙に限定する。
- 想定write範囲:
  - `apps/editor/src/ai-command-host/editor-ai-validation-projector.ts`
  - `apps/editor/src/ai-command-host/editor-ai-validation-projector.test.ts`
- 完了条件:
  - current editor state から validation report が返る。
  - report が空成功、警告、失敗を区別できる。
  - app側unit test が通る。

### Domain D: Editor AI command host integration

- Orch-Sylph: `wave10-editor-ai-read-host-integration`
- 並列性: Domain A/B/C 完了後に単独実行
- 主な責務:
  - Domain B/C の projector を `editor-ai-command-host.ts` へ接続する。
  - AI transcript / command host 経由で read command が実行できることを確認する。
  - `dryRunOperation` / `commitOperation` / approval flow の既存挙動を壊さない。
- 想定write範囲:
  - `apps/editor/src/ai-command-host/editor-ai-command-host.ts`
  - `apps/editor/src/ai-command-host/**/*.test.ts`
  - 必要最小限の `apps/editor/src/editor-session/**`
- 完了条件:
  - AI command host から3つの新read commandが呼べる。
  - 既存4 command の回帰testが通る。
  - `pnpm exec vitest run apps/editor/src` の関連範囲が通る。

### Domain E: Contract fixture and regression coverage

- Orch-Sylph: `wave10-ai-read-command-fixture-regression`
- 並列性: Domain D 完了後に単独実行
- 主な責務:
  - AI read command の request/response fixture を追加する。
  - contract-level regression を追加する。
  - fixture が過大な snapshot にならないよう、必要な command response の代表例に絞る。
- 想定write範囲:
  - `fixtures/contracts/ai-read-inspection-validation-command-foundation/**`
  - `packages/ai-interface/src/**/*.test.ts`
  - `apps/editor/src/ai-command-host/**/*.test.ts`
- 完了条件:
  - fixture が schema parse される。
  - response example が実装と乖離していない。

### Domain F: Integration review, cleanup, final report

- Orch-Sylph: `wave10-integration-review-and-final-report`
- 並列性: 最後に単独実行
- 主な責務:
  - Review-Sylph 相当の clean context review を実施する。
  - 指摘があれば Gnome 相当の修正を投入する。
  - Wave 10 final report を日本語で作成する。
  - `_map.md` を更新する。
- 想定write範囲:
  - `discussion/implementation/waves/wave10/**`
  - `discussion/implementation/_map.md`
  - `discussion/implementation/orchestration/_map.md`
  - 必要に応じて `discussion/_map.md`
- 完了条件:
  - Review 指摘が resolved / accepted residual risk として記録される。
  - 最終検証結果が final report に残る。

## 並列投入順

```text
Batch 1
  A. wave10-ai-read-command-contract

Batch 2
  B. wave10-editor-inspection-projector
  C. wave10-editor-validation-projector

Batch 3
  D. wave10-editor-ai-read-host-integration

Batch 4
  E. wave10-ai-read-command-fixture-regression

Batch 5
  F. wave10-integration-review-and-final-report
```

Batch 2 は A の型と schema が固まってから並列投入する。B/C は同じ directory 配下だが、write file を明確に分けることで衝突を避ける。

D は integration owner として単独にする。`editor-ai-command-host.ts` は統合点なので、ここを複数サブエージェントに同時編集させない。

## Orch-Sylph への共通指示

- full-history fork は使わない。
- basis documents は明示pathで渡す。
- subagent はユーザーへ直接質問しない。
- 不明点は report に `Question` として残し、Undine が集約する。
- implementation domain は必ず `discussion/development_convention/source-file-organization-policy.md` を読む。
- `index.ts` は barrel-only。実装本体を集約しない。
- `packages/ai-interface` へ transport、DOM、filesystem 依存を入れない。
- long-running test は完了まで待つ。

## Wave 10 全体の検証

最低限:

```powershell
pnpm exec vitest run packages/ai-interface/src
pnpm exec vitest run apps/editor/src
pnpm typecheck
pnpm check:source
pnpm check:deps
pnpm check
git diff --check
```

可能なら追加:

```powershell
pnpm test:e2e
```

Wave 10 は UI 変更を主目的にしないため、E2E は既存UIの回帰確認として扱う。

## リスクと早期エスケープ

- `validatePackage` が現在の editor state から自然に report を作れない場合:
  - 新しい validation semantics を発明しない。
  - 既存 `validator-core` / evidence provider の不足を report に残し、Wave 10 は inspection command 完了を主成果として縮退できる。
- `inspectModel` response が大きくなりすぎる場合:
  - document dump を避け、target refs とAI操作に必要な summary に絞る。
- `editor-ai-command-host.ts` が肥大化し始めた場合:
  - projector file へ戻す。
  - host は routing と dependency injection のみを担当する。

## 完了判定

Wave 10 完了時点で、AI assistant は external API なしに、in-process command bus 経由で次を実行できる。

1. 現在モデルの操作可能targetを把握する。
2. 特定targetの詳細を取得する。
3. 現在packageのvalidation reportを取得する。
4. 既存の dry-run / commit / operation log / approval flow が回帰していない。

