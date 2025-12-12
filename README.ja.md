# GPT 5.x PR Reviewer

> GPT-5.2、GPT-5.2-Pro、GPT-5.1、GPT-4o を使用した AI コードレビューツール

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

翻訳版: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## クイックスタート

### GitHub App をインストール（推奨）

最も簡単な方法 - GitHub App をインストールすると、自動的に PR をレビューします。

1. **アプリをインストール**: [GPT-5.2 PR Review](https://github.com/apps/gpt-5-2-pr-review)

2. **リポジトリを選択** してコードレビューを有効化

3. **OpenAI API キーを設定**：
   - リポジトリの **Settings** → **Secrets and variables** → **Actions** に移動
   - **Variables** タブをクリック
   - **New repository variable** をクリック
   - 名前：`OPENAI_API_KEY`
   - 値：[platform.openai.com](https://platform.openai.com/api-keys) から取得した API キー

4. **完了！** ボットが自動的に新しい Pull Request をレビューします

レビューは GPT-5.2 のブランディングとアバターで表示されます。

<details>
<summary><strong>方法 2: GitHub Actions（セルフホスト）</strong></summary>

自分のワークフローで自分の OpenAI API キーを使用して実行します。

1. `OPENAI_API_KEY` をリポジトリのシークレットに追加

2. `.github/workflows/cr.yml` を作成：

```yml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: micahstubbs/gpt-code-review@v3
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.2-2025-12-11
          LANGUAGE: Japanese
```

</details>

## 設定オプション

| 変数 | 説明 | デフォルト |
|------|------|------------|
| `MODEL` | 使用する OpenAI モデル | `gpt-5.2-2025-12-11` |
| `LANGUAGE` | 応答言語 | English |
| `PROMPT` | カスタムレビュープロンプト | （組み込み） |
| `MAX_PATCH_LENGTH` | 大きな diff のファイルをスキップ | 無制限 |
| `IGNORE_PATTERNS` | 無視する glob パターン | なし |
| `INCLUDE_PATTERNS` | 含める glob パターン | 全て |
| `REASONING_EFFORT` | GPT-5.x 推論レベル | medium |
| `VERBOSITY` | 応答の詳細レベル | medium |

### サポートモデル

| モデル | 説明 |
|--------|------|
| `gpt-5.2-2025-12-11` | 推奨 - 品質とコストの最適なバランス |
| `gpt-5.2-pro-2025-12-11` | プレミアム - 複雑/重要なレビュー用 |
| `gpt-5.1-codex` | コードレビューに最適化 |
| `gpt-5.1-codex-mini` | コスト効率の良いオプション |
| `gpt-5.1` | 汎用 |
| `gpt-4o`, `gpt-4o-mini` | 前世代 |

<details>
<summary><strong>セルフホスティング</strong></summary>

webhook ベースのデプロイ（GitHub Actions の代わり）：

1. リポジトリをクローン
2. `.env.example` を `.env` にコピーして設定
3. インストールして実行：

```sh
yarn install
yarn build
pm2 start pm2.config.cjs
```

詳細は [Probot ドキュメント](https://probot.github.io/docs/development/)を参照してください。

### Docker

```sh
docker build -t gpt-code-review .
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> gpt-code-review
```

</details>

<details>
<summary><strong>開発</strong></summary>

```sh
# 依存関係をインストール
yarn install

# ビルド
yarn build

# テストを実行
yarn test

# ローカルで起動
yarn start
```

</details>

## 貢献

提案やバグ報告は [issue を作成](https://github.com/micahstubbs/gpt-code-review/issues)してください。

詳細は[貢献ガイド](CONTRIBUTING.md)を参照してください。

## クレジット

このプロジェクトは [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt) にインスパイアされました。

## ライセンス

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
