# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  authToken: 'ghp_token123'  // ❌ Removed
};

// After (SECURE)
const auth: ReviewerAuth = {
  isVerified: true,
  login: 'user',
  hasWriteAccess: true,
  verifiedAt: new Date()  // ✅ Required
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
