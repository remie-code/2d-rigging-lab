# 調査: runtime-player入力パイプラインとAI入力の統合点

> Status: Recorded(2026-07-10)。Sylph調査(リポジトリ)の統合。情報種別: リポジトリ事実+調査所見。
> 対応する設計判断は [../architecture/runtime-player-control-channel.md](../architecture/runtime-player-control-channel.md) に分離。

## 1. 入力パイプラインの現状構造(リポジトリ事実)

- 受信はmainプロセスの `IFacialMocapUdpReceiver`(`apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts`)。
- 流れ: raw UDP → parse → normalize → **`TrackingFrame`**(`apps/runtime-player/src/preload/input-tracking-frame-contract.ts`。ただし `source`/`transport` はiFacialMocapリテラル固定)。
- `TrackingFrame` → セマンティックスロット(`semantic-slot-definitions.ts`: head/eyes/mouth/mouth-vowel×5/body の16スロット)→ calibration/invert/strength → `createRuntimeParameterFrame()` が sanitized な `parameterValues: Record<parameterId, number>` フレームを生成(`apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`)。
- 設計文書が「将来VMC/OSC等のinput source追加時はnormalized tracking frame以降を再利用する」と明言(`discussion/runtime-player/architecture/tracking-input-mapping-baseline.md` §3)。つまり**正規化以降はソース非依存**。

## 2. リップシンクの入力契約(リポジトリ事実)

- 母音推定器(`vowel-lipsync-estimator.ts`)の入力は**顔blendshape 8次元**であり音声ではない。
- 出力は `VowelEstimate = { s, weightByVowel }`: 開き強度 `s`(0..1)と5母音のsoftmax凸ブレンド(Σ=1)。各母音スロットへ `s × weight[v]`、`mouth.open` へ `s`。
- **含意: 「この母音・この強度」は最終的にただの6個のパラメータ値**。AI入力は母音推定器をバイパスし、凸ブレンド不変条件(Σvowel = s = mouth.open)を守って `mouth.vowel.*` / `mouth.open` を直接書けば、既存の口形ブレンドと同じ表現力を持つ。

## 3. パラメータ制御面(リポジトリ事実)

- `RuntimeExportParameterDto` は `parameterId / projectPresetAlias / runtimeRole / externalInput / readOnly / min / max / default` を持ち、`inputManifest.externalInputParameterIds` が外部入力可能IDを列挙。選別は `createDirectTargetCandidates()`(`runtime-export-auto-mapping.ts`)。
- プリセット語彙(`discussion/design/parameter-preset-ecosystem.md` §6): `face.angle.*`, `eye.*.open`, `eyeball.*`, `mouth.open/smile/form/vowel.*`, `brow.*`, `cheek`, `body.angle.*`, `breath`。
- 離散的な表情・衣装は Variant Groups(Live Controllerページ、session-only)。

## 4. tick/評価モデル(リポジトリ事実)

- 固定タイムステップではなく**入力フレーム駆動+rAF合流**。dynamicsの `deltaTimeMs` は壁時計ではなく `sourceFrameTimestampMs` の差分。
- 良い性質: パラメータフレーム列を記録すれば原理上リプレイ再現可能(provenance思想と整合)。
- **注意: フレームが来なければdynamicsも進まない**。AI入力ソースはアイドル時も継続的にフレーム供給する契約が要る。
- 現状は「最新TrackingFrame 1枚」の単一ソース前提。複数ソース合成レイヤは未実装。

## 5. プロセス構造とトランスポートの前例(リポジトリ事実)

- 入力受信・写像・フレーム生成は全てmainプロセス。配信は `publishLatestParameterFrame()` → Stage window IPC + Browser Source WebSocket。
- **前例: OBS Browser Source用の loopback HTTP/WebSocketサーバ(`127.0.0.1`+token認証)が既にmainに存在**(`apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`)。
- 一貫したsanitization境界: Stage/Browser Sourceへはsanitizedな `parameterValues` フレームのみ。raw tracking・calibration内部・privateパスは渡さない。

## 6. 決定性ポリシーとの関係(リポジトリ事実)

- 決定性二層分離(保存/export/provenance不可侵、表示経路は緩和可)が確定済み(`discussion/render-performance/improvement-approach.md` §3-2)。
- 顔トラッキングのliveフレームはsession-onlyで永続化されない。**AI入力も同じ枠に入れれば決定性原則に触れない**。

## 7. 調査所見(挿入位置の推奨)

- 挿入点: mainプロセス `publishLatestParameterFrame`(`model-mapping-bridge-handlers.ts`)前段に「入力ソース合成レイヤ」を新設するのが最も既存設計と整合的。
- 契約レベルは3階層のうち**セマンティック層を推奨**: (a) TrackingFrame注入(AIに顔面筋を演じさせる=遠回り、非推奨) / **(b) セマンティック・インテント注入(プリセット語彙+Variant切替コマンド、推奨)** / (c) 生parameterId直書き(モデル非依存性を失う。デバッグ用途に併設可)。
- 守るべき不変条件: (i) sanitized parameterValuesのみ配信 (ii) `externalInputParameterIds` 外への書込禁止 (iii) タイムスタンプ/sequenceの単調供給 (iv) アイドル時フレーム供給の設計 (v) session-only。
