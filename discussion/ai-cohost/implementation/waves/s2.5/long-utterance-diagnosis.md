# 長発話 flash-attn 決定論的崩壊: 診断の恒久記録（S2.5 追撃 domain-f）

> Status: 記録（2026-07-12, Gnome / S2.5 追撃 domain-f）。scratchpad は揮発するため、診断の要点と
> プローブの所在をここに固定する。
> 関連: [../../../experiments/s2-ears.md](../../../experiments/s2-ears.md) §6 訂正注記 /
> [s2-5-followup.md](s2-5-followup.md) / `apps/soul/agent/src/whisper-server.mjs`。

## 1. 症状（人間ゲートで観測）

「約 3.2 秒超の発話の転写が丸ごと消える」または「『,』等のゴミ行になる」。CLI/コクピットの人間ゲートで
ユーザーが観測した。

## 2. 委任時点の診断仮説（本 wave の前提として与えられたもの）

vendor `whisper-server.exe`（whisper.cpp v1.9.1・BLAS 版）は **flash-attn が既定 ON**。動的 audio_ctx
（`whisper-inference.mjs` の `computeAudioCtx`・下限クランプ 256）との組み合わせで、audio_ctx が 256 を
超える域（≒ 発話 3.2 秒超。`computeAudioCtx` の式 `clamp(ceil(sec*50)+96, 256, 1500)` で sec>3.2 のとき
256 を超え始める）に達すると、転写が**決定論的に崩壊**する（丸ごと空 / 「,」等のゴミ行 / 末尾反復）。
既存チューニング（[s2-ears.md](../../../experiments/s2-ears.md) §2.1）は生 TTS WAV を `/inference` へ
直投した格子で、本番の VAD トリム切り出し音声 + flash-attn=ON の崩壊域を踏んでいなかった。preflight-ears
§3.2 は 2 発話とも短く audio_ctx=256 に張り付いたため崩壊を踏まなかった。`-nfa`（flash-attn OFF）で
全ケース正常化・レイテンシ 2.0〜2.4s（目標圏内）を検証済み、とされていた。

## 3. domain-f の対応と実機再検証

### 3.1 対応（委任どおり実施）

`apps/soul/agent/src/whisper-server.mjs` の `buildWhisperServerArgs`/`createWhisperServer` に
`flashAttn`（既定 `false`）オプションを追加し、**既定で `-nfa` を起動引数に含める**よう修正した
（`flashAttn: true` で抑止可能・テスト/切り分け用）。`ear-pipeline.mjs` は `options.whisper` を
`serverFactory` へ spread するため、cockpit・ears-cli・preflight-ears の全既定経路に効く。

### 3.2 回帰プローブと実機再検証結果（正直な記録）

恒久プローブ: `apps/soul/agent/scripts/probe-long-utterance.mjs`（preflight-ears.mjs と同型の縦貫通:
fake マイク→実 Silero VAD→セグメンタ→リング切り出し→実 whisper-server）。3.2 秒を確実に超える発話を
(i) `whisper: { flashAttn: true }`（抑止オプションで意図的に戻した「旧挙動」）と (ii) 既定（`-nfa`）の
両方で実行し比較する。

**実測**（生ログは `probe-long-utterance-run2.log`・scratchpad に保存）:

```
utterance duration: 14.71s
(i)  flash-attn=ON (旧挙動):  audio_ctx=816  text="今日はメッシュ生成の続きをやりながら／随分長い時間このトピックに取り組んでいて／
     焦らず一つずつ確認しながら／少しずつ前に進めていこうと思っていますので／もうしばらくこのまま作業を続けていく予定です"
     latency=4523ms  → 正常転写（崩壊なし）
(ii) flash-attn=OFF (-nfa・採用既定): audio_ctx=816  text= 同上（句点「。」の有無のみ差）
     latency=4726ms  → 正常転写
```

**追加試行（再現性の確認・計 6 回）**: 異なる文面・長さ（11.96s/audio_ctx=680、12.14s/audio_ctx=683、
21.81s/audio_ctx=1099、14.81s/audio_ctx=808 を 3 回反復）のすべてで **flash-attn=ON でも崩壊は
再現できなかった**（全て正常転写。「メッシュ先生」等の聞き違いは s2-ears.md §2.1 と同種のモデル起因
誤認識であり崩壊ではない）。

**結論**: domain-f の実機再検証（計 7 回・audio_ctx 256〜1099）では、§2 の診断仮説（flash-attn ON ×
audio_ctx>256 で決定論的崩壊）を**再現できなかった**。

### 3.3 再現できなかった理由についての仮説（未確定・断定しない）

scratchpad に、委任元の診断過程で使われたと見られる使い捨てプローブ（`probe-fa-matrix.mjs`・
`probe-trim-matrix.mjs`・`probe-audioctx.mjs`・`probe-long-utterance-nfa.mjs` 等）が残っていたが、
実行結果ログは保存されておらず、実際に崩壊が観測された生の出力は確認できなかった。コード上の差分として
気付いた点:

- `probe-trim-matrix.mjs` の `vadTrim()` は**振幅閾値（`|s|>500`）による近似矩形トリム**（前後 ±30ms
  パディング）を使っている。domain-f の再検証（`probe-long-utterance.mjs`）は**実 Silero VAD
  （ニューラルネット・実運用と同じセグメンタ経由）のトリム**を使っており、境界の作られ方が異なる。
  この差（境界ノイズの構造・pad の精密さ）が崩壊の再現条件だった可能性があるが、確認できていない。
- 実マイク（環境ノイズ・残響・マイク特性）由来の音響的特徴が崩壊条件に関与している可能性（domain-f の
  検証は AivisSpeech TTS のクリーン音声のみ。プライバシー規律により実マイクは使用できない）。
- CPU 競合下（配信中に器二体・OBS・ゲームと同時実行）でのタイミング依存（スレッドプール競合等）の
  可能性。domain-f の検証は単独プロセス実行。

**この不確実性を踏まえた判断**: `-nfa`（flash-attn OFF）への変更自体は実測で無害（転写品質は再検証の
全ケースで同等・レイテンシ増は軽微 4523ms→4726ms 程度）であり、崩壊の正確な原因特定が完了していなくても
安全側の変更として維持する。ただし「診断済みの確定事実」として扱うのは時期尚早で、再現条件は未解明の
まま追跡課題として残る（[s2-5-followup.md](s2-5-followup.md) 参照）。人間ゲートで再度長発話の消失が
観測される場合は、実マイク環境下 or 器二体並走下での再現を優先して確認するとよい。

## 4. プローブの所在

- `apps/soul/agent/scripts/probe-long-utterance.mjs`（恒久・回帰プローブ本体）。
- scratchpad の使い捨て診断プローブ（`probe-fa-matrix.mjs` 等）は委任元セッションの成果物であり、
  domain-f では変更・削除していない（scratchpad は揮発領域・恒久記録はこのファイルに集約）。
