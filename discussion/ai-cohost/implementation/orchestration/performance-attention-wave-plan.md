# 演技×注意対象で制作済みモーションを選ぶ

2026-11-12。ユーザーが2 Wave構成・簡易オーケストレーションに合意し、計画作成と起動を指示。`codex/intent-motion` 上で継続。先行意図モーション・Stage Y・議論等の未コミット差分を保持する。

実装Orch/Gnome/独立Review-Sylphはすべて **GPT-6.1 Sol (`gpt-6.1-sol`)**。演技そのものの創作修正が必要ならrootへ報告し、Astraで見え方を確認する。移植を理由に承認済みの曲線を勝手に弱めない。

## 1. User Gateと範囲

チャッピーが発話区間へ自由に添えた意図を、発話・会話文脈とともに読み取り、一回のDecisionリクエストの独立二問で「演技」と「注意対象」を選ぶ。制作済みの組み合わせを機械的に引き、対応する作り込んだモーションを再生する。未対応の実例を後から読み、次の制作を相談できる。

- 本人の自由な意図を尊重する。候補語彙を本人へ強制せず、本文と意図の一致を採点・修正しない。
- Decisionへ演技×対象の直積候補を列挙しない。各質問は別の候補群を持ち、同じ入力を参照する。互いの回答に条件づける判定とは扱わない。
- 初期対象は **相方（キャラ右/画面左）・ゲーム画面（正面）・視聴者（上）**。対象不明は別の明示結果。前の対象への自動置換・維持を今回の候補に加えない。
- 初期組み合わせは **receive/interest/ask × 相方の3組**と、**短く息を抜く × 相方/ゲーム/視聴者の3組**、計6組。
- 既存3種の相方向けへの配置はユーザー判断。既存曲線を無断で新規制作し直す依頼ではない。独立した再生としての開始・接続に課題があれば事実を示して調整する。
- 原本・provenance・再現手順・代表プレビューをGit管理できる適切な場所へ保存し、実行用定義との対応を追えるようにする。tmpやチャットだけを復元根拠にしない。外部モデル・録音・秘密情報は取り込まない。
- 発話の速さを優先する。判定・記録を音声開始の待機条件にしない。対応する音声再生に対して動きが多少遅れてよい。
- **通常の発話終了では、動きを自然な終わりまで続ける。割込み・killでは解除する。** 古い世代・切断した接続からの結果で新しい発話を動かさない。新しい区間等との競合はbasisで明記し、過去の動作を不自然に積み残さない。
- 未対応演技、対象不明、未制作の組み合わせを区別し、その区間の演技は足さず、原意図・発話・文脈・選択値・再生状態とともに残す。拒否/通信失敗/中断は別に扱う。別対象のクリップで無理に埋めない。
- 採用済み新3案の見え方を保つ。正面ニュートラルは制作基準であり、現姿勢を毎回正面へ不自然に引き戻す規則ではない。横向き80%上限、笑み・眉差分追加なし。
- Stage Presence Offでも演技用Yは働く。既存X/zoom・手動配置・口・頭・視線と共存する。普段のidleの強さを一律変更しない。
- 最後は**普段使う `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` とportableを更新**する。
- 本人確認: 更新exeで実際にチャッピーと会話し、対象に合う動きと自然な終わりを見る。実記録から未対応理由を読み、次の制作に戻れることを確認する。機械passを本人の美的・実会話passと呼ばない。

## 2. 根拠と技術棚卸し

- [演技×対象の合意・context-check §7](../../concept/speech-motion-performance-and-attention.md)、[採用済み3案](../../experiments/speech-motion-brief-relief-variants-v1.md)。
- 制作原本 `tmp/speech-motion/brief-relief-variants-v1/` の `definition.json`、`provenance.json`、`README.md`、再現scripts、個別/比較MP4。r804モデルは `C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime`（読取のみ）。
- 先行 [意図モーション](intent-motion-wave-plan.md)、[Stage上下動](stage-vertical-motion-wave-plan.md) のcompletion/reviewは到達点の根拠。
- Soulの `speech-intent-motion.mjs` は複数問helperに1問を渡す現行。判定はタグ受信時開始、本文は後で集まる。発火時会話窓はdelivery作成時に取得済み。全文をいつ待つかで演技開始の間に合い方が変わる。
- `speech-motion-presets.json` は現行共有登録。ワイヤーはpresetIdと区間ライフサイクル。今回演技×対象lookup、clip識別・metadata・記録理由を追加する。
- 試作の7軸は既存semantic slotsに対応するが、モデル単位の値を直接渡す試作とmappingを経る製品は同じではない。相方版Body Xは−5.8/終端−5.0、現行r804既定mappingは±3.5まで。曲線の意味を保つ再生経路が必要。
- 製品は初期値へ180msで進入し、通常400msでidleへ解除する。新試作は頭・胴・目の対象向き終端を保持しており、製品終了処理は未再現。Stage Yは試作でも製品補間・解除を使用するが、実音声のendで短縮される現行挙動を今回の合意に合わせる。
- 公式複数問の確認は概念文書§5。今回の二問構成での品質・速度は未測定。既存Decisionモデルと実装エージェントSol指定は別で、製品モデルを勝手に変更しない。

## 3. Wave構成

Wave 1の独立レビューを受領してからWave 2を起動。各WaveはOrch一人が依存を順に管理し、Review-Sylph一人が契約・実装・試験・実表示を統合レビューする。

### Wave 1 — 原本・登録・再生を揃える

1. 原本と実行定義の保存場所・所有・版対応を、既存discussion規約とRuntime/Soul共有契約に沿って定める。再描画がtmp内ファイルに依存しないことを確認する。大きい中間フレーム列はGitに投入しない。
2. 演技・対象・制作済みclipの登録を分離し、初期6組を配置する。演技と対象を直接指定して解決できる小さな契約を定め、Wave 2へ引き継ぐ。従来クライアントの呼び出しをWave途中で壊さない。
3. 新3案の保存曲線を製品で再現する。相方Body Xの到達域を手当てし、モデル識別・mappingの適用範囲を明示する。他のモデルへの互換性を未検証のまま保証しない。
4. 現姿勢からの進入、通常終了時の完走と自然な終わり、次区間・中断・kill・切断・再接続・古い世代を接続する。終了後に無期限の姿勢やStage変位が残らないようにする。
5. 6組の直接指定→実再生を確認。新3案を採用済みプレビューと同条件で見比べ、実行時の頭/胴/目/Stage Yの一致範囲と差分を示す。neutral以外から入るケース、短い発話で通常終了、割込みから解除を含める。
6. 独立レビュー後、basis/completion/再生・登録契約をWave 2へ渡す。機械判定で美的同等と断言せず、実モデルの視覚証拠を添える。

Wave 1 gate: **選択を直接指定すれば6組を再生でき、原本からの再現とライブでの見え方の範囲を説明できる。独立レビュー合格。**

### Wave 2 — 二問判定・記録・実会話へつなぐ

1. 現行複数問helperで演技と対象の二問を組み、原意図・発話・直前文脈を共通入力へ渡す。対象は3候補＋不明、演技にはどれでもないを用意する。制作済み組み合わせの有無で意味の判定を別対象へ寄せない。
2. 本文が得られる時点・送る範囲と、逐次/一括生成の扱いをbasisに明記。判定と音声を並行させ、遅い結果・順序逆転・中断・完了後を確認する。音声は判定待ちにしない。
3. 選択結果をWave 1のlookupへ渡して再生。全組合せ列挙や追加の二段目Decisionは導入しない。
4. 未対応演技/対象不明/未制作pairを理由付きで永続記録する。実際の区間本文・文脈・選択値・プレーヤー観測範囲を保持し、聞こえた文字数を推定しない。既存228件等を破壊・上書きしない。
5. 制御した実送受信の統合試験、少数の非私的入力による実Decision二問確認を行う。入力文脈で対象が変わる例、none/不明/未制作pair、拒否/失敗を区別。判定単体と会話全体の速度を分けて報告する。
6. 独立レビュー後、dist:win相当でwin-unpacked/portableを更新し、最新登録・曲線が含まれることを確認。隔離起動でモデル/再生を確認し、ユーザー向け手順と記録の入口を用意する。

Wave 2 gate: **意図・本文・文脈→二問→lookup→再生または理由付き記録の実接続が成立し、音声を待たせず、配布物から確認できる。独立レビュー合格。** 本人の実会話評価は別。

## 4. 検証と簡易レビュー

- 1 Waveあたり独立Reviewer一人。spec/design/testの3レーンへ機械的に増やさず、修正は対象を絞り再確認する。上限5巡、ユーザー価値に関わる穴や大規模な再設計が見えたら早めにrootへ戻す。
- 原本→実行定義の対応、6組/未制作pair、モデルmapping、同tickの頭・口・Stage Y、通常endとcancelの違い、遅着・重複・接続所有者を検証する。
- 実WebSocketとr804描画を使う。StageとBrowser Sourceは、後者接続中にNativeが停止する既存仕様を踏まえて順次確認する。実OBSアプリ・マイク・配信を無断で起動しない。
- 関連required checksを実施し、基点由来の `physiology/index.ts` source guard違反を新規回帰と分ける。合格後の理由なき全件反復はしない。
- 実行定義・配布物・ライブ見え方は独立Reviewerが実物で照合。rootも受領した比較画像を目視する。

## 5. オーケストレーション・所有

Undineは計画・上位map・User Gate・依存・受領を保持し、source/tests/domain差分を直接作らない。

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

- 全委譲で `[subagent-call] 呼び出し元: ...` を付ける。実装Orch/Gnome/Reviewerは **gpt-6.1-sol、fork none**。創作が必要な場合はrootがAstraへ別途依頼する。
- Gnomeの所有module/fileを明記し、共有workspaceの他者差分をrevertしないことを伝える。既存作業ツリーはcleanではないが、ユーザーが継続を承認済み。無断commit/checkout/merge/pushをしない。
- root所有: 本計画、`orchestration/_map.md`、`implementation/_map.md`。
- Orch所有: `waves/performance-attention/` のwave別basis/completion/引継ぎ契約/human-gateとmap。Reviewer所有: `reviews/performance-attention/` とmap。
- 原本保存先・必要な関連ドメイン文書の所有はOrchが限定割当て。ルートのconcept合意を無断で書き換えない。
- 現在の本物のアプリ・配信設定・外部モデルを変更/終了しない。配布物上書きは承認済みだが、稼働中ロックを強制終了で解決しない。
- Windows安全規則に従う。検証アプリのStart-ProcessはHidden、所有したプロセスと一時領域だけを後片付けする。
- pnpm wrapper EPERMの場合は既存npm/ローカルCLIの等価経路可。必要なネット・loopback権限は適切なrequire_escalatedで取得する。portable初回展開は30秒以上かかった先例あり、短すぎる観測で起動失敗と判断しない。

## 6. 状態

| 項目 | 状態 | 入口 |
|---|---|---|
| Wave 1 | 機械gate合格・root受領 (2026-11-12) | [completion](../waves/performance-attention/wave1-completion.md) / [契約](../waves/performance-attention/wave1-contract.md) |
| Wave 1レビュー | 独立レビュー合格。rootも同期Native/Browser比較を目視 | [review](../reviews/performance-attention/wave1.md) |
| Wave 2 | 実装・機械gate合格・root受領 (2026-11-12) | [completion](../waves/performance-attention/wave2-completion.md) |
| Wave 2レビュー | 配布物照合を含む独立レビュー合格 | [review](../reviews/performance-attention/wave2.md) |
| exe更新・本人確認 | 通常版/portable更新・隔離起動合格。本人の実会話確認待ち | [human gate](../waves/performance-attention/human-gate.md) |

二問の実Decisionは非私的な合成6例で確認。判定往復226〜1529msであり、会話全体の音声初動の実測とは扱わない。制御試験で音声が判定を待たずに開始することを確認した。既存未対応記録228件は作業前後でハッシュ一致。Native/Browser比較は描画結果を確認したもので、実配信の描画頻度・体感の自然さは本人確認に残る。通常版とportableのasar一致と6組の実WS適用を独立レビューが照合済み。
