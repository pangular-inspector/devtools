---
name: devtools-work-issues
description: Work through a batch of GitHub issues in this repository with parallel agents, then combine, verify and ship them as one pull request per batch. Use when asked to fix all issues of a priority or label, or several issues at once.
---

# Work a batch of issues

Each issue still goes through the `devtools-fix-issue` skill. This skill is about running many of them at once without agents getting in each other's way.

## 1. Plan the batch

- List the issues: `gh issue list --repo santoshyadavdev/angular-devtools --label P2 --state open --limit 200`.
- Leave out issues that need a product or design decision, or a manual test the maintainer has to do. List them in the report as "for later", and settle the decisions afterwards with the `grilling` skill. If only part of an issue is clear, do that part and use `Refs #<n>` for it.
- Titles follow `area: what is wrong` (`router: a failed lazy navigation is only logged`), and the area is a commit scope, so it usually names the group. Title any follow-up issue the same way.
- Group the rest by the files they touch (inspector or area: forms, router, http, analog, signals, overlay and popup, cli and config, extension), so no two groups edit the same code. Aim for three to eight issues per group.

## 2. One worktree per group

- Create a detached worktree per group, plus one for combining, in a folder git ignores:
  `git worktree add --detach <path> <base>`, then `pnpm install --frozen-lockfile --prefer-offline` in each.
- Agents only edit files in their own worktree. They don't commit, stage, branch, stash or push. A reviewer reads each group's work with `git diff` plus the new files, which `git diff` leaves out: list them with `git ls-files --others --exclude-standard`.
- Each agent returns, per issue: fixed, partly fixed or skipped, the cause and fix in a line, the test it added, and its check results.
- With many worktrees inside the repository folder, Nx finds duplicate projects. Run it as `NX_WORKSPACE_ROOT_PATH=$PWD NX_DAEMON=false pnpm exec nx test angular-devtools`.

## 3. Combine

- Copy each group's changed and new files into the combine worktree. For a file that another group changed too, use `git merge-file` against the base version (`git show <base>:<path>`) and keep every fix.
- Run the full `devtools-verify` checks there once, and fix breakage between groups.
- Run `pnpm extension:build` once at the end, not in every group, and commit `extension/ui` in its own commit.

## 4. Verify before the pull request

Run read-only agents against the combined branch, each in its own worktree and port range:

- a code review per pull request (`devtools-reviewer` role);
- the panel in a real browser, every inspector tab, with axe (`a11y-reviewer` role);
- every agent tool through a real MCP client;
- every setup: Express hub, Vite plugin, CLI, static report, the Analog example;
- regressions: tests deleted or weakened since `main`, and removed tools, config keys or flags.

Then have a second agent try to refute each finding, and fix only what survives.

## 5. Ship

- One pull request per batch, with `Closes #<n>` per fixed issue, a "Left open" section, and the checks.
- Stacked batches (P2 built on P1, and so on): after the first is squash merged, merge `main` into the next one. Its conflicts are the same changes on both sides, so keep the branch's side, then check that the diff against the old branch head only adds what landed on `main` since. Watch for paragraphs the merge duplicates in docs.
- Conflicts in `extension/ui/assets` are build output. Drop both sides and run `pnpm extension:build` again.

## 6. Clean up

Remove the worktrees (`git worktree remove -f -f <path>`, then `git worktree prune`) and delete the merged local branches.
