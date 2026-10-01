---
name: grilling
description: Stress-test a plan, design or open decision by asking the user one question at a time, each with a recommended answer, until both sides agree, and only then act. Use before a non-trivial design, for issues left open as "needs a decision", or whenever the user asks to be grilled or to have their thinking challenged.
---

# Grilling

Interview the user about every part of the plan until you reach a shared understanding. Walk down each branch of the decision tree and settle the decisions one by one, in the order they depend on each other.

## How to ask

- Ask one question at a time, and wait for the answer before the next. Several questions at once are hard to answer well.
- Give your recommended answer with every question, and say why in a sentence or two. Name the alternatives you considered and what each would cost.
- Keep a running list of what is decided. Restate it when a later answer changes an earlier one.

## Facts versus decisions

- Look up facts yourself instead of asking. Read the code, the docs, the issue and its comments (`gh issue view <n> --repo santoshyadavdev/angular-devtools --comments`), `git log`, and Angular's own source in `node_modules/@angular/*`. Quote what you found when it shapes a question.
- Put every decision to the user and wait. A decision is anything about behaviour, scope, naming, defaults, security or what the project supports. Don't settle one because it looks obvious.
- Use the words in `docs/CONTEXT.md`. If a question needs a word that isn't there, say so; the answer may belong in the glossary.

## Don't act yet

Don't edit files, open pull requests, or comment on issues until the user confirms you have reached a shared understanding. Then summarise the decisions, and hand the work to the matching skill: `devtools-fix-issue` for one issue, `devtools-work-issues` for a batch.

## Issues that need a decision

This is the tool for issues that `devtools-fix-issue` and `devtools-work-issues` leave open as "needs a decision" or "for later", such as #69, #100, #128, #157, #166 and #181. Read the issue and the code it names first, then grill the user on the open choice. Once it is settled, the issue can go through `devtools-fix-issue` like any other. If the user wants the decision recorded on the issue, draft the comment and let them post it.
