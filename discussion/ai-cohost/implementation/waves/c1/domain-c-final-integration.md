# C1 Domain C: 最終統合 / 検証 / docs / 手動ゲート手順書 — レポート

> 実装者: Gnome(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。対象: `apps/runtime-player`(pnpm monorepo, Windows / PowerShell)。
> Source of truth: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §8/§9/§10、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §7、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md)。
> 前提: Domain A / B とも 3 レーン Review-Sylph PASS(blocking ゼロ)。作業ツリー変更は未コミット。Domain C は**統合・検証・docs のみ**(source 新規実装なし、レビューは行わない)。

## 判定: **completed**

モノレポ検証(typecheck / focused / 全体スイート)を再実行し証拠を取得。全体スイートの失敗は**既存 baseline 2 件のみ・新規失敗ゼロ**(C1 と無関係、Wave21 `effectiveDynamicsTuning` 由来)を独立に再確認。無変更境界(Editor / packages / package-format schema / Runtime Export schema / lockfile)を git で確認。パッケージ版手動ゲート手順書(8 項目 + ビルド手順)を作成。実装事実を docs / maps へ反映(未合意 UX 方針は確定せず §14 上位判断待ちへ回した)。escalate 該当なし。

---

## 1. モノレポ検証(実出力)

コマンドはワークスペース既存流儀(`apps/runtime-player/package.json` scripts)に合わせた。**`pnpm install` は不実施**。

### 1.1 typecheck(runtime-player)

```
cd apps/runtime-player
npx tsc --noEmit -p tsconfig.json
→ TYPECHECK_EXIT=0   (出力なし = PASS)
```

### 1.2 typecheck(モノレポ root、既存流儀の確認)

root `package.json` の `typecheck:root` = `tsc --noEmit`。既存 node_modules で回った:

```
cd <repo root>
npx tsc --noEmit
→ ROOT_TYPECHECK_EXIT=0   (出力なし = PASS)
```

> root typecheck は runtime-player を直接カバーしないが、C1 変更でモノレポ全体の型が壊れていないことの確認。`pnpm install` 不要で回った(escalate 不要)。

### 1.3 focused(Domain A + B 対象)

```
cd apps/runtime-player
npx vitest run -c vitest.config.ts \
  src/main/profile-slots src/main/role-composition \
  src/main/broadcast-source/browser-source-config-store.test.ts \
  src/main/window-management/window-title.test.ts \
  src/main/window-management/runtime-player-tray-menu.test.ts \
  src/main/window-management/browser-window-options.test.ts \
  src/main/placeholder-action-state.test.ts \
  src/control/control-window-shell.test.ts \
  src/main/stage-view-bridge-handlers.test.ts
```

実出力:

```
 ✓ src/main/profile-slots/slot-name.test.ts (7 tests)
 ✓ src/main/window-management/runtime-player-tray-menu.test.ts (6 tests)
 ✓ src/main/placeholder-action-state.test.ts (6 tests)
 ✓ src/main/profile-slots/slot-lock.test.ts (6 tests)
 ✓ src/main/profile-slots/legacy-adoption.test.ts (5 tests)
 ✓ src/main/window-management/window-title.test.ts (5 tests)
 ✓ src/main/window-management/browser-window-options.test.ts (5 tests)
 ✓ src/main/role-composition/role-selection-stub.test.ts (3 tests)
 ✓ src/main/broadcast-source/browser-source-config-store.test.ts (7 tests)
 ✓ src/main/profile-slots/slot-preferred-port.test.ts (4 tests)
 ✓ src/main/profile-slots/role-launch-resolution.test.ts (13 tests)
 ✓ src/main/stage-view-bridge-handlers.test.ts (25 tests)
 ✓ src/control/control-window-shell.test.ts (2 tests)
 ✓ src/main/role-composition/input-subsystem.test.ts (4 tests)

 Test Files  14 passed (14)
      Tests  98 passed (98)
 FOCUSED_EXIT=0
```

> Domain A の focused 42 件 + Domain B の focused 56 件 = 98 件、全 pass。Domain A/B レポートの主張と一致。

### 1.4 全体スイート(runtime-player)

```
cd apps/runtime-player
npx vitest run -c vitest.config.ts
```

実出力(要約 + 失敗詳細):

```
 ❯ src/main/broadcast-source/browser-source-server.test.ts (16 tests | 1 failed)
   × Runtime Player Browser Source server > serves current Runtime Export payload to authorized Browser Source clients
 ❯ src/stage/browser-source/browser-source-server-message.test.ts (6 tests | 1 failed)
   × readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape
 FAIL src/main/broadcast-source/browser-source-server.test.ts > ... > serves current Runtime Export payload to authorized Browser Source clients
 FAIL src/stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape
 Test Files  2 failed | 100 passed (102)
      Tests   2 failed | 534 passed (536)
 FULL_EXIT=1
```

失敗詳細(baseline の本体):

```
→ expected { status: 'not-loaded', …(5) } to strictly equal { status: 'not-loaded', …(4) }
AssertionError: expected { status: 'not-loaded', …(5) } to strictly equal { status: 'not-loaded', …(4) }
- Expected
+ Received
+   "effectiveDynamicsTuning": null,
```

### 1.5 既知 baseline fail の明示と独立検証(新規失敗ゼロの証拠)

失敗は **2 件のみ**、いずれも Runtime Export 応答の **`effectiveDynamicsTuning`**(Wave21 Dynamics Tune 系)フィールドの source-vs-test ドリフト:

- `src/main/broadcast-source/browser-source-server.test.ts` > "serves current Runtime Export payload to authorized Browser Source clients"
- `src/stage/browser-source/browser-source-server-message.test.ts` > "accepts the not-loaded response shape"

**C1(Domain A/B)と無関係である独立証拠**(私が再取得):

1. **失敗の中身が `+ "effectiveDynamicsTuning": null`**(上記 diff)= 既知 baseline の記述と一致。テスト名も Domain A/B レポート・3 レーンレビューの記述と完全一致。
2. **両 baseline ファイルは C1 の working diff に不在**: `git diff --name-only | grep browser-source-server` → `NEITHER FILE IS IN THE C1 WORKING DIFF`。両ファイル(`broadcast-source/browser-source-server.ts` / `stage/browser-source/browser-source-server-message.ts`)は C1 で**未変更**。
3. **両ファイルの最終変更は Wave21 コミット**: `git log --oneline` → `356959c [modify]dynamicsまで対応した.`(Dynamics Tune 実装)。C1 ブランチ作業より前。
4. 件数整合: Domain A 時点 519 → Domain B で 536(focused/影響テスト増分)→ 本検証も 536、失敗は 2 件で据え置き(新規失敗ゼロ)。

> **結論: C1 は回帰ゼロ**。この baseline 2 件は Runtime Export message schema 側の既存ドリフトで **C1 スコープ外**。wave plan §10「Runtime Export schema 無変更」が絶対条件のため**修正せず触っていない**(Domain A/B が git stash 対照で回帰ゼロを実証済み。本 Domain C は working diff への不在 + Wave21 由来を独立確認して裏取り)。

---

## 2. 無変更の確認(証拠)

```
git diff --name-only | grep -vE "^apps/runtime-player/src/"
→ (該当なし) = 追跡中の変更はすべて apps/runtime-player/src/ 配下
```

| 確認項目 | 結果 |
|---|---|
| Editor ソース(`apps/editor/**`) | **無変更**(`git status --porcelain` に `apps/editor/` ゼロ) |
| `packages/**`(package-format schema 含む) | **無変更**(porcelain に `packages/` ゼロ) |
| Runtime Export schema | **無変更**(export message shape は `browser-source-server.ts` / `browser-source-server-message.ts` にあり、両者とも C1 working diff に不在。§1.5) |
| lockfile(`pnpm-lock.yaml`) | **無変更**(porcelain 空) |
| `pnpm install` 実施 | **なし**(lockfile / node_modules 変化なし。electron・electron-builder は既存 node_modules に present) |
| C1 変更の範囲 | **`apps/runtime-player/src/**` + `discussion/**`(docs)に限定** |

追跡中変更(14 ファイル、すべて `apps/runtime-player/src/`。`git diff --stat`):

```
 control/control-window-app.tsx                          |   1 +
 control/control-window-shell.tsx                        |  31 +++
 main/broadcast-source/browser-source-config-store.test.ts | 76 +++++
 main/broadcast-source/browser-source-config-store.ts    |  17 +-
 main/placeholder-action-state.test.ts                   |  16 ++
 main/placeholder-action-state.ts                        |   6 +-
 main/placeholder-bridge-handlers.ts                     |   6 +-
 main/runtime-player-main.ts                             | 245 ++++++---
 main/stage-view-bridge-handlers.ts                      |  12 +-
 main/window-management/browser-window-options.ts        |  10 +-
 main/window-management/runtime-player-tray-menu.test.ts |  41 ++
 main/window-management/runtime-player-tray-menu.ts      |  11 +-
 main/window-management/runtime-player-windows.ts        |  25 +-
 preload/runtime-player-bridge-contract.ts               |  13 +
 14 files changed, 434 insertions(+), 76 deletions(-)
```

未追跡(すべて `apps/runtime-player/src/` の新規 + `discussion/` docs):

```
apps/runtime-player/src/control/control-window-shell.test.ts
apps/runtime-player/src/main/profile-slots/            (Domain A: 新規モジュール群 + test)
apps/runtime-player/src/main/role-composition/         (Domain B: 新規モジュール群 + test)
apps/runtime-player/src/main/window-management/window-title.ts (+ .test.ts)
discussion/ai-cohost/                                   (本トピックの docs 一式。C1 waves/reviews 含む)
```

> Domain A/B の未コミット変更・`discussion/` の既存変更は**保持**(revert していない)。

---

## 3. パッケージ版 手動ゲート手順書(ユーザー実施)

> パッケージ版でのみ検証できるゲート(app ready 前 `setPath` の実挙動、プロセス独立性 = 片方kill耐性、relaunch が role-resolved インスタンスを生む点)を人間観測で閉じる。**dev(`electron-vite dev`)では二重起動が renderer dev server / userData を共有するため無効**([c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) 観点8)。必ずパッケージ版(portable exe)で実施すること。

### 3.0 パッケージ版ビルド手順

前提: 既存 node_modules に electron / electron-builder が present(確認済み)。**`pnpm install` は不要**。

```powershell
# リポジトリ root から
cd apps/runtime-player

# 1) ビルド(typecheck + electron-vite build → out/)
pnpm run build

# 2) パッケージ(Windows x64 portable exe → dist/)
pnpm run dist:win
```

- `pnpm run dist:win` = `pnpm run build && electron-builder --win --x64`。`package.json` の `build.win.target = portable`(x64)、出力 `dist/`、productName `Runtime Player`。
- 生成物: `apps/runtime-player/dist/` 下に **portable の単一 exe**(既定命名は `Runtime Player 0.0.0.exe`。正確なファイル名はビルド後に `dist/` を見て確認)。
- **注意(環境依存・不明点)**: electron-builder は初回に winCodeSign / nsis 等のツールをキャッシュへ**ネットワークダウンロード**することがある(`pnpm install` ではないがオフライン環境では失敗し得る)。コード署名証明書は未設定のため portable exe は未署名で出る(SmartScreen 警告が出る可能性。手動ゲートの実施には支障なし)。この 2 点でビルドが通らない場合は、下記チェックリスト(項目1〜8)自体は完全なので、既存の他のパッケージ版があればそれで、無ければビルド環境を整えたうえで実施されたい。

### 3.1 役割つきショートカットの作り方(項目1 の具体)

portable exe は CLI 引数をアプリへ通す。2 つの Windows ショートカット(.lnk)を作る:

1. `dist/Runtime Player 0.0.0.exe` を右クリック → ショートカット作成。
2. ショートカットのプロパティ → **リンク先**の exe パスの後ろに引数を付す:
   - トラッキングホスト用: `"…\Runtime Player 0.0.0.exe" --role=trackingHost`
   - 自律ホスト用: `"…\Runtime Player 0.0.0.exe" --role=autonomousHost`
3. 2 つに分かりやすい名前(例: `Tracking Host` / `Autonomous Host`)を付ける。
   - PowerShell から起動する場合: `& ".\dist\Runtime Player 0.0.0.exe" --role=trackingHost`(同様に autonomousHost)。
   - `--profile=<slotName>` を付ければ既定スロット以外も選べる(2 窓運用では不要。省略時 `<role>-default`)。

### 3.2 チェックリスト(wave plan §8 の 8 項目 + レビュー申し送りの追加確認)

各項目、期待どおりなら ✓ を付ける。追加確認(**太字**)はレビュー / Domain A/B が実機確定を求めた点。

**項目1 — 役割つきショートカット2つを作る**
- [ ] §3.0 でパッケージ版をビルドできた(`dist/` に portable exe が出た)。
- [ ] §3.1 で `--role=trackingHost` / `--role=autonomousHost` の 2 ショートカットを作れた。

**項目2 — 扉1でトラッキングホスト起動 → 既存データが従来どおり復元(legacy 採用)**
- [ ] `Tracking Host` ショートカットで起動 → 既存モデル・profile・キャリブレーションが**従来どおり復元**される(初回のみ legacy 採用が走り、以後は冪等)。単独運用が今日と等価に動く。
- [ ] **追加確認(Domain A Q1 / レビュー lane2)**: 実効 userData が `<default userData>/slots/tracking-default/` を指し、そこに実際に `window-state/` や各種 profile が**書かれている**こと(初回起動後にこのフォルダを開いて中身を確認。root 直下の旧データは削除されず残る = 非破壊)。

**項目3 — 自律ホスト起動 → 別モデルを静止表示**
- [ ] `Autonomous Host` ショートカットで起動 → 別モデルを読み込み、**静止表示**(default pose)される。
- [ ] **追加確認**: iFacialMocap を送っても**受信しない**(自律ホストは UDP 受信器を合成に組み込まない)。トラッキングの動きが自律ホスト側に一切載らない。
- [ ] **追加確認(想定内)**: 自律 Control の Input / Mapping ページは **degraded 表示**(pending / error)になるが、**Control shell 自体は生存**する(操作でき、クラッシュしない)。これは C1 想定内で、自律 Control UX の作り込みは C4。renderer console に未処理 rejection ノイズ(N1、4 件程度)が出得るが機能に影響なし。

**項目4 — 二体並走で片方の変更がもう片方に波及しない**
- [ ] 二体を並走させ、片方で **window 位置 / mapping / dynamics tune** を変更 → もう片方に**影響しない**(スロット単位で分離)。両者を再起動しても各々の状態が保たれる。

**項目5 — Browser Source URL が二体で異なる(port/token)**
- [ ] 二体の Browser Source URL(表示 / コピー)が **port も token も異なる**(tracking-default 既定 17308 / autonomous-default 既定 17309、token はスロットごと生成)。
- [ ] **手動でポート番号を設定する画面がどこにも無い**(URL は表示 / コピーのみ)。

**項目6 — 同役割を二重起動 → 明確なエラー、既存インスタンス無傷**
- [ ] トラッキングホストを起動中に、もう一度 `Tracking Host` ショートカットで起動 → **明確なエラーダイアログ**(スロット使用中の旨。既定文言: "This profile is already in use by a running Tracking Host.")が出て 2 つ目は終了する。
- [ ] **既存(1 つ目)のインスタンスは無傷**(フレーム継続、データ破壊なし)。

**項目7 — 片方を kill → もう片方のフレームが止まらない(C1 追加ゲート、不変条件2)**
- [ ] 二体並走中、**片方をタスクマネージャから強制終了(kill)** → **もう片方のフレーム(Browser Source 出力)が止まらない**。プロセス独立性の核心ゲート。
- [ ] **追加確認(申し送り: pid 再利用 false-busy)**: kill した側の役割を**すぐ再起動** → 正常に立ち上がる(stale lock が回復される)。稀に "busy" と誤検出される場合はスロットの `slot.lock` を手動削除して再起動(将来堅牢化候補、非 blocking)。

**項目8 — 引数なし起動 → 役割選択スタブ**
- [ ] **引数なし**で exe を起動(素のショートカット / exe ダブルクリック)→ **役割選択スタブ**(素のダイアログ、ボタン= Tracking Host / Autonomous Host / Cancel)が出る。どの役割にも自動で束縛されない。
- [ ] **「次回から / 今後表示しない」チェックが無い**(恒久に玄関)。
- [ ] **追加確認(Domain B)**: 役割を選ぶと `--role=<選択>` で**relaunch** され、その役割の合成で立ち上がる(relaunch が実際に role-resolved インスタンスを生む)。Cancel で無起動終了。

---

## 4. 更新した docs 一覧と要約

| ファイル | 更新内容 |
|---|---|
| [../../screens/c1-role-skeleton.md](../../screens/c1-role-skeleton.md) | **§7.7「実装反映(C1 実装後の事実)」を追記**(§7 の Accepted 定義は非改変)。動的ウインドウタイトルの形(Control/Stage)、Header 役割バッジ(**アクセント色 tracking=teal / autonomous=violet は「実装で暫定採用」・ユーザー最終確定は未**と明記)、トレイツールチップ、役割選択スタブ = relaunch 方式、Copy Window Title が実 OS タイトルを配る点、**自律ホスト Control の degraded ページ = C4 スコープ**である旨を記録。未実装(玄関完全版 / Companion カード / 閉扉ダイアログ / トレイ役割色ドット)も明示。 |
| [../../orchestration/c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) | **末尾に「実装後の確定注記」節を追記**(本文非改変)。棚卸しが「推測」としていた点のうち実装で確定した事実 — app.setPath ready 前方式の採用、autonomousHost で UDP 不在の実現、startup status への role 相乗り、タイトル動的化、per-slot token/port、単一インスタンスロック不採用の追認、kill 耐性の手動ゲート化 — を記録。 |
| [../../orchestration/c1-wave-plan.md](../../orchestration/c1-wave-plan.md) | **§1 Status を「実装完了(Domain A/B/C)、パッケージ版手動ゲート待ち」に更新**(成果物リンク付き)。**§13「C1 実装後の申し送り(non-blocking)」を追記**(N1、pid 再利用 false-busy、legacy silent catch 診断ログ候補、防御テスト補強候補)。**§14「上位判断待ち」を追記**(下記 §5 と同内容)。 |
| [../../_map.md](../../_map.md)(implementation map) | C1 wave 完了状態・成果物リンク(waves/c1・reviews/c1)を反映。次の行動を「パッケージ版手動ゲート待ち」に更新。 |
| [../../../_map.md](../../../_map.md)(ai-cohost map) | implementation 行の Status、Current State Summary、Next Actions を C1 実装完了 + 手動ゲート待ちに更新(「実装は未着手」の旧記述を差し替え)。 |

> **未合意の新 UX 方針・新仕様は確定していない**。アクセント色は「暫定」と注記、degraded ページ解消方針は C4 へ、その他判断は §5 / wave plan §14 の上位判断待ちへ回した(planning gate へ戻す事項)。

---

## 5. Domain A/B からの上位判断待ち質問(一覧。Undine / ユーザーへ)

> 私(Gnome / Domain C)はこれらを**確定しない**。wave plan §14 にも同内容を記録済み。

1. **役割アクセント色の最終確定**: tracking=teal / autonomous=violet を実装で暫定採用(既存テーマ整合)。ブランド指定色の有無・最終確定。(Domain B 質問1)
2. **busy ダイアログ文言**: `This profile is already in use by a running <役割ラベル>.`(スロット名非露出、身元表示語彙と整合)で確定してよいか。(Domain A 質問2 / Domain B 裁量4)
3. **legacy browser-source config の port 正規化**: legacy が 17308 以外の preferredPort を永続していた場合、**現状は等価優先で legacy 値を保持**。役割既定 17308 に正規化すべきか。(Domain A 質問3)
4. **relaunch args 契約の将来拡張**: 役割選択スタブは `…argv.slice(1).concat(['--role=<選択>'])` で relaunch。玄関完全版で `--profile` も選ばせる際、この契約を拡張する前提でよいか。(Domain B 質問2)
5. **contract `windowTitle` リテラル型を表示も動的に揃えるか**: 現状は配布=実タイトル / 表示 base=定数の二層。表示側も動的化するなら型 widen の小改修が要る。(Domain B 質問5)
6. **degraded ページの暫定 `.catch` を C1 で入れるか C4 まで据え置くか**: 据え置きが design 上は素直(N1)。手動ゲートで console ノイズがゲート判断の妨げにならないか確認。(Domain B lane2 質問2)
7. **防御テスト補強を C1 でやるか後続か**: 他 store の二スロット独立性直接テスト等(wave plan §13 補強候補)。レーン3 判定は「後続で拾う / 推奨に留める」。(Domain A lane3 質問1)

---

## 6. 私自身(Domain C)の裁量判断・質問

### 裁量判断
- **docs は「追記」方針**を採った(§7.7 新設 / 棚卸し末尾の確定注記 / wave plan §13・§14 の新節)。Accepted な UX 定義本文・棚卸し本文を書き換えず、実装事実の反映に留めた(未合意 UX を勝手に確定しない指示に従う)。
- baseline 2 件は Domain A/B が git stash 対照で回帰ゼロを実証済みだが、Domain C としては別角度(working diff への**不在** + `git log` で Wave21 由来を特定)で独立に裏取りした。stash 対照は再実行していない(A/B が実施済みで、独立証拠が十分なため)。
- パッケージ版ビルドは**実行していない**(手動ゲートはユーザー実施であり、Domain C の責務は「ユーザーがそのまま実施できる手順書」を用意すること。ビルドは電力・時間・ネットワークを要し、かつ verify は人間観測に落ちるゲートのため)。ビルド手順は package.json の確定した script に基づき、環境依存の不明点(electron-builder のツール DL / 未署名 exe の SmartScreen)を明記した。

### 質問(上位判断が要る / 私が埋めなかった点)
- **Q-C1**: 上記 §5 の 7 件は私の判断範囲外。Undine / ユーザーの裁定が要る(特に §5-1 色 / §5-3 port 正規化はユーザー確認事項)。
- **Q-C2**: パッケージ版ビルドを Domain C(自動)側で一度通して portable exe の正確なファイル名まで確定すべきか、それとも手動ゲート実施者に委ねてよいか。現状は後者(手順書は完全、正確な exe 名はビルド後に `dist/` で確認と記載)。ビルド実行が望ましければ Orch-Sylph 経由で指示されたい(ネットワーク DL を伴う可能性があるため独断で走らせなかった)。
- **Q-C3**: C1 の「完全閉鎖」は手動ゲート合格 + §5 上位判断の裁定の両方が要件との理解でよいか(closed-problem 進め方 §6 の人間ゲート)。

---

## 7. Subagent Contract 遵守の自己確認

- **`pnpm install` 未実施**。回避工作なし。検証は既存 node_modules で完走(electron / electron-builder present、lockfile 無変更を git で確認)。
- **Editor ソース / packages(package-format schema)/ Runtime Export schema / lockfile 無変更**(§2 で git 確認)。baseline 2 件(Runtime Export message schema 側の既存ドリフト)は**触っていない**。
- **source 新規実装なし**。Domain C は検証実行 + docs 更新のみ(`discussion/**` の docs 5 ファイルを追記更新。`apps/runtime-player/**` のソースは一切変更していない)。
- **A/B 非破壊**: Domain A/B の未コミット変更・`discussion/` の既存変更を revert / 改変していない(§2 で working tree 保持を確認)。検証中の一時操作(git stash 等)も行っていない。
- **Runtime Export immutability 保持**(該当コード未接触)。
- **レビューは行っていない**(Domain C の責務は統合・検証・docs。レビューは別コンテキストの Review-Sylph が Domain A/B で実施済み・PASS)。
- **未合意 UX 方針を確定していない**(暫定注記 / C4 送り / §5・§14 上位判断待ちへ)。
