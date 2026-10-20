# 素材インターフェースを git 前提に作り直す

状態: Accepted（2026-10-20、ユーザー合意）。Wave 1・2 実装済み（[completion](experiments/material-interface-git-completion.md)）。計画は [material-interface-git-wave-plan.md](material-interface-git-wave-plan.md)。
置き換える文書: [material-interface-wave-plan.md](material-interface-wave-plan.md)、[material-interface-contract.md](material-interface-contract.md)、[material-interface-wave-1-a.md](material-interface-wave-1-a.md)。用途の合意 [material-authoring-interface.md](material-authoring-interface.md) は維持する。

## 経緯（実験結果）

2026-10-20、technique-catalog の試行で、顎下の影を新しい部品として素材インターフェースから足した（対象 `second-rigging-6-sol/workspace`、r2149 → r2152）。

- 一手（build / 再 mesh / キー / approve / apply）ごとに約 5 分かかり、apply ではメモリが約 8GB に達した。
- apply はパッケージ全体を `workspace.material-stage-*` に組み立て、元を `.git` ごと `workspace.material-backup-*` へ退避して入れ替えた。
- 首をマスクにする `setMaskRelation` は、候補内の範囲ガードに「protected masks」として拒否された。
- ユーザーは途中で停止を指示した。退避・ロック・候補ストアは削除済み。r2152 は継続利用する。

## 食い違い（リポジトリ事実）

- [premises/operating-policies.md](../premises/operating-policies.md)「Git による巻き戻し（Accepted）」は、手戻りを Git で行うと定めている。
- 用途の合意は「結果をまとめて反映または破棄できるようにする」だけで、方式を定めていない。
- 共通契約（技術 PASS、User Gate 未判定のまま実装）は、これを git を使わない自前の取引として設計した。
  - 候補ストアと 6 状態の状態機械
  - 元パッケージの控え
  - 作業用パッケージの完全複製
  - 全ファイル SHA-256 指紋
  - 承認記録
  - stage / backup 入れ替え
  - 候補内の範囲ガード（`guardMaterialCandidateOperation`）
- これらはコードで強制されており、迂回する選択肢はない（`apps/authoring-host/src/run-material-command.ts` ほか）。

## 判断（設計判断）

1. **インターフェースは git を扱わない。** 反映はコミット、破棄は git による巻き戻しで行い、どちらも呼び出し側の運用に任せる。コミットの粒度（1 操作 1 コミット、または部品追加からキーまでの一連で 1 コミットなど）も運用規則であり、インターフェースは前提にしない。
2. **撤去するもの:**
   - 候補ストア、状態機械、承認
   - 元の控え、作業用の複製
   - 全ファイル指紋による照合
   - apply の入れ替え
   - 候補内の範囲ガード
   - これらに対応する AI 向け 10 コマンド、テスト、`MATERIAL_COMMANDS.md` の該当記述、`llm-workspace/material-interface-*` の作業成果物
3. **残すもの（素材にしかできないこと）:**
   - 取り出し（元テクスチャ・周囲の合成・座標対応を返す。読み取り専用）
   - PNG の検査と RGBA への正規化
   - 配置の合わせ込み（倍率と位置、または対応点と残差）
   - 置いてみる描画（メッシュ前の全 alpha 合成。読み取り専用）
   - 取り出しと置いてみる描画は、読み取り専用の AI 向けコマンドとして残す。
4. **普通の操作へ移すもの:** 新しい operation を 2 つ作る。
   - 「画像から部品を足す」: どのパーツのどこへ入れ、どのデフォーマに付けるかを指定する。
   - 「部品の画像を差し替える」: 部品 ID はそのまま。メッシュを作り直し、指定した形のキーだけをリセットする。
   - 操作の payload には画像ファイルのパス、ハッシュ、配置、足し方を書く。operation log にはパスとハッシュだけが残り、バイトは残らない。
   - ホストはそのパスから PNG を読んで検査し、バイトをセッションに登録してから dry-run / commit を流す（両方の呼び出しで行う）。
   - 既存の取り込み操作の組み合わせは採らない。理由は二つ。寸法と inset がテクスチャ項目に付かないこと、差し替えでメッシュと形のキーを作り直せないこと。
5. **差し替えのときだけ残す検査:** リセット対象に宣言した形のキーが対象部品専用であること（共有キーを巻き添えで消さない）、共有メッシュの拒否。
6. **比較:** 作業用複製と元を並べる比較モードは撤去する。前後の比較は、足した部品の表示切り替えや、操作前後の描画などで行う（方式は固定しない）。
7. **版の表し方:** 取り出しと置いてみる描画の sidecar は、パッケージ ID とリビジョンだけを記録する。指紋と候補 ID は持たない。
8. **旧インターフェースの User Gate:** 判定しないまま置き換える。
9. **進め方:** 軽量。Gnome がテスト込みで実装し、wave の終わりに Sylph が 1 レーンで突き合わせる（voice-swap と同じ形）。

## 維持する前提（リポジトリ事実）

- パッケージのロック（`withMaterialPackageLock`）とエラー型（`MaterialHostError`）は、素材以外の全ホストコマンドが使っている。素材のファイルから中立な場所へ移して残す。
- 普通の保存は JSON を先に書く。バイトをセッションへ登録しないまま画像の参照を commit すると、テクスチャの無いパッケージになる。ホストはバイトの登録を operation より前に済ませ、登録できなければ操作を流さない。
- ホストは同期の operation しか呼ばない。ハッシュ計算はホスト側の同期版を使う。

## 今回の対象外（未決事項）

- 差し替えで使われなくなった古いテクスチャのファイルと項目の掃除（今の普通の操作にも無い）。
- 取り込む画像の透明余白（padding）の方針。当面は今の素材インターフェースと同じく 0。
- operating-policies.md の「パッケージは非バイナリ JSON 群」という記述と、テクスチャのバイナリの関係の整理。
