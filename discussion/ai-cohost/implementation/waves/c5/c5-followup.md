# C5 繰延・裁定待ち事項 follow-up 記録

> 記録者: Gnome(Domain D 最終統合、`cohost-c5-final-integration`)→ Orch-Sylph。
> 根拠 = [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §3.2(Out of Scope)/ §6 Domain D・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §7 / Domain A・A-loop2・B・C 報告 + 3レーンレビューの open 論点・裁量・非blocking観察。
> 性格: **C5 の合否を妨げない**。C5 の機械ゲートは緑・実装は連続性を保つ。ここに残すのは (a) 美的/設計の**裁定待ち**論点(人間ゲートで観察して判断できるもの)、(b) 確定事項の**記録**、(c) スコープ外の既知ギャップ、(d) 将来の任意強化。回収は C6 以降または「実物の魂が繋がる日」。
> 体裁は [c4-followup.md](../c4/c4-followup.md) に倣う。

## 1. ⚠ decay 意味論の open 論点(美的/設計裁定・人間ゲートで観察可能)

- **内容**: `intent.envelope` の decay は現状 **base 非依存に peak→0** へ落ちる(`slot-curve-state.ts` の decay 相)。非零かつ動く base を持つスロット(body 系: `body-x`/`body-z`、あるいは呼吸で常時動く姿勢)では、decay 中に値が **livingBase の下へ一瞬 dip(潜り)** し、その後 release blend が 0→livingBase へ戻す。連続性は導出 bound 内で保たれており**機械的には正**(スナップは無い)。
- **論点**: decay の目標を **peak→0** のまま(現行)にするか、**peak→livingBase**(base 直帰・dip 無し)に変えるか。これは連続性の問題ではなく**表現意図の美的/設計判断**。zero-base(まばたき等の 0 起点スロット)では両者は同一で差が出ない。差が出るのは非零・動く base のスロットのみ。
- **現状の固定**: Domain A loop2 が `control-channel-overlay-store.test.ts` の continuity property に **`sawDipBelowBase===true` の characterization テスト**を追加し、現行挙動(dip を実際に観測しつつ全 walk が導出 bound 内)を無害に固定済み。挙動は変更していない。将来 decay 意味論を変える場合はこの characterization を更新する(その時に気づけるよう assertion で明示済み)。
- **発生源**: Domain A loop2 報告§3/§7(申し送り)、Domain A lane3 質問2。
- **回収目安/判断者**: **C5 人間ゲート**の body 持続駆動(参照ドライバ envelope③ `body-x` peak0.5・長 sustain の減衰)で目視できる。ユーザーがこの dip の見え方の是非を判断 → 是なら現状維持、非なら Undine が decay を peak→livingBase にする設計裁定を出し、Domain A が slot-curve-state の decay ターゲットを差し替え + characterization 更新。

## 2. peak 符号の裁定記録(確定事項・コード対応不要)

- **内容**: `intent.envelope` の `peak` の**符号は「域概念」**であり parse 失敗ではない。centered slot(head/gaze/body、正規化域 -1..1)へ**負 peak を送れる**(例 `head-vertical` peak -0.3 で下向き)。負 peak を `invalidPayload` にはしない。値域外(域 -1..1 を超える)のみ `slotValueOutOfRange` が担当し、クランプせず拒否する。`attack/sustain/decay`(duration)にのみ「負値→`invalidPayload`」が適用される。
- **経緯**: 委任文 Domain B-2 が「peak/attack/sustain/decay の負値 → invalidPayload」と「peak の域外 → slotValueOutOfRange」を同時に要求し、centered slot で**一時的に矛盾**していた(負 peak を invalidPayload にすると centered の負域が range check に到達せず envelope が set より非力になり、表情ピークが片側に潰れる)。Domain B が「peak は非number/非有限のみ parse 拒否・符号込みの域は `slotValueOutOfRange` 担当」(`intent.set` の `value` と同型・連続性原則 3.1 の双方向性・§2 の表現力に整合)と解釈して実装。参照ドライバの重ねがけ envelope が負 peak(-0.3)でこれを実証。
- **裁定状態**: 3レーンレビューが追認、確定。**新しい拒否コードは追加していない**(裁定4遵守、6コードのまま)。コード対応は不要。委任文の一時的矛盾を解消した確定事項として記録する。
- **発生源**: Domain B 報告§9-1(裁量・要確認)、Domain B 3レーンレビュー。

## 3. Channel ページ表示ギャップ(既知・C5 スコープ外 §3.2)

- **内容**: `channel-page.tsx` の `formatEvent`(:186-189)は accepted イベントを **`✓ intent.set …` と固定表示**する。accepted イベントに kind を載せていないため、`intent.envelope` の accepted も画面上「intent.set」と表示される。リグの実挙動(曲線描画・release)は判定本体で正しく、表示文字列は副次。
- **なぜ C5 で直さないか**: §3.2「新しい画面・UX なし。Channel ページの既存イベント/オーバーレイ表示に乗る」。envelope は新規なので**退行ではない**(C4 は envelope が無かった)。表示の精緻化はスコープ外。
- **発生源**: Domain B 報告§9-4(スコープ外・観察)。
- **回収目安**: C5 後の Channel ページ精緻化。候補: accepted イベント(`RuntimePlayerControlChannelServerEvent`)に `kind?` を **additive** に足し、`formatEvent` を kind 非依存化(`✓ ${kind} …`)。read-only 観測面の additive 拡張で契約意味論は不変(C4 followup #1 の logSlotId と同種の additive 手法)。
- **人間ゲートへの注記**: ユーザーが Channel ページで `intent.envelope` 送信時も「✓ intent.set」と表示されるのを見て混乱しないよう、Domain D 報告の人間ゲート手順に注記済み。

## 4. 非blocking coverage 穴・将来の任意強化(lane3 由来)

- **内容**: 3レーンレビュー(特に lane3 test-adequacy)が挙げた**非blocking**のカバレッジ穴。C5 の機械ゲートは緑で合否に影響しないが、将来の堅牢化候補として記録:
  - **Stage の `body-z` 駆動の追従テスト**: Domain C の Stage follow テストは `body-x` の追従を機械証明したが `body-z`(depth)は「curve 無し=無退行」側のみ。チャネルが `body-z` を envelope 駆動したとき depth が追従する end-to-end は未固定(source 構造上は `resolvedActivations[BODY_Z]` を読むので追従は必然だが、テストとしては未実演)。
  - **両 body 同時駆動**: `body-x` と `body-z` を同時に envelope 駆動し、Stage の horizontal/depth が同時追従する組み合わせは未固定。
  - **release 中の body 中間値の Stage 追従**: release blend の中間値を Stage が滑らかに追う(スナップ注入なし)ことは Domain C lane2 が design 上担保と評価したが、専用の end-to-end テストは未追加。
  - **coupling の end-to-end 実演**(resolver 変形と Stage オフセットの**同時**追従): Domain C の Stage follow テストは `slots:[]` のため resolver mapping を排して Stage snapshot 単体を分離しており、coupling 自体は source 構造から必然だが実演テストは無い(lane2 が「test-adequacy の判断領域」と明記)。
- **発生源**: Domain C lane3 test-adequacy、Domain C lane2 design(注記)。
- **回収目安**: 任意。C6(音素タイムライン)が曲線機構を再利用する際に Stage 追従の網羅を併せて強化するのが自然。

## 5. 参考: C4 followup から C5 で解消した事項(繰延ではない)

記録の完全性のため、[c4-followup.md](../c4/c4-followup.md) の項目のうち C5 で解消したものを併記:

- **c4-followup #6「Stage Presence とチャネルの結合可否」(⚠ Undine 方向確認事項)**: C5 設計 §1 裁定1「合成後の実効 body 信号に追従」で**方向確定**し、Domain C が `autonomous-frame-heart.ts` の Stage snapshot を pure `activations` → 合成後 `resolvedActivations` へ差し替えて**実装済み**。「体は一つ——誰が体を動かしても画面はついてくる」が成立。C4 の非結合は解消。
