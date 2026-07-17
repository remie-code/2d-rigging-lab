# 多頭化(頭脳差し替え) Domain C レビュー — レーン: test

> レビュアー: Review-Sylph（サブエージェント委任・呼び出し元 Orch-Sylph）。
> 対象: 実装報告 [../../waves/brain-swap/domain-c.md](../../waves/brain-swap/domain-c.md)。
> 基準: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain C・§4 blocking 基準（本レーンは #3 実消費ゼロ + #2 の test 面を主眼）。
> 検証方法: テストコード精読 + `node --test` 個別ファイル実行（自己実行・生出力）+ 全体実行 + 既存テスト改変の diff 精読。Gnome の報告書の数字を鵜呑みにせず、すべて自分で再現した。

## 総合判定: **PASS**

- **blocking #3（実消費ゼロ・全 fake）**: 満たす。
- **blocking #2 の test 面（既存テスト無退行）**: 満たす。既存アサーションの削除・弱体化は 1 件もない（diff 全件精読済み）。
- **blocking #7 の test 面（KILL/NG 弁の頭非依存）**: 満たす。既存 NG/KILL テストは無変更のまま緑。新規テストで NG ブロック時 entry に `latencyMs` が乗らないことを `hasOwnProperty` で直接確認。
- **報告数字の正確性**: domain-c.md §2 の個別ファイル件数はすべて実測と一致（後述）。

---

## 1. 個別ファイル件数の突合結果（最重要）

`apps/soul/agent` で自分の環境から `node --test <単一ファイル>` を個別実行し、domain-c.md §2 の記載と突き合わせた。

| ファイル | domain-c.md 記載 | 自己実行結果 | 一致 |
|---|---|---|---|
| `src/mind/fire-orchestrator.test.mjs` | 66 | **66/66 pass** | ✅ |
| `src/cockpit/cockpit-server.test.mjs` | 95 | **95/95 pass** | ✅ |
| `src/cockpit/view-logic/transcript.test.mjs` | 5 | **5/5 pass** | ✅ |
| `src/cockpit/view-logic/usage.test.mjs` | 4 | **4/4 pass** | ✅ |
| `src/cockpit/view-logic/health.test.mjs` | 8 | **8/8 pass** | ✅ |
| `src/cockpit/view-logic/settings.test.mjs` | 11 | **11/11 pass** | ✅ |
| `src/cockpit/cockpit-ui.test.mjs` | 38 | **38/38 pass** | ✅ |

全体再実行（`apps/soul/agent` ルートで `node --test`）:
```
1..827
# tests 827
# suites 0
# pass 827
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1786.0875
```
814 → 827（**+13**）を独立再現。fail/cancelled/skipped/todo すべて 0。

**Domain B で起きた「全体 TAP 連番の取り違えによる水増し」は今回発生していない。** 個別 7 ファイルすべてで報告値と実測値が完全一致し、内訳合計（+3/+3/+1/+1/+3/+0/+2=+13）も全体差分と整合する。

---

## 2. latencyMs 配線テストの証明力

`src/mind/fire-orchestrator.test.mjs:1923-1995` に 3 本、意味のあるアサーションで固定されている（空テストではない）。

- **自然完了時に実測値が乗る**（:1923-1949）: `session.ask` が `elapsedMs: 1234` を返す fake → `souls[0].latencyMs === 1234` を確認。加えて `buffer.all()`（正本）側には `latencyMs` プロパティ自体が存在しないことを `Object.prototype.hasOwnProperty.call(all[1], "latencyMs") === false` で確認（正本 freeze・スプレッドで新規オブジェクト化、という設計判断を機械的に固定）。
- **非数値/欠落時は null**（:1951-1971）: `elapsedMs` を返さない fake session で `souls[0].latencyMs === null` を確認（後方互換）。
- **NG ブロック時は latencyMs が乗らない**（:1973-1995）: 実際に `NG_WORDS[0]` を fake 応答に埋め込み、`result.reason === "ng-blocked"` かつ `hasOwnProperty(souls[0], "latencyMs") === false` を確認。検問所（`containsNgWord`）の判定ロジック自体は触れていないことをテストからも裏付けている。

cockpit-server.test.mjs 側（:2326-2375）は「`entry.latencyMs` があれば SSE `transcript.latencyMs` として実値で流れる」「無ければ従来どおり `null`（既存呼び出し形は壊れない）」を SSE 経由で end-to-end 確認しており、fire-orchestrator 側の単体テストと重複せず補完関係にある。証明力は十分。

## 3. brain 札テストの証明力

`cockpit-server.test.mjs:2326-2404` の 3 本すべてが `makeFakeBrainWiring("claude"|"codex")`（fake の `brainStatus()`）を注入し、`broadcastSoulTranscript`／`onUsage` が `brainStatusImpl().brain` を additive に読んで SSE イベントへ乗せることを実際に検証している。

- soul 行の `brain` 札が `brainStatus` の現況（"claude"）どおりに乗ることを確認（:2326-2351）。
- `brainStatus` 未注入なら `brain:null`（audioDevice/channel と同型の未注入ゲート）を確認（:2353-2375）。
- `onUsage` の `brain` 札が `brainStatus` 現況（"codex"）どおりに乗り、既存フィールド（`usage.input_tokens`／`vision`）は無変更であることを確認（:2377-2404）。

実装側（`cockpit-server.mjs:1191,1222`）を読み、`brainStatusImpl()?.brain ?? null` の additive 読み取りであることも確認済み。テストの主張と実装が一致している。

## 4. view-logic fixture テストの証明力

- `latencyLabel`（transcript.test.mjs:41-52）: brain 付き `"(1.5s · claude)"`、brain 未指定/null/空文字は従来どおり `"(1.5s)"`、`latencyMs` が null/undefined なら brain の有無に関わらず `null`——全分岐を固定。
- `usageNoteText`（usage.test.mjs:29-47）: brain 付き `"usage[claude]: ..."`、vision+brain 併記 `"usage(vision)[codex]: ..."`、brain 未指定/null は従来文字列——固定。
- `brainLabel`（health.test.mjs:108-115）: 既知 2 id・未知 id・null・undefined の分岐を固定。
- `brainCredentialHealthLabel`（health.test.mjs:117-125）: **健康 / 未検出 / unknown の 3 分岐**を固定（`credentialHealth: true/false/欠落/非 boolean` の 4 パターンで検証、非 boolean 混入時も unknown へ倒すことまで確認しており堅牢）。
- `BRAIN_LABELS` 自体の宣言内容（`{claude: "Claude (Opus 4.8)", codex: "Codex (GPT-5.6 Terra)"}`）も固定（health.test.mjs:102-106）。

いずれも空アサーション・トートロジーではなく、意味のある fixture 固定になっている。

## 5. 既存テスト改変の妥当性（blocking #2 の test 面）

`git diff` を全対象ファイルで精読した。

| ファイル | diff 統計 | 内容 |
|---|---|---|
| `fire-orchestrator.test.mjs` | +78 / -0 | 純追加のみ |
| `cockpit-server.test.mjs` | +219 / -0 | 純追加のみ |
| `transcript.test.mjs` | +13 / -0 | 純追加のみ |
| `usage.test.mjs` | +20 / -0 | 純追加のみ |
| `health.test.mjs` | +37 / -1 | import 文が 1 行→8 行に展開されただけ（-1 の正体はこれ）。テスト本体は純追加 |
| `settings.test.mjs` | 既存 2 test() へアサーション追記 | 後述 |
| `cockpit-ui.test.mjs` | 既存 2 test() へ更新 + 新規 2 test() | 後述 |

**settings.test.mjs**: `import` に `brainPostErrorText` を追加。「設定 POST の失敗文言」test 内の `for (const fn of [...])` 配列に `brainPostErrorText` を追加しただけ（既存 3 関数 `visionTargetPostErrorText`/`audioDevicePostErrorText`/`channelPostErrorText` のアサーションは 1 行も削除・変更なし）。`requestErrorText` test にも `"brain"` ケースを 1 行追記しただけ。**既存アサーションを緩めた箇所は皆無**。domain-c.md の「新規 test() ブロックは追加していない」という記載も diff と一致。

**cockpit-ui.test.mjs**: `settingsFromSnapshot` の既存 `deepEqual` 期待値オブジェクトに `brain` フィールドを追加しただけ（`channel`/`visionTarget`/`selfFire`/`verbosity`/`audioDevice`/`chat`/`killed` の既存フィールド検証は完全に維持）。むしろ `deepEqual` なので `brain` フィールドが正しく通ることまで検証範囲が広がっており、**アサーションは強化された**（緩めていない）。新規 2 test()（brain 札の transcript 表示・SettingsSelect 頭脳区画の option 描画）は既存改変ではなく純粋な追加。

結論: **既存テスト改変はすべて additive で、回帰を隠す変更は存在しない。**

## 6. fake 徹底・実消費ゼロの確認

- `fire-orchestrator.test.mjs`／`cockpit-server.test.mjs` を `existsSync|readFileSync|auth\.json|http://|https://|fetch\(|process\.env\.(OPENAI|ANTHROPIC|CODEX)` で grep。ヒットしたのは既存の chat 機能テスト（YouTube URL 文字列・Domain C 無関係）とコメント 1 件（「実 auth.json に触れない」という説明コメント）のみ。実ネット呼び出し・実ファイル読み込みは無い。
- `makeFakeBrainWiring`（cockpit-server.test.mjs:2194-2206）は `credentialHealth: true` を固定で返す fake であり、`src/mind/brains.mjs` や実資格情報ファイルには一切触れていない。
- `src/cockpit` 配下を `import.*(mind/brains|mind/codex-session|@anthropic|openai)` で grep → ヒットなし。cockpit 層は brain 実体を import しない責務境界を保っている（テストからも裏付けられる）。
- 実装側（`fire-orchestrator.mjs` の diff）も確認: 自然完了パスの `emit(onSoulTranscript, ...)` 1 箇所のみへの追記で、`killed`／`containsNgWord` の判定ロジックには 1 行も触れていない。

以上より、**実消費ゼロ・全 fake（blocking #3）は満たされている**。

## 7. non-blocking の気づき

1. **health.test.mjs の import 文フォーマット変更**: domain-c.md §1 の一覧には「health.test.mjs（新規テスト 3 本追加）」とのみ記載され、import 文が 1 行から複数行へ展開された事実（diff 上 `-1/+9`）には触れていない。実質的な挙動には無関係（純粋なフォーマット変更）だが、diff 全件精読の過程で気づいたため記録する。blocking ではない。
2. §3-5／§7-1 で申し送りのあった「`onBrainSet` ハンドラ自体は構造的にユニットテストできない」制約は、`domain-b レビュー §6 申し送り 8` で既に確認済みの既存規律（hooks 使用コンポーネントは vnode 走査で検証不能）と同型であり、test レーンとしてもこれを合理的な制約として是認する。葉部品 `SettingsSelect` の vnode テスト + view-logic fixture テストによる代替固定は、既存の `onAudioSet` 等と同水準のカバレッジであり、Domain C 単体の判断としては妥当。

## 8. 質問

なし。数字・fake 徹底・既存テスト改変のいずれも明確に検証でき、判断に迷う点はなかった。

---

## 実行した `node --test` 生末尾（再掲・個別内訳込み）

```
$ node --test src/mind/fire-orchestrator.test.mjs
1..66 / tests 66 / pass 66 / fail 0

$ node --test src/cockpit/cockpit-server.test.mjs
1..95 / tests 95 / pass 95 / fail 0

$ node --test src/cockpit/view-logic/transcript.test.mjs
1..5 / tests 5 / pass 5 / fail 0

$ node --test src/cockpit/view-logic/usage.test.mjs
1..4 / tests 4 / pass 4 / fail 0

$ node --test src/cockpit/view-logic/health.test.mjs
1..8 / tests 8 / pass 8 / fail 0

$ node --test src/cockpit/view-logic/settings.test.mjs
1..11 / tests 11 / pass 11 / fail 0

$ node --test src/cockpit/cockpit-ui.test.mjs
1..38 / tests 38 / pass 38 / fail 0

$ node --test   (apps/soul/agent 全体)
1..827
# tests 827
# pass 827
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
