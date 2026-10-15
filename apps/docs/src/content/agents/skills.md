---
title: Agent skills
description: The package ships agent skills that teach a coding agent when and how to use the devtools tools. Install them with pangular skills install.
---

<ngmd-hero title="Agent skills" gradient>
  Skills tell your coding agent which devtools tool answers which question, and how to inspect, fix and verify in a loop.
</ngmd-hero>

# Agent skills

A skill is a folder with a `SKILL.md` file that an agent reads when a task matches its description. `@pangular-inspector/devtools` ships four in its `skills` folder:

| Skill                  | What it covers                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular-inspector`   | Checking the connection with `list-pages`, the inspect, fix and verify loop, which tool answers which question, safety tiers and empty answers. |
| `pangular-forms`       | Why a form is invalid, won't submit or sends the wrong payload, and proving a fix with `form-history` and `form-diff`.                          |
| `pangular-errors`      | Runtime errors and console calls: `list-errors`, `explain-error` and the NG0100, NG0201 and NG0500 explainers.                                  |
| `pangular-performance` | Change detection recordings, `diagnose-change-detection`, wasted checks, OnPush hints and `find-leaks`.                                         |

The skills use the tools of the [MCP server](./mcp-server.md), so connect it first.

The HTTP endpoint also serves the same workflows as MCP prompts, which need no install. See [Prompts](./mcp-server.md#prompts).

## Install them

Run the command in your project folder. It copies the skills into your agent's skill folder.

```bash group="skills" name="pnpm" active
pnpm exec pangular skills install
```

```bash group="skills" name="npm"
npx pangular skills install
```

```bash group="skills" name="yarn"
yarn pangular skills install
```

```bash group="skills" name="bun"
bunx pangular skills install
```

Commit the folder, so everyone on the project gets the skills. `pangular skills` without `install` lists the bundled skills.

### Flags

| Flag             | What it does                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--agent <name>` | The skill folder to use: `claude` (`.claude/skills`, the default), `agents` (`.agents/skills`) or `github` (`.github/skills`). |
| `--dir <folder>` | Installs into this folder instead, relative to the project folder.                                                             |
| `--global`       | Uses the agent's folder in your home directory, such as `~/.claude/skills`.                                                    |
| `--skill <name>` | Installs only this skill. Repeat it for more.                                                                                  |
| `--dry-run`      | Prints what would change and writes nothing.                                                                                   |
| `--force`        | Replaces skills that exist and differ from the bundled copy.                                                                   |
| `--root <dir>`   | The project folder. Defaults to `PANGULAR_ROOT`, then the working directory.                                                   |

### Existing skills

The command compares each file with the bundled copy:

| Result       | When                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `Installed`  | The skill folder did not exist.                                               |
| `Up to date` | Every file matches the bundled copy.                                          |
| `Skipped`    | A file differs, and `--force` is not set. The line names the files.           |
| `Replaced`   | A file differs, and `--force` is set. Only the files that differ are written. |

Files you added to a skill folder stay. After you update the package, run the command again with `--dry-run` to see which skills changed, then with `--force` to take them.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Tools"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
</ngmd-pill-row>
