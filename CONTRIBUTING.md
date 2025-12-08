Thank you for contributing to OpenDevBot — we appreciate it!

This document explains how to file issues, propose changes, and get your pull request accepted.

Getting started
- Fork the repository and create a feature branch from `master`:
  - `git checkout -b feat/my-feature`
- Keep your branch focused and atomic: one change per PR if possible.

Development workflow
- Install dependencies:
  - `npm ci`
- Run the development server (if needed):
  - `npm run dev`
- Run tests locally before submitting PR:
  - `npm test`
- Run linter and auto-fixable rules:
  - `npm run lint`
- Run TypeScript typecheck:
  - `npm run typecheck`

Code style
- This project uses TypeScript and ESLint. Please follow existing patterns and run `npm run lint` before opening a PR.
- Keep exported APIs typed and avoid `any` where possible.

Tests
- Add unit tests for new logic using `vitest`.
- Tests live under `_tests_/`. Run `npm test` to execute the suite.

Commit messages
- Use clear, imperative messages, e.g. `fix(loader): fallback to jiti when require fails`.
- Follow the existing commit message style (scope: short description).

Pull requests
- Open PRs against `master`.
- Include a short description of the change, motivation, and testing steps.
- Link any related issue numbers.
- Maintainers will review and request changes if needed. Small fixes may be merged quickly.

Security
- Do not include security-sensitive data in issues or PRs.
- For security reporting, see `SECURITY.md` or use the GitHub Security Advisories flow.

License
- By contributing you agree that your contributions will be licensed under the project's MIT license (see `LICENSE`).

Thank you for helping improve this project! If you have questions about the process, open an issue and tag it `meta` or `help-wanted`.