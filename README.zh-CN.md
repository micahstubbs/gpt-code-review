# GPT 5.x PR Reviewer

> 使用 GPT-5.2、GPT-5.2-Pro、GPT-5.1 和 GPT-4o 的 AI 代码审查工具

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

翻译版本：[英语](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## 快速开始

### 方式一：安装 GitHub App（推荐）

最简单的方式 - 安装我们的 GitHub App，它会自动审查 PR。

1. **安装应用**：[GPT-5.2 PR Review](https://github.com/apps/gpt-5-2-pr-review)

2. **选择仓库** 启用代码审查

3. **完成！** 机器人会自动审查新的 Pull Request

审查结果会带有 GPT-5.2 品牌标识和头像。

### 方式二：GitHub Actions

在你自己的工作流中运行，使用你自己的 OpenAI API 密钥。

1. 将 `OPENAI_API_KEY` 添加到你的仓库密钥

2. 创建 `.github/workflows/cr.yml`：

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

## 配置选项

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `MODEL` | 使用的 OpenAI 模型 | `gpt-5.2-2025-12-11` |
| `LANGUAGE` | 响应语言 | English |
| `PROMPT` | 自定义审查提示 | （内置） |
| `MAX_PATCH_LENGTH` | 跳过较大差异的文件 | 无限制 |
| `IGNORE_PATTERNS` | 忽略的 glob 模式 | 无 |
| `INCLUDE_PATTERNS` | 包含的 glob 模式 | 全部 |
| `REASONING_EFFORT` | GPT-5.x 推理级别 | medium |
| `VERBOSITY` | 响应详细程度 | medium |

### 支持的模型

| 模型 | 描述 |
|------|------|
| `gpt-5.2-2025-12-11` | 推荐 - 质量和成本的最佳平衡 |
| `gpt-5.2-pro-2025-12-11` | 高级版，用于复杂/关键审查 |
| `gpt-5.1-codex` | 针对代码审查优化 |
| `gpt-5.1-codex-mini` | 经济实惠选项 |
| `gpt-5.1` | 通用型 |
| `gpt-4o`, `gpt-4o-mini` | 上一代 |

## 自托管

用于 webhook 驱动的部署（而非 GitHub Actions）：

1. 克隆仓库
2. 复制 `.env.example` 到 `.env` 并配置
3. 安装并运行：

```sh
yarn install
yarn build
pm2 start pm2.config.cjs
```

详情请参阅 [Probot 文档](https://probot.github.io/docs/development/)。

### Docker

```sh
docker build -t gpt-code-review .
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> gpt-code-review
```

## 开发

```sh
# 安装依赖
yarn install

# 构建
yarn build

# 运行测试
yarn test

# 本地启动
yarn start
```

## 贡献

如果你有改进建议或想报告 bug，请[提交 issue](https://github.com/micahstubbs/gpt-code-review/issues)。

更多信息请查看[贡献指南](CONTRIBUTING.md)。

## 致谢

本项目灵感来自 [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## 许可证

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
