# S5 Domain C レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**（コード/契約JSON/lockfile
> は一切変更していない）。
> 日付: 2026-07-13。根拠: 契約文書・対象ファイル・working tree の実物 diff・自分で実行した `node --test`
>（Gnome の説明ではなく）。**実 SDK は呼んでいない**（実射記録の妥当性は s5-vision.md の内的整合性・
> observe-vision.mjs のガードコードから検証。捏造の兆候はコード/記録双方に見られない）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §2・§3 Domain C・§4 /
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-3, §4, §5-2 /
> [../../waves/s5/domain-a.md](../../waves/s5/domain-a.md)（消費: `listWindows` `{windows}|{error}`）/
> [../../waves/s5/domain-b.md](../../waves/s5/domain-b.md)（消費: `fire({vision:true})`・フック契約）/
> [../../waves/s5/domain-c.md](../../waves/s5/domain-c.md)（Claim・前半 C-impl §0〜§8 + 後半 C-verify §9）。
> 対象コミット状態: S5（Domain A+B+C）は未コミット・working tree に存在。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 5 項目はすべて満たす。spec 検証項目 1〜7（新エンドポイント契約・
usage 計器・実験記録/人間ゲート/followup 台帳・画像ディスク非書き込み・ツマミなし裁定・5 ask 上限）は
すべて PASS。domain-c.md §7（前半）+ §9-6（後半）の申し送り事項はいずれも契約違反ではなく、
followup 台帳への正当な持ち越しと判定（non-blocking）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が 1 回実行・タイムアウト 300s・空/interrupted なし）:

```
# tests 411
# suites 0
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1487.6716
```

→ **Claim（domain-c.md §8 前半・§9-3 後半）の 411/411/0 と一致**。Domain B 完了時点ベースライン
392 → +19（内訳: `cockpit-settings-store.test.mjs` +4 / `cockpit-server.test.mjs` +11 /
`cockpit.test.mjs` +4。実際に diff を精読し本数を確認——後述）。後半（C-verify）は新規テスト追加なし
（実射スクリプト + docs のみのフェーズ）という claim も、`observe-vision.mjs` が `*.test.mjs` 命名で
ないため `node --test` の既定パターンに一切マッチしないことをファイル名で確認済み。実行時間
1.5s 程度であり、PowerShell 起動や SDK 呼び出しに要する数百ms〜秒オーダーの遅延が紛れ込んでいない
（実 PowerShell・実 SDK が `node --test` 中に呼ばれていないことの間接的な裏付け）。

**器不変の検証**（working tree・自分で実行）:

```
git diff --stat -- apps/runtime-player packages                         → 出力ゼロ
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json          → 出力ゼロ
git status --porcelain                                                   → 下記参照
```

`git status --porcelain` の変更（M）ファイルは `apps/soul/README.md` / `apps/soul/agent/scripts/cockpit.mjs`
/ `.test.mjs` / `fire-hotkey.ahk` / `src/cockpit/cockpit-server.mjs` / `.test.mjs` /
`cockpit-settings-store.mjs` / `.test.mjs` / `cockpit.html` / `src/mind/fire-orchestrator.mjs` /
`.test.mjs` / `src/mind/llm-session.mjs` / `.test.mjs` の 13 ファイル。このうち `src/mind/*` の 4 本は
**Domain B が実装した分**（累積 diff・Domain C は触れていないことを個別 diff で確認——後述）。
新規（`??`）は `apps/soul/agent/scripts/observe-vision.mjs` / `preflight-eyes.mjs`（Domain A）/
`src/eyes/**`（Domain A）/ `discussion/ai-cohost/experiments/s5-vision.md` /
`discussion/ai-cohost/implementation/reviews/s5/` / `discussion/ai-cohost/implementation/waves/s5/`。
`.tmp/facex-*`（別セッション領分・5 件）には一切触れていない（cwd 変更なし・diff 対象外）。

---

## spec 検証項目（wave-plan §4 blocking 基準に対応・PASS/FAIL + 根拠）

### 1. 器コード・契約・lockfile 完全不変・cockpit 系 8 ファイル限定 — **PASS**

- `git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json` は
  出力ゼロ（上記実測）。
- Domain C が触れたファイルは `cockpit-settings-store.mjs`/`.test.mjs`・`cockpit-server.mjs`/`.test.mjs`・
  `cockpit.mjs`/`.test.mjs`・`cockpit.html`・`fire-hotkey.ahk` の 8 本のみであることを、各ファイルの
  `git diff` を個別に精読して確認した:
  - `cockpit-settings-store.mjs`: `getVisionTarget`/`setVisionTarget` を `writeMerged` へのキー 1 個
    追加のみで実装（既存 `getLastChannelUrl`/`setLastChannelUrl` と同型・diff 19 行）。
  - `cockpit-server.mjs`: `import { listWindows as defaultListWindows } from "../eyes/window-list.mjs"`
    が唯一の新規 import（Domain A の純部品・Domain A/B のコード自体は変更していない）。
    `GET /api/windows`・`POST /api/vision-target`・`POST /api/vision-fire` の 3 エンドポイント追加・
    `onVisionCaptured`/`onUsage` を hooks へ追加・`diagnostic` ペイロードへ `kind` 追加（既存 diagnostic
    購読側は `kind:null` になるだけで契約破壊なし）。
  - `cockpit.mjs`: `createSessionProxy`（既存インライン `sessionProxy` を関数抽出しただけ・ロジック
    無変更）・`createVisionTargetHooks(settings)` 新設。`main()` 配線が `getVisionTarget`/
    `onSetVisionTarget`/`visionTargetStatus` を追加するのみ。
  - `cockpit.html`: Vision target セクション・Fire (vision) ボタン・「見た」マーカー行・usage 表示・
    ゴースト行拡張のみ（後述 §5・§6）。
  - `fire-hotkey.ahk`: `^!g:: FireVision()` 追加のみ（既存 `^!f:: FireSoul()` は 1 行も変更なし・diff
    で確認）。
- `src/mind/fire-orchestrator.mjs`/`llm-session.mjs` の diff（`231`/`330`/`28`/`48` 行）は Domain B が
  実装したもので、Domain C はこれらを import して使うのみ。`grep VISION_INSTRUCTION_TEXT
  fire-orchestrator.mjs` で `const VISION_INSTRUCTION_TEXT = ...`（`export` キーワードなし）を確認——
  これは domain-c.md §9-6 質問1「observe-vision.mjs が文字列をコピーして使った」という申し送りと
  整合する直接証拠（もし Domain C が `fire-orchestrator.mjs` を export 拡張していれば、コピーする
  理由自体が無くなるため、この記述の存在自体が「触っていない」ことの状況証拠になる）。
- `src/eyes/**`・`discussion/ai-cohost/implementation/reviews/s5/`・`.tmp/facex-*` を Domain C が
  一切変更していないことを `git status --porcelain` で確認（該当ファイルへの `M` マークなし）。

### 2. `GET /api/windows` の契約（listWindows `{windows}|{error}` の写経） — **PASS**

- `cockpit-server.mjs`: `listWindowsImpl`（既定 = Domain A `listWindows`）の戻り値をそのまま
  `.windows`/`.error` に写すだけ。常に HTTP 200（列挙失敗も致命的サーバエラー扱いにしない）。
  実装は domain-a.md §3 の契約型 `{windows:[...]}\|{error:{kind,message}}` をそのまま受ける形。
- テスト 3 本で実測固定: 成功（windows 配列 2 件）・失敗（`{error}` → `windows:[]` + `error` メッセージ）・
  未注入時（既定実装への代入で throw しないことの型確認のみ・実 PowerShell は起動しない）。
  `listWindowsImpl` は全テストで fake 注入されており、node --test 実行中に Domain A の実
  `listWindows`（実 PowerShell 起動）が一度も呼ばれないことをテストコードで確認した。

### 3. `POST /api/vision-target` の契約（title 永続化・visionTarget キー） — **PASS**

- `body.title` を trim → 空なら `null`（クリア）→ `onSetVisionTarget(title)` を呼ぶ（`POST /api/channel`
  の写経）。`cockpit-server` は永続化実体を知らない（責務境界: `scripts/cockpit.mjs` の
  `createVisionTargetHooks(settings)` が `settings.setVisionTarget` へ橋渡し）。
- `cockpit-settings-store.mjs` の `writeMerged` に `visionTarget` キー 1 個を追加するだけの実装で、
  `lastDevice`/`lastChannelUrl` と同一ファイル（`cockpit-settings.local.json`・.gitignore 済み）に
  同居する。テストで 3 者同居（read-modify-write で他を消さない）・set→get roundtrip・壊れた
  JSON→null・書き込み失敗を握る、の 4 本を実測固定（`cockpit-settings-store.test.mjs` diff で確認）。
- `POST /api/vision-target` 未注入時 503・フック橋渡し+trim+クリア+state 反映をテストで実測固定
  （`cockpit-server.test.mjs` diff で確認・trim 前後の値・空文字クリアの両方をアサート）。

### 4. `POST /api/vision-fire` の契約（`fire({vision:true})`・202/200 規約） — **PASS**

- `fireOrchestrator.fire({ vision: true })` を呼ぶだけ（`POST /api/fire` の写経・busy 保護/診断発行は
  orchestrator 側の責務）。`fired` 真偽で 202/200 を出し分ける規約は既存 `/api/fire` と共通。
- テストで実測固定: 未注入 503・受理時 `fake.record.lastFireOptions` が `{vision:true}` であることを
  明示 assert（通常 `/api/fire` と取り違えていないことの直接証拠）・対象未設定時は 200 で
  `{fired:false, reason:'vision-no-target'}`。

### 5. SSE 3 種（visionCaptured/usage/diagnostic kind） — **PASS**

- `onVisionCaptured(info) → broadcast("visionCaptured", info)`・`onUsage(info) → broadcast("usage", info)`
  ともに fireOrchestratorFactory の hooks へ追加され、SSE テストで `visionCaptured`（title/width/height/
  jpegBase64/elapsedMs がフレームにそのまま届く）・`usage`（`usage.input_tokens`/`vision` フラグ）を
  実測固定。
- `diagnostic` イベントは新規種別を増やさず既存イベントに `kind` フィールドを 1 個追加する設計
  （domain-b.md `fireVisionError` の `{type,kind,message}` をそのまま透過）。テストで
  `diag.data.kind === "minimized"` を実測固定。既存診断型は `kind ?? null` になるだけで後方互換。

### 6. 画像のディスク非書き込み（wave-plan §4-2・blocking） — **PASS**

- `cockpit-server.mjs` は `broadcast("visionCaptured", info)` で `res.write` するだけ。`fs.write*` 系
  API は当該ファイルに一切登場しない（新規ファイル I/O コードなし・grep で確認済みの Domain B
  レビュー結果と合わせ、Domain C 追加分にも書き込み経路なし）。
- `cockpit.html` は `jpegBase64` を `<img src="data:image/jpeg;base64,...">` に渡すだけ。
  `localStorage`/`sessionStorage`/ダウンロード等のディスク相当永続化コードは一切書かれていない（diff
  全量精読・§4 domain-c.md の記述と一致）。
- `observe-vision.mjs`（新規・後半 C-verify）: `capture.jpegBase64` を変数に保持するのみで、ログ出力は
  `base64Len`（数値）と `approxBytes`（数値）のみ——base64 文字列そのものやその先頭文字列すらログに
  出していない（domain-a.md の preflight-eyes.mjs は先頭 24 文字を出す設計だったのに対し、
  observe-vision.mjs はさらに厳格・ソースコードで確認済み）。`fs.writeFileSync`/`fs.unlinkSync` は
  マーカー**テキスト**ファイル（`vision-observe-*.txt`）のみに使われ、画像ファイルへの書き込みは
  一切ない。実行後の後始末（`Get-Process notepad` で残留なし確認・§9-4）も claim 通りコードの
  finally ブロックで taskkill が実装されていることを確認した。

### 7. ツマミなし裁定（wave-plan §2 裁定6） — **PASS**

- `cockpit.html` の Vision target セクションは `<select>` + Refresh windows + Set target ボタン +
  現況表示のみ。縮小長辺・JPEG 品質の調整用 `<input type="number">` 等は存在しない（diff 全量精読で
  確認）。usage 表示（`#usage-note`）も「直近 1 回分の input/output」のみの最小表示で、スパークライン・
  履歴保持・調整 UI は無い。

### 8. 実 SDK 5 ask 上限の遵守（wave-plan §4-4・blocking） — **PASS**

- `observe-vision.mjs` に `MAX_ASKS = 5` のハードガードが存在し、`measuringSession.ask()` 内で
  `askCount >= MAX_ASKS` なら同期的に `throw`（6 回目の SDK 呼び出しを構造的に禁止・リトライも
  1 ask としてカウントする設計をコードで確認）。
- `assertSubscriptionAuthEnv(process.env)` を `main()` の先頭で呼び、ガード違反時は起動そのものを
  拒否する（`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_USE_*` 検出で throw）。
- `s5-vision.md` の記録（ask #1〜#5 の生データ表・`asks: 5` の summary）はこのガード構造と整合する
  （もしリトライが発生していれば `askCount` が先に上限へ達し `MAX_ASKS exceeded` の throw で異常
  終了していたはずだが、記録は5 ask すべてが完了した状態で終わっている——コードロジックと記録内容の
  整合性を確認）。実行そのものは私（レビュー）は行っていない（**実 SDK は呼ばない鉄の規律**）。

---

## 実験記録/人間ゲート手順書/followup 台帳の充足確認（wave-plan §4-4）

### `experiments/s5-vision.md` — **充足**

- **(a) 画面言及**: ask #1 の返事が特徴的マーカー本文（タコ/自転車/紫/虹/オレンジ/星の6語）のうち
  4 語に言及したことを記録（MARKER_KEYWORDS と observe-vision.mjs のロジックが一致）。
- **(b) レイテンシ内訳**: キャプチャ 630ms（domain-a.md 実測レンジ 598〜660ms 内）・base64 長 29116 文字・
  vision ask #1（cold）TTFT 4824.2ms/ask 往復 6798.1ms・ask #2〜5（warm）TTFT 1226.2〜3068.7ms/ask 往復
  3067.3〜5641.2ms、の**具体的な実数字**が記載されている（丸められたプレースホルダではない）。
- **(c) cache 観測**: `input_tokens` が5 ask とも一定値 2・`cache_read_input_tokens` が
  0→1184→1333→1492→1692 と単調増加という**実測値**が記録され、棚卸し §2-3 未確定(a)への回答として
  明記されている。数字の内的整合性（cache_read が累積的に増加するのは prompt caching の挙動として
  自然・input_tokens が一定なのは新規差分のみカウントする設計と整合）は認められ、捏造を疑わせる
  不自然さ（丸すぎる数字・パターンの単調さが機械的すぎる等）は無い。
- **§6 未実測の正直な開示**: 実ゲーム窓/最小化被覆/DPI/高密度base64サイズ/cache金額換算をすべて
  「未実測」と明記し followup へ持ち越している。誇張・過大主張は無い。

### `human-gate-procedure.md` — **充足**

- S4 手順書 §1〜4（全器官起動）を継承しつつ §5「ゲームを起動する」を新設。§6 対象ウインドウ選択→
  §7 視覚発火→§8 合格判定（サムネ中身の目視 + 返事の画面言及）+ 通常 Fire 無退行の一言確認、が
  wave-plan §1 の人間ゲート文言（「画面に映っているものに言及した返事が返る」「実ゲーム窓で中身が
  実際に写っていること」「通常 Fire が従来通りなことも一言確認」）をすべて満たす形で用意されている。
  §9 に切り分け表（白紙/ゴースト各 kind ごと）もあり、白紙判定=裁定1の織り込みも§8-1に明記。

### `s5-followup.md` — **充足**

- §1 実ゲーム窓での実写り（白紙成功リスク・最小化被覆・JPEG品質未実測・DPI未検証）・§2 累積の重さ
  （cache 観測結果を踏まえ「急ぎの梯子ではない」と判断根拠込みで記録）・§3 蓄積の梯子・§4 ポーリング
  の梯子・§5〜§8 Domain A/B/C 前半の§質問の CLOSED/persisting 整理、のすべてが埋まっている。
  wave-plan §3 Domain C が要求する「蓄積の梯子・ポーリングの梯子・白紙検知・PrintWindow最小化/被覆
  挙動・DPI>100%未検証・累積が重い場合の梯子」の6項目すべてに対応する節がある。

---

## §質問（domain-c.md §7 前半 + §9-6 後半）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 前半-1 | usage 表示の粒度（直近1回のみ） | **non-blocking**。wave-plan §2 裁定2は「可視化」を求めるのみで粒度を規定しない。followup §2 で cache_read_input_tokens の単調増加が ask ごとの値だけで検知可能と実測で裏付けられており、v0 の最小実装で目的を達成していると判断できる。 |
| 前半-2 | `GET /api/windows` の実地確認未了 | **non-blocking**。テストは listWindowsImpl を必ず fake 注入（意図的な設計・実 PowerShell を node --test で起動しない方針は wave-plan の「テストはタイムアウト付き」の精神と整合）。実地確認は human-gate-procedure.md §6 に委譲されており、followup §7 にも明記済み。 |
| 前半-3 | サムネのディスク非書き込みの直接証跡が構造的担保のみ | **non-blocking**。コード上に書き込み経路が存在しないことは本レビューでも確認済み（§6）。human-gate-procedure.md に「任意」の DevTools 確認手順が追加されており、必須要件にしていない判断は wave-plan §4-2 の文言（「キャプチャ画像はディスク非書き込み」＝主にキャプチャ経路自体を指す）と矛盾しない。 |
| 前半-4 | `fireVisionError` を既存 diagnostic イベントへ相乗りさせた設計 | **non-blocking**。新規イベント種別を増やさない選択で後方互換を壊さない設計判断。契約はイベント名を固定していない。 |
| 前半-5 | `visionTargetStatus` を非 redact にした非対称性 | **non-blocking**。ウインドウタイトルは機密情報を含まない前提の合理的判断。将来のリスク（タイトルにユーザー名混入等）は followup §7 に明記済みで開示は十分。 |
| 前半-6 | `POST /api/vision-target` をタイトル文字列限定にした点 | **non-blocking**。domain-b.md の `getVisionTarget` 契約（タイトル文字列を返す関数）と整合。同名ウインドウ識別性の限界は domain-a.md の列挙制約（プロセスごと主窓1個）に由来する構造的制約であり、followup §7 に拡張案（pid 併用）まで示されている。 |
| 後半-1 | `VISION_INSTRUCTION_TEXT` をコピーして使った判断 | **non-blocking**。「Domain A/B/C-impl のコードは改修せず import して使うだけ」という鉄の規律を優先した判断は妥当。文字列ドリフトのリスクは自己申告済みで、export 昇格の選択肢も示されている。 |
| 後半-2 | `input_tokens` 一定・`cache_read_input_tokens` 単調増加という実測が S1 記録と乖離 | **non-blocking**。原因特定はスコープ外と正直に記録し、s6 以降への参照事項として明記。実測データ自体の信頼性を損なうものではない（cache フィールドの有無は SDK/API 側の挙動変化・観測範囲の違いいずれの説明でも整合する）。 |
| 後半-3 | 人間ゲート未着手 | **non-blocking（当然の残件）**。wave-plan §1 の人間ゲートはユーザー実行が前提であり、Domain C の範囲外と明記されている。 |

---

## blocking / non-blocking の分離

### blocking（wave-plan §4）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約JSON・lockfile完全不変・新規依存ゼロ | PASS | `git diff --stat` 群すべて出力ゼロ。Domain C の新規 import は `listWindows`（Domain A 純部品）1件のみ。 |
| 2. 3チェック無退行・キャプチャ画像ディスク非書き込み | PASS | node --test 411/411（既存 392 本含む）。§6 でディスク非書き込みを個別確認。 |
| 3. eyes器官の失敗分岐固定・失敗時に正直に中止 | PASS（Domain A/B の責務・Domain C は消費するのみ）| Domain C 独自の実装はこの基準に直接関与しないが、`fireVisionError` のゴースト行表示・`GET /api/windows` の失敗時 `windows:[]` 応答で「正直に見せる」設計を維持している。 |
| 4. SDK実消費上限5ask・環境変数ガード遵守・**usage計器が実測で数字を出す** | PASS | §8 でガード構造を確認。usage 実数字は experiments/s5-vision.md に記載済み（§「実験記録充足確認」）。 |
| 5. 終了処理・タイムアウト | PASS | `observe-vision.mjs` の finally で session.dispose・notepad taskkill を実施（コード確認済み）。 |

### non-blocking

- domain-c.md §7（前半6件）+ §9-6（後半3件）の申し送り——上表の通りすべて契約適合・妥当な設計判断・
  followup 台帳への正当な持ち越しと判定。
- 本レビューでの追加指摘は無し。

---

## Orch への申し送り（質問）

- 特になし。blocking 事項は検出されなかった。強いて挙げるなら、`observe-vision.mjs` が
  `VISION_INSTRUCTION_TEXT` を非 export 定数からコピーして保持している点（後半§質問1）は、将来
  `fire-orchestrator.mjs` 側の文言が変更された際にドリフトする構造的リスクとして残る。急ぎ対応する
  必要はないが、次に視覚発火のプロンプト文言を触る機会があれば、Orch 側で「observe-vision.mjs も
  同時に更新する」チェック項目として意識しておくとよい（followup 台帳には明記されていないため、
  この点だけ本レビューで新たに指摘しておく）。

## 成果物パス

`discussion/ai-cohost/implementation/reviews/s5/domain-c-review-spec.md`（本ファイル）。
