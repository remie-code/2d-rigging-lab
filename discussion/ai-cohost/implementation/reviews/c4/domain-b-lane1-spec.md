# C4 Domain B レビュー(Lane1: spec突合): 粗いオーバーレイprovider

> Review-Sylph(spec突合レーン)→ Orch-Sylph。task=`cohost-c4-overlay-provider`。
> 判定基準: c4-control-channel-v0 §4/§6・c4-wave-plan §1裁定1/§4/§6 Domain B/§8 AC・planning-inventory §2.2。
> 検証方法: 対象ファイル+Domain A store+dispatch を目視、git status で無変更確認、overlay/subsystem/boundary テスト実行(29 passed)。他2レーン(design・test adequacy)とは独立評価。

## 判定: **合格**

全 blocking 観点(合成規則・TTL統一/壁時計・自律専有・physiology純度)が設計に適合。config seam分離・スコープ遵守も適合。boundary test の正規表現厳格化はガードの意図を緩めておらず、実効劣化ゼロを実ディレクトリ構成で確認。Stage Presence 非結合は spec 違反ではなく許容範囲(下記§見解)。

## 各spec観点の評価

### 観点1: 粗いオーバーレイの合成規則(設計§6、blocking)= 適合
`autonomous-frame-heart.ts:222-228`。
- マージ式 `overlay === null ? activations : { ...activations, ...overlay }` は **slotId 単位の上書き**。設計§6「そのスロットIDについてチャネル値が生成器値を単純に上書きする」に一致。
- 挿入点は `generator.sample()`(:200)の後、`resolveSemanticSlotParameterValues`(:225)の**直前**。planning-inventory §2.2 の指定どおり。
- 失効・切断で store の snapshot が縮む → merge が縮む → 該当 slot が生成器(基底)へ戻る。設計§6「失効・切断で生成器(基底)へ戻る」を構造的に満たす。

### 観点2: TTL統一・壁時計評価(設計§4、blocking)= 適合
- heart は2時刻を保持: `logicalTimeMs = max(0, wallNowMs - epochMs)`(:199、generator.sample にのみ渡す=決定論時間)/ `wallNowMs = now()`(:196、絶対壁時計)。**overlay 照会には wallNowMs のみ**(:222)を渡す。混同なし。
- store の `snapshot(nowMs)` は `expiresAtMs > nowMs` で判定(overlay-store.ts:54)。`expiresAtMs` は Domain A dispatch が `receivedAtMs + (ttlMs ?? defaultWindowMs)` で確定(channel-request-dispatch.ts:101,108)する絶対壁時計。**明示ttlMs / 既定窓の両スタイルが同一契約の expiresAtMs 値差**として扱われ、設計§4「同一契約上の使い方の違い」に一致。
- 切断→基底復帰: server が切断時 `clearAll()`(channel-server.ts:158,265)→ store 空 → 次tickで基底。設計§4「切断→基底復帰がプロトコルの構造からタダ」を満たす。
- 混同排除テスト(`judges TTL against the WALL clock`、epoch=1000/expires=1200/wall=1300→logical=300)で壁時計評価を固定。

### 観点3: 自律専有(裁定2、blocking)= 適合
- `composeStaticInputSubsystem`(自律)のみ store を `new`(input-subsystem.ts:231)し、heart に `getChannelOverlay`(:240)を配線、`getControlChannelOverlayStore`(:274)で同一インスタンスを露出。
- `composeTrackingHostInputSubsystem` は `getControlChannelOverlayStore: () => null`(:188)、heart に overlay provider を渡さない。
- 役割差は **合成テーブル/data seam** で表現(`providesPhysiology`/`getStageMotionDrive` と同流儀)。実行時 `if (role === ...)` 分岐は不在。裁定2・wave-plan §9 に適合。

### 観点4: config seam との分離(裁定1)= 適合
- `getPhysiologyConfig`(:190-194)は参照変化で generator **再構築**を伴う config concern。`getChannelOverlay`(:222-224)は値+TTLで**再構築を伴わず** sample 出力へのマージのみ。**別provider・別変数・別挿入点**で混在なし。裁定1「config seamとは混ぜない」に一致。

### 観点5: physiology純度(blocking)= 適合
- `git status` で **physiology/ 配下・headless-slot-resolver.ts・golden JSON は無変更**(diff ゼロを確認)。
- merge は `{ ...activations, ...overlay }` で**新 Record** を生成し sample 出力を mutate しない。純度テスト(`never mutates the generator sample() output`)で固定。オーバーレイは fixture 境界外の runtime 状態として正しく分離。default `() => null`(:158)で既存経路はコピーすら発生せず C2/C3 バイト等価(`byte-identical` テストで固定)。

### 観点6: スコープ遵守(観点7)= 適合
- 変更は role-composition/ の3ファイル + boundary test のみ。**Domain A(control-channel/ store本体・server・dispatch)は再変更なし**(overlay-store.ts は Domain A skeleton のまま、setOverlay/clearAll 呼び出しは server が所有)。
- **Domain C(bridge・ページ・open/close配線)には未踏**。input-subsystem.ts に `getControlChannelOverlayStore` seam を追加したのみで、server への実配線は Domain C 待ちとコメント明記(:271-273)。

## Stage Presence 非結合判断への spec見解(観点6・報告§8-1・質問1)

Gnome は Stage Presence signal を **pure `activations`**(マージ手前、:205-209)から取得し、チャネルが body-x を上書きしても Stage transform は生成器値に従う(非結合)とした。

**spec 見解: 設計違反ではなく許容される仕様判断。** 根拠:
- 設計§6 が規定するのは「そのスロットIDについてチャネル値が生成器値を上書き」= **parameterValues の解決**のみ。Stage transform への波及は設計§6・§4 いずれも未規定。
- Stage transform とチャネルの結合可否は「優先規則の精緻化」に属し、設計§6・wave-plan §3.2 が明示的に **C5 の Out of Scope**(合成の精緻化=滑らかな立ち上がり・減衰・優先規則)へ送っている領域。
- 非結合は wave-plan §9 Subagent Contract「C3(Stage Presence)成果を退行させない」を守る側の選択でもある。

したがって Lane1 として現状の非結合を **通す**。ただし設計が明示規定していない領域ゆえ、「チャネルで body を動かしたら Stage も動くべき」という方向を採るなら C5 精緻化で結合する、という Gnome の質問1は妥当な繰延事項。L0(Undine)の方向確認を推奨する(blocking ではない)。

## 差分

### Blocking
なし。

### Non-blocking
1. **boundary 正規表現の緩和幅(実効劣化なし)**: `/\bfrom\s+["']\.\.\/control/` → `/\bfrom\s+["']\.\.\/control[/"']/`(runtime-player-boundary.test.ts:100-101)。末尾に `/` か引用符を要求するため、理論上 `../controlXXX/…`(control で始まる別レンダラ dir)を見逃す余地が生じる。ただし `apps/runtime-player/src/` のレンダラ dir は実在するのが `control/` と `stage/` のみで、`../control/…`・`../control"`(index import)・`../stage/…` は依然検出される。**実効ガードは不変**(誤検知 `../control-channel/…` = main→main import の除去のみ)。ガードの意図(main→レンダラ control/・stage/ 禁止)は緩めていない。報告§7 の代替(control-channel/ リネーム)より波及が小さく、修正方針は妥当。

## 質問(Orch/Undine判断が要る点)
1. **Stage Presence 非結合の方向確認**: spec 上は現状(非結合、C5繰延)で違反なしと判定した。だが設計未規定領域であり、L0 が「チャネルで body を上書きしたら Stage transform も追従すべき」と考えるなら C5 精緻化で結合する明示方針を残すべき。この繰延解釈で確定してよいか(Gnome 質問1と同一論点、spec レーンとしては非blocking として通す)。

## 実行した機械確認(主張の裏取り)
- `vitest run` overlay統合(8)+ input-subsystem(16)+ boundary(5)= **29 passed**。報告の件数主張と一致。
- physiology/・golden・headless-slot-resolver.ts の無変更を `git status` で確認。
- Domain A の TTL式 `receivedAtMs + (ttlMs ?? defaultWindowMs)`(dispatch:101,108)と setOverlay/clearAll 配線(server:250,158,265)を目視し、TTL統一の end-to-end 契約整合を確認。
