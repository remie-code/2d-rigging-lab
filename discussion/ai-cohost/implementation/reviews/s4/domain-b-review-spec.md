# S4 Domain B レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-13。根拠: 契約文書・対象ファイル・working tree の実物（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s4-wave-plan.md](../../orchestration/s4-wave-plan.md) §3 Domain B / §4 /
> [../../orchestration/s4-planning-inventory.md](../../orchestration/s4-planning-inventory.md) /
> [../../waves/s4/domain-a.md](../../waves/s4/domain-a.md) §7 ワイヤ契約 /
> [../../waves/s4/domain-b.md](../../waves/s4/domain-b.md)（Claim）。
> 対象コミット状態: **S4（Domain A+B）は未コミット・working tree に存在**（セッション開始時の
> git clean は古いスナップショット）。器不変の検証は working tree の `git status` で行った。

## 総合判定: **PASS-with-nonblocking**

blocking 基準（wave-plan §4）は 5 項目すべて満たす。spec 検証項目 1〜7 はすべて PASS。
non-blocking の軽微な指摘 1 件（cockpit.html コメント内の例示数値が実挙動と不一致・動作影響なし）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が 1 回実行・タイムアウト 300s）:

```
# tests 331
# pass 331
# fail 0
# duration_ms 1102.5032
```

→ **Claim（domain-b.md §6）の 331/331 と一致**。空/interrupted なし（1 回で確定）。

**器不変の検証**（working tree・`git status --short -- apps/runtime-player packages pnpm-lock.yaml
'**/package.json' apps/soul/agent/package.json apps/soul/agent/package-lock.json`）:
→ **出力ゼロ**（器コード・C4/C5 契約 JSON・lockfile・package.json いずれも未変更）。
全変更は `apps/soul/agent/**`（魂特区・独立 npm）と `discussion/` のみ。`.tmp/**` は FaceX 別作業の
未追跡物で S4 無関係。**実 SDK（observe-expressions.mjs）は規律どおり再実行していない**（記録の
検証で足りる）。

---

## spec 検証項目（契約適合・PASS/FAIL + 根拠）

### 1. 演出イベント行が発火マーカーと同型で「語 + 適用/拒否スロット数」を表示 — **PASS**

- `cockpit.html:320-336` `addExpressionRow(d)`。SSE `"expression"` を購読（`cockpit.html:448`）。
- **発火マーカーと同型**: `addFireMarkerRow`（`cockpit.html:302-315`）と同じ 4 要素構造
  （`time` / `who` / `marker` / `text`）を踏襲。マーカー記号は fire=`*` に対し expr=`◆`、who ラベルは
  `expr`（teal `.row.expression` = `--accent`・`cockpit.html:100-102`）で fire/soul/transcript と視覚分離。
- **語 + 適用/拒否スロット数**: `text.textContent = word + args + " ✓" + applied + "/✗" + rejected`
  （`cockpit.html:332`・例 `smile ✓4/✗0`）。ペイロードは domain-a.md §7 の
  `{word, args?, applied, rejected}` を cockpit-server が素通し（`cockpit-server.mjs:744`
  `onExpression: (info) => broadcast("expression", info)`）。契約（wave-plan §3・domain-a §7）と一致。

### 2. 未知タグ = ゴースト行（声にも演出にも出ない痕跡） — **PASS**

- `cockpit.html:461` `else if (d.type === "expressionUnknownTag") addGhostRow("(unknown tag: " + (d.tag || "?") + ")")`。
- `addGhostRow`（`cockpit.html:272-284`）は既存の `.row.ghost`（`cockpit.html:95` `--muted` + italic
  = 淡色）を再利用。discard/ASR 失敗と同じ「無言の消失を残す」型。
- tag の橋渡し: `cockpit-server.mjs:421-427` の `broadcast("diagnostic", {..., tag: d?.tag ?? null})`
  で `expressionUnknownTag` の語をページへ渡す（**追加フィールド**・他診断型は tag:null になるだけで
  契約破壊なし・S2.5 domain-f の startMs/endMs と同手口）。domain-a §7 の
  `expressionUnknownTag {type, tag}` を消費。**声にも演出にも出ず痕跡のみ**が契約どおり成立。

### 3. 操縦席に調整 UI を置いていない（強さ係数スライダー等・裁定遵守） — **PASS**

- `cockpit.html` に `slider` / `input[type=range]` / `intensity` 等の調整 UI 要素は**存在しない**
  （grep 0 件）。`cockpit.html:319` に「調整 UI（強さ係数スライダー等）は操縦席に置かない裁定——ここは
  表示のみ」と明記。
- 過剰表示回避も裁定準拠: `expressionBrokenTag`（パース副産物）と `expressionRejected` /
  `expressionSendError`（演出行が既に `✗N` で伝える）は**非表示**（`cockpit.html:462-464` 付近の分岐）。
- 強さ係数は `createFireOrchestrator({ expressionIntensity })` のオプション（既定 1.0・CLI/設定側）に
  留まり操縦席に露出しない（planning-inventory §3-6 の「操縦席には置かない」裁定と一致）。

### 4. 実 SDK 確認が上限 5 ask・env-guard 遵守 / experiments 記録の実測 texture と内部整合 — **PASS**

- `observe-expressions.mjs`: `MAX_ASKS = 5`（:44）、`measuringSession.ask` が **6 回目を throw**
  （:153-154）、起動時 `assertSubscriptionAuthEnv(process.env)` で env ガード（:127・ANTHROPIC_API_KEY 等
  検出で起動拒否）、`MAX_RETRIES = 3`（:48）、空応答/タイムアウトは再試行上限超で **throw = 正直停止**
  （:182-184・数字捏造なし）。→ wave-plan §4-4 の「上限 5 ask・env ガード遵守」に適合。
- **記録の実測 texture**（experiments/s4-expressions.md §1 の表）: per-ask の生応答テキスト
  （`そっか<troubled>じゃあ…` 等）・per-ask の ttft(ms)/ask(ms) 実測値・usage を持つ。
- **内部整合**（Review が突き合わせ）:
  - タグ出現率 5/5・未知 0/5・位置「文中 5/5」= 表の各行と合致。
  - ttft 個別値 1331〜2727ms → まとめ「≈1.3〜2.7s」と一致。ask 個別値 3423〜5044ms →
    「≈3.4〜5.0s」と一致。
  - 翻訳スロット数 troubled 3 / surprised 3 / nod 1 / smile 4 → domain-b.md §3 の
    「troubled 3 / surprised 3 / nod 1 / smile 4 スロット」と一致。
  - usage input 2,500 / output 121 tok の記録あり。
- **未実行時の正直記録の道**も用意（§2「ガードで起動拒否 → その場合は本記録に未実行/blocked と正直に
  残す」）。**Review は実 SDK を再実行していない**（追加サブスク消費回避・記録の検証で足りる）。

### 5. docs（README S4 節・人間ゲート手順書） — **PASS**

- **README**（`apps/soul/README.md` の「#### S4: 表情が乗る」節）: タグ語彙 6 語・パイプライン
  （parser→table→translator→orchestrator）・操縦席の可視化・**調整の在り処**（強さ係数は
  orchestrator オプション・操縦席に UI 置かない）・**現素材制約を正直に明記**（mouth-smile は keyform
  未設定＝見えない / 見える本命は目・視線・頭・体 / nod は ADS 単峰＝下げて保持して戻す近似 /
  head/gaze/body の符号はリグ依存で未確定）。契約（wave-plan §3）の要素をすべて含む。
- **人間ゲート手順書**（`waves/s4/human-gate-procedure.md`・新規）: §1〜4 は S3 手順書参照で**全器官
  起動**（AivisSpeech + 器 + 耳 + 操縦席 + 実マイク）を要求・§5「感情が動く話題を振る」（語ごと期待
  表情の表）・§7「見るときの注意」で現素材制約（mouth-smile 不可視・nod 単峰・符号リグ依存・
  look-camera 単独）を正直に明記。契約（wave-plan §3「S3 と同じ全器官起動 +『感情が動く話題を振る』」）
  と一致。

### 6. followup 台帳の 4 項目 — **PASS**

`waves/s4/s4-followup.md` §2 に 4 項目すべて台帳化:
1. パッケージ宣言層への昇格（四層の道 ①→②→③→④・§2-1）。
2. Player 側質感スライダー（②〜③の入口・§2-2）。
3. 眉（brow）Issue（器の契約拡張 wave・魂単独不可・§2-3）。
4. タグ位置同期（v0 は発話開始一括・position 保持のみ・§2-4）。
（加えて §3 に S4 固有の持ち越し 4 件・§1 に人間ゲート後確定事項を台帳化。粒度は S3 followup 踏襲。）

### 7. preflight 無退行（+ 演出足し）の主張が根拠付きで書かれているか — **PASS**

- domain-b.md §4 が `preflight-fire.mjs` PASS/EXIT=0・`preflight-cockpit.mjs` PASS/EXIT=0（無退行）を主張。
- **演出足しの実体を確認**: `preflight-fire.mjs:203-209` に、fake の `<smile>` タグ込み応答 →
  parseExpressionTags → translateExpression → `channel.sendEnvelope`（fake accepted）→ SSE `expression`
  イベントまでの**縦貫通**が実装されている。`smile = 4 スロット`（`sentEnvelopes.length !== 4` を assert）・
  SSE expression(smile) の `applied>0 && rejected===0` を assert。既存 assert（spokenText・soul entry）は
  剥離後の speechText を見るため不変（:186-193）。主張は成果物（コード実体）で根拠付き。
- Review は preflight を再実行していないが、`node --test` 331/331 緑で無退行はカバー済み・preflight は
  SDK/マイク不要のため本 wave の blocking 判断には node --test で十分。

---

## blocking / non-blocking の分離

### blocking（wave-plan §4）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・C4/C5 契約・lockfile 完全不変・新規依存ゼロ | PASS | working tree の器/packages/lockfile/package.json 変更ゼロ（上記）。全変更は魂特区内。|
| 2. 3 チェック無退行・実マイク/録音物非使用 | PASS | node --test 331/331。observe/preflight は実マイク・録音物を使わない設計（発話しない/fake）。|
| 3. 「タグが声に出る」事故の構造防止（性質テスト） | PASS | Domain A の parser 性質テスト（speechText に `<` `>` 残らない）は 331 に含まれ緑。B は剥離後 speechText を可視化するのみ。|
| 4. SDK 実消費 上限 5 ask・env ガード遵守 | PASS | 項目 4 参照（MAX_ASKS=5・6 回目 throw・assertSubscriptionAuthEnv）。|
| 5. 終了処理・タイムアウト | PASS | observe は ASK_TIMEOUT_MS=90s + session.dispose（finally）。preflight は SSE close + server.close（no hang）。|

### non-blocking（軽微・任意修正）

1. **cockpit.html:318 のコメント内の例示数値が実挙動と不一致**（コメントのみ・動作影響なし）。
   コメントは「例『smile ✓2/✗0』」と書くが、smile は演出表で 4 スロット（domain-b.md §2 と
   preflight assert は正しく `✓4/✗0`）。**表示ロジック（:332）は正しく実 applied を出す**ので画面は
   `✓4` を出す。コメントの例数字だけが古い。次に cockpit.html を触る wave でコメントを `✓4/✗0` に
   直すと整合（s4-followup へ回してもよい程度）。

---

## Orch への申し送り

- spec レーンとして S4 Domain B は契約適合。実装は wave-plan §3 / domain-a §7 ワイヤ契約 / 各裁定
  （操縦席に調整 UI 無し・過剰表示回避・現素材制約の正直な明記）に忠実。
- 残る未検証は**実機の見え方**（符号・nod の頷き・envelope accepted 率）で、これは設計上人間ゲートの
  領分（experiments §4 記入欄・s4-followup §1）に正しく切り出されている。Domain B のスコープ外。
- non-blocking の cockpit.html コメント例示は判定に影響しない。
