# S7 Domain C レビュー — spec レーン（設計契約への逐条適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test`・
> `git diff --stat`・`check-*.mjs`（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §1・§3 Domain C・
> §4・§5 / [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md)
> §2-1・§3・§5 / [../../waves/s7/domain-c.md](../../waves/s7/domain-c.md)（Claim）。
> 消費した成果物: [../../waves/s7/domain-a.md](../../waves/s7/domain-a.md) §7-2/§7-3・
> [../../waves/s7/domain-b.md](../../waves/s7/domain-b.md) attach 点・§9。
> 対象コミット状態: S7 Domain A+B+C は未コミット・working tree に存在。

## 総合判定: **PASS**

wave-plan §1（人間ゲート手順の材料）・§3 Domain C・§4 blocking 基準（Domain C 該当分）・
inventory §2-1/§3/§5 の要求はすべて満たす。操縦席 UI 6 要素・docs 2 点（人間ゲート手順書・
followup 台帳）+ README S7 節の必須項目はすべて充足。器不変・依存ゼロ・機械ゲート生数字は自分の実行で
domain-c.md の主張と完全一致。§質問 5 件はいずれも契約違反ではなく設計裁量または正当な escalate/申し送り
（non-blocking）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が実行・タイムアウト 300s・空/interrupted なし・1 回で成功）:

```
1..606
# tests 606
# suites 0
# pass 606
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1264.9552
```

→ **Claim（domain-c.md §5）の 606/606/0 と一致**。ベースライン 583（Domain B 後）→ +23 も、内訳を個別
`grep -c "^test("` で再集計し一致確認:

| ファイル | 総数（自分で grep） | claim |
|---|---|---|
| `cockpit-settings-store.test.mjs` の chat 系 | 4 本（roundtrip/クリア/他キー同居/unwritable） | +4 一致 |
| `scripts/cockpit.test.mjs` の `createChatSourceHooks` 系 | 3 本 | +3 一致 |
| `cockpit-server.test.mjs` 総数 | 73 本（65→+8） | +8 一致 |
| `cockpit-page.test.mjs` の chat/viewer/selfFire 系 | 8 本 | +8 一致 |

**器不変・契約不変・lockfile 不変の検証**（自分で実行）:

```
git diff --stat -- apps/runtime-player packages                → 出力なし
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json → 出力なし
git diff --stat -- *channel-*-contract*                        → 出力なし
```

**3 チェック**（repo ルートで自分で実行）:

```
node scripts/check-dependencies.mjs        → "Dependency guard passed." EXIT=0
node scripts/check-soul-zone-boundary.mjs  → "passed: 1347 source files scanned" EXIT=0
node scripts/check-source-organization.mjs → EXIT=1・唯一の違反 apps/runtime-player/src/main/physiology/index.ts
```

check-source-organization の違反ファイルは `git diff --stat -- apps/runtime-player packages` が出力ゼロ
（＝この Domain で 1 バイトも触れていない）ことで、ベースライン既存違反であることを裏付けている。
claim（domain-c.md §4）と完全一致。

**逆方向 import の検証**（自分でソースを grep）:

```
grep "^import" cockpit-server.mjs | grep -i chat   → 該当なし（コメントのみに "src/chat" の文字列出現）
grep "src/chat" scripts/cockpit.mjs                → import { createLiveChatClient } from "../src/chat/live-chat-client.mjs"（:53）
```

→ cockpit-server.mjs はチャット器官を import しない（factory 全注入）。cockpit.mjs のみが本番 import する
（魂ゾーン内の前方向）。claim と一致。

**git status --porcelain -- apps/soul/agent**: Domain C の 8 ファイル（`cockpit-server.mjs`/`.test.mjs`・
`cockpit-settings-store.mjs`/`.test.mjs`・`scripts/cockpit.mjs`/`.test.mjs`・`cockpit.html`・
`cockpit-page.test.mjs`）が `M`、`src/chat/`（Domain A）が `??`、`transcript-buffer.*`/
`fire-injection.*`/`fire-scheduler.*`（Domain B）が `M` ——domain-c.md §1 の一覧と完全一致。他ドメインの
差分と重なっていないことを裏付ける。

---

## spec 逐条照合（wave-plan §3 Domain C・PASS/FAIL + file:line 根拠）

### 1. 操縦席 UI 6 要素 — **PASS（すべて実装確認）**

| 要素 | 根拠（自分で読んだ file:line） | 判定 |
|---|---|---|
| 配信 URL/ID 入力欄 + settings 永続化 | `cockpit.html:182-189`（`<section class="chat">`・`#chat-source`）。`cockpit-settings-store.mjs:135-141`（`getChatSource`/`setChatSource`）。`scripts/cockpit.mjs:325-336`（`createChatSourceHooks`）。 | PASS |
| Connect chat 開始/停止 | `cockpit.html:185-186`（`#btn-chat-connect`/`#btn-chat-disconnect`）・:766-793（POST ハンドラ）。`cockpit-server.mjs:877-909`（`/api/chat/connect`・`/api/chat/disconnect`）。 | PASS |
| チャット器官の状態表示（connecting/live/retrying/dead） | `cockpit.html:63-67`（CSS 色分け）・:289-305（`applyChat`）・:870-878（SSE `chatStatus` リスナー）。 | PASS |
| viewer 行の表示（`viewer(名前): 本文`） | `cockpit.html:376-398`（`addTranscriptRow`・:386 `viewer(displayName)`）・:115-116（`.row.speaker-viewer` 別色 CSS）。 | PASS |
| コメント発火マーカー（selfFire kind=comment/comment-call） | `cockpit.html:521-533`（`addSelfFireMarkerRow` は kind 非依存で描く）・:864-868（SSE `selfFire` リスナー）。 | PASS |
| 取得死/抽出失敗のゴースト行 | `cockpit.html:879-890`（`chatDiagnostic` リスナー・notLive/ended/extractFailed/network/internalError の 5 種）・:837-839（`chatBufferAbsent` ゴースト行）。 | PASS |

### 2. cockpit-server 結線（Connect/Disconnect/close ライフサイクル）— **PASS**

- `connectChat(source)`（`cockpit-server.mjs:1191`）: `foldChatClient()` で先に畳んでから
  `chatClientFactory({source})` で作り直す（:1192-1194）。`onMessage→ingestChatMessage`/
  `onStatus→broadcastChatStatus`/`onDiagnostic→broadcastChatDiagnostic` を結線（:1196-1202）。
  `onSetChatSource` 永続化は失敗寛容（:1204-1210）。`await client.start()`（:1211）。claim の file:line と
  完全一致。
- `POST /api/chat/connect`（:877-903）: factory 未注入 → 503（:879-883）。空 source → 400（:885-890）。
  生成/start の想定外 throw は畳んで 500（:891-899）。成功は 200 + snapshot（:900-901）。claim と一致。
- `POST /api/chat/disconnect`（:904-910）: `foldChatClient()` 冪等（:905-909）。claim と一致。
- `foldChatClient()`（:1161-1179）: フック購読解除を全撤去（:1162-1169）→ `client.stop()`（:1170-1178・
  best-effort）。claim と一致。
- `close()`（:1258-）: `foldChatClient()` を**最初**に呼ぶ（:1262）→ 以後 bargeInGate/fireScheduler/
  fireOrchestrator の dispose・SSE end・pipeline dispose。claim「close で稼働中の器官も畳む」と一致。
- Domain B の attach 点（`ingestChatMessage:1096`・`broadcastChatStatus:1135`・
  `broadcastChatDiagnostic:1146`）は Domain C から見て**不変**（domain-b.md §1 の file:line と実装内容が
  一致・Domain C はこれらを呼ぶだけで中身を変更していない）。

### 3. 本番結線（scripts/cockpit.mjs）— **PASS**

- `import { createLiveChatClient } from "../src/chat/live-chat-client.mjs"`（:53）。
- `createChatSourceHooks(settings)`（:325 export）: `onSetChatSource`/`chatSourceStatus` を settings へ
  薄く橋渡し（Channel URL/visionTarget と同型）。
- main 配線: `chatSourceHooks = createChatSourceHooks(settings)`（:371）・
  `chatClientFactory: createLiveChatClient`（:542）・`onSetChatSource`/`chatSourceStatus`（:543-544）。
  claim の file:line と完全一致。

### 4. Domain A/B 契約の消費が正しいか（ended/notLive/restart・attach シグネチャ）— **PASS**

- domain-a.md §7-2「ended→dead は終端・再接続しない・別配信は新 source で作り直す」→ Domain C の
  `connectChat` は毎回 `foldChatClient()` してから新規生成（restart 機構を持たない・Connect 再操作で
  作り直す設計）。domain-c.md §7-2 の§質問もこの裁定を追認する形で記述されており、実装と整合。
- domain-a.md §7-3「notLive は retrying で待ち続ける」→ UI 側は `chat-status=retrying`（黄）+
  chatDiagnostic の notLive ゴースト行で待ちが見える（`cockpit.html:66,886-889`）。一致。
- domain-b.md §2-4 の attach 点シグネチャ（`ingestChatMessage({text,displayName})`/
  `broadcastChatStatus(status)`/`broadcastChatDiagnostic(info)`）は Domain C 側の呼び出し
  （`cockpit-server.mjs:1197-1202`）と 1 バイトも変えず一致。

### 5. 成果物の主張の正直性（生数字 606・器不変・3 チェック）— **PASS**

上記「自分で走らせた機械ゲート生数字」節のとおり、生数字・diff・3 チェックのいずれも自分の実行で
domain-c.md の記述と完全一致（捏造・過大申告は検出せず）。

---

## docs 必須項目の充足チェック表（wave-plan §3 Domain C・最重要）

### 人間ゲート手順書（`human-gate-procedure.md`）

| 必須項目 | 該当箇所 | 判定 |
|---|---|---|
| テスト配信の立て方（限定公開でよい） | §1（1-2 行目「限定公開（Unlisted）でよい」） | PASS |
| ★ マイク（耳）を起動した状態で Connect（blocking 級重視） | §2「★★ 最重要: マイク（耳）を Start した状態で Connect する ★★」（chatBufferAbsent の裁定を明記・忘れると「静かに失敗する」と明記） | PASS |
| 配信 URL 設定→Connect→こーでぃーが拾って返す確認 | §3（Connect 手順・状態表示の見方）+ §4（本体①「コメントを拾って返す」） | PASS |
| コメント内呼びかけ（comment-call）確実応答 | §5（本体②「呼びかけの確実応答」） | PASS |
| 相乗り 2 件（S6④沈黙発火の頻度体感 + S6 追撃 E 再ゲート） | §6（相乗り① S6 持ち越し④）+ §7（相乗り② S6 追撃 E 再ゲート） | PASS |
| ToS グレー開示 | §0（「Connect する前に読む」・非公式 innertube・公式 API キー梯子への言及込み） | PASS |

切り分け表（§8）・停止手順（§8 冒頭）も付随して充実。**必須項目 6/6 すべて PASS**。

### s7-followup 台帳（`s7-followup.md`）

| 必須項目 | 該当箇所 | 判定 |
|---|---|---|
| 公式 API キー差し替えの梯子 + quota 単価実測 | §1 | PASS |
| ToS グレー記録 | §2 | PASS |
| 表記揺れ集合の実運用拡張 | §3 | PASS |
| 実疎通の HTTP 詳細欄（cookie/consent） | §4（チェックボックス形式で cookie/CONSENT・地域リダイレクト・videoId 解決・その他の 4 欄） | PASS |
| comment 予算・頻度の将来 Cockpit 可変 | §5 | PASS |
| スパム/荒らしは S8 + 多コメント間引き | §6 | PASS |
| バッファ所有権の巻き上げ escalate | §7（「【要 escalate】」と明記・要否は Orch/Undine 裁定待ちと明記） | PASS |

§8「軽微（記録のみ・非 blocking）」も付随。**必須項目 7/7 すべて PASS**。

### README（`apps/soul/README.md` S7 節）

`README.md:294-328` に S7 節を確認。チャット器官（Domain A）・合流+発火結線（Domain B）・操縦席
（Domain C）・★耳起動状態で Connect・実疎通は人間ゲート、の 5 ブロックが簡潔に要約されている。
domain-c.md §6 の主張と一致。**PASS**。

---

## blocking / non-blocking の分離

### blocking（wave-plan §4・Domain C 該当分）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約 JSON・lockfile 完全不変・新規依存ゼロ | PASS | `git diff --stat` 3 種すべて出力ゼロ（自分で実行）。 |
| 2. 機械テストは実ネットに出ない（fake fetch のみ） | PASS | `makeFakeChatClientFactory`（`cockpit-server.test.mjs:1499-1540`）を自分で読了。実 fetch/実ソケット呼び出しなし・純粋なイベント駆動 fake。 |
| 3. チャット器官は独立（逆方向 import なし） | PASS | `cockpit-server.mjs` に chat 関連 import 文なし（grep で確認）。`scripts/cockpit.mjs:53` のみが実 import（魂ゾーン内前方向）。`check-soul-zone-boundary.mjs` も自分で実行し passed（1347 files）。 |
| 4. スケジューラ拡張は決定論テスト（fake clock+注入 RNG） | N/A（Domain B 領分） | Domain C はスケジューラ本体に触れていない（`handleChatMessage` 呼び出しのみ消費）。Domain B レビューの領分。 |
| 5. 3 チェック無退行・SDK 実消費ゼロ・終了処理 | PASS | 3 チェックは自分で再実行し claim と一致（違反は runtime-player 側のベースライン既存 1 件のみ・本 Domain 無関係）。SDK/LLM 呼び出しは本 Domain のコード内に皆無（プラミング層のみ）。`close()` が `foldChatClient()` を最初に呼びタイマ/プロセスを残さない（自分で読了・`node --test` は自然終了）。 |

### non-blocking

domain-c.md §7 の 5 件の§質問はいずれも契約違反ではなく設計裁量または正当な申し送り:

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | 【要 escalate】バッファ所有権と「耳なしチャット」 | **non-blocking（正当な escalate）**。domain-b.md §5 の裁定（バッファ所有権の巻き上げは S1〜S6 の耳ライフサイクル・器不変を脅かしうる構造変更）を追認し、v0 では実装せず人間ゲート手順書 §2 で運用回避（★マイク起動を必須手順化）している。回避工作で黙って凌がず、s7-followup §7 で明示的に Orch/Undine 裁定待ちとしており、エスカレーションの作法として適切。 |
| 2 | chatClientFactory を全注入にした裁定 | **non-blocking**。wave-plan §3「cockpit.mjs が本番 factory を注入」の記述に忠実。ear-pipeline の `pipelineFactory`（既定=実 import）と異なる設計だが、理由（責務境界・実疎通時の fetch ヘッダ調整の集約）が明記されており、domain-a.md §7-2 の「操縦席側で作り直す」要否にも正しく回答している。 |
| 3 | start() を await する裁定 | **non-blocking**。ear-pipeline の start 同型で決定論テストしやすい設計。notLive/network は内部で即 return するため HTTP ハンドラは無限に待たされない（bounded・稀なケースのみ requestTimeoutMs まで）。人間ゲートでの体感次第の調整余地として正しく開示。 |
| 4 | paid（スーパーチャット）は kind 区別なしで合流 | **non-blocking**。domain-a.md §7-7・domain-b.md §9-5 の裁定（単一タイムライン・裁定 3）をそのまま踏襲した実装であり、Domain C 独自の逸脱ではない。 |
| 5 | 実疎通の未検証項目（人間ゲート初確認） | **non-blocking**。機械テストの限界（合成 fixture のみ）を正直に開示し、followup §4 に記録欄を用意済み。規律（実ネットに機械テストを出さない）を守った結果としての正当な申し送り。 |

---

## §質問（Orch-Sylph への引き継ぎ）

このレビュー自体からの新規の疑問点は生じなかった。domain-c.md §7 の 5 件はいずれも上表のとおり
non-blocking と判定したが、**§7-1（バッファ所有権の巻き上げ escalate）は S7 wave 全体としての
Orch/Undine 裁定が必要な項目**であり、spec レーンの守備範囲（Domain C 単体の契約適合）を超える。
Orch-Sylph は s7-followup.md §7 の記載をもって「v0 では実装せず・要否は別途裁定」の状態を追認し、
人間ゲートへ進めてよいと判断する（この Domain のレビュー結果としては blocking ではない）。

---

## Orch への申し送り

- spec レーンとして S7 Domain C は wave-plan §1・§3 Domain C・§4（Domain C 該当分）、
  inventory §2-1/§3/§5 の要求を逐条で満たす。操縦席 UI 6 要素・cockpit-server の Connect/Disconnect/close
  ライフサイクル・本番結線（scripts/cockpit.mjs）・docs 2 点（人間ゲート手順書・followup 台帳）+ README
  は、いずれも自分でソース/ドキュメントを読み比べ、file:line 単位で claim と実装の一致を確認した
  （Gnome の説明への依存を避けるための最も強い検証）。
- 生数字 606/606/0・ベースライン 583→+23（内訳 4 ファイル別に再集計）・器不変の `git diff --stat`（3 種）・
  3 チェック（`check-dependencies`/`check-soul-zone-boundary`/`check-source-organization`）は、いずれも
  自分の実行で domain-c.md の記述と完全一致（捏造・過大申告は検出せず）。
- cockpit-server.mjs がチャット器官を import しない（factory 全注入・逆方向 import なし）ことは自分で
  grep して確認済み。
- 人間ゲート手順書・s7-followup 台帳は、レビュー観点として指定された必須項目をそれぞれ 6/6・7/7 とも
  100% 充足している（特に★マイク起動の blocking 級重視事項・相乗り 2 件・escalate 記録は明確に記載）。
- 確認待ちは無し。design/test レーンのレビュー結果と合わせて Orch-Sylph の総合判定を推奨。
