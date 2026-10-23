# Agent Instructions

- Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout.
- Make the best decision that will elevate all three: the user experience (UX), developer experience (DX), and agent experience (AX) always, without breaking anything.
- Never use em dashes (U+2014) anywhere: UI copy, docs, comments, tests, commit messages. Rewrite with a period, comma, colon or parentheses.
- Run `npm run lint:agent` (`agentlint check --all`) before you finish; the work is complete only when it exits 0.
