# Plan: Document CI Workflow Validation Behavior

**Issue:** #55 - CI: Workflow validation fails when claude-code-review.yml differs from main branch

## Problem Summary

The `claude-code-review.yml` workflow fails with a 401 Unauthorized error when the workflow file in a PR branch differs from the version on the default branch (`main`). This is a GitHub security feature, not a bug.

## Solution

Document this behavior in CONTRIBUTING.md so contributors understand:
1. Why the error occurs
2. How to work around it
3. The process for intentionally updating workflow files

## Implementation Tasks

### Task 1: Update CONTRIBUTING.md

Add a new section "CI Workflow Notes" after the "Submitting a pull request" section that explains:

1. **What happens:** PRs that modify `.github/workflows/claude-code-review.yml` will fail CI until those changes are merged to `main` first
2. **Why:** GitHub security requires workflow files to be identical to the default branch when requesting certain tokens (like `id-token`)
3. **Workaround:** Provide the git commands to sync the workflow file with main:
   ```bash
   git checkout main -- .github/workflows/claude-code-review.yml
   git add .github/workflows/claude-code-review.yml
   git commit -m "Sync workflow with main for PR validation"
   git push
   ```
4. **For intentional workflow updates:** Explain these must be merged to `main` via a separate PR first

### Task 2: Verification

- Run `yarn build` to ensure no build issues
- Run `yarn test` to ensure no test issues
- Verify the documentation is clear and helpful

## Files to Modify

- `CONTRIBUTING.md` - Add CI workflow notes section

## Acceptance Criteria

- [ ] CONTRIBUTING.md includes clear documentation about workflow validation behavior
- [ ] Documentation includes the workaround commands
- [ ] Documentation explains the process for intentional workflow updates
- [ ] Build passes
- [ ] Tests pass
