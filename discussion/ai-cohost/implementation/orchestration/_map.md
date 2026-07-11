# AI Cohost Orchestration Map

> ai-cohost実装waveの計画とplanning gate成果物。

| Path | Status | Content |
|---|---|---|
| [c1-planning-inventory.md](c1-planning-inventory.md) | 完了(2026-07-10)。Verdict needs_design → ユーザー裁定で解消 | C1のコード接地棚卸し(合成ルート、userData DI、port/token、UDP、ライフサイクル、テスト流儀) |
| [c1-wave-plan.md](c1-wave-plan.md) | **完全閉鎖(2026-07-10)**: 実装+3レーンレビューPASS+パッケージ版手動ゲート全項目合格+§14裁定済み | C1「二体が同居できる」wave計画: スロット基盤(Domain A)→役割合成と身元表示(Domain B)→最終統合(Domain C)。既知制限: dev引数なし起動(Status参照) |
| [c2-planning-inventory.md](c2-planning-inventory.md) | 完了(2026-07-10)。Verdict needs_design → ユーザー裁定5件で解消 | C2のコード接地棚卸し(頭無し写像の可否、素の既定の挙動、意味スロット受け口の構造ギャップ、フレーム心臓の空白、決定論流儀) |
| [c2-wave-plan.md](c2-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+3レーンレビュー全PASS+手動美的ゲート合格(瞬きに違和感なし・OBS確認・二体非干渉) | C2「身体が呼吸する(まばたき)」wave計画: 頭無しリゾルバ(A)→生成器骨格(B)→フレーム心臓と統合(C)→最終統合(D)。単一Orch-Sylph順次。実装報告 [../waves/c2/](../waves/c2/)、レビュー [../reviews/c2/](../reviews/c2/) |
| [c3-planning-inventory.md](c3-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定8件で解消 | C3のコード接地棚卸し(生成器拡張適合性、連続系スロット既定、body平滑交差、永続化テンプレ、ツマミ即時反映の口の不在=主コスト、quick toggle実体、fixture配分) |
| [c3-wave-plan.md](c3-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+レビュー全PASS+追撃(§12 Domain F)+手動再ゲート合格(キャプション・Stage Presence知覚性) | C3「視線と頭が生きる」wave計画: ノイズ/バネ基盤+即時反映seam(A)→振る舞いクラス3種+結合(B)→Physiologyページ+プロファイル(C)→Stage Presence(D)→最終統合(E)→追撃(F)。実装報告 [../waves/c3/](../waves/c3/)、レビュー [../reviews/c3/](../reviews/c3/)。既知baseline fail=Wave21 browser-source(C3対象外) |
| [c4-planning-inventory.md](c4-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定9件で解消 | C4のコード接地棚卸し(WSサーバ複製、オーバーレイ挿入点、第二ポート、診断bridge、特区の物理コスト=lockfile問題、拒否列挙土台、degraded対象)。**check:depsのDAG検証は存在しないという事実誤認を発見**(憲章§6訂正の契機) |
| [c4-wave-plan.md](c4-wave-plan.md) | **完全閉鎖(2026-07-11)**: 実装+レビュー全PASS(blocking 2件はwave内充足)+一目確認合格。持ち越しのStage結合裁定はC5設計討議で解消済み | C4「外から動かせる」wave計画: 契約の家+チャネルサーバ(A)→オーバーレイprovider(B)→Channelページ+degraded解消(C)→特区+参照ドライバ+方向ルール検査(D)→最終統合(E)。RTT実測 p95≈1.5〜2ms |
| [c5-planning-inventory.md](c5-planning-inventory.md) | 完了(2026-07-11)。Verdict needs_design → ユーザー裁定4件で解消(設計討議§7) | C5のコード接地棚卸し(オーバーレイstoreの曲線化=主コスト、実効値経路、release一般化、Stage差し替え、契約追加、fixture形。曲線数学=C3 blinkの写経、新サブシステム無し) |
| [c5-wave-plan.md](c5-wave-plan.md) | Ready to launch | C5「合成が正しい」wave計画: スロット曲線状態機械(A)→契約+ドライバ拡張(B)→Stage Presence実効値化(C)→最終統合(D)。人間ゲート=参照ドライバ実駆動(魂殺しの観察が目玉) |
