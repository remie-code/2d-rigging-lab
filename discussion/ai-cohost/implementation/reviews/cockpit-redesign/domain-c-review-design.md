# 操縦席UI改定 Domain C レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph（操縦席UI改定wave実行責任者）。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: Domain C「運転バー+設定引き出し」= `src/cockpit/ui/{control-bar,settings-drawer,app,styles}.mjs` + `view-logic/{control,settings,status}.mjs`（+各 test）+ `cockpit-ui.test.mjs`（+7）+ `cockpit-static-assets.test.mjs`（列挙拡張）。
> 観点: 「この上に Domain D（統合エントリ・旧UI撤去）を安全に載せられるか」「三層IA（観測/運転/設定）の構造がwaveの意図どおりか」。Gnome 成果物 domain-c.md の主張を転記せず、全対象ファイルを精読し・cockpit.html の対応行と突き合わせ・cockpit-server.mjs の応答実装を自分で読み・テストを自分で実行して確認した。
> 総合判定: **PASS**（blocking なし。non-blocking 5 件＝いずれも記録/Domain D 申し送りで解消する軽微事項）。

---

## 0. 自分で再実行した機械ゲート・不変確認（生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 702` `# pass 702` `# fail 0`（1 回で緑・1.4s）。Orch 確定ベースライン 702/702 と一致。

個別実行（明示ファイル指定・いずれも 1 回で緑）:
- `cockpit-server.test.mjs + cockpit-page.test.mjs + cockpit-ui.test.mjs + cockpit-static-assets.test.mjs` → **144/144**（74+30+30+10）＝背骨（ワイヤ契約 16+13+6）無退行・cockpit.html 無改変・ui 30 本・静的配信 10 本を自分で確認。
- `view-logic/control.test.mjs + settings.test.mjs + status.test.mjs` → **27/27**（8+11+8）＝domain-c.md §7 の申告と一致。

```
git status --porcelain -- apps/soul/agent
```
→ `M .gitignore` / `M src/cockpit/cockpit-server.mjs`（いずれも Domain A のまま）+ untracked 5 系。`git diff --stat -- …cockpit-server.mjs` → **80 insertions(+)** = Domain A 時点と同一（本 Domain がサーバへ 1 バイトも触っていない申告の裏付け）。**cockpit.html / cockpit-page.test.mjs / scripts/cockpit.mjs は diff なし**（不可侵 3 ファイル無改変）。

旧 DOM 依存の機械確認: `getElementById|byId\(|document\.|window\.|innerHTML|querySelector` を ui/ 全体に grep → 実質 **0 件**（styles.mjs:376 は引数 `doc` 経由の注入実装・app.mjs:254 はコメント）。**新コードは旧 cockpit.html の DOM/id/CSS に一切依存しない**（§6 で詳述）。

---

## 1. Domain B design レビュー §9「11 点申し送り」の消化検証 — PASS（全点消化を 1 点ずつ確認）

1. **stateLoaded フラグ（必須）— 消化**。app.mjs:108（state 宣言）・:176（init effect の**成功 then でのみ** `setStateLoaded(true)`・直前 :175 で `initialSnapshotRef` に初回 snapshot 固定）・:202-207（`stateLoaded` 立ち上がりで一度だけ判定・`autoOpenedRef` で再判定を構造的に防止）。判定式は view-logic `shouldAutoOpenSettings`（settings.mjs:218-226・fixture 2 本 settings.test.mjs:146-188）。**fetch 失敗時の挙動裁定**（catch :178-180 = stateLoaded を立てない = 開かない・観測直行）は妥当: (a) 誤展開防止が申し送りの本旨、(b) GET /api/state が失敗する状況では引き出し内の loadDevices/loadWindows/loadAudioDevices も同じサーバへの fetch であり開いても機能しない、(c) SSE state 到着でも stateLoaded は立たない設計だが、同一サーバで fetch だけ失敗し SSE が通る状況は実質不存在。catch 後の `.then` で subscribe は必ず走る（:181-183 = 原実装 :904「状態取得失敗でもページは開く」と同値）。
2. **setSoul 4 点セット（必須）— 消化**。app.mjs:238-245 で `soul/setSoul/fireNote/setFireNote` の 4 点が ControlBar へ結線。Fire/vision-fire 応答 `j = {fired, state, reason}` は **applySnapshot に乗らず** `setSoul(res.j.state || "idle")`（control-bar.mjs:128 = 原 :564 :583 同値）へ直結。非 snapshot 応答が snapshot 単一経路（applyStateRef）を汚染しない分離は §0 図・props 契約コメント（control-bar.mjs:13-14・app.mjs:236-237）に明記され、構造・文書とも一致。
3. **fire-note 文言体系の view-logic 抽出 — 消化**。control.mjs に `fireNoteFromSseFire`（:45・**Domain B app.mjs:128 の暫定リテラルは app.mjs:137 で置換され消滅**）・`fireNoteFromFireResponse`（:57）・`fireRequestErrorNote`（:70）。fixture 3 本（control.test.mjs:33-58）が原文言（503 文言・"not fired: reason"・"fire error:"/"vision fire error:"）を固定。
4. **applySelfFire / applyVisionTarget の表示導出抽出 — 消化**。`selfFireToggleView`（control.mjs:82・null=not available・off 時の末尾スペース class :339 踏襲まで fixture 固定 control.test.mjs:71-90）・`visionTargetLabel`（settings.mjs:35）。`soulStatusView`（control.mjs:34 = applySoulState :434-441）も併せて抽出済み。
5. **SSE chatStatus 正規化の片寄せ — 消化**。status.mjs:58 `chatDisplayFromSseStatus`（原 :884 `d.status || "connecting"` と同値・fixture status.test.mjs:47-53）+ app.mjs:143 で使用。snapshot 側 `chatDisplayState` と対になり、chat 表示 state の正規化が status.mjs に完全片寄せ＝単一経路が完成。既存 4 関数は無改変（status.test.mjs 既存 7 本無改変で緑）。
6. **トグル controlled 化・selfFireSyncing の構造的廃止 — 消化・前提も正しい**。SelfFirePill（control-bar.mjs:75-89）は `checked=${view.checked}`（snapshot 由来のみ）+ `onChange`（POST のみ）で、syncing フラグは存在しない。**前提の検証**: 「programmatic 反映が change を発火しない」は preact 固有でなく **DOM 仕様の事実**（`change` はユーザー操作でのみ発火・JS からの checked プロパティ代入では発火しない）。原実装の selfFireSyncing（:323 :335-337）はこの DOM 事実に対する防御的冗長であり、controlled 形で書き戻し自体が preact の render（プロパティ代入）になるため、POST 無限ループは構造的に起きない。さらに preact 10 は `checked`/`value` を **DOM 実値と比較して**書き戻す（controlled を強制する）ため、「ユーザー操作で DOM が変わったが state は変わらない」場合の次回 render で snapshot 値へ復帰する——§8-3 の微差（POST 失敗時に checked がサーバ状態へ戻る）はこの機構によるもので、**表示=サーバ状態の一貫性として改善方向・妥当**。厳密化 1 点は §8 non-blocking 3 に記録（同一エラー文言の連続失敗では useState の同値スキップで再 render が起きず、原実装同様に操作値が残る＝原実装同値なので挙動保存上の問題なし）。
7. **Fire 連打防止 localBusy — 消化・復帰漏れなし**。control-bar.mjs:105（宣言）:121（即時 true）:134（末尾 `.then(() => setLocalBusy(false))`）。promise チェーンは `then(応答処理) → catch(失敗処理) → then(復帰)` の順で、応答成功・応答処理内 throw・`r.json()` 失敗・fetch 失敗のいずれの経路でも最後の then に到達する＝**復帰漏れの経路なし**。App の `soul` とは別のローカル state（申し送りの注意どおり）。微差 1 点（両ボタン共通 disable）は §8 non-blocking 2 に記録。
8. **コンポーネント薄さ・view-logic 経由規律 — 消化**。control-bar.mjs / settings-drawer.mjs の全行を精読: 表示文字列の組み立て・条件分岐による表示導出はすべて view-logic 呼び出し（control.mjs 7 関数・settings.mjs 13 export・status.mjs 3 関数・health.mjs `voiceOutputLabel`）に閉じ、**文字列の再実装ゼロ**。status.mjs の完成済み 4 関数は「呼ぶだけ」（settings-drawer.mjs:56 import・:308-309・dead 時 Disconnect 無効は `chatView.disconnectDisabled` :358 の単一経路）。コンポーネント内に残るのは JSX 構造・fetch 発射・ローカル state 管理のみ（rows.mjs 流儀と同型）。hooks 非使用の葉部品 5 つ（FireButtons/SelfFirePill/KillSwitch/SettingsSelect/DrawerStatus）は view-logic 導出済み構造体の機械写像のみ。
9. **初期ロード独立 effect — 消化・並行化は安全**。settings-drawer.mjs:151-156（`useEffect(..., [])`・loadDevices/loadWindows/loadAudioDevices を並行発射）。3 つの GET はサーバ側で互いに独立なステートレス列挙（cockpit-server.mjs :733-741 :794-803 :834-843）で順序依存なし。原実装 init（:899-909）の直列も便宜上の連鎖に過ぎず、lastDevice 初期選択は /api/devices 応答内で完結（:721 ↔ initialDeviceSelection）。app.mjs の init effect（state→履歴→subscribe）は不変＝domain-b.md §8-8 裁定どおり。
10. **エラー欄 5 つの置き場 — 消化（分割は L0 裁定済み）**。devices-error→マイク行下（micError :383）・channel-error→Channel 行下（:334）・chat-error→chat 行下（:366）・vision-error→視界行下（:415）・**conversation-error は IA 再配置で分割**: 音声系→声の出力先行下（audioError :400）・自発系→運転バー `.control-error`（control-bar.mjs:176）。三層 IA で自発（運転）と声（設定）が別区画になる帰結として必然の分割であり、旧実装の「自発エラーが音声エラーを上書きする」共用欄の相互汚染が構造的に消える。文言自体は view-logic fixture で全固定＝挙動同値以上。
11. **CSS 既存トークン再利用 — 消化**。styles.mjs の `:root`（:29-57）に**新トークン追加なし**（Domain B の 22 トークンのまま）。運転バー/引き出しの追記（:208-367）は --panel/--panel-raised/--border/--radius/--teal/--muted/--down/--up/--speaking/--marker-fire/--marker-vision の再利用のみ。chevron の `#8b93a1` 直書き（:338）は CSS `url()` 内で `var()` が使えない制約による --muted 値の複写で、コメント（:333-334）+ domain-c.md §5-2 に注記済み・data URI で自己完結（外部アセットなし）＝受容。旧スロット CSS 2 行の削除は実体化に伴う死コードゼロ化で正当。cockpit-ui.test の既存 CSS 検査（トークン存在）は追記で壊れず、既存 23 本無改変で緑＝実証済み。

## 2. L0 裁定 2: snapshot 全適用への統一の挙動差検証（必須） — PASS（挙動差が出る実入力なし）

cockpit-server.mjs の応答実装を自分で読んだ。**3 エンドポイントすべてが `broadcastState()` → `sendJson(res, 200, snapshot())` の連続実行**（vision-target :817-818・audio-device :857-858・self-fire :878-879）であり、応答ボディは snapshot() 全体（:464-493）。一方、原実装（cockpit.html）で応答を部分適用していたのはこの 3 つだけ（:627 applyVisionTarget / :691 applyAudioDevice / :648 applySelfFire）で、**残る 5 エンドポイント（channel :765・chat/connect :792・chat/disconnect :801・ears/start :742 :745・ears/stop :808）は原実装から applyState（全適用）**だった。検討したシナリオ:

- **(a) uptime anchorMs のリセット**（委任プロンプト指定の懸念）: applyState は `setUptime({baseMs: s.uptimeMs || 0, anchorMs: now()})` + `setNowTick(now())`（app.mjs:118-119 = 原 :276-278 同値）を行う。「部分適用時代には起きなかった POST で再同期が起きるようになる」か——**起きていた**: 原実装でも同じ POST の処理内で broadcastState() が発火し（:817 :857 :878）、SSE state イベント → applyState → uptime 再同期が同タイミング（数十 ms 差）で走っていた。新実装は応答+SSE の 2 回再同期になるが、再同期は「サーバ計算の絶対値 uptimeMs（cockpit-server.mjs:475 `nowImpl() - startedAtMs`）への baseMs 置き換え + anchorMs=受信時刻」であり、**baseMs と anchorMs が常に対で更新されるため、anchorMs のリセットが経過表示の巻き戻し/リセットになる構造がそもそも無い**。差が出るのは SSE 切断中（EventSource 再接続窓）の POST だけで、その場合も応答適用はサーバ正値への同期＝改善方向。
- **(b) HTTP 応答と SSE state の到着順競合**: broadcastState と sendJson は別 TCP 接続なので到着順は保証されない。応答 snapshot が「取得後〜クライアント適用の間に発生した他の状態変化」を巻き戻す理論窓はあり、全適用化で巻き戻り得るフィールドの範囲は広がる（例: vision-target 応答が chatDisplay/discarded を運ぶ）。ただし (1) この窓と同型の競合は**原実装の 5 全適用エンドポイントに既在**（質的に新しいリスクではなく、既存の型への統一）、(2) 操縦席は localhost 運用で窓はミリ秒、(3) 巻き戻っても次の broadcastState（あらゆる状態変化で発火）で自己修復する、(4) 設定 POST は人間が引き出しで 1 個ずつ押す操作で同時多発しない。**観測可能な挙動差を生む実入力は構成できない**。
- **(c) feed（タイムライン）への影響**: applySnapshot は setFeed を呼ばない（app.mjs:113-122）。応答適用で行は増減しない。原実装の applyState もタイムラインに触れない（renderHistory は init のみ）＝同値。
- **(d) 非 snapshot 応答の混入**: fire/vision-fire 応答（{fired, state, reason}）は setSoul 直結で applySnapshot に乗らない（§1-2）。ears/start の失敗応答（{error, state}）は `applySnapshot(res.j && res.j.state)`（settings-drawer.mjs:187 = 原 :742 同値）で state（snapshot 全体・cockpit-server.mjs:753 :761）を渡す。res.j 欠落時は applyState 冒頭の `if (!s) return`（app.mjs:114）で無害。

**結論: 全適用への統一は挙動同値（承認どおり）。差分は「SSE より一瞬早く他フィールドも最新化される」の 1 点のみで、これは既に channel/chat/ears で起きていた挙動への統一である。**単一経路（applyStateRef 合流）の設計利得が微小な理論窓を大きく上回る。

## 3. 一方向流の設計品質（§0 図） — PASS

- **操作→POST→snapshot→applySnapshot→state→再render** の流れを全ハンドラ（8 POST）で確認: settings-drawer の 6 ハンドラ + control-bar の self-fire が `applySnapshot`（= app.mjs:211 の useCallback → applyStateRef.current）へ合流し、**UI 側に snapshot の写し・派生キャッシュを持たない**。逆流（子から親 state への snapshot 以外の書き込み）は setSoul/setFireNote の 2 本のみで、これは非 snapshot 応答（fire）の専用系として意図的に分離されている（原実装の applySoulState/setFireNote と同一の二重ソース構造＝挙動保存）。
- **checked の一方向流**: `settings.selfFire → selfFireToggleView → checked`（描画）と `onChange → POST`（操作）が交差しない。ローカルに checked を持たないため「表示とサーバの二重管理」が型として消えている。
- **chatEditedRef の管理 — 正しい**。onInput で `edited=true` + `chatSourceRef` 同期（settings-drawer.mjs:345-350 = 原 :775）・Connect 成功で `edited=false`（:250 = 原 :791）・復元は snapshot 到着ごとの effect（:160-173・`[settings]` 依存 = applyState が settingsFromSnapshot で毎回新参照を作るため、原実装の「applyState 毎に applyChat」と発火タイミングが一致）で `shouldRestoreChatSource`（未編集・欄空・source あり）経由。chatSourceRef は effect クロージャの stale 回避のための state ミラーで、更新箇所は onInput と復元の 2 点のみ・両方で同期しており漏れなし。**入力中の復元抑止と Connect 後の復元再開の原挙動（:288 :311 :791）が完全に保存されている。**
- **設定入力欄（channelUrl/chatSource/選択系）のローカル state** は「送信前の下書き」であり snapshot と競合しない（Channel は成功後クリア :224 = token 秘匿 :766 保存・選択系は一覧ロード時のみ初期化）。二重管理には当たらない。

## 4. SettingsDrawer 常時 mount 裁定（§8-7） — PASS（妥当）

- open 時のみ mount する形の弊害 2 点（開閉ごとに `useEffect(...,[])` が再走＝一覧 3 fetch 再発・入力欄ローカル state 消滅）を、常時 mount + CSS `.open`（styles.mjs:280-290）が両方解消する。初期ロード 1 回は原実装 init と同値・Channel 入力途中で閉じても値が残るのは UX 改善方向。
- 畳み中のコスト: settings 変化ごとに vnode 再構築 + diff は走るが描画は `display:none` で不発。原実装は畳み概念なく常時表示・常時 DOM 更新だったので、コストは原実装以下。畳み中も chatStatusView 等の表示が最新に保たれる（開いた瞬間に正しい）副次効果も正しい。
- 三層 flex への収まり: `.settings-drawer.open` は `flex: 0 0 auto`（:283）で、feed-panel の `flex:1 1 auto; min-height:0` を崩さない。`max-height: 46vh + overflow-y: auto`（:288-289）で観測フィードが主役の座を明け渡さない＝三層 IA の意図（設定は引き出し・観測が主役）と整合。

## 5. 口数モード (c) 実装（§8-1・L0 承認済み） — PASS

- **no-op 保証の構造**: `verbosity` は control-bar.mjs:109 の useState に閉じ、onChange（:183）は setVerbosity のみ。**fetch/POST/props のどこにも verbosity が流出しない**ことをコード全読で確認（control-bar.mjs 内の fetch は fireWith と onToggleSelfFire の 2 本のみ・body に verbosity なし）。リロードで "normal" に戻る＝永続もしない。
- **「未配線が伝わる最小の印」**: select の `title="実配線は将来課題（s6-followup §12）・選択しても挙動は変わらない"`（:184）+ コード内コメント（:32-33 :108）+ VERBOSITY_OPTIONS の 3 択 deepEqual 固定（cockpit-ui.test.mjs:417-422）。L0 条件 (a)（任意）を title で満たす。**(b) 手順書明記は Domain D の義務**として domain-c.md §8-1 が明示要求済み＝Orch 管理の宿題として正しく残っている。
- **KILL との意匠区別 — 明確**: KILL は disabled + 赤枠（border-color: --down・styles.mjs:271-276）+ title「S8 で実装（場所のみ予約）」＝触れない予約枠。口数は有効・通常 select 意匠＝触れるが効かない将来配線。「触れる/触れない」「赤枠/通常」の二軸で区別され、S8 予約との混同はない。

## 6. Domain D への滑走路 — PASS

- **mount 契約不変**: `mount(rootElement, { eventSourceImpl?, fetchImpl?, nowImpl? })`（app.mjs:257-260）は Domain B から 1 文字も変わらず、ControlBar/SettingsDrawer は App 内で結線済み。Domain D の cockpit.html 書き換えは `<div id="app">` + inline module 2 行（import mount → mount(...)）の最薄で成立する——CSS は mount が注入・静的配信は control-bar/settings-drawer を含む 7 ファイルが「置くだけで配信」（cockpit-static-assets.test.mjs:226-235 で 200+MIME+実バイト一致を機械固定済み）。inline module は旧 page test の `<script src>` 全面禁止に非抵触（inventory 織り込み・B レビュー §7 と同一の確認）。
- **旧 DOM/id/CSS への依存ゼロ**: grep 実測 0 件（§0）。新 UI は自前の DOM のみを描き、旧 cockpit.html の id（channel-url/chat-source/device-select 等）を**参照はしない**。ただし新 UI は input id="channel-url"/"chat-source" を**自ら生成**するため、旧 HTML の同名 id と**共存させると document 内 id 重複**になる——Domain D が旧 `<style>` + 旧 IIFE + 旧 DOM を「一気に完全撤去」する計画（§8-9）なら問題にならないが、部分撤去・段階移行は不可であることを申し送る（§9-1）。
- 旧 UI 撤去で壊れる依存が新コードに無いこと: ui/*.mjs の import は vendor/view-logic/ui 内に閉じる（構造テスト cockpit-ui.test.mjs:62-78 が readdir 走査で新 2 ファイルも自動検査・自分でも import 文を目視確認）。cockpit.html 側に残る依存は Domain D が書く inline module のみ。

## 7. テスト構造（+7 本） — PASS

- **層の設計が正しい**: ControlBar/SettingsDrawer 本体は hooks 使用のため vnode 走査不能（B レビュー §6 申し送り 8 どおり）→ 表示導出・状態遷移は view-logic fixture（27 本）で固定し、hooks 非使用の葉部品 5 つを `collectElements`（cockpit-ui.test.mjs:402-411・collectText と同型の props 走査）で固定する分業。fixture は原 cockpit.html の表示文字列（503 文言・set failed・末尾スペース class・(no input devices) 等）を 1:1 で写しており、保存オラクルとして機能する。
- **D 以降の変更への壊れにくさ**: (1) 構造テストは readdir 自動走査＝Domain D が ui/ にファイルを足しても自動検査・触らなければ無影響。(2) vnode 走査は葉部品の props 契約のみに依存し、Domain D は ui/*.mjs に触れない計画なので壊れない。(3) VERBOSITY_OPTIONS deepEqual は「実配線までは 3 択固定」の意図的な楔で、実配線（s6-followup §12）時に意図的に更新される正しい壊れ方をする。(4) CSS 意匠 8 点検査（:495-504）は includes/match ベースで追記に耐える。`\.settings-drawer \{ display: none; \}` の完全一致 regex は整形に敏感だが、意匠の固定点としては機能（記録のみ・§8 non-blocking 5）。
- 既存 23 本無改変（30 本中）・static-assets は 1 ケース内ループ拡張で本数不変＝差分が最小。

---

## 8. blocking / non-blocking の総括

**blocking: なし。**

**non-blocking（5 件・記録と申し送りで解消）**:
1. **label `for` の宙吊り（settings-drawer.mjs:372 :386 :403）**: `for="device-select"`/`"audio-device-select"`/`"vision-target-select"` に対応する id を SettingsSelect が select 要素に振らない（className のみ・:65-71）。label クリックでフォーカスが飛ばない a11y の軽微な退行（旧実装は select に id があった）。機能保存には無影響。SettingsSelect に id prop を足す 1 行修正で解消——Domain D のついで修正可（channel-url/chat-source は input に id があり有効）。
2. **localBusy が両 Fire ボタン共通 disable（control-bar.mjs:63）**: 原実装は押した方のボタンだけ即時 disable（:556 :574）で、POST 発射〜応答の間もう一方は押せた（サーバ側 busy 拒否任せ）。新実装は両方即 disable＝二重 POST の窓を閉じる改善方向の微差だが厳密同値ではなく、domain-c.md に未記載。テスト（cockpit-ui.test.mjs:433-436）は意図的にこの形を固定している。記録のみ。
3. **§8-3（POST 失敗時の checked 復帰）の厳密化**: 「エラー時に checked がサーバ状態へ戻る」は**エラー文言の変化で再 render が起きた場合**に限る。同一文言の連続失敗では preact useState の同値スキップ（`currentValue !== nextValue`）で再 render が起きず、DOM checked は操作値のまま残る——これは原実装（エラー時に checkbox に触らない）と同値なので挙動保存上の問題はゼロ。domain-c.md §8-3 の「改善方向の差分」という評価自体は正しい（悪化する入力は無い）。記録のみ。
4. **SettingsDrawer 初期ロード effect に cancelled ガードなし（settings-drawer.mjs:151-156）**: unmount 後に fetch 応答が届くと setState が走るが、preact は unmount 済みコンポーネントの setState を無害に処理し、かつ SettingsDrawer は常時 mount（App が生きている限り unmount されない）ため実害経路なし。app.mjs init effect（cancelled フラグあり）との作法の非対称の記録のみ。
5. **CSS 検査 regex の書式敏感性**（cockpit-ui.test.mjs:498 等・§7）と **header.mjs:40-41 のデッドフォールバック残置**（B レビュー non-blocking 1——Domain C は「header.mjs 原則不変」のタスク規律を優先して意図的に見送り（§8-6）。見送り判断は正当・Domain D の旧 CSS 撤去と同時処理が自然）。記録のみ。

## 9. Domain D への申し送り（Orch へ・委任プロンプトに含める具体列挙）

1. **旧 UI の撤去は「一気に完全」が必須（段階移行不可）**: 新 UI は `channel-url`/`chat-source` の id を自ら生成するため、旧 DOM が残ると document 内 id 重複になる。旧 `<style>`（styles.mjs が同名セレクタ body/.row 等を注入・B レビュー §7-1）+ 旧 IIFE + 旧 DOM を同一コミットで全撤去し、`<div id="app">` + inline module 2 行のみにすること。
2. **人間ゲート手順書の必須項目**（機械テストが構造上届かない領域）: domain-c.md §8-5 の列挙（Fire 押下→busy→復帰 / --channel なし起動の 503 文言 / 自発トグル ON/OFF / Channel Set 後の入力欄クリア / chat source 復元と入力中非復元 / Disconnect の dead 無効 / マイク lastDevice 初期選択 / 一覧 Refresh / 初回自動展開と二回目直行）+ **口数は触っても挙動が変わらない旨の明記（L0 条件 (b)・義務）** + §8-3 のトグル確認点 + B レビュー §7-2 の hooks 実挙動（EventSource 実配線・自動スクロール・「最新へ↓」・履歴復元・uptime 刻み）。
3. **header.mjs:40-41 のデッドフォールバック削除**（B レビュー non-blocking 1 の持ち越し・C は規律優先で意図的見送り）を統合時のついで修正に含める。
4. （任意）SettingsSelect への id prop 追加で label `for` を有効化（§8 non-blocking 1）。
5. mount 呼び出しは `mount(document.getElementById("app"))` のみで足りる（options 既定で globalThis 参照・uiRootPath も既定で足りる = domain-a.md §7-5）。
6. page test 書き換え時、inline module は `<script src>` 禁止に非抵触（今回も確認済み）。「自己完結=外部ネットワーク非依存」への読み替えは wave-plan §2 どおり。

## 10. Orch への申し送り

1. **snapshot 全適用統一の挙動差検証は完了・挙動差なし**（§2）。L0 承認の前提条件は満たされた。部分適用へ戻す理由はない。
2. **B レビュー 11 点の申し送りは全点消化を確認**（§1・必須 2 点含む）。未消化・変形消化はない（10 の分割は L0 裁定済み・6 の header.mjs 見送りは規律優先で正当＝D 送り）。
3. 口数 (c) の手順書明記（L0 条件 (b)）を **Domain D 委任プロンプトの義務項目**として管理すること（§9-2 に含めた）。
4. non-blocking 5 件はいずれも単独修正不要（D のついで・記録のみ）。本 Domain の再委任は不要。

---

**総合判定: PASS。** blocking なし。一方向流・snapshot 単一経路・view-logic 経由規律・三層 IA の再配置・導線判定のいずれも「Domain D（統合エントリ・旧 UI 撤去）を安全に載せられる」水準にあり、props 契約（mount 不変）と旧 DOM 非依存により D の作業は cockpit.html の最薄書き換え + 手順書に閉じる。上記 non-blocking 5 件と Domain D 申し送り 6 点・Orch 申し送り 4 点を引き継ぐ。
