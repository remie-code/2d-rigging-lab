# 操縦席UI改定 Domain B レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。**読み取り専任**。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test`／
> `git diff`／`git status`／`sha256sum`／3チェック／ソース通読（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §3 Domain B・§4 /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §2-1・§4 /
> [../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §2・§7 視覚仕様 /
> [../../waves/cockpit-redesign/domain-b.md](../../waves/cockpit-redesign/domain-b.md)（Claim）。
> 対象コミット状態: Domain B は未コミット・working tree に存在（tracked 変更は Domain A の
> `.gitignore`+`cockpit-server.mjs` の 2 ファイルのまま・`ui/` 5 ファイルと `view-logic/health.{mjs,test.mjs}`・
> `cockpit-ui.test.mjs` は未追跡新設、`cockpit-static-assets.test.mjs` は未追跡のまま +1 本/対象変更 1 本）。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜5（Domain B に該当する範囲）はすべて満たす。spec 検証項目 1〜7（逐条照合）は
すべて PASS。**Claim（domain-b.md）の全数字が自分の再実行と一致**（675/675・74/74・30/30・23/23・10/10・
health 5 本・3 チェック 1371 files・器側既存赤 1 件・packages 別セッション注記）。13 SSE イベントの移植対応・
保存オラクル観測層の全項目・意図的非表示リストの型強制・L0 裁定 2 件（thinking 行・fire-note 暫定移植）の
記録実在、いずれも自分でソースを file:line まで読んで確認した。non-blocking は記載精度 2 件のみ
（`--viewer-text` の出自表記・「view-logic 経由の唯一の例外は fire-note」表記の厳密性）。

---

## 自分で走らせた生数字（すべて Review-Sylph が実行・タイムアウト付き・空/interrupted なし・各 1 回で成功）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 675
# pass  675
# fail  0
```

→ **Claim（domain-b.md §7）の 675/675/0・Orch 確定値と一致**。算数 646 + 29（cockpit-ui 23 + health 5 +
static-assets +1）= 675 も一致（実装前 646 そのものは working tree を巻き戻せない読み取り専任の制約上、
自分では再実行していない——Orch 確定値と新規実測からの算数照合）。

個別実行（すべて自分で実行）:

```
node --test src/cockpit/cockpit-server.test.mjs        → # tests 74 / pass 74 / fail 0   （無退行の背骨＝ワイヤ契約 16+13+6）
node --test src/cockpit/cockpit-page.test.mjs          → # tests 30 / pass 30 / fail 0   （無改変で全緑 = cockpit.html 不改変の証明）
node --test src/cockpit/cockpit-ui.test.mjs            → # tests 23 / pass 23 / fail 0
node --test src/cockpit/cockpit-static-assets.test.mjs → # tests 10 / pass 10 / fail 0
node --test src/cockpit/view-logic/health.test.mjs     → # tests  5 / pass  5 / fail 0
```

ファイル別 `test(` 実数（自分でカウント）: cockpit-ui **23**・static-assets **10**・health **5** →
**Claim §1/§7 の内訳と完全一致**。Domain A の view-logic 6 テストも 4/4/5/5/7/3 = **28** のまま
（Domain A レビュー記録と一致＝無改変の傍証）。

**器不変・契約不変・lockfile 不変・不可侵ファイル無改変**（自分で実行）:

```
git diff --stat（全 tracked 差分）:
  apps/soul/agent/.gitignore                     |  8 +++   ← Domain A のまま
  apps/soul/agent/src/cockpit/cockpit-server.mjs | 80 ++++  ← Domain A の 80 insertions のまま不変
  packages/authoring-core の 4 ファイル                     ← 別セッション（facex/wave109 系）・下記注記
git diff --stat -- apps/runtime-player                              → 出力ゼロ（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json      → 出力ゼロ（lockfile・依存不変）
git diff --stat -- cockpit.html / cockpit-page.test.mjs / scripts/cockpit.mjs → 出力ゼロ（不可侵 3 ファイル無改変）
git status --porcelain -- apps/soul/agent → M .gitignore / M cockpit-server.mjs /
  ?? cockpit-static-assets.test.mjs / ?? cockpit-ui.test.mjs / ?? ui/ / ?? vendor/ / ?? view-logic/
  （Claim §6 の記載と一致）
```

- **packages 注記の正直性を確認**: `git diff --stat -- packages` に `packages/authoring-core` の 4 ファイル
  （runtime-export-assembly / texture-atlas-packing 系・+136/−39）が出ることを自分で確認。Orch 確定情報の
  とおり**セッション開始時点から存在する別セッションの作業で Domain B 無関係**（Domain B の全新設ファイルは
  `apps/soul/agent/src/cockpit/` 配下のみ・porcelain で確認）。Claim §6 の注記は正直。
  器不変の判定は `apps/runtime-player` の出力ゼロで別途成立している。
- **vendor 凍結無改変**: sha256 = `72284e8e…46fc1fd7`・13,194B を自分で再計算——Domain A 確定値と一致
  （Domain B が 1 バイトも触れていない）。
- **Domain A view-logic 6 モジュールの無改変**: 未追跡ゆえ git diff では照合できないため、
  (a) テスト本数 4/4/5/5/7/3=28 の不変、(b) 全 28 本緑、(c) Domain A spec レビューが記録した特徴点の抜き打ち
  一致（ghost.mjs の bargeIn 先分岐前提ヘッダ・意図的非表示 3 型・status.mjs の idle 末尾スペース踏襲コメント）
  で照合した。バイト同一性の完全証明は Domain A 時点のハッシュ記録が無く不可能（検証限界として明記）。

**構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルート・自分で再実行）:

```
check-dependencies.mjs        → Dependency guard passed. (EXIT=0)
check-soul-zone-boundary.mjs  → 1371 source files scanned; no 器→魂 / 魂→器 imports. (EXIT=0)
check-source-organization.mjs → 唯一の違反: apps/runtime-player/src/main/physiology/index.ts（器側既存赤）(EXIT=1)
```

→ **Claim §6・Orch 確定ベースラインと完全一致**（1371 = Domain A 時点 1361 + 本 Domain 新設 8 + 別セッション 2 の算数も整合）。

---

## spec 検証項目（逐条照合・PASS/FAIL + 根拠 file:line）

### 1. 13 SSE イベントの移植漏れゼロ — **PASS**

`SSE_EVENT_NAMES`（app.mjs:38-52）と現 cockpit.html subscribe（:814-897）の `addEventListener` 13 本を
1:1 で自分で突き合わせた: state(:816)・vad(:817)・transcript(:822)・expression(:824)・discard(:825)・
diagnostic(:830)・soul(:857)・fire(:860)・visionCaptured(:866)・usage(:868)・selfFire(:874)・
chatStatus(:880)・chatDiagnostic(:888) = **13 本・過不足なし**。fixture（cockpit-ui.test.mjs:78-84）が
名前と本数を deepEqual で固定。購読ループ（app.mjs:150-157）はこのリストだけから addEventListener する
＝リスト欠落はテストで落ちる機械的固定点、の Claim 構造も実装どおり。

各イベントの機能同値（旧ハンドラとの突き合わせ・重点指定分）:

| イベント | 検査結果 |
|---|---|
| `diagnostic` の bargeIn 先分流 | PASS。rows.mjs feedAfterSseEvent:229 `if (d && d.type === "bargeIn") return feedWithBargeInMarker(…)` が `diagnosticGhostLabel` より**先**（原実装 :842 の else-if 順と同値・ghost.mjs:20-21 の契約遵守）。fixture :209-216 固定。 |
| `fire` の accepted 分岐 | PASS。タイムライン側: accepted===true のみマーカー行（rows.mjs:232・原 :862）。ノート側: 受理→`setFireNote("")`・非受理→`"not fired: " + (reason || "unknown")`（app.mjs:126-128・原 :862-863 と文字列同値）。fixture :233-239 固定。 |
| `selfFire` の fired 分岐 | PASS。fired truthy→マーカー行 / falsy→`selfFireGhostLabel` のゴースト行（rows.mjs:236-238・原 :876-877 と同値）。fixture :241-246 固定。 |
| `chatDiagnostic` の 5 種のみ表示 | PASS。`chatDiagnosticGhostLabel`（Domain A ghost.mjs 白名簿 notLive/ended/extractFailed/network/internalError・原 :893-894 と一致は Domain A レビュー確認済み）経由で null=行を作らない。観測補助 4 種（connected/stopped/ignoredRenderers/listenerError）の非表示 fixture :248-257 固定。 |
| `state` | PASS。feed 無変化（fixture :259-265）+ applyStateRef（app.mjs:103-112）が ears/mergeHealth/discarded/uptime 再同期+即時反映/chatDisplayState/settingsFromSnapshot——原 applyState :265-284 の観測系効果と同値（applyChannel/VisionTarget/SelfFire/AudioDevice の**表示**は Domain C 領分として生値保持・Claim §2 表どおり）。 |
| `vad` | PASS。speechStart→出現・speechEnd/speechCancel→消滅・未知 type 無変化（rows.mjs:216-221・原 :817-821）。fixture :201-207。 |
| `transcript` | PASS。speaking 除去→appendedAtMs 優先時刻（rows.mjs:74・原 :392）→speakerLabel/speakerRowClass/latencyLabel（view-logic・Domain A 同値確認済み）。fixture :92-113。 |
| `expression`/`visionCaptured` | PASS。expressionRowText / visionMarkerText + data URI サムネ（jpegBase64 欠落は img 無し・rows.mjs:133・原 :498）。fixture :148-178。 |
| `discard` | PASS。カウンタ（app.mjs:120-122）+ ゴースト行 "(discarded)"（原 :825-829）。 |
| `soul`/`usage`/`chatStatus` | PASS。feed 無変化（fixture :259-265）+ setSoul 生値保持（描画は Domain C・§8-5）/ usageNoteText / `(d && d.status) || "connecting"`（原 :884 と同値・§8-9）。 |

### 2. 保存オラクル観測層（inventory §2-1）の全項目存在 — **PASS**

domain-b.md §4 の対応表を実物と全行突き合わせた:

| 項目 | 確認結果 |
|---|---|
| 耳ランプ+状態 | PASS。header.mjs:37,45-48 + earsStatusView（health.mjs:28-35・原 :267-270 の三項と同値・fixture 4 ケース）。 |
| whisper/ffmpeg 死活 | PASS。HealthStat + healthStatusView（down は reason em-dash 併記+title・falsy→null=更新しない・原 :360-366）+ mergeHealth（欠落=前値保持・原 :271-274 の state 遷移化）。health.test 5 本で固定。 |
| soul 状態 | PASS（保持）。app.mjs:95 で生値保持・`.control-bar-slot` の `data-soul` に露出（:210）。**表示と Fire disable は wave-plan §3 Domain C の明文どおり Domain C 領分**（applySoulState :434-441 の移植先）——Domain B 単独では画面に soul 表示が無い過渡状態であり、Claim §4/§8-5 が正直に開示。Domain C レビューへ引き継ぎ（後述）。 |
| usage / discarded / uptime | PASS。usageNoteText → `.feed-meta`（feed.mjs:128-132）・discarded・uptime（baseMs/anchorMs+nowTick 1s interval+state 再同期即時反映=app.mjs:108-109,181-185・原 :245-262,:276-278 と同値・computeUptimeMs/formatHms は Domain A fixture）。置き場はフッタ→フィードパネル下端（§8-3 裁定・§7 に明示位置なし・人間ゲートで確認可能）。 |
| Timeline 自動スクロール | PASS。末尾追従既定（feed.mjs:98-101・原 :383 と同値）+ ユーザー上スクロールで停止+「最新へ ↓」——これは**モック §2 の `[最新へ↓]` に根拠がある承認済み改定仕様**（無条件追従からの意図的変更・Claim §4 が「モック §2 の改定仕様」と明記）。判定は純関数 isStuckToBottom（閾値 40px・fixture :278-289 が境界値固定）。 |
| 行種 1〜9 | PASS。転写（viewer(名前)・live 行のみ latency）/speaking（VAD 連動・二重 show 無視・transcript/ghost が除去・**マーカー行は除去しない**まで保存=fixture :115-135）/ゴースト/発火/演出/視覚（サムネ data URI 非保存）/barge-in/自発（fired:false はゴースト）/chat 取得死——rows.mjs の各 feedWith* が原実装 :369-543 と機能同値・全行種 fixture 実在を確認。 |
| 履歴復元 | PASS。app.mjs init effect（:142-178）: `/api/state` → `feedFromHistory`（**全置換・履歴行 latencyMs 無し→latText 自然に null**・fixture :180-197）→ applyState → **その後に** subscribe（原 init :899-909 と同順・購読先行の競合を構造回避）。fetch 失敗でもページは開き購読は行う（:167-171・原 :904 踏襲）。 |
| 意図的非表示リストの型強制 | PASS。`feedWithGhost(feed, label, nowMs)` は **label == null で同一 feed を返す**（rows.mjs:88-92）＝view-logic ghost.mjs の null がそのまま「行を作らない」になる型強制。rows.mjs の全ゴースト呼び出しは ghost.mjs 導出値のみを渡す（discardGhostLabel/diagnosticGhostLabel/selfFireGhostLabel/chatDiagnosticGhostLabel・自前文字列ゼロ）。fixture :137-146 + 非表示 4 型 :218-231。 |

### 3. 視覚仕様 §7 への適合 — **PASS**

COCKPIT_CSS（styles.mjs）の配色トークンを §7 承認値と自分で突き合わせた:

| §7 承認値 | 実装 | 判定 |
|---|---|---|
| teal #56d4b0 | `--teal: #56d4b0`（:38）+ ヘッダ h1 が teal | PASS |
| you #7fb3ff | `--speaker-you: #7fb3ff`（:40） | PASS |
| viewer #c99be8 | `--speaker-viewer: #c99be8`（:42） | PASS |
| barge-in #e0928f | `--marker-barge: #e0928f`（:46） | PASS |
| ゴースト=グレー斜体 | `--ghost: #7d8695` + `.row.ghost .text { font-style: italic }`（:185） | PASS |
| 角丸 14px | `--radius: 14px` + header/feed パネルに適用 | PASS |
| 自発=淡 teal / 演出=緑 | `--marker-self: #9fe3cd` / `--marker-expr: #86d98b` | PASS（§7 正文は色名のみで 16 進なし・値は色名と整合。16 進の出自はモック＝会話内承認でリポジトリに実体なし＝独立検証不可、検証限界として記録） |
| 時刻 mono 小・演出サブ行（インデント+↳）・サムネ枠・ヘッダ構成（名前+ランプ+健康+⚙） | `.row .time` 11px ui-monospace（:166-171）・`.row.expression` padding+`.sub-arrow`（:189-191）・`.vision-thumb` 54x96（:194-202）・header.mjs:42-56 | PASS |

主要トークンと ghost italic は fixture（cockpit-ui.test.mjs:376-384）で固定。**§7 指定なし項目の現行継承の
正直性**: `--marker-fire`/`--speaking` #f0c14b（原 :19/:123——:123 は `var(--speaking)` 参照で値同一＝正確）・
`--marker-vision` #8fb7ff（原 :130）・`--up`/`--down`（原 :17-18）を自分で原 CSS と照合し一致。
唯一の表記ゆれは `--viewer-text`（non-blocking 1・後述）。描画の実確認はしていない（Claim §5 も同旨を開示・
人間ゲート=Domain D 後の領分）。

### 4. 不可侵ファイルの無改変 — **PASS**

上記「生数字」節のとおり自分の git diff/status で確認: cockpit.html・cockpit-page.test.mjs（無改変 30/30 緑が
二重証明）・scripts/cockpit.mjs＝差分ゼロ。cockpit-server.mjs＝Domain A の 80 insertions のまま（挿入行数
一致+背骨 74/74 全緑）。.gitignore＝Domain A の 8 行のまま。vendor＝sha256/サイズ再計算一致（凍結）。
Domain A view-logic 6 モジュール＝テスト本数・特徴点の抜き打ち一致（完全なバイト不変は検証限界・上記）。

### 5. blocking 基準（wave-plan §4・Domain B 該当分） — **PASS**

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器・契約 JSON・lockfile・package.json 完全不変・新規 npm 依存ゼロ・ビルド段ゼロ | PASS | git diff（runtime-player/lockfile/package.json 出力ゼロ・自分で実行）。ui/*.mjs の import は vendor/view-logic/ui 内に閉じる（構造テスト :58-74 + 自分の通読）。配信はディスク実バイト（static-assets テストが equals で固定）＝ソース=実行物。 |
| 2. server test 全緑・既存全テスト緑 | PASS | 74/74（自分で実行）＝ワイヤ契約 16+13+6 無退行の一次証明。既存 646 本込み 675/675。page test は書き換えすらせず無改変 30/30。 |
| 3. view-logic は preact 非依存の純関数 + fixture 必須 | PASS | health.mjs 含む 7 モジュール全てで import 文ゼロを自分で grep（空出力）。health.test 5 本実在・全読。rows.mjs（ui 層）も preact 非依存の純関数層で fixture 13 本——制約 (b) に沿う。 |
| 4. 保存チェックリスト全項目・意図的非表示リスト遵守 | PASS（Domain B 該当分） | 検証項目 2 のとおり。soul 表示・設定 6 群・運転 3+予約 2 は Domain C、統合は Domain D の blocking として引き継ぎ。 |
| 5. devDep ゼロ・3 チェック無退行・終了処理 | PASS | package.json 不変（linkedom 無し・§8-1 で梯子を使わない判断を明記）。3 チェック自分で再実行し一致。SSE 購読 effect は cleanup で es.close()・uptime interval も clearInterval（app.mjs:173-176,183）——原実装に無かった終了処理が加わる方向の差分で無害。SDK 実消費ゼロ・実ネット不出（cockpit-ui.test はネットワーク非到達・static-assets は loopback listen(0) のみ、を自分でソース確認）。 |

### 6. 成果物の主張の正直性 — **PASS（不一致ゼロ）**

- 675/675・74/74・30/30・23/23・10/10・5 本・+29 の内訳・3 チェック（passed/passed 1371/器側既存赤 1 件）・
  porcelain 5 行・packages 別セッション注記——**すべて自分の再実行・再カウントと一致**。
- 都合の悪い事実の能動開示が複数ある（§8-1 App/Feed の htm テンプレート Node 未実行の正直な限界・
  §8-5 モックとの差分・§6 packages 注記・§5 描画実確認なし）——正直性は高い。

### 7. L0 裁定の記録確認 — **PASS**

- (a) **「soul thinking のフィード行を作らない」**: domain-b.md **§8-5 に明記**——モック §2 の
  「○ こーでぃー thinking…」風の行との**既知の差分**であること・保存オラクルの行種 9 つに thinking 行は
  無く新規行種の発明は振る舞い保存 wave の職域外という裁定理由・soul state は運転バー（Domain C）へ渡す
  設計・フィード行化は followup、まで記録されている。実装も一致(app.mjs:95 保持のみ・rows.mjs に thinking
  行種なし)。Domain D 手順書への申し送り管理は Orch 側で行う前提を確認。
- (b) **fire-note 暫定移植の Domain C 申し送り**: domain-b.md **§8-2 に明記**（:863 対応の暫定移植・
  Fire ボタン応答系 :555-589 を移植する Domain C が fire-note 文言体系ごと view-logic へ抽出する凝集判断・
  domain-a.md §7-2 と同型の線引き）。実装にも対応コメント実在（app.mjs:126-128）。

---

## §質問（domain-b.md §8）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | App/Feed（hooks 使用）の htm テンプレートは Node 未実行 | **non-blocking（正直な限界の開示）**。inventory §3 の L0 決定（純関数化+devDep ゼロ・描画は人間ゲート・linkedom は梯子）どおりの検証範囲。検証済み層（import スモーク/構造/rows・view-logic 全 fixture/hooks 非使用の vnode 走査）と未検証層（実描画・EventSource 実配線・実スクロール）の線引きが明確。テスト注入口も実在（app.mjs:73,146-148）。人間ゲート手順書（Domain D）への引き継ぎ必須事項。 |
| 2 | fire-note 暫定移植 → Domain C で view-logic 抽出 | **non-blocking（L0 裁定記録あり・検証項目 7）**。文字列は原 :863 と同値・「view-logic 経由のみ」の唯一の明示例外として管理されている。Domain C レビューの確認事項へ。 |
| 3 | usage/discarded/uptime は `.feed-meta` に裁定 | **non-blocking**。§7 に明示位置なし・三層 IA の観測層計器という整理は cockpit-redesign.md §1 の表と整合。CSS のみで移設可能な構造（行レコード/状態は不変）も実装で確認。人間ゲートの確認対象。 |
| 4 | ヘッダ名「こーでぃー」 | **non-blocking**。モック §2/§7 承認意匠を正とする wave 指示に従う判断。`<title>` は Domain D 裁量として正しく申し送り。 |
| 5 | soul thinking のフィード行を作らない | **non-blocking（L0 承認済み・検証項目 7）**。振る舞い保存 wave の職域判断として妥当。**モックとの既知の差分**なので Domain D 人間ゲート手順書に「thinking はフィード行に出ない（運転バーの soul 表示で見る）」の明記が必要——Orch が管理（申し送り済み）。 |
| 6 | static-assets テスト 1 本の対象変更 | **non-blocking**。旧「/ui/app.mjs 404」は ui/ 実体化で**事実自体が変わった**ため `/ui/does-not-exist.mjs` へ変更+実在 5 ファイルの 200 配信を追加——「ui/*.mjs を置くだけで配信される」という Domain A の許可サブツリー方式の事実を固定する適切なテストで、変更理由もテスト内コメント（:215-217）と Claim §8-6 の両方に記録。 |
| 7 | health.mjs に指示外 2 関数（mergeHealth/voiceOutputLabel） | **non-blocking**。mergeHealth は「欠落=前値保持」（原 :271-274/applyHealth `if(!h)return`）を preact state 遷移で同値化するのに必須・voiceOutputLabel は §7 ヘッダの「声の出力先」に必須（原 :344 と同値・fixture 固定）。ui/ 内での文字列組み立て禁止の規律の帰結として正当な裁量。Domain C が同じ導出を使える構造も良い。 |
| 8 | Domain C の初期ロード（loadDevices/loadWindows/loadAudioDevices 未移植） | **non-blocking**。wave-plan §3 の分業どおり（設定引き出し=Domain C）。原実装の直列順序について「サーバ側依存なし・並行でも安全と判断するが結線時に裁定を」と選択肢を残す申し送りは適切。Domain C レビューで初期ロードの実在を確認すること。 |
| 9 | chatStatus "connecting" 既定と applyChat 単一経路 | **non-blocking**。SSE 側 `(d && d.status) || "connecting"`（原 :884 同値）・snapshot 側 chatDisplayState（Domain A で :314 同値確認済み）が同一 state に合流——原実装の「単一経路（renderChatStatus）」の意図を state 設計で保存している。dead の Disconnect 無効化は chatStatusView（Domain A）に固定済み・描画結線は Domain C。 |
| 10 | 行の保持は無制限（原実装踏襲） | **non-blocking**。挙動保存の原則どおり。preact 化で行追加ごとの配列コピーが加わるが長時間配信のメモリ問題はブラウザタブ寿命として現状同等・followup 候補という整理は妥当。 |

---

## blocking / non-blocking の分離

### blocking — **ゼロ件**（wave-plan §4 の Domain B 該当分すべてクリア・上記逐条表参照）

### non-blocking — 2 件（いずれも記載精度・対処任意）

1. **`--viewer-text: #e9dcf2` の出自表記が不正確**: domain-b.md §5 の表は「本文淡紫は現 :115 の意匠踏襲」と
   するが、viewer 本文色の原実装は cockpit.html:**116**（:115 は who の色）で、値も原 `#e6d2ec` から
   `#e9dcf2` に**変更**されている（継承ではなく §7 承認の viewer 紫 #c99be8 に合わせた再調整と見られる）。
   §7 に本文色の明示は無くモック意匠の裁量範囲で機能問題なし・人間ゲートで見えるが、「踏襲」の語は
   値の継承と誤読されうる——表の出自列を「モック意匠（原 :116 の淡紫を §7 紫に合わせ再調整）」等に
   直すのが正確（修正任意）。
2. **「view-logic 経由のみ・唯一の例外は fire-note」表記の厳密性**: rows.mjs:133 の vision サムネ
   `"data:image/jpeg;base64," + d.jpegBase64` も厳密には rows.mjs 内の文字列組み立て（原 :502 と同値・
   fixture 固定済み）。表示文字列でなく搬送形式（data URI）という整理は可能だが、「唯一の例外」と
   数えるなら 2 つ目に当たる。同様に feed.mjs の speaking 行固定文言（"you"/"······(speaking)"・原 :379-380
   同値・vnode fixture 固定）は rows.mjs:13 で「固定文言は feed.mjs が定型で描く」と開示済み。いずれも
   機能同値・fixture 固定済みで実害ゼロ——記載の厳密性のみ（修正任意）。

---

## Orch への申し送り

- spec レーンとして Domain B は wave-plan §3 Domain B/§4・inventory §2-1/§4・cockpit-redesign.md §2/§7 の
  要求を逐条で満たす。13 SSE の 1:1 移植（機械的固定点=SSE_EVENT_NAMES+fixture）・タイムライン 9 行種の
  機能同値・意図的非表示の**型による強制**（feedWithGhost の null 短絡）・履歴復元の原実装同順・§7 配色の
  fixture 固定、いずれも自分でソース/原実装/実行結果を file:line まで確認した。
- **Claim の全数字が自分の再実行と一致**（675/675・74/74・30/30・23/23・10/10・5・1371 files・器側既存赤 1 件）。
  S7 Domain A レビューで見つけた種類の内訳不一致は今回もゼロ——成果物の正直性は高い。
- 検証限界 3 点（いずれも構造上の制約・blocking ではない）: (a) 実装前ベースライン 646 は Orch 確定値との
  算数照合のみ、(b) Domain A view-logic 6 モジュールの無改変はテスト本数+特徴点抜き打ちでの照合
  （バイト同一性のハッシュ記録が Domain A 時点に無い——**今後の wave では Domain 完了時に新設ファイルの
  sha256 一覧を Claim に残すと、後続 Domain レビューの無改変検証が機械化できる**）、(c) §7 の色名のみ
  指定項目（淡 teal/緑/グレー）の 16 進はモック（会話内承認・リポジトリ実体なし）由来で独立検証不可。
- **Domain C レビューへの引き継ぎ推奨**: (a) soul 表示+Fire/vision-fire disable（applySoulState :434-441 の
  導出）が `data-soul` の生値から正しく正規化されるか（原実装は thinking/speaking 以外を idle へ丸める）、
  (b) fire-note 文言体系（:562-563/:581-582 の 503 文言・エラー文言 + §8-2 の暫定移植分）の view-logic 抽出、
  (c) loadDevices/loadWindows/loadAudioDevices の初期ロード実在と順序裁定（§8-8）、(d) chatSourceEdited
  （shouldRestoreChatSource）の結線、(e) applyStateRef.current 共有経路で POST 応答 snapshot（:765/:792/:801
  相当）を適用しているか。
- **Domain D への引き継ぎ推奨**: 人間ゲート手順書に (a) thinking がフィード行に出ない仕様差（§8-5・L0
  承認済み）の明記、(b) App/Feed の実描画・EventSource 実配線・自動スクロール実挙動・「最新へ ↓」の
  確認項目化（§8-1 の Node 未実行層）、(c) `<title>` の「こーでぃー」への変更裁量（§8-4）。
