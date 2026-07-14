# 操縦席UI改定 Domain D レビュー — spec レーン（設計契約への適合・wave 最終レビュー）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。**読み取り専任**（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・**HEAD の旧 page test 実物**・
> 自分で実行した `node --test`／`git diff`／`git status`／`sha256sum`／3チェック（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §1・§3 Domain D・§4 /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §2 全部（保存オラクル）・§6 /
> [../../waves/cockpit-redesign/domain-d.md](../../waves/cockpit-redesign/domain-d.md)（Claim・sha256 一覧付き）/
> domain-{a,b,c}.md / [domain-c-review-spec.md](domain-c-review-spec.md)・[domain-c-review-design.md](domain-c-review-design.md)。
> 位置づけ: **wave の最終 spec レビュー**——保存オラクル（inventory §2-1〜2-3）全項目の最終突合を含む。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜5 はすべて満たす。委任された spec 検証項目 1〜6（逐条照合）はすべて PASS。
**Claim（domain-d.md）の全数字・全 sha256 が自分の再実行・再計算と一致**（676/676・74/74・4/4・30/30・10/10・
view-logic 9 ファイル 53/53・算術 702−30+4=676・**sha256 は D 成果物 7 + Domain C 12 ファイル照合 + vendor +
feed/rows の全 21 計算が一致**）。保存オラクル全項目（観測 11・運転 5・設定 8）の実装場所と機械/人間ゲートの別を
最終突合し、全項目が新実装に存在・human-gate.md の当該節参照も全て正確。**旧 page test 30 本（HEAD 実物）と
新ヘッダコメント対応表の 1:1 対応を自分で突き合わせて確認**（機能同値の説明責任は果たされている）。
blocking はゼロ。non-blocking は 3 件（いずれも検証限界の記録・修正不要）。**機械側はこれで閉じ、残るは
人間ゲート（human-gate.md・実行はユーザー）のみ。**

---

## 0. 自分で走らせた生数字（すべて Review-Sylph が実行・タイムアウト付き・空/interrupted なし・各 1 回で成功）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 676
# pass  676
# fail  0        （duration 1.52s）
```

→ **Claim（domain-d.md §6）・Orch 確定値と一致**。算術 **702（Domain C レビューで自分が実測した実行前
ベースライン）− 30（旧 page test 撤去）+ 4（新 page test）= 676** も一致。

個別実行（すべて自分で実行）:

```
node --test src/cockpit/cockpit-server.test.mjs        → # tests 74 / pass 74 / fail 0   （無退行の背骨＝ワイヤ契約 16+13+6）
node --test src/cockpit/cockpit-page.test.mjs          → # tests  4 / pass  4 / fail 0   （新 4 本＝D-2）
node --test src/cockpit/cockpit-ui.test.mjs            → # tests 30 / pass 30 / fail 0   （D-4 の 2 修正で無退行）
node --test src/cockpit/cockpit-static-assets.test.mjs → # tests 10 / pass 10 / fail 0
node --test src/cockpit/view-logic/*.test.mjs（9 ファイル一括） → # tests 53 / pass 53 / fail 0
```

（53 の内訳算術も一致: A 28〔format-time 4/transcript 4/markers 5/ghost 5/status 7/usage 3〕+ B health 5 +
C control 8 + settings 11 + status +1 = 53。Claim §6 の「ディレクトリ引数は Node 解決エラー」注記どおり
glob 列挙で実行した。）

**器不変・契約不変・lockfile 不変・不可侵ファイル無改変**（自分で実行・生出力）:

```
git diff --stat -- apps/runtime-player                          → 出力ゼロ（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json  → 出力ゼロ（lockfile・依存不変＝新規 npm 依存ゼロ・devDep ゼロ）
git diff --stat -- packages                                     → 出力ゼロ
git diff --stat -- …cockpit-server.mjs                          → 80 insertions(+)＝Domain A のまま（D 不触・背骨 74/74 が二重証明）
git diff --stat -- …scripts/cockpit.mjs …cockpit-page.mjs       → 出力ゼロ（不変）
git diff --stat -- apps/soul/agent/.gitignore                   → 8 insertions(+)＝Domain A のまま
git diff --stat -- …cockpit.html …cockpit-page.test.mjs         → 918 +--- / 449 +---（D-1/D-2 の書き換え・Claim §5 と一致）
git diff --stat -- apps/soul/README.md                          → 43 (+38/−5)（D-3・Claim §5 と一致）
git status --porcelain → M 5 ファイル + ?? 5 系 + ?? discussion/…/waves/cockpit-redesign/（Claim §5 と一致・
  ?? reviews/cockpit-redesign/ はレビューレーン自身の成果物）
```

**構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルート・自分で再実行）:

```
check-dependencies.mjs        → Dependency guard passed.（EXIT=0）
check-soul-zone-boundary.mjs  → passed: 1377 source files scanned; 越境 import なし。（EXIT=0）
check-source-organization.mjs → 唯一の違反: apps/runtime-player/src/main/physiology/index.ts（器側既存赤・ブランチ既存ベースライン）
```

→ **Claim §5・Orch 確定ベースライン（1377 = Domain C 時点と同数）と完全一致**（D の新設は discussion 配下
.md のみ＝走査対象の増減なしの主張も事実）。

`.tmp/facex-*`・`screens/cockpit-ia-redesign.md` には一切触れていない（読んでもいない・不干渉）。
本レビューは実ネット不出・SDK 実消費ゼロ（テストは loopback listen(0) のみ）・実ブラウザ不使用。

---

## 1. sha256 機械照合（検証項目 4）— **全 21 計算が一致**

### 1-1. Domain D の新設・変更 7 ファイル（domain-d.md §1）— 7/7 一致

| ファイル | 再計算 = Claim |
|---|---|
| cockpit.html（D-1・27 行を wc -l でも確認） | `d11a5768…69e812f` 一致 |
| cockpit-page.test.mjs（D-2） | `7fbb5613…3f9bc4` 一致 |
| ui/settings-drawer.mjs（D-4 後） | `23d0650e…d0dd7cc` 一致 |
| ui/header.mjs（D-4 後） | `63ae43a9…891ec70` 一致 |
| apps/soul/README.md（D-3） | `7caeb134…200c6c0` 一致 |
| waves/cockpit-redesign/human-gate.md（D-3） | `d37c803e…40df769` 一致 |
| waves/cockpit-redesign/followup.md（D-3） | `0be83fb5…0c0c17d` 一致 |

### 1-2. Domain C 12 ファイル照合（domain-c.md §1 の記録値 vs 現物・無改変検証の機械化＝初運用の完遂）— 11 不変 + 1 は D-4 変更どおり

D-4 で触った settings-drawer.mjs（前値 `e7798294…` → 後値 `23d0650e…`＝Claim の前後両値と整合）**以外の
11 ファイルは全て C 時点の記録値と現物が一致**（= Domain D 期間中バイト不変の完全証明）:
view-logic/control.mjs `c38e6d25…`・control.test.mjs `9637119d…`・settings.mjs `08871065…`・
settings.test.mjs `48e941df…`・status.mjs `c1c230d1…`・status.test.mjs `8c593f3b…`・
ui/control-bar.mjs `f2376922…`・ui/app.mjs `60f091d6…`・ui/styles.mjs `2a7d7c8b…`・
cockpit-ui.test.mjs `936cb28d…`・cockpit-static-assets.test.mjs `4a5c4e95…`——全一致。

### 1-3. その他の不変証明

- **vendor**: `72284e8e…46fc1fd7`・13,194B 再計算一致（Domain A 確定値のまま凍結・無改変）。
- **ui/feed.mjs** `74528a7a…`・**ui/rows.mjs** `29f8897c…`: Claim §1 の記載値と再計算一致
  （→ 検証限界は non-blocking 1）。
- **header.mjs の変更前値 `f6fed08e…` は再構成値（L0 裁定 4）**: domain-d.md §1 の注記 +
  §7-4 の正直な開示（「実測でなく再構成」）を確認。**独立検証は構造上不可能**（B/C に記録が無い）だが、
  (a) 変更後値は照合済み、(b) 実物 header.mjs:38-41 は「フォールバック構造体の削除 + 削除経緯コメント」
  という Claim どおりの 1 箇所変更の形、(c) C レビュー2 本が B 時点の残存を実物確認していた特徴点と整合。
  正直な注記の存在という委任確認点は**満たされている**（→ non-blocking 2）。

---

## 2. 保存オラクル最終突合（検証項目 1・inventory §2-1〜2-3 全項目 vs domain-d.md §3 の表 vs 実物）— **PASS**

突合方法: (a) inventory §2 の全項目が §3 の表に漏れなく載っているか、(b) 表の「実装場所」が実物と合うか
（header.mjs/settings-drawer.mjs/cockpit.html/page test は自分で精読。control-bar/app/feed/rows/styles/
view-logic は §1-2 の sha256 照合で「B/C レビューが実物精読したバイトと同一」を機械証明済み＝
両レビューの file:line 突き合わせ結果がそのまま現物に有効）、(c) 「機械」欄のテスト実在（スポット grep:
SSE_EVENT_NAMES 13 本 deepEqual = cockpit-ui.test:82-87・feedFromHistory fixture :184・isStuckToBottom :282・
dead→disconnectDisabled=true = status.test:27・VERBOSITY_OPTIONS deepEqual :418）、(d) 「人間」欄の
human-gate.md 節番号を手順書実物と 1 個ずつ照合。

### 観測層（inventory §2-1）— 11/11 PASS

| 項目 | 実装場所（表の主張＝実物） | 機械欄 | 人間欄（human-gate 節・実在確認） |
|---|---|---|---|
| 耳ランプ+状態 | header.mjs + earsStatusView | ✓ health.test + vnode | ✓ §4-1（Start→Listening 点灯・Stop→消灯） |
| whisper/ffmpeg 死活 | header.mjs + healthStatusView/mergeHealth | ✓ | ✓ §4-1（whisper: up / ffmpeg: up） |
| soul 状態 | app.mjs 保持 → control-bar（soulStatusView） | ✓ control.test | ✓ §5-1（thinking→speaking→idle） |
| usage（vision 区別） | app.mjs → feed .feed-meta（usageNoteText） | ✓ usage.test | ✓ §6 計器（usage(vision) 込み） |
| discarded カウンタ | app.mjs → .feed-meta | ✓ rows fixture | ✓ §6（行種 3 と連動） |
| uptime（刻み+再同期） | app.mjs + computeUptimeMs | ✓ format-time.test | ✓ §6（**1 秒刻み=人間**・Stop で 00:00:00） |
| 自動スクロール | feed.mjs hooks + isStuckToBottom | ✓ fixture | ✓ §6（停止+「最新へ↓」=人間） |
| 行種 9 つ | rows.mjs 単一経路 + view-logic | ✓ rows fixture 全行種+意図的非表示 null | ✓ §6 で 1 種ずつ（viewer は §7 任意へ分離・§6 に明記） |
| 履歴復元 | app.mjs init effect + feedFromHistory | ✓ fixture | ✓ §6（履歴行にレイテンシ無しの契約込み） |
| EventSource 実配線 | app.mjs SSE effect（13） | ✓ SSE_EVENT_NAMES fixture | ✓ §6（開き直しタブでリアルタイム流入） |
| （Timeline 遅延生成・shutdown） | サーバ側・本 wave 不変 | ✓ server test 74 | —（背骨・妥当） |

### 運転層（inventory §2-2）— 5/5 PASS

| 項目 | 判定根拠 |
|---|---|
| Fire（busy disable・503/reason） | ✓ control-bar fireWith（C spec レビュー実物確認・sha256 不変）。人間 §5-1（busy→復帰）/§5-2（503 文言全文が手順書に実在: `fire not available (start cockpit with --channel)`） |
| Fire 視覚 | ✓ 同上 kind="vision"。人間 §5-3（サムネ付きマーカー+窓閉じの正直な中止ゴーストまで） |
| 自発トグル（null=not available・一方向流） | ✓ SelfFirePill controlled。人間 §5-4——**§8-3 微差（POST 失敗時 checked がサーバ状態へ戻る＝旧と違い不整合が残らない）の確認が明記されている**（委任確認点） |
| 口数（**場所のみ・no-op**） | ✓ verbosity ローカル state・不送信（C spec レビューが grep で機械確認・sha256 不変）。人間 §5-5——**「選択しても挙動は一切変わらない」「仕様であり故障ではない」の L0 義務明記あり**+s6-followup §12 ポインタ |
| KILL（**S8 予約・枠のみ**） | ✓ KillSwitch disabled+赤枠。人間 §5-6——**「押せてしまったら FAIL」まで明記**（予約枠の検収条件として正確） |

### 設定層（inventory §2-3）— 8/8 PASS

| 項目 | 判定根拠 |
|---|---|
| マイク+Start/Stop（lastDevice・busy） | ✓ settings-drawer 実読（initialDeviceSelection・micBusy 両 disable）。人間 §4-1（lastDevice 初期選択・busy→復帰） |
| Channel（token 秘匿・redact・色） | ✓ onChannelSet 実読（:225-226 = applySnapshot 後に setChannelUrl("")）。人間 §4-2（**入力欄クリア=旧 17 の後継**・redact・色ドット 3 色） |
| YouTube Connect/Disconnect（dead 無効・source 復元・入力中非復元） | ✓ chatStatusView.disconnectDisabled 単一参照（:360）+ shouldRestoreChatSource + chatEditedRef 実読。人間 §4-5（非接続時 disabled・空 source 文言・入力中非復元の再現手順）+ §7（dead 終端=任意・実 YouTube）——機械側は status.test の dead fixture が固定済み（→ 分離の妥当性は non-blocking 3 で記録） |
| 視界（一覧更新・Set・status) | ✓ loadWindows/onVisionSet 実読。人間 §4-4（Refresh windows・title (processName) 形式） |
| 声の出力先（一覧更新・Set・その場再起動） | ✓ loadAudioDevices/onAudioSet 実読。人間 §4-3（**再起動の実音=次の発話が新デバイスから鳴る**） |
| 各エラー欄（5→行別分離） | ✓ 行別 .err + 運転バー .control-error（実読）。人間 §4-6（相互汚染の構造的消滅の説明込み） |
| 導線（初回自動展開・二回目直行） | ✓ shouldAutoOpenSettings + stateLoaded/autoOpenedRef（C レビュー確認・sha256 不変）。人間 §3——**§5-1 判定式による再現手順（設定ファイル退避方式・戻し方まで）+ lastDevice 判定外（§8-4）+ fetch 失敗時も開かない**の 4 点全て実在 |
| 遅延生成・shutdown 順 | ✓ server test 74 本（背骨・本 wave 不変） |

**結論: inventory §2-1〜2-3 の全項目が新実装に存在し、domain-d.md §3 の表の実装場所・機械/人間ゲートの別は
全項目正確。**意図的非表示 diagnostic リストの遵守（wave-plan §4-4）も rows fixture + ghost.test で機械固定
済み（A/B レビューから承継・sha256 不変）。

---

## 3. wave-plan §3 Domain D の要求（検証項目 2）— **PASS（全 5 点）**

| 要求 | 判定 | 根拠 |
|---|---|---|
| cockpit.html 最終形（inline module エントリ+CSS カスタムプロパティ） | PASS | 実物 27 行を精読: div#app + inline module（`import { mount } from "./ui/app.mjs"` → `mount(document.getElementById("app"))` = domain-b.md §2 の mount 契約どおり・`<script src>` 不使用）。`<style>` は FOUC 最小限 2 値のみで**正本 ui/styles.mjs の :root 値（--bg #0e1114/--fg #e7eaee）と複写一致を自分で照合**・正本明記コメントあり。title「こーでぃー — Soul Cockpit」・lang="ja"（裁量記録 §0 あり）。 |
| 旧バニラ JS 撤去（死コードゼロ） | PASS | 実物 27 行に旧 style/DOM/IIFE の痕跡ゼロ（目視）+ 新 page test 2 本目が代表識別子 9 種+旧セレクタ 2 種の**不在を doesNotMatch で機械固定**（将来の再混入への楔・裁量追加は §7-3 に記録・design レビュー §9-1「一気に完全撤去」の遵守）。 |
| 旧 page test 書き換え（機能同値の根拠） | PASS | **HEAD の旧 30 本のテスト名を自分で列挙し、新ヘッダコメント対応表（旧 1〜旧 30）と 1:1 で突き合わせ——30/30 全対応・過不足ゼロ**。対応先の実在もスポット確認（§2 の (c)）。対応表の群算術（1+1+1+14+3+4+6=30）も一致。新 4 本は「エントリ層に新しく生まれた契約」のみを固定する整理で、旧 17（Set 後クリア）の「hooks 実挙動=人間ゲート §4-2 が固定」の分離も対応表に明記。 |
| README 更新 | PASS | git diff 実読: S2.5「画面」項に刷新注記（歴史記録は保存・現在形だけ更新=§7-5 の裁定）+ S7 後に「操縦席UI改定」新小節（三層 IA・最薄エントリ・分割・vendor 凍結・配信・ワイヤ契約不変・保存機能・手順書/台帳ポインタ——wave-plan §3 の列挙全部あり）。 |
| 人間ゲート手順書 + followup 台帳 | PASS | §4 で逐条（下記）。SDK 実消費ゼロも Claim §6 + 本レビューの検証過程（実ネット不出）と整合。 |

---

## 4. 人間ゲート手順書（human-gate.md）必須項目の実在（検証項目 3）— **PASS（委任列挙の全項目）**

構成: §1 起動（1 コマンド）→ §2 モック §7 見た目 → §3 導線 → §4〜§6 保存チェックリスト（チェックボックスで
**1 個ずつ**）→ §7 任意（実 YouTube）→ §8 既知差分 → §9 完了条件。委任プロンプトの必須列挙を逐条:

| 必須項目 | 実在節 | 判定 |
|---|---|---|
| 起動→モック§7 見た目→チェックリスト 1 個ずつ→三層 IA/導線 | §1→§2→§4-§6→§2/§3 | PASS |
| Fire busy→復帰 | §5-1 | PASS |
| 503 文言 | §5-2（文言全文+再現条件） | PASS |
| 自発トグル ON/OFF + §8-3 微差 | §5-4（微差の新旧比較まで記載） | PASS |
| Channel Set 後入力欄クリア | §4-2（token 秘匿の保存点と明記） | PASS |
| source 復元・入力中非復元 | §4-5（非復元の再現手順・復元は記憶済み条件付き） | PASS |
| Disconnect dead 無効 | §4-5（非接続時 disabled=state 駆動）+ §7（dead 終端=任意） | PASS（分離の記録は non-blocking 3） |
| lastDevice 初期選択 | §4-1 | PASS |
| Refresh（2 種） | §4-3（devices）・§4-4（windows） | PASS |
| 初回自動展開・二回目直行 | §3（判定式・退避方式・判定外・fetch 失敗時） | PASS |
| **口数=見た目のみ（L0 義務）** | §5-5（「仕様であり故障ではない」+ s6-followup §12） | PASS |
| **thinking は運転バー側=モック既知差分（L0 裁定）** | §8-1（followup §7 ポインタ込み） | PASS |
| hooks 実挙動（EventSource 実配線・自動スクロール・履歴復元・uptime） | §6（4 点全て個別チェック項目） | PASS |
| 実配信・実 YouTube 不要の明記 | §0「しない」+ §7 分離 | PASS |

**followup 台帳（followup.md）**: 委任列挙の 4 点全て実在——口数=**s6-followup §12 が正（二重管理しない
ポインタ形）**（§1）・KILL=S8（§2）・linkedom 梯子（§3・**トリガ「hooks 起因の退行 2 回以上」付き**）・
UI 分割方針（§4・view-logic 規律の継承 4 則）。+4 項目（行保持無制限/lastDevice/thinking/レビュー
non-blocking 残=D-4 で 2 件解消と恒久受容 6 件の再掲——C レビュー2 本の non-blocking 台帳と突き合わせて
過不足なし）。**全 8 項目に着手トリガ明記**（先回りしない規律の形として正確）。

---

## 5. blocking 基準（wave-plan §4・検証項目 5）— **PASS（全 5 項・wave 全体の最終確認）**

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器・契約・lockfile・package.json 不変／新規 npm 依存ゼロ／ビルド段ゼロ | PASS | §0 の git 生出力（runtime-player/packages/lockfile/package.json 全て差分ゼロ）。cockpit.html はソース=実行物・起動は `npm run cockpit` 一発（page test (4) が起動配線の機械近似・最終確認は human-gate §1）。 |
| 2. server test 全緑・全テスト緑・page test 書き換えの機能同値根拠 | PASS | **74/74（自分で実行）**・全体 676/676・旧 30 本→新固定先の 1:1 対応表をヘッダコメントに恒久記録（§3 で HEAD 実物と突合済み）。 |
| 3. view-logic 純関数+fixture | PASS | D は view-logic 不触（§1-2 sha256 で機械証明）・9 ファイル 53/53 自分で実行。 |
| 4. 保存チェックリスト全項目+意図的非表示リスト遵守 | PASS | §2 の最終突合（観測 11・運転 5・設定 8 全項目）。 |
| 5. devDep ゼロ・3 チェック無退行・終了処理 | PASS | package.json 差分ゼロ（linkedom は台帳の梯子のまま）・3 チェック自分で再実行し一致（passed/1377/器側既存赤 1 件のみ）・新 page test は server.close() まで（実読）。 |

**cockpit-server.mjs 80 insertions のまま・scripts/cockpit.mjs・cockpit-page.mjs 不変**（§0 生出力）——
委任の個別確認点も全て事実。

## 6. 成果物の主張の正直性（検証項目 6）— **PASS**

- **数字**: §5/§6 の全数字（676/74/4/30/10/53・702→676 の算術・80 insertions・1377 files・器側既存赤 1 件・
  README 43 行 diff・page test 449 行 diff・cockpit.html 918 行 diff）を自分の再実行と照合し**全一致・
  不一致ゼロ**。
- **正直な開示の質**: §7-4（header.mjs 前値は再構成・実測でない）・§7-7（実ブラウザ・実プロセス起動を
  していない）・§6（ディレクトリ引数の実行不能はテストの問題でない）・§7-3（死コードゼロテストは指示外の
  裁量追加・削除可能）——いずれも実行していないことを実行したと書かない規律が保たれている。
- §7-2（旧 26 の後継整理「駆動しないと検証できない構造が消えた」）は C spec レビューの旧 26 検証結果とも
  整合し、spec 上妥当。

---

## blocking / non-blocking の分離

### blocking — **ゼロ件**（wave-plan §4 全 5 項クリア・上記逐条表参照）

### non-blocking — 3 件（いずれも検証限界・分離の記録。修正不要・再委任不要）

1. **feed.mjs/rows.mjs（+ Domain A/B 期の view-logic 6+2 モジュール）の D 着手前ハッシュに第三者記録が
   無い**: D 着手前照合（domain-d.md §1 前提）の機械照合対象は Domain C の 12 ファイルのみで、B 以前の
   ファイルの「D 期間中不変」は Claim の自己計測値（feed `74528a7a…`/rows `29f8897c…`＝私の再計算と一致）に
   依存する。機能面は cockpit-ui.test 30/30（rows fixture 込み）+ view-logic 53/53 が担保し、C レビュー
   non-blocking 4 と同型の構造的限界。**wave がここで閉じるため実務上の残余なし**（次に ui/ を触る wave は
   本レビュー §1 の全 sha256 を開始時照合に使える）。
2. **header.mjs の変更前 sha256 は独立検証不能（再構成値）**: L0 裁定 4 の確認点である「正直な注記」は
   domain-d.md §1 + §7-4 に実在し、変更後値は照合済み・実物も Claim どおりの 1 箇所変更の形。記録のみ。
3. **「Disconnect dead 無効」の人間ゲートは二分割**: 手順書は「非接続時 disabled（state 駆動）」を必須
   （§4-5）に、「dead 終端（配信終了後の無効化）」を任意（§7・実 YouTube）に分けた。dead→
   disconnectDisabled=true 自体は status.test fixture が機械固定済み+S7 実ゲートで実証済みの経路であり、
   wave-plan §5（実配信・実 YouTube 不要）とはこの分離でしか両立しない＝裁定として妥当。委任の必須列挙と
   字面が異なる点だけ記録する（実質は満たされている）。

---

## §質問（domain-d.md §7）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | title「こーでぃー — Soul Cockpit」（裁量） | **non-blocking**。モックはヘッダ名のみ規定・title はタブ識別性の裁量として妥当。page test が title を固定していないことも実物で確認（機械側の追随不要の主張は事実）。human-gate §2 に確認項目あり=人間ゲートで裁ける。 |
| 2 | 旧 26 の後継は view-logic fixture | **non-blocking**。C spec レビューで status.test の dead fixture を確認済み。「駆動しないと検証できない構造が消えた」整理は正確。 |
| 3 | 死コードゼロテストの裁量追加 | **non-blocking（歓迎）**。wave-plan §3「旧バニラ JS 撤去の確認（死コードゼロ）」の機械固定であり契約に沿う方向。id 重複リスク（C design レビュー §9-1）への楔として妥当・他 3 本と独立。 |
| 4 | header.mjs 前値の再構成 | **non-blocking 2 のとおり**（正直な開示あり）。 |
| 5 | README の S3〜S7 節不更新（歴史の書き換え最小） | **non-blocking**。刷新注記が S2.5「画面」項（現在形の構成記述）に入っており、読者が旧構成を現況と誤認する経路は塞がれている。妥当。 |
| 6 | 人間ゲートで落ちた場合の切り分け | **non-blocking**。機械固定済み領域が全緑という前提は本レビューで裏取り済み——「落ちるのは hooks 実挙動か視覚意匠」の二分は正確。linkedom 梯子のトリガ（2 回以上）が followup §3 と一致。 |
| 7 | 実行していないこと（実ブラウザ・実プロセス起動） | **non-blocking（規律どおり）**。page test (4) の実 HTTP スモークが機械近似・最終は human-gate §1=ユーザーという線引きは wave-plan §5 の choke point 設計そのもの。 |

---

## Orch への申し送り

- **spec レーンとして Domain D は wave-plan §3 Domain D/§4・inventory §2 全部（保存オラクル）・§6 の要求を
  逐条で満たす。wave の機械側はこれで閉じた**——blocking ゼロ・全テスト 676/676・背骨 74/74・3 チェック
  無退行・器/契約/lockfile/依存の不変を git 生出力で確認・sha256 全 21 計算一致（D 7 + C 12 照合 +
  vendor/feed/rows）。
- **保存オラクル全項目の最終突合完了**: 観測 11・運転 5・設定 8 の全項目が新実装に存在し、機械固定
  （fixture/vnode/実 HTTP）と人間ゲート（human-gate.md 当該節）の割り当ても全項目正確。
- **機能同値の説明責任は果たされている**: 旧 page test 30 本（HEAD 実物）と新対応表の 1:1 対応を自分で
  突き合わせた。対応先 fixture の実在もスポット確認済み。
- **残るは人間ゲートのみ**（choke point・実行はユーザー）。手順書は L0 義務（口数 no-op・thinking 既知差分）
  込みで委任必須列挙を全て充足。合格後の閉鎖記録で non-blocking 1 の sha256 一覧（本レビュー §1）を
  「次に ui/ を触る wave の開始時照合値」として引用できる。
- 人間ゲートが FAIL を出した場合: 機械固定済み領域は全緑ゆえ hooks 実挙動 or 視覚意匠に切り分けられる
  （domain-d.md §7-6 の二分は正確）。hooks 起因 2 回以上で followup §3（linkedom 梯子）の裁定へ。
