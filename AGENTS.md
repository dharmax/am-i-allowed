# Repository Guidelines

## Project Structure & Module Organization
The TypeScript sources live under `src/`, with `index.ts` re-exporting the public API and feature modules such as `am-i-allowed.ts`, `permission-checker.ts`, and the `operations-taxonomy`. Compiled JavaScript is emitted into `dist/`; avoid editing generated files directly. Tests reside in `tests/` and follow the `*.spec.ts` naming convention. Shared configuration sits at the root (`tsconfig.json`, `package.json`, `pnpm-lock.yaml`). Treat `README.md` as the user-facing overview and keep deep dives inside the source comments.

## Build, Test, and Development Commands
Install dependencies with `pnpm install` (matching the checked-in lockfile) or `npm install` if pnpm is unavailable. Use `pnpm build` to transpile TypeScript to `dist/` via `tsc`. Run `pnpm test` to execute the Mocha suite through `ts-node` against all spec files. Before publishing or tagging releases, ensure `pnpm run prepublish` (equivalent to `pnpm build`) completes cleanly.

## Coding Style & Naming Conventions
Match the existing TypeScript style: 4-space indentation, double quotes for module imports, and minimal semicolons. Prefer explicit types on public functions and exported interfaces (`IActor`, `IPermissionStore`) to keep the library self-documenting. Follow the established file naming—verbs and nouns in kebab case (e.g., `in-memory-store.ts`). Run `pnpm build` after significant changes to surface any compile-time issues early.

## Testing Guidelines
Tests use Mocha with Chai assertions through `ts-node/register/transpile-only`. Place new suites in `tests/` named `<feature>.spec.ts`, grouping scenarios with `describe` blocks and single-behavior `it` cases. Maintain deterministic data seeds and mirror real permission flows when possible. Aim to cover new branches in `PrivilegeManager`, custom permission checkers, and taxonomy helpers; add regression tests when fixing bugs.

## Commit & Pull Request Guidelines
Write commits in the repository’s terse style, preferring lowercase imperative prefixes (`enhancement:`, `fixed:`, `version`). Keep the subject under 72 characters and expand rationale in the body if needed. For pull requests, include: a concise summary of behavior changes, references to issues or discussions, test output (`pnpm test`), and screenshots or logs when UI or console behavior shifts. Flag any breaking API changes prominently.

## Agent-Specific Notes
When exploring the codebase, avoid mutating `dist/` directly—always regenerate via the build. Validate TypeScript typing before shipping changes, and document non-obvious flows with short comments inline rather than expanding this guide.
Consult `PERSISTENCE.md` when you need to extend or replace the in-memory permission store.
