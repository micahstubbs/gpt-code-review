import { Context, Probot } from 'probot';
import { minimatch } from 'minimatch';

import { Chat } from './chat.js';
import log from 'loglevel';

const MAX_PATCH_COUNT = process.env.MAX_PATCH_LENGTH ? +process.env.MAX_PATCH_LENGTH : Infinity;
const TRIGGER_COMMAND = '/gpt-review';
const OPENAI_BILLING_URL = 'https://platform.openai.com/settings/organization/billing/overview';

// Security: Sanitize errors to prevent API key leakage in logs
// OpenAI API keys start with 'sk-' and are 51+ characters
const API_KEY_PATTERN = /sk-[a-zA-Z0-9_-]{20,}/g;
const sanitizeError = (error: unknown): string => {
  const errorStr = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
  // Replace any API keys with [REDACTED]
  return errorStr.replace(API_KEY_PATTERN, '[REDACTED_API_KEY]');
};

// Check if automatic reviews are enabled (defaults to true for backward compatibility)
const isAutoReviewEnabled = (): boolean => {
  const value = process.env.AUTO_REVIEW?.toLowerCase();
  // If not set, default to true (automatic reviews enabled)
  if (value === undefined || value === '') {
    return true;
  }
  // Explicitly disabled with 'false', '0', or 'off'
  return !['false', '0', 'off', 'no', 'disabled'].includes(value);
};

// Check if maintainer review restriction is enabled
// Returns: true (require maintainer), false (allow anyone), or null (use default based on repo visibility)
const getMaintainerReviewSetting = (): boolean | null => {
  const value = process.env.REQUIRE_MAINTAINER_REVIEW?.toLowerCase();
  if (value === undefined || value === '') {
    return null; // Use default based on repo visibility
  }
  // Explicitly enabled
  if (['true', '1', 'on', 'yes', 'enabled'].includes(value)) {
    return true;
  }
  // Explicitly disabled
  if (['false', '0', 'off', 'no', 'disabled'].includes(value)) {
    return false;
  }
  return null; // Invalid value, use default
};

// Permission levels that are considered "maintainer" level
const MAINTAINER_PERMISSIONS = ['admin', 'maintain', 'write'];

// Helper to detect OpenAI API errors and return user-friendly messages
const getOpenAIErrorMessage = (error: unknown): string | null => {
  const errorStr = String(error);
  const errorMessage = error instanceof Error ? error.message : errorStr;

  // Check for common OpenAI API errors
  if (errorMessage.includes('insufficient_quota') || errorMessage.includes('exceeded your current quota')) {
    return `**OpenAI API Quota Exceeded**

Your OpenAI API key has exceeded its usage quota. To fix this:

1. Visit [OpenAI Billing](${OPENAI_BILLING_URL}) to add credits
2. Wait a few minutes for the quota to refresh
3. Try again by commenting \`/gpt-review\``;
  }

  if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
    return `**OpenAI API Rate Limited**

Too many requests to the OpenAI API. Please wait a moment and try again.

If this persists, check your [OpenAI Billing & Usage](${OPENAI_BILLING_URL}) for rate limit details.`;
  }

  if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Incorrect API key')) {
    return `**Invalid OpenAI API Key**

The configured OpenAI API key is invalid. To fix this:

1. Go to your repository **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab
2. Update the \`OPENAI_API_KEY\` secret with a valid key from [OpenAI API Keys](https://platform.openai.com/api-keys)`;
  }

  if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
    return `**OpenAI Authentication Failed**

Unable to authenticate with the OpenAI API. Please verify your API key is correctly configured.

1. Go to your repository **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab
2. Check that \`OPENAI_API_KEY\` secret is set correctly`;
  }

  // Not an OpenAI error we recognize
  return null;
};

export const robot = (app: Probot) => {
  // Helper to post error comments on PRs
  const postErrorComment = async (
    context: Context,
    repo: { owner: string; repo: string },
    pullNumber: number,
    message: string
  ) => {
    try {
      await context.octokit.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: pullNumber,
        body: message,
      });
    } catch (e) {
      log.error('Failed to post error comment:', sanitizeError(e));
    }
  };

  // Check if user has maintainer-level permissions on the repository
  const checkUserPermission = async (
    context: Context,
    repo: { owner: string; repo: string },
    username: string
  ): Promise<{ hasPermission: boolean; permission: string }> => {
    try {
      const { data } = await context.octokit.repos.getCollaboratorPermissionLevel({
        owner: repo.owner,
        repo: repo.repo,
        username: username,
      });
      const permission = data.permission;
      const hasPermission = MAINTAINER_PERMISSIONS.includes(permission);
      log.debug(`User ${username} has permission: ${permission}, maintainer: ${hasPermission}`);
      return { hasPermission, permission };
    } catch (e) {
      log.error(`Failed to check permission for ${username}:`, sanitizeError(e));
      // If we can't check permissions, deny by default for safety
      return { hasPermission: false, permission: 'unknown' };
    }
  };

  // Determine if maintainer restriction should be enforced
  const shouldRequireMaintainer = async (
    context: Context,
    repo: { owner: string; repo: string }
  ): Promise<boolean> => {
    const setting = getMaintainerReviewSetting();

    // If explicitly configured, use that setting
    if (setting !== null) {
      return setting;
    }

    // Default behavior: require maintainer for public repos, allow anyone for private
    try {
      const { data: repoData } = await context.octokit.repos.get({
        owner: repo.owner,
        repo: repo.repo,
      });
      const isPublic = !repoData.private;
      log.debug(`Repository ${repo.owner}/${repo.repo} is ${isPublic ? 'public' : 'private'}`);
      return isPublic; // Require maintainer for public repos by default
    } catch (e) {
      log.error('Failed to get repository visibility:', sanitizeError(e));
      // If we can't determine visibility, be safe and require maintainer
      return true;
    }
  };

  const loadChat = async (context: Context, issueNumber?: number) => {
    if (process.env.USE_GITHUB_MODELS === 'true' && process.env.GITHUB_TOKEN) {
      return new Chat(process.env.GITHUB_TOKEN);
    }

    if (process.env.OPENAI_API_KEY) {
      return new Chat(process.env.OPENAI_API_KEY);
    }

    // No API key found - post error message
    const repo = context.repo();
    const prNumber = issueNumber || context.pullRequest().pull_number;
    await context.octokit.issues.createComment({
      repo: repo.repo,
      owner: repo.owner,
      issue_number: prNumber,
      body: `**OPENAI_API_KEY not configured**

To enable code reviews, add your OpenAI API key to your repository secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab
2. Click **New repository secret**
3. Name: \`OPENAI_API_KEY\`
4. Value: Your API key from [platform.openai.com](https://platform.openai.com/api-keys)

Then ensure your workflow passes the secret as an environment variable:
\`\`\`yml
env:
  OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
\`\`\`

See the [README](https://github.com/micahstubbs/gpt-code-review) for setup instructions.`,
    });
    return null;
  };

  // Core review logic - shared between pull_request and issue_comment handlers
  const performReview = async (
    context: Context,
    repo: { owner: string; repo: string },
    chat: Chat,
    pullNumber: number,
    baseSha: string,
    headSha: string,
    isSync: boolean = false
  ) => {
    const data = await context.octokit.repos.compareCommits({
      owner: repo.owner,
      repo: repo.repo,
      base: baseSha,
      head: headSha,
    });

    let { files: changedFiles, commits } = data.data;

    log.debug('compareCommits, base:', baseSha, 'head:', headSha);
    log.debug('compareCommits.commits:', commits);
    log.debug('compareCommits.files', changedFiles);

    if (isSync && commits.length >= 2) {
      const {
        data: { files },
      } = await context.octokit.repos.compareCommits({
        owner: repo.owner,
        repo: repo.repo,
        base: commits[commits.length - 2].sha,
        head: commits[commits.length - 1].sha,
      });

      changedFiles = files;
    }

    const ignoreList = (process.env.IGNORE || process.env.ignore || '')
      .split('\n')
      .filter((v) => v !== '');
    const ignorePatterns = (process.env.IGNORE_PATTERNS || '')
      .split(',')
      .filter((v) => Boolean(v.trim()));
    const includePatterns = (process.env.INCLUDE_PATTERNS || '')
      .split(',')
      .filter((v) => Boolean(v.trim()));

    log.debug('ignoreList:', ignoreList);
    log.debug('ignorePatterns:', ignorePatterns);
    log.debug('includePatterns:', includePatterns);

    changedFiles = changedFiles?.filter((file) => {
      const url = new URL(file.contents_url);
      const pathname = decodeURIComponent(url.pathname);
      // if includePatterns is not empty, only include files that match the pattern
      if (includePatterns.length) {
        return matchPatterns(includePatterns, pathname);
      }

      if (ignoreList.includes(file.filename)) {
        return false;
      }

      // if ignorePatterns is not empty, ignore files that match the pattern
      if (ignorePatterns.length) {
        return !matchPatterns(ignorePatterns, pathname);
      }

      return true;
    });

    if (!changedFiles?.length) {
      log.info('no change found');
      return 'no change';
    }

    console.time('gpt cost');

    const ress = [];

    for (let i = 0; i < changedFiles.length; i++) {
      const file = changedFiles[i];
      const patch = file.patch || '';

      if (file.status !== 'modified' && file.status !== 'added') {
        continue;
      }

      if (!patch || patch.length > MAX_PATCH_COUNT) {
        log.info(`${file.filename} skipped caused by its diff is too large`);
        continue;
      }
      try {
        const res = await chat?.codeReview(patch);
        if (!res.lgtm && !!res.review_comment) {
          // Calculate safe position: use first non-header line of patch
          // Patch format: starts with @@ line, then diff lines
          const patchLines = patch.split('\n');
          // Find first line after @@ header (safe position for comment)
          let position = 1;
          for (let j = 0; j < patchLines.length; j++) {
            if (patchLines[j].startsWith('@@')) {
              // Position is 1-indexed, and we want the line after header
              position = j + 2; // +1 for index→line, +1 for line after header
              break;
            }
          }
          // Ensure position is within valid range
          position = Math.min(position, patchLines.length);

          ress.push({
            path: file.filename,
            body: res.review_comment,
            position: position,
          });
        }
      } catch (e) {
        log.info(`review ${file.filename} failed:`, sanitizeError(e));
        throw e;
      }
    }

    try {
      const modelId = chat.getModel();
      await context.octokit.pulls.createReview({
        repo: repo.repo,
        owner: repo.owner,
        pull_number: pullNumber,
        body: ress.length ? `Code review by ${modelId}` : 'LGTM 👍',
        event: 'COMMENT',
        commit_id: commits[commits.length - 1].sha,
        comments: ress,
      });
    } catch (e) {
      log.info('Failed to create review:', sanitizeError(e));
      throw e;
    }

    console.timeEnd('gpt cost');
    return 'success';
  };

  // Handle issue comments for /gpt-review trigger
  app.on('issue_comment.created', async (context) => {
    const { comment, issue } = context.payload;

    // Check if comment contains the trigger command
    if (!comment.body.includes(TRIGGER_COMMAND)) {
      log.debug('Comment does not contain trigger command, skipping');
      return 'no trigger';
    }

    // Check if this is a PR comment (not a regular issue)
    if (!issue.pull_request) {
      log.info('Comment is not on a pull request, skipping');
      return 'not a PR';
    }

    const repo = context.repo();
    const pullNumber = issue.number;
    const commenter = comment.user.login;

    log.info(`Triggered by ${TRIGGER_COMMAND} command on PR #${pullNumber} by ${commenter}`);

    // Check if maintainer restriction is enabled and user has permission
    const requireMaintainer = await shouldRequireMaintainer(context, repo);
    if (requireMaintainer) {
      const { hasPermission, permission } = await checkUserPermission(context, repo, commenter);
      if (!hasPermission) {
        log.info(`User ${commenter} lacks permission (${permission}) to trigger review`);
        // Add a thumbs down reaction to indicate permission denied
        try {
          await context.octokit.reactions.createForIssueComment({
            owner: repo.owner,
            repo: repo.repo,
            comment_id: comment.id,
            content: '-1',
          });
        } catch (e) {
          log.debug('Failed to add rejection reaction', e);
        }
        // Post a comment explaining why the command was rejected
        await postErrorComment(
          context,
          repo,
          pullNumber,
          `@${commenter} The \`/gpt-review\` command is restricted to repository maintainers (users with write access or higher). ` +
            `This protects the repository owner's OpenAI API tokens from unauthorized usage.\n\n` +
            `If you need a code review, please ask a maintainer to run the command.`
        );
        return 'permission denied';
      }
    }

    // Add a reaction to acknowledge the command
    try {
      await context.octokit.reactions.createForIssueComment({
        owner: repo.owner,
        repo: repo.repo,
        comment_id: comment.id,
        content: 'eyes',
      });
    } catch (e) {
      log.debug('Failed to add reaction', e);
    }

    const chat = await loadChat(context, pullNumber);

    if (!chat) {
      log.info('Chat initialized failed');
      return 'no chat';
    }

    // Fetch the PR details
    const { data: pullRequest } = await context.octokit.pulls.get({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: pullNumber,
    });

    if (pullRequest.state === 'closed' || pullRequest.locked) {
      log.info('PR is closed or locked');
      return 'invalid PR state';
    }

    try {
      const result = await performReview(
        context,
        repo,
        chat,
        pullNumber,
        pullRequest.base.sha,
        pullRequest.head.sha,
        false // not a sync event, review all changes
      );

      log.info('successfully reviewed via comment trigger', pullRequest.html_url);
      return result;
    } catch (e) {
      const errorMessage = getOpenAIErrorMessage(e);
      if (errorMessage) {
        await postErrorComment(context, repo, pullNumber, errorMessage);
        return 'openai error';
      }
      // Re-throw non-OpenAI errors
      throw e;
    }
  });

  app.on(['pull_request.opened', 'pull_request.synchronize'], async (context) => {
    // Check if automatic reviews are disabled
    if (!isAutoReviewEnabled()) {
      log.info('Automatic reviews disabled (AUTO_REVIEW=false). Use /gpt-review to trigger.');
      return 'auto review disabled';
    }

    const repo = context.repo();
    const chat = await loadChat(context);

    if (!chat) {
      log.info('Chat initialized failed');
      return 'no chat';
    }

    const pull_request = context.payload.pull_request;

    log.debug('pull_request:', pull_request);

    if (pull_request.state === 'closed' || pull_request.locked) {
      log.info('invalid event payload');
      return 'invalid event payload';
    }

    const target_label = process.env.TARGET_LABEL;
    if (
      target_label &&
      (!pull_request.labels?.length ||
        pull_request.labels.every((label) => label.name !== target_label))
    ) {
      log.info('no target label attached');
      return 'no target label attached';
    }

    const isSync = context.payload.action === 'synchronize';
    const pullNumber = context.pullRequest().pull_number;

    try {
      const result = await performReview(
        context,
        repo,
        chat,
        pullNumber,
        pull_request.base.sha,
        pull_request.head.sha,
        isSync
      );

      log.info('successfully reviewed', pull_request.html_url);
      return result;
    } catch (e) {
      const errorMessage = getOpenAIErrorMessage(e);
      if (errorMessage) {
        await postErrorComment(context, repo, pullNumber, errorMessage);
        return 'openai error';
      }
      // Re-throw non-OpenAI errors
      throw e;
    }
  });
};

const matchPatterns = (patterns: string[], path: string) => {
  return patterns.some((pattern) => {
    try {
      return minimatch(
        path,
        pattern.startsWith('/')
          ? '**' + pattern
          : pattern.startsWith('**')
            ? pattern
            : '**/' + pattern
      );
    } catch {
      // if the pattern is not a valid glob pattern, try to match it as a regular expression
      try {
        return new RegExp(pattern).test(path);
      } catch (e) {
        return false;
      }
    }
  });
};
