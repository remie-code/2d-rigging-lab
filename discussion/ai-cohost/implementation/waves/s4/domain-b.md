# S4 Domain B: 可視化 + 実 SDK 確認 + 計測 + docs（表情を「見える・観測する」）

> Status: 実装完了・機械ゲート緑・実 SDK 観測完了（2026-07-13）。人間ゲート待ち。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・lockfile 不変）。
> 前提: Domain A（パーサ + 演出表 + 翻訳層 + 結線）完成・レビュー PASS 済み
> （[domain-a.md](domain-a.md)・特に §7 ワイヤ契約を消費）。
> 契約の正: [../../orchestration/s4-wave-plan.md](../../orchestration/s4-wave-plan.md) §3 Domain B。

## 0. この Domain が乗せたもの（Domain A の上に）

```
orchestrator.onExpression({word,args?,applied,rejected})   [Domain A が emit]
  → cockpit-server: broadcast("expression", info)          [B: SSE 結線]
  → cockpit.html:   addExpressionRow → 演出イベント行        [B: 可視化]
orchestrator.onDiagnostic({type:"expressionUnknownTag",tag})[Domain A が emit]
  → cockpit-server: broadcast("diagnostic",{...,tag})       [B: tag を追加フィールドで橋渡し]
  → cockpit.html:   addGhostRow("(unknown tag: …)")         [B: ゴースト行]
実 SDK: observe-expressions.mjs → タグ実出現の観測（5/5・未知 0）→ experiments/s4-expressions.md
```

## 1. 実装したファイル一覧

### 新規（すべて `apps/soul/agent/` or `discussion/`）
| ファイル | 役割 |
|---|---|
| `apps/soul/agent/scripts/observe-expressions.mjs` | **実 SDK 観測**（measure-fire.mjs 写経）。タグ教示入り FIRE_SYSTEM_PROMPT で ask し、生応答のタグ出現率・位置・未知タグ率・翻訳層カバレッジを観測。上限 5 ask・env ガード・タイムアウト・再試行 3・捏造禁止。 |
| `discussion/ai-cohost/experiments/s4-expressions.md` | 上記の**実観測記録**（生数字 or 未実行理由・s3-summon.md の流儀）+ 人間ゲート記入欄。 |
| `discussion/ai-cohost/implementation/waves/s4/human-gate-procedure.md` | S4 人間ゲート手順書（S3 手順 + 「感情が動く話題を振る → 表情が乗るのを見る」+ 現素材制約の注意）。 |
| `discussion/ai-cohost/implementation/waves/s4/s4-followup.md` | followup 台帳（四層昇格・Player 質感・眉 Issue・タグ位置同期・Domain A §9 の人間ゲート持ち越し）。 |
| `discussion/ai-cohost/implementation/waves/s4/domain-b.md` | 本ファイル（契約成果物）。 |

### 改修（既存）
| ファイル | 変更点 |
|---|---|
| `src/cockpit/cockpit-server.mjs` | fireOrchestratorFactory hooks に `onExpression: (info)=>broadcast("expression", info)` を追加（onFire と同型）。handleDiagnostic の broadcast に `tag` フィールドを追加（**追加フィールド**・startMs/endMs と同じ扱い・expressionUnknownTag の語をページへ橋渡し）。JSDoc 更新。 |
| `src/cockpit/cockpit-server.test.mjs` | +2: onExpression→SSE "expression" テスト・実 orchestrator の演出タグが sendEnvelope→onExpression→SSE まで縦貫通するテスト。 |
| `src/cockpit/cockpit.html` | 演出イベント行（`addExpressionRow`・`expr` ラベル・`語 ✓適用/✗拒否`・SSE "expression" 購読）+ `.row.expression` CSS（--accent）+ diagnostic `expressionUnknownTag` → ゴースト行。 |
| `src/cockpit/cockpit-page.test.mjs` | +3: expression 購読 + 行描画・行が語/applied/rejected/class/CSS を持つ・expressionUnknownTag ゴースト行（他の演出診断は分岐を持たないことも固定）。 |
| `scripts/preflight-fire.mjs` | 演出縦貫通を追加（fake のタグ込み応答 → sendEnvelope(fake accepted) → SSE "expression"・smile=4 スロット）。既存 assert は speechText（剥離後）を見るため不変。 |
| `apps/soul/README.md` | S4「表情が乗る」の節を追記（タグ語彙 6 語・パイプライン・可視化・調整の在り処・現素材制約）。 |

**器コード（`apps/runtime-player/**`）・C4/C5 契約 JSON・`pnpm-lock.yaml`・`package.json` は完全不変**
（`git status -- apps/runtime-player pnpm-lock.yaml '**/package.json' packages` が空・新規依存ゼロ・
Node 組み込みのみ）。`scripts/cockpit.mjs`（本番結線）は `...hooks` を spread するため **onExpression は
無改修で本番に届く**（cockpit.mjs は触っていない）。

## 2. SSE "expression" 結線と可視化の仕様

### 結線（cockpit-server.mjs）
- `broadcast("expression", info)` を fireOrchestratorFactory の `onExpression` hook として渡す。`info` は
  Domain A §7 の `{ word, args?, applied, rejected }` を素通し（cockpit-server は中身を解釈しない）。
- `expressionUnknownTag` 診断は既存 handleDiagnostic 経由で `broadcast("diagnostic", {...})` される。B は
  そこに `tag: d?.tag ?? null` を**追加フィールド**として足した（他の診断型は tag:null になるだけ・契約
  破壊なし。startMs/endMs を追加した S2.5 追撃 domain-f と同じ手口）。

### 可視化（cockpit.html）
- **演出イベント行**（`addExpressionRow`）: SSE "expression" を受け、発火マーカーと同型の 1 行を描く。
  `expr` ラベル + `語（+任意 args）✓適用スロット数/✗拒否スロット数`（例 `smile ✓4/✗0`）。teal（--accent）で
  transcript/fire/soul 行と視覚的に区別。声にも会話ログにも出ない演出の適用痕跡を Timeline に残す。
- **未知タグ = ゴースト行**: diagnostic `expressionUnknownTag` を既存ゴースト行の型（淡色 `.row.ghost`）で
  `(unknown tag: <tag>)` と描く（声にも演出にも出ないが痕跡は残す）。
- **他の演出診断の扱い（過剰表示を避ける裁定・S3 の抑制方針に倣う）**:
  - `expressionBrokenTag`（壊れ括弧の除去痕）= パース副産物のノイズ → **非表示**。
  - `expressionRejected` / `expressionSendError`（発話済み fire のスロット単位の器拒否/送出失敗）=
    その語の**演出イベント行が既に `✗N`（拒否スロット数）で伝える** → 二重表示を避け**非表示**。
- **調整 UI は置かない**（裁定）: 強さ係数スライダー等は操縦席に置かない。ページは表示のみ。

## 3. 実 SDK 確認の**実観測**（生数字）

記録: [../../../experiments/s4-expressions.md](../../../experiments/s4-expressions.md)。
系: `observe-expressions.mjs`（実 SDK・claude-opus-4-8・**タグ教示入り FIRE_SYSTEM_PROMPT**・
apiKeySource "none" = サブスク OAuth）。**5 ask 全数成功・再試行 0・捏造なし**（環境で実 SDK 実行可能
だった：ANTHROPIC_API_KEY 等未設定・BASE_URL 既定・env ガード通過）。

| 観測項目 | 生数字 |
|---|---|
| **(a) タグ出現率** | **5/5（100%）** — 感情が動く話題（困る/驚く/同意/喜び/照れ）に毎回タグが乗った |
| **(b) 出現位置** | **文中 5/5**（文頭 0・文末 0・単独 0）— 全て冒頭相槌の直後（例 `そっか<troubled>じゃあ…`） |
| **(c) 未知タグ率** | **0/5**（教示外の語は 0・壊れタグ 0） |
| **(d) 翻訳層カバレッジ** | **5/5 語が payload 列へ写像・翻訳診断 0**（troubled 3 / surprised 3 / nod 1 / smile 4 スロット） |

- 語と感情の対応も的確（困る→troubled・驚く→surprised・同意→nod・喜び→smile・照れ/謝り→troubled）。
  **タグ教示（最小仮面のまま・人格作り込みなし）は効く**——本 wave の主要な未検証点が解けた。
- **envelope accepted 率（実器での受理）は未計測**（実チャネル/実器は人間ゲートの領分・§4 記入欄）。
  ここは「魂が正しいペイロードを生成できる」翻訳層までの確認。
- usage: 5 ask 合計 input 2,500 tok（#5 で履歴が 1h cache へ・cache_creation 1,113）/ output 121 tok。
  ttft ≈1.3〜2.7s・ask 全体 ≈3.4〜5.0s（S3 measure-fire と同水準・タグ教示で応答は伸びていない）。
- 実機での見え方（タグ → 目/視線/頭/体・符号・nod の頷き）は**人間ゲートで確定**（experiments §4）。

## 4. preflight 無退行の確認結果（+ 演出足し）

- **既存 preflight は無退行**: `preflight-fire.mjs`（B の cockpit-server 改修後）→ **RESULT: PASS / EXIT=0**。
  `preflight-cockpit.mjs`（handleDiagnostic の tag 追加後）→ **RESULT: PASS / EXIT=0**（ハングなし）。
- **演出足しを実施**（可能だったので追加）: `preflight-fire.mjs` に、fake のタグ込み応答
  `"はーい、どうしたの？<smile>"` → parseExpressionTags → translateExpression → `channel.sendEnvelope`
  （fake accepted）→ SSE `expression` イベントまでの**縦貫通**を追加。smile=4 スロット
  （mouth-smile + eye-blink-left/right + head-tilt）が送られ、SSE expression(smile) が観測されることを
  実 HTTP/SSE で確認。既存 assert（spokenText・soul entry text）は**剥離後の speechText**を見るため不変。

## 5. docs / 人間ゲート手順書の追記箇所

- **README**（`apps/soul/README.md`）: 「#### S4: 表情が乗る」節を追記（S3 節の直後）。タグ語彙 6 語・
  パイプライン（parser→table→translator→orchestrator）・操縦席の可視化・**調整の在り処**（強さ係数は
  orchestrator オプション・操縦席に UI を置かない裁定）・**現素材制約**（mouth-smile 見えない・見える
  本命は目/視線/頭/体・nod 単峰・符号リグ依存）。
- **人間ゲート手順書**（`waves/s4/human-gate-procedure.md`・新規）: S3 手順書 §1〜4 を参照（全器官起動は
  不変）+ §5「感情が動く話題を振る」（語ごとの期待表情の表）+ §6 演出イベント行の見方 + §7「見るときの
  注意」で現素材制約を正直に明記（Domain A §9 質問 1・2 を反映: mouth-smile 不可視・nod 単峰・符号未確定・
  look-camera 単独）。
- **experiments/s4-expressions.md** §4: 実機での各語の見え方・符号の正/逆の記入欄（人間ゲートで埋める）。

## 6. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・S4 全体 = Domain A + B の総数）:

```
# tests 331
# pass  331
# fail  0
```

- **S4 前ベースライン 284 → Domain A 後 326 → Domain B 後 331**（+5）。内訳: cockpit-server +2
  （expression SSE broadcast・実 orchestrator の envelope→expression 縦貫通）/ cockpit-page +3
  （expression 購読 + 行・行の語/applied/rejected/class/CSS・expressionUnknownTag ゴースト行）。
- **既存テスト変更なし**（S1〜S3 挙動不変・既存 assert 緩めなし・cockpit-page の名前ズレは触らず
  s4-followup §3-1 へ）。純関数 fixture 全緑。
- **器コード diff 空**: `git status -- apps/runtime-player pnpm-lock.yaml '**/package.json' packages` が空。
  新規依存ゼロ・lockfile/package.json 不変。
- preflight: `preflight-fire.mjs` PASS（+演出縦貫通）/ `preflight-cockpit.mjs` PASS（無退行）。
- 実 SDK: `observe-expressions.mjs` 5 ask 成功（experiments/s4-expressions.md）。

## 7. §質問（Orch への申し送り）

1. **人間ゲート後の演出表チューニング**（Domain A §9 質問 1・2・s4-followup §1）: `nod` の単峰が頷きに
   見えるか・head/gaze/body の符号が正しいかは実機で確定。逆なら演出表 1 行修正。この裁定は人間ゲートの
   証言待ちで、Domain B では触れない（配線は済み）。
2. **多タグ応答が未観測**（s4-followup §3-2）: 実 SDK 観測は 5/5 が「1 応答 = タグ 1 個」だった。複数語が
   順に出る応答（例 驚き→頷き）の envelope 重ね合わせ・タグ位置同期の要否は、多タグ応答が実際に出て
   から判断（S5+）。配線（複数 events を出現順処理）は済み・fixture で固定済み。
3. **強さ係数の CLI 配線は未実施**（s4-followup §3-4）: `expressionIntensity` は orchestrator オプション
   として口だけ開いている（既定 1.0）。CLI フラグ化は「強すぎ/弱すぎ」が実機で確認されてから（操縦席
   UI には置かない裁定）。必要なら `parseCockpitArgs` に 1 フラグ + factory へ渡すだけ（数行）。
4. **cockpit-page.test.mjs の既存ケース名ズレ**（S3 followup §1-5 の継続・s4-followup §3-1）: 既存
   「asrFailure adds a ghost row; other diagnostic types do not」は expressionUnknownTag 追加で名前が
   さらにズレたが、**既存テスト変更禁止**の規律で触っていない。次に当該既存ケースを触る wave で名前更新を推奨。
