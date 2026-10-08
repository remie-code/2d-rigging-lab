# AI Cohost: 合意済み前提

> Status: Accepted(ユーザー合意 2026-07-10)
> Owner: Undine / ユーザー

以下はユーザーとの対話で確定した前提・制約であり、設計はこれらを所与として行う。

## P1. 会話LLMは Opus 4.8 以上(ユーザー決定)

会話の自然さは必須要件であり、Opus未満のモデルでは言葉がぎこちなくなるため会話役に使わない。

- 補足(設計判断の含意): Fable 5は思考が常時オンで発話レイテンシと費用の面で会話役に不利。会話役の第一候補はOpus 4.8([../research/llm-cost-estimate.md](../research/llm-cost-estimate.md))。
- 相槌などLLM品質を要さない反射的発話は、この要件の対象外(ローカル反射層で処理する方向。architecture/ 参照)。

## P2. ユーザーは配信中ほぼ常時発話する(制約事実)

ユーザーの自己申告: 「基本的にずっとしゃべっているくらいしゃべっている」。

- 含意1: AIの発話量ではなく**ユーザー発話の取り込みと宛先判定**が設計の中心課題になる。
- 含意2: 費用の支配項は転写量ではなく「AIが思考する回数×コンテキスト×出力」(prompt cachingにより転写の再読はほぼ無料)。

## P3. 費用前提と費用メーター

- 試算(2026-07-10時点、[../research/llm-cost-estimate.md](../research/llm-cost-estimate.md)): Opus 4.8常用で1配信(2h)約$3.5〜7、月16配信で約$55〜110。ユーザーはこの水準を受容済み。
- 試算の最大の不確定要素は「LLMを起こす頻度」のチューニング。**配信ごとの費用メーター(APIレスポンスのusage集計)を最初から実装し、発火頻度は実測で決める**。

## P4. AI入力は session-only の表示層(決定性境界)

AI共演者によるパラメータ駆動は、顔トラッキングと同じく「session-onlyの表示層入力」として扱い、保存・export・provenanceのバイト互換(決定性二層分離の不可侵側)には一切触れない。

- 既存判断の延長: [../../render-performance/improvement-approach.md](../../render-performance/improvement-approach.md) の決定性二層分離、および runtime-player の既存トラッキング入力の扱い([../research/runtime-player-input-integration.md](../research/runtime-player-input-integration.md))。

## P5. 開発リズム: 最小増分・実機ゲート

既存の開発リズム(最小増分→実機観測→次を決める)を本構想にも適用する。先回りで器や機能を作らず、宛先判定・ターンテイキング等は最も単純な形から実機ゲートを通して段階的に自動化する。
