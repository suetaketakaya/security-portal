# zoopass → Virtual Automotive Test Lab

車載器テスト設計ワークショップ「**Virtual Automotive Test Lab**」用の、車載インフォテインメント **VATL-100**（架空）のエミュレーター。
参加者は仕様書を読んでテストケースを設計し、ブラウザ上のエミュレーターで実行して不具合を見つける。

> 以前の ZooPass（入園予約アプリ）は、このフォルダを書き換えて作った。元のコードは Git の履歴（コミット `0fba4fc`）に残っている。

| 項目 | 値 |
| --- | --- |
| Firebase プロジェクト | `zoopass` |
| 使用サービス | Hosting のみ（Firestore はすべて拒否するルールだけをデプロイ） |
| 画面 | `/` エミュレーター、`/spec` 仕様書 |
| 独自ドメイン | `zoopass.suetaketakaya.com` |

## 構成

```
frontend/public/
  index.html       エミュレーター（ヘッドユニット・車両信号パネル・状態表示・操作ログ）
  spec.html        参加者向け仕様書（要求ID つき）
  js/unit.js       VATL-100 の動作モデル（DOM 非依存。テストからも読み込む）
  js/app.js        画面表示と入力の受け渡し
  css/style.css
database/
  firestore.rules  すべて拒否（旧 ZooPass のデータを読み書きさせない）
tests/
  unit.test.js     仕様どおりに動く部分のテスト（node --test）
instructor/        講師用の解答（.gitignore 済み。GitHub には含めない）
```

## エミュレーターの機能

| 機能 | 内容 | 仕様書の要求ID |
| --- | --- | --- |
| 電源 | ACC ON/OFF、起動、状態の記憶と復元 | PWR-01〜06 |
| 音量 | 0〜30、MUTE | VOL-01〜04 |
| 音源 | ラジオ（FM 76.0〜95.0 MHz）/ Bluetooth オーディオ / USB | SRC-01〜06 |
| 走行中の操作制限 | 車速 5 km/h 以上で目的地検索・設定を禁止 | DRV-01〜04 |
| 目的地検索 | キーワード 1〜20 文字、部分一致、ルート案内 | NAV-01〜06 |
| 後退 | シフト R でバックカメラ優先表示、音量制限 | REV-01〜04 |
| 電話 | 着信・応答・拒否・終話 | TEL-01〜06 |
| 設定 | 画面の明るさ 1〜5 | SET-01 |

右側の「車両信号」パネル（ACC・車速・シフト・USB・Bluetooth・着信）で車両の状態を変えられる。
画面下の「操作ログ」は、テスト実行の証跡としてコピーできる。

**ワークショップ用に、意図的な不具合をいくつか仕込んである。** 内容は `instructor/answer-key.md`（非公開）を参照。
公開リポジトリと配信される JS からはコードを読めるので、参加者にはソースを見ずに仕様書とエミュレーターだけで取り組んでもらう。

## ローカル実行

```powershell
firebase emulators:start --only hosting
```

http://localhost:5000 を開く。ビルドは不要。

## テスト

```powershell
cd tests
npm test                       # 仕様どおりに動く部分のテスト
cd ..
node --test instructor/        # 講師用：仕込んだ不具合が残っているかの確認
```

## デプロイ

```powershell
firebase deploy --only hosting,firestore
```

`firestore` も一緒にデプロイすると、旧 ZooPass 用のルールが「すべて拒否」に置き換わる。
インデックスの削除を確認されたら、削除してよい。
