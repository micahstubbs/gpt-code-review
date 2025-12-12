# GPT 5.x PR Reviewer

> AI-powered code review for Pull Requests using GPT-5.2, GPT-5.2-Pro, GPT-5.1, and GPT-4o

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

Translation Versions: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## Bot Usage

❗️⚠️ `Due to cost considerations, BOT is only used for testing purposes and is currently deployed on AWS Lambda with ratelimit restrictions. Therefore, unstable situations are completely normal. It is recommended to deploy an app by yourself.`

### Install

Install: [GPT 5.x PR Reviewer](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

### Configuration

1. Go to the repo homepage which you want integrate this bot
2. click `settings`
3. click `actions` under `secrets and variables`
4. Change to `Variables` tab, create a new variable `OPENAI_API_KEY` with the value of your open api key (For Github Action integration, set it in secrets)
   <img width="1465" alt="image" src="https://user-images.githubusercontent.com/13167934/218533628-3974b70f-c423-44b0-b096-d1ec2ace85ea.png">

### Start using

1. The robot will automatically do the code review when you create a new Pull request, the review information will show in the pr timeline / file changes part.
2. After `git push` update the pull request, cr bot will re-review the changed files

example:

[ChatGPT-CodeReview/pull/21](https://github.com/anc95/ChatGPT-CodeReview/pull/21)

<img width="1052" alt="image" src="https://user-images.githubusercontent.com/13167934/218999459-812206e1-d8d2-4900-8ce8-19b5b6e1f5cb.png">

## Using Github Actions

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

1. add the `OPENAI_API_KEY` to your github actions secrets
2. create `.github/workflows/cr.yml` add bellow content

```yml
name: Code Review

permissions:
  contents: read
  pull-requests: write
  models: true # if you choose use github models, set this to be true

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  test:
    # if: ${{ contains(github.event.*.labels.*.name, 'gpt review') }} # Optional; to run only when a label is attached
    runs-on: ubuntu-latest
    steps:
      - uses: micahstubbs/ChatGPT-CodeReview@v2.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

          # if use github models https://github.com/marketplace/models
          USE_GITHUB_MODELS: true
          MODEL: openai/gpt-4o

          # else if use azure deployment
          AZURE_API_VERSION: xx
          AZURE_DEPLOYMENT: xx

          # else use standard llm model
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          OPENAI_API_ENDPOINT: https://api.openai.com/v1
          MODEL: gpt-5.2-2025-12-11 # https://platform.openai.com/docs/models
          # Supported models include:
          # - gpt-5.2-2025-12-11 (recommended - default model)
          # - gpt-5.2-pro-2025-12-11 (premium tier for complex/critical reviews)
          # - gpt-5.1-codex (optimized for code)
          # - gpt-5.1-codex-mini (cost-effective option)
          # - gpt-5.1 (general purpose)
          # - gpt-4o, gpt-4o-mini (previous generation)
          # - gpt-3.5-turbo (legacy)
          #
          # Note: GPT-5.2-Pro doesn't support structured outputs; JSON is extracted from response text

          # common
          LANGUAGE: Chinese
          PROMPT: # example: Please check if there are any confusions or irregularities in the following code diff:
          top_p: 1 # https://platform.openai.com/docs/api-reference/chat/create#chat/create-top_p
          temperature: 1 # https://platform.openai.com/docs/api-reference/chat/create#chat/create-temperature
          max_tokens: 10000
          MAX_PATCH_LENGTH: 10000 # if the patch/diff length is large than MAX_PATCH_LENGTH, will be ignored and won't review. By default, with no MAX_PATCH_LENGTH set, there is also no limit for the patch/diff length.
          IGNORE_PATTERNS: /node_modules/**/*,*.md # glob pattern or regex pattern to ignore files, separated by comma
          INCLUDE_PATTERNS: *.js,*.ts # glob pattern or regex pattern to include files, separated by comma
```

## Self-hosting

1. clone code
2. copy `.env.example` to `.env`, and fill the env variables
3. install deps and run

```sh
npm i
npm i -g pm2
npm run build
pm2 start pm2.config.cjs
```

[probot](https://probot.github.io/docs/development/) for more detail

## Dev

### Setup

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

## Contributing

If you have suggestions for how cr-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## Credit

this project is inpired by [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)

## License

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
