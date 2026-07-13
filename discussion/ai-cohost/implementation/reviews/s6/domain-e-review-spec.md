# S6 追撃 Domain E レビュー（spec レーン）— 自発発火に画像同乗

> レビュー担当: Review-Sylph（spec レーン・Orch-Sylph からのサブエージェント委任）。
> 判定基準: 人間ゲート後のユーザー裁定 3 点（2026-07-13・①格上げ ②盲目劣化 ③usage 計器で受容）+
> 追加作業 2 件（s6-followup.md §12 台帳追記・human-gate-procedure.md 再ゲート手順追記）/
> [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §4（blocking 基準は従来適用）。
> 対象: [../../waves/s6/domain-e.md](../../waves/s6/domain-e.md)（Gnome 成果物）・
> `apps/soul/agent/src/mind/fire-orchestrator.mjs`・`apps/soul/agent/src/cockpit/cockpit-server.mjs`・
> 両テストファイル・[../../waves/s6/s6-followup.md](../../waves/s6/s6-followup.md) §12・
> [../../waves/s6/human-gate-procedure.md](../../waves/s6/human-gate-procedure.md) §9-1。

## 0. 判定

**合格（blocking 指摘なし・non-blocking 指摘 1 件）**。

ユーザー裁定 3 点（格上げ・盲目劣化・usage 計器受容）と追加作業 2 件（docs 台帳追記）のすべてを
実装ファイル・テストファイル・docs の実物で照合し、読み違い・過不足は見つからなかった。silence/手動
Fire/手動視覚 Fire の挙動が 1 ビットも変わっていないことは、既存テスト（S5 視覚発火テスト群 570-867
行）がファイル末尾への追記のみの diff（`git diff` で確認）によって無傷のまま残っていることで裏付けた。
機械ゲートは自分で再実行し 518/518 全緑、器/契約/lockfile は自分で `git diff --stat` を実行し出力なし
（不変）を確認した。SDK 実消費の痕跡（新規 experiments ファイル・observe 系スクリプト実行ログ等）も
見当たらず、「SDK 消費ゼロ」の主張と整合する。

## 1. 逐条照合

### 1-1. 裁定①: call/turn-end の自発発火を画像付き発火へ格上げ（対象未設定なら従来どおり画像なし）

`fire-orchestrator.mjs` の `firePreferred(buffer)`（L641-677）を確認。

- 対象解決（`getVisionTarget()`）が null/空/throw → `fireNormalCore(buffer, {alreadyAccepted:false})`
  （L649-652）＝**新規受理経路の通常 Fire**（画像なし・中止しない）。
- 対象あり → `setState("thinking")` + `onFire{accepted:true, vision:true}`（L655-656）→
  `captureImpl(title)` 実行 → 成功なら `askWithVision`（L667-668、手動視覚 Fire の成功時と完全共通
  ─ `askWithVision` は 1 本の関数で両者が共有・L512-538）。
- `fire()` の振り分け（L707-713）で `visionMode === "preferred"` → `firePreferred`、`visionMode === true`
  → `fireVision`（従来）、それ以外 → `fireNormalCore` の 3 分岐を確認。

`cockpit-server.mjs` の `onFireRequest`（L958-985）で `req.kind === "silence"` のみ
`fire({vision:true})`、それ以外（call/turn-end）は `fire({vision:"preferred"})` と振り分けていることを
確認（L966-970）。裁定文言（call/turn-end のみ格上げ・silence は従来のまま）と正確に一致。

判定: **適合**。

### 1-2. 裁定②: 自発発火のキャプチャ失敗は中止ではなく画像なし通常発火へ静かに劣化（ゴースト行で痕跡）

`firePreferred` のキャプチャ失敗分岐（L658-666）を確認: `captured.error` があれば
`onDiagnostic{type:"fireVisionDegraded", kind, message}`（L663）を出した後、
`fireNormalCore(buffer, {alreadyAccepted:true})`（L665）へフォールバック（＝画像なし ask が成立し
中止しない）。`alreadyAccepted:true` は「既に thinking+accept 済みなので二重 accept を emit しない」
ための引数であることを `fireNormalCore` の実装（L566-570、`if (!alreadyAccepted)` の中でのみ
`setState("thinking")`/`onFire{accepted:true,...}` を emit）で確認した。

**手動視覚 Fire・silence の「見えなければ中止」が変わっていないこと**: `fireVision`（silence/手動視覚
Fire が使う関数・L593-631）はキャプチャ失敗時に `onDiagnostic{type:"fireVisionError", kind, message}`
+ `{fired:false, reason:"vision-capture-failed", kind}` を返して **`fireNormalCore` を一切呼ばない**
（session.ask を呼ばず中止）ことを確認。`firePreferred` と `fireVision` は完全に別関数であり、
`vision:true` の呼び出し（silence・手動視覚 Fire）は `firePreferred` を経由しない設計であることをコード
構造そのもので確認した（すり替わりようがない）。

既存テスト（`fire-orchestrator.test.mjs` 570-867 行、S5 視覚発火テスト群）が `vision-capture-failed`
中止・`vision-no-target` 中止の期待値をそのまま検証しており、`git diff` でこの範囲が **1 バイトも
変更されていない**（新規追加は 861 行以降のみ）ことを確認した（§2 参照）。

判定: **適合**。

### 1-3. 裁定③: usage 計器で見張る（実装作業なし・vision フラグの正直性）

`processAskedReply(buffer, asked, vision, extra)`（L297-408）は `vision` 引数をそのまま
`onUsage{usage, vision}` へ渡す（L299-301）。呼び出し元を確認:

- `askWithVision`（成功時）: `processAskedReply(buffer, asked, true, ...)`（L537）→ `vision:true`。
- `fireNormalCore`（対象未設定 or 劣化フォールバック）: `processAskedReply(buffer, asked, false, ...)`
  （L574）→ `vision:false`。

劣化/対象未設定は実際には画像なし ask（`fireNormalCore` 経由）なので `vision:false` が通知される
＝「見ていないのに見たと言わない」設計が実装と一致している。テスト（L906, L948, L1023）でも
成功時 `vision:true`・劣化/未設定時 `vision:false` が個別に固定されていることを確認した。
本裁定は実装作業を要求しておらず、既存 `onUsage` 契約（S5 由来）がそのまま機能する形になっていること
を確認した（新規コードの追加なし）。

判定: **適合**。

### 1-4. docs 追記 2 件

**s6-followup.md §12「口数（反応確率）の Cockpit 可変化」**（`git diff` で +20 行を確認）:
「配信中に Cockpit から切替できること（CLI 起動オプションでの固定は不可）」「UI は生スライダーでは
なくモード切替（控えめ/ふつう/おしゃべり の 3 段階程度）」「会話メイン→おしゃべり側／ゲーム集中→
現行程度」「実装時期は今後の課題」のすべてが記述されている。ユーザー裁定の文言（配信中に Cockpit から・
CLI 不可・モード切替 3 種・フェーズ対応・時期は今後）と逐語的に対応している。

**human-gate-procedure.md §9-1「再ゲート（自発発火に画像同乗）の一点確認」**（`git diff` で +17 行を
確認）: 「放置 45〜75 秒 → 沈黙発火が画面に言及（④の確認を兼ねる）」「call/turn-end の返事も対象設定済み
なら画面に触れることがある（格上げ）」「キャプチャ失敗でも自発発火は止まらず画像なしの普通の返事になる
（盲目劣化・ゴースト行 fireVisionDegraded）」「手動系・silence は不変」の 4 点が記述されている。
委任プロンプトが求めた「④確認兼用の一点確認」という構造は、見出しが「一点確認」・本文冒頭が「以下の
一点だけ見ればよい」としつつ、実際にはその一点を構成する確認事項が箇条書き 3 点に分解されている（§3
non-blocking 参照）。内容としての欠落・裁定との相違はない。

判定: **適合**（見出しの「一点」という表現と本文の箇条書き 3 点の粒度は non-blocking）。

## 2. 自分で再実行した生数字

```
cd apps/soul/agent && node --test
# tests 518
# suites 0
# pass 518
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1879.9685
```

518/518 全緑（domain-e.md の申告と一致・S6 Domain D 後ベースライン 507 → 518 の +11 増分も申告どおり）。

```
git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' pnpm-lock.yaml apps/soul/agent/package.json
→ 出力なし
```

器コード・契約 JSON・lockfile・soul package.json は完全不変（自分で確認）。

```
git diff --numstat -- apps/soul/agent/src/mind/fire-orchestrator.mjs apps/soul/agent/src/cockpit/cockpit-server.mjs
162  56  fire-orchestrator.mjs
  9   3  cockpit-server.mjs
```

domain-e.md §1 の申告（+162 -56 / +9 -3）と一致。

```
git status --porcelain -- apps/soul discussion
 M apps/soul/agent/src/cockpit/cockpit-server.mjs
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs
 M apps/soul/agent/src/mind/fire-orchestrator.mjs
 M apps/soul/agent/src/mind/fire-orchestrator.test.mjs
 M discussion/ai-cohost/implementation/waves/s6/human-gate-procedure.md
 M discussion/ai-cohost/implementation/waves/s6/s6-followup.md
?? discussion/ai-cohost/implementation/waves/s6/domain-e.md
```

変更範囲は申告どおり `apps/soul/agent` の 4 ファイル + `discussion` の 2 ファイル + 新規 domain-e.md の
みで、範囲外の変更・SDK 実消費を示す新規ファイル（experiments 配下・usage ログ等）は見当たらなかった。

```
git diff HEAD -- apps/soul/agent/src/mind/fire-orchestrator.test.mjs
```
の差分は L861 以降への純追加（`@@ -861,6 +861,267 @@`）のみであることを確認した。既存 39 本の
テスト本文は 1 文字も変わっていない（無退行の構造的裏付け）。

```
git diff HEAD -- apps/soul/agent/src/cockpit/cockpit-server.test.mjs
```
の差分は既存「呼びかけ命中で fire を呼ぶ」テストの 1 アサーション（`lastFireOptions` の期待値と
コメント）のみ（+3 -2）で、domain-e.md §5 の申告と一致することを確認した。

## 3. non-blocking 指摘

### 3-1. human-gate-procedure.md §9-1 の見出し「一点確認」と本文の箇条書き 3 点の粒度差

見出しと「以下の一点だけ見ればよい」という導入文は単一の確認に見えるが、実際には「call/turn-end が
画面に触れることがある」「劣化時も自発発火は止まらない」「手動系/silence は不変」という 3 つの独立した
確認観点が箇条書きになっている（実質は「まとめて 1 セッションで見ればよい」という意味合いと解釈できる）。
内容の欠落はなく、ユーザーが実施する上で支障はないため blocking にはしないが、見出しの表現を「三点確認」
或いは「一連の確認」等に揃えると今後の読み手にとって親切。

## 4. §質問（Orch への申し送り）

特になし。裁定 3 点・追加作業 2 件のいずれについても読み違い・欠落は検出しなかった。domain-e.md §8
の申し送り（診断型名の妥当性・vision フラグ設計・accept emit タイミング・cockpit-server 結線層の
カバレッジ分業）は design/test レーンの領分と判断し、本レーン（spec 適合）からは blocking 相当の
懸念なしとして扱った。

## 5. まとめ

- 裁定①（格上げ）・裁定②（盲目劣化）・裁定③（usage 計器受容）はいずれも実装・テストの実物で確認し、
  読み違いは見つからなかった。
- silence・手動 Fire・手動視覚 Fire の挙動が 1 ビットも変わっていないことは、コード構造上の分離
  （`firePreferred` と `fireVision` が完全に別関数）と、既存テストが末尾追記のみの diff で無傷のまま
  残っていることの両面から確認した。
- docs 追記 2 件（s6-followup.md §12・human-gate-procedure.md §9-1）は裁定の文言を過不足なく反映して
  いる（§3-1 の見出し表現のみ non-blocking）。
- 機械ゲート（518/518）・器/契約/lockfile 不変・変更範囲の妥当性・SDK 消費ゼロの痕跡不在は自分で
  再実行/確認した。
- blocking 相当の欠落・捏造・退行・裁定の読み違いは見つからなかった。
