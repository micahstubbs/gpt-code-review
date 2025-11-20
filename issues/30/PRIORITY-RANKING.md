# Issue Priority Ranking

**Last Updated:** 2025-11-20
**Total Open Issues:** 21

## Priority 0: CRITICAL SECURITY (Implement Immediately)

### #25 - SECURITY BUG: verifyReviewerAuthorization returns isVerified:true on 404
- **Severity:** CRITICAL
- **Impact:** Allows unauthorized reviewers to bypass authorization checks
- **Affected:** `src/review-analyzer.ts:verifyReviewerAuthorization()`
- **Risk:** Unauthorized access, approval spoofing
- **Effort:** Low (1-2 hours)

### #26 - SECURITY: Remove GitHub PAT exposure in authToken field
- **Severity:** HIGH
- **Impact:** GitHub PAT can be propagated/stored, risking credential leakage
- **Affected:** `src/review-analyzer.ts:ReviewerAuth interface`
- **Risk:** Credential exposure, compliance violations
- **Effort:** Low (1 hour)

### #14 - SECURITY: Implement reviewer authorization for LGTM scoring
- **Severity:** HIGH
- **Impact:** LGTM can be spoofed without server-side verification
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Risk:** Score manipulation, fake approvals
- **Effort:** Medium (2-4 hours)
- **Note:** Related to #25, #26 - implement together

## Priority 1: HIGH SEVERITY BUGS

### #17 - SECURITY: Prevent score gaming via issue fragmentation
- **Severity:** MEDIUM-HIGH
- **Impact:** Reviewers can game scores by fragmenting issues
- **Affected:** `src/review-analyzer.ts:analyzeReviewSeverity()`
- **Effort:** Medium (3-4 hours)

### #15 - SECURITY: Add input validation and ReDoS protection for reviewComment
- **Severity:** MEDIUM-HIGH
- **Impact:** DoS via large inputs or ReDoS attacks
- **Affected:** `src/review-analyzer.ts:analyzeReviewSeverity()`
- **Effort:** Medium (2-3 hours)

### #19 - BUG: Softening factor must be tied to base weights, not fixed value
- **Severity:** HIGH
- **Impact:** Score could increase with more critical issues if weights change
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Risk:** Perverse behavior, incorrect scoring
- **Effort:** Low (1-2 hours)

### #21 - BUG: Add defensive defaults for undefined severity arrays
- **Severity:** MEDIUM-HIGH
- **Impact:** Runtime crashes on malformed input
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Effort:** Low (30 minutes)

### #12 - Fix diminishing returns logic in quality score calculation
- **Severity:** MEDIUM
- **Impact:** Diminishing returns feature doesn't work (score goes negative)
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Effort:** Low (1 hour)

### #11 - Fix misleading breakdown math in quality score calculation
- **Severity:** MEDIUM
- **Impact:** Breakdown scores don't match documented behavior
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Effort:** Low (1 hour)

## Priority 2: TESTING & VALIDATION (Required Before Production)

### #23 - TESTING: Add comprehensive edge case and boundary tests
- **Severity:** HIGH (blocking)
- **Impact:** No test coverage for critical scoring logic
- **Affected:** `test/review-analyzer.test.ts` (needs creation)
- **Effort:** High (4-6 hours)
- **Note:** Should be done AFTER fixing P0 and P1 bugs

### #9 - Add input validation to review analyzer functions
- **Severity:** MEDIUM
- **Impact:** Better error handling and validation
- **Affected:** `src/review-analyzer.ts` (all functions)
- **Effort:** Medium (2-3 hours)

### #28 - Improve error handling: Expand data validation and diagnostics
- **Severity:** MEDIUM
- **Impact:** Better debugging and error messages
- **Affected:** `src/review-analyzer.ts:verifyReviewerAuthorization()`
- **Effort:** Medium (2 hours)

## Priority 3: REFACTORING & CODE QUALITY

### #20 - Refactor: Break calculateQualityScore into single-responsibility functions
- **Severity:** MEDIUM
- **Impact:** Better testability and maintainability
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Effort:** Medium (2-3 hours)
- **Note:** Do AFTER tests are written (#23)

### #18 - Centralize magic numbers into configuration object
- **Severity:** MEDIUM
- **Impact:** Easier tuning, better testability
- **Affected:** `src/review-analyzer.ts`
- **Effort:** Medium (2 hours)
- **Dependencies:** Should be done WITH #20 refactor

### #13 - Make severity weighting configurable and match documentation
- **Severity:** MEDIUM
- **Impact:** Flexibility and documentation accuracy
- **Affected:** `src/review-analyzer.ts`
- **Effort:** Medium (2-3 hours)
- **Dependencies:** Related to #18

### #10 - Improve severity matching to reduce false positives
- **Severity:** MEDIUM
- **Impact:** Better accuracy in issue categorization
- **Affected:** `src/review-analyzer.ts:analyzeReviewSeverity()`
- **Effort:** Medium (2-3 hours)

## Priority 4: DEPENDENCIES & INFRASTRUCTURE

### #27 - Dependency: Verify node-fetch compatibility and declaration
- **Severity:** MEDIUM
- **Impact:** Potential runtime failures, missing dependencies
- **Affected:** `src/review-analyzer.ts`, `package.json`
- **Effort:** Low (1 hour)

### #29 - Add rate limiting and memoization for GitHub API calls
- **Severity:** MEDIUM
- **Impact:** Better performance, avoid rate limits
- **Affected:** `src/review-analyzer.ts:verifyReviewerAuthorization()`
- **Effort:** Medium (2-3 hours)

### #8 - Secrets unavailable for forked PRs in GPT-5 Pro workflow
- **Severity:** LOW
- **Impact:** Workflow limitation (expected behavior)
- **Affected:** `.github/workflows/`
- **Effort:** Low (documentation/workaround)

### #7 - Workflow never runs when gpt-5-pro label is applied after PR creation
- **Severity:** LOW
- **Impact:** Workflow trigger issue
- **Affected:** `.github/workflows/`
- **Effort:** Low (1 hour)

### #3 - Test GPT-5.1 and GPT-5 Pro models with Responses API
- **Severity:** LOW
- **Impact:** Feature testing/validation
- **Effort:** Medium (testing)

## Priority 5: DOCUMENTATION & CLEANUP

### #22 - DOCS: Fix misleading docstring about 'adaptive thresholds'
- **Severity:** LOW
- **Impact:** Documentation accuracy
- **Affected:** `src/review-analyzer.ts:calculateQualityScore()`
- **Effort:** Low (15 minutes)

### #24 - Code cleanup: Remove redundant Math.floor on integer expression
- **Severity:** LOW
- **Impact:** Code cleanliness
- **Affected:** `src/review-analyzer.ts`
- **Effort:** Low (5 minutes)

---

## Implementation Order

**Phase 1: Critical Security (Do First)**
1. #25 - Fix 404 authorization bug (CRITICAL)
2. #26 - Remove PAT exposure (HIGH)
3. #14 - Implement proper LGTM authorization (HIGH)

**Phase 2: High Severity Bugs**
4. #21 - Add defensive defaults (quick win)
5. #19 - Fix softening factor (affects scoring logic)
6. #12 - Fix diminishing returns (affects scoring logic)
7. #15 - Add input validation and ReDoS protection
8. #17 - Prevent score gaming
9. #11 - Fix breakdown math

**Phase 3: Testing (Required Before Production)**
10. #23 - Add comprehensive tests (CRITICAL for validation)

**Phase 4: Refactoring & Quality**
11. #18 - Centralize magic numbers
12. #20 - Refactor into single-responsibility functions
13. #13 - Make severity weighting configurable
14. #9 - Add input validation
15. #28 - Improve error handling
16. #10 - Improve severity matching

**Phase 5: Infrastructure & Dependencies**
17. #27 - Fix node-fetch dependency
18. #29 - Add rate limiting and memoization
19. #7 - Fix workflow trigger

**Phase 6: Documentation & Cleanup**
20. #22 - Fix docstring
21. #24 - Remove redundant Math.floor

---

## Estimated Total Effort
- Phase 1 (Critical): 4-7 hours
- Phase 2 (High Bugs): 8-12 hours
- Phase 3 (Testing): 4-6 hours
- Phase 4 (Refactoring): 10-14 hours
- Phase 5 (Infrastructure): 5-7 hours
- Phase 6 (Cleanup): 1 hour

**Total: 32-47 hours**

## Recommended Immediate Action
Start with Phase 1 (issues #25, #26, #14) - these are critical security vulnerabilities that must be fixed before deploying to production.
