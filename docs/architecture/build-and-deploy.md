# Build System and Deployment

## Build Pipeline

```
yarn build
    │
    ├─ rollup -c rollup.config.ts
    │   │
    │   ├─ middleware.ts       → dist/middleware.js      (Vercel edge)
    │   ├─ src/bot.ts          → dist/lib/bot.js         (ESM library)
    │   ├─ src/index.ts        → dist/index.js           (Probot entry)
    │   └─ api/.../index.ts    → dist/api/.../index.js   (webhooks)
    │
    └─ ncc build src/github-action.cjs -o action
        └─ Bundles all deps into single file for GitHub Actions
```

Rollup uses the esbuild plugin for fast TypeScript compilation. Output is ES modules (`"type": "module"` in package.json).

The `action/` directory is a self-contained bundle (via `@vercel/ncc`) that GitHub Actions can run directly without `node_modules`.

### Lambda Build

```
yarn build:lambda
    └─ ncc build src/aws-lambda.cjs -o lambda
```

Produces a single-file bundle in `lambda/` for AWS Lambda deployment.

## Deployment Configurations

### GitHub Actions (Primary)

No deployment step -- users reference the action in their workflow files:

```yaml
- uses: micahstubbs/gpt-code-review@v3
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

The `action/` bundle runs directly in the Actions runner.

### Self-Hosted (Probot)

```bash
yarn build
pm2 start pm2.config.cjs
```

`pm2.config.cjs` runs `dist/index.js` with `dotenv/config` for `.env` file loading. Requires a GitHub App with webhook configuration.

### AWS Lambda

Deploy the `lambda/` directory to AWS Lambda. The exported `webhooks` function handles GitHub webhook payloads.

### Vercel Edge

Deploy `middleware.ts` as a Vercel edge function. Handles webhooks at the edge for low-latency responses.

## TypeScript Configuration

- **Target:** ESNext
- **Module:** NodeNext (ES modules with `.js` extension in imports)
- **Strict mode** enabled
- **Output:** `lib/` for type declarations only (runtime code goes through rollup)

## Testing

```bash
yarn test          # Run all tests
yarn test -- --testPathPattern=review-analyzer   # Run specific test file
```

Jest with ts-jest. Tests use `nock` for HTTP mocking and Probot test utilities for simulating GitHub webhook events. Test fixtures in `test/fixtures/`.

## Code Formatting

```bash
yarn format        # Format all files with Prettier
yarn format-check  # Check formatting (CI)
```

Husky + lint-staged runs Prettier on staged `.ts`, `.js`, `.cjs` files pre-commit.
