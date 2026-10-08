# C4 Domain E 実装報告: 最終統合(モノレポ検証・無変更確認・docs更新・fixture最終整合・follow-up・手動確認メモ)

> Gnome(実装担当)→ Orch-Sylph。task=`cohost-c4-final-integration`。
> スコープ=統合・検証・docs・小整合修正に徹する(Domain A〜D のロジックは再変更しない)。挙動を変える修正はゼロ。
> **Domain A〜D のロジック(control-channel サーバ本体・contract・store・validation・config/port、heart overlay seam、bridge・ページ・degraded・合成根配線・特区・参照ドライバ・方向検査)は1バイトも再変更していない。** 私の変更は (1) fixture note の実語彙化(1行)(2) 契約テストへの同期テスト追記(2件)(3) discussion docs 5ファイル + follow-up 新規1ファイル、のみ。

---

## 1. モノレポ全体検証(E-1)

`pnpm install` は未実行(回避工作なし)。各コマンドの実行結果:

| 検証 | コマンド | 結果 |
|---|---|---|
| runtime-player typecheck | `pnpm -C apps/runtime-player run typecheck`(tsc --noEmit) | **PASS**(exit 0) |
| root typecheck | `pnpm run typecheck:root`(tsc --noEmit) | **PASS**(exit 0) |
| runtime-player 全体テスト | `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts` | **823 passed / 2 failed(825 total; 136 files: 134 passed / 2 failed)** |
| check:deps | `node scripts/check-dependencies.mjs` | **PASS**(`Dependency guard passed.`) |
| check:source | `node scripts/check-source-organization.mjs` | 1 違反(既知 C3 baseline、下記) |
| check:soul-zone | `node scripts/check-soul-zone-boundary.mjs` | **PASS**(`1243 source files scanned; no 器→魂 imports and no 魂→器 code imports.`) |
| check:soul-zone:fixtures | `node scripts/check-soul-zone-boundary-fixtures.mjs` | **PASS**(`5 cases.`: valid緑 + 単一行/多行の両違反2種を赤で固定) |
| composite check | `pnpm run check` | check:source の既知 baseline でのみ exit 1。それ以前は全緑(下記) |

### composite `check` の内訳(どこまで緑か)

`pnpm run check` = `typecheck && test:unit && check:deps && check:source && check:soul-zone`。実測:
- **typecheck(root)**: PASS。
- **test:unit(packages)**: **240 files / 1492 tests 全 PASS**。
- **check:deps**: PASS。
- **check:source**: **FAIL**(既知 C3 baseline `physiology/index.ts`)→ `&&` チェーンがここで停止。
- check:soul-zone は composite からは未到達だが**単独実行で緑**(上表)。

→ composite `check` の exit 1 は **既知 C3 baseline のみに帰属**。それ以外のステップは全緑。

### 既知 baseline の明示分類(C4 起因でない fail・違反)

1. **全体テストの 2 failed = Wave21 browser-source 系**(両方とも browser-source の `effectiveDynamicsTuning` フィールド不一致):
   - `src/main/broadcast-source/browser-source-server.test.ts > serves current Runtime Export payload to authorized Browser Source clients`
   - `src/stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`
   - Domain A(781/2)・B(792/2)・C(816/2)・D(821/2)の全報告で**同一の2件**。C4 は browser-source を1バイトも触っていない(因果的に無関係)。**この2件以外の test fail はゼロ**(2 failed の内訳が両方ともこの2ファイルであることを再ラン出力で確認)。
2. **check:source の唯一の違反 = `apps/runtime-player/src/main/physiology/index.ts`**(`index.ts must remain a barrel-only entrypoint`)。**C3 で committed 済みの既存ファイル**で、C4 では未接触(physiology/ 配下は無変更、下記 §2)。Domain A〜D 全報告と同一 baseline。**この違反以外の check:source 違反はゼロ**。

**件数の連続性**: Domain D 全体テスト 821 passed + Domain E で追加した normalizedRanges 同期テスト2件 = **823 passed** で整合(§4)。2 failed は不変。

---

## 2. 無変更確認(E-2、git 機械確認)

`git status --short` / `git diff --name-only` / `git diff --stat` で確認:

| 対象 | 確認方法 | 結果 |
|---|---|---|
| `pnpm-lock.yaml` / `pnpm-workspace.yaml` | `git status --short` / `git diff --stat` | **無変更**(status 空・diff 0行) |
| Editor ソース(`apps/editor/`) | `git status --short apps/editor/` | **無変更**(空) |
| package-format(`packages/package-format/`) | `git status --short` | **無変更**(空) |
| Runtime Export schema / physiology golden JSON | `git diff --stat -- '*golden*.json'` / name-only grep | **無変更**(該当差分なし) |
| `apps/runtime-player/src/main/physiology/` 配下 | `git status --short apps/runtime-player/src/main/physiology/` | **無変更**(空)。golden 3本(`blink-default`・`blink-alt-config`・`full-generator-snapshot`)含む |
| `headless-slot-resolver.ts`(`.../live-mapping/`) | `git status` / `git diff --stat -- '*headless-slot-resolver.ts'` | **無変更**(空) |
| `apps/soul` の package.json | `ls apps/soul/package.json` | **無し**(good) |

`git diff --name-only`(変更 tracked ファイル全体)は Domain B/C の control-window 系レンダラ・role-composition・`runtime-player-main.ts`・preload・boundary.test.ts + `package.json`(Domain D の check:soul-zone 3行)のみ。**protected path(physiology/・editor/・package-format・resolver・runtime-export schema)への変更はゼロ**(grep で NONE MATCH 確認)。

---

## 3. 更新した docs 一覧と要点(E-3)

| ファイル | 更新要点 |
|---|---|
| `implementation/orchestration/c4-wave-plan.md` | §1 Status を「Ready to launch」→「**実装完了(Domain A〜E+3レーンレビュー合格、機械ゲート緑)。C4閉鎖判定待ち**」へ。Domain A〜E の1行結果+各報告リンク・機械ゲート緑・既知baseline 2種・無変更確認・残(手動一目確認)を簡潔に追記。 |
| `concept/mvp-boundary-amendment.md` | §6 の「方向ルール検査は C4 で新設する」訂正部に「**実体化の完了(C4 Domain D 実装済み)**」段落を追加。`scripts/check-soul-zone-boundary.mjs`・2ルール・composite `check` 連結・違反fixtureで赤の実証(`check:soul-zone:fixtures` 5ケース)・実リポジトリ緑(1243 files)・参照ドライバが最初の住人で緑維持、を事実として記載。憲章「境界が機械検証可能になる分だけ強くなる」が **C4 で実際に成立した**旨を明記。 |
| `implementation/screens/c4-channel-diagnostics.md` | §3 に「**実装注記(C4 Domain C・構成不変条件)**」を追加(E-5、下記 §5)。 |
| `ai-cohost/_map.md` | Directory Map の implementation 行 Status・§4 に C4 実装完了行・§5 Next Actions を、**C4 = 実装完了/機械ゲート緑/手動確認待ち**(完全閉鎖ではない)で反映。C3流儀に合わせ「手動確認待ち」を明示。 |
| `implementation/_map.md` | screens/orchestration 行に C4 反映、waves/c4・reviews/c4 行を追加、次の行動4を C4 実装完了状態へ更新。 |

**判断**: C4 はまだ**人間の一目確認(§7)を通過していない**ため、C1〜C3 の「完全閉鎖」表記は使わず、C3 が実装完了時点で採った「**実装完了・3レーンレビュー全PASS・機械ゲート緑・手動確認待ち**」の流儀に合わせた(過度な書き換えをせず、事実の追記に留めた)。

---

## 4. fixture 最終整合(E-4)

### 4.1 契約の家 fixture(純JSON)確認
`contract/*.json` 3本(`channel-envelope-schema.json`・`channel-exchange-examples.json`・`channel-intent-set-payload-schema.json`)を `JSON.parse` で検証 → **全て純JSON**(コメント/trailing なし)。schema/やり取り例/TS型の三者同期は `contract/channel-protocol-contract.test.ts` が `toStrictEqual` で束縛し **8 tests 緑**。

### 4.2 exchange-examples の実語彙化(Domain A Lane1 non-blocking 1)
`channel-exchange-examples.json` happyPath の note を実スロット語彙へ:
- 旧: `"note": "Turn the head toward face.angle.x for 800ms."`
- 新: `"note": "Turn the head via the head-horizontal slot for 800ms."`

**note 文言のみ**の変更。実 payload(`slotId: "head-horizontal"`)・schema・TS 型のロジックは不変。これで契約 JSON 内の説明用旧表記 `face.angle.x` は消え、魂が読む fixture が実語彙で一貫。

### 4.3 normalizedRanges の JSON↔TS 同期テスト追加(Domain A Lane3 non-blocking 1)
`contract/channel-protocol-contract.test.ts` に新 describe「normalizedRanges ↔ TS classifier sync」を追記(2件):
1. **完全性**: `channel-intent-set-payload-schema.json` の `normalizedRanges` のキー集合 == `semanticSlotDefinitions`(スロット registry)が使う sourceKind 集合(Set の `toStrictEqual`)。→ 新 sourceKind 追加時に JSON 未更新なら赤、orphan キーがあっても赤。
2. **値同期**: 各 `normalizedRanges[sourceKind]` == `semanticSlotNormalizedRange(sourceKind)`(TS)。→ JSON が TS の値域 source-of-truth から黙って陳腐化したら赤。

追加 import は `semanticSlotDefinitions`/`SemanticSlotSourceKind`(`../../live-mapping/semantic-slot-definitions`)と `semanticSlotNormalizedRange`(`../semantic-slot-normalized-range`)。いずれも器内(vessel)参照で、方向検査(魂↔器)には無関係。**契約テスト 6→8 tests、全緑**。typecheck PASS。

---

## 5. degraded data源の等価性不変条件の記録(E-5)

`implementation/screens/c4-channel-diagnostics.md` §3 に追記:
- degraded 6面の解消は実装上 **physiology availability(`drivenByPhysiology`)を単一 data源**とする(channel status を無関係ページに通さない過結合回避)。
- これは「**自律ホストでは physiology と channel が常に共在**(両者とも自律composer でのみ生成、トラッキングでは両者不在)」という**構成上の不変条件**に依存し、v0 で成立するため両者 availability は等価。
- **回帰防止メモ**: 将来「physiology 有・channel 無」(逆)のホスト形態が現れたら等価性が破れ、degraded の data源を各サブシステム個別 availability へ分離する見直しが要る(Domain C Lane2 観点6・質問2 由来)。

---

## 6. v0 繰延事項の follow-up 記録(E-6)

`implementation/waves/c4/c4-followup.md` を新規作成(c3 `domain-f-followup.md` 流儀を参考)。記録した v0 繰延6件:
1. **Recent Events の rejected 行 slotId**(dispatch に logSlotId 追加が要る。Domain C 報告§10-3)。
2. **Recent Events の connected 行 client IP**(mockup は `client 127.0.0.1`。Domain C Lane1)。
3. **複数接続のフルサポート**(per-connection overlay 帰属・優先規則。C5以降。Domain A/B/C)。
4. **封筒 `v`(protocol版)検証の所在**(実物の魂が版を送る日。Domain A Lane1 non-blocking 2)。
5. **契約 JSON の物理配置の昇格**(packages/contracts 等。実物の魂の日。裁定8)。
6. **Stage Presence とチャネルの結合可否**(C5 精緻化。Domain B 報告§8 質問1。**⚠ Undine の方向確認事項**として併記=結合するか否かは設計判断で C5 着手前に裁定を要する)。

加えて §7 に「Domain E で回収済み(繰延ではない)」3件(exchange note 実語彙化・normalizedRanges 同期テスト・degraded 不変条件記録)を完全性のため併記。

---

## 7. 手動確認メモ(E-7、§7 の4項目。機械ゲート通過後の人間の一目。美的判定ではない)

前提: 自律ホストで runtime-player を起動し、機械ゲートが緑であること(本報告 §1)。

**参照ドライバ起動コマンド**(依存ゼロ `.mjs`、素の Node 22 で直実行):
```
node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:17310/channel?token=<token>"
```
`<token>` を含む完全な URL は **Channelページの `Copy Channel URL`** で取得する(`Open Channel` 後にのみ表示)。token は URL の構成要素としてのみ露出する(それ以外の秘匿は renderer に流れない)。

確認手順(4項目):
1. **外部駆動でモデルが動く**: 自律ホストで Channelページを開き `Open Channel`(起動時は必ず Closed)→ 状態が Open(no client)へ。上記コマンドで参照ドライバを起動(URL は Copy Channel URL の値)→ Connected(protocol 1)になり、**モデルの頭・視線等が外部駆動で動く**のを見る。
2. **Active overlays とイベントログ**: Channelページの **Active overlays** に残TTLつきでスロット(`head-horizontal` 等)が並び、**Recent Events** に受理(✓)/拒否(✗+拒否コード)が流れるのを見る。
3. **ドライバを殺す→生理基底へ**: 参照ドライバのプロセスを終了(Ctrl-C 等)→ 切断で全 overlay が失効し、**体が生理の基底へ落ちる**のを見る(粗いオーバーレイのスナップは C4 の減点対象外。滑らかさは C5)。
4. **トラッキングホスト側の品位**: トラッキングホストで Channel/Input/Mapping ページが**品位ある空状態**(一文の通知)であること、Header が自律で `Drive: Physiology`・トラッキングで従来表示であることを一目。

---

## 8. 作成/変更ファイル一覧(絶対パス)

**変更(既存内容の小整合修正、挙動不変)**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\contract\channel-exchange-examples.json` — happyPath note の `face.angle.x` → `head-horizontal`(note 文言のみ)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\contract\channel-protocol-contract.test.ts` — normalizedRanges↔TS 同期テスト2件 + import 2行を追記(既存6テストは無改変)。

> 上記2ファイルは Domain A が作成した未追跡ディレクトリ `control-channel/` 内にあるため、`git status` 上は当該ディレクトリの `??`(未追跡)に含まれて表示される。

**docs 変更(discussion)**:
- `C:\...\discussion\ai-cohost\implementation\orchestration\c4-wave-plan.md` — §1 Status を実装完了状態へ。
- `C:\...\discussion\ai-cohost\concept\mvp-boundary-amendment.md` — §6 に方向検査の実体化完了段落。
- `C:\...\discussion\ai-cohost\implementation\screens\c4-channel-diagnostics.md` — §3 に degraded data源の構成不変条件。
- `C:\...\discussion\ai-cohost\_map.md` — C4 実装完了(手動確認待ち)反映。
- `C:\...\discussion\ai-cohost\implementation\_map.md` — C4 行追加・次の行動更新。

**新規(follow-up + 本報告)**:
- `C:\...\discussion\ai-cohost\implementation\waves\c4\c4-followup.md` — v0 繰延6件。
- `C:\...\discussion\ai-cohost\implementation\waves\c4\domain-e-report.md` — 本報告。

**無変更(絶対条件、機械確認済み)**: `pnpm-lock.yaml`・`pnpm-workspace.yaml`・`apps/editor/`・`packages/package-format/`・Runtime Export schema・`apps/runtime-player/src/main/physiology/` 配下(golden 3本含む)・`headless-slot-resolver.ts`。`apps/soul` に package.json 無し。Domain A〜D のロジックファイルは全て無変更(control-channel サーバ/contract/store/validation/config/port、heart overlay seam、bridge・ページ・degraded・合成根配線、特区・参照ドライバ・方向検査スクリプト)。

---

## 9. 裁量判断・質問・escalate

**裁量判断**:
1. **exchange note の文言**: 「Turn the head via the head-horizontal slot for 800ms.」とした(実語彙 `head-horizontal` を自然な英文に埋める。Lane1 の「note を head-horizontal 表記に統一」指針に沿う)。payload/schema/TS 型は不変。
2. **normalizedRanges 完全性テストのアンカー**: 列挙可能な source として `semanticSlotDefinitions`(実スロット registry)を採用(`SemanticSlotNormalizedRange` は関数で列挙不可のため)。現状 9 sourceKind が全て定義で使用され JSON キーと一致するため緑。新スロット追加時に JSON 未更新なら赤くなる防波堤として機能する。
3. **_map.md の完全閉鎖表記を使わなかった**: C4 は人間の一目確認(§7)未通過のため。C3 の実装完了時点の流儀「実装完了・機械ゲート緑・手動確認待ち」に合わせた(過度な書き換え回避)。
4. **c4-followup.md の配置**: `waves/c4/` 直下(既存 c3 `domain-f-followup.md` は `waves/c3/` 直下。同流儀)。ファイル名は task 例示の `c4-followup.md` を採用。

**質問(Orch/Undine 判断が要る点、blocking なし)**:
1. **follow-up 6 の Stage Presence×チャネル結合可否は Undine の方向確認事項**(Domain B 報告§8 質問1 由来)。C4 は非結合で閉じたが、C5 の合成精緻化に入る前に「チャネルが body-x を上書きしたら Stage も動くべきか」の Undine 裁定を要する。follow-up に⚠付きで記録済み。C4 の閉鎖判定自体は妨げない。
2. **discussion _map.md 群の更新**は本 task E-3「必要なら…C4 完了反映(やり過ぎない)」の範囲で行ったが、discussion memory 構造の権威更新(完全閉鎖の確定記録)は**人間の一目確認合格後**に別途行うのが C1〜C3 の流儀。現状は「手動確認待ち」で留めている。この温度感で問題ないか確認されたい。

**escalate**: なし。既知 baseline 以外の fail は観測されず(Domain A〜D の統合起因の fail はゼロ)。docs 更新で設計判断を要する矛盾も発見せず。挙動を変える修正は不要だった(統合・検証・docs・note/テストの小整合のみ)。

---

## 10. ループ2追記(件数整合 821→823、docs のみ)

clean review(Lane-A)指摘: normalizedRanges 同期テスト2件の追加で全体テストが 821→823 になったが、Status 行2箇所が Domain D 時点の **821 passed** のまま陳腐化していた。数値のみ整合(緑/fail の実態・既知baseline は不変):
- `implementation/orchestration/c4-wave-plan.md`(§1 Status 機械ゲート行): `821 passed / 2 failed` → `823 passed / 2 failed`(既知baseline Wave21 browser-source系2件は不変、と明記)。
- `implementation/_map.md`(次の行動4 の C4 行): `821 passed/2 failed` → `823 passed/2 failed=既知baseline Wave21 browser-source系2件`。

本報告 §1・§4 は当初から 823 で正。履歴的記述(§1 の Domain D=821/2、§4 件数連続性「821 + 2 = 823」)は Domain D 時点の事実として正しいため不変。コード・テスト・fixture・他ドメインのロジックは無変更、lockfile 無変更・`pnpm install` 未実行。
