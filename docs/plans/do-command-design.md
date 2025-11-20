# `/do` Command Design

## Overview

The `/do` command is a user-level custom command for Claude Code that implements a complete end-to-end SDLC workflow from GitHub issue to merged PR with autonomous review response.

## Design Decisions

### Question 1: Workflow Scope
**Decision:** Full SDLC Orchestration
**Rationale:** Enforces best practices (worktrees, TDD, code review), leverages all superpowers skills, provides true "turnkey" solution from issue to PR.

### Question 2: Automation Level
**Decision:** Fully Automated
**Rationale:** Skills handle their own validation. Fast execution with minimal user interruption.

### Question 3: Planning Document Handling
**Decision:** Skip If Exists
**Rationale:** Idempotent - can re-run `/do 42` if implementation fails. Supports pre-planning workflow.

### Question 4: Worktree Selection
**Decision:** Auto-select First Available
**Rationale:** Fully automated, no prompts. Finds first clean worktree automatically.

### Question 5: Implementation Approach
**Decision:** Always Use Executing-Plans Skill
**Rationale:** Eliminates complexity detection logic. Skill adapts to task size. Review checkpoints valuable for all sizes.

### Question 6: Completion Workflow
**Decision:** Verification + PR + Autonomous Review Response
**Rationale:** Complete automation through to merge. Monitors PR and responds to reviews until clean.

## High-Level Workflow

```
User: /do 42

Phase 1: Planning
├─ Fetch GitHub issue #42 (gh issue view)
├─ Check for existing plan in issues/42/PLAN.md
├─ If no plan:
│  ├─ Launch superpowers:brainstorming skill
│  └─ Launch superpowers:writing-plans skill
└─ Plan ready at issues/42/PLAN.md

Phase 2: Setup
├─ Auto-select first available worktree (worktree-0 through -4)
├─ Create branch: <issue-number>/<slug-from-title>
└─ Switch to worktree + branch

Phase 3: Implementation
├─ Launch superpowers:executing-plans skill
├─ Execute plan in batches
└─ Commit as you go (TDD workflow)

Phase 4: Verification & PR
├─ Launch superpowers:verification-before-completion
├─ Create PR (gh pr create with issue reference)
└─ Open PR in browser

Phase 5: Autonomous Review Response Loop
├─ Monitor PR status (smart polling, 60s intervals)
├─ For each new review comment:
│  └─ Launch receive-code-review skill/command
├─ Push fixes after each response
└─ Exit when ALL true:
   ├─ All review comments have replies
   ├─ All gh pr checks are green
   └─ No "changes requested" status
   (Timeout after 30 minutes)
```

## Implementation Details

### Phase 1: Fetch and Plan

**Fetch Issue:**
```bash
gh issue view $ARGUMENTS --json number,title,body
```

**Check for Plan:**
- Check if `issues/<number>/PLAN.md` exists
- If exists: Load and skip to Phase 2
- If not: Run brainstorming and writing-plans skills

**Plan Location:**
- `issues/<number>/PLAN.md` (all caps)
- Created by writing-plans skill
- Committed before implementation

### Phase 2: Workspace Selection

**Logic:**
```bash
# For each worktree 0-4, check:
cd ~/workspace/worktrees/ChatGPT-CodeReview-worktree-N
git status --porcelain

# Select first worktree where:
# - No uncommitted changes
# - Current branch is main OR old feature branch

# Then:
git checkout -b <number>/<slug> main
```

**Branch Naming:**
- Format: `<issue-number>/<slug-from-title>`
- Example: `42/add-gpt5-support`
- Follows project convention from CLAUDE.md

### Phase 3: Execute Implementation

**Use Executing-Plans Skill:**
```
1. Use SlashCommand tool: /superpowers:execute-plan
   OR use Skill tool: superpowers:executing-plans

2. Point to: issues/<number>/PLAN.md
3. Let skill handle batching and reviews
4. All commits happen in the worktree branch
```

**TDD Enforcement:**
- Global CLAUDE.md enforces TDD workflow
- Tests committed before implementation
- Verification at each step

### Phase 4: Verification and PR Creation

**Verification:**
```
1. Use Skill tool: superpowers:verification-before-completion
2. Run verification commands (tests, build, linting)
3. If fail: stop and report errors
4. If pass: continue to PR creation
```

**PR Creation:**
```bash
gh pr create --fill --body "$(cat <<EOF
[Auto-generated PR body from issue]

Fixes #<issue-number>
EOF
)"

gh pr view --web
```

### Phase 5: Autonomous Review Response

**Monitoring Loop (Pseudocode):**
```python
timeout = 30 minutes
poll_interval = 60 seconds
start_time = now()

while (now() - start_time) < timeout:
    # 1. Fetch PR status
    pr_data = gh pr view --json reviews,statusCheckRollup,comments

    # 2. Check exit conditions
    all_checks_green = all checks are "success"
    no_changes_requested = no review with state="CHANGES_REQUESTED"
    all_comments_replied = each comment thread has reply

    if all_checks_green AND no_changes_requested AND all_comments_replied:
        announce("✅ PR is clean!")
        exit successfully

    # 3. Process unreplied comments
    for each review_comment without reply:
        use SlashCommand: /receive-code-review
        # Skill analyzes, fixes, commits, pushes

    # 4. Wait before next check
    sleep(poll_interval)

# Timeout reached
announce("⏱️ Timeout reached (30 min).")
announce("Re-run '/do <number>' to continue.")
```

**Exit Conditions (ALL must be true):**
1. All `gh pr checks` are green (success)
2. No review with `state="CHANGES_REQUESTED"`
3. Every review comment thread has at least one reply

## Error Handling

### Issue Not Found
```
❌ Issue #<number> not found or inaccessible
→ Check issue number and repository access
→ Exit with error
```

### No Available Worktrees
```
⚠️ All worktrees are in use
→ List each worktree status
→ Ask: continue in current dir OR exit?
```

### Plan Creation Fails
```
❌ Planning failed
→ Save partial work to issues/<number>/
→ Suggest: Review and re-run /do <number>
→ Exit with error
```

### Verification Fails
```
❌ Tests/build failed
→ Report failures
→ Do NOT create PR
→ Suggest: Fix errors and re-run /do <number>
→ Exit with error
```

### PR Creation Fails
```
❌ PR creation failed
→ Report error (conflicts, permissions)
→ Suggest manual PR creation
→ Work is committed (can manually create PR)
→ Exit with error
```

### Review Response Fails
```
⚠️ Failed to respond to N comments
→ Log failures
→ Continue to next comment (don't block loop)
→ Report at end
→ Timeout will suggest manual intervention
```

## Idempotency

Re-running `/do 42` on existing work:
- ✅ Reuses existing `issues/42/PLAN.md`
- ✅ Can resume failed implementation
- ✅ Can recover from verification failures
- ✅ Can continue monitoring existing PR
- ✅ Graceful at every phase

## Success Criteria

The `/do` command is successful when:
1. ✅ User runs `/do 42` once
2. ✅ Issue is fetched and understood
3. ✅ Plan is created (or reused)
4. ✅ Implementation completes in isolated worktree
5. ✅ Tests pass, verification succeeds
6. ✅ PR is created and opened in browser
7. ✅ Review comments are responded to autonomously
8. ✅ PR reaches clean state (checks green, reviews addressed)
9. ✅ User can merge with confidence

## Future Enhancements

Potential future additions:
- Linear ticket support (detect `ENG-123` format)
- Auto-merge when all checks pass
- Slack/email notifications on completion
- Multi-repository support
- Parallel task execution for complex issues
- Cost tracking for API usage

## References

- Project CLAUDE.md: Branch naming, TDD workflow, worktree usage
- Superpowers skills: brainstorming, writing-plans, executing-plans, verification-before-completion, receiving-code-review
- Existing commands: `/receive-code-review`, `/create-pr`, `/implement-plan`
