# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-12-11

### Added

- **Custom GitHub App Support**: Users can now create their own GitHub App for branded code review comments with custom name and avatar instead of "github-actions[bot]" (#64)
- Added comprehensive setup guide at `docs/custom-github-app-setup.md` with step-by-step instructions
- Added example workflow at `examples/custom-app-workflow.yml` demonstrating custom app integration
- Added `getModel()` method to Chat class to expose the configured model ID
- Review body now dynamically shows the model ID (e.g., "Code review by gpt-5.2-2025-12-11")

### Changed

- **BREAKING:** Repository renamed from `ChatGPT-CodeReview` to `gpt-code-review`
- **BREAKING:** Default model changed from `gpt-4o` to `gpt-5.2-2025-12-11`
- Simplified review comment format: removed "Code Review Summary" header and horizontal rule
- Review comments now start directly with "Issues Found" section
- Updated workflow to use `actions/create-github-app-token@v2` for custom app authentication

### Migration Guide

**Action Reference:**

```yaml
# Before (v2.x)
- uses: micahstubbs/ChatGPT-CodeReview@v2.0.0

# After (v3.x)
- uses: micahstubbs/gpt-code-review@v3
```

**Custom Bot Identity (Optional):**

To use a custom GitHub App instead of "github-actions[bot]":

1. Create a GitHub App at https://github.com/settings/apps/new
2. Store `APP_ID` as variable and private key as secret
3. Use `actions/create-github-app-token@v2` before this action
4. See `docs/custom-github-app-setup.md` for full instructions

## [Unreleased]

### Security

- **CRITICAL:** Fixed authorization bypass vulnerability where `verifyReviewerAuthorization()` incorrectly returned `isVerified: true` on 404 responses. Non-collaborators can no longer bypass security checks. (#25, #31)
- Removed GitHub Personal Access Token exposure by eliminating `authToken` field from `ReviewerAuth` interface. Credentials are never returned in function responses. (#26, #31)
- Enforced LGTM authorization requirement in `calculateQualityScore()`. Function now throws security errors when LGTM is used without verified reviewer authorization. (#14, #31)

### Added

- Added `verifiedAt: Date` field to `ReviewerAuth` interface for audit trail and cache invalidation support (#26, #31)
- Added comprehensive test suite for review-analyzer module with 15 tests covering all security scenarios (#31)
- Added Git workflow documentation to CLAUDE.md including branch naming convention `<issue-number>/description` (#30, #31)
- Added planning documentation structure in `issues/<issue-number>/` directories (#30, #31)

### Changed

- **BREAKING:** `ReviewerAuth` interface now requires `verifiedAt: Date` field instead of optional `authToken?: string` (#26, #31)
- **BREAKING:** `calculateQualityScore()` now throws error if `lgtm=true` without valid `reviewerAuth` parameter (#14, #31)
- Replaced deprecation warnings with security enforcement errors for LGTM usage (#14, #31)
- Updated `tsconfig.json` to remove explicit `lib` configuration, allowing TypeScript to auto-include types from `@types/node` for native fetch support (#27, #31)

### Fixed

- Fixed 404 response handling in `verifyReviewerAuthorization()` to correctly return `isVerified: false` for non-collaborators (#25, #31)
- Fixed error handling to include `verifiedAt` timestamp in all code paths (#26, #31)

### Migration Guide

**ReviewerAuth Interface:**

```typescript
// Before (INSECURE)
const auth: ReviewerAuth = {
  isVerified: true,
  login: 'user',
  hasWriteAccess: true,
  authToken: 'ghp_token123', // ❌ Removed
};

// After (SECURE)
const auth: ReviewerAuth = {
  isVerified: true,
  login: 'user',
  hasWriteAccess: true,
  verifiedAt: new Date(), // ✅ Required
};
```

**LGTM Scoring:**

```typescript
// Before (INSECURE - now throws error)
const score = calculateQualityScore(comment, true);

// After (SECURE)
const auth = await verifyReviewerAuthorization(login, owner, repo, token);
const score = calculateQualityScore(comment, true, auth);
```

## [Previous Releases]

_No previous releases documented. This changelog was initiated with security fixes in PR #31._
