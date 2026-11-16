# 笑みのニュアンス5本の登録

承認済みの比較対象は画面左の相手向け5本。柔らかく微笑む、嬉しさが弾む、少し得意げ、息を抜いてから微笑むは smile-nuances-v1 の 01・02・04・05、照れながら笑うは shy-aversion-v2 の相手→そらす→相手を採用する。

1. Gnome が version 2 の外部 asset に5本を登録する。比較試作の固定値、曲線、時間、強さを再生経路で照合し、試作プレビューの口閉じを除く。親の意味と子の違いをプロンプトで判別できる記述にする。
2. Review-Sylph が試作データ、asset、loader、検証結果を独立に照合する。全 catalog の正常読込、相手向け5子と5組、game/viewers の未制作、none と既存 shared-laughter の共存を確認する。
3. 配布済み exe と隔離した外部 asset で起動・選択・再生経路を検証する。現用 autonomous-default に外部 JSON を配置して一致 hash と既存9 asset の hash を確認する。現用アプリの再起動はユーザー操作とする。

根拠は experiments の performance.json、definition.json、README.md、render.mjs と、search-nuances-registration および external-motion-assets の検証記録。
