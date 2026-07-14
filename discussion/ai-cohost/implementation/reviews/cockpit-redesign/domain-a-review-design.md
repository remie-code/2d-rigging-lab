# 操縦席UI改定 Domain A レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph（操縦席UI改定wave実行責任者）。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: Domain A「土台」= vendor 配置（`src/cockpit/vendor/`）+ 静的配信ルート（`cockpit-server.mjs` の `tryServeUiAsset`）+ view-logic 純関数抽出（`src/cockpit/view-logic/*.mjs`）+ `.gitignore` 負規則。
> 観点: 「動くか」でなく「この土台の上に Domain B/C/D を安全に積めるか」。wave-plan §2/§3 Domain A/§4・inventory §1/§2-5/§4・cockpit-redesign.md §7・Gnome 成果物 domain-a.md に対する適合を、自分でファイルを読み・自分でコマンドを実行して確認した（Gnome の報告値を転記していない）。
> 総合判定: **PASS**（blocking なし。non-blocking はテスト/docs のトラバーサル経路説明の事実誤認 1 系統と、gitignore 負規則 2 行目の意味論的冗長ほか軽微のみ）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 643` `# pass 643` `# fail 0`（1 回で緑・再試行不要）。

個別実行（明示ファイル指定）:
- `node --test src/cockpit/cockpit-server.test.mjs` → **74/74**（背骨=ワイヤ契約 16+13+6 の無退行一次証明）。
- `node --test src/cockpit/cockpit-page.test.mjs` → **30/30**（cockpit.html 無改変の裏付け）。
- `node --test src/cockpit/cockpit-static-assets.test.mjs` → **6/6**。
- view-logic 6 テストファイル明示指定 → **28/28**（4+4+5+5+7+3=28・domain-a.md §6 の内訳と一致）。
- ※途中 `node --test <dir>/` とディレクトリを渡した私のコマンド誤用で 1 fail が出たが、これは node:test の
  引数仕様の問題（ディレクトリ引数）であり実装の問題ではない。明示ファイル指定・全体実行はいずれも全緑。

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json
```
→ 出力なし（器コード・lockfile・依存 完全不変＝新規 npm 依存ゼロ）。

```
git status --porcelain -- apps/soul/agent
```
→ `M .gitignore` / `M src/cockpit/cockpit-server.mjs` / `?? cockpit-static-assets.test.mjs` / `?? vendor/` / `?? view-logic/`
（domain-a.md §5 と一致・cockpit.html / cockpit-page.test.mjs / scripts/cockpit.mjs は無改変）。

3 チェック（repo ルートで実行）: `check-dependencies` **passed**・`check-soul-zone-boundary` **passed（1361 files）**・
`check-source-organization` の違反は `apps/runtime-player/src/main/physiology/index.ts` の 1 件のみ（器側・ブランチ既存
ベースライン＝本 Domain 不変）。無退行。

vendor 実測: `wc -c` → **13,194 bytes**・`sha256sum` → `72284e8e…46fc1fd7`（いずれも domain-a.md §2 の記録と一致）・
冒頭は minified preact（`var e,n,_,t,o,r,u,l={},…`・注入コメントなし＝無改変）。

view-logic 純関数性の機械確認: 6 モジュールに対し `grep "^import|require(|document\.|window\.|fetch("` → **0 件**
（import ゼロ・DOM/ネットワーク参照ゼロ。`formatClock` の `new Date` はローカル TZ 依存だが原実装同値で意図的・
`computeUptimeMs` は `nowMs` を引数で受け `Date.now()` を内部で呼ばない＝正しい純関数化の形）。

---

## 1. 静的ルートの設計堅牢性 — PASS（自分の攻撃面プローブで漏洩ゼロを実証）

### 1-1. 握る/委譲する境界の構造（将来エンドポイント追加時の事故耐性）

`tryServeUiAsset`（cockpit-server.mjs:952-992）は「第一区画が `UI_ASSET_SUBDIRS = {vendor, ui, view-logic}`（:77）の
とき**のみ**握り、それ以外は `false` を返して既存 404（:940）へ委譲」する boolean 契約。呼び出しは末尾 404 の直前の
1 分岐のみ（:936-938・`GET` 限定）。この設計の事故耐性を評価した:

- **定義順で守られる**: 静的ルートは「最後の 404 の直前」に置かれているため、既存 16 エンドポイント（:729-935・
  全て `/api/*` か `/`）はもちろん、**将来どこに API 分岐を足しても静的ルートより先に評価される**。追加側が
  誤って `/vendor/...` という API を作らない限り衝突経路が構造的に存在しない。
- **握った後の 404 も自前で完結**（:965 `notFound`＝`{error: "not found: GET <pathname>"}`・既存フォールスルーと同形）。
  「握ったが見つからない」を呼び出し元に返さないため、フォールスルー側の分岐が今後増えても静的ルートの応答形は不変。
- boolean を返すヘルパ方式は `serveIndex`（:995-1008・readFile→`cache-control: no-store`）と同型で流儀一貫。

### 1-2. トラバーサル防止の多層構造（設計トレース+実測）

防御は実質 **4 層**（明示 3 段 + WHATWG URL 正規化の暗黙 1 層）:

0. （暗黙）`new URL(req.url, …).pathname`（:726-727）が dot segment を正規化する。**生の `..` も `%2e%2e` も
   ここで畳まれる**（実測: `new URL("http://x/vendor/%2e%2e/cockpit-server.mjs").pathname` → `/cockpit-server.mjs`。
   WHATWG URL 仕様は `%2e` を dot segment として解釈する）。正規化後は第一区画が許可サブツリー外になり**握りもせず**
   既存 404 へ落ちる。
1. `decodeURIComponent` 失敗（不正 % エンコード）は握らず委譲（:955-958）。
2. `path.resolve` → `path.relative` でルート脱出判定（:968-973・空/`..` 始まり/絶対を拒否）。
3. 正規化後の第一区画を許可サブツリーで再確認（:975-978）+ 拡張子 `.mjs` 固定（:979-982）。

**第 2・3 段は死コードではない**——層 0 をすり抜けて第 2/3 段が実際に発火する入力が存在することを自分でトレースし
実測で確認した: `%2f`（エンコードスラッシュ）は WHATWG の dot segment 判定に乗らず pathname に残り、
`decodeURIComponent` 後に**生の `..` セグメントが復活する**（`/vendor/..%2f..%2fpackage.json` → rel =
`vendor/../../package.json` → 第 2 段が脱出を検知）。Windows では `%5C`（エンコードバックスラッシュ）も
`path.resolve`(win32) がセパレータ扱いするため同様に第 2/3 段が働く。

**攻撃面プローブ（scratchpad の一時スクリプトで実サーバを loopback 起動して私が実測・19 ケース）**:

| 攻撃クラス | 例 | 結果 |
|---|---|---|
| エンコードスラッシュ `..%2f`（OS 非依存で層 0 をすり抜ける） | `/vendor/..%2f..%2fpackage.json` ほか 3 種 | **全 404・漏洩なし**（第 2/3 段発火） |
| エンコードバックスラッシュ `..%5C`（Windows 固有） | `/vendor/..%5C..%5Cpackage.json` ほか 3 種 | **全 404・漏洩なし** |
| 大文字（Windows FS は case-insensitive・Set 判定は case-sensitive） | `/VENDOR/htm.…mjs`・`/vendor/HTM.…MJS` | **全 404**（拒否側に倒れる=安全。ブラウザ import は正確な小文字を書くため機能欠けなし） |
| NTFS ADS・末尾ドット/スペース | `…mjs::%24DATA`・`…mjs%20`・`…mjs.` | **全 404**（拡張子チェックが末尾検査のため防げる） |
| null byte・不正エンコード・二重エンコード | `/vendor/%00.mjs`・`/vendor/%zz.mjs`・`%252e%252e` | **全 404** |
| クロスサブツリー（許可内→許可内） | `/vendor/..%2fview-logic%2fformat-time.mjs` | 200（**どちらも配信対象なので漏洩ではない**・記録のみ） |
| 正常系（統制） | `/vendor/htm.…mjs`・`/view-logic/format-time.mjs` | 200 |

サーバ source（`createCockpitServer`）・`package.json` の内容が漏れたケースは**ゼロ**。

- **symlink**: 解決は lexical（`path.resolve`）のみで realpath はしない＝許可サブツリー内に symlink を置かれれば
  外部ファイルを配信しうる。ただし配信ツリーはリポジトリ管理の凍結/ソースディレクトリで symlink を置く経路がなく、
  サーバは loopback 限定（:65 `LOOPBACK_HOSTS`）。実害なし・記録のみ（§7 non-blocking 4）。
- **UNC/ドライブレター**: 先頭 `//` は `replace(/^\/+/,"")` で除去済み・`C:` 混入は第一区画判定か readFile ENOENT で
  404 に落ちることをトレースで確認。

### 1-3. `uiRootPath` option 設計 — 妥当

既定 `COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url))`（:72）＝「ソース=実行物」原則の素直な帰結
（UI ツリー＝このモジュールの場所）。`options.uiRootPath ?? COCKPIT_DIR`（:405）で差し替え可・既定で
`scripts/cockpit.mjs` は無改変で動く（domain-a.md §7-5 の主張どおり・git status で無改変を確認済み）。
本 Domain のテストが fixture ルートでなく**実ツリー**を配って検証しているのも、配信物=コミット物の同一性
（凍結 vendor の無改変配信・static-assets test:47-49 のバイト一致アサーション）を固定する強い形で良い。

## 2. view-logic の構造品質 — PASS

### 2-1. 分割粒度と Domain B/C からの使いやすさ

6 モジュール（format-time/transcript/markers/ghost/status/usage）は**行種・表示区画の性格**で切られており、
Domain B の feed（transcript+markers+ghost+format-time）・header/usage 表示（format-time+usage）・
Domain C の設定引き出し（status）という消費側の区画と素直に対応する。1 モジュール 1 関心・全関数 export・
相互 import なし（もつれゼロ）。preact コンポーネントから「必要な断片だけ named import」できる形。

### 2-2. 入出力の形の一貫性

- **「行のテキスト」は文字列を返す**（markers 5 関数・ghost 4 関数・usage）。
- **「状態表示」は `{text, className, …}` 構造体を返す**（status の `chatStatusView`/`channelStatusView`）。
- **「描画しない」は null**（`latencyLabel`・`diagnosticGhostLabel`・`chatDiagnosticGhostLabel`）——非表示の意味論が
  null で統一されており、意図的非表示リスト（wave-plan §4-4）の機械化として明確。
- 欠落フォールバック（`?`/`unknown`/`0`）は原実装の意味論を fixture で厳密固定（ghost.test.mjs:50-60 が非表示 3 種
  + bargeIn 分流 + 未知型/型欠落 null を全て固定・status.test.mjs:22-28 が dead の Disconnect 無効を固定）。

transcript だけ細粒度関数分割（label/class/latency 別関数）で status は構造体、という**様式の非対称**はあるが、
transcript の 3 関数は行の別スロット（who/className/lat span）に対応しており消費側の JSX 構造と合う。統一様式を
強制する利得は小さい（non-blocking 8・様式メモとして B/C に申し送り）。

### 2-3. 機能同値の突合（私自身の読み比べ）

現 cockpit.html の対応行（:249-261 時刻 / :294-315 chat / :347-359 channel / :386-408 転写 / :456-457 fire /
:474-478 expr / :495-496 vision / :520-521 barge-in / :539 selfFire / :547-554 usage / :828-897 ghost 全分岐）を
全て自分で読み、view-logic 実装・fixture と突合した。**全関数が機能同値**。特に紛れやすい点も一致を確認:
`channelStatusView` の idle 末尾スペース（status.mjs:75-76 コメント明記）・`pad` の 3 桁非切詰・
`computeUptimeMs` の負クランプなし・`latencyLabel(0)` は表示（`!= null` 意味論）・`chatDiagnosticGhostLabel` の
白名簿 5 種が cockpit.html:893-894 と同一集合・`diagnosticGhostLabel` の bargeIn null（専用マーカー行へ分流する
前提がヘッダコメントに明記）。JSDoc・対応行コメントの質は高い（全モジュールのヘッダに cockpit.html 行番号対応表・
意味論の罠に個別コメント）。

### 2-4. Domain B/C がこの API で足りるか（不足の明確化）

L0 裁定（applySoulState 等は B/C 領分）の帰結として**未抽出**なのは: `applySoulState`（:434-441・soul-status 文字列
+ Fire/VisionFire disable 導出）・`applyHealth`（:360-366）・`applyVisionTarget`（:317-320）・`applySelfFire`
（:324-340）・`applyAudioDevice`（:342-345）。domain-a.md §7-2 がこの 5 つを明示列挙して申し送っており線引きは明確。
**§7-2 の列挙から漏れているが B/C が同様に必要になる導出**を補足する（§8 申し送り参照）:
- **ears 状態表示**（cockpit.html:268-270・`"listening"→"Listening"/"starting"→"Starting"/他→"Stopped"` + dot class）
  — Domain B ヘッダの状態ランプに必要。
- **fire note 文言**（:863 `"not fired: " + (d.reason || "unknown")`）— Domain C 運転バーの発火拒否表示に必要。
どちらも 1-3 行の純導出で、B/C が view-logic に足す形（`chatStatusView` と同型）が綺麗。**この 2 点を B/C の委任
プロンプトに含めれば API 不足は残らない**と判断する。speaking 行・自動スクロール・履歴復元は表示文字列でなく
状態遷移/DOM 挙動なので preact 側（hooks）の領分で正しい。

## 3. フォールスルー境界とワイヤ契約 — PASS

- 追加分岐は `method === "GET" &&` 付き（:936）＝ POST/HEAD/PUT は一切握らない。module script のロードは GET のみ
  なので機能十分。
- 既存 16 エンドポイントは全て `/api/*` と `/`（:729-935 を自分で列挙確認）——第一区画 `api`/`""` は
  `UI_ASSET_SUBDIRS` 外で構造的に衝突不能。既存 server test「未知ルートは 404 JSON」（cockpit-server.test.mjs:454-463・
  `/api/nope`）も無退行（74/74 に含まれ緑）。
- 404 レスポンス形は握った場合も `{error: "not found: GET <pathname>"}`＝既存フォールスルーと同形（:965）。
  static-assets test:117-128 が「非アセットパスは既存 404 形」を固定。
- **将来 `/vendor` という名の API を作ったら?**: 定義順の構造（§1-1）により 404 手前より上に置けば API が勝つが、
  そもそも「新規エンドポイントは `/api/` プレフィックス」という現行の暗黙規約を明文化しておくと事故の芽が消える
  （non-blocking 7・Domain D の docs 整理で 1 行足せば足りる）。

## 4. `.gitignore` 変更の設計 — PASS（2 行目の意味論に軽微な指摘）

自分で `git check-ignore -v` を実行した:

```
apps/soul/agent/src/cockpit/vendor/htm.preact.standalone.mjs → !src/cockpit/vendor/*.mjs（無視解除・追跡可）
apps/soul/agent/vendor/whisper-bin/whisper-cli.exe           → vendor/（無視のまま）
apps/soul/agent/src/cockpit/vendor/（ディレクトリ）           → マッチなし（無視されていない）
```

gitignore 意味論（「親ディレクトリが除外されていると negation は効かない」）に照らして構造は正しい:
un-anchored `vendor/`（.gitignore:8）が `src/cockpit/vendor` ディレクトリ自体にマッチ→ **1 行目
`!src/cockpit/vendor/` がディレクトリの除外を解く**（これが本質・この行がなければ 2 行目は死ぬ）→ git が中を走査
→ 2 行目が `.mjs` を明示的に無視解除。whisper vendor の無視は維持。負規則は機能する。

**ただし**追加で実測したところ、`src/cockpit/vendor/hypothetical.txt` も `src/cockpit/vendor/sub/deep.mjs` も
**どの無視規則にもマッチしない**（check-ignore EXIT=1）。un-anchored `vendor/` は「vendor という名のディレクトリ」
パターンなので、ディレクトリの除外が 1 行目で解かれた後は**中身の任意ファイルが（.mjs に限らず）追跡対象になる**。
つまり 2 行目 `!src/cockpit/vendor/*.mjs` は「.mjs だけ許す」という選別としては**効いていない**（1 行目だけで
中身全部が解除される・2 行目は意図表明としての冗長）。凍結ディレクトリに .mjs 以外を置かない規律が守られる限り
実害ゼロ。修正必須ではない（non-blocking 3・コメントの「この 1 サブツリーだけ無視を解く」自体は正確）。

## 5. Domain D（エントリ差し替え）への滑走路 — PASS

domain-a.md §7-6 の主張を自分でトレース+実測して裏取りした:

- cockpit.html は `GET /` で配信（:729-731・serveIndex）→ ドキュメント URL は `/` → inline module の
  `import … from "./ui/app.mjs"` は `/ui/app.mjs` に解決 → 第一区画 `ui` は許可済み（static-assets test:110 が
  「今は 404 だがルートとして許可」を固定）。
- `/ui/app.mjs` からの `../vendor/htm.preact.standalone.mjs` → `/vendor/…`・`../view-logic/*.mjs` → `/view-logic/*`
  ——いずれも許可サブツリー内（正常系 200 は私のプローブでも実測済み）。`ui/components/…` のようなネストも
  第一区画 `ui` のまま配信可（トレース確認）。
- **Domain B/C は server に 1 バイトも触らず `ui/*.mjs` を置くだけで配信される**——ドメイン間の職域分離が
  構造的に保証されており、B/C/D を積む土台として適切。
- MIME `text/javascript; charset=utf-8`（:990）は module script 要件を満たす。`cache-control: no-store` は
  serveIndex と同型（開発中の再読み込み即反映・loopback なので性能問題なし）。

## 6. 凍結 vendor の扱い — PASS

- **無改変**: sha256・サイズを自分で実測し domain-a.md §2 の記録と一致（§0）。冒頭に注入コメントなし。
  配信もバイト無変換（readFile → Buffer 直送・static-assets test:47-49 がバイト一致を固定）。
- **出所記録**: 取得 URL（htm@3.1.1 で URL ピン）・sha256・取得日時・取得方法（`--compressed` なし=identity）が
  domain-a.md §2 に揃っており、**将来の更新手順（同形式の URL で新版取得→sha256 記録更新）が追える**。
  preact パッチバージョン（10.29.7）が inventory 由来で独立検証不可という限界も §7-7 で正直に開示されている
  （sha256 がバイトを固定するので実害なし・記録の誠実さとして適切）。
- vendor ディレクトリ内に README を置かず docs 側に記録、は「凍結ファイル以外置かない」規律として一貫。
  Domain D の README 更新時に出所記録（domain-a.md §2）への参照を 1 本張ると発見性が上がる（§8 申し送り）。

---

## 7. blocking / non-blocking の総括

**blocking: なし。** wave-plan §4 の blocking 基準に対して: (1) 器・契約・lockfile・package.json 不変＋新規 npm
依存ゼロ＋ビルド段ゼロ＝git diff/status で自分で確認（§0）。(2) server test 74/74 全緑＋既存全テスト緑（643/643・
page test 30/30 無改変）＝自分で実行。(3) view-logic は preact 非依存の純関数＋fixture 必須＝grep とテスト実行で
確認。(4) 意図的非表示リストの遵守＝ghost.mjs/fixture と cockpit.html:850-854 の突合で確認。(5) devDep ゼロ維持・
3 チェック無退行＝自分で実行。

**non-blocking（軽微・修正は裁量）**:
1. **トラバーサル経路説明の事実誤認（テスト/docs の正確性・動作は正しい）**: `%2e%2e` は WHATWG URL が
   pathname 段階で正規化するため（実測済み）、cockpit-static-assets.test.mjs:77-78 のコメント「%2e%2e は URL
   正規化を通り抜け→ tryServeUiAsset の traversal ガードが弾く」および domain-a.md §3 の例
   「/vendor/%2e%2e/cockpit-server.mjs → cockpit-server.mjs が第一区画になり弾かれる」は**実際の経路と異なる**
   （実際は握りもせず既存 404 フォールスルー）。ハンドラ内第 2/3 段ガードを実際に踏むのは `..%2f`（OS 非依存）と
   `..%5C`（Windows）で、**この経路のテストが現状 1 本もない**。挙動自体は私のプローブで 404・漏洩ゼロを実証済み
   なので危険はないが、ガードの実カバレッジとして `/vendor/..%2f..%2fpackage.json` 級のケースを test レーンで
   足す価値がある＋コメント/docs の経路説明の訂正を推奨。
2. （1 と同根）static-assets test の traversal 3 ケースは全て「層 0（WHATWG 正規化）で第一区画が変わり握らない」
   経路に落ちており、テスト名が示唆する「ガードが弾く」検証になっていない。追加ケースで解消する。
3. **gitignore 負規則 2 行目の冗長性**: `!src/cockpit/vendor/` だけで中身全部（.mjs 以外・サブディレクトリ含む）が
   無視解除されることを check-ignore で実測。`!src/cockpit/vendor/*.mjs` は「.mjs のみ許可」の選別としては効いて
   いない（意図表明としての冗長・実害ゼロ）。直すなら 2 行目削除かコメント補正だが、触らない選択も合理的。
4. **symlink 非解決**: lexical resolve のみで realpath なし。loopback 限定+リポジトリ管理ツリーで実害なし（記録）。
5. **大文字パスは 404 に倒れる**: Windows FS は case-insensitive だが第一区画判定は case-sensitive。拒否側に
   倒れるため安全（機能欠けもなし・記録のみ）。
6. **クロスサブツリー参照が可能**（`/vendor/..%2fview-logic%2f….mjs` → 200）: どちらも配信対象なので無害（記録のみ）。
7. **「新規エンドポイントは `/api/` プレフィックス」の明文化**を推奨（Domain D の docs 整理で 1 行）。
8. **view-logic の様式メモ**: 行テキスト=文字列・状態表示=構造体・非表示=null という役割別様式。transcript のみ
   細粒度関数分割。B/C が新規に足すときはこの様式（状態導出は `chatStatusView` 型の構造体）に合わせると一貫する。

## 8. Domain B/C/D への申し送り（design レーンから）

- **Domain B（観測+ヘッダ）**:
  - feed の行テキストは view-logic（markers/ghost/transcript/format-time）を呼ぶ薄い層にする。非表示の意味論は
    「view-logic が null を返したら行を作らない」で機械的に決まる（bargeIn は `diagnosticGhostLabel`=null →
    `bargeInMarkerText` の専用行へ、という分流を diagnostic ハンドラ側で先に行うこと・ghost.mjs ヘッダコメント参照）。
  - **ears 状態表示の導出（cockpit.html:268-270・"Listening"/"Starting"/"Stopped"+dot class）は未抽出**。ヘッダ
    実装時に view-logic へ足すこと（§2-4）。`applyHealth`（:360-366）も同様。
  - 視覚サムネ（jpegBase64→data URI）は `visionMarkerText` に含めていない（文字列導出のみ・img は component 側）。
- **Domain C（運転バー+設定引き出し）**:
  - `applySoulState`（:434-441・Fire/VisionFire の disable 導出）・`applySelfFire`（:324-340）・
    `applyVisionTarget`・`applyAudioDevice` は view-logic に足すと綺麗（domain-a.md §7-2 と同意見）。
  - **fire note 文言（:863 "not fired: reason"）も未抽出**——運転バー実装時に足すこと（§2-4）。
  - status.mjs には `chatStatusView`/`chatDisplayState`/`shouldRestoreChatSource`/`channelStatusView` が既にある
    （dead の Disconnect 無効＝snapshot 再送で誤再有効化しない、の中核裁定は fixture 固定済み）。設定引き出しは
    これを呼ぶだけでよい。
  - server に触る必要は一切ない（`ui/*.mjs` を置くだけで配信される）。
- **Domain D（統合+docs）**:
  - エントリの相対 import 解決は検証済み（§5）——`./ui/app.mjs`・`../vendor/*`・`../view-logic/*` 全て通る。
    `uiRootPath` の明示指定は不要（既定で足りる）。
  - docs 整理時に: (a) 「新規エンドポイントは `/api/` プレフィックス」の 1 行明文化、(b) README から vendor 出所
    記録（domain-a.md §2）への参照、(c) non-blocking 1 のトラバーサル経路説明の訂正、を拾うこと。

## 9. §質問（Orch への申し送り）

- Q1: non-blocking 1/2（トラバーサル経路説明の事実誤認+ガード実発火経路のテスト欠如）を Domain A の追修正として
  Gnome に回すか、test レーンの指摘と束ねて後続で拾うか。**動作は安全（私のプローブで実証）なので blocking では
  ない**が、テストコメントが誤った脅威モデルを後続に教えるのは土台文書として好ましくない。私は「Domain A 内で
  コメント訂正+テスト 1 本追加（`..%2f` ケース）」の小追修正を推奨する。
- Q2: gitignore 2 行目の冗長（non-blocking 3）は触らない選択も合理的。直すなら Q1 と同じ便で。
- Q3: §8 の未抽出 2 点（ears 状態表示・fire note 文言）を B/C の委任プロンプトに明記してほしい（domain-a.md §7-2
  の列挙には含まれていないため、落ちやすい）。
