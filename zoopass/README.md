# zoopass

セキュリティ講義用の演習Webアプリ（**Secure版**）。会員登録・ログインと、日付指定の入園予約ができる。
※ 現在、車載器テストワークショップ（Virtual Automotive Test Lab）への改変元として利用中。

**Firebase の無料プラン（Spark）だけで動く構成**。Cloud Functions は使わない。

| 項目 | 値 |
| --- | --- |
| Firebase プロジェクト | `zoopass`（IDが取られていたら `.firebaserc` を変更） |
| 使用サービス | Hosting / Authentication（メール・パスワード）/ Firestore |
| Hosting | `zoopass.web.app` |
| 独自ドメイン | `zoopass.suetaketakaya.com` |

## 構成

```
frontend/public/        画面（HTML / CSS / JS、ビルド不要）
  index.html            トップ・空き状況
  login.html            ログイン・会員登録
  mypage.html           予約・予約一覧・取消
  admin.html            受付枠の一括作成（管理者のみ）
  js/firebase.js        SDK初期化（SDKのバージョンはここだけで管理）
database/
  firestore.rules       セキュリティルール（サーバー側の検証はすべてここ）
  firestore.indexes.json
tests/
  rules.test.js         ルールのテスト
```

## データ

| コレクション | 内容 | クライアントからのアクセス |
| --- | --- | --- |
| `slots/{YYYY-MM-DD}` | `date`, `capacity`, `reserved`, `lastOp` | 読み取りは全員。作成は管理者。更新は予約・取消に連動した増減のみ |
| `reservations/{id}` | `uid`, `date`, `tickets`, `status`, `createdAt`, `cancelledAt` | 本人のみ読み取り。作成と「予約中→取消済」の変更のみ |
| `admins/{uid}` | （空のドキュメント） | コンソールから手動で登録。クライアントからは書けない |

## 予約の仕組み

ブラウザから Firestore に直接書き込む。予約の作成・取消では、次の2つを **1回のバッチ** で書き込む。

1. `reservations/{id}` の作成（または `status` を `cancelled` に変更）
2. `slots/{date}` の `reserved` を枚数だけ増減し、`lastOp` に予約IDを入れる

ルール側では `getAfter()` を使って、2つの書き込みが互いに整合しているかを確認する。
このため「枠を増やさずに予約だけ作る」「予約なしで枠の数だけ変える」「枠を多めに戻す」といった改ざんはすべて拒否される。
定員チェックもルールで行うので、同時に予約が入っても定員は超えない。

## セキュリティ上の設計ポイント（講義で対比に使う）

- **サーバー側での検証**：画面側の入力チェックは簡単に回避できる前提で、すべての検証を Firestore ルールで行う
- **アクセス制御 / IDOR対策**：他人の予約は読めず、取り消せない
- **入力検証**：日付の形式、過去日でないこと、枚数（1〜10の整数）、許可するフィールド名をルールで確認する
- **整合性**：予約と在庫を1回のバッチで書き込み、ルールで突き合わせる
- **XSS対策**：画面には `textContent` だけで出力し、`innerHTML` は使わない。CSP も設定
- **アカウント列挙対策**：ログイン・登録のエラーメッセージを粗くする
- **設定の外部化**：Firebase 設定は Hosting の `/__/firebase/init.json` から読み込む

## 初回セットアップ

1. Node.js（LTS）をインストールし、`npm install -g firebase-tools` と `firebase login`
2. Firebase コンソールでプロジェクトを作成（**Spark プランのまま**）
   - Authentication → メール/パスワードを有効化（パスワードポリシーで最小8文字を推奨）
   - Firestore を作成（リージョンは `asia-northeast1` を推奨）
3. `cd tests; npm install`
4. `js/firebase.js` の SDK バージョン（現在 11.0.2）と `tests/package.json` を最新に更新

## ローカル実行（エミュレータ）

```powershell
firebase emulators:start
```

1. http://localhost:5000 で会員登録する
2. エミュレータUI（http://localhost:4000）の Authentication でUIDを確認し、
   Firestore に `admins/<UID>` のドキュメント（フィールドなし）を作る
3. http://localhost:5000/admin で受付枠を作成する

## ルールのテスト

```powershell
firebase emulators:exec --only firestore "npm --prefix tests test"
```

## デプロイ

```powershell
firebase deploy --only hosting,firestore
```

デプロイ後に以下を行う。

1. 本番の Firestore で `admins/<自分のUID>` を作成する
2. `/admin` で受付枠を作る
3. Hosting で `zoopass.suetaketakaya.com` を追加し、DNSを設定する

## 既知の制限

- 1人あたりの予約数に上限はない（1回10枚までを何度でも予約できる）
- `slots` の `lastOp` に直近の予約IDが公開される（予約の中身は本人しか読めない）
- 受付枠の定員変更・削除の画面はない（必要ならコンソールで操作）
- CSP の `connect-src` にエミュレータ用の `127.0.0.1` を含めている（本番では外してよい）
- 無料枠の上限（Firestore の1日あたりの読み書き回数など）を超えると、その日は動かなくなる（課金はされない）
