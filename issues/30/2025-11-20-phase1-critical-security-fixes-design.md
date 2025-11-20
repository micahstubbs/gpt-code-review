# Phase 1: Critical Security Fixes Design

**Date:** 2025-11-20
**Issues:** #25, #26, #14
**Priority:** P0 (Critical)
**Estimated Effort:** 4-7 hours

## Overview

This design addresses three critical security vulnerabilities in the review-analyzer module that could allow unauthorized users to bypass security checks, expose credentials, and manipulate code quality scores.

## Issues Addressed

### Issue #25: SECURITY BUG - verifyReviewerAuthorization returns isVerified:true on 404
- **Severity:** CRITICAL
- **Impact:** Allows unauthorized reviewers to bypass authorization checks
- **File:** `src/review-analyzer.ts` line 297

### Issue #26: SECURITY - Remove GitHub PAT exposure in authToken field
- **Severity:** HIGH
- **Impact:** GitHub PAT can be propagated/stored, risking credential leakage
- **File:** `src/review-analyzer.ts` lines 52, 300, 320

### Issue #14: SECURITY - Implement reviewer authorization for LGTM scoring
- **Severity:** HIGH
- **Impact:** LGTM can be spoofed without server-side verification
- **File:** `src/review-analyzer.ts` lines 123-172

## Design Decisions

### Decision 1: LGTM Authorization Strategy (Issue #14)

**Chosen Approach:** Hybrid Enforcement

**Rationale:**
- Prevents security issues immediately (no LGTM without auth)
- Provides clear error messages to developers
- Allows gradual migration (can still call function without LGTM)
- Makes the security requirement explicit

**Implementation:**
- Throw error if `lgtm=true` without `reviewerAuth`
- Throw error if `lgtm=true` with `reviewerAuth.isVerified=false`
- Backward compatible for non-LGTM use cases

### Decision 2: authToken Replacement (Issue #26)

**Chosen Approach:** Opaque Attestation with Timestamp

**Rationale:**
- Completely removes PAT exposure risk
- Provides useful debugging/auditing information
- Simple to implement (just add a timestamp)
- No additional dependencies
- Makes it clear when authorization was verified

**Implementation:**
- Remove `authToken?: string` field
- Add `verifiedAt: Date` field
- Never return the GitHub token from `verifyReviewerAuthorization()`

## Detailed Design

### 1. Fix Critical 404 Bug (Issue #25)

**Current Code (VULNERABLE):**
```typescript
if (response.status === 404) {
  return {
    isVerified: true, // BUG: Should be false!
    login: githubLogin,
    hasWriteAccess: false,
    authToken: githubToken
  };
}
```

**Fixed Code:**
```typescript
if (response.status === 404) {
  // User is not a collaborator in this repository
  return {
    isVerified: false,  // ← Fixed: 404 means NOT verified
    login: githubLogin,
    hasWriteAccess: false,
    verifiedAt: new Date()
  };
}
```

**Why This Works:**
- `isVerified: false` correctly indicates user is NOT an authorized collaborator
- Maintains fail-secure behavior (deny by default)
- 404 response is expected for non-collaborators

### 2. Remove PAT Exposure (Issue #26)

**Current Interface (VULNERABLE):**
```typescript
export interface ReviewerAuth {
  isVerified: boolean;
  login: string;
  hasWriteAccess: boolean;
  authToken?: string;  // ← SECURITY RISK
}
```

**Fixed Interface:**
```typescript
export interface ReviewerAuth {
  /**
   * Whether the reviewer is verified (server-side GitHub authorization)
   */
  isVerified: boolean;

  /**
   * Reviewer's GitHub login
   */
  login: string;

  /**
   * Whether the reviewer has write/admin permissions on the repo
   */
  hasWriteAccess: boolean;

  /**
   * Timestamp when authorization was verified
   * Used for auditing and cache invalidation
   */
  verifiedAt: Date;  // ← Replaces authToken
}
```

**Changes Required:**
1. Update `ReviewerAuth` interface (line 32-53)
2. Remove `authToken: githubToken` from all return statements (lines 300, 320)
3. Add `verifiedAt: new Date()` to all return statements
4. Update error handler return value (line 331)

### 3. Enforce LGTM Authorization (Issue #14)

**Add Security Checks:**
```typescript
export function calculateQualityScore(
  reviewComment: string,
  lgtm: boolean,
  reviewerAuth?: ReviewerAuth,
  requiredApprovers: number = 1
): CodeQualityScore {
  // SECURITY: Enforce authorization when LGTM is claimed
  if (lgtm && !reviewerAuth) {
    throw new Error(
      'SECURITY ERROR: LGTM requires verified reviewer authorization. ' +
      'Call verifyReviewerAuthorization() first and pass the result as reviewerAuth parameter.'
    );
  }

  // Additional check: even with reviewerAuth, verify it's actually verified
  if (lgtm && reviewerAuth && !reviewerAuth.isVerified) {
    throw new Error(
      'SECURITY ERROR: LGTM requires isVerified=true in reviewerAuth. ' +
      'The provided authorization is not verified.'
    );
  }

  const severity = analyzeReviewSeverity(reviewComment);
  let score = 100;

  // ... existing scoring logic ...

  // LGTM bonus - now guaranteed to be authorized
  const isAuthorizedLgtm = lgtm && reviewerAuth?.isVerified && reviewerAuth?.hasWriteAccess;

  if (isAuthorizedLgtm && severity.critical.length === 0) {
    score = Math.min(100, score + 10);
  }

  // Penalty for LGTM with critical issues
  if (isAuthorizedLgtm && severity.critical.length > 0) {
    score -= 10;  // Authorized reviewer made a mistake
  }

  // ... rest of scoring logic ...
}
```

**Remove Deprecation Warnings:**
- Remove console.warn() at lines 167-172 (now enforced with errors)
- Remove console.warn() at lines 178-182 (now enforced with errors)

## Testing Strategy

### Test-Driven Development (TDD) Approach

**Phase 1: Write Tests (RED)**

Create `test/review-analyzer.test.ts` with tests for:

1. **Issue #25 Tests:**
   - `verifyReviewerAuthorization()` returns `isVerified: false` on 404
   - `verifyReviewerAuthorization()` returns `hasWriteAccess: false` on 404
   - `verifyReviewerAuthorization()` includes `verifiedAt` timestamp

2. **Issue #26 Tests:**
   - `ReviewerAuth` interface has `verifiedAt: Date`
   - `ReviewerAuth` interface does NOT have `authToken`
   - `verifyReviewerAuthorization()` never returns token in response
   - All return paths include `verifiedAt` timestamp

3. **Issue #14 Tests:**
   - `calculateQualityScore()` throws error when `lgtm=true` without `reviewerAuth`
   - `calculateQualityScore()` throws error when `lgtm=true` with `isVerified=false`
   - `calculateQualityScore()` accepts `lgtm=false` without `reviewerAuth`
   - `calculateQualityScore()` accepts `lgtm=true` with valid `reviewerAuth`
   - LGTM bonus only applies with verified authorization

**Phase 2: Implement Fixes (GREEN)**

Implement changes in order:
1. Fix #26 first (interface change) - forces all code to update
2. Fix #25 second (404 bug) - straightforward change
3. Fix #14 last (LGTM enforcement) - builds on interface changes

**Phase 3: Verify (REFACTOR)**

- All tests pass
- No console warnings in tests
- Security scenarios fully covered
- Edge cases handled

## Implementation Order

1. **Update Interface (#26)** - `ReviewerAuth` interface
   - Remove `authToken?: string`
   - Add `verifiedAt: Date`

2. **Fix 404 Bug (#25)** - `verifyReviewerAuthorization()` function
   - Change `isVerified: true` to `isVerified: false` on 404
   - Add `verifiedAt: new Date()` to all returns
   - Remove all `authToken` returns

3. **Enforce LGTM Auth (#14)** - `calculateQualityScore()` function
   - Add security checks at function start
   - Remove deprecation warnings
   - Simplify LGTM logic (now guaranteed authorized)

## Files Modified

### Source Files
- `src/review-analyzer.ts` - Main implementation

### Test Files
- `test/review-analyzer.test.ts` - New comprehensive test suite

### Generated Files (auto-updated on build)
- `action/src/review-analyzer.d.ts` - TypeScript declarations

## Breaking Changes

### ReviewerAuth Interface
- **BREAKING:** Removed `authToken?: string` field
- **BREAKING:** Added `verifiedAt: Date` field (required)

**Migration Guide:**
```typescript
// Before (INSECURE)
const auth = await verifyReviewerAuthorization(...);
console.log(auth.authToken); // Don't do this!

// After (SECURE)
const auth = await verifyReviewerAuthorization(...);
console.log(auth.verifiedAt); // Timestamp of verification
```

### calculateQualityScore Function
- **BREAKING:** Throws error if `lgtm=true` without `reviewerAuth`
- **BREAKING:** Throws error if `lgtm=true` with `isVerified=false`

**Migration Guide:**
```typescript
// Before (INSECURE)
const score = calculateQualityScore(comment, true);

// After (SECURE)
const auth = await verifyReviewerAuthorization(login, owner, repo, token);
const score = calculateQualityScore(comment, true, auth);
```

## Security Impact

### Before Fixes
- ❌ Unauthorized users could bypass security checks (404 bug)
- ❌ GitHub PATs could be logged/stored/exposed
- ❌ LGTM could be spoofed without verification

### After Fixes
- ✅ 404 correctly denies authorization
- ✅ No credentials in return values
- ✅ LGTM requires verified authorization
- ✅ Clear error messages for security violations
- ✅ Fail-secure by default

## Success Criteria

- [ ] All tests pass (100% coverage for security paths)
- [ ] No credentials in return values
- [ ] LGTM requires authorization (enforced with errors)
- [ ] 404 returns `isVerified: false`
- [ ] `verifiedAt` timestamp in all auth responses
- [ ] No breaking changes to function signatures (only return types)
- [ ] Clear error messages for security violations

## Future Enhancements (Not in Phase 1)

- Rate limiting for GitHub API calls (Issue #29)
- Memoization/caching of auth results (Issue #29)
- Input validation for reviewComment (Issue #15)
- Score gaming prevention (Issue #17)

These will be addressed in Phase 2 (High Severity Bugs).
