# Contributing

Thanks for helping. The most useful contributions are requirement templates for other majors and fixes to existing rules.

## Setup

```sh
npm install
npm run dev
```

Before opening a pull request, run:

```sh
npm run check && npm test && npm run build
```

CI runs the same three commands on every PR, and CodeRabbit leaves an automated review.

## Guidelines

- Requirement logic lives in `src/lib/` as pure functions. Add or update a test in `src/lib/*.test.ts` for any rule change.
- New majors are JSON in `src/templates/`. Follow [docs/templates.md](docs/templates.md) and link the official checklist or handbook page in your PR.
- Keep plans local. BearPlan has no backend, accounts or analytics, and PRs that add them need discussion in an issue first.
- Don't commit real transcripts. The `local/` folder is gitignored for personal plan files.

## Reporting a wrong requirement

Open an issue with the major, your entry year, what the app says, what the handbook says, and a link to the handbook page.
