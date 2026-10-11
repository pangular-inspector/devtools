# Using fixup commits

When you address review feedback, add fixup commits instead of rewriting the commits a reviewer has already read. The reviewer then sees only what changed since their last pass, and the history is cleaned up just before merge.

## Making a fixup commit

Point the fixup at the commit it belongs to:

```sh
git add <files>
git commit --fixup <sha>   # or --fixup HEAD for the latest commit
git push
```

The commit is named `fixup! <original header>`. The commit message checks skip these commits.

## Before merge

Pull requests are squash merged, so fixup commits disappear on `main`. If a maintainer asks you to clean up the branch first, fold the fixups into their targets and force-push:

```sh
git rebase -i --autosquash main
git push --force-with-lease
```

## Rewording a commit message

If the check in CI flags a commit message, reword it:

```sh
git rebase -i main          # mark the commit as "reword"
git push --force-with-lease
```

Or, for the latest commit only, `git commit --amend` and push with `--force-with-lease`.
