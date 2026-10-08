# 口数配線+コーディ語彙登録 planning inventory

> Status: 完了(2026-07-14)。2小タスク(A=口数実配線/B=コーディ語彙登録)を1waveで。棚卸し全項目が事実で閉じ、設計は裁定済み。wave計画は [verbosity-vocab-wave-plan.md](verbosity-vocab-wave-plan.md)。
> 実施: Sylph(コーディ=whisper prompt実態)・Sylph(口数=scheduler/UI/結線)。
> 出自: 操縦席改定followup §1(口数→s6-followup §12)+ s6-followup §2(コーディ=Whisper initial prompt)。

## A. 口数モード実配線

### A-1. 定数の現状と実行時再構成(fire-scheduler.mjs・file:line)

全tunable定数はcreateFireScheduler(:276)生成時に`const`捕捉(:290-301)——closureに焼き込み・**実行時setterは`setEnabled`のみ**(:463)。定数束を実行時差し替えするには**const→let化+`setVerbosity(mode)`を`setEnabled`隣(:473後)に追加**が既存差分最小(Sylph評価: 再生成案は予算/lastFireAtMs/在武装タイマが飛ぶ=状態喪失で不可・live-ref案は新パターン導入で侵襲大)。

現行値(全系統):
- turn-end: SILENCE_MS 2000(:62・**turn検出=モード不変**)/PROBABILITY 0.35(:68)/REFRACTORY_MS 8000(:74)
- silence: BASE_MS 45000(:80)/JITTER_MS 30000(:86)/REFRACTORY_MS 90000(:92)/BUDGET 6(:98)
- **comment(S7・棚卸し主目的)**: REFRACTORY_MS 8000(:105)/PROBABILITY 0.35(:112)/BUDGET 30(:120)——turn-endの写経(予算のみコメント量を見越し30)
- comment-call(コメント内呼びかけ)は**希釈一切なし・命中即発火**(:444-449)=口数の影響を受けない構造(呼びかけ免除と整合)
- name variants(call音声/commentテキスト)は口数と無関係

予算は`let`(実行中減算・silenceBudget :308/commentBudget :310)。

### A-2. 確定した定数束(裁定済み+コメント値はうちの推奨・untested扱い)

口数が差し替えるのは**turn-end確率/不応期・silence基礎/ジッター/不応期/予算・comment確率/不応期/予算**の9値。turn検出(TURN_END_SILENCE_MS)とname variantsは不変。

| モード | turnEnd確率 | turnEnd不応期 | silence基礎 | silenceジッター | silence不応期 | silence予算 | comment確率 | comment不応期 | comment予算 |
|---|---|---|---|---|---|---|---|---|---|
| **控えめ** quiet | 0.15 | 15000 | 90000 | 30000 | 120000 | 3 | 0.15 | 15000 | 15 |
| **ふつう** normal(現行) | 0.35 | 8000 | 45000 | 30000 | 90000 | 6 | 0.35 | 8000 | 30 |
| **おしゃべり** chatty | 0.70 | 4000 | 25000 | 20000 | 60000 | 12 | 0.70 | 4000 | 60 |

- **非発火率の裏取り**(おしゃべり0.7): 連続無視=(1-0.7)^N → 3回2.7%・4回0.81%(ユーザー許容曲線「3回稀・4回望ましくない」に適合)。現実マッピング: 控えめ≈6.7回に1回/ふつう≈2.9回に1回/おしゃべり≈1.4回に1回(1/p)。
- comment値はturn-endの積極性を写経(prob=turn-end同値・予算はコメント量見越しで倍)。**S7 YouTube実ゲートが後日保留のためこの人間ゲートでは体感不能=untested扱い・YouTube時に詰める**(ユーザー了承の方針)。
- 予算の途中変更: setVerbosityは新モードの残予算を新max へリセット(=モード切替=そのモードの満額から。v0の素直な意味論)。

### A-3. UI/結線/永続化の写経元(file:line)

- 運転バープルダウン: VERBOSITY_OPTIONS(control-bar.mjs:50-54・quiet/normal/chatty)・useState "normal"(:109)・**現状no-opはonChange :183が`setVerbosity`ローカルのみ**(:178-188)。POST写経元=onToggleSelfFire(:142-161・doFetch→json→エラー判定→成功時applySnapshot)。
- サーバ: POST /api/self-fire(cockpit-server.mjs:861-880)を写経→`/api/verbosity`を:880後に追加。反映口=scheduler.setVerbosity(A-1新設)。snapshot載せは`selfFire:{enabled}`(:482)を写経し`verbosity:scheduler.getVerbosity()`を追加(現況源=scheduler側=selfFire型に倣う)。
- hooks: createSelfFireHooks(scripts/cockpit.mjs:294-309)を写経→createVerbosityHooks(初期値resolve+onSetVerbosity)・注入は:536-538隣。
- 永続化: 文字列キーの写経元=getVisionTarget/setVisionTarget(cockpit-settings-store.mjs:113-119・asStringOrNull)。`verbosityMode`キー追加。初期解決順: settings有れば復元・無ければ "normal"。

## B. コーディ語彙登録

### B-1. 確定事実(whisper prompt・file:line/出典)

- whisper.cpp v1.9.1 serverは`/inference`の**`prompt`マルチパートform fieldをリクエスト毎に受理**(v1.9.1タグ実ソース: `req.has_file("prompt")`)。起動時`--prompt`も両立。
- 本番経路は**whisper-inference.mjs**(ear-pipeline.mjs:65,388が使用・whisper-client.mjsはpreflight専用)。差し込み点=`whisper-inference.mjs:100`の`audio_ctx`注入の隣に`form.append("prompt", promptText)`1行(既存の条件付きform注入と同型)。
- 転写バッファ/セグメンタ/VAD/リング/WAVは**prompt を一切通らない**=正本の形不変(ear-pipeline.mjs:281,287はtextのみappend)。

### B-2. 裁定と検証

- 適用方式=**リクエスト毎(whisper-inference.mjs:100)**(ユーザー「君の推奨でいい」)。
- プロンプト=静的な短い刷り込み文(v0当たり「こーでぃー、コーディ。」)——コード内定数(ツマミにしない・数値/文字列はコード内定数の流儀)。
- **検証ゲート=スイープ計測**: TTS合成(AivisSpeech×話速/ピッチ/抑揚振り)×prompt有無で ①名前入り音声の正答率 ②**名前なし音声への幻聴混入率** を集計。部品はbench-asr.mjs(TTS合成:55-76・/inference直投:78-93=`form.append("prompt")`1行で比較可)+probe-long-utterance(実VAD縦貫通)。恒久スイープスクリプトは無いので新規に組む(部品は揃っとる)。
- 実マイク不使用・音声メモリ内のみ・ディスク非書き込みの規律を継承。

## C. 機械/人間ゲート(wave用)

- 機械: 全テスト無退行・3チェック無退行・lockfile/器/依存不変・口数の定数束切替とsetVerbosityの純ロジックfixture・コーディのprompt注入で既存耳挙動無退行・**スイープ計測は実whisper-server起動を要するため人間ゲート寄りの実測**(機械テストはfake/純ロジックまで)。
- 人間: 口数=控えめ/ふつう/おしゃべりで自発発火の頻度が体感で変わる(区切り+沈黙・コメントはYouTube保留)。コーディ=スイープ結果を見て「コーディの正答率が上がり幻聴が許容内」を判定+実発話で呼びかけが拾われやすくなったか。

## D. Plan directly の根拠

裁定・写経元・現行値すべてknown。残る実装細部(setVerbosityの予算リセット意味論・snapshot現況源=scheduler側)はL0裁定済み(上記)。コメント値のuntested扱いもユーザー方針と整合。
