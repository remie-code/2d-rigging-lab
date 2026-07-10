# AI Cohost C1 Wave Plan: 二体が同居できる(役割の骨格)

> Objective: パッケージ版Runtime Playerを引数つきで二重起動すると、トラッキングホスト(現行全機能)と自律ホスト(入力系なし・静止モデル表示)が別モデルで並走し、状態が混ざらず、片方をkillしてももう片方が動き続ける。

## 1. Status

- Status: **実装完了(Domain A/B/C)。パッケージ版の手動ゲート待ち**(2026-07-10)。Domain A/B いずれも 3 レーン Review-Sylph PASS、Domain C(統合・検証・docs)完了 → [../waves/c1/domain-a-slot-foundation.md](../waves/c1/domain-a-slot-foundation.md) / [../waves/c1/domain-b-role-composition-identity.md](../waves/c1/domain-b-role-composition-identity.md) / [../waves/c1/domain-c-final-integration.md](../waves/c1/domain-c-final-integration.md)、レビュー [../reviews/c1/](../reviews/c1/)。残タスク: §8 Manual Check Notes のパッケージ版手動ゲート(ユーザー実施)と、下記 §13 の上位判断・申し送り。(初稿 Status: Ready to launch。)
- Planning gate: inventory then plan(実施済み → [c1-planning-inventory.md](c1-planning-inventory.md)。Verdict `needs_design` → 下記ユーザー裁定で解消)。
- Model Allocation: **L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須**。
- ユーザー裁定(2026-07-10):
  1. **userData分離=プロファイルスロット方式**。永続の名前つきスロット(`<default userData>/slots/<slotName>`)、役割既定スロットは `tracking-default` / `autonomous-default`。同時に生きる二インスタンスは同一スロットを共有しない(使用中ロック、二重要求は明確なエラー)。2窓運用でスロット名は非露出。
  2. **起動引数**: `--role=trackingHost|autonomousHost --profile=<slotName>`(profile省略時 `<role>-default`)。
  3. **Browser Source config(token/preferredPort)をスロット内へ**。tokenはスロットごと生成、preferredPortはスロットごと自動採番(既定: tracking-default=17308 / autonomous-default=17309)。**ユーザーが手でポート番号を設定する状況を作らない**(URLは表示/コピーのみ)。EADDRINUSE時の揮発ポート降格は既存挙動を維持。
  4. **単一インスタンスロックは置かない**(スロットロックが代替。招待の木のN体と整合)。
  5. **kill耐性ゲートはパッケージ版での手動ゲート**(Electron E2Eハーネス新設はしない。機械テストはスロット分離・ロック・config分離のロジック層)。
  6. **C1の自律ホストは静止(default pose)表示で足りる**。「死体に見えない」はC2のゲートであり本waveのスコープ外。
- Source of truth(実装前に読む):
  - 本計画。
  - UX定義: [../screens/c1-role-skeleton.md](../screens/c1-role-skeleton.md)
  - 棚卸し(コード接地事実): [c1-planning-inventory.md](c1-planning-inventory.md)
  - 閉問題定義: [../closed-problem-decomposition.md](../closed-problem-decomposition.md)
  - 設計判断: [../../architecture/runtime-player-model-host-roles.md](../../architecture/runtime-player-model-host-roles.md)
  - wave方式: [../../../runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md](../../../runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md)(方式継承)

## 2. Product Goal

この波の後にできること:

- 役割つきショートカット2つ(引数つき起動)で、トラッキングホストと自律ホストがパッケージ版で同時に立つ。
- 二体は別モデルを同時表示し、window-state / 各種profile / Browser Source token・port がスロット単位で完全に分離される。
- 引数なし起動は最小限の役割選択スタブ(素のダイアログ)を出す。どの役割にも暗黙に束縛されない。
- 片方のプロセスをkillしても、もう片方のフレームは止まらない(手動ゲート)。
- トラッキングホストの単独運用(今日の使い方)は、legacyデータ採用後、従来と等価に動く。

## 3. 責務境界

### 3.1 この波がやること

- スロット解決・スロットロック・userData基点差し替え(app ready前)。
- legacy既定データの一回きり採用(既存ルート直下のprofile類 → `tracking-default` スロットへの冪等コピー。ユーザーの既存キャリブレーション/mapping/dynamics profileを失わせない)。
- 起動引数パースと役割合成(composition root一点での組み立て差し替え)。
- 自律ホスト合成 = 現行合成から入力系レジストラ(input / input-profile / model-mapping)を組み込まない。静止モデル表示。
- Browser Source config のスロット内移設(per-slot token/port)。
- 身元表示: ウインドウタイトルへの役割名、Header役割バッジ(文字+アクセント色)、トレイツールチップ(役割+モデル名)。
- 引数なし起動の最小役割選択スタブ。

### 3.2 この波がやらないこと(Out of Scope)

- 玄関の完全版(カードUI、Create shortcut、Autonomous Host onlyリンク)。
- Companionカード / トレイの `Invite Companion` / 閉扉ダイアログ / 招待の木のシグナル伝播。
- トレイアイコンの役割色ドット(ツールチップのみ本waveで対応。ドットはUX磨きwaveへ)。
- 生理層(C2/C3)、操縦チャネル(C4)、合成(C5)、口(C6)、OBS二体並走の総合確認(C7)。
- 自律ホスト版Overviewの画面設計(C4のUX定義時)。
- Editor / package-format / Runtime Export schema の変更。
- 新規依存の追加、`pnpm install`。

## 4. 設計要点(棚卸しで接地済み)

### 4.1 スロット基盤

- 注入点: `startRuntimePlayerMain()` 冒頭(app ready前)で実効userData基点を `<default userData>/slots/<slotName>` へ差し替える。全storeは `{ userDataPath }` DIで統一済みのため、基点一点の差し替えで全成果物が連動する(store改修不要)。
- スロットロック: スロットディレクトリ内のロックで所有を表明。取得失敗時は明確なエラーダイアログを出して終了する。文言にスロット名を必須としない(例: "A Tracking Host with this profile is already running.")。stale lock(異常終了の残骸)の回復手段を持つこと。
- スロット名の検証: 機械可読規約(空白なし)。パス injection を拒否する。

### 4.2 legacy採用

- `tracking-default` スロットの初回起動時に一度だけ、既存ルート直下の既知store群(window-state / model-mapping-profiles / dynamics-tuning-profiles / input profiles / browser-source config / startup-state)をスロット内へコピーする。冪等(実施済みマーカー)。元データは削除しない。
- legacyレイアウトが想定と異なる場合は黙って推測せずescalate。

### 4.3 役割合成

- 引数パースはcomposition rootの入口で一度だけ行い、役割は「どのレジストラ群を組み立てるか」の選択として表現する。**実行時の `if (role===...)` 分岐は禁止**(Review-Sylphのblocking観点)。
- 役割はstartup status(`getStartupStatus` → `createStartupStatus()`)に `role` を足してrendererへ届ける(新チャネル不要。棚卸し確認済み)。renderer側はこの値を表示にのみ使う(挙動分岐に使わない)。
- 自律ホスト合成でControl shellがページ欠如を許容しない構造だった場合、実行時role分岐を発明せず escalate する。

### 4.4 port / token

- browser-source config をスロットuserData配下へ移す(自然にper-slotになる)。tokenはスロット初回に生成。
- preferredPort: 役割既定スロットは 17308 / 17309。それ以外の新スロットは空きポートを自動採番して永続化。手動ポート設定UIは作らない。

## 5. Wave Strategy

実装は単一のOrch-Sylphがドメインを順次実行する(Domain A/Bはcomposition root `runtime-player-main.ts` の所有が重なるため、並列化しない)。最終統合は別ドメイン。

| Domain | Work | 順序 |
|---|---|---|
| Domain A | スロット基盤: 引数パース、スロット解決/ロック、userData基点差し替え、legacy採用、per-slot browser-source config/token/port | 先行 |
| Domain B | 役割合成と身元表示: 役割別レジストラ組み立て、自律ホスト合成、役割選択スタブ、タイトル/Headerバッジ/トレイツールチップ、startup status role伝搬 | Aの後(スロット解決契約に依存) |
| Domain C | 最終統合: パッケージ版手動ゲート手順書、docs/maps更新、clean review | A/Bの後 |

## 6. Domain A: スロット基盤

Suggested subagent name: `cohost-c1-slot-foundation`

### Primary Files / Areas(棚卸し接地)

- `apps/runtime-player/src/main/runtime-player-main.ts`(合成ルート冒頭)
- `apps/runtime-player/src/main/**` の `app.getPath("userData")` 参照箇所(6箇所)
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts` / config永続化
- 新設: スロット解決・ロック・legacy採用モジュール+テスト

### Required Behavior

- `--role` / `--profile` 引数の解決(不正値は明確なエラー)。
- スロットディレクトリ作成、ロック取得/解放、stale lock回復。
- 全storeの実効userData基点がスロット内を指す。
- legacy採用が冪等に動く。
- 二スロットでtoken/preferredPortが独立する。

### Tests(最低限)

- スロット名検証(不正名・パス注入の拒否)。
- ロック: 取得/解放/二重取得拒否/stale回復。
- userData基点導出(スロット名→パス)。
- legacy採用の冪等性(二回目はコピーしない)・元データ非破壊。
- per-slot config: 二スロットが別token/別preferredPortを持つ。
- Runtime Export / package-format 無変更。

### Escalate 条件

- app ready前のuserData差し替えが既存初期化順と衝突する場合。
- legacyレイアウトが想定と異なり採用マッピングに判断が要る場合。

## 7. Domain B: 役割合成と身元表示

Suggested subagent name: `cohost-c1-role-composition-identity`

### Primary Files / Areas

- `apps/runtime-player/src/main/runtime-player-main.ts`(レジストラ組み立ての役割分岐=合成一点)
- `apps/runtime-player/src/main/window-management/**`(タイトル、トレイツールチップ、役割選択スタブ)
- startup status 経路(`getStartupStatus` / `createStartupStatus`)
- `apps/runtime-player/src/control/**`(Header役割バッジ表示)
- 関連テスト

### Required Behavior

- trackingHost = 現行フル合成(挙動等価)。
- autonomousHost = 入力系レジストラを組み込まない合成。Runtime Export復元と静止表示、Browser Source、window-state等は動く。
- 引数なし = 最小役割選択スタブ(素のダイアログ。選択を記憶しない。「次回から」チェック類は置かない)。
- タイトル: Control="Runtime Player — Tracking Host" 等、役割名を含む(Stage側も同様)。
- Header先頭に役割バッジ(文字+役割アクセント色)。モデル名表示は既存のまま(実質インスタンス識別)。
- トレイツールチップ「Runtime Player — <役割> / <モデル名>」。
- renderer は role を表示にのみ使う。

### Tests(最低限)

- 引数→合成の対応(autonomousHost合成にUDPリスナー/入力レジストラが存在しない)。
- startup status に role が乗る。
- タイトル文字列が役割を含む。
- Headerバッジのrender(role別)。
- 引数なし経路がスタブに到達する(どの役割にも自動束縛されない)。

### Escalate 条件

- Control shellが入力系ページの欠如を合成レベルで許容できない構造の場合(実行時分岐で凌がない)。
- 静止表示のために生理層の先取り実装が必要に見えた場合(それはC2であり、本waveでは行わない)。

## 8. Domain C: 最終統合 / docs / clean review

Suggested subagent name: `cohost-c1-final-integration`

### Required Behavior

- モノレポ検証(typecheck / 対象テスト / 既知baseline failの明示)。
- パッケージ版での手動ゲート手順書を final report に含める(下記)。
- Editorソース・package-format・Runtime Export schema・lockfileの無変更確認。`pnpm install` 不実施確認。
- 実装事実に合わせて関連ドキュメントを更新する。対象: [../screens/c1-role-skeleton.md](../screens/c1-role-skeleton.md)(実装事実の反映)、[../_map.md](../_map.md)、[../../_map.md](../../_map.md)、棚卸しレポートとの差分注記。未合意の新UX方針は勝手に決めない(planning-gateへ戻す)。

### Manual Check Notes(ユーザー手動ゲート、パッケージ版)

1. パッケージ版をビルドし、役割つきショートカット2つを作る。
2. 扉1でトラッキングホスト起動 → 既存モデル・profile・キャリブレーションが従来どおり復元される(legacy採用の確認)。
3. 自律ホストを起動 → 別モデルを読み込み、静止表示される。
4. 二体並走で: window位置・mapping・dynamics tuneを片方で変更 → もう片方に影響しない。
5. Browser Source URLが二体で異なる(port/token)。手動ポート設定がどこにも要らない。
6. 同役割を二重起動 → 明確なエラー、既存インスタンス無傷。
7. **片方をタスクマネージャからkill → もう片方のフレームが止まらない**(C1追加ゲート)。
8. 引数なし起動 → 役割選択スタブが出る。

## 9. Acceptance Criteria

- `--role` / `--profile` スキーマが裁定どおり動く。引数なしは役割選択スタブ(記憶なし)。
- パッケージ版で二インスタンスが別モデルを同時表示する。
- window-state / model-mapping / dynamics-tuning / input profile / browser-source config がスロット単位で分離され、混ざらない(機械テスト+手動)。
- legacy採用でトラッキングホストの既存データが引き継がれ、単独運用が従来等価。
- token/portはスロットごとに独立し、ユーザーが手でポートを設定する場面がない。
- 同一スロット二重起動は明確なエラー(データ破壊なし)。
- 片方killでもう片方のフレームが止まらない(手動ゲート)。
- 実行時 `if (role===...)` 分岐が存在しない(役割差は合成一点。レビューで確認)。
- Editor / package-format / Runtime Export schema 無変更。新規依存なし。`pnpm install` なし。
- 対象テスト・typecheckがパス、または失敗が具体的証拠つきで分類される。

## 10. Subagent Contract

- `pnpm install` 禁止(必要ならescalate、L0がユーザーと調整)。回避工作(手動symlink等)も禁止。
- Editorソース・package-format schema・Runtime Export schemaを変更しない。依存追加・lockfile編集をしない。
- Runtime Export immutabilityを保つ。
- Browser Source = primary broadcast path、Wave10 native preview suspension、Wave11 Stage Motion、Wave12 Variant switching、Wave17 render-frame fast path、Wave18 lightweight diagnostics、Wave19 cadence diagnostics、Wave20 Control close=quit / Stage reopen、Wave21 Dynamics Tune、Wave22/23 vowel lip sync の各挙動を退行させない。
- 実行時role分岐を書かない。役割差はcomposition root一点の組み立て差で表現する。
- 無関係・並行の変更をrevertしない。
- 挙動が決定論的な箇所にはfocusedテストを付ける。
- ドメイン想定外の共有ファイルに触る必要が出たら、広げる前に報告する。

## 11. Review Policy

各実装ドメインに**3レーンのReview-Sylph(別subagent、統合禁止)**:

1. spec compliance(本計画+c1-role-skeleton.md 突合)
2. design/development compliance(合成一点規律、既存アーキテクチャとの整合)
3. test adequacy(ゲートの機械検証部分が実効か)

レビュー固有の確認点:

- 実行時role分岐の不在(blocking)。
- スロット間でprofile/token/portが漏れない。
- legacy採用が元データを破壊しない。
- rendererにrawトラッキング・私的パス・token以外の秘匿情報が漏れない(既存sanitization境界の維持)。
- 引数なし経路がどの役割にも暗黙束縛されない。
- トラッキングホスト合成が現行と挙動等価(退行なし)。

## 12. Orchestration Policy

本waveは Implementation Orchestration skill(`.claude/skills/implementation-orchestration/SKILL.md`)の全規則に従う(ネスト分離 / 在席ポーリング / 閉域 / モデル明示 / ループ上限5 / 早期脱出)。

- L0(Undine): 計画・依存・ユーザー質問・最終判定を持つ。source実装をしない。起動した全subagentを待つ。実行中の子を閉じない。
- Orch-Sylph: 単一。Domain A→Bを順次、各ドメインで bounded な現状確認から始め、実装をGnomeへ、レビューを3レーンのReview-Sylphへ委譲。子の完了は在席ポーリングで待ち、完了した子を閉じる。ドメイン判定と証拠を報告する。
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
- 設計に無い判断分岐は実装で埋めず escalate(L0が裁定して本計画/UX定義を改訂)。
- 子が未完・実行中・未解決のままwave gateを通過しない。

## 13. C1 実装後の申し送り(non-blocking。後続 wave が拾う)

> Domain A/B の 3 レーンレビューはいずれも **blocking ゼロで PASS**。以下は将来 wave 向けの non-blocking 事項(いずれも C1 の受け入れを妨げない)。実装事実は [../waves/c1/domain-c-final-integration.md](../waves/c1/domain-c-final-integration.md) にも集約。

- **N1: 自律ホスト Control の未処理 promise rejection(console ノイズ)**: `control-window-app.tsx` の入力系 pull(input / mapping / input-profile)は `.catch` を持たず、autonomousHost では毎起動 4 件の未処理 rejection を出す。クラッシュ・秘匿漏れ・main ログ汚染はなく非 blocking。**正規解 = C4 の自律 Control UX**(role を表示専用に使い degraded ページを畳む)。暫定 `.catch`(no-handler 握り潰し + pending 表示維持)を C1 で入れるかは据え置き(renderer pull 配線に触れ Domain B の最小スコープ外)。→ §14 質問参照。
- **pid 再利用による false-busy(将来堅牢化候補)**: `slot-lock.ts` の stale 判定は `process.kill(pid, 0)`。Windows で死んだ owner の pid が無関係プロセスに再利用されると busy 誤検出し得る(安全側だが稀に手動 lock 削除が要る)。owner record の `acquiredAtIso` を使った boot-time / max-age フォールバックは未実装。通常ケース(pid が真に死ぬ)では回復済みのため blocking ではない。手動ゲート項目7で挙動を観察。
- **legacy 採用の全エラー silent catch(診断ログ追加候補)**: `runtime-player-main.ts` の legacy 採用は `.catch(() => undefined)` で、cp 途中失敗など異常な legacy レイアウト起因の例外も無言で握り潰す(マーカー未書き = 次回再試行、元データ非破壊でデータ損失なし)。ホワイトリスト方式で「採用マッピングの判断」は生じず §4.2 escalate 条件は不成立だが、「黙って推測しない」精神から**診断ログを残す**検討余地(後続 wave)。
- **防御テスト補強候補(後続 or C1 追撃、いずれも non-blocking)**: (a) 他 store(window-state / model-mapping / dynamics-tuning / input-profile / startup-state)の二スロット独立性の直接テスト(現状は単一基点差し替え機構と config store の独立性テストで担保)、(b) busy 検出前の空スロットディレクトリ作成(cosmetic)、(c) legacy 採用の異常レイアウト時挙動。レーン3 は「合格・要修正なし、補強は推奨に留める」と判定。

## 14. 上位判断待ち(Domain A/B が実装で埋めず上げた質問)

> あなた(Undine / ユーザー)裁定事項。C1 実装は暫定値で動いており、確定は後続 wave / 手動ゲートで拾える。

1. **役割アクセント色の最終確定**: tracking = teal / autonomous = violet を**実装で暫定採用**(既存テーマ整合)。ブランド指定色の有無・最終確定。
2. **busy ダイアログ文言**: `This profile is already in use by a running <役割ラベル>.`(スロット名非露出)を採用。身元表示語彙(Tracking Host / Autonomous Host)と整合済み。最終文言でよいか。
3. **legacy browser-source config の port 正規化**: legacy config が 17308 以外の preferredPort を永続していた場合、**現状は等価優先で legacy 値を保持**(tracking-default に引き継ぐ)。役割既定 17308 に正規化すべきか。
4. **relaunch args 契約の将来拡張**: 役割選択スタブは `…argv.slice(1).concat(['--role=<選択>'])` で relaunch。玄関完全版で `--profile` も選ばせる際、この契約を拡張する前提でよいか。
5. **contract `windowTitle` リテラル型を表示も動的に揃えるか**: 現状は配布=実タイトル / 表示 base=定数の二層。表示側も動的タイトルに揃えるなら型を `string` に widen する小改修が要る(C4 の自律 UX と併せて判断可)。
6. **degraded ページの暫定 `.catch` を C1 で入れるか C4 まで据え置くか**(N1 と同): 据え置きが design 上は素直。手動ゲートで console ノイズがゲート判断の妨げにならないかを確認。
7. **防御テスト補強を C1 でやるか後続か**: §13 の補強候補(a)〜(c)。レーン3 判定は「後続で拾う/推奨に留める」。
