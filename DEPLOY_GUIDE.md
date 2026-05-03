# From Here. To the Stage. — 完全デプロイガイド

**URL:** https://from-here-to-the-stage.github.io/lightyourlove  
**リポジトリ:** https://github.com/from-here-to-the-stage/lightyourlove

---

## ── アップロードするファイル 全一覧 ──

```
lightyourlove/                          ← リポジトリのルート
│
├── index.html                          ★ HTMLシェル（22KB）
├── styles.css                          ★ CSS全体（43KB）
├── tour-data.js                        ★ ツアーデータ（メンテ対象）
├── app.js                              ★ アプリロジック（89KB）
├── app.webmanifest                       PWA設定
├── robots.txt                            クローラー設定
├── sitemap.xml                           SEO
│
├── icons/                              ★ フォルダごとアップロード
│   ├── icon-192.png                      PWAアイコン
│   └── icon-512.png                      PWAアイコン（大）
│
└── .github/
    ├── CODEOWNERS                        変更承認設定
    ├── dependabot.yml                    自動更新設定
    └── workflows/
        ├── deploy.yml                  ★ 本番デプロイ（最重要）
        ├── manifest.yml                  日次HMAC更新
        ├── daily-token.yml               日次Salt生成
        ├── pinact.yml                    SHA固定CI
        └── dependency-review.yml         脆弱性チェック
```

★ = 必須（これがないと動かない）

---

## STEP 0 ── 事前準備（一度だけ）

### SIGN_KEY を生成する

**Mac / Linux:**
```bash
openssl rand -hex 32
```

**Windows（PowerShell）:**
```powershell
-join ((1..32) | ForEach { '{0:x2}' -f (Get-Random -Max 256) })
```

→ `a3f9b2c1...` のような **64文字** が出力される  
→ **今すぐメモ帳に保存**（次のSTEPで2箇所に登録後は削除OK）

---

## STEP 1 ── GitHub リポジトリを設定する

### 1-1. Pages の設定

**https://github.com/from-here-to-the-stage/lightyourlove/settings/pages**

```
Source → GitHub Actions  （← "Deploy from a branch" ではない）
→ Save
```

### 1-2. Secrets を登録する

**https://github.com/from-here-to-the-stage/lightyourlove/settings/secrets/actions**

「New repository secret」を押して以下を登録:

| Name | Value | 必須 |
|---|---|---|
| `SIGN_KEY` | STEP 0 で生成した 64文字 | ✅ 必須 |
| `GA4_ID` | `G-XXXXXXXXXX` | 任意（後からでもOK） |
| `GAS_URL` | GASデプロイURL | 任意（後からでもOK） |

### 1-3. Variables を登録する

**同じページの「Variables」タブ**（Secretsタブとは別）

「New repository variable」:

| Name | Value |
|---|---|
| `SITE_URL` | `https://from-here-to-the-stage.github.io/lightyourlove` |

---

## STEP 2 ── ファイルをアップロードする

### 方法A: git コマンド（推奨・一括）

```bash
# リポジトリをクローン
git clone https://github.com/from-here-to-the-stage/lightyourlove.git
cd lightyourlove

# ダウンロードしたファイルをすべてコピー
# （index.html, styles.css, tour-data.js, app.js,
#   app.webmanifest, robots.txt, sitemap.xml,
#   icons/ フォルダ, .github/ フォルダ）

git add .
git commit -m "feat: initial deployment - From Here. To the Stage."
git push origin main
```

→ push の瞬間に Actions が自動起動します。

---

### 方法B: GitHub Web UI（git不要）

#### ルート直下の7ファイルをアップロード

```
リポジトリページ
→ Add file → Upload files
→ 以下をドラッグ＆ドロップ:
   index.html / styles.css / tour-data.js / app.js
   app.webmanifest / robots.txt / sitemap.xml
→ Commit message: "feat: add main files"
→ Commit changes
```

#### icons/ フォルダをアップロード

```
Add file → Upload files
→ icon-192.png と icon-512.png をドラッグ
→ ファイル名の欄を以下に変更:
   icons/icon-192.png
   icons/icon-512.png
   （スラッシュを入力すると自動でフォルダが作成される）
→ Commit changes
```

#### .github/ のファイル（1つずつ作成）

```
Add file → Create new file
→ ファイル名に ".github/workflows/deploy.yml" と入力
→ deploy.yml の内容をコピー＆ペースト
→ Commit changes
```

**残り6ファイルも同様に繰り返す:**
```
.github/workflows/manifest.yml
.github/workflows/daily-token.yml
.github/workflows/pinact.yml
.github/workflows/dependency-review.yml
.github/CODEOWNERS
.github/dependabot.yml
```

---

## STEP 3 ── 初回デプロイを実行する

### 自動実行を確認

main ブランチへの push で自動起動するはずです。

**https://github.com/from-here-to-the-stage/lightyourlove/actions**

を開いて `Deploy to GitHub Pages` が実行中（🟡）または完了（✅）になっていればOK。

### 手動で実行する場合

```
Actions タブ
→ 左側「Deploy to GitHub Pages」をクリック
→ 右側「Run workflow」→「Run workflow」
→ 2〜3分待つ
```

---

## STEP 4 ── 初回デプロイ後の確認

### サイトが表示されるか

**https://from-here-to-the-stage.github.io/lightyourlove**

にアクセスして表示されればデプロイ成功。

### ブラウザのコンソールを確認（F12）

問題なければエラーなし。よくある残存エラーと対処:

| エラー | 原因 | 対処 |
|---|---|---|
| `404 icons/icon-192.png` | iconsフォルダ未アップロード | icons/フォルダをアップロード |
| `%%SITE_URL%%` が残っている | SITE_URL Variable 未登録 | Settings→Variables で登録 |
| `resizeMap is not defined` | app.js が古い | 最新のapp.jsをアップロード |
| `contentStart.js: removeChild` | Chrome拡張機能のエラー | **無視してOK（サイトと無関係）** |

### 毎日の自動処理を初回起動

```
Actions → Generate Daily Token → Run workflow
Actions → Rotate Manifest     → Run workflow
```

（2つとも緑になればOK）

---

## STEP 5 ── 完了チェックリスト

- [ ] `Settings → Pages → Source: GitHub Actions` ✓
- [ ] `Secrets: SIGN_KEY` 登録済み ✓
- [ ] `Variables: SITE_URL` 登録済み ✓
- [ ] `Actions → Deploy` が緑（✅）✓
- [ ] サイトが開く ✓
- [ ] コンソールにエラーなし ✓
- [ ] `Generate Daily Token` が緑 ✓
- [ ] `Rotate Manifest` が緑 ✓

---

## 障害になりうること（事前確認）

| 障害 | 確認方法 | 対処 |
|---|---|---|
| Actions の権限不足 | Settings→Actions→General→「Read and write permissions」になっているか | チェックを変更 |
| Pages が有効でない | Settings→Pages に URL が表示されているか | STEP 1-1 を再確認 |
| SIGN_KEY が空 | Actions のログで `Warning: SIGN_KEY not set` | Secrets に登録 |
| 古いindex.htmlが残っている | ブラウザのキャッシュ | Ctrl+Shift+R でハードリロード |
| `.github/workflows/` に YAML構文エラー | Actions が赤くなる | ログを確認して報告 |

---

## ツアーデータの更新方法（デプロイ後）

`tour-data.js` だけ編集して push するだけ:

```bash
# 例: バンコクの会場が決まった
# tour-data.js を開いて該当行を修正:
venue: 'TBA'  →  venue: 'Rajamangala National Stadium'
st: null      →  st: '2026-12-03T19:00:00+07:00'

git add tour-data.js
git commit -m "data: Bangkok venue confirmed"
git push origin main
# → 自動でビルド＆デプロイ
```

---

*詰まったら Actions のエラーログ（赤い×→ログをコピー）を共有してください。*
