# Wave103 Domain A (Headless Authoring Host CLI) — Test Adequacy Review

- レーン: Test Adequacy Review（レーン 3/3）
- レビュアー: Review-Sylph (opus)
- 呼び出し元: Orch-Sylph (Wave103 Domain A)
- 対象:
  - `apps/authoring-host/src/run-authoring-host-command.test.ts`（5 tests）
  - `apps/authoring-host/src/cli-cross-process.test.ts`（2 tests）
  - `apps/authoring-host/src/closed-problem-01-smoke.test.ts`（1 test）
  - `apps/authoring-host/src/test-support/`（authoring-host-fixtures.ts / command-builders.ts / package-normalization.ts）
  - `packages/ai-interface/src/ai-auto-approval-policy.test.ts`（6 tests）
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §3.1 / §3.4 / §6 / §9
- Basis: `discussion/model-authoring/closed-problems/01-eyeball-x/api-requirements.md`（createEndsCenter 残不確実性）
- 日付: 2026-07-02

## 判定

**pass**

§6 Domain A「Required tests」の 7 項目すべてが存在し、いずれもアサーションが要求の本質を検証している。正規化はザルではなく（timestamp のみ、モデルグラフ・id・revision は無傷で比較）、決定論テストが正規化過剰で無意味化していない。別プロセス承認引継ぎは実 `child_process.spawn` によるプロセス分離で担保され、同一プロセス内 2 回呼び出しでの誤魔化しはない。閉問題 01 の createEndsCenter 単独実行は「事前 keyformSets 空 → 実行 → 新規 keyformSet 1 件生成 + min/default/max 全 3 キーの値検証」という要求どおりの構造で実証されている。フィクスチャは rights-clean な合成データのみ。欠落は required 項目にはなく、周辺の負ケース欠落 2 件（minor）のみ。

## Required tests 判定表

| # | 要求（§6） | 存在 | 実質 | 証拠パス:行 |
|---|---|---|---|---|
| 1 | load → save 往復がパッケージを保存（非決定フィールド正規化が妥当・ザルでない） | Yes | Yes | `run-authoring-host-command.test.ts:41-80`。dry-run が on-disk パッケージを不変に保つことを `after` vs `before` の正規化スナップショット `toEqual` で検証。バイナリテクスチャの byteLength も比較（`:77-79`）。正規化は `package-normalization.ts:82-95` で manifest/workspace の `createdAt`/`updatedAt` と `operations/log.jsonl` の `timestamp` のみ。graph・ids・revisions・diffs は無傷（`:74-80`）。ザルでない |
| 2 | createParameter の dry-run → 自動承認 → commit → save → reload で残る | Yes | Yes | `run-authoring-host-command.test.ts:82-135`。dry-run で `autoApproval={evaluated:true,autoApproved:true,reason:"no-blocking-diagnostic"}` と `saved:false` を検証（`:106-113`）。別呼び出しの commit で `saved:true`, `packageRevision:1`（`:126-129`）。ディスク上 `model/parameters.json` を reload して `param_eye_open` の実在を検証（`:131-134`） |
| 3 | 不正操作の dry-run が診断を返し、承認されず、commit が `needs_approval` で拒否 | Yes | Yes（下記注記あり） | `run-authoring-host-command.test.ts:137-193`。dry-run で `outcome:"rejected"`, `autoApproved:false`, `reason:"operation-result-rejected"`, 診断 checkId `operation.generateMesh.missingDrawable`（`:162-171`）。commit で `aiCommandStatus:"needs_approval"`, `saved:false`（`:184-186`）。ディスク `model/meshes.json` が空のまま（`:189-192`）で履歴混入なしを検証 |
| 4 | dry-run と commit を別プロセス呼び出しで跨いでも承認状態が引き継がれる（真にプロセス分離） | Yes | Yes | `cli-cross-process.test.ts:41-160`。`spawn(process.execPath, [..., "src/cli.ts", ...])` で 1 コマンド = 1 実 OS プロセス（`:47-63`）。dry-run プロセス（`:116-120`）と、それとは完全独立の commit プロセス（`:140-144`）を別々に起動。commit プロセスは `--state-dir` の永続ファイルからしか先行承認を知り得ない。`packageRevision:1` と parameters.json への反映を検証（`:150-155`）。実行時間 3.4s（下記実行ログ）が実プロセス起動の裏付け |
| 5 | 閉問題 01 スモーク（5 operation CLI 経由）+ **createEndsCenter 単独実行の明示アサート** | Yes | Yes | `closed-problem-01-smoke.test.ts:63-210`。generateMesh → createWarpDeformer → createParameter → editKeyformKey(createEndsCenter) → setMaskRelation を host 経由で通す。createEndsCenter は「事前 `keyformSets` `toHaveLength(0)`（`:132-135`）→ 単独実行 → 事後 `keyformSets` `toHaveLength(1)`（`:162-169`）+ target/parameterId/keys 全 3 点 `[{-1,0},{0,0.5},{1,1}]` の値検証（`:171-181`）」という要求どおりの構造。詳細は下節 |
| 6 | 決定論: 同一フィクスチャ+同一コマンド列 2 回 → 正規化後パッケージ JSON 一致（正規化過剰で無意味化していない） | Yes | Yes | `run-authoring-host-command.test.ts:229-270`。同一 seed + dry-run→commit を 2 回独立実行し、`readNormalizedPackageSnapshot(...).files` を `toEqual` 比較（`:266-269`）。比較対象は全ファイルの完全内容（timestamp のみ正規化）であり、graph・parameters・revision・operation-log 本文は生比較。正規化過剰ではない |
| 7 | transcript / 承認状態がパッケージディレクトリ外に書かれている（パッケージ内に state ファイルが**無い**ことの検証） | Yes | Yes | `run-authoring-host-command.test.ts:195-227`。state-dir 内が `["approval-state.json","command-transcript.json"]` に一致（`:220-221`）。かつパッケージ内の全相対パスに `approval-state`/`command-transcript`/`transcript` を含むものが**無い**ことを 3 本の `some(...)===false` で明示検証（`:223-226`）。`cli-cross-process.test.ts:157-159` も同様に state 外部化を再確認 |

## createEndsCenter 単独実行の実証は十分か（明示判定）

**十分（sufficient）。**

api-requirements.md の残不確実性は「`createEndsCenter` を keyform set 未存在から単独で呼んだ場合の動作（機構上は動くはず。実装時に最優先で実証）」（`api-requirements.md:33`）。テストはこれを以下の構造で正面から潰している:

1. **事前状態のアサート**: `keyformsBefore.keyformSets` を `toHaveLength(0)`（`closed-problem-01-smoke.test.ts:132-135`）。keyform set が一切存在しない状態を明示的に固定している。
2. **単独実行**: 直前の operation は createParameter（keyform を作らない）であり、createEndsCenter が「(eye drawable opacity, eye-open parameter) への最初の keyform touch」であることがコメントと操作列から確定（`:128-131`）。先行する keyform 打ちは無い。
3. **新規生成のアサート**: `keyformsAfter.keyformSets` を `toHaveLength(1)`（`:169`）。空状態から新規 keyformSet が 1 件生成されたことを検証。
4. **値の妥当性アサート**: 生成 keyformSet の target（`{kind:"drawable", id:eye, property:"opacity"}`）、parameterId、および keys を `[{value:-1,statePatch:0},{value:0,statePatch:0.5},{value:1,statePatch:1}]` で完全一致検証（`:171-181`）。key の `value` はフィクスチャ createParameter の `min:-1/default:0/max:1`（`:120-122`）から導出された値であり、テスト入力のオウム返しではなく「Ends+Center の 3 点がパラメータ範囲に正しく配置される」ことを実質検証している。

この「事前 empty のアサート → 実行 → 新規 keyformSet 生成のアサート」構造は、まさに §6 が最優先で求めた実証形態そのものである。加えて commit が `outcome:"success"` / `aiCommandStatus:"ok"` / `saved:true`（`:157-159`）でディスクに永続化されたことも確認しており、dry-run 内での「動くはず」に留まらず commit 到達まで実証している。api-requirements.md の当該不確実性は本テストで解消されたと判定する。

## フィクスチャの rights-clean 性（§3.4）

**clean。**

- `apps/authoring-host` 配下に `ref/` への実参照ゼロ（`ref/`・`.psd`・`fixtures/ref` grep 0 件。`authoring-host-fixtures.ts:28` のコメント言及のみ）。
- フィクスチャは `createTutorialMiniModelSeed`（合成シード。ID 群は `tutorial_synthetic` / `synthetic_seed` プレフィックス、`tutorial-mini-model-seed.ts:21-40`）と、プログラム生成の 2×2 RGBA バイト（`authoring-host-fixtures.ts:248-259` の `createSyntheticRgbaBytes`。実在モデル由来データなし）のみで構成。
- バイナリテクスチャの digest は生成バイトから `createHash("sha256")` で算出（`:218`）。実在アセットのハッシュを埋め込んでいない。

## 自動承認ポリシー単体テスト（ai-auto-approval-policy.test.ts）の分岐カバレッジ

§9 が要求する 3 分岐＋αをすべてカバー:

| 分岐 | カバー | 証拠 |
|---|---|---|
| ブロッキング診断なし → 承認する | Yes | `:39-50`（status `dry_run`・診断なし → `autoApprove:true`, reason `no-blocking-diagnostic`） |
| ブロッキング診断あり（非 rejected 結果内） → 承認しない | Yes | `:67-79`（severity `blocking` → `autoApprove:false`, reason `blocking-diagnostic-present`） |
| rejected 結果 → 承認しない | Yes | `:52-65`（status `rejected` → reason `operation-result-rejected`, blockingDiagnostics 収集） |
| precondition 診断も収集対象 | Yes | `:81-95`（precondition ok=false の診断で拒否） |
| ダイヤル（人間承認クラス） → 診断なしでも人間承認へ戻す | Yes | `:97-114`（`humanApprovalOperationTypes:["deleteRigControl"]` で gated=false・reason `operation-class-requires-human-approval`、非対象 createParameter は承認） |
| ライフサイクル委譲（承認チェックを迂回しない） | Yes | `:116-139`（recordDryRun → 承認前は `needs_approval` → approveDryRunCommand → `approved`）。実装 `ai-auto-approval-policy.ts:82-105` は delegate に全委譲、`:57-58` の `isBlockingDiagnostic` は severity `error`/`blocking` を正しく捕捉 |

承認チェック緩和なし・ライフサイクル改変なしを単体レベルで担保している。ダイヤル（将来の人間承認クラス復帰）分岐も明示テスト済み。

## 負のケース・境界カバレッジの評価

| 境界 | カバー | 証拠 / 指摘 |
|---|---|---|
| commit-only（先行 dry-run なし）を新プロセスで拒否 | Yes | `cli-cross-process.test.ts:162-204`（`approvedDryRunCommandId` が実在しない → exit 2, `needs_approval`, `saved:false`）。§6 の孤立 commit 経路を実プロセスで検証 |
| dry-run はディスクを一切変更しない | Yes | `run-authoring-host-command.test.ts:41-80`（round-trip テストが兼務） |
| commit 拒否時にモデルファイルが不変 | Yes | `:189-192`（meshes.json 空のまま） |
| CLI exit code が success/rejected/error を区別 | 部分 | success (exit 0, `:122`) と rejected (exit 2, `:200`) は検証。**error (exit 1)** の実プロセス検証は無し（finding A-2） |
| 存在しないパッケージパス | **専用テストなし** | 実装 `package-directory-io.ts:48-53` が `PackageDirectoryIoError` を投げ `cli.ts:49-52,75-84` が catch し `outcome:"error"`/exit 1 化する経路はある。だが明示テストは無い（finding A-1、minor） |
| state-dir がパッケージ内を指す扱い | **防御・テストともになし** | `cli-arguments.ts` に state-dir⊄package-dir の検証は無い（`:49-51` は値の存在のみ）。実装は state を `--state-dir` 配下に書くだけで、利用者が誤って package 内を指定すればパッケージ内に state が書かれ得る。§3.1 Forbidden「パッケージディレクトリ内への state 書き込み」はホスト自身の既定経路では守られている（テスト #7 で担保）が、引数誤用に対するガードは無い（finding A-3、minor） |

## Findings

| ID | severity | 内容 |
|---|---|---|
| A-1 | minor（non-blocking） | **存在しないパッケージパスの負ケーステストが無い。** `loadAuthoringPackageDirectory`（`package-directory-io.ts:48-53`）は空/不在ディレクトリに対し `PackageDirectoryIoError` を投げ、`cli.ts:49-52` の catch が `createErrorResponse` 経由で `outcome:"error"`（exit 1）に変換する経路が実装されている。だが「不在パッケージ → error 応答 + exit 1」を確認する明示テストが無い。§6 の required 7 項目には含まれない周辺負ケースのため minor。error 経路（下記 A-2）と併せて 1 本のテスト追加が望ましい |
| A-2 | minor（non-blocking） | **CLI の error outcome（exit 1）の実プロセス検証が無い。** cross-process テストは success(0)/rejected(2) を実プロセスで検証するが、error(1) パスは検証していない。`mapOutcomeToExitCode`（`authoring-host-response.ts` 参照）が error→1 を返すこと自体は単体で確認可能だが、不正 JSON・不在パッケージ等で実際に exit 1 が出ることの end-to-end 検証は無い。§6 required 外のため minor |
| A-3 | minor（non-blocking） | **`--state-dir` がパッケージディレクトリ内を指した場合のガードが無い（防御・テストともに）。** `cli-arguments.ts:49-51` は state-dir の存在のみ検証し、それが package-dir の配下でないことは検査しない。ホスト自身の既定動作は state を `--state-dir` に書くだけなので §3.1 Forbidden「パッケージ内 state 書き込み」はテスト #7 で担保されているが、呼び出し側が誤って package 内を state-dir に指定した場合にパッケージ内へ state が書かれ得る。防御的検証（state-dir が package-dir のサブパスなら reject）とその負ケーステストがあれば §3.1 の不変条件がより堅牢になる。ソース防御が無いため「テスト欠落」ではなく「実装＋テストの補強余地」。required 項目でも承認ライフサイクル緩和でもないため minor に留める |
| A-4 | info | Required test #3 は文言上「不正 payload」だが、実際には**構造的に valid な payload で、operation ハンドラが blocking 診断を返すケース**（存在しない drawable への generateMesh）を用いている。これは §6 の意図する「拒否経路・診断・needs_approval」を実質的に検証しており妥当。ただし「schema 段階で弾かれる真に malformed な payload」（例: 必須フィールド欠落）の拒否経路は別カバレッジであり、本テストには含まれない。診断→非承認→needs_approval の連鎖検証としては十分なため info 止まり |
| A-5 | info | 正規化（`package-normalization.ts`）は manifest/workspace の `createdAt`/`updatedAt` と operation-log の `timestamp` のみを `<normalized-timestamp>` に置換し、それ以外（モデルグラフ・ids・revision・diff・バイナリ byteLength）は生のまま比較する。正規化対象一覧はモジュール冒頭コメント（`:5-12`）に明記済み。決定論テスト・往復テストがザルになっていないことを確認した。§6「正規化フィールド一覧を報告に明記」の要件を実装コメントが満たしている |

## 実行ログ要点

- `pnpm run test:authoring-host`: **3 files / 8 tests 全パス**（Duration 8.57s）。closed-problem-01-smoke 472ms、run-authoring-host-command 5 tests、cli-cross-process 2 tests（3.4s + 1.6s = 実プロセス起動の裏付け）。
- `npx vitest run packages/ai-interface/src/ai-auto-approval-policy.test.ts packages/ai-interface/src/dependency-boundary.test.ts`: **2 files / 11 tests 全パス**。auto-approval 6 + dependency-boundary 5。ai-interface の境界テストが緩和されずパスすることを実地確認。
- Orch-Sylph 報告（authoring-host 3/8、ai-interface 88）と整合。

## 質問

なし。§3.1 / §3.4 / §6 / §9 の範囲で判定に必要な情報はコード・実行から確認できた。finding A-1〜A-3（いずれも minor、required 7 項目外の周辺負ケース）を Domain A のフォローに含めるか否かは Orch-Sylph / Undine の裁量。blocking ではないため本レビューは pass を維持する。
