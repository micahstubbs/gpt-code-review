# GPT 5.x PR Reviewer

> 使用 GPT-5.2、GPT-5.2-Pro、GPT-5.1 和 GPT-4o 的 AI 程式碼審查工具

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

翻譯版本：[英語](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## 快速開始

### 安裝 GitHub App（推薦）

最簡單的方式 - 安裝我們的 GitHub App，它會自動審查 PR。

1. **安裝應用**：[GPT-5.2 PR Review](https://github.com/apps/gpt-5-2-pr-review)

2. **選擇倉庫** 啟用程式碼審查

3. **配置 OpenAI API 密鑰**：
   - 進入倉庫 **Settings** → **Secrets and variables** → **Actions**
   - 點擊 **Variables** 標籤
   - 點擊 **New repository variable**
   - 名稱：`OPENAI_API_KEY`
   - 值：從 [platform.openai.com](https://platform.openai.com/api-keys) 獲取的 API 密鑰

4. **完成！** 機器人會自動審查新的 Pull Request

審查結果會帶有 GPT-5.2 品牌標識和頭像。

<details>
<summary><strong>方式二：GitHub Actions（自託管）</strong></summary>

在你自己的工作流程中運行，使用你自己的 OpenAI API 密鑰。

1. 將 `OPENAI_API_KEY` 添加到你的倉庫密鑰

2. 創建 `.github/workflows/gpt-code-review.yml`：

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
          LANGUAGE: Chinese
```

</details>

## 配置選項

| 變數 | 描述 | 預設值 |
|------|------|--------|
| `MODEL` | 使用的 OpenAI 模型 | `gpt-5.2-2025-12-11` |
| `LANGUAGE` | 回應語言 | English |
| `PROMPT` | 自訂審查提示 | （內建） |
| `MAX_PATCH_LENGTH` | 跳過較大差異的檔案 | 無限制 |
| `IGNORE_PATTERNS` | 忽略的 glob 模式 | 無 |
| `INCLUDE_PATTERNS` | 包含的 glob 模式 | 全部 |
| `REASONING_EFFORT` | GPT-5.x 推理級別 | medium |
| `VERBOSITY` | 回應詳細程度 | medium |

### 支援的模型

| 模型 | 描述 |
|------|------|
| `gpt-5.2-2025-12-11` | 推薦 - 品質和成本的最佳平衡 |
| `gpt-5.2-pro-2025-12-11` | 高級版，用於複雜/關鍵審查 |
| `gpt-5.1-codex` | 針對程式碼審查優化 |
| `gpt-5.1-codex-mini` | 經濟實惠選項 |
| `gpt-5.1` | 通用型 |
| `gpt-4o`, `gpt-4o-mini` | 上一代 |

<details>
<summary><strong>自託管</strong></summary>

用於 webhook 驅動的部署（而非 GitHub Actions）：

1. 克隆倉庫
2. 複製 `.env.example` 到 `.env` 並配置
3. 安裝並運行：

```sh
yarn install
yarn build
pm2 start pm2.config.cjs
```

詳情請參閱 [Probot 文檔](https://probot.github.io/docs/development/)。

### Docker

```sh
docker build -t gpt-code-review .
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> gpt-code-review
```

</details>

<details>
<summary><strong>開發</strong></summary>

```sh
# 安裝依賴
yarn install

# 構建
yarn build

# 運行測試
yarn test

# 本地啟動
yarn start
```

</details>

## 貢獻

如果你有改進建議或想報告 bug，請[提交 issue](https://github.com/micahstubbs/gpt-code-review/issues)。

更多資訊請查看[貢獻指南](CONTRIBUTING.md)。

## 致謝

本專案靈感來自 [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## 授權

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
