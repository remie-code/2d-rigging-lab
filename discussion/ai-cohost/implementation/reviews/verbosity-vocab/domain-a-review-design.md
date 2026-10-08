# 口数配線+コーディ語彙登録 wave Domain A レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph（口数配線+コーディ語彙登録 wave 実行責任者）。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: Domain A「口数モード実配線」= `fire-scheduler.mjs` の const→let 化 + `VERBOSITY_BUNDLES`/`setVerbosity`/`getVerbosity` + `POST /api/verbosity`（cockpit-server.mjs）+ `createVerbosityHooks`（scripts/cockpit.mjs）+ `getVerbosityMode`/`setVerbosityMode`（cockpit-settings-store.mjs）+ 運転バー口数プルダウンの controlled 化（control-bar.mjs/app.mjs）。
> 観点: 「動くか」ではなく「この配線が既存の S6/S7 挙動（自発発火・comment-call・呼びかけ・turn 検出・barge-in）を壊さず、口数モードの意味論（inventory §A-2）を正しく実装しているか」。wave-plan §2/§3 Domain A/§4・inventory §A-1〜A-3・Gnome 成果物 domain-a.md に対する適合を、自分でファイルを読み・自分でコマンドを実行して確認した（Gnome の報告値を転記していない）。
> 総合判定: **PASS**（blocking なし。non-blocking は setVerbosity の armSilence 副作用の体感注記 1 件と、mode 妥当性検証の軽微な重複 1 件のみ）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 706` `# pass 706` `# fail 0`（1 回で緑・再試行不要。domain-a.md §4 の「実装前 679 → 実装後 706（+27）」と一致）。

3 チェック（repo ルートで実行）:
```
node scripts/check-dependencies.mjs        → Dependency guard passed. EXIT=0
node scripts/check-soul-zone-boundary.mjs  → Soul zone boundary guard passed: 1377 source files scanned;
                                              no 器→魂 imports and no 魂→器 code imports. EXIT=0
```
（`check-source-organization` は既知の器側ベースライン違反 1 件のみ・本 Domain の変更は全て `.mjs` のため対象外・domain-a.md §4 の記述どおり、今回は design レーンとして重複実行はしていない）。

```
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json apps/runtime-player packages discussion/ai-cohost/contracts
```
→ 出力なし（器コード・lockfile・依存・契約 JSON 完全不変）。

```
git status --porcelain -- apps/soul/agent
git diff --stat -- apps/soul/agent
```
→ 変更 13 ファイル・全て既存ファイルの編集（新規ファイルゼロ）・domain-a.md §1 の一覧と完全一致。`cockpit.html` は変更対象に含まれていない（無改変）。

---

## 1. const→let 化 + VERBOSITY_BUNDLES 設計の健全性 — PASS

`apps/soul/agent/src/mind/fire-scheduler.mjs` を全読し、既存 export const（:62-120）と `VERBOSITY_BUNDLES`（:252-289）を突合した。

- **normal 束 = 既存 export const への参照**（:266-276・`turnEndProbability: TURN_END_PROBABILITY` 等 9 値すべて）。リテラルの重複がゼロであることを目視確認した。これにより normal は「値の単一の源」であり続け、mode 未指定時のフォールバックが既存挙動と構造的にズレえない。
- **quiet/chatty はリテラル新規**（:254-264, :278-288）。inventory §A-2 の表（控えめ/ふつう/おしゃべりの 9 値×3 モード）と 1 対 1 で照合し完全一致を確認した（turnEndProbability 0.15/0.35/0.70・turnEndRefractoryMs 15000/8000/4000・silenceBaseMs 90000/45000/25000・silenceJitterMs 30000/30000/20000・silenceRefractoryMs 120000/90000/60000・silenceBudget 3/6/12・commentProbability 0.15/0.35/0.70・commentRefractoryMs 15000/8000/4000・commentBudget 15/30/60）。
- **9 個の let 初期化の意味論**（:373-380, 390, 392）: `numberOr(options.x, initialBundle.x)` / `intOr(options.silenceBudget, initialBundle.silenceBudget)`。`numberOr`/`intOr`（:219, 224）の実装を読むと、value が有限数（または非負整数）ならそれを最優先し、そうでなければ fallback を返す。つまり **「明示 options 優先・mode 未指定時は現行値」の両立**は正しい: 既存テストが渡す明示 `options.turnEndProbability` 等はそのまま効き（`numberOr` の value 優先）、明示指定が無ければ `initialBundle`（mode 解決済みの束、既定 normal＝既存定数参照）が使われる。既存テスト無退行の鍵として機能している。
- **turnEndSilenceMs（turn 検出）は const のまま**（:360）で `VERBOSITY_BUNDLES` に一切含まれない。9 値の外側に明確に切り分けられており、口数がここに触れない構造が型（オブジェクトの形）レベルで保証されている。
- **isValidVerbosityMode**（:297-299）は文字列リテラル比較 3 本の単純な防御関数。setVerbosity の no-op 判定・初期 mode 解決の両方で共有されており、判定ロジックの二重実装ではない（fire-scheduler.mjs 内では単一の源）。

## 2. setVerbosity の意味論 — PASS（1 点、体感への影響を non-blocking として記録）

`setVerbosity`（:572-586）を読んだ。

- **束再代入 + 予算リセット**: 7 個の let（turnEndProbability/turnEndRefractoryMs/silenceBaseMs/silenceJitterMs/silenceRefractoryMs/commentRefractoryMs/commentProbability）を `VERBOSITY_BUNDLES[mode]` へ再代入し、`silenceBudget`/`commentBudget` を **新モードの満額**（`bundle.silenceBudget`/`bundle.commentBudget`、消費後の残余に対する加減算ではない）へ上書きする。inventory §A-2「モード切替＝そのモードの満額から」の記述と完全に一致することを実測（fire-scheduler.test.mjs の「予算を新モードの満額へリセットする」テストで、消費後に切替→満額になることを確認済み・自分でも `node --test` の緑を確認済み）。
- **未知 mode の no-op**（:573 `if (!isValidVerbosityMode(mode)) return;`）: `currentVerbosity` も束も一切変更せず即 return。呼び出し元（cockpit-server の POST ハンドラ）は別途 400 で弾くため、setVerbosity 自体への防御は二重の安全網であり、過剰ではない（POST 以外の将来呼び出し経路に対する構造的な保険として妥当）。
- **`if (enabled) armSilence()` の再武装（setEnabled 流儀の写経）**: `armSilence`（:422-428）は `clearSilence()` で既存タイマーを破棄し、新しい `silenceBaseMs + jitter` で再武装する。setEnabled(true)（:545-555）の ON 化時にも同じ `armSilence()` を呼ぶ流儀であり、構造としては正しい写経。
  - **非対称性の評価**: turn-end/comment は「次のイベント（speechEnd / コメント到着）で自然に新値を拾う」（タイマー自体が既存の let 変数を毎回参照するクロージャなので、再代入だけで十分）。一方 silence は「常時武装されているタイマー」なので、再代入だけでは次の発火まで**古いモードの残り時間**が生き残ってしまう（例: normal で 40 秒沈黙し、あと数秒で発火するところに chatty へ切替えても、armSilence を呼ばなければ「古い base+jitter」の残りカウントのまま発火してしまう）。armSilence による即時再武装はこれを防ぎ、「モード切替＝そのモードの間で仕切り直す」という意味論を沈黙タイマにも一貫させる、合理的な設計判断と評価する。
  - **裏面の効果（non-blocking・体感への申し送り）**: この再武装は同時に「それまで積み上がっていた沈黙経過時間をリセットする」効果も持つ。つまりユーザーがモードを切替えた直後は、たとえ直前まで長く沈黙していても、新モードの `silenceBaseMs + jitter` を最初から待つ必要がある（最短でも quiet=90s〜、normal=45s〜、chatty=25s〜）。これは「口数を上げたらすぐに頻度が上がる」という人間ゲートの体感に対し、**切替直後の 1 回目の沈黙発火だけ数十秒〜の待ちが生じうる**ことを意味する。実害はなく（2 回目以降は新モードの短い間隔で安定する）、既存 armSilence パターンへの忠実な追従でもあるため blocking ではないが、人間ゲートで「切替えてもすぐ変わらない」という誤解が生じうる点は Orch/ユーザーへの申し送り事項として記録する（§7 non-blocking 1・§9 質問 Q1）。
- **turn 検出・name variants は不変**: `setVerbosity` の本体は `turnEndSilenceMs`/`needles`/`commentNeedles` に一切触れていない（コード上に代入文が存在しないことを目視確認）。

## 3. controlled 化の綻び回避 — PASS

- **control-bar.mjs の `VerbositySelect`**（:103-118）と **`SelfFirePill`**（:80-94）を並べて読み、同型であることを確認した: どちらも hooks 非使用（`useState` を使わない）・`value`/`checked` を prop から直接描画・`onChange` を呼び出し側ハンドラへ素通し。
- **ControlBar 本体**（:129-260 付近）は、旧 `const [verbosity, setVerbosity] = useState("normal")`（ローカル state）を完全に削除し、`verbosity` を prop として受け取るのみに変わっている（diff で `useState` 行が削除され、props 分解代入に `verbosity` が追加されたことを確認済み）。**programmatic 反映（SSE state / GET /api/state 経由の `applyStateRef.current` → `setSettings`）が ControlBar の `verbosity` prop を書き換えても、これを検知して POST を打つ `useEffect` は存在しない**（app.mjs・control-bar.mjs を通読し、`verbosity` を監視する副作用が無いことを確認）。POST が飛ぶのは `<select>` の `onChange`（ユーザー操作）のみであり、selfFire pill の「programmatic 反映で POST が飛ばない = selfFireSyncing の構造的不要化」（control-bar.mjs:166 コメント）と同じ構造が verbosity にも成立している。
- **VerbositySelect 新規コンポーネント抽出**（domain-a.md §3 質問 1）: `cockpit-ui.test.mjs` の既存規律コメント（:439-442）「ControlBar/SettingsDrawer 本体は hooks を使うため vnode 走査で固定できない → hooks 非使用の葉部品（FireButtons/SelfFirePill/KillSwitch/…）を vnode 走査で固定する」を実読して確認した。この規律に照らすと、口数プルダウンを controlled であることをテストで固定するには hooks 非使用の葉コンポーネントとして切り出す以外の手段がない。**VerbositySelect の新設は既存規律の素直な適用であり、既存コンポーネント構成（SelfFirePill/FireButtons/KillSwitch 全てが同型の葉部品）とも一貫する**。妥当な設計判断と評価する（Gnome §質問 1 への回答: 意図と合う）。
- **app.mjs の配線**: `settingsFromSnapshot` に `verbosity: (s && s.verbosity) ?? null`（:80）を追加し、`ControlBar` 呼び出しに `verbosity=${settings.verbosity}`（:245）を渡している。settings state は `applyStateRef.current`（:114-123）内の `setSettings(settingsFromSnapshot(s))` でのみ更新され、GET /api/state の初期化・SSE `state` イベント・各 POST 応答（`applySnapshot`）の 3 経路すべてで同じ関数を通るため、verbosity の反映元は一貫している。

## 4. 失敗寛容と器境界 — PASS

- **POST /api/verbosity のサーバ実装**（cockpit-server.mjs:898-923）を POST /api/self-fire（:877-893）と並べて読んだ。scheduler 未生成時 503（self-fire と同型）、`fireScheduler.setVerbosity(mode)` 後の `onSetVerbosity` 呼び出しは `try { await onSetVerbosity(...) } catch {}` で失敗寛容（:914-920）— onSetSelfFireEnabled の握り方（:887-892）と完全に同型。
- **mode の事前検証**（:906-909）は self-fire の boolean 強制（`body.enabled === true`）とは異なり、非文字列または未知値を明示的に 400 で弾く。コード中コメントで「self-fire は boolean 強制だが、verbosity は妥当な mode を要求する（無効入力を早期に弾く）」と理由が述べられており、2 値と 3 値文字列という型の違いに応じた意図的な非対称であり合理的。
- **createVerbosityHooks**（scripts/cockpit.mjs:326-343）と **createSelfFireHooks**（:294-310）を並べて読み、`resolveInitial*`/`onSet*` の構造・`try { settings.setXxx(...) } catch {}` の失敗寛容パターンまで完全に一致することを確認した。
- **getVerbosityMode/setVerbosityMode**（cockpit-settings-store.mjs:148-154）と **getVisionTarget/setVisionTarget**（:119-124）を並べて読み、`asStringOrNull` の使い回し・`writeMerged({ verbosityMode: mode ?? null })` の read-modify-write パターンが同型であることを確認した。
- **器境界**: `check-soul-zone-boundary.mjs` を自分で実行し PASS（1377 files・器→魂/魂→器 越境ゼロ）。変更ファイル 13 件は全て `apps/soul/agent/{scripts,src}/**` 配下（§0 で確認済み）。`.tmp/facex-*`・`packages/authoring-core` への言及・参照はいずれのファイルにも見当たらない。

## 5. 回帰リスク — PASS

- **handleChatMessage（comment-call 命中即発火・:519-539）は本 diff の変更対象外**: fire-scheduler.mjs 全体を通読した結果、`handleVadEvent`/`handleTranscript`/`handleChatMessage` の関数本体は 1 行も変更されていない（diff のハンクは束定義・let 化・setVerbosity 追加のみで、既存関数の内部には触れていない）。comment-call 分岐（:526-531）は `textMatchesName(msg.text, commentNeedles)` の命中で不応期・確率・予算を一切参照せず即 emit するロジックのままであり、`commentNeedles` は `setVerbosity` からも一切代入されない（buildNeedles の結果は const）。**comment-call が構造的に mode 非依存であることをソースで確認した**（契約の主張どおり）。
- 同様に `needles`（音声呼びかけ）も const のままで setVerbosity の再代入対象に含まれない。
- **turn 検出（turnEndSilenceMs）不変**は §1 で確認済み。
- **barge-in**: fire-scheduler.mjs 内で barge-in に関わるのは `handleVadEvent` の `speechCancel` コメント（:474「speechCancel はスパイク棄却の retraction（barge-in gate の領分）。スケジューラは触らない」）のみで、実装上 `speechCancel` の分岐自体が存在しない（`speechStart`/`speechEnd` の 2 分岐のみ）。setVerbosity が触れる余地が構造的に無いことを確認した。
- fire-scheduler.test.mjs の新規 9 テストのうち 3 本（comment-call 不変・呼びかけ不変・turn 検出不変）が上記をテストレベルでも固定していることを確認済み（§0 の 706/706 に含まれ緑）。

## 6. 総合評価

Domain A の設計適合は高い。特に「normal 束＝既存定数への参照」という設計判断が、無退行の担保として最も本質的な工夫であり、これにより口数モードという新しい分岐点を追加しながらも mode 未指定時の挙動を数値レベルで保証している。controlled 化・写経元の忠実性・失敗寛容パターンの一貫性も、cockpit-redesign wave で確立された既存規律（写経・葉コンポーネント分離）を素直に踏襲しており、Domain B（コーディ語彙登録）や将来の口数関連の拡張に対しても安定した土台になっている。

---

## 7. blocking / non-blocking の総括

**blocking: なし。** wave-plan §4 の blocking 基準に対して: (1) 器・契約・lockfile・package.json 不変＋新規依存ゼロ＝自分で確認（§0）。(2) setVerbosity の束切替・予算リセットが純ロジックテストで固定＋呼びかけ/comment-call/turn 検出が口数の影響を受けないことをテストとソース読解の両方で確認（§5）。(3) POST 経路の server test 無退行（自分で 706/706 実行・確認）。(4) 3 チェック無退行（自分で実行）。(5) SDK/実マイク/実ネット不使用（fake fetch/fake clock のみであることを diff で確認）。

**non-blocking（軽微・修正は裁量）**:
1. **setVerbosity の armSilence 再武装がもたらす体感遅延**（§2 参照）: モード切替直後の 1 回目の沈黙発火は、切替前の経過時間が破棄され新モードの `silenceBaseMs + jitter` を最初から待つ（quiet=90s〜/normal=45s〜/chatty=25s〜）。実害はなく既存パターン（armSilence を「活動」で常に再武装する流儀）への忠実な追従だが、人間ゲート実施時に「切替えてもすぐ変わらない」という誤解が生じうるため、テスト観点ではなく体感の申し送りとして記録する。修正は不要（意図的な設計判断として妥当）。
2. **mode 妥当性検証の軽微な重複**: `fire-scheduler.mjs` の `isValidVerbosityMode`（非 export の private 関数）と、`cockpit-server.mjs` の POST ハンドラ内 `mode !== "quiet" && mode !== "normal" && mode !== "chatty"`（:907）は同じ判定ロジックを独立に実装している。v0 は 3 モード固定のため実害はゼロだが、将来モードを追加する際は 2 箇所（+ control-bar.mjs の VERBOSITY_OPTIONS・cockpit.mjs の createVerbosityHooks 内リテラル比較を含めると実質 4 箇所）を同期する必要がある。修正必須ではない（記録のみ）。
3. **onChangeVerbosity（実際に POST を打つ部分）は直接テストしていない**（Gnome §質問 2）: 既存の `onToggleSelfFire` も同じ制約（ControlBar 自体が hooks 使用のため vnode 走査で固定できない）であることを自分でソースを読み確認した。3 点の間接固定（VerbositySelect の onChange 素通し・view-logic のエラー文言 fixture・server 側の POST 統合テスト）は妥当な代替であり、既存パターンの限界であって本 wave 固有の妥協ではない。

## 8. §質問（Orch への申し送り・Gnome §質問への回答を含む）

- **Gnome §質問1（VerbositySelect 新設）への回答**: 既存の `cockpit-ui.test.mjs` 規律（hooks 非使用の葉部品のみ vnode 走査でテスト可能）に照らし、妥当な設計判断と判断する。承認。
- **Gnome §質問2（onChangeVerbosity 未テスト）への回答**: 既存 `onToggleSelfFire` と同じ制約であることをソースで確認した。追加の代替固定（VerbositySelect vnode + view-logic fixture + server 統合テスト）で十分と判断する。承認。
- **Gnome §質問3（comment 系 untested）への回答**: wave 計画 §1 の既定方針と一致（S7 YouTube 実ゲート保留）。design レーンとして異論なし。
- **Gnome §質問4（人間ゲート申し送り）**: 記載内容で十分。ただし §7 non-blocking 1 の「切替直後は 1 回目の沈黙発火まで新モードの base+jitter を待つ」という体感の性質を、人間ゲート実施時の案内に一言添えると誤解が減ると考える（例:「切替直後の 1 回目はやや時間がかかることがある」）。
- **Q1（design レーンからの新規質問）**: §7 non-blocking 1（armSilence の副作用）は blocking ではないと判断したが、Orch として人間ゲートの案内文に一言反映するか、このまま進めるかの判断を委ねる。
- **Q2**: §7 non-blocking 2（mode 妥当性検証の軽微な重複）は v0 では実害ゼロ。Domain B 側や将来の口数拡張時に `isValidVerbosityMode` を export して cockpit-server.mjs 側が再利用する形に寄せる余地があるが、触らない選択も合理的。

## 9. 参考: 自分で確認した設計⇄実装の対応一覧

| 契約箇所 | 実装箇所 | 確認方法 |
|---|---|---|
| inventory §A-1（const→let・setEnabled 隣に setVerbosity） | fire-scheduler.mjs:572-586（setEnabled :545-555 の直後） | 目視・行番号確認 |
| inventory §A-2（9 値の表・満額リセット） | VERBOSITY_BUNDLES:252-289・setVerbosity:575-583 | 値の突合・fixture テスト実行 |
| inventory §A-3（写経元: self-fire/vision target） | cockpit-server.mjs POST /api/verbosity・cockpit.mjs createVerbosityHooks・cockpit-settings-store.mjs | 並列読解・構造一致確認 |
| wave-plan §3 Domain A（turn 検出・name variants 不変） | fire-scheduler.mjs:359-360, 378, 381-383（setVerbosity 対象外） | ソース読解・no-代入確認 |
| wave-plan §4 blocking 基準 2（呼びかけ/comment-call/barge-in/turn 検出不変のテスト固定） | fire-scheduler.test.mjs の該当 3 テスト + 手動ソース確認 | node --test 実行 + 通読 |
