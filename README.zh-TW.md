# GPT 5.x PR Reviewer

> 使用 GPT-5.1、GPT-5.1-Codex、GPT-5-Pro 和 GPT-4o 的 AI 程式碼審查工具

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

翻譯版本：[English](./README.md) | [簡體中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## 機器人使用方式

❗️⚠️ `由於成本考量，BOT 目前僅用於測試目的，並部署在有限制的 AWS Lambda 上。因此，不穩定的情況是完全正常的。建議自行部署 app。`

### 安裝

安裝：[GPT 5.x PR Reviewer](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

### 設定

1. 轉到你要整合此機器人的倉庫首頁
2. 點選 `settings`
3. 點選 `actions` 在下面的 `secrets and variables`
4. 切換到 `Variables` 選項，建立一個新變數 `OPENAI_API_KEY`，值為你的 open api key (如果是 Github Action 整合，則設定在 secrets 中)
   <img width="1465" alt="image" src="https://user-images.githubusercontent.com/13167934/218533628-3974b70f-c423-44b0-b096-d1ec2ace85ea.png">

### 開始使用

1. 當你建立一個新的 Pull request 時，機器人會自動進行程式碼審查，審查訊息將顯示在 pr timeline / file changes 部分。
2. 在 `git push` 更新 Pull request 之後，cr bot 將重新審查更改的文件

範例：

[ChatGPT-CodeReview/pull/21](https://github.com/anc95/ChatGPT-CodeReview/pull/21)

<img width="1052" alt="image" src="https://user-images.githubusercontent.com/13167934/218999459-812206e1-d8d2-4900-8ce8-19b5b6e1f5cb.png">

## 使用 Github Actions

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

1. 新增 `OPENAI_API_KEY` 到你的 github actions secrets
2. 建立 `.github/workflows/cr.yml` 新增以下內容

```yml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: micahstubbs/ChatGPT-CodeReview@v2.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MODEL: gpt-5.1-codex # 推薦使用
          # 支援的模型: gpt-5.1-codex, gpt-5.1-codex-mini, gpt-5.1, gpt-5-pro, gpt-4o
          LANGUAGE: Chinese
          OPENAI_API_ENDPOINT: https://api.openai.com/v1
          PROMPT:
          top_p: 1
          temperature: 1
          max_tokens: 10000
          MAX_PATCH_LENGTH: 10000
          IGNORE_PATTERNS: /node_modules,*.md
```

## 自我託管

1. 複製程式碼
2. 複製 `.env.example` 到 `.env`, 並填寫環境變數
3. 安裝相依性並執行

```sh
npm i
npm i -g pm2
npm run build
pm2 start pm2.config.cjs
```

[probot](https://probot.github.io/docs/development/) 了解更多詳情

## 開發

### 設定

```sh
# Install dependencies
npm install

# Build code
npm run build

# Run the bot
npm run start
```

### Docker

```sh
# 1. Build container
docker build -t cr-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> cr-bot
```

## 貢獻

如果您對如何改進 cr-bot 有建議，或者想報告錯誤，請開啟一個問題！我們喜歡所有的貢獻。

有關更多信息，請查看[貢獻指南](CONTRIBUTING.md).

## 靈感

這個項目的靈感來自[codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
