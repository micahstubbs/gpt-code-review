# GPT 5.x PR Reviewer

> GPT-5.2, GPT-5.2-Pro, GPT-5.1, GPT-4o를 사용한 AI 코드 리뷰 도구

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-GPT%205.x%20PR%20Reviewer-blue?logo=github)](https://github.com/marketplace/actions/gpt-5-x-pr-reviewer)

번역 버전: [ENGLISH](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md)

## 빠른 시작

### 방법 1: GitHub App 설치 (권장)

가장 쉬운 방법 - GitHub App을 설치하면 자동으로 PR을 리뷰합니다.

1. **앱 설치**: [GPT-5.2 PR Review](https://github.com/apps/gpt-5-2-pr-review)

2. **저장소 선택** 코드 리뷰를 활성화할 저장소 선택

3. **완료!** 봇이 자동으로 새 Pull Request를 리뷰합니다

리뷰는 GPT-5.2 브랜딩과 아바타와 함께 표시됩니다.

### 방법 2: GitHub Actions

자체 워크플로우에서 자신의 OpenAI API 키로 실행합니다.

1. `OPENAI_API_KEY`를 저장소 시크릿에 추가

2. `.github/workflows/cr.yml` 생성:

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
          LANGUAGE: Korean
```

## 설정 옵션

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MODEL` | 사용할 OpenAI 모델 | `gpt-5.2-2025-12-11` |
| `LANGUAGE` | 응답 언어 | English |
| `PROMPT` | 사용자 정의 리뷰 프롬프트 | (내장) |
| `MAX_PATCH_LENGTH` | 큰 diff 파일 건너뛰기 | 무제한 |
| `IGNORE_PATTERNS` | 무시할 glob 패턴 | 없음 |
| `INCLUDE_PATTERNS` | 포함할 glob 패턴 | 전체 |
| `REASONING_EFFORT` | GPT-5.x 추론 수준 | medium |
| `VERBOSITY` | 응답 상세 수준 | medium |

### 지원 모델

| 모델 | 설명 |
|------|------|
| `gpt-5.2-2025-12-11` | 권장 - 품질과 비용의 최적 균형 |
| `gpt-5.2-pro-2025-12-11` | 프리미엄 - 복잡/중요 리뷰용 |
| `gpt-5.1-codex` | 코드 리뷰에 최적화 |
| `gpt-5.1-codex-mini` | 비용 효율적 옵션 |
| `gpt-5.1` | 범용 |
| `gpt-4o`, `gpt-4o-mini` | 이전 세대 |

## 셀프 호스팅

webhook 기반 배포 (GitHub Actions 대신):

1. 저장소 클론
2. `.env.example`을 `.env`로 복사하고 설정
3. 설치 및 실행:

```sh
yarn install
yarn build
pm2 start pm2.config.cjs
```

자세한 내용은 [Probot 문서](https://probot.github.io/docs/development/)를 참조하세요.

### Docker

```sh
docker build -t gpt-code-review .
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> gpt-code-review
```

## 개발

```sh
# 종속성 설치
yarn install

# 빌드
yarn build

# 테스트 실행
yarn test

# 로컬 시작
yarn start
```

## 기여하기

제안이나 버그 신고가 있으면 [이슈를 열어주세요](https://github.com/micahstubbs/gpt-code-review/issues).

자세한 내용은 [기여 가이드](CONTRIBUTING.md)를 확인하세요.

## 크레딧

이 프로젝트는 [codereview.gpt](https://github.com/sturdy-dev/codereview.gpt)에서 영감을 받았습니다.

## 라이선스

[ISC](LICENSE) © 2025 anc95, micahstubbs, and contributors
