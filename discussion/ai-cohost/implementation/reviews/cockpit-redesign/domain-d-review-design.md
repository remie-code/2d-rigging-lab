# 操縦席UI改定 Domain D レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph（操縦席UI改定wave実行責任者）。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: Domain D「統合+docs+人間ゲート手順書（最終ドメイン）」= `src/cockpit/cockpit.html`（27 行への書き換え）+ `cockpit-page.test.mjs`（新 4 本）+ `ui/settings-drawer.mjs`（D-4 id 付与）+ `ui/header.mjs`（D-4 デッドコード削除）+ docs 3 点（apps/soul/README.md・waves/cockpit-redesign/human-gate.md・同 followup.md）。
> 観点: **撤去の完全性**と**人間ゲートへの滑走路の質**。Gnome 成果物 domain-d.md の主張を転記せず、旧 cockpit.html を git HEAD から取得して全識別子（id 37 種・関数 32 種+byId・CSS セレクタ約 85 種）を機械抽出し、新 cockpit.html・ui/・view-logic/ への残存/依存を自分で走査し、docs 3 点を全文精読し、テストを自分で実行して確認した。
> 総合判定: **PASS**（blocking なし。non-blocking 3 件＝いずれも記録のみで足りる軽微事項）。**機械側の滑走路は完成——残るは人間ゲートのみ。**

---

## 0. 自分で再実行した機械ゲート・sha256 検算（生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 676` `# pass 676` `# fail 0`（1 回で緑・1.5s）。Orch 確定ベースライン 676/676 と一致。

個別実行（明示ファイル指定・いずれも 1 回で緑）:
- `cockpit-page.test.mjs` → **4/4**（新 page test）。
- `cockpit-server.test.mjs` → **74/74**（背骨=ワイヤ契約 16+13+6 の無退行を自分で確認）。
- `cockpit-ui.test.mjs + cockpit-static-assets.test.mjs` → **40/40**（30+10・D-4 の 2 修正で無退行）。

**sha256 検算**: domain-d.md §1 の申告 7 ファイル（cockpit.html `d11a5768…` / cockpit-page.test.mjs `7fbb5613…` / settings-drawer.mjs `23d0650e…` / header.mjs `63ae43a9…` / README `7caeb134…` / human-gate.md `d37c803e…` / followup.md `0be83fb5…`）を自分で計算し**全 7 一致**。レビュー対象＝申告物の同一性を確認した。

## 1. 撤去の完全性（最重要） — PASS（残存識別子ゼロ・依存切れゼロを機械走査で確認）

**走査方法**: `git show HEAD:apps/soul/agent/src/cockpit/cockpit.html`（913 行）から旧資産の全識別子を機械抽出——(a) 全 id 属性 **37 種**（audio-device-select〜vision-target-status）、(b) 旧 IIFE の全関数宣言 **32 種**（addBargeInMarkerRow〜subscribe・domain-d.md §0 の「関数 32」と一致）+ `byId` ヘルパ（var 宣言）、(c) 旧 `<style>`（:7-146）の全セレクタ **約 85 種**（#btn-* 6・.row 系・.channel-status.* 等）。

- **順方向（旧→新の意図しない残存）**:
  - 新 cockpit.html（27 行）に旧 id 37 種の残存 **0 件**・旧関数名 33 種（byId 込み）の残存 **0 件**・旧セレクタ系（.row/.channel/.chat-status/.hstat/.dot/#btn-*/#timeline/.fire/.mic/.vision/.ears/.health/.soul-state/.timeline-section）の残存 **0 件**（いずれも grep 全種一括で確認）。新 HTML の id は `app` のみ。
  - ui/*.mjs + view-logic/*.mjs への旧関数名ヒットは**全て対応行コメント**（`applyState :265-284` 等の移植元記録＝意図的な根拠化）で、**実コードでの旧 API 使用は 0 件**。コピー忘れの旧コード断片は存在しない。
- **逆方向（新→旧の依存切れ）**: ui/ + view-logic/ 全体へ `getElementById|byId\(|querySelector|innerHTML` を grep → 実質 **0 件**（app.mjs:254 はコメント・styles.mjs:376 は引数 `doc` 経由の COCKPIT_STYLE_ID 冪等チェック＝自分の注入 style の確認であり旧 DOM 参照ではない）。C レビュー §0 の確認が **D 変更後（settings-drawer/header の 2 修正後）も維持**されている。新 UI が撤去された旧 DOM/id/CSS に依存する箇所はゼロ。
- **id 重複の解消（C レビュー §9-1 の核心）**: 新 UI が自ら生成する id（channel-url/chat-source/device-select/audio-device-select/vision-target-select——D-4 で 3 つ増えた）と衝突しうる旧 DOM は上記のとおり完全撤去済み。document 内 id は `app` + 新 UI 生成のみで重複ゼロ。「一気に完全撤去・段階移行不可」の裁定どおりの一発切り替えが実現している。
- domain-d.md §0 の撤去一覧（旧 style :7-146・旧 DOM :148-234・旧 IIFE :235-911）は旧ファイルの実行範囲と一致（IIFE 開始 :239 `(function () {` を実測・:235 は `<script>` タグ）。行番号の丸めは撤去の完全性に影響しない。

## 2. 前任（domain-c-review-design.md §9）の D 申し送り 6 点の消化検証 — PASS（全点消化）

1. **一気に完全撤去（必須）— 消化**。§1 のとおり機械走査で残存ゼロ・id 重複ゼロ。新 HTML は `<div id="app">` + inline module 2 行のみ（申し送りの指定形そのもの）。
2. **人間ゲート手順書の必須項目 — 消化（全項目照合済み）**。§5-1 に詳細。C §9-2 の列挙（Fire busy→復帰 / --channel なし 503 文言 / 自発トグル ON/OFF / Channel Set 後クリア / source 復元・入力中非復元 / Disconnect dead 無効 / lastDevice 初期選択 / Refresh 2 種 / 初回展開・二回目直行 / **口数 no-op の義務明記** / §8-3 トグル微差 / B §7-2 hooks 実挙動 4 種）を human-gate.md の当該節と 1 点ずつ突き合わせ、**全点実在**。
3. **header.mjs デッドフォールバック削除 — 消化・影響ゼロの前提も自分で検証**。B レビュー non-blocking 1 の原記述（`healthStatusView(...) || { text:"unknown", … }`）が削除され、削除根拠コメント（header.mjs:38-40）に置換。前提「null 経路は実到達しない」を自分で裏取り: health.mjs:44 に `if (!h) return null` はあるが、app.mjs:96 `useState(initialHealth)`（常に truthy 構造体）+ :116 `mergeHealth(prev, s.health)`（欠落は前値保持・`if (!next) return prev`）により Header へ渡る `health.whisper/ffmpeg` は常に構造体。B レビュー自身も「到達しても表示は割れない」と評価済みで、削除は二重に安全。ui 30/30 無退行が実証。
4. **SettingsSelect id 付与（任意）— 消化・for/id 対応の正しさ確認**。id prop 追加（settings-drawer.mjs:67・:69 `<select id=${id}`）+ 3 呼び出し（:376 device-select・:391 audio-device-select・:409 vision-target-select）。label `for` 5 組（channel-url/chat-source は input 側に元から id）**全てに対応 id が実在**＝宙吊りゼロ・旧実装の a11y 保存。id 未指定呼び出し（cockpit-ui.test.mjs:474）は `id=undefined` → preact は属性を出力しないため無害（既存 props への後方互換な追加）。
5. **mount 最薄 — 消化**。新 HTML の inline module は domain-b.md §2 の想定コード（`import { mount } from "./ui/app.mjs"; mount(document.getElementById("app"));`）と一致。options 省略＝globalThis 既定・uiRootPath 既定。引数は rootElement のみ。
6. **inline module 非抵触+自己完結の読み替え — 消化**。新 page test (3) が `<script src>` 禁止を維持しつつ「外部ネットワーク非依存」（http(s) src/href・外部 stylesheet・@import・外部 URL import の禁止）へ読み替え（wave-plan §2 どおり）。

## 3. FOUC 対策の正当性 — PASS（二重管理は 2 値限定・注記実在・値一致を実測）

- cockpit.html:12-13 の複写値（`--bg` 相当 `#0e1114` / `--fg` 相当 `#e7eaee` / `color-scheme: dark`）を styles.mjs の正本（:30 `color-scheme: dark` / :32 `--bg: #0e1114` / :36 `--fg: #e7eaee`・body は :63-64 で var 参照）と自分で照合し**一致**。
- 注記コメント実在（cockpit.html:8-11）: 正本が ui/styles.mjs であること・複写が 2 値に限定されることを明記。二重管理の存在と範囲が現地で読める。
- **乖離リスクの評価: 許容範囲**。styles.mjs 側の値変更時に HTML 側が古い値のまま残っても、影響は「module 解決〜mount の一瞬だけ旧色が見える」のみで、mount 後は注入 CSS（正本）が必ず勝つ——機能影響ゼロ・自己修復的。B レビュー §5 の「mount 時注入は render 前で FOUC の構造的余地なし」は styles 注入以後の話で、D の対策は**それより前（module fetch 中）の白背景**を塞ぐ別レイヤ＝役割が重複せず正当。値一致の機械固定が無い点は non-blocking 1 に記録。

## 4. 新 page test 4 本の設計 — PASS

- **「見た目はテストしない」の規律維持**: 4 本とも構造（div#app・inline module）・不在（死コード・外部依存）・配線（実 HTTP 縦経路）のみを固定し、色・レイアウト・表示文字列には一切触れない。見た目は人間ゲートへ正しく分離。
- **現物駆動の頑健性**: (4) 起動配線スモークは HTML から**実 import specifier を正規表現抽出して辿る**（ハードコードでない）→ /ui/app.mjs（200+text/javascript）→ app.mjs の実 import 文から vendor 到達（200+非空）まで縦に確認し、`server.close()` で shutdown まで一巡。specifier 変更時は抽出 assert が先に落ちて理由が読める（沈黙の追従はしない）。ui 相互の import 閉包と全ファイル配信は cockpit-ui.test（readdir 走査）+ static-assets test が既に固定済みで、代表縦経路 1 本に絞った判断は責務重複を避けて正しい。
- **死コードゼロテスト（L0 裁定 3 で歓迎済み・指示外の裁量 1 本）の代表識別子選定: 妥当**。`byId\(` + id 6 種（新 UI と衝突する入力群 3 = channel-url/chat-source/device-select + 領域代表 3 = timeline/btn-fire/footer-uptime）+ セレクタ 2 種（.row.ghost/.channel-status.connected = styles.mjs と同名衝突する群の代表）。**見逃し側**: 「旧 DOM を戻す」規模の事故は入力群か timeline を必ず含むため捕捉される（1 行だけ戻す変更は事故でなく意図的変更＝テスト更新が要る正しい壊れ方）。**誤検知側**: 将来 HTML コメントに旧識別子を書いた場合のみ発火——それも「旧資産への言及に意図確認を促す」正しい方向。`document.getElementById("app")` は `getElementById\("timeline"\)` に非マッチで現行と干渉しない。楔として機能する。
- **旧 30 本の対応表のヘッダコメント恒久記録**: 30 本 1:1 で新固定先が書かれ、旧 17（Set 後クリア=hooks 実挙動）だけ人間ゲート送り・旧 26（new Function 駆動）は「駆動しないと検証できない構造が消えた」という整理（domain-d.md §7-2）——検証対象そのものが純関数になった以上、fixture の方が直接的で忠実度は落ちていない。同意する。

## 5. docs の質 — PASS

### 5-1. human-gate.md: 「ユーザーが 1 人で迷わず実行できる」水準にある

- **起動**: §1 に 1 コマンド（`npm run cockpit --prefix apps/soul/agent`）+ URL + 「真っ白のまま止まらない/コンソールに module 解決エラーなし」という失敗の見え方まで明記。
- **確認順序**: §2 見た目→§3 導線→§4 設定→§5 運転→§6 観測の順は依存関係を織り込み済み（§4-1 マイク Start が §5-1 Fire の前提・§4-4 視界が §5-3 の前提・§5 の操作で §6 の行種が自然に出る設計）。§0 に「§1〜§3 は器なしで確認可」の省力注記もある。
- **期待結果の具体性**: 全項目チェックボックス+具体文言レベル（`fired (N lines, M chars injected)`・`fire not available (start cockpit with --channel)`・`enter a stream URL / video ID first` 等）。§3-1 の**設定ファイル退避方式**は退避→確認→戻すまで往復で書かれ、実運用の記憶を壊さない。
- **既知差分の明示**: §8 に 4 点（thinking はフィードに出ない=運転バー側・口数 no-op・KILL 押せない・計器の .feed-meta 集約）——「FAIL ではない」と裁定根拠付きで先回りし、誤 FAIL を防ぐ。§9 に切り分け（落ちるのは hooks 実挙動か視覚意匠のどちらか・機械固定済み領域の列挙）。
- **L0 義務**: 口数 no-op の明記（§5-5「仕様であり故障ではない」）・KILL は「押せてしまったら FAIL」と逆方向の検査まである。実配信・実 YouTube 不要の明記（§0・§7 分離）も wave-plan §5 どおり。
- 軽微な注意 1 点のみ: §4-5 の「Disconnect dead 無効」は非接続時 disabled（同一経路 chatView.disconnectDisabled）で近似確認し、dead 終端の実確認は §7 任意へ分離——機械側で dead fixture が固定済み（status.test）なので合理的な省力化。

### 5-2. followup.md: 委任列挙の全項目が実在+各項目に着手トリガ

口数（§1・**s6-followup §12 が正=ポインタのみで二重管理しない**）/ KILL=S8（§2）/ linkedom 梯子（§3・トリガ「hooks 起因の退行 2 回以上」が定量的）/ UI 分割方針（§4・view-logic 規律の将来 wave への継承＝inventory §4 L0 決定 5 の恒久化・S8 KILL が試金石と明記）/ 行保持無制限（§5・B §8-10）/ lastDevice 判定外（§6・C §8-4・解消=ワイヤ契約変更とセットの注記付き）/ thinking 行追撃（§7・実装方法まで書かれた着手可能な粒度）/ レビュー non-blocking 残（§8・**D 解消 2 件（B-1/C-1）の明記+恒久受容 6 件の再掲**——B-2 が C で解消済みの記録も正確）。「トリガが来るまで寝かせる」の宣言が台帳の役割（先回り防止）を自己文書化している。完全。

### 5-3. README: 新構成との一致を実物照合

- ui/ 7 ファイル（app/header/feed/rows/styles/control-bar/settings-drawer）= 実ディレクトリと一致。配信 3 サブツリー（/vendor・/ui・/view-logic のみ）= cockpit-server.mjs:77 `UI_ASSET_SUBDIRS` と一致。server test 74 本・起動コマンド不変・凍結 vendor・devDep ゼロ——全て実測/実物と一致。
- S2.5「画面」項の刷新注記は「以下は当時の記録・機能は全て新 UI に保存」の 1 行挿入に留め、S3〜S7 の歴史記述は不変（domain-d.md §7-5 の裁量）——歴史の書き換え最小の原則に適合し、現在形の構成は新小節が引き受ける分担が明快。

## 6. wave 全体構造の最終評価（Orch 完了報告の材料） — 「認知負債として積み上がらない」構造は達成

4 ドメイン積層後の最終形を総評する（inventory §4 L0 決定 5 =「機能追加の認知負債として積み上がらないこと」への適合判定）:

- **層の分離が物理で強制される形になった**: vendor（凍結 1 ファイル・サードパーティのみバンドル）/ view-logic（9 モジュール+9 テスト・preact 非依存純関数・fixture 53 本=保存オラクルの表示側固定点）/ ui（IA 区画ごと 7 ファイル・hooks 非使用の葉部品に描画を寄せる分業）/ エントリ（27 行・mount 2 行）。旧 913 行単一ファイルで「表示ロジックが HTML に埋没し regex でしか固定できなかった」構造が、**置き場が構造で決まる**形（表示導出→view-logic・新行種→rows.mjs 単一経路・肥大→区画内分割）へ転換され、その規律自体が followup §4 として将来 wave へ継承される文書になっている。
- **テスト構造の責務分離**: server 74（ワイヤ契約=不変オラクル・本 wave で 1 バイトも動かず）/ view-logic fixture 53（表示同値）/ ui 30（vnode 走査+CSS 意匠+readdir 構造）/ static 10（配信）/ page 4（エントリ層の新契約）——5 層が重複なく積み、旧 30 本の消滅は 1:1 対応表で説明責任が果たされた（総本数 702→676 の減少は「regex でしか触れなかった検証対象が既に fixture へ移管済み」の帰結で、固定点の総量はむしろ増えている: 新規 fixture/vnode 93 本+page 4 本）。
- **制約の完走**: ビルド段ゼロ（ソース=実行物・起動 1 コマンド不変）・新規 npm 依存ゼロ・devDep ゼロ・lockfile/package.json/器コード/契約 JSON 不変・S2.5 単一 HTML 思想の「本当の制約」（外部ネットワーク非依存）はテストで機械固定に読み替え。**機械で固定できる領域は全て固定済みで、人間ゲートに残る領域（hooks 実挙動・視覚意匠）が手順書 §0 に正直に列挙されている**——ゲートで落ちた場合の診断可能性まで設計されており、滑走路の質として申し分ない。
- 唯一の構造的留保は既知のとおり **hooks 実挙動の機械検証が空白**であること（devDep ゼロの意図的トレード）。ただし駆動口（mount の DI 3 点）と導入トリガ（followup §3・2 回ルール)が用意済みで、「空白の管理」まで設計に含まれている。受容済みリスクとして妥当。

## 7. blocking / non-blocking の総括

**blocking: なし。**

**non-blocking（3 件・いずれも記録のみ・再委任不要）**:
1. **FOUC 複写 2 値の一致が機械固定されていない**: page test は FOUC 注記コメントの存在のみ固定（:117）で、`#0e1114`/`#e7eaee` が styles.mjs と一致することは検査しない。乖離しても影響は mount 前の一瞬の色ズレのみ（§3）＝実害極小。値照合 assert 1 本で閉じられるが、2 値限定の二重管理への過剰固定とも言え、必須ではない。記録のみ。
2. **SettingsSelect の id 付与が機械固定されていない**: cockpit-ui.test の SettingsSelect vnode テスト（:469-474）は id なし呼び出しのままで、D-4 の label for/id 対応を固定するテストは無い。退行しても label クリックのフォーカスが飛ばなくなるだけ（機能無影響・元々 C の non-blocking だった水準へ戻るのみ）。記録のみ。
3. **死コードゼロテストの `byId\(` は将来のコメント記述で誤発火しうる**（§4）——ただし「旧資産への言及に意図確認を促す」正しい方向の発火であり、楔の仕様の範囲。記録のみ。

## 8. 人間ゲート / followup への申し送り

1. 人間ゲートは human-gate.md の手順どおりで**追加の確認項目は不要**（C §9-2 の必須項目全点+B §7-2 の hooks 4 種の実在を照合済み・§5-1）。
2. domain-d.md §7-1 の `<title>` 裁量（「こーでぃー — Soul Cockpit」）は page test が title を固定していないため、好みの 1 行修正で機械側の追随不要——手順書 §2 のチェック項目とだけ連動する点に留意（title を変えたら手順書の当該行も 1 行直す）。
3. §7 の non-blocking 1・2 は、人間ゲート後に page test / cockpit-ui.test へ各 1 assert 足す軽作業として followup §8 系譜に載せてもよい（載せなくても実害なし）。

## 9. Orch への申し送り（完了報告の材料）

1. **撤去の完全性は機械走査で確認済み**: 旧識別子（id 37・関数 33・セレクタ約 85）の新資産への意図しない残存ゼロ・新資産から旧資産への依存切れゼロ・id 重複ゼロ（§1）。C レビュー §9-1「一気に完全撤去」の条件は満たされた。
2. **前任 D 申し送り 6 点は全点消化**（§2）。B/C レビュー non-blocking のうち D 解消 2 件（B-1/C-1）の実装も正しさを個別検証済み。未消化・変形消化はない。
3. **機械ゲート数字は全て自分で再実行して一致**: 676/676・page 4/4・server 74/74・ui+static 40/40。sha256 全 7 ファイル検算一致（§0）。
4. domain-d.md §7-4（header.mjs 変更前 sha256 が再構成値）は検証不能だが、変更内容が B レビュー non-blocking 1 の原記述と一致し・ui 30/30 無退行が影響ゼロを実証するため、実害なしと判定（正直な明記の姿勢も適切）。
5. **wave 全体の構造総評は §6 のとおり**——「機能追加の認知負債として積み上がらない」構造（L0 決定 5）は達成。本 wave の機械側作業はこれで完了水準にあり、**残る唯一の関門は人間ゲート（choke point）**。

---

**総合判定: PASS。** blocking なし。撤去は機械走査で完全・人間ゲートへの滑走路（手順書・台帳・README・切り分け設計）は「ユーザーが 1 人で迷わず実行できる」水準にある。non-blocking 3 件は記録のみで足り、本 Domain の再委任は不要。
