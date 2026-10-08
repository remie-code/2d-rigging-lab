# 操縦席UI改定 Domain D: 統合 + docs + 人間ゲート手順書（最終ドメイン）

> Status: 実装完了・機械ゲート緑（2026-07-14）。Domain A（vendor・静的配信・view-logic）/ B（観測+ヘッダ）/
> C（運転バー+設定引き出し）の上に、**cockpit.html を最薄エントリへ差し替え（旧 UI を一気に完全撤去・
> 死コードゼロ）**、旧 page test（30 本・HTML regex）を新構造の 4 本へ書き換え、docs（README・
> **人間ゲート手順書**・followup 台帳）を整えた。**残るは人間ゲートのみ**（choke point・実行はユーザー）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §3 Domain D / §4 /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §1-3・§2 /
> [../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §2〜§4・§7 /
> [domain-a.md](domain-a.md)・[domain-b.md](domain-b.md)・[domain-c.md](domain-c.md)（§8 申し送り群）/
> [../../reviews/cockpit-redesign/domain-c-review-design.md](../../reviews/cockpit-redesign/domain-c-review-design.md) §9（D への申し送り 6 点——全点消化）。

## 0. 最終形（cockpit.html の新形・旧資産の完全撤去）

新 cockpit.html は **27 行の最薄エントリ**（旧 913 行から −886 行）:

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset / viewport>
  <title>こーでぃー — Soul Cockpit</title>
  <style> :root { color-scheme: dark; } body { margin:0; background:#0e1114; color:#e7eaee; } </style>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import { mount } from "./ui/app.mjs";
    mount(document.getElementById("app"));
  </script>
</body>
</html>
```

- **mount 契約は domain-b.md §2 のまま**（design レビュー確認済み）: options 既定で globalThis 参照・
  引数は rootElement のみで足りる（domain-c-review-design.md §9-5）。**`<script src>` は使わない**
  （inline module の import 文は旧規約に非抵触・inventory §1-3）。
- **撤去した旧資産（同一変更で一気に・段階移行不可の裁定 = design レビュー §9-1 どおり）**:
  | 旧資産 | 行範囲（旧 cockpit.html） | 撤去根拠 |
  |---|---|---|
  | 旧 `<style>`（CSS 約 140 行） | :7-146 | styles.mjs が body/.row 等の**同名セレクタを注入**するため残すと外観が予測不能に崩れる（B レビュー §7-1） |
  | 旧 DOM（header/section×6/timeline/footer） | :148-234 | 新 UI が `channel-url`/`chat-source` の **id を自ら生成**するため旧 DOM 残存 = document 内 id 重複（C レビュー §6） |
  | 旧 IIFE（vanilla JS 約 676 行・関数 32） | :235-911 | 全ロジックは view-logic/ui へ移植済み（A §4・B §3-§4・C §3-§4 の対応表が根拠） |
- **死コードゼロの機械的根拠**: 新 page test「entry HTML is free of dead legacy UI」が旧 IIFE の
  `byId`・旧 DOM の代表 id 6 種（channel-url/chat-source/device-select/timeline/btn-fire/footer-uptime）・
  旧 CSS の代表セレクタ 2 種の**不在を doesNotMatch で固定**する。
- **裁量の記録**:
  - `<title>` = **「こーでぃー — Soul Cockpit」**: ヘッダはモック §7 の「こーでぃー」（B 済み）。title は
    ブラウザタブでの識別性を優先し、モックの名前 + 旧 title の機能名を併記した（人間ゲートで違和感が
    あれば 1 行修正）。`lang` は日本語 UI 主体になったため `en`→`ja`。
  - **HTML 側 `<style>` は FOUC 対策の最小限のみ**: module 解決〜mount（injectStyles）までの一瞬に
    白背景が出ないための `:root { color-scheme: dark }` + body の背景/文字色だけ。値は styles.mjs
    :root の `--bg: #0e1114` / `--fg: #e7eaee` の複写（二重管理はこの 2 値に限定・コメントで正本を明記）。
    スタイルの正本は ui/styles.mjs（COCKPIT_CSS・mount 時注入 = B §5 裁定）のまま。
  - 外部リソースゼロ維持（CDN・外部フォント/スクリプトなし = 新 page test が機械固定）。

## 1. 実装/変更ファイル一覧（+ sha256・Domain C 12 ファイル照合結果）

**前提の無改変証明（着手前の最初に実施）**: domain-c.md §1 の **12 ファイル sha256 と現物が全 12 一致**
（control.mjs/control.test/settings.mjs/settings.test/status.mjs/status.test/control-bar.mjs/
settings-drawer.mjs/app.mjs/styles.mjs/cockpit-ui.test/cockpit-static-assets.test）。
ベースライン `node --test` = **702/702** も一致。

| ファイル | 種別 | 役割 | sha256（Domain D 後） |
|---|---|---|---|
| `src/cockpit/cockpit.html` | **書き換え（D-1）** | 最薄エントリ（§0）。913 行 → 27 行 | `d11a5768cc85a7babf9fe2008621e048ff7886dc442796cca58d3f6dc69e812f` |
| `src/cockpit/cockpit-page.test.mjs` | **書き換え（D-2）** | 旧 30 本（HTML regex）→ 新 **4 本**（エントリ構造/死コードゼロ/外部ネットワーク非依存/起動配線スモーク）。旧 30 本の新固定先対応表をヘッダコメントに根拠化（§2） | `7fbb56137225b16ef1e8d389b0b68a43005c81c6630933e6d104945db13f9bc4` |
| `src/cockpit/ui/settings-drawer.mjs` | **変更（D-4 任意・最小）** | SettingsSelect に `id` prop を追加し、マイク/声/視界の 3 呼び出しに `id="device-select"` 等を付与 = label `for` 宙吊り 3 つの解消（C レビュー non-blocking 1・旧実装の a11y を保存）。他は無改変 | 前: `e7798294d158613c4a44420a75aa12c08a8ed8036f193b9dcc461eff36cc5b89`（C 照合済）→ 後: `23d0650e6e77d9631119c1153c66f02edcbe43d9bfd8e493bd5dff3c8b0dd7cc` |
| `src/cockpit/ui/header.mjs` | **変更（D-4 任意・最小）** | :40-41 の実到達しないフォールバック構造体リテラルを削除（B レビュー non-blocking 1・C は規律優先で見送り→ D 送りの持ち越し消化）。view-logic 外の表示リテラルゼロに | 前: `f6fed08ee65367ac90d93da0f671d149239ad6681fcd58bbe6695979ac0c7c10`（※ B/C に sha256 表が無いため Edit の逆適用で再構成した値・変更は 1 箇所のみ）→ 後: `63ae43a9a3c08bd3deef65a47296c61af7b6b578d750de592a9dc19b9891ec70` |
| `apps/soul/README.md` | **変更（D-3）** | S2.5「画面」項に刷新注記 + 「操縦席UI改定」新小節（§4） | `7caeb1345fee1b489443de18ab79cef95c78d3899d6e3c9a392dbaa4c200c6c0` |
| `waves/cockpit-redesign/human-gate.md` | 新規（D-3） | 人間ゲート手順書（§4） | `d37c803ebb018a9615b564f314a2d6ba2385f59ea1cd85b877a64d09540df769` |
| `waves/cockpit-redesign/followup.md` | 新規（D-3） | followup 台帳 8 項目（§4） | `0be83fb577e47ffe95f2d204ba75387f7fff05c1281eee62bcfd0abac0c0c17d` |

**触っていないもの（完了時に sha256 再計算で不変を証明）**: Domain C 12 ファイルのうち上記
settings-drawer.mjs 以外の **11 ファイルは全て開始時と同一 hash**。vendor
（`72284e8e…` = domain-a.md §2 の記録と一致・凍結無改変）・ui/feed.mjs（`74528a7a…`）・
ui/rows.mjs（`29f8897c…`）・ui/app.mjs（C のまま）も不変。**cockpit-server.mjs（80 insertions の
まま）・scripts/cockpit.mjs・cockpit-page.mjs・.gitignore（A のまま）・server test・view-logic 全
モジュール/テスト・器コード・契約 JSON・lockfile・package.json は 1 バイトも触っていない**（§5）。

## 2. 旧 page test → 新固定先の対応表（機能同値の説明責任）

全 30 本の対応は **cockpit-page.test.mjs のヘッダコメントに恒久記録**した（テストと同居 = 将来の
書き換え時に必ず目に入る）。要約:

| 旧テスト群（本数） | 新固定先 |
|---|---|
| エントリ/リージョン構造（旧 1） | 新 page test (1) + cockpit-ui.test（Header/FeedRow vnode・rows fixture） |
| ワイヤ契約の消費（旧 2） | cockpit-ui.test（SSE_EVENT_NAMES 13 本 deepEqual）+ ui/*.mjs の fetch 結線（対応行コメント）+ **server test 74 本（背骨）** |
| 自己完結（旧 3） | 新 page test (2)（外部ネットワーク非依存へ読み替え = wave-plan §2 裁定。`<script src>` 禁止は維持・import 文の外部 URL 禁止を追加） |
| 行種の表示文字列・CSS（旧 4-7, 11-13, 18-20, 24, 28-30 = 14 本） | view-logic fixture（transcript/markers/ghost・意図的非表示 null 遵守込み）+ cockpit-ui.test（rows fixture + CSS 検査） |
| Fire/soul/fire-note（旧 8-10 = 3 本） | view-logic/control.test（soulStatusView/fireNoteFromSseFire）+ cockpit-ui.test（FireButtons vnode） |
| Channel（旧 14-17 = 4 本） | view-logic/status.test（channelStatusView）+ settings.test（channelPostErrorText）+ ui/settings-drawer.mjs onChannelSet（対応行コメント）。**旧 17（Set 後クリア）だけは hooks 内実挙動 = 人間ゲート手順書 §4-2 が固定**（linkedom 梯子は台帳） |
| chat（旧 21-23, 25-27 = 6 本） | view-logic/status.test（chatStatusView **dead→disconnectDisabled fixture = 旧 26 の new Function 駆動テストの後継**・chatDisplayFromSseStatus・shouldRestoreChatSource）+ ui/settings-drawer.mjs の単一参照 |

> **W4 回帰保護の穴埋め（追修正 2026-07-14・Orch/test レーン指摘）**: 旧 18（SSE expression → 演出行）の
> 対応表記載が「cockpit-ui.test（feedAfterSseEvent）」と主張していたが、実測では `feedAfterSseEvent` の
> **transcript/expression/visionCaptured の 3 ディスパッチ case が fixture で踏まれていなかった**
> （行構築関数 feedWithTranscript 等は直接 fixture で固定済みだが、case ラベル → 行構築関数の対応が
> 未固定 = 誤変更しても緑のまま通る穴）。cockpit-ui.test に **feedAfterSseEvent を入口にした
> ディスパッチ検証 3 本を追加**（30 → 33 本）して穴を実体化・訂正した。反証確認済み: 3 case を
> 取り違え/ラベル改名で壊した scratchpad コピーで新 assert が全て RED 化（正常版は全 PASS = 緑の偽装でない・
> リポジトリの rows.mjs は不変）。実装コード（rows.mjs）は 1 バイトも触っていない。

**総本数 30 → 4（−26）は意図的**: 旧 30 本の大半（regex）は「表示ロジックが単一 HTML に埋没していた」
時代の固定手段で、その検証対象自体が view-logic fixture（53 本）+ ui テスト（30 本）へ**既に移管済み**
（A/B/C の各 fixture が旧実装の表示文字列と機能同値であることを対応行コメント付きで固定している）。
新 page test はエントリ層に**新しく生まれた契約**（最薄エントリ・死コードゼロ・外部非依存・起動配線）
だけを固定する。

## 3. 保存オラクル最終確認表（inventory §2-1〜2-3 全項目 → 実装場所 + 機械/人間ゲートの別)

機械 = fixture/vnode/実 HTTP で固定済み。**人間 = human-gate.md の当該節が確認点**（hooks 実挙動と
視覚は機械の構造的限界 = B §8-1 / C §8-5）。

### 観測層（§2-1）

| 項目 | 実装場所 | 機械 | 人間 |
|---|---|---|---|
| 耳ランプ+状態 | header.mjs + health.mjs earsStatusView | health.test + Header vnode | §4-1（Listening 点灯） |
| whisper/ffmpeg 死活 | header.mjs + healthStatusView/mergeHealth | health.test + Header vnode | §4-1 |
| soul 状態（idle/thinking/speaking） | app.mjs 保持 → control-bar 表示（soulStatusView） | control.test | §5-1 |
| usage（vision 区別） | app.mjs → feed.mjs .feed-meta（usageNoteText） | usage.test | §6 計器 |
| discarded カウンタ | app.mjs → .feed-meta | rows fixture（discard） | §6 |
| uptime（ローカル刻み+再同期） | app.mjs uptime/nowTick + computeUptimeMs | format-time.test | §6（**刻みは人間**） |
| Timeline 自動スクロール | feed.mjs hooks + isStuckToBottom | isStuckToBottom fixture | §6（**停止+「最新へ↓」は人間**） |
| 行種 9 つ（転写 you/soul/viewer・speaking・ゴースト・発火/演出/視覚/barge-in/自発） | rows.mjs（単一経路）+ view-logic | rows fixture 全行種 + 意図的非表示 null | §6 で 1 種ずつ照合（viewer は §7 任意） |
| 履歴復元（タブ開き直し） | app.mjs init effect + feedFromHistory | feedFromHistory fixture | §6（**実復元は人間**） |
| EventSource 実配線 | app.mjs SSE effect（13 イベント） | SSE_EVENT_NAMES fixture | §6（**実配線は人間**） |

### 運転層（§2-2）

| 項目 | 実装場所 | 機械 | 人間 |
|---|---|---|---|
| Fire（busy disable・503/reason） | control-bar fireWith + control.mjs | control.test 4 本 + FireButtons vnode | §5-1/§5-2（**busy→復帰の実フローは人間**） |
| Fire 視覚 | 同上（kind="vision"） | 同上 | §5-3 |
| 自発トグル（null=not available・一方向流） | control-bar SelfFirePill（controlled） | control.test + SelfFirePill vnode | §5-4（**§8-3 微差の確認込み**: 失敗時 checked がサーバ状態へ戻る = 旧と違い不整合が残らない） |
| 口数モード（**場所のみ・no-op**） | control-bar verbosity（ローカル state・不送信） | VERBOSITY_OPTIONS deepEqual | §5-5（**触っても挙動が変わらない = 仕様の明記・L0 義務**） |
| KILL（**S8 予約・枠のみ**） | control-bar KillSwitch（disabled・赤枠） | KillSwitch vnode + CSS 検査 | §5-6 |

### 設定層（§2-3）

| 項目 | 実装場所 | 機械 | 人間 |
|---|---|---|---|
| マイク+Start/Stop（lastDevice 初期選択・busy） | settings-drawer + initialDeviceSelection | settings.test | §4-1（**初期選択の実挙動は人間**） |
| Channel（**token 秘匿 = Set 後クリア**・redact・色） | settings-drawer onChannelSet + channelStatusView | status.test + settings.test | §4-2（**入力欄クリアは人間** = 旧 17 の後継） |
| YouTube Connect/Disconnect（**dead 無効**・source 復元・**入力中非復元**） | settings-drawer + chatStatusView/shouldRestoreChatSource | status.test（dead fixture） | §4-5（非接続時無効/非復元）+ §7（dead 終端は任意 = 実 YouTube） |
| 視界（一覧更新・Set・status） | settings-drawer + windowListView/visionTargetLabel | settings.test | §4-4 |
| 声の出力先（一覧更新・Set・その場再起動） | settings-drawer + audioDeviceListView + voiceOutputLabel | settings.test + health.test | §4-3（**再起動の実音は人間**） |
| 各エラー欄（5 → 行別に分離） | 各行下 .err + 運転バー .control-error | control/settings.test で全文言固定 | §4-6 |
| 導線（**初回自動展開・二回目直行**） | app.mjs stateLoaded + shouldAutoOpenSettings | settings.test fixture 2 本 | §3（**§5-1 の判定材料による再現手順**・lastDevice 判定外 = §8-4 既知を注記） |
| 遅延生成・shutdown 順 | サーバ側（本 wave 不変） | server test 74 本 | —（無退行の背骨） |

## 4. docs 成果物の要約（D-3）

1. **README 更新**（`apps/soul/README.md`）: 操縦席の構成に言及する既存 docs はこの 1 ファイルのみ
   （リポジトリ全 .md を grep して確認・他は discussion の歴史記録 = 不干渉）。S2.5「画面」項に
   「UI 改定で刷新——以下は当時の記録」の注記を最小挿入し、S7 の後に**「操縦席UI改定:
   コントロールルーム化」新小節**を追加（三層 IA・最薄エントリ・ui/view-logic 分割・凍結 vendor・
   静的配信・ワイヤ契約不変・保存機能一覧・手順書/台帳へのポインタ）。S3〜S7 の cockpit.html 言及は
   当時の wave 記録として不変（機能は新 UI に保存済み）。
2. **人間ゲート手順書**（[human-gate.md](human-gate.md)）: 起動（1 コマンド）→ モック §7 見た目 →
   導線（**§5-1 判定式による初回自動展開/二回目直行の再現手順**・設定ファイル退避方式・lastDevice
   判定外の注記）→ 保存チェックリスト（設定 §4 / 運転 §5 / 観測 §6 を 1 個ずつ・**L0 必須項目全部**:
   全行種 9 つ・usage/discarded/uptime・自動スクロール停止+「最新へ↓」・履歴復元・EventSource 実配線・
   uptime 刻み・Fire busy→復帰・503 文言・Fire+視覚・自発トグル §8-3 微差・**口数 no-op の義務明記**・
   KILL 枠・Channel クリア・redact・source 復元/入力中非復元・dead 無効・lastDevice 初期選択・
   Refresh 2 種・声の出力先変更）→ **実配信・実 YouTube 不要の明記**（viewer 行等は §7 任意に分離）→
   モックとの既知差分（**thinking はフィードに出ない = 運転バー側**・L0 裁定）→ 完了条件。
3. **followup 台帳**（[followup.md](followup.md)）: 8 項目（口数実配線 → **s6-followup §12 が正**・
   KILL=S8・linkedom 梯子（トリガ付き）・将来の UI 分割方針（view-logic 規律の継承）・行保持無制限
   （B §8-10）・lastDevice 判定外（C §8-4）・thinking フィード行（追撃候補）・レビュー non-blocking 残
   （D-4 で 2 件解消済みを明記 + 恒久受容 6 件の再掲））。各項目に**着手トリガ**を明記（先回りしない）。

## 5. 器不変・依存ゼロ・3チェック無退行（このセッション実行・生出力）

```
git diff --stat -- apps/runtime-player                              → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json      → 出力なし（lockfile・依存不変＝新規 npm 依存ゼロ・devDep ゼロ維持）
git diff --stat -- packages                                         → 出力なし
git diff --stat -- apps/soul/agent/src/cockpit/cockpit-server.mjs   → 80 insertions(+)（**Domain A 時点から不変**・本 Domain 不触）
git diff --stat -- …scripts/cockpit.mjs …cockpit-page.mjs           → 出力なし（不変）
git diff --stat -- …cockpit.html …cockpit-page.test.mjs …ui/header.mjs …ui/settings-drawer.mjs ../README.md
  apps/soul/README.md                               |  43 +-
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs | 449 +++--------
  apps/soul/agent/src/cockpit/cockpit.html          | 918 +---------------------
  （ui/ は untracked ツリーのため diff --stat 対象外＝sha256 で §1 に固定）
git status --porcelain -- apps/soul discussion/…/waves/cockpit-redesign
   M apps/soul/README.md                             ← 本 Domain（D-3）
   M apps/soul/agent/.gitignore                      ← Domain A のまま（本 Domain 不触）
   M apps/soul/agent/src/cockpit/cockpit-page.test.mjs  ← 本 Domain（D-2）
   M apps/soul/agent/src/cockpit/cockpit-server.mjs  ← Domain A のまま（本 Domain 不触）
   M apps/soul/agent/src/cockpit/cockpit.html        ← 本 Domain（D-1）
  ?? …cockpit-static-assets.test.mjs / cockpit-ui.test.mjs / ui/ / vendor/ / view-logic/  ← A/B/C のまま（D-4 の 2 ファイルのみ変更・§1 sha256）
  ?? discussion/…/waves/cockpit-redesign/            ← domain-a/b/c.md + 本 Domain の human-gate.md/followup.md/domain-d.md
```

- `.tmp/facex-*`・`screens/cockpit-ia-redesign.md` は一切触っていない・読んでいない（不干渉）。
- **構造チェック 3 種**（repo ルートで実装後に再実行）:
  - `check-dependencies.mjs`: **passed**。
  - `check-soul-zone-boundary.mjs`: **passed**（**1377 files** scanned = Domain C 時点と同数・本 Domain の
    新設は discussion 配下の .md のみで走査対象の増減なし・器↔魂 越境 import なし）。
  - `check-source-organization.mjs`: 違反は**器側既存赤 1 件のみ**（`apps/runtime-player/src/main/physiology/index.ts`・
    ブランチ既存ベースライン・本 Domain 不変）。無退行。

## 6. 機械ゲート生数字（実行済み・タイムアウト付き）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 676
# pass  676
# fail  0
```

- **実行前ベースライン 702（このセッションで再実行し一致確認）→ 実行後 676（−26）**。内訳:
  旧 cockpit-page.test.mjs **30 本を撤去**し新 **4 本**へ書き換え（30−4=26 減・§2 の対応表が機能同値の
  根拠）。他の全テストは無退行（702−30=672 本 + 新 4 本 = 676 全緑）。
- **背骨 `cockpit-server.test.mjs` は 74/74 全緑のまま**（個別実行 `# tests 74 / # pass 74 / # fail 0`）＝
  ワイヤ契約 16+13+6 の無退行の一次証明。
- 個別実行: **新 page test 4/4**・`cockpit-ui.test.mjs` **30/30**（D-4 の 2 修正で無退行）・
  `cockpit-static-assets.test.mjs` **10/10**・view-logic 9 テストファイル一括 **53/53**
  （※ `node --test src/cockpit/view-logic/`（ディレクトリ引数）は Node の解決エラーで実行不能——
  glob/ファイル列挙での実行は 53/53 全緑・テスト自体の問題ではない）。
- **SDK 実消費ゼロ・実ネットワーク不出・実ブラウザ不使用**（本 Domain は外部アクセス 0 回・
  実マイク/実 YouTube 不使用。実ブラウザでの描画確認は人間ゲート = human-gate.md）。

## 7. §質問（人間ゲートへの申し送り・迷った裁定点）

1. **`<title>` を「こーでぃー — Soul Cockpit」にした（裁量・§0）**: モックはヘッダの名前だけを定める。
   タブ識別性のため機能名を併記した。単に「こーでぃー」が好みなら cockpit.html の 1 行修正 +
   page test は title を固定していないので機械側の追随不要。
2. **旧 26（Disconnect dead 無効の new Function 駆動テスト）の後継は view-logic fixture**: 旧テストは
   HTML から実ロジックを切り出して fake byId で駆動していた。新実装では同ロジックが最初から純関数
   （chatStatusView）なので、fixture（status.test: dead→disconnectDisabled=true）が同じ契約をより直接に
   固定する。「駆動の忠実度が落ちた」のではなく「駆動しないと検証できない構造が消えた」と整理した。
3. **新 page test に「死コードゼロ」テストを足した（指示外・裁量）**: タスクの新テスト 3 群に加え、
   旧 IIFE/旧 DOM/旧 CSS の代表識別子の**不在**を固定する 1 本を足した（計 4 本）。id 重複が段階移行を
   壊す本 wave 固有のリスク（C レビュー §9-1）を、将来「ちょっと旧 DOM を戻す」誘惑からも守る楔。
   過剰なら削除可能（他 3 本と独立）。
4. **header.mjs の変更前 sha256 は再構成値（§1 注記）**: B/C の成果物に header.mjs の sha256 記録が
   無く、着手前の照合対象（C 12 ファイル）にも含まれていなかった。変更は Edit 1 箇所のみなので
   逆適用で変更前バイトを再構成し `f6fed08e…` を得た（正確だが実測でなく再構成である旨を正直に記す）。
5. **README の S3〜S7 節にある cockpit.html 言及は更新しなかった（裁量）**: 各節は「その wave で何が
   入ったか」の歴史記録であり、機能自体は新 UI に保存されている。現在形の構成記述（S2.5「画面」項）
   だけに刷新注記を入れ、新小節に現構成を書いた。歴史の書き換え最小の原則。
6. **人間ゲートで落ちた場合の切り分け**: 機械固定済み領域（表示文字列・状態導出・配信・ワイヤ契約）は
   全緑なので、このゲートで落ちるのは (a) hooks 実挙動（EventSource/スクロール/fetch フロー/controlled）
   か (b) 視覚意匠のどちらか。(a) が 2 回以上出たら followup §3（linkedom 梯子）の導入裁定を。
7. **実行していないこと（正直な明記)**: 実ブラウザでの起動・描画確認は一切していない（規律）。
   `npm run cockpit` の実プロセス起動もしていない（起動配線は page test の実 HTTP スモークが機械近似・
   一発起動の最終確認は human-gate.md §1 = ユーザー）。viewer 行・dead 終端の実確認は S7 経路のまま
   （本 wave は UI 層のみ・任意 §7 に分離）。
