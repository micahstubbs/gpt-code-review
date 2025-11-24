## Contributing

[fork]: /fork
[pr]: /compare
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Issues and PRs

If you have suggestions for how this project could be improved, or want to report a bug, open an issue! We'd love all and any contributions. If you have questions, too, we'd love to hear them.

We'd also love PRs. If you're thinking of a large PR, we advise opening up an issue first to talk about it, though! Look at the links below if you're not sure how to open a PR.

## Submitting a pull request

1. [Fork][fork] and clone the repository.
1. Configure and install the dependencies: `npm install`.
1. Make sure the tests pass on your machine: `npm test`, note: these tests also apply the linter, so there's no need to lint separately.
1. Create a new branch: `git checkout -b my-branch-name`.
1. Make your change, add tests, and make sure the tests still pass.
1. Push to your fork and [submit a pull request][pr].
1. Pat your self on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Write and update tests.
- Keep your changes as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Work in Progress pull requests are also welcome to get feedback early on, or if there is something blocked you.

## CI Workflow Notes

### Workflow Validation for PRs

If your PR modifies `.github/workflows/claude-code-review.yml`, the Claude Code Review CI check will fail with a 401 Unauthorized error. This is a GitHub security feature, not a bug.

**Why this happens:** GitHub requires workflow files to be identical to the default branch when requesting certain tokens (such as `id-token`). If the workflow content differs between your PR branch and `main`, validation fails.

**Workaround for affected PRs:**

If you need to merge a PR that includes other changes but is blocked by workflow file modifications:

```bash
git checkout main -- .github/workflows/claude-code-review.yml
git add .github/workflows/claude-code-review.yml
git commit -m "Sync workflow with main for PR validation"
git push
```

**For intentional workflow updates:**

If you need to update the workflow file itself:
1. Create a separate PR containing only the workflow changes
2. That PR's Claude Code Review check will fail (expected)
3. Get manual review and merge that PR to `main` first
4. Subsequent PRs will use the updated workflow

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
